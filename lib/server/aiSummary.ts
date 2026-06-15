import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildClientVisitDashboard } from '@/lib/clientDashboard';
import type { AIExecutiveSummary, AIReportSummaryResponse } from '@/types/ai';
import type { BaseDeCompraRow } from '@/types/sales';
import {
  getBaseDeCompraForSupabase,
  getClientSalesHistoryForSupabase,
  getDashboardSummaryForSupabase,
} from '@/lib/server/reportData';
import { isAIReportSummaryEnabled } from '@/lib/server/env';
import { enforceAIRateLimit } from '@/lib/server/rateLimit';

type DbClient = SupabaseClient<any, 'public', any>;

interface ProductMovement {
  cod_referencia: string;
  descr_produto: string;
  currentTotal: number;
  previousTotal: number;
  delta: number;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
      refusal?: string;
    };
  }>;
}

const OPENAI_TIMEOUT_MS = 30_000;
const MAX_COMPLETION_TOKENS = 1_000;

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function mapByReference(rows: BaseDeCompraRow[]) {
  return new Map(
    rows.map((row) => [
      row.cod_referencia,
      {
        cod_referencia: row.cod_referencia,
        descr_produto: row.descr_produto,
        total: toNumber(row.total_ano),
      },
    ])
  );
}

function buildGlobalMovement(
  currentRows: BaseDeCompraRow[],
  previousRows: BaseDeCompraRow[]
) {
  const currentMap = mapByReference(currentRows);
  const previousMap = mapByReference(previousRows);
  const keys = new Set([...currentMap.keys(), ...previousMap.keys()]);

  const movement = Array.from(keys)
    .map((key) => {
      const current = currentMap.get(key);
      const previous = previousMap.get(key);

      return {
        cod_referencia: key,
        descr_produto: current?.descr_produto ?? previous?.descr_produto ?? key,
        currentTotal: current?.total ?? 0,
        previousTotal: previous?.total ?? 0,
        delta: (current?.total ?? 0) - (previous?.total ?? 0),
      } satisfies ProductMovement;
    })
    .filter((item) => item.currentTotal > 0 || item.previousTotal > 0);

  const topProducts = [...movement]
    .sort((a, b) => b.currentTotal - a.currentTotal)
    .slice(0, 8);
  const growthProducts = [...movement]
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 6);
  const declineProducts = [...movement]
    .filter((item) => item.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 6);

  return {
    topProducts,
    growthProducts,
    declineProducts,
  };
}

/**
 * Modelos da família gpt-5 (raciocínio) não aceitam o parâmetro temperature
 * com valor diferente do default — retornam HTTP 400 caso recebam um valor
 * explícito. Para esses modelos omitimos o campo; para os demais enviamos 0.2.
 */
function isGpt5Family(model: string) {
  return /^gpt-5/i.test(model);
}

async function generateSummaryWithOpenAI(
  model: string,
  apiKey: string,
  payload: Record<string, unknown>
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  let response: Response;

  const temperatureParam = isGpt5Family(model) ? {} : { temperature: 0.2 };

  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      ...temperatureParam,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages: [
        {
          role: 'system',
          content:
            'Você é um analista comercial sênior. Use apenas os dados fornecidos. Não invente fatos externos. Responda em português do Brasil com frases curtas, executivas e acionáveis.',
        },
        {
          role: 'user',
          content: `Gere um resumo executivo estruturado para este contexto comercial.\n\n${JSON.stringify(
            payload
          )}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'executive_report_summary',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              headline: { type: 'string' },
              highlights: {
                type: 'array',
                minItems: 2,
                maxItems: 4,
                items: { type: 'string' },
              },
              risks: {
                type: 'array',
                minItems: 2,
                maxItems: 4,
                items: { type: 'string' },
              },
              opportunities: {
                type: 'array',
                minItems: 2,
                maxItems: 4,
                items: { type: 'string' },
              },
              recommended_actions: {
                type: 'array',
                minItems: 3,
                maxItems: 5,
                items: { type: 'string' },
              },
            },
            required: [
              'headline',
              'highlights',
              'risks',
              'opportunities',
              'recommended_actions',
            ],
          },
        },
      },
    }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A geracao do resumo excedeu o tempo limite.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Falha ao gerar resumo com IA (${response.status}).`);
  }

  const json = (await response.json()) as OpenAIChatResponse;
  const message = json.choices?.[0]?.message;

  if (message?.refusal) {
    throw new Error('O modelo recusou a geração do resumo.');
  }

  if (!message?.content) {
    throw new Error('A resposta da IA veio vazia.');
  }

  return JSON.parse(message.content) as AIExecutiveSummary;
}

export async function buildAIReportSummary(
  supabase: DbClient,
  {
    year,
    codCliente,
    scope,
  }: {
    year: number | null;
    codCliente?: string | null;
    scope?: string;
  }
): Promise<AIReportSummaryResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_REPORT_SUMMARY_MODEL || 'gpt-5-mini';

  if (!isAIReportSummaryEnabled() || !apiKey) {
    return { available: false, reason: 'missing_api_key' };
  }

  if (!year) {
    return { available: false, reason: 'missing_year' };
  }

  await enforceAIRateLimit(supabase, 'ai_report_summary');

  let payload: Record<string, unknown>;

  if (scope === 'client' || codCliente) {
    const rows = await getClientSalesHistoryForSupabase(supabase, codCliente!);

    if (rows.length === 0) {
      return { available: false, reason: 'no_data' };
    }

    const dashboard = buildClientVisitDashboard(rows, year);

    payload = {
      scope: 'client',
      year,
      codCliente,
      summary: dashboard.summary,
      rule_based_insights: dashboard.insights,
      top_products: dashboard.topProducts.slice(0, 6),
      attention_products: dashboard.attentionProducts.slice(0, 5),
      growth_products: dashboard.growthProducts.slice(0, 5),
      recent_orders: dashboard.recentOrders.slice(0, 5),
    };
  } else {
    const [summary, currentRows, previousRows] = await Promise.all([
      getDashboardSummaryForSupabase(supabase, year),
      getBaseDeCompraForSupabase(supabase, year),
      getBaseDeCompraForSupabase(supabase, year - 1),
    ]);

    if (!summary || currentRows.length === 0) {
      return { available: false, reason: 'no_data' };
    }

    const movement = buildGlobalMovement(currentRows, previousRows);

    payload = {
      scope: 'global',
      year,
      summary,
      top_products: movement.topProducts,
      growth_products: movement.growthProducts,
      decline_products: movement.declineProducts,
    };
  }

  const summary = await generateSummaryWithOpenAI(model, apiKey, payload);

  return {
    available: true,
    model,
    generatedAt: new Date().toISOString(),
    summary,
  };
}

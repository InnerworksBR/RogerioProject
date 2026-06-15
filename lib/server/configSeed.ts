import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getConfigItemsForSupabase,
  getProductCatalogForSupabase,
} from '@/lib/server/reportData';
import type {
  ConfigSeedSuggestion,
  ProductCatalogRow,
  ReportConfigItem,
  ReportKey,
  SeedSuggestionsResponse,
} from '@/types/config';

type DbClient = SupabaseClient<any, 'public', any>;

interface InsertableConfigItem {
  report_key: ReportKey;
  cod_referencia: string;
  categoria: string | null;
  label: string;
  sort_order: number;
  extra_data: Record<string, string>;
}

interface SeedSuggestionPlan {
  response: SeedSuggestionsResponse;
  insertsByReport: Record<ReportKey, InsertableConfigItem[]>;
}

const BAGAGITO_REGEX = /\bBAGAGITO\b/i;
const YEAR_RANGE_REGEX =
  /\b(\d{2,4}\s*\/\s*\d{2,4}|\d{4}\s*>\s*|>\s*\d{4}|\d{4}\s*-\s*\d{4})\b/i;
const COLOR_KEYWORDS = [
  'PRETO',
  'PRETO LISO',
  'CINZA',
  'CINZA CLARO',
  'CINZA ESCURO',
  'GRAFITE',
  'BRANCO',
  'PRATA',
  'PRIMER',
  'TEXTURIZADO',
] as const;

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

// PRD Relatório 4: um produto é bagagito se o Cód. Referência começa com "4"
// OU a descrição contém "BAGAGITO". Decisão do cliente (2026-06-15): aplicar a
// regra completa do PRD como alta confiança.
function isBagagitoRow(row: ProductCatalogRow) {
  return row.cod_referencia.startsWith('4') || BAGAGITO_REGEX.test(row.descr_produto);
}

function buildConfidenceSuggestion(
  reportKey: ReportKey,
  row: ProductCatalogRow,
  extraData: Record<string, string>,
  categoria: string | null,
  confidence?: 'high' | 'low'
): ConfigSeedSuggestion {
  return {
    reportKey,
    cod_referencia: row.cod_referencia,
    label: cleanText(row.descr_produto),
    categoria,
    extra_data: extraData,
    total_quantidade: Number(row.total_quantidade ?? 0),
    total_valor: Number(row.total_valor ?? 0),
    confidence,
  };
}

function extractYearRange(description: string) {
  return description.match(YEAR_RANGE_REGEX)?.[1]?.replace(/\s+/g, ' ') ?? '';
}

function extractColor(description: string) {
  const normalized = cleanText(description).toUpperCase();

  for (const keyword of COLOR_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return keyword;
    }
  }

  return '';
}

function extractApplication(description: string, kind: 'bagagitos' | 'geral') {
  const normalized = cleanText(description);
  const withoutYear = normalized.replace(YEAR_RANGE_REGEX, '').trim();
  const parts = withoutYear
    .split(/\s+-\s+/)
    .map((part) => cleanText(part))
    .filter(Boolean);
  const firstPart = parts[0] ?? normalized;

  if (kind === 'bagagitos') {
    return firstPart.replace(/^BAGAGITO\s+/i, '').trim();
  }

  return firstPart;
}

function buildBagagitoExtra(description: string) {
  return {
    emb: '',
    plastiron: '',
    ano_aplicacao: extractYearRange(description),
    aplicacao: extractApplication(description, 'bagagitos'),
    cor: extractColor(description),
    outros_dados: '',
  };
}

function buildGeralExtra(description: string) {
  return {
    status: 'Ativo',
    emb: '',
    plastiron: '',
    ano_aplicacao: extractYearRange(description),
    aplicacao: extractApplication(description, 'geral'),
    cor: extractColor(description),
    outros_dados: '',
  };
}

function buildBaseItensExtra() {
  return {
    dts: '',
    r2a: '',
    lumax: '',
    loma: '',
    lancamento: '',
  };
}

function createInsertRows(
  reportKey: ReportKey,
  suggestions: ConfigSeedSuggestion[],
  existingCount: number
): InsertableConfigItem[] {
  return suggestions.map((item, index) => ({
    report_key: reportKey,
    cod_referencia: item.cod_referencia,
    label: item.label,
    categoria: item.categoria,
    sort_order: existingCount + index,
    extra_data: item.extra_data,
  }));
}

export function buildSeedSuggestionPlan(
  catalog: ProductCatalogRow[],
  existingItems: ReportConfigItem[]
): SeedSuggestionPlan {
  const existingByReport = {
    base_itens: new Set(
      existingItems
        .filter((item) => item.report_key === 'base_itens' && item.cod_referencia)
        .map((item) => item.cod_referencia!)
    ),
    bagagitos: new Set(
      existingItems
        .filter((item) => item.report_key === 'bagagitos' && item.cod_referencia)
        .map((item) => item.cod_referencia!)
    ),
    geral: new Set(
      existingItems
        .filter((item) => item.report_key === 'geral' && item.cod_referencia)
        .map((item) => item.cod_referencia!)
    ),
  };

  const existingCounts = {
    base_itens: existingByReport.base_itens.size,
    bagagitos: existingByReport.bagagitos.size,
    geral: existingByReport.geral.size,
  };

  const highConfidenceBagagitoCodes = new Set(
    catalog.filter(isBagagitoRow).map((row) => row.cod_referencia)
  );

  const bagagitos = catalog
    .filter(
      (row) => isBagagitoRow(row) && !existingByReport.bagagitos.has(row.cod_referencia)
    )
    .map((row) =>
      buildConfidenceSuggestion(
        'bagagitos',
        row,
        buildBagagitoExtra(row.descr_produto),
        null,
        'high'
      )
    );

  // A regra do PRD (prefixo "4" OU descrição) agora é aplicada por completo como
  // alta confiança, então não há mais uma categoria de baixa confiança separada.
  const bagagitoLowConfidencePreview: ConfigSeedSuggestion[] = [];

  const baseItens = catalog
    .filter(
      (row) =>
        !highConfidenceBagagitoCodes.has(row.cod_referencia) &&
        !existingByReport.base_itens.has(row.cod_referencia)
    )
    .slice(0, 150)
    .map((row) =>
      buildConfidenceSuggestion(
        'base_itens',
        row,
        buildBaseItensExtra(),
        null,
        'high'
      )
    );

  const geral = catalog
    .filter((row) => !existingByReport.geral.has(row.cod_referencia))
    .map((row) =>
      buildConfidenceSuggestion(
        'geral',
        row,
        buildGeralExtra(row.descr_produto),
        'Sem categoria',
        'high'
      )
    );

  return {
    response: {
      baseItens: {
        existingCount: existingCounts.base_itens,
        suggestedCount: baseItens.length,
        sample: baseItens.slice(0, 8),
      },
      bagagitos: {
        existingCount: existingCounts.bagagitos,
        suggestedCount: bagagitos.length,
        sample: bagagitos.slice(0, 8),
        lowConfidencePreview: bagagitoLowConfidencePreview,
      },
      geral: {
        existingCount: existingCounts.geral,
        suggestedCount: geral.length,
        sample: geral.slice(0, 8),
        uncategorizedCount: geral.length,
      },
    },
    insertsByReport: {
      base_itens: createInsertRows('base_itens', baseItens, existingCounts.base_itens),
      bagagitos: createInsertRows('bagagitos', bagagitos, existingCounts.bagagitos),
      geral: createInsertRows('geral', geral, existingCounts.geral),
    },
  };
}

export async function buildSeedSuggestionPlanForSupabase(
  supabase: DbClient,
  ownerId: string
): Promise<SeedSuggestionPlan> {
  const [catalog, existingItems] = await Promise.all([
    getProductCatalogForSupabase(supabase),
    getConfigItemsForSupabase(supabase, undefined, ownerId),
  ]);

  return buildSeedSuggestionPlan(catalog, existingItems);
}

import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { MONTH_LABELS } from '@/types/sales';
import { getAdminSupabaseClient } from '@/lib/server/adminSupabase';

const SHARE_LINK_TTL_DAYS = 7;

interface SharedSalesRow {
  ano: number;
  mes: number;
  nome_cliente: string;
  cod_referencia: string;
  descr_produto: string;
  data_pedido: string | null;
  codigo_pedido: string | null;
  numero_pedido_talao: string | null;
  pedido_cliente_opc: string | null;
  quantidade: number | null;
  valor_total: number | null;
}

export interface SharedClientDashboardDto {
  clientName: string;
  year: number;
  summary: {
    totalRevenue: number;
    previousRevenue: number;
    orderCount: number;
    uniqueProducts: number;
    previousUniqueProducts: number;
    averageTicket: number;
    previousAverageTicket: number;
    activeMonths: number;
  };
  monthlyTrend: Array<{
    month: number;
    label: string;
    revenue: number;
  }>;
  topProducts: Array<{
    cod_referencia: string;
    descr_produto: string;
    revenue: number;
    units: number;
  }>;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function toNumber(value: number | null | undefined) {
  return Number(value ?? 0);
}

function getOrderKey(row: SharedSalesRow) {
  const code =
    row.codigo_pedido?.trim() ||
    row.numero_pedido_talao?.trim() ||
    row.pedido_cliente_opc?.trim() ||
    row.cod_referencia;

  return `${row.data_pedido ?? 'sem-data'}-${code}`;
}

async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
) {
  const rows: T[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

function buildSharedDashboard(
  clientId: string,
  year: number,
  rows: SharedSalesRow[]
): SharedClientDashboardDto {
  const currentRows = rows.filter((row) => row.ano === year);
  const previousRows = rows.filter((row) => row.ano === year - 1);
  const currentOrderCount = new Set(currentRows.map(getOrderKey)).size;
  const previousOrderCount = new Set(previousRows.map(getOrderKey)).size;
  const totalRevenue = currentRows.reduce((sum, row) => sum + toNumber(row.valor_total), 0);
  const previousRevenue = previousRows.reduce((sum, row) => sum + toNumber(row.valor_total), 0);
  const productMap = new Map<string, SharedClientDashboardDto['topProducts'][number]>();

  currentRows.forEach((row) => {
    const product = productMap.get(row.cod_referencia) ?? {
      cod_referencia: row.cod_referencia,
      descr_produto: row.descr_produto,
      revenue: 0,
      units: 0,
    };
    product.revenue += toNumber(row.valor_total);
    product.units += toNumber(row.quantidade);
    productMap.set(row.cod_referencia, product);
  });

  const monthlyTrend = MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    return {
      month,
      label,
      revenue: currentRows
        .filter((row) => row.mes === month)
        .reduce((sum, row) => sum + toNumber(row.valor_total), 0),
    };
  });

  return {
    clientName: currentRows[0]?.nome_cliente ?? previousRows[0]?.nome_cliente ?? clientId,
    year,
    summary: {
      totalRevenue,
      previousRevenue,
      orderCount: currentOrderCount,
      uniqueProducts: new Set(currentRows.map((row) => row.cod_referencia)).size,
      previousUniqueProducts: new Set(previousRows.map((row) => row.cod_referencia)).size,
      averageTicket: currentOrderCount > 0 ? totalRevenue / currentOrderCount : 0,
      previousAverageTicket: previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0,
      activeMonths: monthlyTrend.filter((point) => point.revenue > 0).length,
    },
    monthlyTrend,
    topProducts: Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
      .slice(0, 4),
  };
}

export function createShareToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/**
 * Verifica e consome o rate-limit do link público via RPC atômica no Postgres.
 * Chaveado pelo hash do token (não forjável pelo cliente). Janela de 60 s,
 * limite de 30 req/min — espelha o padrão de consume_ai_rate_limit.
 * Usa o cliente admin (service_role) para chamar a RPC SECURITY DEFINER.
 */
export async function consumePublicShareRequest(token: string): Promise<boolean> {
  const supabase = getAdminSupabaseClient();
  const tokenHash = hashToken(token);
  const { data, error } = await supabase.rpc('consume_share_link_request', {
    p_token_hash: tokenHash,
  });

  if (error) {
    // Em caso de falha na RPC, nega por segurança (fail-closed).
    console.error('Falha ao verificar rate-limit do link publico.', error);
    return false;
  }

  return Boolean(data);
}

export async function resolveSharedClientData(token: string) {
  const supabase = getAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data: shareLink, error } = await supabase
    .from('share_links')
    .select('user_id, client_id, year')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!shareLink) return null;

  const year = Number(shareLink.year);
  // Escopo do link público: apenas o ano compartilhado e o anterior (para o
  // comparativo). Não buscamos histórico vitalício — decisão do cliente
  // (2026-06-15) para não expor LTV/anos ativos em link sem autenticação.
  const rows = await fetchAllRows<SharedSalesRow>((from, to) =>
    supabase
      .from('sales_rows')
      .select(`
        nome_cliente, cod_referencia, descr_produto, data_pedido,
        codigo_pedido, numero_pedido_talao, pedido_cliente_opc,
        quantidade, valor_total, ano, mes
      `)
      .eq('user_id', shareLink.user_id)
      .eq('cod_cliente', shareLink.client_id)
      .in('ano', [year, year - 1])
      .range(from, to)
  );

  return buildSharedDashboard(shareLink.client_id as string, year, rows);
}

export function getShareLinkExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SHARE_LINK_TTL_DAYS);
  return expiresAt.toISOString();
}

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReportConfigItem, ReportKey, ProductCatalogRow } from '@/types/config';
import type { BaseDeCompraRow, DashboardSummary } from '@/types/sales';
import type {
  ClientSalesRow,
  ClientDashboardSummaryRow,
  ClientMonthlyTrendRow,
  ClientYearlyHistoryRow,
  ClientTopProductRow,
  ClientRecentOrderRow,
} from '@/types/clientDashboard';

type DbClient = SupabaseClient<any, 'public', any>;

function normalizeDbError(error: { message: string }): Error {
  const message = error.message ?? 'Erro no banco de dados.';
  return new Error(message);
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalizeNumericFields<T extends Record<string, any>>(
  row: T,
  fields: string[]
) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      fields.includes(key) ? toNumber(value) : value,
    ])
  );
}

async function fetchAllRpcRows<T>(
  supabase: DbClient,
  rpcName: string,
  params: Record<string, unknown>
): Promise<T[]> {
  // We use a high limit instead of .range() pagination because these RPCs
  // run heavy aggregations. Paginating them forces the DB to run the
  // aggregation multiple times, causing statement timeouts.
  const { data, error } = await supabase
    .rpc(rpcName, params)
    .limit(100000);

  if (error) {
    throw normalizeDbError(error);
  }

  return (data ?? []) as T[];
}

export async function getDashboardSummaryForSupabase(
  supabase: DbClient,
  ano?: number,
  codCliente?: string,
  codReferencia?: string,
  semestre?: 1 | 2,
  revenueType?: string
): Promise<DashboardSummary | null> {
  const { data, error } = await supabase.rpc('dashboard_summary', {
    p_ano: ano ?? null,
    p_cod_cliente: codCliente ?? null,
    p_cod_referencia: codReferencia ?? null,
    p_semestre: semestre ?? null,
    p_descr_hist_financ: revenueType ?? null,
  });

  if (error) {
    throw normalizeDbError(error);
  }

  return (data?.[0] as DashboardSummary | undefined) ?? null;
}

export async function getBaseDeCompraForSupabase(
  supabase: DbClient,
  ano: number,
  codCliente?: string,
  codReferencia?: string,
  semestre?: 1 | 2,
  revenueType?: string
): Promise<BaseDeCompraRow[]> {
  return fetchAllRpcRows<BaseDeCompraRow>(supabase, 'base_de_compra', {
    p_ano: ano,
    p_cod_cliente: codCliente ?? null,
    p_cod_referencia: codReferencia ?? null,
    p_semestre: semestre ?? null,
    p_descr_hist_financ: revenueType ?? null,
  });
}

export async function getAvailableYearsForSupabase(
  supabase: DbClient
): Promise<number[]> {
  const { data, error } = await supabase.rpc('get_distinct_years');

  if (error) {
    throw normalizeDbError(error);
  }

  return (data ?? [])
    .map((row: { ano: number | string }) => Number(row.ano))
    .filter(Number.isFinite)
    .sort((a: number, b: number) => a - b);
}

/**
 * Busca clientes filtrada no banco via RPC search_clients.
 * Substitui o padrão anterior que carregava todos os clientes e filtrava em Node.
 */
export async function findClientsForSupabase(
  supabase: DbClient,
  search: string,
  limit = 8
) {
  const { data, error } = await supabase.rpc('search_clients', {
    p_query: search.trim(),
    p_limit: Math.min(Math.max(limit, 1), 100),
    p_offset: 0,
  });

  if (error) {
    throw normalizeDbError(error);
  }

  return (data ?? []) as { cod_cliente: string; nome_cliente: string }[];
}

export async function getTopClientsForSupabase(
  supabase: DbClient,
  year: number,
  limit = 10
) {
  const { data, error } = await supabase.rpc('chat_top_clients', {
    p_ano: year,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });

  if (error) {
    throw normalizeDbError(error);
  }

  return (data ?? []).map((row: Record<string, any>) =>
    normalizeNumericFields(row, ['total_faturado', 'total_pedidos'])
  );
}

export async function resolveClientForSupabase(
  supabase: DbClient,
  query: string,
  limit = 8
) {
  const { data, error } = await supabase.rpc('chat_resolve_client', {
    p_query: query,
    p_limit: Math.min(Math.max(limit, 1), 8),
  });

  if (error) throw normalizeDbError(error);
  return data ?? [];
}

export async function getTopProductsForSupabase(
  supabase: DbClient,
  year: number,
  codCliente?: string,
  semester?: 1 | 2,
  revenueType?: string,
  limit = 10
) {
  const { data, error } = await supabase.rpc('chat_top_products', {
    p_ano: year,
    p_cod_cliente: codCliente ?? null,
    p_semestre: semester ?? null,
    p_descr_hist_financ: revenueType ?? null,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });

  if (error) throw normalizeDbError(error);
  return (data ?? []).map((row: Record<string, any>) =>
    normalizeNumericFields(row, ['total_faturado', 'total_unidades', 'total_pedidos'])
  );
}

export async function getSalesTrendForSupabase(
  supabase: DbClient,
  startYear: number,
  endYear: number,
  codCliente?: string,
  codReferencia?: string
) {
  const { data, error } = await supabase.rpc('chat_sales_trend', {
    p_start_year: startYear,
    p_end_year: endYear,
    p_cod_cliente: codCliente ?? null,
    p_cod_referencia: codReferencia ?? null,
  });

  if (error) throw normalizeDbError(error);
  return (data ?? []).map((row: Record<string, any>) =>
    normalizeNumericFields(row, ['ano', 'mes', 'total_faturado', 'total_unidades', 'total_pedidos'])
  );
}

export async function getRecentOrdersForSupabase(
  supabase: DbClient,
  codCliente: string,
  limit = 10
) {
  const { data, error } = await supabase.rpc('chat_recent_orders', {
    p_cod_cliente: codCliente,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });

  if (error) throw normalizeDbError(error);
  return (data ?? []).map((row: Record<string, any>) =>
    normalizeNumericFields(row, ['total_faturado', 'total_unidades'])
  );
}

export async function getInactiveClientsForSupabase(
  supabase: DbClient,
  referenceDate: string,
  inactiveDays = 90,
  limit = 10
) {
  const { data, error } = await supabase.rpc('chat_inactive_clients', {
    p_reference_date: referenceDate,
    p_inactive_days: Math.min(Math.max(inactiveDays, 1), 3650),
    p_limit: Math.min(Math.max(limit, 1), 20),
  });

  if (error) throw normalizeDbError(error);
  return (data ?? []).map((row: Record<string, any>) =>
    normalizeNumericFields(row, ['dias_sem_pedido', 'faturamento_historico', 'total_pedidos'])
  );
}

export async function getRepPerformanceForSupabase(
  supabase: DbClient,
  year: number,
  limit = 10
) {
  const { data, error } = await supabase.rpc('chat_rep_performance', {
    p_ano: year,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });

  if (error) throw normalizeDbError(error);
  return (data ?? []).map((row: Record<string, any>) =>
    normalizeNumericFields(row, ['total_faturado', 'total_pedidos', 'total_clientes'])
  );
}

export async function getProductCatalogForSupabase(
  supabase: DbClient
): Promise<ProductCatalogRow[]> {
  const rows = await fetchAllRpcRows<ProductCatalogRow>(supabase, 'product_catalog', {});

  return rows.map((row) => ({
    ...row,
    total_quantidade: toNumber(row.total_quantidade),
    total_valor: toNumber(row.total_valor),
    first_year: toNumber(row.first_year),
    last_year: toNumber(row.last_year),
  }));
}

export async function getConfigItemsForSupabase(
  supabase: DbClient,
  reportKey?: ReportKey,
  ownerId?: string
): Promise<ReportConfigItem[]> {
  let query = supabase
    .from('report_config_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (reportKey) {
    query = query.eq('report_key', reportKey);
  }
  if (ownerId) {
    query = query.eq('user_id', ownerId);
  }

  const { data, error } = await query;

  if (error) {
    throw normalizeDbError(error);
  }

  return (data ?? []) as ReportConfigItem[];
}

// ─── Dashboard de Cliente — RPCs Agregadas (caminho servidor) ────────────────
// Os tipos estão centralizados em @/types/clientDashboard.
// Re-exportados para compatibilidade.
export type {
  ClientDashboardSummaryRow,
  ClientMonthlyTrendRow,
  ClientYearlyHistoryRow,
  ClientTopProductRow,
  ClientRecentOrderRow,
} from '@/types/clientDashboard';

const SUMMARY_NUMERIC = [
  'ano', 'total_faturado', 'total_unidades', 'total_pedidos', 'total_produtos',
  'meses_ativos', 'melhor_mes', 'faturamento_vitalicio', 'pedidos_vitalicios', 'anos_ativos',
];
const TREND_NUMERIC = ['ano', 'mes', 'total_faturado', 'total_unidades', 'total_pedidos'];
const HISTORY_NUMERIC = ['ano', 'total_faturado', 'total_unidades', 'total_pedidos', 'total_produtos'];
const PRODUCT_NUMERIC = ['ano', 'total_faturado', 'total_unidades', 'total_pedidos'];
const RECENT_ORDER_NUMERIC = ['total_faturado', 'total_unidades', 'total_linhas'];

export async function getClientDashboardSummaryForSupabase(
  supabase: DbClient,
  codCliente: string,
  ano: number
): Promise<ClientDashboardSummaryRow[]> {
  const { data, error } = await supabase.rpc('client_dashboard_summary', {
    p_cod_cliente: codCliente,
    p_ano: ano,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, any>[]).map(
    (r) => normalizeNumericFields(r, SUMMARY_NUMERIC) as ClientDashboardSummaryRow
  );
}

export async function getClientMonthlyTrendForSupabase(
  supabase: DbClient,
  codCliente: string,
  ano: number
): Promise<ClientMonthlyTrendRow[]> {
  const { data, error } = await supabase.rpc('client_monthly_trend', {
    p_cod_cliente: codCliente,
    p_ano: ano,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, any>[]).map(
    (r) => normalizeNumericFields(r, TREND_NUMERIC) as ClientMonthlyTrendRow
  );
}

export async function getClientYearlyHistoryForSupabase(
  supabase: DbClient,
  codCliente: string
): Promise<ClientYearlyHistoryRow[]> {
  const { data, error } = await supabase.rpc('client_yearly_history', {
    p_cod_cliente: codCliente,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, any>[]).map(
    (r) => normalizeNumericFields(r, HISTORY_NUMERIC) as ClientYearlyHistoryRow
  );
}

export async function getClientTopProductsForSupabase(
  supabase: DbClient,
  codCliente: string,
  ano: number
): Promise<ClientTopProductRow[]> {
  const { data, error } = await supabase.rpc('client_top_products', {
    p_cod_cliente: codCliente,
    p_ano: ano,
    p_limit: 100,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, any>[]).map(
    (r) => normalizeNumericFields(r, PRODUCT_NUMERIC) as ClientTopProductRow
  );
}

export async function getClientRecentOrdersForSupabase(
  supabase: DbClient,
  codCliente: string,
  limit = 8
): Promise<ClientRecentOrderRow[]> {
  const { data, error } = await supabase.rpc('client_recent_orders', {
    p_cod_cliente: codCliente,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, any>[]).map(
    (r) => normalizeNumericFields(r, RECENT_ORDER_NUMERIC) as ClientRecentOrderRow
  );
}

export async function getClientSalesHistoryForSupabase(
  supabase: DbClient,
  codCliente: string
): Promise<ClientSalesRow[]> {
  const rows: ClientSalesRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('sales_rows')
      .select(
        `
        id,
        cod_cliente,
        nome_cliente,
        apelido,
        cod_referencia,
        descr_produto,
        data_pedido,
        codigo_pedido,
        numero_pedido_talao,
        pedido_cliente_opc,
        quantidade,
        valor_total,
        preco_unitario,
        descr_hist_financ,
        ano,
        mes
      `
      )
      .eq('cod_cliente', codCliente)
      .order('data_pedido', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw normalizeDbError(error);
    }

    const batch = (data ?? []) as ClientSalesRow[];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

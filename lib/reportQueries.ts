import { getSupabaseClient } from './supabase';
import type {
  TabelaDinamicaRow,
  BaseDeCompraRow,
  ConfigReportRow,
  GeralRow,
  DashboardSummary,
} from '@/types/sales';
import type {
  ClientSalesRow,
  ClientDashboardSummaryRow,
  ClientMonthlyTrendRow,
  ClientYearlyHistoryRow,
  ClientTopProductRow,
  ClientRecentOrderRow,
} from '@/types/clientDashboard';

const db = () => getSupabaseClient();

function normalizeDbError(error: { message: string }): Error {
  const msg = error.message ?? '';
  if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
    return new Error('Sem conexão com o banco de dados. Verifique a conexão e recarregue a página.');
  }
  return new Error(msg);
}

async function fetchAllRpcRows<T>(
  rpcName: string,
  params: Record<string, unknown>
): Promise<T[]> {
  // We use a high limit instead of .range() pagination because these RPCs
  // run heavy aggregations. Paginating them forces the DB to run the
  // aggregation multiple times, causing statement timeouts.
  const { data, error } = await db()
    .rpc(rpcName, params)
    .limit(100000);

  if (error) {
    throw normalizeDbError(error);
  }

  return (data ?? []) as T[];
}

// ─── Tabela Dinâmica Geral ────────────────────────────────────────────────────
export async function getTabelaDinamica(
  ano: number,
  codCliente?: string,
  codReferencia?: string,
  semestre?: 1 | 2,
  revenueType?: string
): Promise<TabelaDinamicaRow[]> {
  return fetchAllRpcRows<TabelaDinamicaRow>('tabela_dinamica_geral', {
    p_ano: ano,
    p_cod_cliente: codCliente ?? null,
    p_cod_referencia: codReferencia ?? null,
    p_semestre: semestre ?? null,
    p_descr_hist_financ: revenueType ?? null,
  });
}

// ─── Base de Compra ───────────────────────────────────────────────────────────
export async function getBaseDeCompra(
  ano: number,
  codCliente?: string,
  codReferencia?: string,
  semestre?: 1 | 2,
  revenueType?: string
): Promise<BaseDeCompraRow[]> {
  return fetchAllRpcRows<BaseDeCompraRow>('base_de_compra', {
    p_ano: ano,
    p_cod_cliente: codCliente ?? null,
    p_cod_referencia: codReferencia ?? null,
    p_semestre: semestre ?? null,
    p_descr_hist_financ: revenueType ?? null,
  });
}

// ─── Base de Itens ────────────────────────────────────────────────────────────
export async function getBaseDeItens(anos: number[], codCliente?: string, codReferencia?: string, semestre?: 1 | 2, revenueType?: string): Promise<ConfigReportRow[]> {
  return fetchAllRpcRows<ConfigReportRow>('base_de_itens', {
    p_anos: anos, p_cod_cliente: codCliente ?? null, p_cod_referencia: codReferencia ?? null,
    p_semestre: semestre ?? null, p_descr_hist_financ: revenueType ?? null,
  });
}

// ─── Bagagitos ────────────────────────────────────────────────────────────────
export async function getBagagitos(anos: number[], codCliente?: string, codReferencia?: string, semestre?: 1 | 2, revenueType?: string): Promise<ConfigReportRow[]> {
  return fetchAllRpcRows<ConfigReportRow>('bagagitos', {
    p_anos: anos, p_cod_cliente: codCliente ?? null, p_cod_referencia: codReferencia ?? null,
    p_semestre: semestre ?? null, p_descr_hist_financ: revenueType ?? null,
  });
}

// ─── Geral ────────────────────────────────────────────────────────────────────
export async function getGeral(
  ano: number,
  codCliente?: string,
  codReferencia?: string,
  semestre?: 1 | 2,
  revenueType?: string
): Promise<GeralRow[]> {
  return fetchAllRpcRows<GeralRow>('geral', {
    p_ano: ano,
    p_cod_cliente: codCliente ?? null,
    p_cod_referencia: codReferencia ?? null,
    p_semestre: semestre ?? null,
    p_descr_hist_financ: revenueType ?? null,
  });
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────
export async function getDashboardSummary(
  ano?: number,
  codCliente?: string,
  codReferencia?: string,
  semestre?: 1 | 2,
  revenueType?: string
): Promise<DashboardSummary | null> {
  const { data, error } = await db().rpc('dashboard_summary', {
    p_ano: (ano && !isNaN(ano)) ? ano : null,
    p_cod_cliente: codCliente || null,
    p_cod_referencia: codReferencia ?? null,
    p_semestre: semestre ?? null,
    p_descr_hist_financ: revenueType ?? null,
  });
  if (error) throw normalizeDbError(error);
  return data?.[0] ?? null;
}

// ─── Distinct years available ─────────────────────────────────────────────────
export async function getAvailableYears(): Promise<number[]> {
  try {
    const { data, error } = await db().rpc('get_distinct_years');
    if (!error && data) {
      return data.map((r: any) => Number(r.ano)).sort((a: number, b: number) => a - b);
    }
  } catch (e) {}

  // Fallback with enough rows to find years
  const { data, error } = await db().from('sales_rows').select('ano').limit(10000);
  if (error) throw normalizeDbError(error);
  return Array.from(new Set((data || []).map(r => Number(r.ano)))).sort((a, b) => a - b);
}

/**
 * Busca clientes paginada/limitada via RPC search_clients (filtro no banco).
 * Substitui get_distinct_clients() global — nenhum filtro em Node.
 *
 * @param query  Termo de busca por código ou nome (vazio = primeiros clientes por nome).
 * @param limit  Máximo de resultados retornados (1–100, padrão 12).
 * @param offset Deslocamento para paginação (padrão 0).
 */
export async function searchClients(
  query = '',
  limit = 12,
  offset = 0
): Promise<{ cod_cliente: string; nome_cliente: string }[]> {
  const { data, error } = await db().rpc('search_clients', {
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw normalizeDbError(error);
  return (data ?? []) as { cod_cliente: string; nome_cliente: string }[];
}

/**
 * @deprecated Prefira searchClients(query, limit) que filtra no banco.
 * Mantida como fallback de compatibilidade para chamadas legadas.
 */
export async function getClients(): Promise<{ cod_cliente: string; nome_cliente: string }[]> {
  return searchClients('', 100, 0);
}

/**
 * Busca produtos (código + descrição) para autocomplete no filtro da ReportFilterBar.
 * Usa a RPC product_catalog via cliente autenticado (browser) ou fallback via sales_rows.
 */
export async function searchProducts(
  query = '',
  limit = 40
): Promise<{ cod_referencia: string; descr_produto: string }[]> {
  // Tentativa: RPC product_catalog
  const { data: rpcData, error: rpcError } = await db()
    .rpc('product_catalog', {})
    .limit(limit * 5);

  if (!rpcError && rpcData) {
    const all = (rpcData as { cod_referencia: string; descr_produto: string }[]).filter(
      (r) => r.cod_referencia && r.descr_produto
    );
    if (!query.trim()) return all.slice(0, limit);
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return all
      .filter((r) => {
        const code = r.cod_referencia.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const desc = r.descr_produto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        return code.includes(q) || desc.includes(q);
      })
      .slice(0, limit);
  }

  // Fallback: selecionar direto de sales_rows
  const { data, error } = await db()
    .from('sales_rows')
    .select('cod_referencia, descr_produto')
    .not('cod_referencia', 'is', null)
    .limit(10000);

  if (error) throw normalizeDbError(error);

  const unique = new Map<string, string>();
  for (const row of (data ?? [])) {
    if (row.cod_referencia && !unique.has(row.cod_referencia)) {
      unique.set(row.cod_referencia, row.descr_produto ?? '');
    }
  }

  const all = Array.from(unique.entries()).map(([cod_referencia, descr_produto]) => ({
    cod_referencia,
    descr_produto,
  }));

  if (!query.trim()) return all.slice(0, limit);
  const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return all
    .filter((r) => {
      const code = r.cod_referencia.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const desc = r.descr_produto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return code.includes(q) || desc.includes(q);
    })
    .slice(0, limit);
}

export async function getRevenueTypes(): Promise<string[]> {
  const { data, error } = await db()
    .from('sales_rows')
    .select('descr_hist_financ')
    .not('descr_hist_financ', 'is', null)
    .limit(10000);
  if (error) throw normalizeDbError(error);
  return Array.from(new Set((data ?? []).map((row) => row.descr_hist_financ).filter(Boolean))).sort();
}

export async function getClientSalesHistory(codCliente: string): Promise<ClientSalesRow[]> {
  const rows: ClientSalesRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await db()
      .from('sales_rows')
      .select(`
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
      `)
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

// ─── Dashboard de Cliente — RPCs Agregadas ───────────────────────────────────
// Os tipos estão centralizados em @/types/clientDashboard — re-exportados aqui
// para compatibilidade com importadores antigos.
export type {
  ClientDashboardSummaryRow,
  ClientMonthlyTrendRow,
  ClientYearlyHistoryRow,
  ClientTopProductRow,
  ClientRecentOrderRow,
} from '@/types/clientDashboard';

function normalizeRow<T extends Record<string, unknown>>(
  row: T,
  numericFields: string[]
): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      numericFields.includes(k) ? Number(v ?? 0) : v,
    ])
  ) as T;
}

const SUMMARY_NUMERIC = [
  'ano', 'total_faturado', 'total_unidades', 'total_pedidos', 'total_produtos',
  'meses_ativos', 'melhor_mes', 'faturamento_vitalicio', 'pedidos_vitalicios', 'anos_ativos',
];
const TREND_NUMERIC = ['ano', 'mes', 'total_faturado', 'total_unidades', 'total_pedidos'];
const HISTORY_NUMERIC = ['ano', 'total_faturado', 'total_unidades', 'total_pedidos', 'total_produtos'];
const PRODUCT_NUMERIC = ['ano', 'total_faturado', 'total_unidades', 'total_pedidos'];
const ORDER_NUMERIC = ['total_faturado', 'total_unidades', 'total_linhas'];

export async function getClientDashboardSummary(
  codCliente: string,
  ano: number
): Promise<ClientDashboardSummaryRow[]> {
  const { data, error } = await db().rpc('client_dashboard_summary', {
    p_cod_cliente: codCliente,
    p_ano: ano,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(
    (r) => normalizeRow(r, SUMMARY_NUMERIC) as unknown as ClientDashboardSummaryRow
  );
}

export async function getClientMonthlyTrend(
  codCliente: string,
  ano: number
): Promise<ClientMonthlyTrendRow[]> {
  const { data, error } = await db().rpc('client_monthly_trend', {
    p_cod_cliente: codCliente,
    p_ano: ano,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(
    (r) => normalizeRow(r, TREND_NUMERIC) as unknown as ClientMonthlyTrendRow
  );
}

export async function getClientYearlyHistory(
  codCliente: string
): Promise<ClientYearlyHistoryRow[]> {
  const { data, error } = await db().rpc('client_yearly_history', {
    p_cod_cliente: codCliente,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(
    (r) => normalizeRow(r, HISTORY_NUMERIC) as unknown as ClientYearlyHistoryRow
  );
}

export async function getClientTopProducts(
  codCliente: string,
  ano: number
): Promise<ClientTopProductRow[]> {
  const { data, error } = await db().rpc('client_top_products', {
    p_cod_cliente: codCliente,
    p_ano: ano,
    p_limit: 100,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(
    (r) => normalizeRow(r, PRODUCT_NUMERIC) as unknown as ClientTopProductRow
  );
}

export async function getClientRecentOrders(
  codCliente: string,
  limit = 8
): Promise<ClientRecentOrderRow[]> {
  const { data, error } = await db().rpc('client_recent_orders', {
    p_cod_cliente: codCliente,
    p_limit: limit,
  });
  if (error) throw normalizeDbError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(
    (r) => normalizeRow(r, ORDER_NUMERIC) as unknown as ClientRecentOrderRow
  );
}

// ─── Config Items CRUD ───────────────────────────────────────────────────────

/**
 * Campos que o usuário pode editar em um item de configuração de relatório.
 * Campos imutáveis (id, user_id, report_key, created_at) são deliberadamente
 * excluídos para seguir o princípio do menor privilégio — o UPDATE nunca os
 * recebe, independente do que o caller passe.
 */
export type EditableConfigFields = {
  label?: string;
  categoria?: string | null;
  cod_referencia?: string;
  extra_data?: Record<string, string>;
  sort_order?: number;
};

export async function getConfigItems(reportKey: string) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error('Sessao expirada. Entre novamente.');
  const { data, error } = await db()
    .from('report_config_items')
    .select('*')
    .eq('report_key', reportKey)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw normalizeDbError(error);
  return data;
}

export async function addConfigItem(item: any) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error('Sessao expirada. Entre novamente.');
  const { data, error } = await db()
    .from('report_config_items')
    .insert({ ...item, user_id: user.id })
    .select()
    .single();
  if (error) throw normalizeDbError(error);
  return data;
}

export async function updateConfigItem(id: number, updates: EditableConfigFields) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error('Sessao expirada. Entre novamente.');

  // Extrai apenas os campos editáveis, nunca enviando id/user_id/report_key/created_at
  // ao Supabase — seguro por construção, sem depender de RLS para corretude.
  const safeUpdates: EditableConfigFields = {
    ...(updates.label !== undefined && { label: updates.label }),
    ...(updates.categoria !== undefined && { categoria: updates.categoria }),
    ...(updates.cod_referencia !== undefined && { cod_referencia: updates.cod_referencia }),
    ...(updates.extra_data !== undefined && { extra_data: updates.extra_data }),
    ...(updates.sort_order !== undefined && { sort_order: updates.sort_order }),
  };

  const { data, error } = await db()
    .from('report_config_items')
    .update(safeUpdates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) throw normalizeDbError(error);
  return data;
}

export async function deleteConfigItem(id: number) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error('Sessao expirada. Entre novamente.');
  const { error } = await db()
    .from('report_config_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw normalizeDbError(error);
}

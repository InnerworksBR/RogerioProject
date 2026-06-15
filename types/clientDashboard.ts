export interface ClientSalesRow {
  id: number;
  cod_cliente: string;
  nome_cliente: string;
  apelido: string | null;
  cod_referencia: string;
  descr_produto: string;
  data_pedido: string | null;
  codigo_pedido: string | null;
  numero_pedido_talao: string | null;
  pedido_cliente_opc: string | null;
  quantidade: number | null;
  valor_total: number | null;
  preco_unitario: number | null;
  descr_hist_financ: string | null;
  ano: number;
  mes: number;
}

export interface ClientVisitSummary {
  totalRevenue: number;
  previousRevenue: number;
  totalUnits: number;
  previousUnits: number;
  orderCount: number;
  previousOrderCount: number;
  uniqueProducts: number;
  previousUniqueProducts: number;
  averageTicket: number;
  previousAverageTicket: number;
  activeMonths: number;
  bestMonthLabel: string;
  lastOrderDate: string | null;
  lifetimeRevenue: number;
  lifetimeOrders: number;
  yearsActive: number;
}

export interface ClientMonthlyTrendPoint {
  month: number;
  label: string;
  revenue: number;
  previousRevenue: number;
  units: number;
  previousUnits: number;
  orders: number;
  previousOrders: number;
}

export interface ClientYearHistoryPoint {
  year: number;
  revenue: number;
  units: number;
  orders: number;
  products: number;
}

export interface ClientProductSummary {
  cod_referencia: string;
  descr_produto: string;
  revenue: number;
  previousRevenue: number;
  units: number;
  previousUnits: number;
  orderCount: number;
  shareOfRevenue: number;
  shareOfUnits: number;
  lastPurchaseDate: string | null;
  trend: 'up' | 'down' | 'flat' | 'new';
}

export interface ClientProductChronologyPoint {
  key: string;
  year: number;
  month: number;
  label: string;
  units: number;
  revenue: number;
  orders: number;
}

export interface ClientOpportunity {
  cod_referencia: string;
  descr_produto: string;
  currentUnits: number;
  previousUnits: number;
  currentRevenue: number;
  previousRevenue: number;
  deltaUnits: number;
  deltaRevenue: number;
  reason: 'sem_recompra' | 'queda' | 'oportunidade' | 'em_alta';
}

export interface ClientRecentOrder {
  orderKey: string;
  orderCode: string;
  orderDate: string;
  revenue: number;
  units: number;
  lineCount: number;
  highlights: string[];
}

export interface ClientVisitInsight {
  title: string;
  description: string;
  tone: 'positive' | 'neutral' | 'warning';
}

export interface ClientVisitDashboardData {
  summary: ClientVisitSummary;
  monthlyTrend: ClientMonthlyTrendPoint[];
  yearlyHistory: ClientYearHistoryPoint[];
  allProducts: ClientProductSummary[];
  topProducts: ClientProductSummary[];
  attentionProducts: ClientOpportunity[];
  growthProducts: ClientOpportunity[];
  recentOrders: ClientRecentOrder[];
  insights: ClientVisitInsight[];
}

// ─── Tipos de linha retornados pelas RPCs agregadas do dashboard ──────────────

export interface ClientDashboardSummaryRow {
  periodo: 'current' | 'previous';
  ano: number;
  total_faturado: number;
  total_unidades: number;
  total_pedidos: number;
  total_produtos: number;
  meses_ativos: number;
  melhor_mes: number;
  ultimo_pedido: string | null;
  faturamento_vitalicio: number;
  pedidos_vitalicios: number;
  anos_ativos: number;
}

export interface ClientMonthlyTrendRow {
  ano: number;
  mes: number;
  total_faturado: number;
  total_unidades: number;
  total_pedidos: number;
}

export interface ClientYearlyHistoryRow {
  ano: number;
  total_faturado: number;
  total_unidades: number;
  total_pedidos: number;
  total_produtos: number;
}

export interface ClientTopProductRow {
  cod_referencia: string;
  descr_produto: string;
  ano: number;
  total_faturado: number;
  total_unidades: number;
  total_pedidos: number;
  ultimo_pedido: string | null;
}

export interface ClientRecentOrderRow {
  codigo_pedido: string | null;
  data_pedido: string | null;
  total_faturado: number;
  total_unidades: number;
  total_linhas: number;
  produtos_destaque: string[];
}

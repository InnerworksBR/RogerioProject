// Raw parsed row from XLS (after normalization)
export interface SalesRow {
  // Company
  cod_empresa: string;
  nome_empresa: string;
  cod_hist_financeiro: string;
  descr_hist_financ: string;
  // Client
  cod_cliente: string;
  nome_cliente: string;
  apelido: string;
  // Order
  data_pedido: Date;
  codigo_pedido: string;
  numero_pedido_talao: string | null;
  pedido_cliente_opc: string | null;
  // Product
  cod_referencia: string; // always string: "402", "402-CL", "101M"
  descr_produto: string;
  // Values
  preco_unitario: number;
  quantidade: number;
  situacao_item: string;
  data_limite_entrega: Date | null;
  qtd_saldo: number;
  unid_venda: string;
  valor_total: number;
  desconto_fiscal: number;
  // Intermediary
  cod_intermediador: string | null;
  nome_intermediador: string | null;
  // Derived on parse
  mes: number; // 1-12
  ano: number; // 2024, 2025...
}

// Row returned by tabela_dinamica_geral RPC
export interface TabelaDinamicaRow {
  ano: number;
  cod_cliente: string;
  nome_cliente: string;
  apelido: string;
  cod_referencia: string;
  descr_produto: string;
  jan: number;
  fev: number;
  mar: number;
  abr: number;
  mai: number;
  jun: number;
  jul: number;
  ago: number;
  set_: number;
  out_: number;
  nov: number;
  dez: number;
  total_ano: number;
  total_valor: number;
}

// Row returned by base_de_compra RPC
export interface BaseDeCompraRow {
  ano: number;
  cod_referencia: string;
  descr_produto: string;
  jan: number;
  fev: number;
  mar: number;
  abr: number;
  mai: number;
  jun: number;
  jul: number;
  ago: number;
  set_: number;
  out_: number;
  nov: number;
  dez: number;
  total_ano: number;
}

// Row returned by base_de_itens and bagagitos RPCs
export interface ConfigReportRow {
  id: number;
  sort_order: number;
  cod_referencia: string;
  label: string;
  extra_data: Record<string, string>;
  totals_by_year: Record<string, number>; // { "2024": 150, "2025": 200 }
}

// Row returned by geral RPC
export interface GeralRow {
  id: number;
  sort_order: number;
  categoria: string;
  cod_referencia: string;
  label: string;
  extra_data: Record<string, string>;
  jan: number;
  fev: number;
  mar: number;
  abr: number;
  mai: number;
  jun: number;
  jul: number;
  ago: number;
  set_: number;
  out_: number;
  nov: number;
  dez: number;
  total_ano: number;
}

// Row returned by dashboard_summary RPC
export interface DashboardSummary {
  total_pedidos: number;
  total_faturado: number;
  num_clientes: number;
  num_produtos: number;
  total_unidades: number;
  data_inicio: string;
  data_fim: string;
  anos_disponiveis: number[];
}

export const MONTH_KEYS = ['jan','fev','mar','abr','mai','jun','jul','ago','set_','out_','nov','dez'] as const;
export const MONTH_LABELS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'] as const;
export type MonthKey = typeof MONTH_KEYS[number];

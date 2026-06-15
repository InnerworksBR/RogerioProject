export type ReportKey = 'base_itens' | 'bagagitos' | 'geral';

export interface ReportConfigItem {
  id: number;
  report_key: ReportKey;
  cod_referencia: string | null;
  categoria: string | null;
  label: string | null;
  sort_order: number;
  extra_data: Record<string, string>;
  created_at: string;
}

export interface ProductCatalogRow {
  cod_referencia: string;
  descr_produto: string;
  total_quantidade: number;
  total_valor: number;
  first_year: number;
  last_year: number;
}

export interface ConfigSeedSuggestion {
  reportKey: ReportKey;
  cod_referencia: string;
  label: string;
  categoria: string | null;
  extra_data: Record<string, string>;
  total_quantidade: number;
  total_valor: number;
  confidence?: 'high' | 'low';
}

export interface SeedSuggestionGroup {
  existingCount: number;
  suggestedCount: number;
  sample: ConfigSeedSuggestion[];
}

export interface SeedSuggestionsResponse {
  baseItens: SeedSuggestionGroup;
  bagagitos: SeedSuggestionGroup & {
    lowConfidencePreview: ConfigSeedSuggestion[];
  };
  geral: SeedSuggestionGroup & {
    uncategorizedCount: number;
  };
  applied?: {
    insertedByReport: Record<ReportKey, number>;
  };
}

export interface BaseItensExtra {
  dts?: string;
  r2a?: string;
  lumax?: string;
  loma?: string;
  lancamento?: string;
}

export interface BagagitoExtra {
  emb?: string;
  plastiron?: string;
  ano_aplicacao?: string;
  aplicacao?: string;
  cor?: string;
  outros_dados?: string;
}

export interface GeralExtra {
  status?: string;
  emb?: string;
  plastiron?: string;
  ano_aplicacao?: string;
  aplicacao?: string;
  cor?: string;
  outros_dados?: string;
}

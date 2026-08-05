import type { DashboardSummary } from './sales';

export const REPORT_TYPES = [
  'tabela_dinamica',
  'base_compra',
  'base_itens',
  'bagagitos',
  'geral',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const DEFAULT_REPORT_TYPE: ReportType = 'tabela_dinamica';
export const DEFAULT_UI_ROW_LIMIT = 10_000;
export const MAX_UI_ROW_LIMIT = 20_000;
export const MAX_EXPORT_ROW_LIMIT = 100_000;
export const MAX_COMPARISON_YEARS = 4;
export const MAX_FILTER_TEXT_LENGTH = 160;

export interface ReportFilters {
  year: number | null;
  years: number[];
  client: string | null;
  product: string | null;
  semester: 1 | 2 | null;
  revenueType: string | null;
}

export interface ParsedReportRequest extends ReportFilters {
  report: ReportType;
  limit: number;
}

export interface ReportQueryResult<Row = unknown> {
  report: ReportType;
  filters: ReportFilters;
  rows: Row[];
  rowCount: number;
  truncated: boolean;
}

export interface ReportOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface ReportYearSummary {
  year: number;
  summary: DashboardSummary | null;
}

export interface ReportsBootstrapResponse<Row = unknown> {
  requestId: string;
  years: number[];
  selectedYear: number | null;
  selectedYears: number[];
  clients: ReportOption[];
  products: ReportOption[];
  revenueTypes: string[];
  summary: DashboardSummary | null;
  summaries: ReportYearSummary[];
  initialReport: ReportQueryResult<Row>;
}

export interface ReportQueryResponse<Row = unknown> extends ReportQueryResult<Row> {
  requestId: string;
  summary: DashboardSummary | null;
  summaries: ReportYearSummary[];
}

export interface ReportViewProps<Row> {
  rows: Row[];
  loading: boolean;
  error: string | null;
  truncated?: boolean;
}

export class ReportRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportRequestError';
  }
}

function getOptionalText(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key)?.trim() ?? '';
  if (!raw) return null;
  if (raw.length > MAX_FILTER_TEXT_LENGTH) {
    throw new ReportRequestError(`${key} excede ${MAX_FILTER_TEXT_LENGTH} caracteres.`);
  }
  return raw;
}

function parseYear(raw: string, field: string): number {
  if (!/^\d{4}$/.test(raw)) {
    throw new ReportRequestError(`${field} deve conter anos com quatro dígitos.`);
  }
  const year = Number(raw);
  if (year < 2000 || year > 2100) {
    throw new ReportRequestError(`${field} fora do intervalo permitido.`);
  }
  return year;
}

export function normalizeReportYears(years: number[], maxYears = MAX_COMPARISON_YEARS) {
  const normalized = Array.from(new Set(years))
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100)
    .sort((a, b) => a - b);
  if (normalized.length > maxYears) {
    throw new ReportRequestError(`Selecione no máximo ${maxYears} anos.`);
  }
  return normalized;
}

function getOptionalYears(params: URLSearchParams, maxYears: number): number[] {
  const rawYears = params.get('years')?.trim();
  const legacyYear = params.get('year')?.trim();
  if (!rawYears && !legacyYear) return [];
  const values = rawYears
    ? rawYears.split(',').map((value) => value.trim()).filter(Boolean)
    : [legacyYear as string];
  return normalizeReportYears(
    values.map((value) => parseYear(value, rawYears ? 'years' : 'year')),
    maxYears
  );
}

function getOptionalSemester(params: URLSearchParams): 1 | 2 | null {
  const raw = params.get('semester')?.trim();
  if (!raw) return null;
  if (raw !== '1' && raw !== '2') throw new ReportRequestError('semester deve ser 1 ou 2.');
  return Number(raw) as 1 | 2;
}

function getLimit(params: URLSearchParams, maxLimit: number): number {
  const raw = params.get('limit')?.trim();
  if (!raw) return DEFAULT_UI_ROW_LIMIT;
  if (!/^\d+$/.test(raw)) throw new ReportRequestError('limit deve ser um inteiro positivo.');
  const limit = Number(raw);
  if (limit < 1 || limit > maxLimit) {
    throw new ReportRequestError(`limit deve estar entre 1 e ${maxLimit}.`);
  }
  return limit;
}

export function isReportType(value: string | null | undefined): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

export function parseReportRequest(
  params: URLSearchParams,
  options: {
    defaultReport?: ReportType;
    maxYears?: number;
    maxLimit?: number;
    defaultLimit?: number;
  } = {}
): ParsedReportRequest {
  const rawReport = params.get('report');
  const report = rawReport || options.defaultReport || DEFAULT_REPORT_TYPE;
  if (!isReportType(report)) throw new ReportRequestError('report não suportado.');
  const years = getOptionalYears(params, options.maxYears ?? MAX_COMPARISON_YEARS);
  const limit = params.has('limit')
    ? getLimit(params, options.maxLimit ?? MAX_UI_ROW_LIMIT)
    : options.defaultLimit ?? DEFAULT_UI_ROW_LIMIT;

  return {
    report,
    year: years.at(-1) ?? null,
    years,
    client: getOptionalText(params, 'client'),
    product: getOptionalText(params, 'product'),
    semester: getOptionalSemester(params),
    revenueType: getOptionalText(params, 'revenueType'),
    limit,
  };
}

export function toReportFilters(request: ParsedReportRequest): ReportFilters {
  return {
    year: request.year,
    years: request.years,
    client: request.client,
    product: request.product,
    semester: request.semester,
    revenueType: request.revenueType,
  };
}

export function buildReportSearchParams(request: ParsedReportRequest): URLSearchParams {
  const params = new URLSearchParams({ report: request.report, limit: String(request.limit) });
  if (request.years.length) params.set('years', request.years.join(','));
  if (request.client) params.set('client', request.client);
  if (request.product) params.set('product', request.product);
  if (request.semester) params.set('semester', String(request.semester));
  if (request.revenueType) params.set('revenueType', request.revenueType);
  return params;
}

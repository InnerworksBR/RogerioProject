import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getAvailableYearsForSupabase,
  getBagagitosForSupabase,
  getBaseDeCompraForSupabase,
  getBaseDeItensForSupabase,
  getDashboardSummaryForSupabase,
  getGeralForSupabase,
  getRevenueTypesForSupabase,
  getTabelaDinamicaForSupabase,
  findClientsForSupabase,
  findProductsForSupabase,
} from '@/lib/server/reportData';
import { measureQuery } from '@/lib/server/queryTelemetry';
import type {
  ParsedReportRequest,
  ReportOption,
  ReportQueryResult,
  ReportQueryResponse,
  ReportsBootstrapResponse,
  ReportType,
} from '@/types/reportApi';
import { toReportFilters } from '@/types/reportApi';

type DbClient = SupabaseClient<any, 'public', any>;

function rowCount(value: unknown): number {
  return Array.isArray(value) ? value.length : value ? 1 : 0;
}

function limitRows<Row>(
  report: ReportType,
  request: ParsedReportRequest,
  rows: Row[]
): ReportQueryResult<Row> {
  const truncated = rows.length > request.limit;
  const visibleRows = truncated ? rows.slice(0, request.limit) : rows;
  return {
    report,
    filters: toReportFilters(request),
    rows: visibleRows,
    rowCount: visibleRows.length,
    truncated,
  };
}

export async function executeReportQuery(
  supabase: DbClient,
  requestId: string,
  request: ParsedReportRequest,
  availableYears?: number[]
): Promise<ReportQueryResult> {
  if (!request.year) {
    return limitRows(request.report, request, []);
  }

  const year = request.year;
  const reportYears = (request.report === 'base_itens' || request.report === 'bagagitos')
    && !availableYears?.length
    ? await measureQuery(
        { requestId, operation: 'reports.years.query' },
        () => getAvailableYearsForSupabase(supabase),
        rowCount
      )
    : availableYears;
  const limit = request.limit + 1;
  const args = [
    supabase,
    year,
    request.client ?? undefined,
    request.product ?? undefined,
    request.semester ?? undefined,
    request.revenueType ?? undefined,
  ] as const;

  const rows = await measureQuery<unknown[]>(
    { requestId, operation: `report.${request.report}` },
    async () => {
      switch (request.report) {
        case 'tabela_dinamica':
          return getTabelaDinamicaForSupabase(...args, limit);
        case 'base_compra':
          return getBaseDeCompraForSupabase(...args, limit);
        case 'base_itens':
          return getBaseDeItensForSupabase(
            supabase,
            reportYears?.length ? reportYears : [year],
            request.client ?? undefined,
            request.product ?? undefined,
            request.semester ?? undefined,
            request.revenueType ?? undefined,
            limit
          );
        case 'bagagitos':
          return getBagagitosForSupabase(
            supabase,
            reportYears?.length ? reportYears : [year],
            request.client ?? undefined,
            request.product ?? undefined,
            request.semester ?? undefined,
            request.revenueType ?? undefined,
            limit
          );
        case 'geral':
          return getGeralForSupabase(...args, limit);
      }
    },
    rowCount
  );

  return limitRows(request.report, request, rows);
}

export async function getReportsBootstrap(
  supabase: DbClient,
  requestId: string,
  request: ParsedReportRequest
): Promise<ReportsBootstrapResponse> {
  const years = await measureQuery(
    { requestId, operation: 'reports.years' },
    () => getAvailableYearsForSupabase(supabase),
    rowCount
  );
  const selectedYear = request.year && years.includes(request.year)
    ? request.year
    : years.at(-1) ?? null;
  const effectiveRequest = { ...request, year: selectedYear };

  const [clients, products, revenueTypes, summary, initialReport] = await Promise.all([
    measureQuery(
      { requestId, operation: 'reports.clients' },
      () => findClientsForSupabase(supabase, '', 40),
      rowCount
    ),
    measureQuery(
      { requestId, operation: 'reports.products' },
      () => findProductsForSupabase(supabase, '', 40),
      rowCount
    ),
    measureQuery(
      { requestId, operation: 'reports.revenue_types' },
      () => getRevenueTypesForSupabase(supabase),
      rowCount
    ),
    selectedYear
      ? measureQuery(
          { requestId, operation: 'reports.summary' },
          () => getDashboardSummaryForSupabase(supabase, selectedYear),
          rowCount
        )
      : Promise.resolve(null),
    executeReportQuery(supabase, requestId, effectiveRequest, years),
  ]);

  const clientOptions: ReportOption[] = clients.map((client) => ({
    value: client.cod_cliente,
    label: client.nome_cliente,
    sublabel: client.cod_cliente,
  }));
  const productOptions: ReportOption[] = products.map((product) => ({
    value: product.cod_referencia,
    label: product.descr_produto || product.cod_referencia,
    sublabel: product.cod_referencia,
  }));

  return {
    requestId,
    years,
    selectedYear,
    clients: clientOptions,
    products: productOptions,
    revenueTypes,
    summary,
    initialReport,
  };
}

export async function executeReportScreenQuery(
  supabase: DbClient,
  requestId: string,
  request: ParsedReportRequest
): Promise<ReportQueryResponse> {
  const [result, summary] = await Promise.all([
    executeReportQuery(supabase, requestId, request),
    request.year
      ? measureQuery(
          { requestId, operation: 'reports.summary' },
          () => getDashboardSummaryForSupabase(
            supabase,
            request.year ?? undefined,
            request.client ?? undefined,
            request.product ?? undefined,
            request.semester ?? undefined,
            request.revenueType ?? undefined
          ),
          rowCount
        )
      : Promise.resolve(null),
  ]);

  return { ...result, requestId, summary };
}

export async function getReportOptions(
  supabase: DbClient,
  requestId: string,
  resource: 'clients' | 'products',
  search: string,
  limit: number
): Promise<ReportOption[]> {
  if (resource === 'clients') {
    const clients = await measureQuery(
      { requestId, operation: 'reports.clients.search' },
      () => findClientsForSupabase(supabase, search, limit),
      rowCount
    );
    return clients.map((client) => ({
      value: client.cod_cliente,
      label: client.nome_cliente,
      sublabel: client.cod_cliente,
    }));
  }

  const products = await measureQuery(
    { requestId, operation: 'reports.products.search' },
    () => findProductsForSupabase(supabase, search, limit),
    rowCount
  );
  return products.map((product) => ({
    value: product.cod_referencia,
    label: product.descr_produto || product.cod_referencia,
    sublabel: product.cod_referencia,
  }));
}

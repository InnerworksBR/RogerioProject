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
  ReportYearSummary,
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

async function getSummaries(
  supabase: DbClient,
  requestId: string,
  request: ParsedReportRequest
): Promise<ReportYearSummary[]> {
  return Promise.all(request.years.map(async (year) => ({
    year,
    summary: await measureQuery(
      { requestId, operation: 'reports.summary' },
      () => getDashboardSummaryForSupabase(
        supabase,
        year,
        request.client ?? undefined,
        request.product ?? undefined,
        request.semester ?? undefined,
        request.revenueType ?? undefined
      ),
      rowCount
    ),
  })));
}

export async function executeReportQuery(
  supabase: DbClient,
  requestId: string,
  request: ParsedReportRequest,
  _availableYears?: number[]
): Promise<ReportQueryResult> {
  if (request.years.length === 0) {
    return limitRows(request.report, request, []);
  }

  const limit = request.limit + 1;
  const rows = await measureQuery<unknown[]>(
    { requestId, operation: `report.${request.report}` },
    async () => {
      switch (request.report) {
        case 'tabela_dinamica':
          return (await Promise.all(request.years.map((year) => getTabelaDinamicaForSupabase(
            supabase,
            year,
            request.client ?? undefined,
            request.product ?? undefined,
            request.semester ?? undefined,
            request.revenueType ?? undefined,
            limit
          )))).flat();
        case 'base_compra':
          return (await Promise.all(request.years.map((year) => getBaseDeCompraForSupabase(
            supabase,
            year,
            request.client ?? undefined,
            request.product ?? undefined,
            request.semester ?? undefined,
            request.revenueType ?? undefined,
            limit
          )))).flat();
        case 'base_itens':
          return getBaseDeItensForSupabase(
            supabase,
            request.years,
            request.client ?? undefined,
            request.product ?? undefined,
            request.semester ?? undefined,
            request.revenueType ?? undefined,
            limit
          );
        case 'bagagitos':
          return getBagagitosForSupabase(
            supabase,
            request.years,
            request.client ?? undefined,
            request.product ?? undefined,
            request.semester ?? undefined,
            request.revenueType ?? undefined,
            limit
          );
        case 'geral':
          return (await Promise.all(request.years.map(async (year) => {
            const annualRows = await getGeralForSupabase(
              supabase,
              year,
              request.client ?? undefined,
              request.product ?? undefined,
              request.semester ?? undefined,
              request.revenueType ?? undefined,
              limit
            );
            return annualRows.map((row) => ({ ...row, ano: year }));
          }))).flat();
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
  const selectedYears = request.years.filter((year) => years.includes(year));
  if (selectedYears.length === 0 && years.length > 0) {
    selectedYears.push(years.at(-1) as number);
  }
  const selectedYear = selectedYears.at(-1) ?? null;
  const effectiveRequest = { ...request, year: selectedYear, years: selectedYears };

  const [clients, products, revenueTypes, summaries, initialReport] = await Promise.all([
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
    getSummaries(supabase, requestId, effectiveRequest),
    executeReportQuery(supabase, requestId, effectiveRequest, years),
  ]);

  const clientOptions: ReportOption[] = clients.map((client) => ({
    value: client.cod_cliente,
    label: client.nome_cliente,
    sublabel: client.cod_cliente.startsWith('group:') ? 'Cliente consolidado' : client.cod_cliente,
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
    selectedYears,
    clients: clientOptions,
    products: productOptions,
    revenueTypes,
    summary: summaries.at(-1)?.summary ?? null,
    summaries,
    initialReport,
  };
}

export async function executeReportScreenQuery(
  supabase: DbClient,
  requestId: string,
  request: ParsedReportRequest
): Promise<ReportQueryResponse> {
  const [result, summaries] = await Promise.all([
    executeReportQuery(supabase, requestId, request),
    getSummaries(supabase, requestId, request),
  ]);

  return {
    ...result,
    requestId,
    summary: summaries.at(-1)?.summary ?? null,
    summaries,
  };
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
      sublabel: client.cod_cliente.startsWith('group:') ? 'Cliente consolidado' : client.cod_cliente,
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

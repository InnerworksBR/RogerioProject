'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  buildReportSearchParams,
  type ParsedReportRequest,
  type ReportOption,
  type ReportQueryResponse,
  type ReportsBootstrapResponse,
} from '@/types/reportApi';

export const reportQueryKeys = {
  all: ['reports'] as const,
  bootstrap: (request: ParsedReportRequest) => [
    'reports',
    'bootstrap',
    request.report,
    request.limit,
  ] as const,
  query: (request: ParsedReportRequest) => [
    'reports',
    'query',
    request.report,
    request.years.join(','),
    request.client,
    request.product,
    request.semester,
    request.revenueType,
    request.limit,
  ] as const,
  options: (resource: 'clients' | 'products', search: string, limit: number) => [
    'reports',
    'options',
    resource,
    search.trim().toLocaleLowerCase('pt-BR'),
    limit,
  ] as const,
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? 'Não foi possível carregar os relatórios.');
  }
  return payload as T;
}

export function fetchReportsBootstrap(
  request: ParsedReportRequest,
  signal?: AbortSignal
): Promise<ReportsBootstrapResponse> {
  return fetchJson(`/api/reports/bootstrap?${buildReportSearchParams(request)}`, signal);
}

export function fetchReportQuery(
  request: ParsedReportRequest,
  signal?: AbortSignal
): Promise<ReportQueryResponse> {
  return fetchJson(`/api/reports/query?${buildReportSearchParams(request)}`, signal);
}

export function fetchReportExport(
  request: ParsedReportRequest,
  signal?: AbortSignal
): Promise<ReportQueryResponse> {
  return fetchJson(`/api/reports/export?${buildReportSearchParams(request)}`, signal);
}

export function fetchReportOptions(
  resource: 'clients' | 'products',
  search: string,
  limit: number,
  signal?: AbortSignal
): Promise<{ requestId: string; options: ReportOption[] }> {
  const params = new URLSearchParams({ resource, search, limit: String(limit) });
  return fetchJson(`/api/reports/options?${params}`, signal);
}

export function useReportsBootstrap(request: ParsedReportRequest) {
  return useQuery({
    queryKey: reportQueryKeys.bootstrap(request),
    queryFn: ({ signal }) => fetchReportsBootstrap(request, signal),
    staleTime: 5 * 60 * 1_000,
  });
}

export function useReportQuery(request: ParsedReportRequest, enabled: boolean) {
  return useQuery({
    queryKey: reportQueryKeys.query(request),
    queryFn: ({ signal }) => fetchReportQuery(request, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useReportOptions(
  resource: 'clients' | 'products',
  search: string,
  limit: number,
  enabled = true
) {
  return useQuery({
    queryKey: reportQueryKeys.options(resource, search, limit),
    queryFn: ({ signal }) => fetchReportOptions(resource, search, limit, signal),
    enabled,
    staleTime: 5 * 60 * 1_000,
    placeholderData: keepPreviousData,
  });
}


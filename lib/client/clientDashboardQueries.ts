'use client';

import { getClientDashboardSummary, getClientMonthlyTrend, getClientTopProducts } from '@/lib/reportQueries';

// Compartilhadas pelos dois modos: trocar a apresentação pela análise reutiliza
// os mesmos agregados, sem buscar o histórico detalhado nem repetir os anos.
export function clientSummaryOptions(userId: string, clientId: string, year: number) {
  return {
    queryKey: ['reports', 'client-summary', userId, clientId, year] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => getClientDashboardSummary(clientId, year, signal),
    staleTime: 2 * 60_000,
  };
}

export function clientTrendOptions(userId: string, clientId: string, year: number) {
  return {
    queryKey: ['reports', 'client-monthly-trend', userId, clientId, year] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => getClientMonthlyTrend(clientId, year, signal),
    staleTime: 2 * 60_000,
  };
}

export function clientProductsOptions(userId: string, clientId: string, year: number) {
  return {
    queryKey: ['reports', 'client-top-products', userId, clientId, year] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => getClientTopProducts(clientId, year, signal),
    staleTime: 2 * 60_000,
  };
}

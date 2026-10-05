import type { ClientSalesRow, ClientVisitDashboardData } from '../types/clientDashboard';

export type ComparisonMetric = 'revenue' | 'units' | 'orders';
export interface ClientYearDataset {
  year: number;
  dashboard: ClientVisitDashboardData;
}
export interface ComparisonValues {
  revenue: number;
  units: number;
  orders: number;
}
export interface ComparisonMonth {
  month: number;
  label: string;
  values: Record<number, ComparisonValues>;
}
export interface ComparisonProduct {
  code: string;
  description: string;
  values: Record<number, ComparisonValues>;
  monthly: ComparisonMonth[];
}

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const emptyValues = (): ComparisonValues => ({ revenue: 0, units: 0, orders: 0 });

export function createComparisonMonths(years: number[]): ComparisonMonth[] {
  return MONTHS.map((label, index) => ({
    month: index + 1,
    label,
    values: Object.fromEntries(years.map((year) => [year, emptyValues()])),
  }));
}

export function buildMonthlyComparison(datasets: ClientYearDataset[]): ComparisonMonth[] {
  const months = createComparisonMonths(datasets.map(({ year }) => year));
  for (const { year, dashboard } of datasets) {
    for (const point of dashboard.monthlyTrend) {
      if (point.month < 1 || point.month > 12) continue;
      months[point.month - 1].values[year] = {
        revenue: point.revenue,
        units: point.units,
        orders: point.orders,
      };
    }
  }
  return months;
}

// An absent base has no percentage growth. Keep it distinct from a real 0% change.
export function comparisonDelta(current: number, base: number): number | null {
  return base === 0 ? null : ((current - base) / Math.abs(base)) * 100;
}

export function buildProductComparison(rows: ClientSalesRow[], years: number[]): ComparisonProduct[] {
  const selectedYears = new Set(years);
  const products = new Map<string, ComparisonProduct>();
  const annualOrders = new Map<string, Set<string>>();
  const monthlyOrders = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!selectedYears.has(row.ano) || row.mes < 1 || row.mes > 12) continue;
    let product = products.get(row.cod_referencia);
    if (!product) {
      product = {
        code: row.cod_referencia,
        description: row.descr_produto,
        values: Object.fromEntries(years.map((year) => [year, emptyValues()])),
        monthly: createComparisonMonths(years),
      };
      products.set(product.code, product);
    }
    const annual = product.values[row.ano];
    const monthly = product.monthly[row.mes - 1].values[row.ano];
    const revenue = Number(row.valor_total ?? 0);
    const units = Number(row.quantidade ?? 0);
    annual.revenue += revenue;
    annual.units += units;
    monthly.revenue += revenue;
    monthly.units += units;

    const orderCode = row.codigo_pedido?.trim() || row.numero_pedido_talao?.trim() ||
      row.pedido_cliente_opc?.trim() || row.cod_referencia;
    const orderKey = `${row.user_id ?? ''}:${row.data_pedido ?? 'sem-data'}:${orderCode}`;
    const annualKey = `${product.code}:${row.ano}`;
    const monthlyKey = `${annualKey}:${row.mes}`;
    const yearSet = annualOrders.get(annualKey) ?? new Set<string>();
    const monthSet = monthlyOrders.get(monthlyKey) ?? new Set<string>();
    yearSet.add(orderKey);
    monthSet.add(orderKey);
    annualOrders.set(annualKey, yearSet);
    monthlyOrders.set(monthlyKey, monthSet);
    annual.orders = yearSet.size;
    monthly.orders = monthSet.size;
  }

  return [...products.values()].sort((a, b) =>
    years.reduce((sum, year) => sum + b.values[year].revenue - a.values[year].revenue, 0) ||
    a.code.localeCompare(b.code)
  );
}

export function buildComparisonOpportunities(
  products: ComparisonProduct[], baseYear: number, targetYear: number
) {
  return products.map((product) => {
    const base = product.values[baseYear] ?? emptyValues();
    const target = product.values[targetYear] ?? emptyValues();
    return { product, base, target, deltaRevenue: target.revenue - base.revenue };
  }).filter((item) => item.deltaRevenue !== 0)
    .sort((a, b) => Math.abs(b.deltaRevenue) - Math.abs(a.deltaRevenue));
}

'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Package,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wallet,
  Share2,
  Loader2,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { buildClientVisitDashboardFromAggregates } from '@/lib/clientDashboard';
import {
  getClientSalesHistory,
  searchClients,
  getClientDashboardSummary,
  getClientMonthlyTrend,
  getClientYearlyHistory,
  getClientTopProducts,
  getClientRecentOrders,
} from '@/lib/reportQueries';
import { normalizeSearchText } from '@/lib/text';
import { cn } from '@/lib/utils';
import { useFilterStore } from '@/store/filterStore';
import type {
  ClientOpportunity,
  ClientProductChronologyPoint,
  ClientProductSummary,
  ClientSalesRow,
  ClientVisitDashboardData,
  ClientVisitInsight,
} from '@/types/clientDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEnsureReportYears } from '@/components/reports/useEnsureReportYears';
import { SharedDashboardClientView } from '@/app/shared/client/[token]/SharedDashboardClientView';
import { ShareLinksManager } from './ShareLinksManager';

export const fmtBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtNumber = (value: number) => value.toLocaleString('pt-BR');

export const fmtDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem histórico';

function getDeltaValue(current: number, previous: number) {
  if (previous === 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

export function getDeltaLabel(current: number, previous: number, suffix = '%') {
  const delta = getDeltaValue(current, previous);

  if (delta === null) {
    return current > 0 ? 'Sem base anterior' : 'Sem movimento';
  }

  const formatted = `${Math.abs(delta).toFixed(1)}${suffix}`;
  return delta >= 0 ? `+${formatted}` : `-${formatted}`;
}

function getProductTrendLabel(trend: ClientProductSummary['trend']) {
  if (trend === 'new') return 'Novo';
  if (trend === 'up') return 'Em alta';
  if (trend === 'down') return 'Em queda';
  return 'Estável';
}

function getProductTrendClasses(trend: ClientProductSummary['trend']) {
  if (trend === 'new' || trend === 'up') {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }

  if (trend === 'down') {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }

  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
}

function getOpportunityLabel(reason: ClientOpportunity['reason']) {
  if (reason === 'sem_recompra') return 'Sem recompra';
  if (reason === 'queda') return 'Queda';
  if (reason === 'oportunidade') return 'Novo espaço';
  return 'Em alta';
}

export function MetricCard({
  title,
  value,
  subtitle,
  delta,
  tone = 'neutral',
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  delta?: string;
  tone?: 'positive' | 'warning' | 'neutral';
  icon: ComponentType<{ className?: string }>;
}) {
  const toneClasses = {
    positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('rounded-2xl p-3', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        {delta && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {delta}
          </span>
        )}
      </div>
      <div className="mt-4 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {title}
        </p>
        <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function InsightItem({ insight }: { insight: ClientVisitInsight }) {
  const tones = {
    positive:
      'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300',
    warning:
      'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
    neutral:
      'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300',
  };

  return (
    <div className={cn('rounded-2xl border p-4', tones[insight.tone])}>
      <p className="text-xs font-bold uppercase tracking-[0.18em]">{insight.title}</p>
      <p className="mt-2 text-sm leading-relaxed">{insight.description}</p>
    </div>
  );
}

export function QuickFactCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function MonthlyComparisonChart({
  data,
  selectedYear,
}: {
  data: ClientVisitDashboardData['monthlyTrend'];
  selectedYear: number;
}) {
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.revenue, item.previousRevenue]));

  return (
    <div className="glass-card rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950 dark:text-white">
            Evolução mensal do cliente
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Comparação direta entre {selectedYear} e {selectedYear - 1} por faturamento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            {selectedYear}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            {selectedYear - 1}
          </span>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="grid min-w-[42rem] grid-cols-12 gap-3 sm:gap-4">
          {data.map((point) => {
            const currentHeight = `${(point.revenue / maxValue) * 100}%`;
            const previousHeight = `${(point.previousRevenue / maxValue) * 100}%`;

            return (
              <div key={point.month} className="flex h-64 flex-col justify-end gap-2">
                <div className="flex h-full items-end justify-center gap-1.5 sm:gap-2">
                  <div
                    className="w-3 rounded-t-full bg-slate-300 sm:w-4 dark:bg-slate-700"
                    style={{ height: previousHeight }}
                    aria-label={`${point.label} ${selectedYear - 1}: ${fmtBRL(point.previousRevenue)}`}
                  />
                  <div
                    className="w-3 rounded-t-full bg-indigo-500 sm:w-4"
                    style={{ height: currentHeight }}
                    aria-label={`${point.label} ${selectedYear}: ${fmtBRL(point.revenue)}`}
                  />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {point.label}
                  </p>
                  <p className="hidden text-[10px] text-slate-500 dark:text-slate-400 sm:block">
                    {fmtBRL(point.revenue)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function YearHistoryPanel({
  data,
  selectedYear,
}: {
  data: ClientVisitDashboardData['yearlyHistory'];
  selectedYear: number;
}) {
  return (
    <div className="glass-card rounded-[1.75rem] p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950 dark:text-white">Histórico anual</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Leitura rápida da evolução do relacionamento ao longo dos anos.
      </p>

      <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
        {data.map((item) => (
          <div
            key={item.year}
            className={cn(
              'rounded-2xl border p-4 transition-colors',
              item.year === selectedYear
                ? 'border-indigo-300 bg-indigo-50/70 dark:border-indigo-800 dark:bg-indigo-950/20'
                : 'border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-950 dark:text-white">{item.year}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {item.orders} pedidos
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400 dark:text-slate-500">Faturamento</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {fmtBRL(item.revenue)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500">Produtos</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {fmtNumber(item.products)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500">Unidades</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {fmtNumber(item.units)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 dark:text-slate-500">Pedidos</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {fmtNumber(item.orders)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopProductsList({
  products,
  title = 'Produtos foco da visita',
  description = 'Os itens que mais puxam a conta neste ano.',
}: {
  products: ClientVisitDashboardData['topProducts'];
  title?: string;
  description?: string;
}) {
  return (
    <div className="glass-card rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Top {products.length}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {products.map((product, index) => (
          <div
            key={product.cod_referencia}
            className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  #{index + 1} · {product.cod_referencia}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {product.descr_produto}
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                  getProductTrendClasses(product.trend)
                )}
              >
                {getProductTrendLabel(product.trend)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Receita
                </p>
                <p className="font-semibold text-slate-950 dark:text-white">
                  {fmtBRL(product.revenue)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Unidades
                </p>
                <p className="font-semibold text-slate-950 dark:text-white">
                  {fmtNumber(product.units)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Participação
                </p>
                <p className="font-semibold text-slate-950 dark:text-white">
                  {(product.shareOfRevenue * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductExplorer({
  title,
  description,
  products,
  rows,
}: {
  title: string;
  description: string;
  products: ClientProductSummary[];
  rows: ClientSalesRow[];
}) {
  const [query, setQuery] = useState('');
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(
    products[0]?.cod_referencia ?? null
  );

  useEffect(() => {
    setSelectedProductCode(products[0]?.cod_referencia ?? null);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => {
      const normalizedCode = normalizeSearchText(product.cod_referencia);
      const normalizedDescription = normalizeSearchText(product.descr_produto);

      return (
        normalizedCode.includes(normalizedQuery) ||
        normalizedDescription.includes(normalizedQuery)
      );
    });
  }, [products, query]);

  useEffect(() => {
    if (filteredProducts.length === 0) {
      setSelectedProductCode(null);
      return;
    }

    if (!filteredProducts.some((product) => product.cod_referencia === selectedProductCode)) {
      setSelectedProductCode(filteredProducts[0]?.cod_referencia ?? null);
    }
  }, [filteredProducts, selectedProductCode]);

  const selectedProduct = useMemo(
    () =>
      filteredProducts.find((product) => product.cod_referencia === selectedProductCode) ??
      products.find((product) => product.cod_referencia === selectedProductCode) ??
      null,
    [filteredProducts, products, selectedProductCode]
  );

  const chronology = useMemo<ClientProductChronologyPoint[]>(() => {
    if (!selectedProduct) {
      return [];
    }

    const productRows = rows
      .filter((row) => row.cod_referencia === selectedProduct.cod_referencia)
      .sort((a, b) => (a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano));

    if (productRows.length === 0) {
      return [];
    }

    const grouped = new Map<string, ClientProductChronologyPoint>();

    productRows.forEach((row) => {
      const key = `${row.ano}-${row.mes}`;
      const monthLabel = `${String(row.mes).padStart(2, '0')}/${row.ano}`;
      const existing = grouped.get(key) ?? {
        key,
        year: row.ano,
        month: row.mes,
        label: monthLabel,
        units: 0,
        revenue: 0,
        orders: 0,
      };

      existing.units += Number(row.quantidade ?? 0);
      existing.revenue += Number(row.valor_total ?? 0);
      existing.orders += 1;
      grouped.set(key, existing);
    });

    const first = productRows[0];
    const last = productRows[productRows.length - 1];
    const points: ClientProductChronologyPoint[] = [];
    let year = first.ano;
    let month = first.mes;

    while (year < last.ano || (year === last.ano && month <= last.mes)) {
      const key = `${year}-${month}`;
      points.push(
        grouped.get(key) ?? {
          key,
          year,
          month,
          label: `${String(month).padStart(2, '0')}/${year}`,
          units: 0,
          revenue: 0,
          orders: 0,
        }
      );

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return points;
  }, [rows, selectedProduct]);

  const maxUnits = Math.max(1, ...filteredProducts.map((product) => product.units));
  const maxChronologyUnits = Math.max(1, ...chronology.map((point) => point.units));
  const chronologyUnits = chronology.reduce((sum, point) => sum + point.units, 0);
  const chronologyRevenue = chronology.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <div className="glass-card rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>

        <div className="w-full lg:w-80">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar por código ou descrição..."
            className="h-10 border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {fmtNumber(filteredProducts.length)} produtos nesta visão
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="max-h-[24rem] space-y-2 overflow-y-auto pr-1 xl:max-h-[34rem]">
          {filteredProducts.map((product) => (
            <button
              key={product.cod_referencia}
              type="button"
              onClick={() => setSelectedProductCode(product.cod_referencia)}
              className={cn(
                'w-full rounded-2xl border p-4 text-left transition-all',
                selectedProduct?.cod_referencia === product.cod_referencia
                  ? 'border-indigo-300 bg-indigo-50/70 shadow-lg shadow-indigo-500/10 dark:border-indigo-800 dark:bg-indigo-950/20'
                  : 'border-slate-200 bg-white/70 hover:border-indigo-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {product.cod_referencia}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {product.descr_produto}
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {fmtNumber(product.units)}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                  style={{ width: `${Math.min(100, Math.max(5, (product.units / maxUnits) * 100))}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{fmtBRL(product.revenue)}</span>
                <span>{product.orderCount} pedidos</span>
              </div>
            </button>
          ))}

          {filteredProducts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
              Nenhum produto encontrado com esse filtro.
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          {selectedProduct ? (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Produto selecionado
                    </p>
                    <h4 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                      {selectedProduct.cod_referencia}
                    </h4>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {selectedProduct.descr_produto}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                      getProductTrendClasses(selectedProduct.trend)
                    )}
                  >
                    {getProductTrendLabel(selectedProduct.trend)}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Histórico completo
                    </p>
                    <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                      {fmtNumber(chronologyUnits)} unidades
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Receita acumulada
                    </p>
                    <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                      {fmtBRL(chronologyRevenue)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Última compra
                    </p>
                    <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                      {fmtDate(selectedProduct.lastPurchaseDate)}
                    </p>
                  </div>
                </div>
              </div>

              {chronology.length > 0 ? (
                <div className="mt-5 overflow-x-auto pb-2">
                  <div className="flex min-w-[40rem] items-end gap-3">
                    {chronology.map((point) => (
                      <div key={point.key} className="w-12 flex-shrink-0 sm:w-14">
                        <div className="flex h-40 items-end justify-center sm:h-52">
                          <div
                            className="w-8 rounded-t-2xl bg-gradient-to-t from-indigo-600 to-cyan-400 sm:w-10"
                            style={{
                              height: `${Math.max(8, (point.units / maxChronologyUnits) * 100)}%`,
                            }}
                            aria-label={`${point.label}: ${fmtNumber(point.units)} unidades | ${fmtBRL(point.revenue)}`}
                          />
                        </div>
                        <div className="mt-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            {point.label}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                            {fmtNumber(point.units)}
                          </p>
                          <p className="hidden text-[10px] text-slate-500 dark:text-slate-400 sm:block">
                            {fmtBRL(point.revenue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                  Ainda não há cronologia suficiente para este produto.
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Ano selecionado
                  </p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {fmtNumber(selectedProduct.units)} unidades
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Ano anterior
                  </p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {fmtNumber(selectedProduct.previousUnits)} unidades
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Participação
                  </p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {(selectedProduct.shareOfRevenue * 100).toFixed(1)}% da receita
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
              Selecione um produto para ver a cronologia mensal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OpportunityList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ClientOpportunity[];
}) {
  return (
    <div className="glass-card rounded-[1.75rem] p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
            Nenhum item relevante apareceu nesta leitura comparativa.
          </div>
        ) : (
          items.map((item) => {
            const isPositive = item.reason === 'em_alta' || item.reason === 'oportunidade';

            return (
              <div
                key={`${item.reason}-${item.cod_referencia}`}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {item.cod_referencia}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {item.descr_produto}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                      isPositive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {getOpportunityLabel(item.reason)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Receita
                    </p>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {fmtBRL(item.currentRevenue)} <span className="text-slate-400">vs</span>{' '}
                      {fmtBRL(item.previousRevenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Unidades
                    </p>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {fmtNumber(item.currentUnits)} <span className="text-slate-400">vs</span>{' '}
                      {fmtNumber(item.previousUnits)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function RecentOrdersList({
  orders,
  limit,
  description = 'Compras recentes para entrar na reunião já contextualizado.',
}: {
  orders: ClientVisitDashboardData['recentOrders'];
  limit?: number;
  description?: string;
}) {
  const visibleOrders = limit ? orders.slice(0, limit) : orders;

  return (
    <div className="glass-card rounded-[1.75rem] p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950 dark:text-white">Últimos pedidos</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Compras recentes para entrar na reunião já contextualizado.
      </p>

      <div className="mt-5 space-y-3">
        {visibleOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
            Ainda não há pedidos disponíveis para este cliente.
          </div>
        ) : (
          visibleOrders.map((order) => (
            <div
              key={order.orderKey}
              className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Pedido {order.orderCode}
                  </p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {fmtDate(order.orderDate)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-slate-950 dark:text-white">
                    {fmtBRL(order.revenue)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {fmtNumber(order.units)} unidades
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {order.lineCount} itens. Destaques: {order.highlights.join(', ')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ShareDashboardButton({ clientId, year }: { clientId: string; year: number }) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/share/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, year }),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        let errStr = response.statusText;
        try {
          const errData = await response.json();
          if (errData.error) errStr = errData.error;
          if (errData.details) errStr += ` - ${errData.details}`;
        } catch (e) {}
        throw new Error(`Falha ao gerar link: ${errStr}`);
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.shareLink);
      window.dispatchEvent(new Event('share-links-updated'));
      toast.success('Link copiado para a área de transferência!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar o link de compartilhamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleShare}
      disabled={loading}
      variant="outline"
      className="rounded-full px-4 border-indigo-200 hover:bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:hover:bg-indigo-900/30 dark:text-indigo-300"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="mr-2 h-4 w-4" />
      )}
      Compartilhar Visão
    </Button>
  );
}

export function ClientVisitDashboard() {
  const { selectedClient, selectedClientName, selectedYear, setClient, setYear } =
    useFilterStore();
  const { availableYears, loadingYears, yearsError } = useEnsureReportYears();
  const [isPending, startTransition] = useTransition();
  const [dashboardMode, setDashboardMode] = useState<'cliente' | 'consultor'>('cliente');
  // ── Busca de clientes: agora paginada e filtrada no banco ──
  const [clientQuery, setClientQuery] = useState('');
  const [clients, setClients] = useState<{ cod_cliente: string; nome_cliente: string }[]>([]);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [clientsLoading, setClientsLoading] = useState(false);

  // ── Dashboard (principal): carregado via RPCs agregadas ──
  const [dashboardData, setDashboardData] = useState<ClientVisitDashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // ── Pedidos recentes: carregados sob demanda na aba Resumo ──
  // (já incluídos nas RPCs agregadas acima; mantido para retrocompatibilidade)

  // ── Linhas brutas: carregadas somente quando a aba Produtos é aberta ──
  const [rows, setRows] = useState<ClientSalesRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');

  // Busca de clientes com debounce (300 ms) via RPC search_clients
  useEffect(() => {
    let active = true;
    setClientsLoading(true);
    setClientsError(null);

    const timer = setTimeout(() => {
      searchClients(clientQuery, 20, 0)
        .then((data) => {
          if (active) {
            setClients(data);
            setClientsLoading(false);
          }
        })
        .catch((error) => {
          if (active) {
            setClientsError(error instanceof Error ? error.message : 'Erro ao buscar clientes.');
            setClientsLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [clientQuery]);

  // Ao selecionar cliente + ano: carregar RPCs agregadas em paralelo
  useEffect(() => {
    let active = true;

    if (!selectedClient || !selectedYear) {
      setDashboardData(null);
      setDashboardError(null);
      setLoadingDashboard(false);
      setRows([]);
      return () => { active = false; };
    }

    setLoadingDashboard(true);
    setDashboardError(null);
    setDashboardData(null);
    setRows([]);

    Promise.all([
      getClientDashboardSummary(selectedClient, selectedYear),
      getClientMonthlyTrend(selectedClient, selectedYear),
      getClientYearlyHistory(selectedClient),
      getClientTopProducts(selectedClient, selectedYear),
      getClientRecentOrders(selectedClient, 8),
    ])
      .then(([summaryRows, trendRows, yearlyRows, productRows, recentOrderRows]) => {
        if (!active) return;
        if (
          summaryRows.length === 0 &&
          trendRows.length === 0 &&
          yearlyRows.length === 0 &&
          productRows.length === 0
        ) {
          setDashboardData(null);
        } else {
          setDashboardData(
            buildClientVisitDashboardFromAggregates(
              summaryRows,
              trendRows,
              yearlyRows,
              productRows,
              recentOrderRows,
              selectedYear
            )
          );
        }
      })
      .catch((error) => {
        if (!active) return;
        setDashboardError(
          error instanceof Error
            ? error.message
            : 'Erro ao carregar o dashboard do cliente.'
        );
      })
      .finally(() => {
        if (active) setLoadingDashboard(false);
      });

    return () => { active = false; };
  }, [selectedClient, selectedYear]);

  // Carregar linhas brutas somente quando a aba Produtos é aberta
  useEffect(() => {
    if (activeTab !== 'produtos' || !selectedClient || rows.length > 0 || loadingRows) return;

    let active = true;
    setLoadingRows(true);

    getClientSalesHistory(selectedClient)
      .then((data) => { if (active) setRows(data); })
      .catch(() => { /* ignora — ProductExplorer renderiza vazio */ })
      .finally(() => { if (active) setLoadingRows(false); });

    return () => { active = false; };
  }, [activeTab, selectedClient, rows.length, loadingRows]);

  const selectedClientRecord = useMemo(
    () => clients.find((client) => client.cod_cliente === selectedClient),
    [clients, selectedClient]
  );

  const headlineCards = useMemo<ClientVisitInsight[]>(() => {
    if (dashboardMode === 'consultor') {
      return (dashboardData?.insights ?? []).slice(0, 2);
    }

    if (!dashboardData || !selectedYear) {
      return [];
    }

    return [
      {
        title: 'Visão pronta para apresentar',
        description: `Mostra a evolução das compras em ${selectedYear}, o histórico do relacionamento e o mix de produtos em um formato mais limpo.`,
        tone: 'positive',
      },
      {
        title: 'Base da conversa',
        description: `O cliente tem ${fmtNumber(dashboardData.summary.orderCount)} pedidos no ano e ${fmtNumber(dashboardData.summary.uniqueProducts)} produtos ativos no mix analisado.`,
        tone: 'neutral',
      },
    ];
  }, [dashboardData, dashboardMode, selectedYear]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">
            {dashboardMode === 'cliente'
              ? 'Apresentação ao Cliente'
              : 'Painel Técnico do Consultor'}
          </h1>
          <p className="text-slate-400 mt-2 max-w-xl">
            Pesquise um cliente para formatar os dados de faturamento e projetar o foco da próxima visita.
          </p>
        </div>

        <div className="flex items-center bg-[#030712]/50 p-1.5 rounded-2xl border border-white/10 shadow-lg">
          <Button
            variant="ghost"
            className={cn(
              'rounded-xl px-6 h-11 transition-all',
              dashboardMode === 'cliente' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-400 hover:text-white'
            )}
            onClick={() => setDashboardMode('cliente')}
          >
            Modo Pitch Deck
          </Button>
          <Button
            variant="ghost"
            className={cn(
              'rounded-xl px-6 h-11 transition-all',
              dashboardMode === 'consultor' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-400 hover:text-white'
            )}
            onClick={() => setDashboardMode('consultor')}
          >
            Visão Interna
          </Button>
        </div>
      </header>

      <div className="glass-card rounded-[2rem] p-4 flex flex-col xl:flex-row gap-4 items-center z-50 relative">
        <div className="flex-1 w-full">
          <Combobox
            aria-label="Buscar cliente por código ou nome"
            placeholder="Buscar por código ou nome do cliente..."
            items={clients.map((client): ComboboxItem => ({
              value: client.cod_cliente,
              label: client.nome_cliente,
              sublabel: client.cod_cliente,
            }))}
            value={selectedClient ?? null}
            onInputChange={setClientQuery}
            onValueChange={(cod) => {
              if (!cod) {
                startTransition(() => setClient(null, null));
                return;
              }
              const client = clients.find((c) => c.cod_cliente === cod);
              startTransition(() => setClient(cod, client?.nome_cliente ?? null));
            }}
            emptyMessage={clientsLoading ? 'Buscando...' : 'Nenhum cliente encontrado.'}
            inputGroupClassName="bg-[#030712]/50 border-white/10"
            inputClassName="h-14 text-lg text-white placeholder:text-slate-500 focus-visible:ring-indigo-500/50"
          />
        </div>

        {availableYears.length > 0 && (
          <div className="flex bg-[#030712]/50 border border-white/10 p-1.5 rounded-xl w-full xl:w-auto overflow-x-auto custom-scrollbar">
            {availableYears.slice().sort((a, b) => b - a).map((year) => (
              <Button
                key={year}
                variant="ghost"
                className={cn(
                  'rounded-lg px-6 h-11 shrink-0',
                  selectedYear === year ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-400 hover:text-white'
                )}
                onClick={() => setYear(year)}
              >
                {year}
              </Button>
            ))}
          </div>
        )}

        {dashboardMode === 'cliente' && selectedClient && selectedYear && (
          <div className="w-full xl:w-auto shrink-0">
            <ShareDashboardButton clientId={selectedClient} year={selectedYear} />
            <ShareLinksManager clientId={selectedClient} year={selectedYear} />
          </div>
        )}
      </div>

      {(clientsError || yearsError || dashboardError) && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {clientsError ?? yearsError ?? dashboardError}
        </div>
      )}

      {!selectedClient && !loadingYears && (
        <div className="glass-card rounded-[2.5rem] p-16 text-center border-dashed border-2 border-white/10 mt-12 max-w-2xl mx-auto">
          <div className="w-24 h-24 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner shadow-indigo-500/20">
            <Sparkles className="h-10 w-10 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white mb-4">
            Aguardando seleção de cliente
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Busque o cliente no campo acima para gerar o dashboard comercial instantâneo com o histórico de compras e análise de tendências.
          </p>
        </div>
      )}

      {(loadingDashboard || isPending || loadingYears) && selectedClient && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="glass-card h-32 animate-pulse rounded-2xl sm:h-36" />
          ))}
        </div>
      )}

      {selectedClient && !loadingDashboard && !loadingYears && dashboardData && (
        <>
          {dashboardMode === 'cliente' ? (
            <>
              <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 rounded-[3rem] overflow-hidden mt-8 shadow-2xl border border-white/5 ring-1 ring-white/10">
                <SharedDashboardClientView 
                  dashboardData={dashboardData} 
                  clientName={selectedClientRecord?.nome_cliente || ''} 
                  year={selectedYear!} 
                  rows={rows} 
                />
              </div>
            </>
          ) : (
            <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Faturamento no ano"
              value={fmtBRL(dashboardData.summary.totalRevenue)}
              subtitle={`Base ${selectedYear! - 1}: ${fmtBRL(dashboardData.summary.previousRevenue)}`}
              delta={getDeltaLabel(
                dashboardData.summary.totalRevenue,
                dashboardData.summary.previousRevenue
              )}
              tone={
                dashboardData.summary.totalRevenue >= dashboardData.summary.previousRevenue
                  ? 'positive'
                  : 'warning'
              }
              icon={Wallet}
            />
            <MetricCard
              title="Unidades"
              value={fmtNumber(dashboardData.summary.totalUnits)}
              subtitle={`Melhor mês: ${dashboardData.summary.bestMonthLabel}`}
              delta={getDeltaLabel(
                dashboardData.summary.totalUnits,
                dashboardData.summary.previousUnits
              )}
              tone={
                dashboardData.summary.totalUnits >= dashboardData.summary.previousUnits
                  ? 'positive'
                  : 'warning'
              }
              icon={Package}
            />
            <MetricCard
              title="Pedidos"
              value={fmtNumber(dashboardData.summary.orderCount)}
              subtitle={`${dashboardData.summary.activeMonths} meses com compra no ano`}
              delta={getDeltaLabel(
                dashboardData.summary.orderCount,
                dashboardData.summary.previousOrderCount
              )}
              tone={
                dashboardData.summary.orderCount >= dashboardData.summary.previousOrderCount
                  ? 'positive'
                  : 'warning'
              }
              icon={ShoppingCart}
            />
            <MetricCard
              title="Produtos ativos"
              value={fmtNumber(dashboardData.summary.uniqueProducts)}
              subtitle={`Ano anterior: ${fmtNumber(dashboardData.summary.previousUniqueProducts)}`}
              delta={getDeltaLabel(
                dashboardData.summary.uniqueProducts,
                dashboardData.summary.previousUniqueProducts
              )}
              tone={
                dashboardData.summary.uniqueProducts >=
                dashboardData.summary.previousUniqueProducts
                  ? 'positive'
                  : 'neutral'
              }
              icon={TrendingUp}
            />
          </section>

          <Tabs
            defaultValue="resumo"
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-5"
          >
            <div className="overflow-x-auto pb-1">
              <TabsList className="min-w-max bg-white/75 p-1 dark:bg-slate-950/50">
                <TabsTrigger value="resumo" className="px-4">
                  Resumo
                </TabsTrigger>
                <TabsTrigger value="produtos" className="px-4">
                  Produtos
                </TabsTrigger>
                <TabsTrigger value="oportunidades" className="px-4">
                  Oportunidades
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="resumo" className="space-y-6">
              <section className="grid gap-3 lg:grid-cols-3">
                <QuickFactCard
                  title="Ticket médio"
                  value={fmtBRL(dashboardData.summary.averageTicket)}
                  description={`Base anterior: ${fmtBRL(dashboardData.summary.previousAverageTicket)}`}
                  icon={ArrowUpRight}
                />
                <QuickFactCard
                  title="Última compra"
                  value={fmtDate(dashboardData.summary.lastOrderDate)}
                  description={`${dashboardData.summary.yearsActive} anos de histórico`}
                  icon={CalendarClock}
                />
                <QuickFactCard
                  title="Histórico acumulado"
                  value={fmtBRL(dashboardData.summary.lifetimeRevenue)}
                  description={`${fmtNumber(dashboardData.summary.lifetimeOrders)} pedidos em toda a base`}
                  icon={Wallet}
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
                <MonthlyComparisonChart
                  data={dashboardData.monthlyTrend}
                  selectedYear={selectedYear!}
                />
                <YearHistoryPanel
                  data={dashboardData.yearlyHistory}
                  selectedYear={selectedYear!}
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <TopProductsList products={dashboardData.topProducts} />
                <RecentOrdersList orders={dashboardData.recentOrders} limit={4} />
              </section>
            </TabsContent>

            <TabsContent value="produtos" className="space-y-6">
              <ProductExplorer
                title="Mapa completo de produtos"
                description="Veja todos os produtos comprados pelo cliente e clique para abrir a cronologia mensal de cada item."
                products={dashboardData.allProducts}
                rows={rows}
              />
            </TabsContent>

            <TabsContent value="oportunidades" className="space-y-6">
              <section className="grid gap-6 xl:grid-cols-2">
                <OpportunityList
                  title="Itens que esfriaram"
                  description="Ótimos candidatos para retomada de conversa ou revisão de mix."
                  items={dashboardData.attentionProducts}
                />
                <OpportunityList
                  title="Produtos em expansão"
                  description="O que vem crescendo e pode abrir espaço para novas ofertas."
                  items={dashboardData.growthProducts}
                />
              </section>
            </TabsContent>
          </Tabs>
            </>
          )}
        </>
      )}

      {selectedClient && !loadingDashboard && !loadingYears && dashboardData === null && !dashboardError && (
        <div className="glass-card rounded-[2rem] p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">
            Sem histórico para este cliente
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            O cliente foi selecionado, mas ainda não há linhas importadas suficientes para
            montar o dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

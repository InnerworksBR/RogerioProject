'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
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
import { searchClients } from '@/lib/reportQueries';
import { clientProductsOptions, clientSummaryOptions, clientTrendOptions } from '@/lib/client/clientDashboardQueries';
import { buildMonthlyTrendComparison, resolveClientPresentationYear } from '@/lib/clientComparison';
import { copyClientShareLink, createClientShareLink } from '@/lib/client/shareApi';
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
import { useEnsureReportYears } from '@/components/reports/useEnsureReportYears';
import { SharedDashboardClientView } from '@/app/shared/client/[token]/SharedDashboardClientView';
import { ShareLinksManager } from './ShareLinksManager';
import { ClientCommercialAnalysis } from './ClientCommercialAnalysis';
import { MAX_COMPARISON_YEARS } from '@/types/reportApi';

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
    return 'bg-emerald-500/10 text-emerald-700';
  }

  if (trend === 'down') {
    return 'bg-amber-500/10 text-amber-700';
  }

  return 'bg-slate-100 text-slate-600';
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
    positive: 'bg-emerald-500/10 text-emerald-700',
    warning: 'bg-amber-500/10 text-amber-700',
    neutral: 'bg-slate-500/10 text-slate-600',
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('rounded-2xl p-3', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        {delta && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
            {delta}
          </span>
        )}
      </div>
      <div className="mt-4 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
          {title}
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function InsightItem({ insight }: { insight: ClientVisitInsight }) {
  const tones = {
    positive:
      'border-emerald-200 bg-emerald-50/80 text-emerald-700',
    warning:
      'border-amber-200 bg-amber-50/80 text-amber-700',
    neutral:
      'border-slate-200 bg-slate-50/80 text-slate-700',
  };

  return (
    <div className={cn('rounded-2xl border p-4', tones[insight.tone])}>
      <p className="text-xs font-bold uppercase tracking-wide">{insight.title}</p>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            {title}
          </p>
          <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
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
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">
            Evolução mensal do cliente
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Comparação direta entre {selectedYear} e {selectedYear - 1} por faturamento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            {selectedYear}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
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
                    className="w-3 rounded-t-full bg-slate-300 sm:w-4"
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
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    {point.label}
                  </p>
                  <p className="hidden text-xs text-slate-600 sm:block">
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
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950">Histórico anual</h3>
      <p className="mt-1 text-sm text-slate-600">
        Leitura rápida da evolução do relacionamento ao longo dos anos.
      </p>

      <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
        {data.map((item) => (
          <div
            key={item.year}
            className={cn(
              'rounded-2xl border p-4 transition-colors',
              item.year === selectedYear
                ? 'border-indigo-300 bg-indigo-50/70'
                : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-950">{item.year}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                {item.orders} pedidos
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-600">Faturamento</p>
                <p className="font-semibold text-slate-900">
                  {fmtBRL(item.revenue)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Produtos</p>
                <p className="font-semibold text-slate-900">
                  {fmtNumber(item.products)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Unidades</p>
                <p className="font-semibold text-slate-900">
                  {fmtNumber(item.units)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Pedidos</p>
                <p className="font-semibold text-slate-900">
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
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          Top {products.length}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {products.map((product, index) => (
          <div
            key={product.cod_referencia}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  #{index + 1} · {product.cod_referencia}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {product.descr_produto}
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wide',
                  getProductTrendClasses(product.trend)
                )}
              >
                {getProductTrendLabel(product.trend)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-600">
                  Receita
                </p>
                <p className="font-semibold text-slate-950">
                  {fmtBRL(product.revenue)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-600">
                  Unidades
                </p>
                <p className="font-semibold text-slate-950">
                  {fmtNumber(product.units)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-600">
                  Participação
                </p>
                <p className="font-semibold text-slate-950">
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
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>

        <div className="w-full lg:w-80">
          <Input
            aria-label="Filtrar produtos por código ou descrição"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar por código ou descrição..."
            className="h-10 border-slate-200 bg-slate-50"
          />
          <p className="mt-2 text-xs text-slate-600">
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
              aria-pressed={selectedProduct?.cod_referencia === product.cod_referencia}
              onClick={() => setSelectedProductCode(product.cod_referencia)}
              className={cn(
                'w-full rounded-2xl border p-4 text-left transition-all',
                selectedProduct?.cod_referencia === product.cod_referencia
                  ? 'border-indigo-300 bg-indigo-50/70 shadow-lg shadow-indigo-500/10'
                  : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-white'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    {product.cod_referencia}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                    {product.descr_produto}
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600">
                  {fmtNumber(product.units)}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                  style={{ width: `${Math.min(100, Math.max(5, (product.units / maxUnits) * 100))}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span>{fmtBRL(product.revenue)}</span>
                <span>{product.orderCount} pedidos</span>
              </div>
            </button>
          ))}

          {filteredProducts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Nenhum produto encontrado com esse filtro.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          {selectedProduct ? (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      Produto selecionado
                    </p>
                    <h4 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                      {selectedProduct.cod_referencia}
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedProduct.descr_produto}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
                      getProductTrendClasses(selectedProduct.trend)
                    )}
                  >
                    {getProductTrendLabel(selectedProduct.trend)}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-600">
                      Histórico completo
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {fmtNumber(chronologyUnits)} unidades
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-600">
                      Receita acumulada
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {fmtBRL(chronologyRevenue)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-600">
                      Última compra
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">
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
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                            {point.label}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-900">
                            {fmtNumber(point.units)}
                          </p>
                          <p className="hidden text-xs text-slate-600 sm:block">
                            {fmtBRL(point.revenue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  Ainda não há cronologia suficiente para este produto.
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-600">
                    Ano selecionado
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {fmtNumber(selectedProduct.units)} unidades
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-600">
                    Ano anterior
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {fmtNumber(selectedProduct.previousUnits)} unidades
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-600">
                    Participação
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {(selectedProduct.shareOfRevenue * 100).toFixed(1)}% da receita
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
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
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            Nenhum item relevante apareceu nesta leitura comparativa.
          </div>
        ) : (
          items.map((item) => {
            const isPositive = item.reason === 'em_alta' || item.reason === 'oportunidade';

            return (
              <div
                key={`${item.reason}-${item.cod_referencia}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      {item.cod_referencia}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {item.descr_produto}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wide',
                      isPositive
                        ? 'bg-emerald-500/10 text-emerald-700'
                        : 'bg-amber-500/10 text-amber-700'
                    )}
                  >
                    {getOpportunityLabel(item.reason)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-600">
                      Receita
                    </p>
                    <p className="font-semibold text-slate-950">
                      {fmtBRL(item.currentRevenue)} <span className="text-slate-600">vs</span>{' '}
                      {fmtBRL(item.previousRevenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-600">
                      Unidades
                    </p>
                    <p className="font-semibold text-slate-950">
                      {fmtNumber(item.currentUnits)} <span className="text-slate-600">vs</span>{' '}
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
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950">Últimos pedidos</h3>
      <p className="mt-1 text-sm text-slate-600">
        Compras recentes para entrar na reunião já contextualizado.
      </p>

      <div className="mt-5 space-y-3">
        {visibleOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            Ainda não há pedidos disponíveis para este cliente.
          </div>
        ) : (
          visibleOrders.map((order) => (
            <div
              key={order.orderKey}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Pedido {order.orderCode}
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {fmtDate(order.orderDate)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-slate-950">
                    {fmtBRL(order.revenue)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {fmtNumber(order.units)} unidades
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {order.lineCount} itens. Destaques: {order.highlights.join(', ')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ShareDashboardButton({ clientId, year, disabled = false }: { clientId: string; year: number | null; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const copyLink = async (link: string) => {
    if (await copyClientShareLink(link, navigator.clipboard)) {
      toast.success('Link copiado para a área de transferência!');
    } else {
      toast.warning('Link gerado. Use o campo abaixo para copiar ou abrir a apresentação.');
    }
  };

  const handleShare = async () => {
    if (year === null || disabled) return;
    setLoading(true);
    try {
      const data = await createClientShareLink(clientId, year);
      setGeneratedLink(data.shareLink);
      window.dispatchEvent(new Event('share-links-updated'));
      await copyLink(data.shareLink);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
    <Button
      onClick={handleShare}
      disabled={loading || disabled || year === null}
      title={year === null ? 'Selecione um ano em que este cliente tenha compras.' : `Compartilhar apresentação de ${year}`}
      variant="outline"
      className="rounded-full px-4 border-indigo-200 hover:bg-indigo-50 text-indigo-700"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="mr-2 h-4 w-4" />
      )}
      Compartilhar Visão
    </Button>
    {generatedLink && (
      <div className="w-full min-w-0 space-y-2 xl:w-64" role="status">
        <label className="block text-xs font-medium text-slate-600">
          Link gerado · {year}
          <Input aria-label="Link de compartilhamento gerado" value={generatedLink} readOnly className="mt-1 text-xs" onFocus={(event) => event.target.select()} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => void copyLink(generatedLink)}><Copy className="mr-1 size-3" />Copiar link</Button>
          <a href={generatedLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-700 underline">Abrir apresentação</a>
        </div>
      </div>
    )}
    </div>
  );
}

export function ClientVisitDashboard({ userId }: { userId: string }) {
  const { selectedClient, selectedClientName, selectedYear, selectedYears, setClient, setYears } =
    useFilterStore();
  const { availableYears, loadingYears, yearsError } = useEnsureReportYears();
  const [isPending, startTransition] = useTransition();
  const [dashboardMode, setDashboardMode] = useState<'cliente' | 'consultor'>('cliente');
  const comparisonYears = useMemo(() => {
    const valid = selectedYears.filter((year) => availableYears.includes(year));
    if (valid.length > 0) return [...new Set(valid)].sort((a, b) => a - b);
    const fallback = selectedYear && availableYears.includes(selectedYear) ? selectedYear : availableYears.at(-1);
    return fallback ? [fallback] : [];
  }, [selectedYears, availableYears, selectedYear]);
  // ── Busca de clientes: agora paginada e filtrada no banco ──
  const [clientQuery, setClientQuery] = useState('');
  const [clients, setClients] = useState<{ cod_cliente: string; nome_cliente: string }[]>([]);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [clientsLoading, setClientsLoading] = useState(false);

  const presentationEnabled = dashboardMode === 'cliente' && !!selectedClient && !!selectedYear;
  const trendQueries = useQueries({
    queries: comparisonYears.map((year) => ({
      ...clientTrendOptions(userId, selectedClient ?? '', year),
      enabled: presentationEnabled,
    })),
  });
  const trendsReady = comparisonYears.length > 0 && trendQueries.every((query) => query.isSuccess);
  const presentationYear = trendsReady ? resolveClientPresentationYear(
    comparisonYears, trendQueries.flatMap((query) => query.data ?? [])
  ) : null;
  const summaryQuery = useQuery({
    ...clientSummaryOptions(userId, selectedClient ?? '', presentationYear ?? 0),
    enabled: presentationEnabled && presentationYear !== null,
  });
  const productsQuery = useQuery({
    ...clientProductsOptions(userId, selectedClient ?? '', presentationYear ?? 0),
    enabled: presentationEnabled && presentationYear !== null,
  });
  const currentTrend = trendQueries[comparisonYears.indexOf(presentationYear ?? 0)]?.data;
  const dashboardData = useMemo(() => summaryQuery.data?.length && currentTrend && productsQuery.data
    ? buildClientVisitDashboardFromAggregates(summaryQuery.data, currentTrend, [], productsQuery.data, [], presentationYear!)
    : null, [summaryQuery.data, currentTrend, productsQuery.data, presentationYear]);
  const loadingDashboard = presentationEnabled && (
    !trendsReady || (presentationYear !== null && (summaryQuery.isPending || productsQuery.isPending))
  ) && !summaryQuery.isError && !productsQuery.isError && !trendQueries.some((query) => query.isError);
  const dashboardError = summaryQuery.error?.message ?? productsQuery.error?.message
    ?? trendQueries.find((query) => query.error)?.error?.message ?? null;
  const monthlyComparison = buildMonthlyTrendComparison(comparisonYears.map((year, index) => ({
    year, rows: trendQueries[index]?.data ?? [],
  })));


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

  const selectedClientRecord = useMemo(
    () => clients.find((client) => client.cod_cliente === selectedClient),
    [clients, selectedClient]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
            {dashboardMode === 'cliente'
              ? 'Apresentação ao Cliente'
              : 'Análise comercial'}
          </h1>
          <p className="text-slate-600 mt-2 max-w-xl">
            Escolha um cliente para acompanhar as compras e preparar sua próxima visita.
          </p>
        </div>

        <div role="group" aria-label="Modo de visualização do cliente" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-white p-1">
          <Button
            variant="ghost"
            className={cn(
              'rounded-lg px-3 h-11 text-xs sm:text-sm transition-colors',
              dashboardMode === 'cliente' ? 'bg-indigo-500/20 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            )}
            aria-pressed={dashboardMode === 'cliente'}
            onClick={() => setDashboardMode('cliente')}
          >
            Apresentar ao cliente
          </Button>
          <Button
            variant="ghost"
            className={cn(
              'rounded-lg px-3 h-11 text-xs sm:text-sm transition-colors',
              dashboardMode === 'consultor' ? 'bg-indigo-500/20 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            )}
            aria-pressed={dashboardMode === 'consultor'}
            onClick={() => setDashboardMode('consultor')}
          >
            Análise comercial
          </Button>
        </div>
      </header>

      <div className="glass-card rounded-2xl p-4 flex flex-col xl:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <Combobox
            aria-label="Buscar cliente por código ou nome"
            placeholder="Buscar por código ou nome do cliente..."
            items={clients.map((client): ComboboxItem => ({
              value: client.cod_cliente,
              label: client.nome_cliente,
              sublabel: client.cod_cliente.startsWith('group:') ? 'Consolidado' : client.cod_cliente,
            }))}
            value={selectedClient ?? null}
            selectedLabel={selectedClientName}
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
            inputGroupClassName="bg-white border-slate-200"
            inputClassName="h-14 text-lg text-slate-900 placeholder:text-slate-600 focus-visible:ring-indigo-500/50"
          />
        </div>

        {availableYears.length > 0 && (
          <fieldset className="w-full min-w-0 xl:w-auto">
            <legend className="mb-2 text-sm font-semibold text-slate-700">
              Anos para comparar
            </legend>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-white p-1.5">
              {availableYears.slice().sort((a, b) => b - a).map((year) => {
                const active = comparisonYears.includes(year);
                return <Button key={year} variant={active ? 'default' : 'ghost'} className="h-11 rounded-lg px-5"
                  aria-pressed={active}
                  disabled={!active && comparisonYears.length >= MAX_COMPARISON_YEARS}
                  onClick={() => {
                    if (active && comparisonYears.length === 1) { toast.info('Mantenha ao menos um ano selecionado.'); return; }
                    setYears(active ? comparisonYears.filter((item) => item !== year) : [...comparisonYears, year]);
                  }}>{year}</Button>;
              })}
            </div>
            <p className="mt-2 text-xs text-slate-600">Selecione de 1 a {MAX_COMPARISON_YEARS} anos para sobrepor no gráfico. Clique novamente para remover.</p>
            {dashboardMode === 'cliente' && presentationYear !== null && <p className="mt-1 text-xs text-slate-600">Indicadores e link compartilhado: {presentationYear}.{presentationYear !== selectedYear && ' Último ano selecionado com compras.'}</p>}
          </fieldset>
        )}

        {dashboardMode === 'cliente' && selectedClient && selectedYear && (
          <div className="w-full xl:w-auto shrink-0">
            <ShareDashboardButton key={`${selectedClient}:${presentationYear}`} clientId={selectedClient} year={presentationYear} disabled={loadingDashboard || loadingYears || !!dashboardError} />
            {presentationYear !== null && <ShareLinksManager clientId={selectedClient} year={presentationYear} />}
          </div>
        )}
      </div>

      {(clientsError || yearsError || (dashboardMode === 'cliente' && dashboardError)) && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {clientsError ?? yearsError ?? (dashboardMode === 'cliente' ? dashboardError : null)}
          {dashboardMode === 'cliente' && dashboardError && <Button variant="outline" size="sm" className="ml-3" onClick={() => {
            void summaryQuery.refetch();
            void productsQuery.refetch();
            trendQueries.forEach((query) => { void query.refetch(); });
          }}>Tentar novamente</Button>}
        </div>
      )}

      {!selectedClient && !loadingYears && (
        <div className="glass-card rounded-2xl px-5 py-10 text-center border-dashed border-2 border-slate-200 max-w-2xl mx-auto sm:p-10">
          <div className="w-24 h-24 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner shadow-indigo-500/20">
            <Sparkles className="h-10 w-10 text-indigo-700" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">
            Qual cliente você vai visitar?
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Pesquise pelo nome ou código no campo acima. Você poderá consultar o histórico de compras, comparar resultados e preparar uma apresentação.
          </p>
        </div>
      )}

      {dashboardMode === 'cliente' && (loadingDashboard || isPending || loadingYears) && selectedClient && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="glass-card h-32 animate-pulse rounded-2xl sm:h-36" />
          ))}
        </div>
      )}

      {dashboardMode === 'consultor' && selectedClient && !loadingYears && comparisonYears.length > 0 && (
        <ClientCommercialAnalysis key={selectedClient} userId={userId} clientId={selectedClient} years={comparisonYears} />
      )}

      {dashboardMode === 'cliente' && selectedClient && !loadingDashboard && !loadingYears && !dashboardError && dashboardData && (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-border">
          <SharedDashboardClientView
            dashboardData={dashboardData}
            clientName={selectedClientName || selectedClientRecord?.nome_cliente || ''}
            year={presentationYear!}
            comparison={{ years: comparisonYears, data: monthlyComparison }}
            rows={[]}
          />
        </div>
      )}

      {dashboardMode === 'cliente' && selectedClient && !loadingDashboard && !loadingYears && dashboardData === null && !dashboardError && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-700" />
          <h2 className="mt-4 text-2xl font-bold text-slate-950">
            Sem compras nos anos selecionados
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Selecione um ano em que este cliente tenha compras para apresentar os indicadores e gerar o link.
          </p>
        </div>
      )}
    </div>
  );
}

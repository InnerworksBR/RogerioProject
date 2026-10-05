'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildClientVisitDashboardFromAggregates } from '@/lib/clientDashboard';
import {
  buildComparisonOpportunities, buildMonthlyComparison, buildProductComparison, comparisonDelta,
  type ClientYearDataset, type ComparisonProduct,
} from '@/lib/clientComparison';
import { getClientDashboardSummary, getClientMonthlyTrend, getClientSalesHistory } from '@/lib/reportQueries';
import { normalizeSearchText } from '@/lib/text';
import { cn } from '@/lib/utils';
import { InteractiveComparisonChart, formatComparisonValue, YEAR_COLORS } from './InteractiveComparisonChart';

const currency = (value: number) => formatComparisonValue(value, 'revenue');
const number = (value: number) => formatComparisonValue(value, 'units');
const percent = (current: number, base: number) => {
  const delta = comparisonDelta(current, base);
  return delta === null ? 'Sem base de comparação' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
};

function AnnualComparison({ datasets }: { datasets: ClientYearDataset[] }) {
  const metrics = [
    { label: 'Faturamento', key: 'totalRevenue', format: currency },
    { label: 'Unidades', key: 'totalUnits', format: number },
    { label: 'Pedidos', key: 'orderCount', format: number },
    { label: 'Produtos ativos', key: 'uniqueProducts', format: number },
  ] as const;
  const first = datasets[0];
  const last = datasets.at(-1)!;
  return <>
    <section aria-label="Indicadores por ano" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => <div key={metric.key} className="rounded-2xl border border-border bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-600">{metric.label}</h3>
        <dl className="mt-4 space-y-3">
          {datasets.map(({ year, dashboard }, index) => <div key={year} className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="flex items-center gap-2 text-sm text-slate-600"><span className="size-2 rounded-full" style={{ background: YEAR_COLORS[index] }} />{year}</dt>
            <dd className="text-lg font-bold tracking-tight text-slate-900">{metric.format(dashboard.summary[metric.key])}</dd>
          </div>)}
        </dl>
        <p className="mt-4 border-t border-border pt-3 text-xs font-medium text-slate-600">
          {datasets.length > 1
            ? `${percent(last.dashboard.summary[metric.key], first.dashboard.summary[metric.key])} · ${last.year} vs ${first.year}`
            : 'Selecione outro ano para comparar.'}
        </p>
      </div>)}
    </section>
    <section className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950">Comparativo completo por ano</h3>
      <p className="mt-1 text-sm text-slate-600">Valores da base importada. Anos em andamento ou com importações parciais podem ter menos meses de compras.</p>
      <div role="region" aria-label="Tabela de comparação anual" tabIndex={0} className="mt-4 overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">Indicadores anuais do cliente nos anos selecionados</caption>
          <thead><tr className="border-b border-border text-slate-600"><th scope="col" className="py-3 pr-4 text-left">Indicador</th>
            {datasets.map(({ year }) => <th key={year} scope="col" className="px-4 py-3 text-right">{year}</th>)}
          </tr></thead>
          <tbody>
            {[
              ...metrics,
              { label: 'Ticket médio', key: 'averageTicket' as const, format: currency },
              { label: 'Meses com compra', key: 'activeMonths' as const, format: number },
            ].map((metric) => <tr key={metric.key} className="border-b border-border last:border-0">
              <th scope="row" className="py-3 pr-4 text-left font-medium text-slate-700">{metric.label}</th>
              {datasets.map(({ year, dashboard }) => <td key={year} className="px-4 py-3 text-right tabular-nums text-slate-900">{metric.format(dashboard.summary[metric.key])}</td>)}
            </tr>)}
            <tr><th scope="row" className="py-3 pr-4 text-left font-medium text-slate-700">Melhor mês por faturamento</th>
              {datasets.map(({ year, dashboard }) => <td key={year} className="px-4 py-3 text-right text-slate-900">{dashboard.summary.orderCount > 0 ? dashboard.summary.bestMonthLabel : 'Sem compras'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </>;
}

function ProductsComparison({ products, years }: { products: ComparisonProduct[]; years: number[] }) {
  const [query, setQuery] = useState('');
  const [productCode, setProductCode] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const filtered = useMemo(() => {
    const term = normalizeSearchText(query.trim());
    return products.filter((product) => normalizeSearchText(`${product.code} ${product.description}`).includes(term));
  }, [products, query]);
  const selected = filtered.find((product) => product.code === productCode) ?? filtered[0];

  return <section className="space-y-5">
    <div className="rounded-2xl border border-border bg-white p-4 sm:p-6">
      <h3 className="text-lg font-bold text-slate-950">Produtos nos anos selecionados</h3>
      <p className="mt-1 text-sm text-slate-600">Selecione um produto para comparar faturamento, unidades, pedidos e evolução mensal. Itens sem compras em um ano aparecem com zero.</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <Input aria-label="Buscar produto na comparação" placeholder="Código ou descrição do produto..." value={query}
            onChange={(event) => { setQuery(event.target.value); setVisibleCount(25); }} />
          <p className="mt-2 text-xs text-slate-600">{number(filtered.length)} produtos encontrados</p>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {filtered.slice(0, visibleCount).map((product) => <button type="button" key={product.code}
              aria-pressed={selected?.code === product.code} onClick={() => setProductCode(product.code)}
              className={cn('w-full rounded-xl border p-3 text-left transition-colors', selected?.code === product.code
                ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-slate-50')}>
              <span className="block text-xs font-bold text-primary">{product.code}</span>
              <span className="mt-1 block text-sm font-medium text-slate-900">{product.description}</span>
              <span className="mt-2 block text-xs text-slate-600">{currency(years.reduce((sum, year) => sum + product.values[year].revenue, 0))} nos anos selecionados</span>
            </button>)}
            {filtered.length > visibleCount && <Button variant="outline" className="w-full" onClick={() => setVisibleCount(visibleCount + 25)}>Mostrar mais produtos</Button>}
            {filtered.length === 0 && <p className="p-4 text-sm text-slate-600">Nenhum produto encontrado.</p>}
          </div>
        </div>
        {selected && <div className="min-w-0 rounded-xl border border-border bg-slate-50 p-4">
          <h4 className="font-bold text-slate-900">{selected.code} · {selected.description}</h4>
          <div role="region" aria-label="Tabela de comparação do produto" tabIndex={0} className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <caption className="sr-only">Compras de {selected.code} por ano</caption>
              <thead><tr className="border-b border-border"><th scope="col" className="py-3 text-left">Ano</th><th scope="col" className="px-2 text-right">Faturamento</th><th scope="col" className="px-2 text-right">Unidades</th><th scope="col" className="pl-2 text-right">Pedidos</th></tr></thead>
              <tbody>{years.map((year) => <tr key={year} className="border-b border-border last:border-0">
                <th scope="row" className="py-3 text-left font-semibold">{year}</th>
                <td className="px-2 text-right tabular-nums">{currency(selected.values[year].revenue)}</td>
                <td className="px-2 text-right tabular-nums">{number(selected.values[year].units)}</td>
                <td className="pl-2 text-right tabular-nums">{number(selected.values[year].orders)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>}
      </div>
    </div>
    {selected && <InteractiveComparisonChart key={selected.code} data={selected.monthly} years={years} title={`Evolução mensal · ${selected.code}`} />}
  </section>;
}

function OpportunitiesComparison({ products, years }: { products: ComparisonProduct[]; years: number[] }) {
  const [baseSelection, setBaseSelection] = useState(years[0]);
  const [targetSelection, setTargetSelection] = useState(years.at(-1)!);
  const targetYear = years.includes(targetSelection) ? targetSelection : years.at(-1)!;
  const baseYear = years.includes(baseSelection) && baseSelection !== targetYear
    ? baseSelection : years.find((year) => year !== targetYear) ?? targetYear - 1;
  const changes = buildComparisonOpportunities(products, baseYear, targetYear);
  const groups = [
    { title: 'Itens que esfriaram', positive: false, items: changes.filter((item) => item.deltaRevenue < 0) },
    { title: 'Produtos em expansão', positive: true, items: changes.filter((item) => item.deltaRevenue > 0) },
  ];
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-white p-4 sm:p-6">
      <div><h3 className="text-lg font-bold text-slate-950">Oportunidades entre os anos</h3>
        <p className="mt-1 text-sm text-slate-600">Variação de faturamento em {targetYear} em relação a {baseYear}. Comparação de anos inteiros importados.</p></div>
      {years.length > 1 && <div className="flex gap-3">
        <label className="text-xs font-medium text-slate-600">Ano base<select aria-label="Ano base das oportunidades" value={baseYear}
          onChange={(event) => setBaseSelection(Number(event.target.value))} className="mt-1 block h-11 rounded-lg border border-border bg-white px-3 text-sm text-slate-900">
          {years.filter((year) => year !== targetYear).map((year) => <option key={year}>{year}</option>)}
        </select></label>
        <label className="text-xs font-medium text-slate-600">Comparar com<select aria-label="Ano de comparação das oportunidades" value={targetYear}
          onChange={(event) => setTargetSelection(Number(event.target.value))} className="mt-1 block h-11 rounded-lg border border-border bg-white px-3 text-sm text-slate-900">
          {years.map((year) => <option key={year}>{year}</option>)}
        </select></label>
      </div>}
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      {groups.map((group) => <div key={group.title} className="rounded-2xl border border-border bg-white p-4 sm:p-6">
        <h4 className="font-bold text-slate-900">{group.title} · {group.items.length} produtos</h4>
        <div className="mt-4 max-h-[36rem] space-y-3 overflow-y-auto pr-1">
          {group.items.map((item) => <div key={item.product.code} className="rounded-xl border border-border bg-slate-50 p-4">
            <p className="text-xs font-bold text-primary">{item.product.code}</p><p className="mt-1 text-sm font-medium text-slate-900">{item.product.description}</p>
            <p className={cn('mt-3 text-sm font-bold', group.positive ? 'text-emerald-700' : 'text-amber-700')}>
              {item.deltaRevenue > 0 ? '+' : ''}{currency(item.deltaRevenue)} · {percent(item.target.revenue, item.base.revenue)}
            </p>
            <p className="mt-1 text-xs text-slate-600">{baseYear}: {currency(item.base.revenue)} · {number(item.base.units)} un.</p>
            <p className="mt-1 text-xs text-slate-600">{targetYear}: {currency(item.target.revenue)} · {number(item.target.units)} un.</p>
          </div>)}
          {group.items.length === 0 && <p className="text-sm text-slate-600">Nenhum produto apresentou {group.positive ? 'crescimento' : 'queda'} neste comparativo.</p>}
        </div>
      </div>)}
    </div>
  </section>;
}

export function ClientCommercialAnalysis({ userId, clientId, years }: { userId: string; clientId: string; years: number[] }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('resumo');
  const yearlyQuery = useQuery({
    queryKey: ['reports', 'client-commercial-comparison', userId, clientId, years.join(',')],
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const datasets: ClientYearDataset[] = [];
      // Bound database pressure: load one year's aggregates at a time and reuse cached years.
      for (const year of years) {
        if (signal.aborted) throw new Error('Comparação cancelada.');
        const dashboard = await queryClient.fetchQuery({
          queryKey: ['reports', 'client-commercial-year', userId, clientId, year], staleTime: 30_000,
          queryFn: async () => {
            const [summary, trend] = await Promise.all([
              getClientDashboardSummary(clientId, year), getClientMonthlyTrend(clientId, year),
            ]);
            return buildClientVisitDashboardFromAggregates(summary, trend, [], [], [], year);
          },
        });
        datasets.push({ year, dashboard });
      }
      return datasets;
    },
  });
  const rowsQuery = useQuery({
    queryKey: ['reports', 'client-commercial-products', userId, clientId],
    queryFn: () => getClientSalesHistory(clientId),
    enabled: activeTab !== 'resumo',
    staleTime: 30_000,
  });
  const datasets = yearlyQuery.data ?? [];
  const monthly = useMemo(() => buildMonthlyComparison(datasets), [datasets]);
  const productYears = activeTab === 'oportunidades' && years.length === 1 ? [years[0] - 1, ...years] : years;
  const products = useMemo(() => buildProductComparison(rowsQuery.data ?? [], productYears), [rowsQuery.data, productYears.join(',')]);

  if (yearlyQuery.isPending) return <div role="status" className="rounded-2xl border border-border bg-white p-8 text-center text-slate-600"><Loader2 className="mx-auto mb-3 size-6 animate-spin" />Carregando comparação dos anos selecionados...</div>;
  if (yearlyQuery.isError) return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
    <AlertTriangle className="mb-2 size-5" /><p>Não foi possível carregar a comparação. {yearlyQuery.error.message}</p>
    <Button variant="outline" className="mt-3" onClick={() => void yearlyQuery.refetch()}>Tentar novamente</Button>
  </div>;
  if (datasets.length === 0) return null;

  return <div className="min-w-0 space-y-5">
    <p className="text-sm font-medium text-slate-600" role="status">Análise comercial · {years.join(' × ')}{years.length === 1 && ' · selecione mais anos para comparar'}</p>
    {datasets.some(({ dashboard }) => dashboard.summary.orderCount === 0) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Sem compras registradas para este cliente em {datasets.filter(({ dashboard }) => dashboard.summary.orderCount === 0).map(({ year }) => year).join(', ')}. Os valores desses anos aparecem com zero.
    </p>}
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
      <div className="overflow-x-auto pb-1"><TabsList className="min-w-max">
        <TabsTrigger value="resumo">Resumo</TabsTrigger><TabsTrigger value="produtos">Produtos</TabsTrigger><TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
      </TabsList></div>
      <TabsContent value="resumo" className="space-y-5">
        <AnnualComparison datasets={datasets} />
        <InteractiveComparisonChart data={monthly} years={years} />
      </TabsContent>
      {['produtos', 'oportunidades'].map((tab) => <TabsContent key={tab} value={tab} className="space-y-5">
        {rowsQuery.isPending ? <div role="status" className="rounded-xl border border-border bg-white p-6 text-slate-600">Carregando todos os produtos e seu histórico...</div>
          : rowsQuery.isError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
              <p>Não foi possível carregar os produtos. {rowsQuery.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void rowsQuery.refetch()}>Tentar novamente</Button>
            </div>
          : tab === 'produtos' ? <ProductsComparison products={products} years={years} /> : <OpportunitiesComparison products={products} years={years} />}
      </TabsContent>)}
    </Tabs>
  </div>;
}

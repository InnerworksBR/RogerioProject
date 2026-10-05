'use client';

import { useId, useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComparisonMetric, ComparisonMonth } from '@/lib/clientComparison';

export const YEAR_COLORS = ['#3558c8', '#0e8075', '#b45b13', '#8653b5'];
export const METRIC_LABELS: Record<ComparisonMetric, string> = {
  revenue: 'Faturamento', units: 'Unidades', orders: 'Pedidos',
};
export function formatComparisonValue(value: number, metric: ComparisonMetric) {
  return value.toLocaleString('pt-BR', metric === 'revenue'
    ? { style: 'currency', currency: 'BRL' }
    : { maximumFractionDigits: 2 });
}

export function InteractiveComparisonChart({
  data, years, title = 'Evolução mensal',
}: {
  data: ComparisonMonth[];
  years: number[];
  title?: string;
}) {
  const id = useId();
  const [metric, setMetric] = useState<ComparisonMetric>('revenue');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [hiddenYears, setHiddenYears] = useState<number[]>([]);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const visibleYears = years.filter((year) => !hiddenYears.includes(year));
  // New selections must never leave a chart with every series hidden.
  const plottedYears = visibleYears.length > 0 ? visibleYears : years;
  const points = data.filter((point) => point.month >= startMonth && point.month <= endMonth);
  const selected = points.find((point) => point.month === selectedMonth) ?? points[0];
  const chartData = points.map((point) => ({
    label: point.label,
    ...Object.fromEntries(years.map((year) => [`year${year}`, point.values[year]?.[metric] ?? 0])),
  }));

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id={`${id}-title`} className="text-lg font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">Passe sobre os pontos para consultar valores. Clique em um mês para comparar os detalhes.</p>
        </div>
        <div role="group" aria-label="Tipo de gráfico" className="flex rounded-lg border border-border p-1">
          {(['line', 'bar'] as const).map((type) => (
            <Button key={type} size="sm" variant={chartType === type ? 'secondary' : 'ghost'}
              aria-pressed={chartType === type} onClick={() => setChartType(type)}>
              {type === 'line' ? 'Linhas' : 'Barras'}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div role="group" aria-label="Métrica do gráfico" className="flex flex-wrap gap-1.5">
          {(Object.keys(METRIC_LABELS) as ComparisonMetric[]).map((key) => (
            <Button key={key} size="sm" variant={metric === key ? 'default' : 'outline'}
              aria-pressed={metric === key} onClick={() => setMetric(key)}>{METRIC_LABELS[key]}</Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs font-medium text-slate-600" htmlFor={`${id}-start`}>Gráfico de
            <select id={`${id}-start`} className="mt-1 block h-10 rounded-lg border border-border bg-white px-2 text-sm text-slate-900"
              value={startMonth} onChange={(event) => {
                const month = Number(event.target.value);
                setStartMonth(month); setEndMonth(Math.max(month, endMonth));
              }}>
              {data.map((point) => <option key={point.month} value={point.month}>{point.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600" htmlFor={`${id}-end`}>Até
            <select id={`${id}-end`} className="mt-1 block h-10 rounded-lg border border-border bg-white px-2 text-sm text-slate-900"
              value={endMonth} onChange={(event) => {
                const month = Number(event.target.value);
                setEndMonth(month); setStartMonth(Math.min(month, startMonth));
              }}>
              {data.map((point) => <option key={point.month} value={point.month}>{point.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div role="group" aria-label="Anos visíveis no gráfico" className="mt-4 flex flex-wrap gap-2">
        {years.map((year, index) => {
          const visible = plottedYears.includes(year);
          return <button key={year} type="button" aria-label={`Exibir ${year} no gráfico`}
            aria-pressed={visible} disabled={visible && plottedYears.length === 1}
            onClick={() => setHiddenYears(visible
              ? years.filter((item) => !plottedYears.includes(item) || item === year)
              : hiddenYears.filter((item) => item !== year))}
            className={cn('inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors',
              visible ? 'border-border bg-slate-50 text-slate-900' : 'border-dashed border-border text-slate-500')}>
            <span className="size-2.5 rounded-full" style={{ background: YEAR_COLORS[index % YEAR_COLORS.length], opacity: visible ? 1 : 0.35 }} />
            {year}{!visible && ' · oculto'}
          </button>;
        })}
      </div>

      <div className="mt-5 h-72 w-full min-w-0 sm:h-80" aria-label={`${title}: ${METRIC_LABELS[metric]} por mês`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={chartData} accessibilityLayer margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
            onClick={(state) => {
              const index = Number(state.activeTooltipIndex);
              if (state.activeTooltipIndex != null && Number.isInteger(index) && points[index]) setSelectedMonth(points[index].month);
            }}>
            <CartesianGrid stroke="#e5eaf2" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#526078', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={15} />
            <YAxis tick={{ fill: '#526078', fontSize: 12 }} axisLine={false} tickLine={false} width={66}
              allowDecimals={metric !== 'orders'} tickFormatter={(value: number) =>
                `${metric === 'revenue' ? 'R$ ' : ''}${value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })}`} />
            <Tooltip formatter={(value) => formatComparisonValue(Number(value ?? 0), metric)}
              labelFormatter={(label) => `Mês: ${label}`}
              contentStyle={{ background: '#fff', border: '1px solid #dce3ee', borderRadius: 12, fontSize: 13, boxShadow: '0 4px 16px #17243c12' }} />
            {selected && <ReferenceLine x={selected.label} stroke="#94a3b8" strokeDasharray="4 4" />}
            {plottedYears.map((year) => {
              const color = YEAR_COLORS[years.indexOf(year) % YEAR_COLORS.length];
              return chartType === 'line'
                ? <Line key={year} type="linear" dataKey={`year${year}`} name={String(year)} stroke={color} strokeWidth={2.5}
                    dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                : <Bar key={year} dataKey={`year${year}`} name={String(year)} fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div role="group" aria-label="Selecionar mês para detalhar" className="mt-3 flex flex-wrap gap-1">
        {points.map((point) => <Button key={point.month} size="sm" variant={selected?.month === point.month ? 'secondary' : 'ghost'}
          aria-label={`Detalhar ${point.label}`} aria-pressed={selected?.month === point.month}
          onClick={() => setSelectedMonth(point.month)}>{point.label}</Button>)}
      </div>
      {selected && <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4" aria-live="polite">
        <h4 className="font-semibold text-slate-900">Detalhes de {selected.label} · todos os anos selecionados</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {years.map((year, index) => <div key={year} className="rounded-lg border border-border bg-white p-3">
            <p className="mb-2 flex items-center gap-2 font-bold text-slate-900"><span className="size-2.5 rounded-full" style={{ background: YEAR_COLORS[index % YEAR_COLORS.length] }} />{year}</p>
            {(Object.keys(METRIC_LABELS) as ComparisonMetric[]).map((key) => <p key={key} className="flex flex-wrap justify-between gap-x-2 text-sm leading-6">
              <span className="text-slate-600">{METRIC_LABELS[key]}</span><span className="font-medium text-slate-900">{formatComparisonValue(selected.values[year]?.[key] ?? 0, key)}</span>
            </p>)}
          </div>)}
        </div>
      </div>}
      <p className="mt-3 text-xs leading-relaxed text-slate-600">O intervalo e a legenda alteram apenas este gráfico. Os indicadores e as tabelas comparam os anos inteiros da base importada. Meses sem compras aparecem com zero.</p>
    </section>
  );
}

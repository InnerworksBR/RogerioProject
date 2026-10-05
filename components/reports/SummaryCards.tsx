'use client';

import {
  type LucideIcon,
  Calendar,
  Layers,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/types/sales';
import type { ReportYearSummary } from '@/types/reportApi';

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR');
const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string | null) =>
  s ? new Date(`${s}T12:00:00`).toLocaleDateString('pt-BR') : '—';

function getPeriodValue(start: string | null, end: string | null) {
  if (!start || !end) return 'Sem dados';

  const startYear = new Date(`${start}T12:00:00`).getFullYear();
  const endYear = new Date(`${end}T12:00:00`).getFullYear();

  return startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`;
}

function getPeriodRange(start: string | null, end: string | null) {
  if (!start || !end) return 'Faça upload para liberar os indicadores';
  return `${fmtDate(start)} até ${fmtDate(end)}`;
}

function KPICard({
  title,
  value,
  sub,
  icon: Icon,
  variant = 'default',
}: {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  variant?: 'default' | 'indigo' | 'emerald' | 'amber' | 'blue' | 'rose';
}) {
  const variants = {
    default: 'bg-indigo-500/10 text-indigo-600',
    indigo: 'bg-indigo-500/10 text-indigo-600',
    emerald: 'bg-emerald-500/10 text-emerald-700',
    amber: 'bg-amber-500/10 text-amber-700',
    blue: 'bg-blue-500/10 text-blue-600',
    rose: 'bg-rose-500/10 text-rose-600',
  };

  return (
    <div className="glass-card min-w-0 rounded-xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${variants[variant]} transition-colors group-hover:bg-opacity-20`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
          {title}
        </h3>
        <p className="break-words text-xl font-semibold tabular-nums text-slate-900 tracking-tight xl:text-2xl">
          {value}
        </p>
        {sub && (
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function KPICardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-pulse">
      <div className="w-10 h-10 bg-slate-200 rounded-xl mb-4" />
      <div className="h-3 w-20 bg-slate-200 rounded-full mb-2" />
      <div className="h-6 w-28 bg-slate-200 rounded-full" />
    </div>
  );
}

export function SummaryCards({
  data,
  summaries = [],
  loading,
  error,
}: {
  data: DashboardSummary | null;
  summaries?: ReportYearSummary[];
  loading: boolean;
  error: string | null;
}) {

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, index) => <KPICardSkeleton key={index} />)}
      </div>
    );
  }

  if (error) {
    const isNetwork = error.toLowerCase().includes('failed to fetch') || error.toLowerCase().includes('networkerror');
    return (
      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 p-5 text-sm text-amber-700">
        <p className="font-semibold">
          {isNetwork ? 'Sem conexão com o banco de dados' : 'Erro ao carregar indicadores'}
        </p>
        <p className="mt-1 text-xs opacity-80">
          {isNetwork
            ? 'Não foi possível carregar seus dados. Verifique a conexão e recarregue a página.'
            : error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card rounded-2xl border-dashed p-6">
        <p className="text-sm font-semibold text-slate-900">
          Nenhum dado disponível no dashboard.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Faça upload de uma planilha para liberar os indicadores e os relatórios analíticos.
        </p>
      </div>
    );
  }

  if (summaries.length > 1) {
    return (
      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-950">Comparativo dos anos selecionados</h2>
          <p className="mt-1 text-xs text-slate-600">
            Indicadores calculados separadamente para preservar a leitura de cada período.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-5 py-3">Ano</th>
                <th className="px-5 py-3">Faturado</th>
                <th className="px-5 py-3">Pedidos</th>
                <th className="px-5 py-3">Clientes</th>
                <th className="px-5 py-3">Produtos</th>
                <th className="px-5 py-3">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ year, summary }) => (
                <tr key={year} className="border-t border-slate-100">
                  <th scope="row" className="px-5 py-3 text-left font-bold text-indigo-600">{year}</th>
                  <td className="px-5 py-3 font-semibold">{fmtBRL(summary?.total_faturado)}</td>
                  <td className="px-5 py-3">{fmt(summary?.total_pedidos)}</td>
                  <td className="px-5 py-3">{fmt(summary?.num_clientes)}</td>
                  <td className="px-5 py-3">{fmt(summary?.num_produtos)}</td>
                  <td className="px-5 py-3">{fmt(summary?.total_unidades)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      <KPICard
        title="Total Pedidos"
        variant="indigo"
        icon={ShoppingCart}
        value={fmt(data.total_pedidos)}
      />
      <KPICard
        title="Faturado"
        variant="emerald"
        icon={TrendingUp}
        value={fmtBRL(data.total_faturado)}
      />
      <KPICard
        title="Clientes"
        variant="blue"
        icon={Users}
        value={fmt(data.num_clientes)}
      />
      <KPICard
        title="Produtos"
        variant="amber"
        icon={Package}
        value={fmt(data.num_produtos)}
      />
      <KPICard
        title="Unidades"
        variant="rose"
        icon={Layers}
        value={fmt(data.total_unidades)}
      />
      <KPICard
        title="Período"
        icon={Calendar}
        value={getPeriodValue(data.data_inicio, data.data_fim)}
        sub={getPeriodRange(data.data_inicio, data.data_fim)}
      />
    </div>
  );
}

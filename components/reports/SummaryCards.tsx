'use client';

import { useEffect, useState } from 'react';
import {
  type LucideIcon,
  ArrowUpRight,
  Calendar,
  Layers,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardSummary } from '@/lib/reportQueries';
import { useFilterStore } from '@/store/filterStore';
import type { DashboardSummary } from '@/types/sales';

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
    default: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };

  return (
    <div className="glass-card rounded-2xl p-5 group transition-all duration-300 hover:translate-y-[-4px]">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${variants[variant]} transition-colors group-hover:bg-opacity-20`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight size={14} />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          {title}
        </h3>
        <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        {sub && (
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-tighter">
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
      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl mb-4" />
      <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-full mb-2" />
      <div className="h-6 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
    </div>
  );
}

export function SummaryCards() {
  const { selectedYear, selectedClient, selectedProduct, selectedSemester, selectedRevenueType } = useFilterStore();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getDashboardSummary(selectedYear ?? undefined, selectedClient ?? undefined, selectedProduct ?? undefined, selectedSemester ?? undefined, selectedRevenueType ?? undefined)
      .then((summary) => {
        if (active) {
          setData(summary);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar o resumo.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedYear, selectedClient, selectedProduct, selectedSemester, selectedRevenueType]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => <KPICardSkeleton key={index} />)}
      </div>
    );
  }

  if (error) {
    const isNetwork = error.toLowerCase().includes('failed to fetch') || error.toLowerCase().includes('networkerror');
    return (
      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/10 dark:border-amber-800/40 p-5 text-sm text-amber-700 dark:text-amber-400">
        <p className="font-semibold">
          {isNetwork ? 'Sem conexão com o banco de dados' : 'Erro ao carregar indicadores'}
        </p>
        <p className="mt-1 text-xs opacity-80">
          {isNetwork
            ? 'Não foi possível ler os dados do Supabase. Verifique a conexão e recarregue a página.'
            : error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card rounded-2xl border-dashed p-6">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Nenhum dado disponível no dashboard.
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Faça upload de uma planilha para liberar os indicadores e os relatórios analíticos.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
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

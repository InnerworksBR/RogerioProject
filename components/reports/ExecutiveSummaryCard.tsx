'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilterStore } from '@/store/filterStore';
import type { AIReportSummaryResponse } from '@/types/ai';

export function ExecutiveSummaryCard() {
  const { selectedYear, selectedClient, selectedClientName } = useFilterStore();
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIReportSummaryResponse | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setExpanded(true);
  }, [selectedYear, selectedClient]);

  const generateSummary = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/report-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          codCliente: selectedClient,
          scope: selectedClient ? 'client' : 'global',
        }),
      });
      const json = (await response.json().catch(() => null)) as
          | AIReportSummaryResponse
          | { error?: string }
          | null;
      if (!response.ok) {
        throw new Error(json && 'error' in json ? json.error ?? 'Erro na IA.' : 'Erro na IA.');
      }
      setData(json as AIReportSummaryResponse);
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : 'Não foi possível gerar o resumo executivo.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedClient]);

  if (data?.reason === 'missing_api_key') {
    return null;
  }

  if (loading) {
    return (
      <div className="glass-card rounded-[2rem] p-6">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Gerando resumo executivo com IA...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
        <span>Não foi possível gerar o resumo executivo: {error}</span>
        <Button type="button" variant="outline" onClick={generateSummary}>Tentar novamente</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card flex flex-col gap-4 rounded-[2rem] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
            <Sparkles className="size-4 text-indigo-500" /> Resumo executivo com IA
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gerado somente quando solicitado para evitar consultas e consumo desnecessários.</p>
        </div>
        <Button type="button" onClick={generateSummary} disabled={!selectedYear} className="rounded-xl">
          <Sparkles className="mr-2 size-4" /> Gerar resumo executivo
        </Button>
      </div>
    );
  }

  if (!data?.available) {
    if (data?.reason === 'no_data') {
      return (
        <div className="glass-card rounded-[2rem] p-6 text-sm text-slate-500 dark:text-slate-400">
          Não há dados suficientes no filtro atual para gerar um resumo executivo.
        </div>
      );
    }

    return null;
  }

  const summary = data.summary;

  if (!summary) {
    return null;
  }

  return (
    <div className="glass-card rounded-[2rem] p-6 shadow-xl shadow-indigo-500/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
            <Sparkles className="size-3.5" />
            Resumo Executivo com IA
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {selectedClientName
                ? `Leitura rápida de ${selectedClientName}`
                : 'Leitura rápida do período selecionado'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {summary.headline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {data.generatedAt && (
            <p className="hidden text-xs text-slate-400 dark:text-slate-500 sm:block">
              Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                Recolher <ChevronUp className="ml-2 size-4" />
              </>
            ) : (
              <>
                Expandir <ChevronDown className="ml-2 size-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <SummaryList
            title="Destaques"
            icon={TrendingUp}
            accent="text-emerald-600 dark:text-emerald-400"
            items={summary.highlights}
          />
          <SummaryList
            title="Riscos"
            icon={AlertTriangle}
            accent="text-rose-600 dark:text-rose-400"
            items={summary.risks}
          />
          <SummaryList
            title="Próximas ações"
            icon={Target}
            accent="text-indigo-600 dark:text-indigo-400"
            items={[...summary.opportunities, ...summary.recommended_actions].slice(0, 5)}
          />
        </div>
      )}
    </div>
  );
}

function SummaryList({
  title,
  icon: Icon,
  accent,
  items,
}: {
  title: string;
  icon: typeof TrendingUp;
  accent: string;
  items: string[];
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/70 p-5 dark:border-slate-800/70 dark:bg-slate-950/30">
      <div className={`mb-4 flex items-center gap-2 text-sm font-bold ${accent}`}>
        <Icon className="size-4" />
        {title}
      </div>
      <ul className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 size-1.5 rounded-full bg-current opacity-70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

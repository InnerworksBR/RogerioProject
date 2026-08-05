'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';
import { SummaryCards } from '@/components/reports/SummaryCards';
import { ExecutiveSummaryCard } from '@/components/reports/ExecutiveSummaryCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Download,
  Loader2,
  TrendingUp,
  ShoppingCart,
  Layers,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
import { useFilterStore } from '@/store/filterStore';
import { exportAllReports } from '@/lib/exportXlsx';
import { fetchReportExport, reportQueryKeys, useReportQuery, useReportsBootstrap } from '@/lib/client/reportApi';
import { DEFAULT_UI_ROW_LIMIT, MAX_EXPORT_ROW_LIMIT, type ParsedReportRequest, type ReportType } from '@/types/reportApi';
import type { BaseDeCompraRow, ConfigReportRow, GeralRow, TabelaDinamicaRow } from '@/types/sales';

import { TabelaDinamicaView } from '@/components/reports/views/TabelaDinamicaView';
import { BaseCompraView } from '@/components/reports/views/BaseCompraView';
import { BaseItensView } from '@/components/reports/views/BaseItensView';
import { BagagitosView } from '@/components/reports/views/BagagitosView';
import { GeralView } from '@/components/reports/views/GeralView';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [activeReport, setActiveReport] = useState<ReportType>('tabela_dinamica');
  const {
    selectedYear,
    selectedYears,
    selectedClient,
    selectedProduct,
    selectedSemester,
    selectedRevenueType,
    setYears,
    setAvailableYears,
  } = useFilterStore();

  const bootstrapRequest = useMemo<ParsedReportRequest>(() => ({
    report: 'tabela_dinamica',
    year: null,
    years: [],
    client: null,
    product: null,
    semester: null,
    revenueType: null,
    limit: DEFAULT_UI_ROW_LIMIT,
  }), []);
  const bootstrap = useReportsBootstrap(bootstrapRequest);

  useEffect(() => {
    if (!bootstrap.data) return;
    setAvailableYears(bootstrap.data.years);
    if (selectedYears.length === 0 && bootstrap.data.selectedYears.length > 0) {
      const seededRequest = {
        ...bootstrapRequest,
        year: bootstrap.data.selectedYear,
        years: bootstrap.data.selectedYears,
      };
      queryClient.setQueryData(reportQueryKeys.query(seededRequest), {
        ...bootstrap.data.initialReport,
        requestId: bootstrap.data.requestId,
        summary: bootstrap.data.summary,
        summaries: bootstrap.data.summaries,
      });
      setYears(bootstrap.data.selectedYears);
    }
  }, [bootstrap.data, bootstrapRequest, queryClient, selectedYears.length, setAvailableYears, setYears]);

  const reportRequest = useMemo<ParsedReportRequest>(() => ({
    report: activeReport,
    year: selectedYear,
    years: selectedYears,
    client: selectedClient,
    product: selectedProduct,
    semester: selectedSemester,
    revenueType: selectedRevenueType,
    limit: DEFAULT_UI_ROW_LIMIT,
  }), [activeReport, selectedYear, selectedYears, selectedClient, selectedProduct, selectedSemester, selectedRevenueType]);
  const reportQuery = useReportQuery(reportRequest, bootstrap.isSuccess && selectedYears.length > 0);
  const queryError = reportQuery.error instanceof Error
    ? reportQuery.error.message
    : bootstrap.error instanceof Error
      ? bootstrap.error.message
      : null;
  const rows = reportQuery.data?.rows ?? [];
  const loading = bootstrap.isPending || (selectedYears.length > 0 && (reportQuery.isPending || reportQuery.isFetching));
  const truncated = reportQuery.data?.truncated ?? false;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="relative flex flex-col gap-6 overflow-hidden rounded-[2rem] bg-slate-900 p-6 text-white shadow-2xl shadow-indigo-500/20 dark:bg-slate-900/50 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -ml-32 -mb-32" />

        <div className="relative z-10">
          <h1 className="text-4xl font-black tracking-tight mb-2">Relatórios <span className="text-indigo-400">Analíticos</span></h1>
          <p className="text-slate-400 max-w-md font-medium">
            Explore os dados comerciais da Plastiron com filtros avançados e exportação consolidada para Excel.
          </p>
        </div>
        <div className="relative z-10">
          <DownloadAllButton />
        </div>
      </div>

      {/* Global filters */}
      <ReportFilterBar
        initialClients={bootstrap.data?.clients ?? []}
        initialProducts={bootstrap.data?.products ?? []}
        revenueTypes={bootstrap.data?.revenueTypes ?? []}
        error={bootstrap.error instanceof Error ? bootstrap.error.message : null}
      />

      {/* KPI cards */}
      <SummaryCards
        data={selectedYear ? reportQuery.data?.summary ?? bootstrap.data?.summary ?? null : null}
        summaries={reportQuery.data?.summaries ?? bootstrap.data?.summaries ?? []}
        loading={loading}
        error={queryError}
      />
      <ExecutiveSummaryCard />

      {/* Tabs Layout */}
      <div className="glass-card rounded-[2rem] p-6 lg:p-8">
        <Tabs value={activeReport.replace('_', '-')} onValueChange={(value) => setActiveReport(value.replace('-', '_') as ReportType)} className="w-full">
          <TabsList className="flex overflow-x-auto w-full bg-[#030712]/50 border border-white/5 p-1.5 rounded-2xl mb-8 space-x-1 custom-scrollbar">
            <TabsTrigger value="tabela-dinamica" className="whitespace-nowrap rounded-xl font-semibold py-3 px-6 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm transition-all">
              <TrendingUp className="mr-2 h-4 w-4" />
              Tabela Dinâmica
            </TabsTrigger>
            <TabsTrigger value="base-compra" className="whitespace-nowrap rounded-xl font-semibold py-3 px-6 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300 data-[state=active]:shadow-sm transition-all">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Base de Compra
            </TabsTrigger>
            <TabsTrigger value="base-itens" className="whitespace-nowrap rounded-xl font-semibold py-3 px-6 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-sm transition-all">
              <Layers className="mr-2 h-4 w-4" />
              Base de Itens
            </TabsTrigger>
            <TabsTrigger value="bagagitos" className="whitespace-nowrap rounded-xl font-semibold py-3 px-6 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm transition-all">
              <Package className="mr-2 h-4 w-4" />
              Bagagitos
            </TabsTrigger>
            <TabsTrigger value="geral" className="whitespace-nowrap rounded-xl font-semibold py-3 px-6 data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300 data-[state=active]:shadow-sm transition-all">
              <TrendingUp className="mr-2 h-4 w-4" />
              Visão Geral
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tabela-dinamica" className="mt-0 outline-none">
            <TabelaDinamicaView rows={rows as TabelaDinamicaRow[]} loading={loading} error={queryError} truncated={truncated} />
          </TabsContent>
          <TabsContent value="base-compra" className="mt-0 outline-none">
            <BaseCompraView rows={rows as BaseDeCompraRow[]} loading={loading} error={queryError} truncated={truncated} />
          </TabsContent>
          <TabsContent value="base-itens" className="mt-0 outline-none">
            <BaseItensView rows={rows as ConfigReportRow[]} loading={loading} error={queryError} truncated={truncated} />
          </TabsContent>
          <TabsContent value="bagagitos" className="mt-0 outline-none">
            <BagagitosView rows={rows as ConfigReportRow[]} loading={loading} error={queryError} truncated={truncated} />
          </TabsContent>
          <TabsContent value="geral" className="mt-0 outline-none">
            <GeralView rows={rows as GeralRow[]} loading={loading} error={queryError} truncated={truncated} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DownloadAllButton() {
  const [downloading, setDownloading] = useState(false);
  const { selectedYear, selectedYears, selectedClient, selectedClientName, selectedProduct, selectedSemester, selectedRevenueType } = useFilterStore();

  const handleDownloadAll = async () => {
    if (!selectedYear) {
      toast.error('Selecione um ano nos filtros antes de baixar');
      return;
    }

    setDownloading(true);
    try {
      toast.info('Preparando relatórios consolidados...');

      const baseRequest = {
        year: selectedYear,
        years: selectedYears,
        client: selectedClient,
        product: selectedProduct,
        semester: selectedSemester,
        revenueType: selectedRevenueType,
        limit: MAX_EXPORT_ROW_LIMIT,
      };
      const [td, bc, bi, bag, ger] = await Promise.all([
        fetchReportExport({ ...baseRequest, report: 'tabela_dinamica' }),
        fetchReportExport({ ...baseRequest, report: 'base_compra' }),
        fetchReportExport({ ...baseRequest, report: 'base_itens' }),
        fetchReportExport({ ...baseRequest, report: 'bagagitos' }),
        fetchReportExport({ ...baseRequest, report: 'geral' }),
      ]);

      await exportAllReports({
        tabelaDinamica: td.rows as TabelaDinamicaRow[],
        baseCompra: bc.rows as BaseDeCompraRow[],
        baseItens: bi.rows as ConfigReportRow[],
        bagagitos: bag.rows as ConfigReportRow[],
        geral: ger.rows as GeralRow[],
      }, selectedClientName ?? undefined);

      toast.success('Excel consolidado gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar relatório consolidado');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      onClick={handleDownloadAll}
      disabled={downloading || !selectedYear}
      className="premium-gradient rounded-xl px-6 h-12 font-bold transition-all hover:scale-105 active:scale-95 text-white border-0"
    >
      {downloading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Gerando Planilha...
        </>
      ) : (
        <>
          <Download className="mr-2 h-5 w-5" />
          Baixar Tudo Analítico (.xlsx)
        </>
      )}
    </Button>
  );
}

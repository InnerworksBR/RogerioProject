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
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Análise de vendas</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Relatórios</h1>
          <p className="mt-2 max-w-xl text-base text-slate-600">
            Escolha o período, explore os resultados e baixe as planilhas em Excel.
          </p>
        </div>
        <div className="relative z-10">
          <DownloadAllButton />
        </div>
      </header>

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
      <div className="glass-card min-w-0 rounded-2xl p-4 sm:p-6">
        <Tabs value={activeReport.replace('_', '-')} onValueChange={(value) => setActiveReport(value.replace('-', '_') as ReportType)} className="w-full">
          <TabsList aria-label="Tipo de relatório" className="!h-auto flex w-full justify-start gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 mb-4 custom-scrollbar">
            <TabsTrigger value="tabela-dinamica" className="h-11 flex-none rounded-lg px-4 data-active:bg-white data-active:text-indigo-700 data-active:shadow-sm">
              <TrendingUp className="mr-2 h-4 w-4" />
              Tabela Dinâmica
            </TabsTrigger>
            <TabsTrigger value="base-compra" className="h-11 flex-none rounded-lg px-4 data-active:bg-white data-active:text-indigo-700 data-active:shadow-sm">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Base de Compra
            </TabsTrigger>
            <TabsTrigger value="base-itens" className="h-11 flex-none rounded-lg px-4 data-active:bg-white data-active:text-indigo-700 data-active:shadow-sm">
              <Layers className="mr-2 h-4 w-4" />
              Base de Itens
            </TabsTrigger>
            <TabsTrigger value="bagagitos" className="h-11 flex-none rounded-lg px-4 data-active:bg-white data-active:text-indigo-700 data-active:shadow-sm">
              <Package className="mr-2 h-4 w-4" />
              Bagagitos
            </TabsTrigger>
            <TabsTrigger value="geral" className="h-11 flex-none rounded-lg px-4 data-active:bg-white data-active:text-indigo-700 data-active:shadow-sm">
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
      className="premium-gradient h-11 w-full rounded-lg px-4 font-medium sm:w-auto"
    >
      {downloading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Gerando Planilha...
        </>
      ) : (
        <>
          <Download className="mr-2 h-5 w-5" />
          Baixar todos em Excel
        </>
      )}
    </Button>
  );
}

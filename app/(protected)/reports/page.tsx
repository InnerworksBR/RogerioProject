'use client';

import { useState } from 'react';
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
import { 
  getTabelaDinamica, 
  getBaseDeCompra, 
  getBaseDeItens, 
  getBagagitos, 
  getGeral 
} from '@/lib/reportQueries';
import { exportAllReports } from '@/lib/exportXlsx';

import { TabelaDinamicaView } from '@/components/reports/views/TabelaDinamicaView';
import { BaseCompraView } from '@/components/reports/views/BaseCompraView';
import { BaseItensView } from '@/components/reports/views/BaseItensView';
import { BagagitosView } from '@/components/reports/views/BagagitosView';
import { GeralView } from '@/components/reports/views/GeralView';

export default function ReportsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-slate-900 dark:bg-slate-900/50 p-8 rounded-[2rem] text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
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
      <ReportFilterBar />

      {/* KPI cards */}
      <SummaryCards />
      <ExecutiveSummaryCard />

      {/* Tabs Layout */}
      <div className="glass-card rounded-[2rem] p-6 lg:p-8">
        <Tabs defaultValue="tabela-dinamica" className="w-full">
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
            <TabelaDinamicaView />
          </TabsContent>
          <TabsContent value="base-compra" className="mt-0 outline-none">
            <BaseCompraView />
          </TabsContent>
          <TabsContent value="base-itens" className="mt-0 outline-none">
            <BaseItensView />
          </TabsContent>
          <TabsContent value="bagagitos" className="mt-0 outline-none">
            <BagagitosView />
          </TabsContent>
          <TabsContent value="geral" className="mt-0 outline-none">
            <GeralView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DownloadAllButton() {
  const [downloading, setDownloading] = useState(false);
  const { selectedYear, selectedClient, selectedClientName, selectedProduct, selectedSemester, selectedRevenueType, availableYears } = useFilterStore();
  const yearsForConfigReports = availableYears.length > 0
    ? availableYears
    : selectedYear
      ? [selectedYear]
      : [];

  const handleDownloadAll = async () => {
    if (!selectedYear) {
      toast.error('Selecione um ano nos filtros antes de baixar');
      return;
    }

    setDownloading(true);
    try {
      toast.info('Preparando relatórios consolidados...');
      
      const [td, bc, bi, bag, ger] = await Promise.all([
        getTabelaDinamica(selectedYear, selectedClient ?? undefined, selectedProduct ?? undefined, selectedSemester ?? undefined, selectedRevenueType ?? undefined),
        getBaseDeCompra(selectedYear, selectedClient ?? undefined, selectedProduct ?? undefined, selectedSemester ?? undefined, selectedRevenueType ?? undefined),
        getBaseDeItens(yearsForConfigReports, selectedClient ?? undefined, selectedProduct ?? undefined, selectedSemester ?? undefined, selectedRevenueType ?? undefined),
        getBagagitos(yearsForConfigReports, selectedClient ?? undefined, selectedProduct ?? undefined, selectedSemester ?? undefined, selectedRevenueType ?? undefined),
        getGeral(selectedYear, selectedClient ?? undefined, selectedProduct ?? undefined, selectedSemester ?? undefined, selectedRevenueType ?? undefined),
      ]);

      await exportAllReports({
        tabelaDinamica: td,
        baseCompra: bc,
        baseItens: bi,
        bagagitos: bag,
        geral: ger,
      }, selectedClientName ?? undefined);

      toast.success('Excel consolidado gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório consolidado');
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

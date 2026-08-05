'use client';

import { useEffect, useState } from 'react';
import { Filter, X, Calendar as CalendarIcon, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { useReportOptions } from '@/lib/client/reportApi';
import { useFilterStore } from '@/store/filterStore';
import type { ReportOption } from '@/types/reportApi';
import { MAX_COMPARISON_YEARS } from '@/types/reportApi';
import { toast } from 'sonner';

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debouncedValue;
}

export function ReportFilterBar({
  initialClients,
  initialProducts,
  revenueTypes,
  error,
}: {
  initialClients: ReportOption[];
  initialProducts: ReportOption[];
  revenueTypes: string[];
  error?: string | null;
}) {
  const {
    selectedYears,
    selectedClient,
    selectedClientName,
    selectedProduct,
    selectedSemester,
    selectedRevenueType,
    setYears,
    setClient,
    setProduct,
    setSemester,
    setRevenueType,
    clearFilters,
    availableYears,
  } = useFilterStore();
  const [clientQuery, setClientQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const deferredClientQuery = useDebouncedValue(clientQuery, 300);
  const deferredProductQuery = useDebouncedValue(productQuery, 300);
  const clientsQuery = useReportOptions('clients', deferredClientQuery, 40, deferredClientQuery.trim().length > 0);
  const productsQuery = useReportOptions('products', deferredProductQuery, 40, deferredProductQuery.trim().length > 0);
  const clients = clientsQuery.data?.options ?? initialClients;
  const products = productsQuery.data?.options ?? initialProducts;

  return (
    <div className="glass rounded-2xl p-6 shadow-xl shadow-indigo-500/5 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex flex-wrap gap-6 items-end">
        <div className="space-y-2">
          <label htmlFor="filter-semester" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Semestre</label>
          <Select value={selectedSemester?.toString() ?? 'all'} onValueChange={(value) => setSemester(value === 'all' ? null : Number(value) as 1 | 2)}>
            <SelectTrigger id="filter-semester" aria-label="Semestre" className="w-36 rounded-xl h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano inteiro</SelectItem>
              <SelectItem value="1">1o semestre</SelectItem>
              <SelectItem value="2">2o semestre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor="filter-revenue-type" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Tipo de receita</label>
          <Select value={selectedRevenueType ?? 'all'} onValueChange={(value) => setRevenueType(value === 'all' ? null : value)}>
            <SelectTrigger id="filter-revenue-type" aria-label="Tipo de receita" className="w-48 rounded-xl h-11"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {revenueTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <span id="filter-years-label" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            <CalendarIcon size={12} /> Anos para comparar
          </span>
          <div className="flex min-h-11 flex-wrap items-center gap-1.5" role="group" aria-labelledby="filter-years-label">
            {availableYears.map((year) => {
              const active = selectedYears.includes(year);
              return (
                <Button
                  key={year}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  aria-pressed={active}
                  onClick={() => {
                    if (active && selectedYears.length === 1) {
                      toast.info('Mantenha ao menos um ano selecionado.');
                      return;
                    }
                    if (!active && selectedYears.length >= MAX_COMPARISON_YEARS) {
                      toast.info(`Compare no máximo ${MAX_COMPARISON_YEARS} anos por vez.`);
                      return;
                    }
                    setYears(active
                      ? selectedYears.filter((item) => item !== year)
                      : [...selectedYears, year]);
                  }}
                  className="h-9 rounded-xl px-3"
                >
                  {year}
                </Button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400">Selecione de 1 a {MAX_COMPARISON_YEARS} anos.</p>
        </div>

        <div className="space-y-2 flex-1 min-w-[280px]">
          <label htmlFor="filter-client" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            <UserIcon size={12} /> Cliente / Parceiro
          </label>
          <Combobox
            aria-label="Cliente / Parceiro"
            placeholder="Pesquisar cliente..."
            items={clients}
            value={selectedClient}
            onInputChange={setClientQuery}
            onValueChange={(value) => {
              const client = clients.find((item) => item.value === value);
              setClient(value || null, client?.label ?? null);
            }}
            emptyMessage={clientsQuery.isFetching ? 'Buscando clientes...' : 'Nenhum cliente encontrado.'}
            inputGroupClassName="bg-white/50 dark:bg-slate-800/50 border-white/50 dark:border-slate-700/50"
            inputClassName="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-2 min-w-[220px]">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            <Filter size={12} /> Filtro de Produto
          </label>
          <Combobox
            aria-label="Filtro de Produto"
            placeholder="Buscar por código ou descrição..."
            items={products as ComboboxItem[]}
            value={selectedProduct ?? null}
            onInputChange={setProductQuery}
            onValueChange={(cod) => setProduct(cod || null)}
            emptyMessage={productsQuery.isFetching ? 'Buscando produtos...' : 'Nenhum produto encontrado.'}
            inputGroupClassName="bg-white/50 dark:bg-slate-800/50 border-white/50 dark:border-slate-700/50"
            inputClassName="h-11 rounded-xl"
          />
        </div>

        {(selectedClient || selectedProduct || selectedSemester || selectedRevenueType) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 px-4 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
            onClick={() => {
              clearFilters();
            }}
          >
            <X size={16} className="mr-2" /> Limpar
          </Button>
        )}
      </div>

      {selectedClientName && (
        <div className="mt-4 inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-full border border-indigo-500/20 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Exibindo:</span>
          <span className="text-sm font-bold">{selectedClientName}</span>
        </div>
      )}

      {(selectedSemester || selectedRevenueType || selectedProduct) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedSemester && <Button variant="outline" size="sm" onClick={() => setSemester(null)}>Semestre: {selectedSemester} <X size={12} className="ml-2" /></Button>}
          {selectedRevenueType && <Button variant="outline" size="sm" onClick={() => setRevenueType(null)}>Receita: {selectedRevenueType} <X size={12} className="ml-2" /></Button>}
          {selectedProduct && <Button variant="outline" size="sm" onClick={() => setProduct(null)}>Produto: {selectedProduct} <X size={12} className="ml-2" /></Button>}
        </div>
      )}

      {error && (
        <p className="mt-4 text-xs font-medium text-amber-600 dark:text-amber-400">
          Não foi possível carregar os filtros automaticamente: {error}
        </p>
      )}
    </div>
  );
}

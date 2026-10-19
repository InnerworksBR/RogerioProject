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
  warnings = [],
  onRetry,
}: {
  initialClients: ReportOption[];
  initialProducts: ReportOption[];
  revenueTypes: string[];
  error?: string | null;
  warnings?: string[];
  onRetry?: () => void;
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
    <section aria-label="Filtros dos relatórios" className="glass rounded-2xl p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-semibold text-slate-900">Filtrar resultados</h2><p className="mt-1 text-sm text-slate-600">Os resultados se atualizam ao alterar os filtros. Compare até {MAX_COMPARISON_YEARS} anos.</p></div>
        <Button variant="ghost" size="sm" disabled={!selectedClient && !selectedProduct && !selectedSemester && !selectedRevenueType} onClick={() => { clearFilters(); setClientQuery(''); setProductQuery(''); }}><X className="size-4" /> Limpar filtros</Button>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <label htmlFor="filter-semester" className="text-sm font-medium text-slate-700">Semestre</label>
          <Select value={selectedSemester?.toString() ?? 'all'} onValueChange={(value) => setSemester(value === 'all' ? null : Number(value) as 1 | 2)}>
            <SelectTrigger id="filter-semester" aria-label="Semestre" className="w-full rounded-lg h-11"><SelectValue>{selectedSemester === 1 ? '1º semestre · jan–jun' : selectedSemester === 2 ? '2º semestre · jul–dez' : 'Ano inteiro'}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano inteiro</SelectItem>
              <SelectItem value="1">1º semestre · jan–jun</SelectItem>
              <SelectItem value="2">2º semestre · jul–dez</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor="filter-revenue-type" className="text-sm font-medium text-slate-700">Tipo de receita</label>
          <Select value={selectedRevenueType ?? 'all'} onValueChange={(value) => setRevenueType(value === 'all' ? null : value)}>
            <SelectTrigger id="filter-revenue-type" aria-label="Tipo de receita" className="w-full rounded-lg h-11"><SelectValue>{selectedRevenueType ?? 'Todas as receitas'}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {revenueTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <span id="filter-years-label" className="flex items-center gap-2 text-sm font-medium text-slate-700">
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
          <p className="text-xs text-slate-600">Selecione de 1 a {MAX_COMPARISON_YEARS} anos.</p>
        </div>

        <div className="min-w-0 space-y-2 lg:col-span-2">
          <label htmlFor="filter-client" className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <UserIcon size={14} /> Cliente
          </label>
          <Combobox
            id="filter-client"
            aria-label="Cliente"
            placeholder="Todos os clientes · pesquisar..."
            items={clients.map((item) => item.value.startsWith('group:') ? { ...item, sublabel: 'Consolidado' } : item)}
            value={selectedClient}
            selectedLabel={selectedClientName}
            onInputChange={setClientQuery}
            onValueChange={(value) => {
              const client = clients.find((item) => item.value === value);
              setClient(value || null, client?.label ?? null);
            }}
            emptyMessage={clientsQuery.isFetching ? 'Buscando clientes...' : 'Nenhum cliente encontrado.'}
            inputGroupClassName="bg-white border-input"
            inputClassName="h-11 rounded-xl"
          />
        </div>

        <div className="min-w-0 space-y-2 lg:col-span-2">
          <label htmlFor="filter-product" className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Filter size={14} /> Produto
          </label>
          <Combobox
            id="filter-product"
            aria-label="Produto"
            placeholder="Todos os produtos · pesquisar código ou descrição..."
            items={products as ComboboxItem[]}
            value={selectedProduct ?? null}
            onInputChange={setProductQuery}
            onValueChange={(cod) => setProduct(cod || null)}
            emptyMessage={productsQuery.isFetching ? 'Buscando produtos...' : 'Nenhum produto encontrado.'}
            inputGroupClassName="bg-white border-input"
            inputClassName="h-11 rounded-xl"
          />
        </div>

      </div>

      {selectedClientName && (
        <Button variant="secondary" size="sm" className="mt-4 max-w-full" aria-label={`Remover filtro do cliente ${selectedClientName}`} onClick={() => setClient(null, null)}><span className="truncate">Cliente: {selectedClientName}</span><X className="size-4 shrink-0" /></Button>
      )}

      {(selectedSemester || selectedRevenueType || selectedProduct) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedSemester && <Button variant="outline" size="sm" onClick={() => setSemester(null)}>Semestre: {selectedSemester} <X size={12} className="ml-2" /></Button>}
          {selectedRevenueType && <Button variant="outline" size="sm" onClick={() => setRevenueType(null)}>Receita: {selectedRevenueType} <X size={12} className="ml-2" /></Button>}
          {selectedProduct && <Button variant="outline" size="sm" onClick={() => setProduct(null)}>Produto: {selectedProduct} <X size={12} className="ml-2" /></Button>}
        </div>
      )}

      {(error || warnings.length > 0 || clientsQuery.isError || productsQuery.isError) && (
        <div role="alert" className="mt-4 space-y-2 text-sm font-medium text-amber-700">
          {error && <p>Não foi possível carregar os filtros automaticamente: {error}</p>}
          {warnings.map((warning) => <p key={warning}>{warning}</p>)}
          {clientsQuery.isError && <p>Não foi possível pesquisar clientes. Tente digitar o nome novamente.</p>}
          {productsQuery.isError && <p>Não foi possível pesquisar produtos. Tente digitar o código ou descrição novamente.</p>}
          {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Tentar carregar os filtros novamente</Button>}
        </div>
      )}
    </section>
  );
}

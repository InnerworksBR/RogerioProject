'use client';

import { useEffect, useState } from 'react';
import { Filter, X, Calendar as CalendarIcon, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { getClients, getRevenueTypes, searchProducts } from '@/lib/reportQueries';
import { useFilterStore } from '@/store/filterStore';
import { useEnsureReportYears } from './useEnsureReportYears';

export function ReportFilterBar() {
  const {
    selectedYear,
    selectedClient,
    selectedClientName,
    selectedProduct,
    selectedSemester,
    selectedRevenueType,
    setYear,
    setClient,
    setProduct,
    setSemester,
    setRevenueType,
    clearFilters,
    availableYears,
  } = useFilterStore();
  const { yearsError } = useEnsureReportYears();

  const [clients, setClients] = useState<{ cod_cliente: string; nome_cliente: string }[]>([]);
  const [revenueTypes, setRevenueTypes] = useState<string[]>([]);
  const [products, setProducts] = useState<{ cod_referencia: string; descr_produto: string }[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productQuery, setProductQuery] = useState('');

  useEffect(() => {
    let active = true;

    getClients()
      .then((data) => {
        if (active) {
          setClients(data);
        }
      })
      .catch((error) => {
        console.error('Erro ao carregar clientes:', error);
        if (active) {
          setClients([]);
        }
      });
    getRevenueTypes().then((data) => active && setRevenueTypes(data)).catch(() => active && setRevenueTypes([]));

    return () => {
      active = false;
    };
  }, []);

  // Carregar produtos com debounce via searchProducts
  useEffect(() => {
    let active = true;
    setProductsLoading(true);

    const timer = setTimeout(() => {
      searchProducts(productQuery, 40)
        .then((data) => {
          if (active) {
            setProducts(data);
            setProductsLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setProducts([]);
            setProductsLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productQuery]);

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
          <label htmlFor="filter-year" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            <CalendarIcon size={12} /> Ano de Referência
          </label>
          <Select
            value={selectedYear?.toString() ?? 'all'}
            onValueChange={(value) => {
              if (!value || value === 'all') {
                setYear(null);
                return;
              }

              setYear(parseInt(value, 10));
            }}
          >
            <SelectTrigger id="filter-year" aria-label="Ano de Referência" className="w-36 bg-white/50 dark:bg-slate-800/50 border-white/50 dark:border-slate-700/50 rounded-xl h-11 focus:ring-indigo-500/20">
              <SelectValue placeholder="Selecione o ano" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-2xl">
              <SelectItem value="all" className="font-medium">Todos os anos</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()} className="font-medium">
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex-1 min-w-[280px]">
          <label htmlFor="filter-client" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            <UserIcon size={12} /> Cliente / Parceiro
          </label>
          <Select
            value={selectedClient ?? 'all'}
            onValueChange={(value) => {
              if (!value || value === 'all') {
                setClient(null, null);
                return;
              }

              const client = clients.find((item) => item.cod_cliente === value);
              setClient(value, client?.nome_cliente ?? null);
            }}
          >
            <SelectTrigger id="filter-client" aria-label="Cliente / Parceiro" className="w-full bg-white/50 dark:bg-slate-800/50 border-white/50 dark:border-slate-700/50 rounded-xl h-11 focus:ring-indigo-500/20">
              <SelectValue placeholder="Pesquisar cliente..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] rounded-xl border-slate-200 dark:border-slate-800 shadow-2xl">
              <SelectItem value="all" className="font-medium">Todos os clientes</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.cod_cliente} value={client.cod_cliente} className="font-medium">
                  {client.nome_cliente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 min-w-[220px]">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            <Filter size={12} /> Filtro de Produto
          </label>
          <Combobox
            aria-label="Filtro de Produto"
            placeholder="Buscar por código ou descrição..."
            items={products.map((p): ComboboxItem => ({
              value: p.cod_referencia,
              label: p.descr_produto || p.cod_referencia,
              sublabel: p.cod_referencia,
            }))}
            value={selectedProduct ?? null}
            onInputChange={setProductQuery}
            onValueChange={(cod) => setProduct(cod || null)}
            emptyMessage={productsLoading ? 'Buscando produtos...' : 'Nenhum produto encontrado.'}
            inputGroupClassName="bg-white/50 dark:bg-slate-800/50 border-white/50 dark:border-slate-700/50"
            inputClassName="h-11 rounded-xl"
          />
        </div>

        {(selectedYear || selectedClient || selectedProduct || selectedSemester || selectedRevenueType) && (
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

      {yearsError && (
        <p className="mt-4 text-xs font-medium text-amber-600 dark:text-amber-400">
          Não foi possível carregar os anos automaticamente: {yearsError}
        </p>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getAvailableYears } from '@/lib/reportQueries';
import { useFilterStore } from '@/store/filterStore';

export function useEnsureReportYears() {
  const { availableYears, selectedYear, setAvailableYears, setYear } = useFilterStore();
  const [loadingYears, setLoadingYears] = useState(availableYears.length === 0);
  const [yearsError, setYearsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadYears() {
      // Rebusca sempre ao montar a tela para refletir uploads feitos na mesma
      // sessão (a lista fica em memória e não recarregava sozinha). Só mostra o
      // spinner quando não há nada em cache — assim a lista já carregada não pisca.
      if (useFilterStore.getState().availableYears.length === 0) {
        setLoadingYears(true);
      }
      setYearsError(null);

      try {
        const years = await getAvailableYears();
        if (!active) return;

        setAvailableYears(years);

        // Preserva o ano selecionado se ainda existir; senão, cai no mais recente.
        const current = useFilterStore.getState().selectedYear;
        if (years.length > 0) {
          if (!current || !years.includes(current)) {
            setYear(years[years.length - 1]);
          }
        } else {
          setYear(null);
        }
      } catch (error) {
        if (!active) return;
        const msg = error instanceof Error ? error.message : String(error);
        setYearsError(
          msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')
            ? 'Sem conexão com o banco de dados. Verifique a conexão e recarregue a página.'
            : msg
        );
      } finally {
        if (active) {
          setLoadingYears(false);
        }
      }
    }

    void loadYears();

    return () => {
      active = false;
    };
    // Setters do zustand são estáveis: o efeito roda uma vez por montagem da tela.
  }, [setAvailableYears, setYear]);

  return {
    availableYears,
    selectedYear,
    loadingYears,
    yearsError,
  };
}

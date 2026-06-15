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

    if (availableYears.length > 0) {
      if (!selectedYear || !availableYears.includes(selectedYear)) {
        setYear(availableYears[availableYears.length - 1] ?? null);
      }
      setLoadingYears(false);
      return () => {
        active = false;
      };
    }

    async function loadYears() {
      setLoadingYears(true);
      setYearsError(null);

      try {
        const years = await getAvailableYears();
        if (!active) return;

        setAvailableYears(years);

        if (years.length > 0) {
          setYear(years[years.length - 1]);
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
  }, [availableYears, selectedYear, setAvailableYears, setYear]);

  return {
    availableYears,
    selectedYear,
    loadingYears,
    yearsError,
  };
}

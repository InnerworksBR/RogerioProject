'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExportButton } from '@/components/reports/ExportButton';
import { ReportTable } from '@/components/reports/ReportTable';
import { useEnsureReportYears } from '@/components/reports/useEnsureReportYears';
import { getBagagitos } from '@/lib/reportQueries';
import { useFilterStore } from '@/store/filterStore';
import type { ConfigReportRow } from '@/types/sales';

// Branqueia apenas quando valor for exatamente 0 ou nulo. Negativos (devoluções) são exibidos.
const fmt = (n: number | null | undefined) => (n != null && n !== 0 ? n.toLocaleString('pt-BR') : '');

export function BagagitosView() {
  const { availableYears, selectedClient, selectedProduct, selectedSemester, selectedRevenueType } = useFilterStore();
  const { loadingYears, yearsError } = useEnsureReportYears();
  const [data, setData] = useState<ConfigReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (availableYears.length === 0) {
      setData([]);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    getBagagitos(availableYears, selectedClient ?? undefined, selectedProduct ?? undefined, selectedSemester ?? undefined, selectedRevenueType ?? undefined)
      .then((rows) => {
        if (active) {
          setData(rows);
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar bagagitos.');
          setData([]);
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
  }, [availableYears, selectedClient, selectedProduct, selectedSemester, selectedRevenueType]);

  const columns = useMemo<ColumnDef<ConfigReportRow>[]>(() => {
    const baseCols: ColumnDef<ConfigReportRow>[] = [
      { header: 'EMB', accessorFn: (row) => row.extra_data?.emb || '', size: 60 },
      { header: 'Plastiron', accessorFn: (row) => row.extra_data?.plastiron || '', size: 100 },
      { header: 'Descrição', accessorKey: 'label', size: 300 },
      { header: 'Ano', accessorFn: (row) => row.extra_data?.ano_aplicacao || '', size: 60 },
      { header: 'Aplicação', accessorFn: (row) => row.extra_data?.aplicacao || '', size: 150 },
      { header: 'Cor', accessorFn: (row) => row.extra_data?.cor || '', size: 80 },
      { header: 'Outros Dados', accessorFn: (row) => row.extra_data?.outros_dados || '', size: 120 },
    ];

    const yearCols: ColumnDef<ConfigReportRow>[] = availableYears.map((year) => ({
      header: year.toString(),
      accessorFn: (row) => row.totals_by_year[year.toString()] || 0,
      cell: (info) => fmt(info.getValue() as number),
      size: 90,
    }));

    return [...baseCols, ...yearCols];
  }, [availableYears]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">BAGAGITOS</h2>
          <p className="text-sm text-muted-foreground">Linha de Bagagitos com Totais Anuais</p>
        </div>
        <ExportButton
          reportType="bagagitos"
          data={data}
          filename="Autimex_Bagagitos.xlsx"
        />
      </div>

      {(yearsError || error) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          Erro ao carregar o relatório: {yearsError ?? error}
        </div>
      )}

      <ReportTable
        data={data}
        columns={columns}
        loading={loadingYears || loading}
        emptyMessage={
          availableYears.length > 0
            ? 'Nenhum bagagito configurado para este relatório. Cadastre os produtos em Configurações.'
            : yearsError
              ? 'Não foi possível carregar os anos disponíveis.'
              : 'Nenhum ano disponível. Faça upload de um arquivo para gerar o relatório.'
        }
        stickyColumns={3}
      />
    </div>
  );
}

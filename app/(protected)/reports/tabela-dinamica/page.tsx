'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ReportTable } from '@/components/reports/ReportTable';
import { ExportButton } from '@/components/reports/ExportButton';
import { useEnsureReportYears } from '@/components/reports/useEnsureReportYears';
import { getTabelaDinamica } from '@/lib/reportQueries';
import { useFilterStore } from '@/store/filterStore';
import type { TabelaDinamicaRow } from '@/types/sales';

// Branqueia apenas quando valor for exatamente 0 ou nulo. Negativos (devoluções) são exibidos.
const fmt = (n: number | null | undefined) => (n != null && n !== 0 ? n.toLocaleString('pt-BR') : '');
const fmtBRL = (n: number | null | undefined) =>
  n != null && n !== 0 ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';

export default function TabelaDinamicaPage() {
  const { selectedYear, selectedClient, selectedProduct } = useFilterStore();
  const { loadingYears, yearsError } = useEnsureReportYears();
  const [data, setData] = useState<TabelaDinamicaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!selectedYear) {
      setData([]);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    getTabelaDinamica(selectedYear, selectedClient ?? undefined, selectedProduct ?? undefined)
      .then((rows) => {
        if (active) {
          setData(rows);
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar a tabela dinâmica.');
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
  }, [selectedYear, selectedClient, selectedProduct]);

  const columns = useMemo<ColumnDef<TabelaDinamicaRow>[]>(() => [
    { header: 'Cód. Cliente', accessorKey: 'cod_cliente', size: 100 },
    { header: 'Cliente', accessorKey: 'nome_cliente', size: 250 },
    { header: 'Cód. Referência', accessorKey: 'cod_referencia', size: 120 },
    { header: 'Produto', accessorKey: 'descr_produto', size: 300 },
    { header: 'JAN', accessorKey: 'jan', cell: (info) => fmt(info.getValue() as number) },
    { header: 'FEV', accessorKey: 'fev', cell: (info) => fmt(info.getValue() as number) },
    { header: 'MAR', accessorKey: 'mar', cell: (info) => fmt(info.getValue() as number) },
    { header: 'ABR', accessorKey: 'abr', cell: (info) => fmt(info.getValue() as number) },
    { header: 'MAI', accessorKey: 'mai', cell: (info) => fmt(info.getValue() as number) },
    { header: 'JUN', accessorKey: 'jun', cell: (info) => fmt(info.getValue() as number) },
    { header: 'JUL', accessorKey: 'jul', cell: (info) => fmt(info.getValue() as number) },
    { header: 'AGO', accessorKey: 'ago', cell: (info) => fmt(info.getValue() as number) },
    { header: 'SET', accessorKey: 'set_', cell: (info) => fmt(info.getValue() as number) },
    { header: 'OUT', accessorKey: 'out_', cell: (info) => fmt(info.getValue() as number) },
    { header: 'NOV', accessorKey: 'nov', cell: (info) => fmt(info.getValue() as number) },
    { header: 'DEZ', accessorKey: 'dez', cell: (info) => fmt(info.getValue() as number) },
    { header: 'Total Ano', accessorKey: 'total_ano', cell: (info) => <strong>{fmt(info.getValue() as number)}</strong> },
    { header: 'Valor Total', accessorKey: 'total_valor', cell: (info) => fmtBRL(info.getValue() as number) },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Tabela Dinâmica Geral</h2>
          <p className="text-sm text-muted-foreground">
            Quantidade por Cliente × Produto × Mês {selectedYear ? `(${selectedYear})` : 'com seleção automática do último ano disponível'}
          </p>
        </div>
        <ExportButton
          reportType="tabela_dinamica"
          data={data}
          filename={`Plastiron_Tabela_Dinamica_${selectedYear}.xlsx`}
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
          selectedYear
            ? 'Nenhum dado disponível para os filtros selecionados.'
            : yearsError
              ? 'Não foi possível carregar os anos disponíveis.'
              : 'Nenhum ano disponível. Faça upload de um arquivo para gerar o relatório.'
        }
        stickyColumns={4}
      />
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExportButton } from '@/components/reports/ExportButton';
import { ReportTable } from '@/components/reports/ReportTable';
import { useEnsureReportYears } from '@/components/reports/useEnsureReportYears';
import { getGeral } from '@/lib/reportQueries';
import { useFilterStore } from '@/store/filterStore';

// Branqueia apenas quando valor for exatamente 0 ou nulo. Negativos (devoluções) são exibidos.
const fmt = (n: number | null | undefined) => (n != null && n !== 0 ? n.toLocaleString('pt-BR') : '');

export default function GeralPage() {
  const { selectedYear, selectedClient } = useFilterStore();
  const { loadingYears, yearsError } = useEnsureReportYears();
  const [data, setData] = useState<any[]>([]);
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

    getGeral(selectedYear, selectedClient ?? undefined)
      .then((rows) => {
        if (!active) return;

        const processed: any[] = [];
        let lastCat = '';

        rows.forEach((row) => {
          if (row.categoria !== lastCat) {
            processed.push({ isHeader: true, label: row.categoria });
            lastCat = row.categoria;
          }
          processed.push(row);
        });

        setData(processed);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar o relatório geral.');
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
  }, [selectedYear, selectedClient]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      header: 'Status',
      accessorFn: (row) => row.isHeader ? '' : row.extra_data?.status || '',
      size: 70,
      cell: (info) => info.row.original.isHeader ? null : info.getValue(),
    },
    { header: 'EMB', accessorFn: (row) => row.isHeader ? '' : row.extra_data?.emb || '', size: 60 },
    { header: 'Plastiron', accessorFn: (row) => row.isHeader ? '' : row.extra_data?.plastiron || '', size: 100 },
    {
      header: 'Descrição',
      accessorKey: 'label',
      size: 350,
      cell: (info) => {
        const row = info.row.original;
        if (row.isHeader) {
          return <span className="font-bold text-blue-600 dark:text-blue-400 uppercase">{row.label}</span>;
        }
        return info.getValue() as string;
      },
    },
    { header: 'Ano', accessorFn: (row) => row.isHeader ? '' : row.extra_data?.ano_aplicacao || '', size: 60 },
    { header: 'Aplicação', accessorFn: (row) => row.isHeader ? '' : row.extra_data?.aplicacao || '', size: 150 },
    { header: 'Cor', accessorFn: (row) => row.isHeader ? '' : row.extra_data?.cor || '', size: 80 },
    { header: 'Outros Dados', accessorFn: (row) => row.isHeader ? '' : row.extra_data?.outros_dados || '', size: 120 },
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
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">GERAL</h2>
          <p className="text-sm text-muted-foreground">
            Todos os Produtos por Categoria × Mês {selectedYear ? `(${selectedYear})` : 'com seleção automática do último ano disponível'}
          </p>
        </div>
        <ExportButton
          reportType="geral"
          data={data.filter((row) => !row.isHeader)}
          filename={`Autimex_Geral_${selectedYear}.xlsx`}
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
            ? 'Nenhum item configurado para o relatório geral ou nenhum dado encontrado para o ano selecionado.'
            : yearsError
              ? 'Não foi possível carregar os anos disponíveis.'
              : 'Nenhum ano disponível. Faça upload de um arquivo para gerar o relatório.'
        }
        stickyColumns={4}
      />
    </div>
  );
}

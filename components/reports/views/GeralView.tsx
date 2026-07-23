'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExportButton } from '@/components/reports/ExportButton';
import { ReportTable, type ColumnGroupHeader } from '@/components/reports/ReportTable';
import { useFilterStore } from '@/store/filterStore';
import type { ReportViewProps } from '@/types/reportApi';
import type { GeralRow } from '@/types/sales';

// Branqueia apenas quando valor for exatamente 0 ou nulo. Negativos (devoluções) são exibidos.
const fmt = (n: number | null | undefined) => (n != null && n !== 0 ? n.toLocaleString('pt-BR') : '');

export function GeralView({ rows, loading, error, truncated }: ReportViewProps<GeralRow>) {
  const { selectedYear } = useFilterStore();
  const data = useMemo<any[]>(() => {
    const processed: any[] = [];
    let lastCategory = '';
    rows.forEach((row) => {
      if (row.categoria !== lastCategory) {
        processed.push({ isHeader: true, label: row.categoria });
        lastCategory = row.categoria;
      }
      processed.push(row);
    });
    return processed;
  }, [rows]);

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

  // Cabeçalho de grupo: Ano sobre as 12 colunas de meses + Total Ano
  // Colunas 0-7: Status, EMB, Plastiron, Descrição, Ano, Aplicação, Cor, Outros Dados (sem grupo)
  // Colunas 8-20: JAN…DEZ + Total Ano (agrupadas sob o ano)
  const groupHeaders = useMemo<ColumnGroupHeader[]>(() => {
    if (!selectedYear) return [];
    return [{ label: String(selectedYear), span: 13, startIndex: 8 }];
  }, [selectedYear]);

  // Linha de totais: soma apenas linhas de dados (não as de cabeçalho de categoria)
  const getTotalsRow = useMemo(() => (rows: any[]) => {
    const dataRows = rows.filter((row) => !row.isHeader);
    const monthKeys = ['jan','fev','mar','abr','mai','jun','jul','ago','set_','out_','nov','dez','total_ano'];
    const sum = (key: string) =>
      dataRows.reduce((acc: number, row: any) => acc + (Number(row[key]) || 0), 0);

    return [
      '',      // Status
      '',      // EMB
      '',      // Plastiron
      'TOTAL', // Descrição
      '',      // Ano
      '',      // Aplicação
      '',      // Cor
      '',      // Outros Dados
      ...monthKeys.map((k) => fmt(sum(k))),
    ];
  }, []);

  return (
    <div className="space-y-4 pt-4">
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
          filename={`Plastiron_Geral_${selectedYear}.xlsx`}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          Erro ao carregar o relatório: {error}
        </div>
      )}

      {truncated && <p className="text-xs text-amber-500">Resultado limitado para proteger o banco. Refine os filtros ou exporte o relatório completo.</p>}

      <ReportTable
        data={data}
        columns={columns}
        loading={loading}
        emptyMessage={
          selectedYear
            ? 'Nenhum item configurado para o relatório geral ou nenhum dado encontrado para o ano selecionado.'
            : 'Nenhum ano disponível. Faça upload de um arquivo para gerar o relatório.'
        }
        stickyColumns={4}
        groupHeaders={groupHeaders}
        getTotalsRow={getTotalsRow}
      />
    </div>
  );
}

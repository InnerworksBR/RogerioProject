'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ReportTable } from '@/components/reports/ReportTable';
import { ExportButton } from '@/components/reports/ExportButton';
import { useFilterStore } from '@/store/filterStore';
import type { ReportViewProps } from '@/types/reportApi';
import type { TabelaDinamicaRow } from '@/types/sales';

// Branqueia apenas quando valor for exatamente 0 ou nulo. Negativos (devoluções) são exibidos.
const fmt = (n: number | null | undefined) => (n != null && n !== 0 ? n.toLocaleString('pt-BR') : '');
const fmtBRL = (n: number | null | undefined) =>
  n != null && n !== 0 ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';

export function TabelaDinamicaView({ rows: data, loading, error, truncated }: ReportViewProps<TabelaDinamicaRow>) {
  const { selectedYear, selectedYears } = useFilterStore();

  const columns = useMemo<ColumnDef<TabelaDinamicaRow>[]>(() => [
    { header: 'Ano', accessorKey: 'ano', size: 70 },
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

  // Cabeçalho de grupo: Ano sobre as 12 colunas de meses + Total Ano + Valor Total
  // Colunas 0-3: Cód. Cliente, Cliente, Cód. Referência, Produto (sem grupo)
  // Colunas 4-17: JAN…DEZ + Total Ano + Valor Total (agrupadas sob o ano)
  // Linha de totais: soma as colunas mensais, total_ano e total_valor
  const getTotalsRow = useMemo(() => (rows: TabelaDinamicaRow[]) => {
    const monthKeys: (keyof TabelaDinamicaRow)[] = ['jan','fev','mar','abr','mai','jun','jul','ago','set_','out_','nov','dez','total_ano'];
    const sum = (key: keyof TabelaDinamicaRow) =>
      rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);

    return [
      truncated ? 'TOTAL PARCIAL' : 'TOTAL',
      '',      // Ano
      '',      // Cliente
      '',      // Cód. Referência
      '',      // Produto
      ...monthKeys.map((k) => fmt(sum(k))),
      fmtBRL(sum('total_valor')),
    ];
  }, [truncated]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Tabela Dinâmica Geral</h2>
          <p className="text-sm text-muted-foreground">
            Quantidade por Cliente × Produto × Mês {selectedYears.length ? `(${selectedYears.join(', ')})` : 'com seleção automática do último ano disponível'}
          </p>
        </div>
        <ExportButton
          reportType="tabela_dinamica"
          data={data}
          filename={`Plastiron_Tabela_Dinamica_${selectedYears.join('-')}.xlsx`}
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
            ? 'Nenhum dado disponível para os filtros selecionados.'
            : 'Nenhum ano disponível. Faça upload de um arquivo para gerar o relatório.'
        }
        stickyColumns={5}
        getTotalsRow={getTotalsRow}
      />
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExportButton } from '@/components/reports/ExportButton';
import { ReportTable } from '@/components/reports/ReportTable';
import { useFilterStore } from '@/store/filterStore';
import type { ReportViewProps } from '@/types/reportApi';
import type { ConfigReportRow } from '@/types/sales';

// Branqueia apenas quando valor for exatamente 0 ou nulo. Negativos (devoluções) são exibidos.
const fmt = (n: number | null | undefined) => (n != null && n !== 0 ? n.toLocaleString('pt-BR') : '');

export function BaseItensView({ rows: data, loading, error, truncated }: ReportViewProps<ConfigReportRow>) {
  const { availableYears } = useFilterStore();

  const columns = useMemo<ColumnDef<ConfigReportRow>[]>(() => {
    const baseCols: ColumnDef<ConfigReportRow>[] = [
      { header: '#', accessorFn: (_, index) => index + 1, size: 50 },
      { header: 'DTS', accessorFn: (row) => row.extra_data?.dts || '', size: 80 },
      { header: 'R2A', accessorFn: (row) => row.extra_data?.r2a || '', size: 80 },
      { header: 'Lumax', accessorFn: (row) => row.extra_data?.lumax || '', size: 80 },
      { header: 'LOMA', accessorFn: (row) => row.extra_data?.loma || '', size: 80 },
      { header: 'Cód. Ref.', accessorKey: 'cod_referencia', size: 100 },
      { header: 'Descrição', accessorKey: 'label', size: 350 },
    ];

    const yearCols: ColumnDef<ConfigReportRow>[] = availableYears.map((year) => ({
      header: year.toString(),
      accessorFn: (row) => row.totals_by_year[year.toString()] || 0,
      cell: (info) => fmt(info.getValue() as number),
      size: 90,
    }));

    return [
      ...baseCols,
      ...yearCols,
      { header: 'Lançamento', accessorFn: (row) => row.extra_data?.lancamento || '', size: 150 },
    ];
  }, [availableYears]);

  // Linha de totais: soma as colunas de anos (índices 7..7+availableYears.length-1)
  const getTotalsRow = useMemo(() => (rows: ConfigReportRow[]) => {
    const yearTotals = availableYears.map((year) =>
      fmt(rows.reduce((acc, row) => acc + (Number(row.totals_by_year[year.toString()]) || 0), 0))
    );
    return [
      'TOTAL', // #
      '',      // DTS
      '',      // R2A
      '',      // Lumax
      '',      // LOMA
      '',      // Cód. Ref.
      '',      // Descrição
      ...yearTotals,
      '',      // Lançamento
    ];
  }, [availableYears]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">BASE DE ITENS</h2>
          <p className="text-sm text-muted-foreground">Itens Principais com Totais Anuais</p>
        </div>
        <ExportButton
          reportType="base_itens"
          data={data}
          filename="Plastiron_Base_Itens.xlsx"
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
          availableYears.length > 0
            ? 'Nenhum item configurado para este relatório. Cadastre os produtos em Configurações.'
            : 'Nenhum ano disponível. Faça upload de um arquivo para gerar o relatório.'
        }
        stickyColumns={7}
        getTotalsRow={getTotalsRow}
      />
    </div>
  );
}

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

export function BagagitosView({ rows: data, loading, error, truncated }: ReportViewProps<ConfigReportRow>) {
  const { availableYears } = useFilterStore();

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
          filename="Plastiron_Bagagitos.xlsx"
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
            ? 'Nenhum bagagito configurado para este relatório. Cadastre os produtos em Configurações.'
            : 'Nenhum ano disponível. Faça upload de um arquivo para gerar o relatório.'
        }
        stickyColumns={3}
      />
    </div>
  );
}

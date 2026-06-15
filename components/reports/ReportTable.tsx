'use client';

import { useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Skeleton } from '@/components/ui/skeleton';

/** Definição do cabeçalho de grupo que aparece acima das colunas de meses */
export interface ColumnGroupHeader {
  /** Texto exibido na célula de grupo (ex.: "2024") */
  label: string;
  /** Quantidade de colunas que esse grupo abrange */
  span: number;
  /** Índice da primeira coluna do grupo (base 0, contando todas as colunas visíveis) */
  startIndex: number;
}

interface Props<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyMessage?: string;
  stickyColumns?: number;
  /**
   * Quando fornecido, renderiza uma linha de agrupamento acima do cabeçalho padrão.
   * Útil para mostrar o Ano englobando as colunas de meses.
   */
  groupHeaders?: ColumnGroupHeader[];
  /**
   * Quando fornecido, renderiza uma linha de totais em negrito no rodapé da tabela.
   * Recebe os dados visíveis e deve retornar um array de células no mesmo comprimento
   * que as colunas. Use `null` para células sem total (ex.: colunas de texto).
   */
  getTotalsRow?: (data: T[]) => (string | number | null)[];
}

export function ReportTable<T>({
  data,
  columns,
  loading = false,
  emptyMessage = 'Nenhum dado disponível para os filtros selecionados.',
  stickyColumns = 2,
  groupHeaders,
  getTotalsRow,
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const rows = table.getRowModel().rows;
  const stickyOffsets = visibleColumns.map((_, index) =>
    visibleColumns
      .slice(0, index)
      .reduce((total, column) => total + column.getSize(), 0)
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 15,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const totalsRow = getTotalsRow && data.length > 0 ? getTotalsRow(data) : null;

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed rounded-lg">
        {emptyMessage}
      </div>
    );
  }

  const getColumnStyle = (colIdx: number, width: number, isHeader = false) => ({
    width,
    minWidth: width,
    ...(colIdx < stickyColumns
      ? {
          left: stickyOffsets[colIdx] ?? 0,
          zIndex: isHeader ? 20 + (stickyColumns - colIdx) : 10 + (stickyColumns - colIdx),
        }
      : {}),
  });

  return (
    <div className="relative">
      {/* Indicador de scroll: gradiente na borda direita */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-16 z-30 rounded-r-2xl"
        style={{
          background: 'linear-gradient(to left, rgba(15,23,42,0.18) 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />
      <div
        ref={parentRef}
        className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#030712] shadow-xl shadow-slate-200/20 dark:shadow-none custom-scrollbar"
        style={{ maxHeight: 'calc(100vh - 340px)' }}
      >
        <table className="min-w-full text-sm border-collapse table-fixed">
          <thead className="sticky top-0 z-20 bg-white/90 dark:bg-[#030712]/90 backdrop-blur-md">
            {/* Linha de grupos (ex.: Ano) — opcional */}
            {groupHeaders && groupHeaders.length > 0 && (
              <tr>
                {visibleColumns.map((col, colIdx) => {
                  // Verificar se esta coluna é o início de um grupo
                  const group = groupHeaders.find((g) => g.startIndex === colIdx);

                  // Se pertence a um grupo mas não é o início, ignorar (colSpan cuida disso)
                  const belongsToGroup = groupHeaders.some(
                    (g) => colIdx > g.startIndex && colIdx < g.startIndex + g.span
                  );
                  if (belongsToGroup) return null;

                  if (group) {
                    // Calcular largura total do grupo
                    const groupWidth = visibleColumns
                      .slice(group.startIndex, group.startIndex + group.span)
                      .reduce((sum, c) => sum + c.getSize(), 0);

                    return (
                      <th
                        key={`group-${colIdx}`}
                        colSpan={group.span}
                        className="px-4 py-2 text-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] whitespace-nowrap border-b-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20"
                        style={{ width: groupWidth, minWidth: groupWidth }}
                      >
                        {group.label}
                      </th>
                    );
                  }

                  // Coluna fora de qualquer grupo: célula vazia para alinhar
                  return (
                    <th
                      key={`group-empty-${colIdx}`}
                      className={`
                        px-4 py-2 border-b-2 border-slate-100 dark:border-white/5
                        ${colIdx < stickyColumns ? 'sticky bg-white dark:bg-[#030712] z-30' : ''}
                      `}
                      style={getColumnStyle(colIdx, col.getSize(), true)}
                    />
                  );
                })}
              </tr>
            )}

            {/* Linha de cabeçalho padrão */}
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, colIdx) => (
                  <th
                    key={header.id}
                    className={`
                      px-4 py-3 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400
                      uppercase tracking-[0.15em] whitespace-nowrap border-b border-slate-200 dark:border-white/5
                      ${colIdx < stickyColumns ? 'sticky bg-white dark:bg-[#030712] shadow-[6px_0_12px_-8px_rgba(15,23,42,0.28)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.8)] dark:border-r z-30' : ''}
                    `}
                    style={getColumnStyle(colIdx, header.getSize(), true)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {virtualRows.length > 0 && virtualRows[0].start > 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ height: virtualRows[0].start, padding: 0 }}
                />
              </tr>
            )}

            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];

              return (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 dark:border-white/5 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/10 transition-colors group"
                >
                  {row.getVisibleCells().map((cell, colIdx) => (
                    <td
                      key={cell.id}
                      className={`
                        px-4 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium truncate
                        ${colIdx < stickyColumns ? 'sticky bg-white dark:bg-[#030712] shadow-[6px_0_12px_-8px_rgba(15,23,42,0.18)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.8)] dark:border-r dark:border-white/5 group-hover:bg-indigo-50/30 group-hover:dark:bg-[#080d1e] z-20' : ''}
                      `}
                      style={getColumnStyle(colIdx, cell.column.getSize())}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}

            {virtualRows.length > 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    height:
                      totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0),
                    padding: 0,
                  }}
                />
              </tr>
            )}
          </tbody>

          {/* Rodapé de totais — fora do range virtualizado */}
          {totalsRow && totalsRow.length > 0 && (
            <tfoot className="sticky bottom-0 z-20 bg-white/95 dark:bg-[#030712]/95 backdrop-blur-md">
              <tr className="border-t-2 border-slate-300 dark:border-slate-700">
                {totalsRow.map((cell, colIdx) => (
                  <td
                    key={`total-${colIdx}`}
                    className={`
                      px-4 py-3 whitespace-nowrap font-bold text-slate-900 dark:text-white truncate
                      ${colIdx < stickyColumns ? 'sticky bg-white dark:bg-[#030712] shadow-[6px_0_12px_-8px_rgba(15,23,42,0.18)] dark:shadow-[6px_0_12px_-8px_rgba(0,0,0,0.8)] dark:border-r dark:border-white/5 z-30' : ''}
                    `}
                    style={getColumnStyle(colIdx, visibleColumns[colIdx]?.getSize() ?? 100)}
                  >
                    {cell !== null ? cell : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

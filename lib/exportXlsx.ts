'use client';

import * as XLSX from 'xlsx';
import type { TabelaDinamicaRow, BaseDeCompraRow, ConfigReportRow, GeralRow } from '@/types/sales';
import { MONTH_KEYS, MONTH_LABELS } from '@/types/sales';

export type ReportType = 'tabela_dinamica' | 'base_compra' | 'base_itens' | 'bagagitos' | 'geral';
export type ReportData =
  | TabelaDinamicaRow[]
  | BaseDeCompraRow[]
  | ConfigReportRow[]
  | GeralRow[];

const SHEET_NAMES: Record<ReportType, string> = {
  tabela_dinamica: 'Tabela Dinâmica',
  base_compra: 'BASE DE COMPRA',
  base_itens: 'BASE DE ITENS',
  bagagitos: 'BAGAGITOS',
  geral: 'GERAL',
};

// Branqueia apenas quando o valor for exatamente 0 (ou null/undefined).
// Valores negativos (devoluções) são renderizados normalmente.
function numOrBlank(n: number | null | undefined): number | string {
  if (n == null || n === 0) return '';
  return n;
}

// ─── Tabela Dinâmica ──────────────────────────────────────────────────────────
function buildTabelaDinamicaSheet(rows: TabelaDinamicaRow[]): XLSX.WorkSheet {
  const headers = ['Cód. Cliente', 'Cliente', 'Cód. Ref.', 'Descrição Produto', ...MONTH_LABELS, 'Total Ano', 'Total (R$)'];
  const aoa: (string | number)[][] = [headers];

  for (const r of rows) {
    aoa.push([
      r.cod_cliente, r.nome_cliente, r.cod_referencia, r.descr_produto,
      numOrBlank(r.jan), numOrBlank(r.fev), numOrBlank(r.mar), numOrBlank(r.abr),
      numOrBlank(r.mai), numOrBlank(r.jun), numOrBlank(r.jul), numOrBlank(r.ago),
      numOrBlank(r.set_), numOrBlank(r.out_), numOrBlank(r.nov), numOrBlank(r.dez),
      numOrBlank(r.total_ano), r.total_valor ?? '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 40 },
    ...Array(12).fill({ wch: 7 }),
    { wch: 10 }, { wch: 14 },
  ];
  ws['!freeze'] = { xSplit: 4, ySplit: 1 };
  return ws;
}

// ─── Base de Compra ───────────────────────────────────────────────────────────
function buildBaseDeCompraSheet(rows: BaseDeCompraRow[]): XLSX.WorkSheet {
  const headers = ['Cód. Ref.', 'Descrição Produto', ...MONTH_LABELS, 'Total Ano'];
  const aoa: (string | number)[][] = [headers];

  for (const r of rows) {
    aoa.push([
      r.cod_referencia, r.descr_produto,
      numOrBlank(r.jan), numOrBlank(r.fev), numOrBlank(r.mar), numOrBlank(r.abr),
      numOrBlank(r.mai), numOrBlank(r.jun), numOrBlank(r.jul), numOrBlank(r.ago),
      numOrBlank(r.set_), numOrBlank(r.out_), numOrBlank(r.nov), numOrBlank(r.dez),
      numOrBlank(r.total_ano),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 40 }, ...Array(12).fill({ wch: 7 }), { wch: 10 }];
  ws['!freeze'] = { xSplit: 2, ySplit: 1 };
  return ws;
}

// ─── Base de Itens ────────────────────────────────────────────────────────────
function buildBaseDeItensSheet(rows: ConfigReportRow[]): XLSX.WorkSheet {
  // Collect all years present
  const yearsSet = new Set<string>();
  for (const r of rows) Object.keys(r.totals_by_year).forEach((y) => yearsSet.add(y));
  const years = [...yearsSet].sort();

  const headers = ['#', 'DTS', 'R2A', 'Lumax', 'LOMA', 'Cód. Ref.', 'Descrição', ...years, 'Lançamento'];
  const aoa: (string | number)[][] = [headers];

  rows.forEach((r, idx) => {
    aoa.push([
      idx + 1,
      r.extra_data?.dts ?? '',
      r.extra_data?.r2a ?? '',
      r.extra_data?.lumax ?? '',
      r.extra_data?.loma ?? '',
      r.cod_referencia ?? '',
      r.label ?? '',
      ...years.map((y) => numOrBlank(r.totals_by_year[y])),
      r.extra_data?.lancamento ?? '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, ...years.map(() => ({ wch: 10 })), { wch: 15 }];
  ws['!freeze'] = { xSplit: 7, ySplit: 1 };
  return ws;
}

// ─── Bagagitos ────────────────────────────────────────────────────────────────
function buildBagagitosSheet(rows: ConfigReportRow[]): XLSX.WorkSheet {
  const yearsSet = new Set<string>();
  for (const r of rows) Object.keys(r.totals_by_year).forEach((y) => yearsSet.add(y));
  const years = [...yearsSet].sort();

  const headers = ['EMB', 'Plastiron', 'Descrição', 'Ano', 'Aplicação', 'Cor', 'Outros Dados', ...years];
  const aoa: (string | number)[][] = [headers];

  for (const r of rows) {
    aoa.push([
      r.extra_data?.emb ?? '',
      r.extra_data?.plastiron ?? '',
      r.label ?? '',
      r.extra_data?.ano_aplicacao ?? '',
      r.extra_data?.aplicacao ?? '',
      r.extra_data?.cor ?? '',
      r.extra_data?.outros_dados ?? '',
      ...years.map((y) => numOrBlank(r.totals_by_year[y])),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, ...years.map(() => ({ wch: 10 }))];
  ws['!freeze'] = { xSplit: 3, ySplit: 1 };
  return ws;
}

// ─── Geral ────────────────────────────────────────────────────────────────────
function buildGeralSheet(rows: GeralRow[]): XLSX.WorkSheet {
  const headers = [
    'Status', 'EMB', 'Plastiron', 'Descrição', 'Ano', 'Aplicação', 'Cor', 'Outros Dados',
    'Categoria', ...MONTH_LABELS, 'Total Ano',
  ];
  const aoa: (string | number)[][] = [headers];

  let lastCategoria = '';
  for (const r of rows) {
    // Category header row
    if (r.categoria !== lastCategoria) {
      aoa.push([r.categoria]);
      lastCategoria = r.categoria;
    }
    aoa.push([
      r.extra_data?.status ?? '',
      r.extra_data?.emb ?? '',
      r.extra_data?.plastiron ?? '',
      r.label ?? '',
      r.extra_data?.ano_aplicacao ?? '',
      r.extra_data?.aplicacao ?? '',
      r.extra_data?.cor ?? '',
      r.extra_data?.outros_dados ?? '',
      r.categoria ?? '',
      numOrBlank(r.jan), numOrBlank(r.fev), numOrBlank(r.mar), numOrBlank(r.abr),
      numOrBlank(r.mai), numOrBlank(r.jun), numOrBlank(r.jul), numOrBlank(r.ago),
      numOrBlank(r.set_), numOrBlank(r.out_), numOrBlank(r.nov), numOrBlank(r.dez),
      numOrBlank(r.total_ano),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 6 },
    { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 30 },
    ...Array(12).fill({ wch: 7 }), { wch: 10 },
  ];
  ws['!freeze'] = { xSplit: 4, ySplit: 1 };
  return ws;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function exportReport(
  reportType: ReportType,
  data: ReportData,
  customFilename?: string
): Promise<void> {
  const wb = XLSX.utils.book_new();
  let ws: XLSX.WorkSheet;

  switch (reportType) {
    case 'tabela_dinamica':
      ws = buildTabelaDinamicaSheet(data as TabelaDinamicaRow[]);
      break;
    case 'base_compra':
      ws = buildBaseDeCompraSheet(data as BaseDeCompraRow[]);
      break;
    case 'base_itens':
      ws = buildBaseDeItensSheet(data as ConfigReportRow[]);
      break;
    case 'bagagitos':
      ws = buildBagagitosSheet(data as ConfigReportRow[]);
      break;
    case 'geral':
      ws = buildGeralSheet(data as GeralRow[]);
      break;
  }

  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAMES[reportType]);

  const date = new Date().toISOString().split('T')[0];
  const filename = customFilename ?? `Autimex_${SHEET_NAMES[reportType]}_${date}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export async function exportAllReports(
  reports: {
    tabelaDinamica: TabelaDinamicaRow[];
    baseCompra: BaseDeCompraRow[];
    baseItens: ConfigReportRow[];
    bagagitos: ConfigReportRow[];
    geral: GeralRow[];
  },
  clientName?: string
): Promise<void> {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildTabelaDinamicaSheet(reports.tabelaDinamica), 'Tabela Dinâmica');
  XLSX.utils.book_append_sheet(wb, buildBaseDeCompraSheet(reports.baseCompra), 'BASE DE COMPRA');
  XLSX.utils.book_append_sheet(wb, buildBaseDeItensSheet(reports.baseItens), 'BASE DE ITENS');
  XLSX.utils.book_append_sheet(wb, buildBagagitosSheet(reports.bagagitos), 'BAGAGITOS');
  XLSX.utils.book_append_sheet(wb, buildGeralSheet(reports.geral), 'GERAL');

  const date = new Date().toISOString().split('T')[0];
  const filename = clientName
    ? `Autimex_${clientName.replace(/\s+/g, '_')}_${date}.xlsx`
    : `Autimex_Relatorios_${date}.xlsx`;

  XLSX.writeFile(wb, filename);
}

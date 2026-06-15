// Web Worker — runs off the main thread
// Parses .xls/.xlsx files using SheetJS, normalizes columns, filters LIQ rows,
// and emits chunks small enough for the authenticated upload RPC.

import * as XLSX from 'xlsx';
import { normalizeLookupKey } from '@/lib/text';

export type WorkerMessage =
  | { type: 'parse'; buffer: ArrayBuffer; filename: string }

export type WorkerResponse =
  | { type: 'progress'; phase: string; percent: number }
  | { type: 'metadata'; data: {
      periodStart: string;
      periodEnd: string;
      totalRows: number;
      skippedRows: number;
      skipSummary: Record<string, number>;
    } }
  | { type: 'chunk'; rows: ParsedRow[]; chunkIndex: number; totalChunks: number }
  | { type: 'done'; totalRows: number; debugInfo?: any }
  | { type: 'error'; message: string }

export interface ParsedRow {
  cod_empresa: string;
  nome_empresa: string;
  cod_hist_financeiro: string;
  descr_hist_financ: string;
  cod_cliente: string;
  nome_cliente: string;
  apelido: string;
  data_pedido: string; // ISO date string for JSON transfer
  codigo_pedido: string;
  numero_pedido_talao: string | null;
  pedido_cliente_opc: string | null;
  cod_referencia: string;
  descr_produto: string;
  preco_unitario: number;
  quantidade: number;
  situacao_item: string;
  data_limite_entrega: string | null;
  qtd_saldo: number;
  unid_venda: string;
  valor_total: number;
  desconto_fiscal: number;
  cod_intermediador: string | null;
  nome_intermediador: string | null;
  mes: number;
  ano: number;
}

const CHUNK_SIZE = 250;

// Converte serial do Excel para uma string ISO "YYYY-MM-DD" sem passar por Date local.
// O serial representa dias desde 1900-01-00 (com bug do dia 29/fev/1900 do Lotus 123).
// Usamos aritmética pura para evitar qualquer dependência de fuso.
function excelSerialToDateStr(serial: number): string {
  // Offset: 25569 dias entre 1900-01-01 (epoch Excel) e 1970-01-01 (epoch Unix)
  const utcMs = (serial - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Converte qualquer representação de data para uma string ISO "YYYY-MM-DD" (fonte única da verdade).
// Retorna null se o valor não for reconhecido ou for inválido.
export function toDateStr(val: unknown): string | null {
  if (val == null) return null;

  // SheetJS com cellDates:true devolve Date em meia-noite UTC — usar getUTC* é correto.
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const day = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Serial numérico do Excel
  if (typeof val === 'number') {
    if (!isFinite(val) || val < 1) return null;
    return excelSerialToDateStr(val);
  }

  if (typeof val === 'string' && val.trim()) {
    const s = val.trim();

    // Formato DD/MM/YYYY ou D/M/YYYY
    const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const day = String(ddmmyyyy[1]).padStart(2, '0');
      const mon = String(ddmmyyyy[2]).padStart(2, '0');
      const yr  = ddmmyyyy[3];
      // Validar componentes sem construir Date local (evitar ajuste de fuso)
      const dNum = Number(ddmmyyyy[1]);
      const mNum = Number(ddmmyyyy[2]);
      const yNum = Number(yr);
      if (mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31 || yNum < 1900) return null;
      return `${yr}-${mon}-${day}`;
    }

    // Formato YYYY-MM-DD (já ISO)
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return s;

    // Fallback: tentar Date.parse — aceita apenas se resultar em data UTC coerente
    const ts = Date.parse(s);
    if (isNaN(ts)) return null;
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

// Helpers de conversão de outros tipos de célula

function toStr(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

function toNum(val: unknown): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type !== 'parse') return;

  try {
    self.postMessage({ type: 'progress', phase: 'Lendo arquivo...', percent: 5 } satisfies WorkerResponse);

    // cellDates:true faz o SheetJS devolver Date (meia-noite UTC) em vez de seriais numéricos
    const wb = XLSX.read(msg.buffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // ── Detectar linha de cabeçalho tolerante a banners ─────────────────────
    // Marcadores que identificam a linha de cabeçalho do ERP
    const HEADER_MARKERS = ['SITUACAO', 'DATADOPEDIDO', 'CODREFERENCIA'];

    // Ler as primeiras 20 linhas brutas (header:1 → array de arrays)
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

    let headerRowIndex = 0; // índice 0-based na planilha
    let foundHeader = false;
    const MAX_SCAN_ROWS = Math.min(20, rawRows.length);

    for (let ri = 0; ri < MAX_SCAN_ROWS; ri++) {
      const rowCells = rawRows[ri];
      if (!Array.isArray(rowCells)) continue;
      const normalized = rowCells.map((c) => {
        if (c == null) return '';
        return String(c)
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase();
      });
      const matchCount = HEADER_MARKERS.filter((m) => normalized.some((n) => n.includes(m))).length;
      if (matchCount >= 2) {
        headerRowIndex = ri;
        foundHeader = true;
        break;
      }
    }

    if (!foundHeader && rawRows.length > 0) {
      // Fallback: usar a primeira linha, mas emitir aviso no debugInfo
      headerRowIndex = 0;
    }

    // Converter para JSON de objetos a partir da linha detectada
    const jsonData = XLSX.utils.sheet_to_json(ws, {
      range: headerRowIndex,
      defval: '',
    }) as any[];

    if (jsonData.length === 0) {
      const hint = foundHeader
        ? ''
        : ' — cabeçalho não localizado, verifique se o arquivo tem linhas de título acima dos dados';
      throw new Error(`O arquivo está vazio ou não possui dados legíveis${hint}.`);
    }

    // Identify column mappings by looking at the first row's keys
    const firstRow = jsonData[0];
    const keys = Object.keys(firstRow);
    
    self.postMessage({ 
      type: 'progress', 
      phase: 'Processando linhas...', 
      percent: 20 
    } satisfies WorkerResponse);

    const keyMap: Record<string, string> = {};
    keys.forEach(k => {
      keyMap[normalizeLookupKey(k)] = k;
    });

    const getVal = (row: any, ...aliases: string[]) => {
      for (const alias of aliases) {
        const normalizedAlias = normalizeLookupKey(alias);
        const actualKey = keyMap[normalizedAlias];
        if (actualKey !== undefined) return row[actualKey];
      }
      return undefined;
    };

    const parsed: ParsedRow[] = [];
    let skippedBySituacao = 0;
    let skippedByMissingSituacao = 0;
    let skippedByData = 0;
    let skippedByRequiredFields = 0;
    let sampleInvalidDate: any = null;

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];

      const situacao = toStr(getVal(row, 'SITUACAO DO ITEM', 'SITUACAO_ITEM', 'SITUACAO'));
      if (!situacao) {
        skippedByMissingSituacao++;
        continue;
      }
      if (situacao !== 'LIQ') {
        skippedBySituacao++;
        continue;
      }

      const dataPedidoRaw = getVal(row, 'DATA DO PEDIDO', 'DATA EMISSAO', 'DATA_EMISSAO', 'DATA', 'DATA PEDIDO');
      const dataPedidoStr = toDateStr(dataPedidoRaw);

      if (!dataPedidoStr) {
        skippedByData++;
        if (!sampleInvalidDate) sampleInvalidDate = dataPedidoRaw;
        continue;
      }

      // Fonte única da verdade: mes e ano derivados da string ISO, não de getters locais.
      // Isso elimina o bug UTC↔local onde dia 1 de cada mês cai no mês anterior no fuso -3.
      const [anoStr, mesStr] = dataPedidoStr.split('-');
      const mes = parseInt(mesStr, 10);
      const ano = parseInt(anoStr, 10);
      const codCliente = toStr(getVal(row, 'CODCLIENTE', 'COD. CLIENTE', 'COD_CLIENTE', 'CLIENTE COD'));
      const nomeCliente = toStr(getVal(row, 'NOMECLIENTE', 'CLIENTE', 'NOME CLIENTE', 'NOME_CLIENTE'));
      const codReferencia = toStr(getVal(row, 'COD. REFERENCIA', 'COD_REFERENCIA', 'REFERENCIA'));
      const descrProduto = toStr(getVal(row, 'DESCR. PRODUTO', 'DESCRICAO PRODUTO', 'DESCRICAO_PRODUTO', 'PRODUTO'));

      if (!codCliente || !nomeCliente || !codReferencia || !descrProduto) {
        skippedByRequiredFields++;
        continue;
      }

      parsed.push({
        cod_empresa:          toStr(getVal(row, 'CODEMPRESA', 'COD. EMPRESA', 'COD_EMPRESA')),
        nome_empresa:         toStr(getVal(row, 'NOMEEMPRESA', 'NOME EMPRESA', 'NOME_EMPRESA', 'EMPRESA')),
        cod_hist_financeiro:  toStr(getVal(row, 'COD. HIST. FINANCEIRO', 'COD_HIST_FINANCEIRO')),
        descr_hist_financ:    toStr(getVal(row, 'DESCR. HIST. FINANC.', 'DESCR_HIST_FINANC')),
        cod_cliente:          codCliente,
        nome_cliente:         nomeCliente,
        data_pedido:          dataPedidoStr,
        codigo_pedido:        toStr(getVal(row, 'CODIGO DO PEDIDO', 'CODIGO PEDIDO', 'CODIGO_PEDIDO', 'PEDIDO')),
        numero_pedido_talao:  toStr(getVal(row, 'NUMERO DO PEDIDO (TALAO)', 'NUMERO PEDIDO TALAO', 'NUMERO_PEDIDO_TALAO')) || null,
        pedido_cliente_opc:   toStr(getVal(row, 'PEDIDO DO CLIENTE (OPC)', 'PEDIDO CLIENTE (OPC)', 'PEDIDO_CLIENTE_OPC')) || null,
        cod_referencia:       codReferencia,
        descr_produto:        descrProduto,
        preco_unitario:       toNum(getVal(row, 'PRECO UNITARIO', 'PRECO_UNITARIO')),
        quantidade:           toNum(getVal(row, 'QUANTIDADE')),
        situacao_item:        situacao,
        data_limite_entrega:  toDateStr(getVal(row, 'DATA PARA LIMITE NA ENTREGA', 'DATA LIMITE ENTREGA')),
        qtd_saldo:            toNum(getVal(row, 'QTD. SALDO', 'QTD_SALDO', 'QTD SALDO')),
        unid_venda:           toStr(getVal(row, 'UNID. VENDA', 'UNID_VENDA', 'UNIDVENDA')),
        valor_total:          toNum(getVal(row, 'VALORTOTAL', 'VALOR TOTAL', 'VALOR_TOTAL')),
        desconto_fiscal:      toNum(getVal(row, 'DESCONTO FISCAL', 'DESCONTO_FISCAL')),
        apelido:              toStr(getVal(row, 'APELIDO')),
        cod_intermediador:    toStr(getVal(row, 'COD. INTERMEDIADOR')) || null,
        nome_intermediador:   toStr(getVal(row, 'NOME INTERMEDIADOR')) || null,
        mes,
        ano,
      });
    }

    if (parsed.length === 0) {
      const columnsFound = keys.join(', ');
      const headerHint = foundHeader ? '' : ' Cabeçalho não localizado — verifique se o arquivo tem linhas de título acima dos dados.';
      throw new Error(`Nenhuma linha válida encontrada. (${skippedBySituacao} ignoradas por Situação != LIQ, ${skippedByMissingSituacao} sem situação, ${skippedByData} sem data válida, ${skippedByRequiredFields} sem campos obrigatórios). Amostra de data inválida: "${sampleInvalidDate}". Colunas encontradas: ${columnsFound}.${headerHint}`);
    }

    const dates = parsed.map((row) => row.data_pedido).sort();
    self.postMessage({
      type: 'metadata',
      data: {
        periodStart: dates[0],
        periodEnd: dates[dates.length - 1],
        totalRows: parsed.length,
        skippedRows: skippedBySituacao + skippedByMissingSituacao + skippedByData + skippedByRequiredFields,
        skipSummary: {
          situacao_diferente_liq: skippedBySituacao,
          situacao_ausente: skippedByMissingSituacao,
          data_invalida: skippedByData,
          campos_obrigatorios_ausentes: skippedByRequiredFields,
        },
      },
    } satisfies WorkerResponse);

    self.postMessage({ type: 'progress', phase: 'Enviando dados...', percent: 60 } satisfies WorkerResponse);

    // Emit in chunks
    const totalChunks = Math.ceil(parsed.length / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const chunk = parsed.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const percent = 60 + Math.round((i / totalChunks) * 40);
      self.postMessage({
        type: 'chunk',
        rows: chunk,
        chunkIndex: i,
        totalChunks,
      } satisfies WorkerResponse);
      self.postMessage({ type: 'progress', phase: 'Enviando dados...', percent } satisfies WorkerResponse);
    }

    self.postMessage({
      type: 'done',
      totalRows: parsed.length,
      debugInfo: { skippedBySituacao, skippedByMissingSituacao, skippedByData, skippedByRequiredFields, columns: keys, foundHeader, headerRowIndex }
    } satisfies WorkerResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message } satisfies WorkerResponse);
  }
};

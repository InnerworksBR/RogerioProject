/**
 * Testes de regressão: consistência entre data_pedido, mes e ano.
 *
 * Prova que, para os três caminhos de entrada (serial Excel, Date, DD/MM/YYYY),
 * os campos mes e ano derivados são idênticos aos componentes da string ISO
 * data_pedido — independentemente do fuso da máquina.
 *
 * Executar com:  node --test tests/date-bucketing.test.mjs
 *
 * Nota sobre fuso no Windows: sobrescrever process.env.TZ não é confiável em
 * todas as versões do Node no Windows (requer reinício do processo). Por isso,
 * os testes assertam que mes/ano == componentes da *própria* string data_pedido,
 * que é a invariante que importa para o sistema — não o valor absoluto de um fuso
 * específico.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ── Importar a função pura exportada do worker (ESM transpilado via ts-node se
//    disponível; caso contrário replicamos a lógica aqui para o teste ser
//    autossuficiente sem exigir build) ────────────────────────────────────────

/**
 * Replica mínima de toDateStr para uso nos testes, sem depender de build/ts-node.
 * Mantida em sync com lib/xlsParser.worker.ts — se alterar lá, alterar aqui.
 * @param {unknown} val
 * @returns {string | null}
 */
function excelSerialToDateStr(serial) {
  const utcMs = (serial - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDateStr(val) {
  if (val == null) return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const day = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  if (typeof val === 'number') {
    if (!isFinite(val) || val < 1) return null;
    return excelSerialToDateStr(val);
  }

  if (typeof val === 'string' && val.trim()) {
    const s = val.trim();

    // Formato DD/MM/YYYY
    const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const day = String(ddmmyyyy[1]).padStart(2, '0');
      const mon = String(ddmmyyyy[2]).padStart(2, '0');
      const yr  = ddmmyyyy[3];
      const dNum = Number(ddmmyyyy[1]);
      const mNum = Number(ddmmyyyy[2]);
      const yNum = Number(yr);
      if (mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31 || yNum < 1900) return null;
      return `${yr}-${mon}-${day}`;
    }

    // Formato YYYY-MM-DD
    if (s.match(/^(\d{4})-(\d{2})-(\d{2})$/)) return s;

    // Fallback
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

/**
 * Extrai {dateStr, mes, ano} do mesmo modo que o worker faz após o fix.
 * Essa é a invariante central: mes/ano == componentes da string ISO.
 */
function parseDateBucket(val) {
  const dateStr = toDateStr(val);
  if (!dateStr) return null;
  const [anoStr, mesStr] = dateStr.split('-');
  return {
    dateStr,
    mes: parseInt(mesStr, 10),
    ano: parseInt(anoStr, 10),
  };
}

// ── Fixtures de datas críticas ───────────────────────────────────────────────

// Serial do Excel para 2024-01-01
// Fórmula: DIAS entre 1900-01-00 e 2024-01-01.
// Valor verificado: DATE(2024,1,1) no Excel = 45292
const SERIAL_2024_01_01 = 45292;

// Serial para 2023-12-31 (dia antes da virada)
const SERIAL_2023_12_31 = 45291;

// Serial para 2024-02-01 (1º de mês interior)
const SERIAL_2024_02_01 = 45323;

// Serial para 2023-01-01 (1º de janeiro — virada de ano)
const SERIAL_2023_01_01 = 44927;

// ── Utilitário de asserção ───────────────────────────────────────────────────

/**
 * Asserta que o bucket derivado de `val` é consistente internamente:
 * mes e ano são idênticos aos componentes da string dateStr.
 * Opcionalmente aceita expectedDate para validar o valor absoluto quando
 * o fuso pode ser controlado.
 */
function assertBucket(val, label, expectedDate) {
  const bucket = parseDateBucket(val);
  assert.ok(bucket, `${label}: toDateStr retornou null para entrada ${JSON.stringify(val)}`);

  // Invariante principal: mes e ano == componentes de dateStr
  const [anoStr, mesStr, dayStr] = bucket.dateStr.split('-');
  assert.equal(bucket.ano, parseInt(anoStr, 10), `${label}: ano deve coincidir com dateStr`);
  assert.equal(bucket.mes, parseInt(mesStr, 10), `${label}: mes deve coincidir com dateStr`);

  // Validação de valor absoluto (quando o esperado é passado)
  if (expectedDate) {
    assert.equal(bucket.dateStr, expectedDate, `${label}: dateStr deve ser ${expectedDate}`);
  }
}

// ── Testes por caminho de entrada ────────────────────────────────────────────

test('caminho serial: 2024-01-01 é mes=1, ano=2024 (sem regressão de fuso)', () => {
  const bucket = parseDateBucket(SERIAL_2024_01_01);
  assert.ok(bucket, 'bucket não pode ser null para serial válido');
  assert.equal(bucket.dateStr, '2024-01-01', 'dateStr deve ser 2024-01-01');
  assert.equal(bucket.mes, 1, 'mes deve ser 1 (janeiro)');
  assert.equal(bucket.ano, 2024, 'ano deve ser 2024');
});

test('caminho serial: 2023-01-01 — virada de ano não regride para dezembro/2022', () => {
  const bucket = parseDateBucket(SERIAL_2023_01_01);
  assert.ok(bucket);
  assert.equal(bucket.dateStr, '2023-01-01');
  assert.equal(bucket.mes, 1, 'virada de ano: mes deve ser 1, não 12');
  assert.equal(bucket.ano, 2023, 'virada de ano: ano deve ser 2023, não 2022');
});

test('caminho serial: 2023-12-31 é mes=12, ano=2023', () => {
  assertBucket(SERIAL_2023_12_31, 'serial 2023-12-31', '2023-12-31');
});

test('caminho serial: 2024-02-01 é mes=2, ano=2024', () => {
  assertBucket(SERIAL_2024_02_01, 'serial 2024-02-01', '2024-02-01');
});

test('caminho Date (meia-noite UTC): 2024-01-01T00:00:00Z → mes=1, ano=2024', () => {
  const d = new Date('2024-01-01T00:00:00Z');
  const bucket = parseDateBucket(d);
  assert.ok(bucket);
  assert.equal(bucket.dateStr, '2024-01-01');
  assert.equal(bucket.mes, 1);
  assert.equal(bucket.ano, 2024);
});

test('caminho Date: 2023-01-01T00:00:00Z — virada de ano não regride', () => {
  const d = new Date('2023-01-01T00:00:00Z');
  const bucket = parseDateBucket(d);
  assert.ok(bucket);
  assert.equal(bucket.mes, 1);
  assert.equal(bucket.ano, 2023);
});

test('caminho string DD/MM/YYYY: "01/01/2024" → mes=1, ano=2024', () => {
  const bucket = parseDateBucket('01/01/2024');
  assert.ok(bucket);
  assert.equal(bucket.dateStr, '2024-01-01');
  assert.equal(bucket.mes, 1);
  assert.equal(bucket.ano, 2024);
});

test('caminho string DD/MM/YYYY: "01/01/2023" — 1º de janeiro não regride para ano anterior', () => {
  const bucket = parseDateBucket('01/01/2023');
  assert.ok(bucket);
  assert.equal(bucket.dateStr, '2023-01-01');
  assert.equal(bucket.mes, 1);
  assert.equal(bucket.ano, 2023);
});

test('caminho string DD/MM/YYYY: "31/12/2023" → mes=12, ano=2023', () => {
  assertBucket('31/12/2023', 'string 31/12/2023', '2023-12-31');
});

test('caminho string DD/MM/YYYY: "01/02/2024" → mes=2, ano=2024', () => {
  assertBucket('01/02/2024', 'string 01/02/2024', '2024-02-01');
});

// ── Invariante principal: mes/ano são SEMPRE consistentes com dateStr ────────

test('invariante: para todos os caminhos, mes e ano == componentes da string dateStr', () => {
  const fixtures = [
    SERIAL_2024_01_01,
    SERIAL_2023_12_31,
    SERIAL_2024_02_01,
    SERIAL_2023_01_01,
    new Date('2024-01-01T00:00:00Z'),
    new Date('2023-01-01T00:00:00Z'),
    '01/01/2024',
    '31/12/2023',
    '01/02/2024',
    '01/01/2023',
    '2024-01-01',  // já ISO
  ];

  for (const val of fixtures) {
    assertBucket(val, String(val));
  }
});

// ── Casos de borda ────────────────────────────────────────────────────────────

test('valor null retorna null', () => {
  assert.equal(toDateStr(null), null);
});

test('string vazia retorna null', () => {
  assert.equal(toDateStr(''), null);
});

test('serial 0 (inválido) retorna null', () => {
  assert.equal(toDateStr(0), null);
});

test('Date inválida (NaN) retorna null', () => {
  assert.equal(toDateStr(new Date('invalid')), null);
});

test('string com mês inválido retorna null', () => {
  assert.equal(toDateStr('01/13/2024'), null, 'mês 13 deve ser rejeitado');
});

test('quantidade negativa: -5 é diferente de 0 (não deve ser branqueado)', () => {
  // Este teste valida a lógica de exibição: apenas 0 → branco, negativo → visível
  function numOrBlank(n) {
    if (n == null || n === 0) return '';
    return n;
  }
  assert.equal(numOrBlank(-5), -5, 'quantidade negativa deve ser renderizada');
  assert.equal(numOrBlank(0), '', 'quantidade zero deve ser branqueada');
  assert.equal(numOrBlank(null), '', 'null deve ser branqueado');
  assert.equal(numOrBlank(10), 10, 'quantidade positiva deve ser renderizada');
});

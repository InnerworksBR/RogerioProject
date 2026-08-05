import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

test('report request parser enforces report allowlist and bounds', async () => {
  const moduleUrl = pathToFileURL(path.join(root, 'types/reportApi.ts')).href;
  const {
    MAX_UI_ROW_LIMIT,
    ReportRequestError,
    parseReportRequest,
  } = await import(moduleUrl);

  const valid = parseReportRequest(new URLSearchParams({
    report: 'geral',
    year: '2026',
    semester: '2',
    limit: '250',
  }));
  assert.equal(valid.report, 'geral');
  assert.equal(valid.year, 2026);
  assert.equal(valid.semester, 2);
  assert.equal(valid.limit, 250);

  assert.throws(
    () => parseReportRequest(new URLSearchParams({ report: 'unknown' })),
    ReportRequestError
  );
  assert.throws(
    () => parseReportRequest(new URLSearchParams({ limit: String(MAX_UI_ROW_LIMIT + 1) })),
    ReportRequestError
  );
  assert.throws(
    () => parseReportRequest(new URLSearchParams({ year: '99' })),
    ReportRequestError
  );
});

test('telemetry source only serializes the approved low-cardinality fields', () => {
  const source = fs.readFileSync(path.join(root, 'lib/server/queryTelemetry.ts'), 'utf8');
  for (const field of ['requestId', 'operation', 'durationMs', 'rowCount', 'status', 'cacheStatus']) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
  for (const forbidden of ['token', 'email', 'nome_cliente', 'cod_cliente', 'cod_referencia']) {
    assert.doesNotMatch(source, new RegExp(`\\b${forbidden}\\b`, 'i'));
  }
  assert.doesNotMatch(source, /JSON\.stringify\(input\)/);
});

test('report routes authenticate, validate and normalize failures', () => {
  for (const route of ['bootstrap', 'query', 'options']) {
    const source = fs.readFileSync(path.join(root, `app/api/reports/${route}/route.ts`), 'utf8');
    assert.match(source, /requireAuthenticatedRouteUser\(\)/);
    assert.match(source, /status: 400/);
    assert.match(source, /status: 500/);
    assert.match(source, /private, no-store/);
  }
});

test('query keys cover every filter and fetchers forward AbortSignal', () => {
  const source = fs.readFileSync(path.join(root, 'lib/client/reportApi.ts'), 'utf8');
  for (const field of ['report', 'client', 'product', 'semester', 'revenueType', 'limit']) {
    assert.match(source, new RegExp(`request\\.${field}\\b`));
  }
  assert.match(source, /request\.years\.join\(','\)/);
  assert.match(source, /fetchJson\([^)]*, signal\)/);
  assert.match(source, /queryFn: \(\{ signal \}\)/);
  assert.match(source, /placeholderData: keepPreviousData/);
});

test('reports screen has one query owner and views perform no browser data access', () => {
  const page = fs.readFileSync(path.join(root, 'app/(protected)/reports/page.tsx'), 'utf8');
  assert.match(page, /useReportsBootstrap\(bootstrapRequest\)/);
  assert.match(page, /useReportQuery\(reportRequest,/);
  assert.match(page, /<Tabs value=/);

  const viewFiles = [
    'TabelaDinamicaView.tsx',
    'BaseCompraView.tsx',
    'BaseItensView.tsx',
    'BagagitosView.tsx',
    'GeralView.tsx',
  ];
  for (const file of viewFiles) {
    const source = fs.readFileSync(path.join(root, 'components/reports/views', file), 'utf8');
    assert.doesNotMatch(source, /@\/lib\/reportQueries|useEnsureReportYears|getSupabaseClient|\.rpc\(|\.from\(/);
    assert.match(source, /ReportViewProps/);
  }
});

test('AI summary is only requested by the explicit action', () => {
  const source = fs.readFileSync(path.join(root, 'components/reports/ExecutiveSummaryCard.tsx'), 'utf8');
  const effectEnd = source.indexOf('const generateSummary');
  assert.ok(effectEnd > 0);
  assert.doesNotMatch(source.slice(0, effectEnd), /fetch\('/);
  assert.match(source.slice(effectEnd), /fetch\('\/api\/ai\/report-summary'/);
  assert.match(source, /onClick=\{generateSummary\}/);
});

test('upload invalidates report cache and hot filter paths stay bounded', () => {
  const upload = fs.readFileSync(path.join(root, 'components/upload/DropZone.tsx'), 'utf8');
  assert.match(upload, /invalidateQueries\(\{ queryKey: reportQueryKeys\.all \}\)/);
  assert.doesNotMatch(upload, /getAvailableYears/);

  const filter = fs.readFileSync(path.join(root, 'components/reports/ReportFilterBar.tsx'), 'utf8');
  assert.doesNotMatch(filter, /@\/lib\/reportQueries|getSupabaseClient|\.rpc\(|\.from\(/);
  assert.match(filter, /useDebouncedValue\(clientQuery, 300\)/);
  assert.match(filter, /useDebouncedValue\(productQuery, 300\)/);

  const serverData = fs.readFileSync(path.join(root, 'lib/server/reportData.ts'), 'utf8');
  assert.doesNotMatch(serverData, /\.limit\(10_?000\)/);
});

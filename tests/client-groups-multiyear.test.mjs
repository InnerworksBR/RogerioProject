import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), 'utf8');

test('multi-year requests are normalized, bounded and backward compatible', async () => {
  const moduleUrl = pathToFileURL(path.join(root, 'types/reportApi.ts')).href;
  const {
    MAX_COMPARISON_YEARS,
    MAX_EXPORT_ROW_LIMIT,
    ReportRequestError,
    buildReportSearchParams,
    parseReportRequest,
  } = await import(moduleUrl);

  const request = parseReportRequest(new URLSearchParams({
    report: 'geral',
    years: '2026,2024,2026,2025',
  }));
  assert.deepEqual(request.years, [2024, 2025, 2026]);
  assert.equal(request.year, 2026);
  assert.equal(buildReportSearchParams(request).get('years'), '2024,2025,2026');

  const legacy = parseReportRequest(new URLSearchParams({ year: '2023' }));
  assert.deepEqual(legacy.years, [2023]);
  assert.equal(legacy.year, 2023);

  assert.throws(
    () => parseReportRequest(new URLSearchParams({ years: '2020,2021,2022,2023,2024' })),
    ReportRequestError
  );
  assert.equal(MAX_COMPARISON_YEARS, 4);
  assert.equal(MAX_EXPORT_ROW_LIMIT, 100_000);
});

test('canonical clients are tenant-scoped, unique and managed atomically by leaders', async () => {
  const migration = await read('supabase/migrations/0023_client_groups_and_account_scope.sql');
  const chatOrdersFix = await read('supabase/migrations/0024_fix_chat_recent_orders_grouping.sql');
  const route = await read('app/api/client-groups/route.ts');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS client_groups/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS client_group_members/);
  assert.match(migration, /DROP POLICY IF EXISTS client_groups_read_account/);
  assert.match(migration, /UNIQUE \(account_owner_id, cod_cliente\)/);
  assert.match(migration, /ALTER TABLE client_groups ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE client_group_members ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION save_client_group/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION delete_client_group/);
  assert.match(migration, /GRANT SELECT ON client_groups TO authenticated/);
  assert.doesNotMatch(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON client_groups/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION resolve_client_codes/);
  for (const rpc of ['client_dashboard_summary', 'client_monthly_trend', 'client_yearly_history', 'client_top_products', 'client_recent_orders']) {
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION ${rpc}`));
  }
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_inactive_clients/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_rep_performance/);
  assert.match(migration, /Revisão: r4 — chat_recent_orders foi isolada na migration 0024/);
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION chat_recent_orders/);
  assert.match(chatOrdersFix, /CREATE OR REPLACE FUNCTION chat_recent_orders/);
  assert.match(chatOrdersFix, /MIN\(lines\.codigo_pedido\) AS codigo_pedido/);
  assert.match(chatOrdersFix, /GROUP BY lines\.order_key/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION get_rep_ranking/);
  assert.match(migration, /STRING_AGG\(DISTINCT member\.cod_cliente/);
  assert.match(migration, /REGEXP_REPLACE\(LOWER\(option\.search_text\)/);
  assert.match(migration, /is_current_account_leader\(\)/);
  assert.match(migration, /user_id = current_account_owner_id\(\)/);
  assert.match(migration, /WITH representative_config AS/);
  assert.match(migration, /ON CONFLICT \(user_id, report_key, cod_referencia\)/);

  assert.match(route, /requireAuthenticatedRouteUser\(\)/);
  assert.match(route, /requireSameOrigin\(request\)/);
  assert.match(route, /role !== 'leader'/);
  assert.match(route, /rpc\('save_client_group'/);
  assert.match(route, /rpc\('delete_client_group'/);
  assert.match(route, /status: 403/);
  assert.match(route, /status: 409/);
});

test('canonical client dashboard keeps aggregate loading and defers raw chronology', async () => {
  const dashboard = await read('components/client-dashboard/ClientVisitDashboard.tsx');
  assert.match(dashboard, /Promise\.all\(\[/);
  assert.match(dashboard, /buildClientVisitDashboardFromAggregates/);
  assert.match(dashboard, /activeTab !== 'produtos'/);
  assert.match(dashboard, /getClientSalesHistory\(selectedClient\)/);
});

test('report filters and exports expose the complete bounded multi-year flow', async () => {
  const filters = await read('components/reports/ReportFilterBar.tsx');
  const exportRoute = await read('app/api/reports/export/route.ts');
  const exportButton = await read('components/reports/ExportButton.tsx');
  const exporter = await read('lib/exportXlsx.ts');

  assert.match(filters, /selectedYears\.includes\(year\)/);
  assert.match(filters, /MAX_COMPARISON_YEARS/);
  assert.match(filters, /aria-pressed=\{active\}/);
  assert.match(exportRoute, /requireAuthenticatedRouteUser\(\)/);
  assert.match(exportRoute, /MAX_EXPORT_ROW_LIMIT/);
  assert.match(exportRoute, /status: 413/);
  assert.match(exportButton, /fetchReportExport/);
  assert.match(exporter, /\['Ano', 'Cód\. Cliente'/);
  assert.match(exporter, /\['Ano', 'Cód\. Ref\.'/);
  assert.match(exporter, /'Período', 'Status'/);
});

test('uploads require destructive confirmation and expose per-file results', async () => {
  const route = await read('app/api/upload/route.ts');
  const dropZone = await read('components/upload/DropZone.tsx');
  const history = await read('components/upload/UploadHistory.tsx');

  assert.match(route, /confirmReplacement/);
  assert.match(route, /kind: 'replacement'/);
  assert.match(route, /status: 409/);
  assert.match(dropZone, /fileResults/);
  assert.match(dropZone, /useConfirm/);
  assert.match(dropZone, /await confirm\(/);
  assert.match(history, /mode: 'remove'/);
  assert.match(history, /useConfirm/);
  assert.match(history, /await confirm\(/);
  assert.match(history, /invalidateQueries\(\{ queryKey: reportQueryKeys\.all \}\)/);
});

test('home avoids automatic AI cost and legacy report links converge on one screen', async () => {
  const home = await read('app/(protected)/page.tsx');
  assert.doesNotMatch(home, /buildAIReportSummary|\/api\/ai\/report-summary/);
  assert.match(home, /getDashboardSummaryForSupabase/);

  for (const route of ['tabela-dinamica', 'base-compra', 'base-itens', 'bagagitos', 'geral']) {
    const source = await read(`app/(protected)/reports/${route}/page.tsx`);
    assert.match(source, /redirect\('\/reports'\)/);
  }
});

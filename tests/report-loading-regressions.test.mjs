import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,export {}', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      return nextResolve(pathToFileURL(path.join(root, `${specifier.slice(2)}.ts`)).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { getReportsBootstrap, executeReportScreenQuery } = await import('../lib/server/reportQueryOrchestrator.ts');
const { findProductsForSupabase, getRevenueTypesForSupabase } = await import('../lib/server/reportData.ts');
hooks.deregister();

const request = {
  report: 'tabela_dinamica', year: null, years: [], client: null,
  product: null, semester: null, revenueType: null, limit: 100,
};

function database(overrides = {}) {
  const calls = [];
  const results = {
    get_distinct_years: { data: [{ ano: '2024' }, { ano: 2026 }], error: null },
    search_clients: { data: [{ cod_cliente: 'group:test', nome_cliente: 'Grupo de teste' }], error: null },
    search_products: { data: [{ cod_referencia: 'P999', descr_produto: 'Produto fora do primeiro lote' }], error: null },
    get_report_revenue_types: { data: [{ descr_hist_financ: 'Nacional' }, { descr_hist_financ: 'Outras receitas' }], error: null },
    ...overrides,
  };
  return {
    calls,
    rpc(name, params) {
      calls.push({ name, params });
      assert.ok(name in results, `consulta inesperada no bootstrap: ${name}`);
      return { then: (resolve, reject) => Promise.resolve(results[name]).then(resolve, reject),
        limit: () => Promise.resolve(results[name]) };
    },
  };
}

test('bootstrap loads only metadata and never runs an unfiltered report or summary', async () => {
  const db = database();
  const result = await getReportsBootstrap(db, 'test-bootstrap', request);
  assert.deepEqual(result.years, [2024, 2026]);
  assert.deepEqual(result.selectedYears, [2026]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.clients[0].label, 'Grupo de teste');
  assert.deepEqual(db.calls.map(({ name }) => name).sort(), [
    'get_distinct_years', 'search_clients', 'search_products', 'get_report_revenue_types',
  ].sort());
  assert.equal(result.initialReport, undefined);
});

test('an auxiliary filter timeout leaves years, other filters and report querying usable', async () => {
  const db = database({ search_products: { data: null, error: { message: 'statement timeout' } } });
  const result = await getReportsBootstrap(db, 'test-partial', request);
  assert.deepEqual(result.selectedYears, [2026]);
  assert.equal(result.clients.length, 1);
  assert.deepEqual(result.revenueTypes, ['Nacional', 'Outras receitas']);
  assert.deepEqual(result.products, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /produtos/);

  const queryDb = database({
    tabela_dinamica_geral: { data: [{ ano: 2026, cod_cliente: 'group:test', total_valor: 300 }], error: null },
    dashboard_period_summary: { data: [{ total_faturado: 300 }], error: null },
  });
  const report = await executeReportScreenQuery(queryDb, 'test-filtered', {
    ...request, year: 2026, years: [2026], client: 'group:test',
  });
  assert.equal(report.rows[0].total_valor, 300);
  assert.equal(report.summary.total_faturado, 300);
  assert.ok(queryDb.calls.every(({ params }) => params.p_cod_cliente === 'group:test'));
});

test('product search sends the term and limit to the database without truncating a global catalog', async () => {
  const db = database();
  const products = await findProductsForSupabase(db, '  P999  ', 500);
  assert.equal(products[0].cod_referencia, 'P999');
  assert.deepEqual(db.calls, [{ name: 'search_products', params: { p_query: 'P999', p_limit: 100 } }]);
});

test('revenue options come from distinct values instead of a sample of sales lines', async () => {
  const db = database();
  assert.deepEqual(await getRevenueTypesForSupabase(db), ['Nacional', 'Outras receitas']);
  assert.equal(db.calls[0].name, 'get_report_revenue_types');
});

test('failure to discover years rejects clearly instead of manufacturing an empty report', async () => {
  const db = database({ get_distinct_years: { data: null, error: { message: 'database unavailable' } } });
  await assert.rejects(getReportsBootstrap(db, 'test-unavailable', request), /database unavailable/);
});

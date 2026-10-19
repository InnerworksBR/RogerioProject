import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const {
  buildMonthlyComparison, buildMonthlyTrendComparison, buildProductComparison, buildComparisonOpportunities, comparisonDelta,
} = await import(pathToFileURL(path.join(process.cwd(), 'lib/clientComparison.ts')).href);

const row = (overrides = {}) => ({
  id: 1, user_id: 'owner-a', cod_cliente: 'client-a', nome_cliente: 'Cliente de teste',
  apelido: null, cod_referencia: 'P1', descr_produto: 'Produto 1', data_pedido: '2024-01-15',
  codigo_pedido: 'order-1', numero_pedido_talao: null, pedido_cliente_opc: null,
  quantidade: 2, valor_total: 100, preco_unitario: 50, descr_hist_financ: null,
  ano: 2024, mes: 1, ...overrides,
});

test('monthly comparison uses the explicitly selected, nonconsecutive years', () => {
  const points = buildMonthlyComparison([
    { year: 2024, dashboard: { monthlyTrend: [{ month: 1, revenue: 100, units: 2, orders: 1, previousRevenue: 900 }] } },
    { year: 2026, dashboard: { monthlyTrend: [{ month: 1, revenue: 300, units: 6, orders: 2, previousRevenue: 700 }] } },
  ]);
  assert.equal(points.length, 12);
  assert.deepEqual(points[0].values, {
    2024: { revenue: 100, units: 2, orders: 1 }, 2026: { revenue: 300, units: 6, orders: 2 },
  });
  assert.deepEqual(points[11].values[2026], { revenue: 0, units: 0, orders: 0 });
  assert.equal(points[0].values[2025], undefined);
});

test('presentation overlays selected years without mixing in the previous-year RPC rows', () => {
  const points = buildMonthlyTrendComparison([
    { year: 2024, rows: [
      { ano: 2024, mes: 3, total_faturado: 120, total_unidades: 4, total_pedidos: 2 },
      { ano: 2023, mes: 3, total_faturado: 900, total_unidades: 30, total_pedidos: 9 },
    ] },
    { year: 2026, rows: [
      { ano: 2026, mes: 3, total_faturado: '350', total_unidades: '7', total_pedidos: '3' },
      { ano: 2025, mes: 3, total_faturado: 999, total_unidades: 99, total_pedidos: 9 },
      { ano: 2026, mes: 13, total_faturado: 999 },
    ] },
  ]);
  assert.equal(points.length, 12);
  assert.deepEqual(points[2].values, {
    2024: { revenue: 120, units: 4, orders: 2 },
    2026: { revenue: 350, units: 7, orders: 3 },
  });
  assert.deepEqual(points[0].values[2026], { revenue: 0, units: 0, orders: 0 });
  assert.equal(points[2].values[2025], undefined);
});

test('product totals exclude unselected years and preserve missing-year zeros', () => {
  const products = buildProductComparison([
    row(), row({ ano: 2025, valor_total: 9000 }),
    row({ ano: 2026, mes: 3, data_pedido: '2026-03-15', valor_total: 250, quantidade: 5 }),
    row({ cod_referencia: 'OLD', descr_produto: 'Somente antigo' }),
  ], [2024, 2026]);
  assert.deepEqual(products[0].values[2026], { revenue: 250, units: 5, orders: 1 });
  assert.equal(products[0].values[2025], undefined);
  const old = products.find((item) => item.code === 'OLD');
  assert.deepEqual(old.values[2026], { revenue: 0, units: 0, orders: 0 });
  assert.equal(products[0].monthly[2].values[2026].revenue, 250);
  assert.equal(products[0].monthly[1].values[2026].revenue, 0);
});

test('product order counts deduplicate lines but keep separate owners and dates', () => {
  const products = buildProductComparison([
    row(), row({ id: 2 }), row({ id: 3, user_id: 'owner-b' }),
    row({ id: 4, data_pedido: '2024-01-16' }),
  ], [2024]);
  assert.deepEqual(products[0].values[2024], { revenue: 400, units: 8, orders: 3 });
  assert.equal(products[0].monthly[0].values[2024].orders, 3);
});

test('product order counts use fallback order identifiers and handle null amounts', () => {
  const products = buildProductComparison([
    row({ codigo_pedido: ' ', numero_pedido_talao: 'T1', quantidade: null, valor_total: null }),
    row({ codigo_pedido: null, numero_pedido_talao: 'T1' }),
    row({ codigo_pedido: null, pedido_cliente_opc: 'C1' }),
  ], [2024]);
  assert.deepEqual(products[0].values[2024], { revenue: 200, units: 4, orders: 2 });
});

test('complete product comparison is not truncated to the top 100', () => {
  const products = buildProductComparison(Array.from({ length: 125 }, (_, index) =>
    row({ id: index, cod_referencia: `P${index}`, valor_total: index + 1 })), [2024]);
  assert.equal(products.length, 125);
  assert.equal(products[0].code, 'P124');
});

test('opportunities compare the requested base and target, including discontinued items', () => {
  const products = buildProductComparison([
    row({ valor_total: 100 }), row({ ano: 2025, valor_total: 9999 }),
    row({ ano: 2026, valor_total: 150 }),
    row({ cod_referencia: 'LOST', valor_total: 80 }),
    row({ cod_referencia: 'NEW', ano: 2026, valor_total: 200 }),
    row({ cod_referencia: 'FLAT', valor_total: 50 }), row({ cod_referencia: 'FLAT', ano: 2026, valor_total: 50 }),
  ], [2024, 2025, 2026]);
  const changes = buildComparisonOpportunities(products, 2024, 2026);
  assert.equal(changes.length, 3);
  assert.equal(changes[0].product.code, 'NEW');
  assert.equal(changes.find((item) => item.product.code === 'P1').deltaRevenue, 50);
  assert.equal(changes.find((item) => item.product.code === 'LOST').deltaRevenue, -80);
});

test('growth percentages distinguish absent bases, declines and real zero changes', () => {
  assert.equal(comparisonDelta(100, 0), null);
  assert.equal(comparisonDelta(0, 0), null);
  assert.equal(comparisonDelta(150, 100), 50);
  assert.equal(comparisonDelta(0, 100), -100);
  assert.equal(comparisonDelta(100, 100), 0);
});

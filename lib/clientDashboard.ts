import { MONTH_LABELS } from '@/types/sales';
import type {
  ClientDashboardSummaryRow,
  ClientMonthlyTrendPoint,
  ClientMonthlyTrendRow,
  ClientOpportunity,
  ClientProductSummary,
  ClientRecentOrder,
  ClientRecentOrderRow,
  ClientSalesRow,
  ClientTopProductRow,
  ClientVisitDashboardData,
  ClientVisitInsight,
  ClientYearHistoryPoint,
  ClientYearlyHistoryRow,
} from '@/types/clientDashboard';

function toNumber(value: number | null | undefined) {
  return Number(value ?? 0);
}

function toDateTime(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).getTime() : 0;
}

function formatPercentChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function getOrderKey(row: ClientSalesRow) {
  const rawCode =
    row.codigo_pedido?.trim() ||
    row.numero_pedido_talao?.trim() ||
    row.pedido_cliente_opc?.trim();

  if (rawCode) {
    return `${row.data_pedido ?? 'sem-data'}-${rawCode}`;
  }

  return `${row.data_pedido ?? 'sem-data'}-${row.cod_referencia}`;
}

function getOrderDisplayCode(row: ClientSalesRow) {
  return (
    row.codigo_pedido?.trim() ||
    row.numero_pedido_talao?.trim() ||
    row.pedido_cliente_opc?.trim() ||
    'Sem código'
  );
}

function getUniqueOrdersCount(rows: ClientSalesRow[]) {
  return new Set(rows.map(getOrderKey)).size;
}

function getUniqueProductsCount(rows: ClientSalesRow[]) {
  return new Set(rows.map((row) => row.cod_referencia)).size;
}

function buildMonthlyTrend(
  currentRows: ClientSalesRow[],
  previousRows: ClientSalesRow[]
): ClientMonthlyTrendPoint[] {
  return MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    const currentMonthRows = currentRows.filter((row) => row.mes === month);
    const previousMonthRows = previousRows.filter((row) => row.mes === month);

    return {
      month,
      label,
      revenue: currentMonthRows.reduce((sum, row) => sum + toNumber(row.valor_total), 0),
      previousRevenue: previousMonthRows.reduce((sum, row) => sum + toNumber(row.valor_total), 0),
      units: currentMonthRows.reduce((sum, row) => sum + toNumber(row.quantidade), 0),
      previousUnits: previousMonthRows.reduce((sum, row) => sum + toNumber(row.quantidade), 0),
      orders: getUniqueOrdersCount(currentMonthRows),
      previousOrders: getUniqueOrdersCount(previousMonthRows),
    };
  });
}

function buildYearHistory(rows: ClientSalesRow[]): ClientYearHistoryPoint[] {
  const yearMap = new Map<number, ClientYearHistoryPoint & { orderKeys: Set<string>; productsSet: Set<string> }>();

  rows.forEach((row) => {
    const existing = yearMap.get(row.ano) ?? {
      year: row.ano,
      revenue: 0,
      units: 0,
      orders: 0,
      products: 0,
      orderKeys: new Set<string>(),
      productsSet: new Set<string>(),
    };

    existing.revenue += toNumber(row.valor_total);
    existing.units += toNumber(row.quantidade);
    existing.orderKeys.add(getOrderKey(row));
    existing.productsSet.add(row.cod_referencia);

    existing.orders = existing.orderKeys.size;
    existing.products = existing.productsSet.size;

    yearMap.set(row.ano, existing);
  });

  return Array.from(yearMap.values())
    .map(({ orderKeys: _orderKeys, productsSet: _productsSet, ...item }) => item)
    .sort((a, b) => b.year - a.year);
}

function buildProductSummaries(
  currentRows: ClientSalesRow[],
  previousRows: ClientSalesRow[]
): ClientProductSummary[] {
  const productMap = new Map<
    string,
    ClientProductSummary & { orderKeys: Set<string> }
  >();

  currentRows.forEach((row) => {
    const existing = productMap.get(row.cod_referencia) ?? {
      cod_referencia: row.cod_referencia,
      descr_produto: row.descr_produto,
      revenue: 0,
      previousRevenue: 0,
      units: 0,
      previousUnits: 0,
      orderCount: 0,
      shareOfRevenue: 0,
      shareOfUnits: 0,
      lastPurchaseDate: row.data_pedido,
      trend: 'flat' as const,
      orderKeys: new Set<string>(),
    };

    existing.revenue += toNumber(row.valor_total);
    existing.units += toNumber(row.quantidade);
    existing.orderKeys.add(getOrderKey(row));

    if (!existing.lastPurchaseDate || toDateTime(row.data_pedido) > toDateTime(existing.lastPurchaseDate)) {
      existing.lastPurchaseDate = row.data_pedido;
    }

    productMap.set(row.cod_referencia, existing);
  });

  previousRows.forEach((row) => {
    const existing = productMap.get(row.cod_referencia) ?? {
      cod_referencia: row.cod_referencia,
      descr_produto: row.descr_produto,
      revenue: 0,
      previousRevenue: 0,
      units: 0,
      previousUnits: 0,
      orderCount: 0,
      shareOfRevenue: 0,
      shareOfUnits: 0,
      lastPurchaseDate: row.data_pedido,
      trend: 'flat' as const,
      orderKeys: new Set<string>(),
    };

    existing.previousRevenue += toNumber(row.valor_total);
    existing.previousUnits += toNumber(row.quantidade);
    productMap.set(row.cod_referencia, existing);
  });

  const totalRevenue = currentRows.reduce((sum, row) => sum + toNumber(row.valor_total), 0);
  const totalUnits = currentRows.reduce((sum, row) => sum + toNumber(row.quantidade), 0);

  return Array.from(productMap.values())
    .map(({ orderKeys, ...item }) => {
      const trend: ClientProductSummary['trend'] =
        item.previousRevenue === 0 && item.revenue > 0
          ? 'new'
          : item.revenue > item.previousRevenue * 1.05
            ? 'up'
            : item.revenue < item.previousRevenue * 0.95
              ? 'down'
              : 'flat';

      return {
        ...item,
        orderCount: orderKeys.size,
        shareOfRevenue: totalRevenue > 0 ? item.revenue / totalRevenue : 0,
        shareOfUnits: totalUnits > 0 ? item.units / totalUnits : 0,
        trend,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

function buildOpportunities(products: ClientProductSummary[]) {
  // Atenção: apenas produtos cuja receita CAIU em relação ao período anterior
  // (usa receita como métrica — mesma base de growthProducts, eliminando assimetria).
  // Produtos estáveis (revenue === previousRevenue) são excluídos propositalmente
  // (operador < em vez de <=).
  const attentionProducts: ClientOpportunity[] = products
    .filter((product) => product.previousRevenue > 0 && product.revenue < product.previousRevenue)
    .map((product) => ({
      cod_referencia: product.cod_referencia,
      descr_produto: product.descr_produto,
      currentUnits: product.units,
      previousUnits: product.previousUnits,
      currentRevenue: product.revenue,
      previousRevenue: product.previousRevenue,
      deltaUnits: product.units - product.previousUnits,
      deltaRevenue: product.revenue - product.previousRevenue,
      reason: (product.revenue === 0 ? 'sem_recompra' : 'queda') as ClientOpportunity['reason'],
    }))
    .sort((a, b) =>
      Math.abs(b.deltaRevenue) - Math.abs(a.deltaRevenue) ||
      Math.abs(b.deltaUnits) - Math.abs(a.deltaUnits)
    )
    .slice(0, 6);

  // Em alta: produtos cuja receita CRESCEU em relação ao período anterior.
  // Ordenação por deltaRevenue descendente — mesma métrica que attentionProducts.
  const growthProducts: ClientOpportunity[] = products
    .filter((product) => product.revenue > product.previousRevenue)
    .map((product) => ({
      cod_referencia: product.cod_referencia,
      descr_produto: product.descr_produto,
      currentUnits: product.units,
      previousUnits: product.previousUnits,
      currentRevenue: product.revenue,
      previousRevenue: product.previousRevenue,
      deltaUnits: product.units - product.previousUnits,
      deltaRevenue: product.revenue - product.previousRevenue,
      reason: (product.previousRevenue === 0 ? 'oportunidade' : 'em_alta') as ClientOpportunity['reason'],
    }))
    .sort((a, b) => b.deltaRevenue - a.deltaRevenue || b.deltaUnits - a.deltaUnits)
    .slice(0, 6);

  return { attentionProducts, growthProducts };
}

function buildRecentOrders(rows: ClientSalesRow[]): ClientRecentOrder[] {
  const orderMap = new Map<
    string,
    ClientRecentOrder & { products: Map<string, number> }
  >();

  rows.forEach((row) => {
    if (!row.data_pedido) return;

    const key = getOrderKey(row);
    const existing = orderMap.get(key) ?? {
      orderKey: key,
      orderCode: getOrderDisplayCode(row),
      orderDate: row.data_pedido,
      revenue: 0,
      units: 0,
      lineCount: 0,
      highlights: [],
      products: new Map<string, number>(),
    };

    existing.revenue += toNumber(row.valor_total);
    existing.units += toNumber(row.quantidade);
    existing.lineCount += 1;
    existing.products.set(
      row.descr_produto,
      (existing.products.get(row.descr_produto) ?? 0) + toNumber(row.valor_total)
    );

    orderMap.set(key, existing);
  });

  return Array.from(orderMap.values())
    .map(({ products, ...order }) => ({
      ...order,
      highlights: Array.from(products.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([label]) => label),
    }))
    .sort((a, b) => toDateTime(b.orderDate) - toDateTime(a.orderDate))
    .slice(0, 8);
}

function buildInsights(
  summary: ClientVisitDashboardData['summary'],
  topProducts: ClientProductSummary[],
  attentionProducts: ClientOpportunity[],
  growthProducts: ClientOpportunity[]
): ClientVisitInsight[] {
  const revenueDelta = formatPercentChange(summary.totalRevenue, summary.previousRevenue);
  const leadProduct = topProducts[0];

  const insights: ClientVisitInsight[] = [
    revenueDelta > 5
      ? {
          title: 'Cliente acelerando',
          description: `O faturamento do ano está ${revenueDelta.toFixed(1)}% acima do período anterior.`,
          tone: 'positive',
        }
      : revenueDelta < -5
        ? {
            title: 'Atenção para retração',
            description: `O cliente está ${Math.abs(revenueDelta).toFixed(1)}% abaixo do período anterior no ano selecionado.`,
            tone: 'warning',
          }
        : {
            title: 'Ritmo estável',
            description: 'O volume do ano está próximo ao período anterior, sem grande oscilação.',
            tone: 'neutral',
          },
  ];

  if (leadProduct) {
    insights.push({
      title: 'Produto âncora da conversa',
      description: `${leadProduct.cod_referencia} responde por ${(leadProduct.shareOfRevenue * 100).toFixed(1)}% do faturamento do cliente neste ano.`,
      tone: leadProduct.shareOfRevenue > 0.35 ? 'warning' : 'neutral',
    });
  }

  if (attentionProducts[0]) {
    insights.push({
      title: 'Produto que esfriou',
      description: `${attentionProducts[0].cod_referencia} caiu ${Math.abs(attentionProducts[0].deltaUnits).toLocaleString('pt-BR')} unidades versus o período anterior.`,
      tone: 'warning',
    });
  }

  if (growthProducts[0]) {
    insights.push({
      title: 'Janela de expansão',
      description: `${growthProducts[0].cod_referencia} cresceu ${growthProducts[0].deltaRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} e pode puxar novas ofertas.`,
      tone: 'positive',
    });
  }

  return insights.slice(0, 4);
}

export function buildClientVisitDashboard(
  rows: ClientSalesRow[],
  selectedYear: number
): ClientVisitDashboardData {
  const sortedRows = [...rows].sort((a, b) => toDateTime(a.data_pedido) - toDateTime(b.data_pedido));
  const currentRows = sortedRows.filter((row) => row.ano === selectedYear);
  const previousRows = sortedRows.filter((row) => row.ano === selectedYear - 1);

  const monthlyTrend = buildMonthlyTrend(currentRows, previousRows);
  const yearlyHistory = buildYearHistory(sortedRows);
  const topProducts = buildProductSummaries(currentRows, previousRows);
  const { attentionProducts, growthProducts } = buildOpportunities(topProducts);
  const recentOrders = buildRecentOrders(sortedRows);

  const totalRevenue = currentRows.reduce((sum, row) => sum + toNumber(row.valor_total), 0);
  const previousRevenue = previousRows.reduce((sum, row) => sum + toNumber(row.valor_total), 0);
  const totalUnits = currentRows.reduce((sum, row) => sum + toNumber(row.quantidade), 0);
  const previousUnits = previousRows.reduce((sum, row) => sum + toNumber(row.quantidade), 0);
  const orderCount = getUniqueOrdersCount(currentRows);
  const previousOrderCount = getUniqueOrdersCount(previousRows);
  const uniqueProducts = getUniqueProductsCount(currentRows);
  const previousUniqueProducts = getUniqueProductsCount(previousRows);
  const lifetimeRevenue = sortedRows.reduce((sum, row) => sum + toNumber(row.valor_total), 0);
  const lifetimeOrders = getUniqueOrdersCount(sortedRows);
  const activeMonths = monthlyTrend.filter((point) => point.revenue > 0).length;
  const bestMonth = [...monthlyTrend].sort((a, b) => b.revenue - a.revenue)[0];
  const lastOrderDate = sortedRows.length > 0 ? sortedRows[sortedRows.length - 1].data_pedido : null;

  const summary = {
    totalRevenue,
    previousRevenue,
    totalUnits,
    previousUnits,
    orderCount,
    previousOrderCount,
    uniqueProducts,
    previousUniqueProducts,
    averageTicket: orderCount > 0 ? totalRevenue / orderCount : 0,
    previousAverageTicket: previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0,
    activeMonths,
    bestMonthLabel: bestMonth?.label ?? MONTH_LABELS[0],
    lastOrderDate,
    lifetimeRevenue,
    lifetimeOrders,
    yearsActive: yearlyHistory.length,
  };

  return {
    summary,
    monthlyTrend,
    yearlyHistory,
    allProducts: topProducts,
    topProducts: topProducts.slice(0, 8),
    attentionProducts,
    growthProducts,
    recentOrders,
    insights: buildInsights(summary, topProducts, attentionProducts, growthProducts),
  };
}

// ─── Builder a partir de RPCs agregadas (caminho otimizado) ──────────────────
//
// Monta o mesmo DTO ClientVisitDashboardData sem varrer as linhas brutas.
// A UI e o SharedDashboardClientView consomem exatamente o mesmo contrato.

export function buildClientVisitDashboardFromAggregates(
  summaryRows: ClientDashboardSummaryRow[],
  trendRows: ClientMonthlyTrendRow[],
  yearlyRows: ClientYearlyHistoryRow[],
  productRows: ClientTopProductRow[],
  recentOrderRows: ClientRecentOrderRow[],
  selectedYear: number
): ClientVisitDashboardData {
  // Separar período corrente do anterior
  const current = summaryRows.find((r) => r.periodo === 'current');
  const previous = summaryRows.find((r) => r.periodo === 'previous');

  const totalRevenue      = toNumber(current?.total_faturado);
  const previousRevenue   = toNumber(previous?.total_faturado);
  const totalUnits        = toNumber(current?.total_unidades);
  const previousUnits     = toNumber(previous?.total_unidades);
  const orderCount        = toNumber(current?.total_pedidos);
  const previousOrderCount = toNumber(previous?.total_pedidos);
  const uniqueProducts    = toNumber(current?.total_produtos);
  const previousUniqueProducts = toNumber(previous?.total_produtos);
  const activeMonths      = toNumber(current?.meses_ativos);
  const lifetimeRevenue   = toNumber(current?.faturamento_vitalicio ?? previous?.faturamento_vitalicio);
  const lifetimeOrders    = toNumber(current?.pedidos_vitalicios ?? previous?.pedidos_vitalicios);
  const yearsActive       = toNumber(current?.anos_ativos ?? previous?.anos_ativos ?? yearlyRows.length);
  const lastOrderDate     = current?.ultimo_pedido ?? previous?.ultimo_pedido ?? null;

  // Melhor mês: usar o calculado pela RPC (1-based); fallback pela tendência mensal
  let bestMonthIndex = 0; // índice 0-based para MONTH_LABELS
  if (current?.melhor_mes != null && current.melhor_mes >= 1 && current.melhor_mes <= 12) {
    bestMonthIndex = current.melhor_mes - 1;
  } else {
    const bestTrend = trendRows
      .filter((r) => r.ano === selectedYear)
      .reduce<ClientMonthlyTrendRow | null>(
        (best, r) => (r.total_faturado > (best?.total_faturado ?? -1) ? r : best),
        null
      );
    if (bestTrend?.mes != null) {
      bestMonthIndex = bestTrend.mes - 1;
    }
  }

  const bestMonthLabel = MONTH_LABELS[Math.max(0, Math.min(bestMonthIndex, 11))] ?? MONTH_LABELS[0];

  // Tendência mensal: 12 pontos para cada ano, preenchendo os meses sem dados com zero
  const trendByKey = new Map<string, ClientMonthlyTrendRow>();
  trendRows.forEach((r) => trendByKey.set(`${r.ano}-${r.mes}`, r));

  const monthlyTrend: ClientMonthlyTrendPoint[] = MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    const curr = trendByKey.get(`${selectedYear}-${month}`);
    const prev = trendByKey.get(`${selectedYear - 1}-${month}`);
    return {
      month,
      label,
      revenue:         toNumber(curr?.total_faturado),
      previousRevenue: toNumber(prev?.total_faturado),
      units:           toNumber(curr?.total_unidades),
      previousUnits:   toNumber(prev?.total_unidades),
      orders:          toNumber(curr?.total_pedidos),
      previousOrders:  toNumber(prev?.total_pedidos),
    };
  });

  // Histórico anual
  const yearlyHistory: ClientYearHistoryPoint[] = yearlyRows.map((r) => ({
    year:     r.ano,
    revenue:  toNumber(r.total_faturado),
    units:    toNumber(r.total_unidades),
    orders:   toNumber(r.total_pedidos),
    products: toNumber(r.total_produtos),
  }));

  // Produtos: agrupar por cod_referencia, separando corrente do anterior
  const productsByCod = new Map<
    string,
    ClientProductSummary & { orderKeys?: unknown }
  >();

  productRows.forEach((r) => {
    const isCurrent = r.ano === selectedYear;
    const existing = productsByCod.get(r.cod_referencia) ?? {
      cod_referencia:  r.cod_referencia,
      descr_produto:   r.descr_produto,
      revenue:         0,
      previousRevenue: 0,
      units:           0,
      previousUnits:   0,
      orderCount:      0,
      shareOfRevenue:  0,
      shareOfUnits:    0,
      lastPurchaseDate: r.ultimo_pedido,
      trend:           'flat' as const,
    };

    if (isCurrent) {
      existing.revenue    += toNumber(r.total_faturado);
      existing.units      += toNumber(r.total_unidades);
      existing.orderCount += toNumber(r.total_pedidos);
      if (
        r.ultimo_pedido &&
        (!existing.lastPurchaseDate ||
          r.ultimo_pedido > existing.lastPurchaseDate)
      ) {
        existing.lastPurchaseDate = r.ultimo_pedido;
      }
    } else {
      existing.previousRevenue += toNumber(r.total_faturado);
      existing.previousUnits   += toNumber(r.total_unidades);
    }

    productsByCod.set(r.cod_referencia, existing);
  });

  const allProductsList: ClientProductSummary[] = Array.from(productsByCod.values())
    .map((p) => {
      const trend: ClientProductSummary['trend'] =
        p.previousRevenue === 0 && p.revenue > 0
          ? 'new'
          : p.revenue > p.previousRevenue * 1.05
          ? 'up'
          : p.revenue < p.previousRevenue * 0.95
          ? 'down'
          : 'flat';

      return {
        ...p,
        shareOfRevenue: totalRevenue > 0 ? p.revenue / totalRevenue : 0,
        shareOfUnits:   totalUnits > 0 ? p.units / totalUnits : 0,
        trend,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units);

  const { attentionProducts, growthProducts } = buildOpportunities(allProductsList);

  // Pedidos recentes a partir das linhas da RPC
  const recentOrders: ClientRecentOrder[] = recentOrderRows
    .filter((r) => r.data_pedido != null)
    .map((r) => ({
      orderKey:  `${r.data_pedido}-${r.codigo_pedido ?? r.produtos_destaque?.[0] ?? ''}`,
      orderCode: r.codigo_pedido ?? 'Sem código',
      orderDate: r.data_pedido!,
      revenue:   toNumber(r.total_faturado),
      units:     toNumber(r.total_unidades),
      lineCount: toNumber(r.total_linhas),
      highlights: (r.produtos_destaque ?? []).slice(0, 2),
    }));

  const summary = {
    totalRevenue,
    previousRevenue,
    totalUnits,
    previousUnits,
    orderCount,
    previousOrderCount,
    uniqueProducts,
    previousUniqueProducts,
    averageTicket:         orderCount > 0 ? totalRevenue / orderCount : 0,
    previousAverageTicket: previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0,
    activeMonths,
    bestMonthLabel,
    lastOrderDate,
    lifetimeRevenue,
    lifetimeOrders,
    yearsActive,
  };

  return {
    summary,
    monthlyTrend,
    yearlyHistory,
    allProducts: allProductsList,
    topProducts: allProductsList.slice(0, 8),
    attentionProducts,
    growthProducts,
    recentOrders,
    insights: buildInsights(summary, allProductsList, attentionProducts, growthProducts),
  };
}

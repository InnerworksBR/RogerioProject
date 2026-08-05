-- Autimex Reports — correção isolada de chat_recent_orders.
-- Execute depois de 0023_client_groups_and_account_scope.sql.
-- Corrige PostgreSQL 42803 separando linhas brutas da consulta agregada.

CREATE OR REPLACE FUNCTION chat_recent_orders(p_cod_cliente TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (
  codigo_pedido TEXT,
  data_pedido DATE,
  total_faturado NUMERIC,
  total_unidades NUMERIC,
  produtos_destaque TEXT[]
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH authorized_owners AS (
    SELECT auth.uid() AS user_id
    UNION
    SELECT profile.id
    FROM profiles profile
    WHERE profile.leader_id = auth.uid()
  ), lines AS (
    SELECT
      COALESCE(
        NULLIF(TRIM(sales.codigo_pedido), ''),
        NULLIF(TRIM(sales.numero_pedido_talao), ''),
        NULLIF(TRIM(sales.pedido_cliente_opc), ''),
        sales.cod_referencia
      ) AS codigo_pedido,
      sales.user_id::TEXT || ':' ||
        COALESCE(sales.data_pedido::TEXT, 'sem-data') || ':' ||
        COALESCE(
          NULLIF(TRIM(sales.codigo_pedido), ''),
          NULLIF(TRIM(sales.numero_pedido_talao), ''),
          NULLIF(TRIM(sales.pedido_cliente_opc), ''),
          sales.cod_referencia
        ) AS order_key,
      sales.data_pedido,
      sales.valor_total,
      sales.quantidade,
      sales.descr_produto
    FROM sales_rows sales
    JOIN authorized_owners owner ON owner.user_id = sales.user_id
    WHERE sales.cod_cliente IN (
      SELECT code.cod_cliente
      FROM resolve_client_codes(p_cod_cliente) code
    )
  ), grouped AS (
    SELECT
      MIN(lines.codigo_pedido) AS codigo_pedido,
      MAX(lines.data_pedido) AS data_pedido,
      COALESCE(SUM(lines.valor_total), 0) AS total_faturado,
      COALESCE(SUM(lines.quantidade), 0) AS total_unidades,
      (ARRAY_AGG(lines.descr_produto ORDER BY lines.valor_total DESC NULLS LAST))[1:5]
        AS produtos_destaque
    FROM lines
    GROUP BY lines.order_key
  )
  SELECT
    grouped.codigo_pedido,
    grouped.data_pedido,
    grouped.total_faturado,
    grouped.total_unidades,
    grouped.produtos_destaque
  FROM grouped
  ORDER BY grouped.data_pedido DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

REVOKE ALL ON FUNCTION chat_recent_orders(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION chat_recent_orders(TEXT, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';

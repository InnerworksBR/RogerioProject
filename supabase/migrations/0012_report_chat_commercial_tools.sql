-- Controlled commercial toolkit for the AI report chat.
CREATE OR REPLACE FUNCTION chat_can_read_sales_owner(p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles profile
      WHERE profile.id = p_owner_id
        AND profile.leader_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION chat_can_read_sales_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION chat_can_read_sales_owner(UUID) TO authenticated;
REVOKE ALL ON FUNCTION chat_can_read_sales_owner(UUID) FROM anon;

CREATE INDEX IF NOT EXISTS idx_sales_user_year_client
  ON sales_rows(user_id, ano, cod_cliente);

CREATE INDEX IF NOT EXISTS idx_sales_user_date_client
  ON sales_rows(user_id, data_pedido, cod_cliente);

CREATE OR REPLACE FUNCTION chat_top_clients(
  p_ano INT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  cod_cliente TEXT,
  nome_cliente TEXT,
  total_faturado NUMERIC,
  total_pedidos BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sales.cod_cliente,
    MAX(sales.nome_cliente) AS nome_cliente,
    COALESCE(SUM(sales.valor_total), 0) AS total_faturado,
    COUNT(DISTINCT sales.codigo_pedido) AS total_pedidos
  FROM sales_rows sales
  WHERE sales.ano = p_ano
    AND chat_can_read_sales_owner(sales.user_id)
  GROUP BY sales.cod_cliente
  ORDER BY total_faturado DESC, nome_cliente ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

CREATE OR REPLACE FUNCTION chat_resolve_client(
  p_query TEXT,
  p_limit INT DEFAULT 8
)
RETURNS TABLE (
  cod_cliente TEXT,
  nome_cliente TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sales.cod_cliente,
    MAX(sales.nome_cliente) AS nome_cliente
  FROM sales_rows sales
  WHERE chat_can_read_sales_owner(sales.user_id)
    AND (
      LOWER(sales.cod_cliente) = LOWER(TRIM(p_query))
      OR LOWER(sales.nome_cliente) = LOWER(TRIM(p_query))
      OR LOWER(sales.cod_cliente) LIKE '%' || LOWER(TRIM(p_query)) || '%'
      OR LOWER(sales.nome_cliente) LIKE '%' || LOWER(TRIM(p_query)) || '%'
    )
  GROUP BY sales.cod_cliente
  ORDER BY
    CASE
      WHEN LOWER(sales.cod_cliente) = LOWER(TRIM(p_query)) THEN 0
      WHEN LOWER(MAX(sales.nome_cliente)) = LOWER(TRIM(p_query)) THEN 1
      ELSE 2
    END,
    nome_cliente ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 8);
$$;

CREATE OR REPLACE FUNCTION chat_top_products(
  p_ano INT,
  p_cod_cliente TEXT DEFAULT NULL,
  p_semestre INT DEFAULT NULL,
  p_descr_hist_financ TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  cod_referencia TEXT,
  descr_produto TEXT,
  total_faturado NUMERIC,
  total_unidades NUMERIC,
  total_pedidos BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sales.cod_referencia,
    MAX(sales.descr_produto) AS descr_produto,
    COALESCE(SUM(sales.valor_total), 0) AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0) AS total_unidades,
    COUNT(DISTINCT sales.codigo_pedido) AS total_pedidos
  FROM sales_rows sales
  WHERE sales.ano = p_ano
    AND chat_can_read_sales_owner(sales.user_id)
    AND (p_cod_cliente IS NULL OR sales.cod_cliente = p_cod_cliente)
    AND (p_semestre IS NULL OR (p_semestre = 1 AND sales.mes BETWEEN 1 AND 6) OR (p_semestre = 2 AND sales.mes BETWEEN 7 AND 12))
    AND (p_descr_hist_financ IS NULL OR sales.descr_hist_financ = p_descr_hist_financ)
  GROUP BY sales.cod_referencia
  ORDER BY total_faturado DESC, descr_produto ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

CREATE OR REPLACE FUNCTION chat_sales_trend(
  p_start_year INT,
  p_end_year INT,
  p_cod_cliente TEXT DEFAULT NULL,
  p_cod_referencia TEXT DEFAULT NULL
)
RETURNS TABLE (
  ano SMALLINT,
  mes SMALLINT,
  total_faturado NUMERIC,
  total_unidades NUMERIC,
  total_pedidos BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sales.ano,
    sales.mes,
    COALESCE(SUM(sales.valor_total), 0) AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0) AS total_unidades,
    COUNT(DISTINCT sales.codigo_pedido) AS total_pedidos
  FROM sales_rows sales
  WHERE sales.ano BETWEEN p_start_year AND p_end_year
    AND p_end_year >= p_start_year
    AND p_end_year - p_start_year <= 4
    AND chat_can_read_sales_owner(sales.user_id)
    AND (p_cod_cliente IS NULL OR sales.cod_cliente = p_cod_cliente)
    AND (p_cod_referencia IS NULL OR sales.cod_referencia = p_cod_referencia)
  GROUP BY sales.ano, sales.mes
  ORDER BY sales.ano ASC, sales.mes ASC;
$$;

CREATE OR REPLACE FUNCTION chat_recent_orders(
  p_cod_cliente TEXT,
  p_limit INT DEFAULT 10
)
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
SET search_path = public
AS $$
  SELECT
    sales.codigo_pedido,
    MAX(sales.data_pedido) AS data_pedido,
    COALESCE(SUM(sales.valor_total), 0) AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0) AS total_unidades,
    (ARRAY_AGG(DISTINCT sales.descr_produto ORDER BY sales.descr_produto))[1:5] AS produtos_destaque
  FROM sales_rows sales
  WHERE sales.cod_cliente = p_cod_cliente
    AND chat_can_read_sales_owner(sales.user_id)
    AND sales.codigo_pedido IS NOT NULL
  GROUP BY sales.codigo_pedido
  ORDER BY data_pedido DESC NULLS LAST, sales.codigo_pedido DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

CREATE OR REPLACE FUNCTION chat_inactive_clients(
  p_reference_date DATE,
  p_inactive_days INT DEFAULT 90,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  cod_cliente TEXT,
  nome_cliente TEXT,
  ultima_compra DATE,
  dias_sem_pedido INT,
  faturamento_historico NUMERIC,
  total_pedidos BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH authorized_owners AS (
    SELECT auth.uid() AS user_id
    UNION
    SELECT profile.id
    FROM profiles profile
    WHERE profile.leader_id = auth.uid()
  )
  SELECT
    sales.cod_cliente,
    MAX(sales.nome_cliente) AS nome_cliente,
    MAX(sales.data_pedido) AS ultima_compra,
    p_reference_date - MAX(sales.data_pedido) AS dias_sem_pedido,
    COALESCE(SUM(sales.valor_total), 0) AS faturamento_historico,
    COUNT(DISTINCT sales.codigo_pedido) AS total_pedidos
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  WHERE TRUE
    AND sales.data_pedido IS NOT NULL
  GROUP BY sales.cod_cliente
  HAVING MAX(sales.data_pedido) <= p_reference_date - LEAST(GREATEST(COALESCE(p_inactive_days, 90), 1), 3650)
  ORDER BY dias_sem_pedido DESC, faturamento_historico DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

CREATE OR REPLACE FUNCTION chat_rep_performance(
  p_ano INT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  rep_id UUID,
  rep_email TEXT,
  total_faturado NUMERIC,
  total_pedidos BIGINT,
  total_clientes BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sales.user_id AS rep_id,
    users.email AS rep_email,
    COALESCE(SUM(sales.valor_total), 0) AS total_faturado,
    COUNT(DISTINCT sales.codigo_pedido) AS total_pedidos,
    COUNT(DISTINCT sales.cod_cliente) AS total_clientes
  FROM sales_rows sales
  JOIN auth.users users ON users.id = sales.user_id
  WHERE sales.ano = p_ano
    AND chat_can_read_sales_owner(sales.user_id)
  GROUP BY sales.user_id, users.email
  ORDER BY total_faturado DESC, rep_email ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

REVOKE ALL ON FUNCTION chat_top_clients(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_resolve_client(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_top_products(INT, TEXT, INT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_sales_trend(INT, INT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_recent_orders(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_inactive_clients(DATE, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_rep_performance(INT, INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION chat_top_clients(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION chat_resolve_client(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION chat_top_products(INT, TEXT, INT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION chat_sales_trend(INT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION chat_recent_orders(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION chat_inactive_clients(DATE, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION chat_rep_performance(INT, INT) TO authenticated;

REVOKE ALL ON FUNCTION chat_top_clients(INT, INT) FROM anon;
REVOKE ALL ON FUNCTION chat_resolve_client(TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION chat_top_products(INT, TEXT, INT, TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION chat_sales_trend(INT, INT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION chat_recent_orders(TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION chat_inactive_clients(DATE, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION chat_rep_performance(INT, INT) FROM anon;

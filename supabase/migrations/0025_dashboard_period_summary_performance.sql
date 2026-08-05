-- Resumo de um periodo sem a segunda varredura global de sales_rows.
--
-- A dashboard_summary historica sempre recalcula todos os anos disponiveis,
-- mesmo quando o consumidor ja consultou get_distinct_years e informou p_ano.
-- No volume de producao, essa leitura duplicada ultrapassa o statement_timeout
-- do PostgREST. A nova RPC e aditiva, preserva a funcao anterior para clientes
-- antigos e mantem RLS/escopo da sessao por ser SECURITY INVOKER (padrao).

CREATE OR REPLACE FUNCTION dashboard_period_summary(
  p_ano INT,
  p_cod_cliente TEXT DEFAULT NULL,
  p_cod_referencia TEXT DEFAULT NULL,
  p_semestre INT DEFAULT NULL,
  p_descr_hist_financ TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_pedidos BIGINT,
  total_faturado NUMERIC,
  num_clientes BIGINT,
  num_produtos BIGINT,
  total_unidades NUMERIC,
  data_inicio DATE,
  data_fim DATE,
  anos_disponiveis INT[]
)
LANGUAGE SQL
STABLE
AS $$
  WITH request_context AS MATERIALIZED (
    SELECT current_account_owner_id() AS account_owner_id
  )
  SELECT
    COUNT(DISTINCT sales.codigo_pedido),
    COALESCE(SUM(sales.valor_total), 0),
    COUNT(DISTINCT COALESCE('group:' || member.group_id::TEXT, sales.cod_cliente)),
    COUNT(DISTINCT sales.cod_referencia),
    COALESCE(SUM(sales.quantidade), 0),
    MIN(sales.data_pedido),
    MAX(sales.data_pedido),
    CASE WHEN COUNT(*) > 0 THEN ARRAY[p_ano]::INT[] ELSE '{}'::INT[] END
  FROM sales_rows sales
  CROSS JOIN request_context context
  LEFT JOIN client_group_members member
    ON member.account_owner_id = context.account_owner_id
   AND member.cod_cliente = sales.cod_cliente
  WHERE sales.ano = p_ano
    AND (
      p_cod_cliente IS NULL
      OR sales.cod_cliente IN (
        SELECT code.cod_cliente FROM resolve_client_codes(p_cod_cliente) code
      )
    )
    AND (p_cod_referencia IS NULL OR sales.cod_referencia = p_cod_referencia)
    AND (
      p_semestre IS NULL
      OR (p_semestre = 1 AND sales.mes BETWEEN 1 AND 6)
      OR (p_semestre = 2 AND sales.mes BETWEEN 7 AND 12)
    )
    AND (
      p_descr_hist_financ IS NULL
      OR sales.descr_hist_financ = p_descr_hist_financ
    );
$$;

REVOKE ALL ON FUNCTION dashboard_period_summary(INT, TEXT, TEXT, INT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dashboard_period_summary(INT, TEXT, TEXT, INT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION dashboard_period_summary(INT, TEXT, TEXT, INT, TEXT) IS
  'Resumo de um unico ano; anos disponiveis devem ser obtidos por get_distinct_years.';

NOTIFY pgrst, 'reload schema';

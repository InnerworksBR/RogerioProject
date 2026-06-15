-- Make AI chat client lookup tolerant of formatted codes and punctuation.
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
  WITH normalized AS (
    SELECT
      NULLIF(LOWER(TRIM(p_query)), '') AS query_text,
      NULLIF(REGEXP_REPLACE(LOWER(TRIM(p_query)), '[^a-z0-9]+', '', 'g'), '') AS query_compact,
      NULLIF(REGEXP_REPLACE(TRIM(p_query), '[^0-9]+', '', 'g'), '') AS query_digits
  )
  SELECT
    sales.cod_cliente,
    MAX(sales.nome_cliente) AS nome_cliente
  FROM sales_rows sales
  CROSS JOIN normalized query
  WHERE chat_can_read_sales_owner(sales.user_id)
    AND query.query_text IS NOT NULL
    AND (
      LOWER(sales.cod_cliente) = query.query_text
      OR LOWER(sales.nome_cliente) = query.query_text
      OR LOWER(sales.cod_cliente) LIKE '%' || query.query_text || '%'
      OR LOWER(sales.nome_cliente) LIKE '%' || query.query_text || '%'
      OR REGEXP_REPLACE(LOWER(sales.cod_cliente), '[^a-z0-9]+', '', 'g') = query.query_compact
      OR REGEXP_REPLACE(LOWER(sales.nome_cliente), '[^a-z0-9]+', '', 'g') LIKE '%' || query.query_compact || '%'
      OR REGEXP_REPLACE(sales.cod_cliente, '[^0-9]+', '', 'g') = query.query_digits
    )
  GROUP BY sales.cod_cliente, query.query_text, query.query_compact, query.query_digits
  ORDER BY
    CASE
      WHEN LOWER(sales.cod_cliente) = query.query_text THEN 0
      WHEN REGEXP_REPLACE(sales.cod_cliente, '[^0-9]+', '', 'g') = query.query_digits THEN 1
      WHEN LOWER(MAX(sales.nome_cliente)) = query.query_text THEN 2
      WHEN REGEXP_REPLACE(LOWER(sales.cod_cliente), '[^a-z0-9]+', '', 'g') = query.query_compact THEN 3
      ELSE 4
    END,
    nome_cliente ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 8);
$$;

REVOKE ALL ON FUNCTION chat_resolve_client(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION chat_resolve_client(TEXT, INT) TO authenticated;
REVOKE ALL ON FUNCTION chat_resolve_client(TEXT, INT) FROM anon;

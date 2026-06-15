-- =============================================================
-- Autimex Reports - Auth/RLS hardening and seed support
-- Run this AFTER 0002_rpc_functions.sql
-- =============================================================

-- Replace demo-open policies with authenticated access only
DROP POLICY IF EXISTS "allow_all_uploads" ON uploads;
DROP POLICY IF EXISTS "allow_all_sales" ON sales_rows;
DROP POLICY IF EXISTS "allow_all_config" ON report_config_items;

CREATE POLICY "authenticated_uploads_access"
  ON uploads
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_sales_access"
  ON sales_rows
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_config_access"
  ON report_config_items
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Prevent duplicated seed/application runs for the same report/reference pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_config_unique_report_ref
  ON report_config_items(report_key, cod_referencia)
  WHERE cod_referencia IS NOT NULL;

-- Aggregated product catalog used by seed preview and AI summaries
CREATE OR REPLACE FUNCTION product_catalog()
RETURNS TABLE (
  cod_referencia TEXT,
  descr_produto TEXT,
  total_quantidade NUMERIC,
  total_valor NUMERIC,
  first_year SMALLINT,
  last_year SMALLINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    s.cod_referencia,
    MAX(s.descr_produto) AS descr_produto,
    SUM(s.quantidade) AS total_quantidade,
    SUM(s.valor_total) AS total_valor,
    MIN(s.ano) AS first_year,
    MAX(s.ano) AS last_year
  FROM sales_rows s
  GROUP BY s.cod_referencia
  ORDER BY SUM(s.valor_total) DESC, s.cod_referencia;
$$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sales_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE report_config_items TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

REVOKE ALL ON TABLE uploads FROM anon;
REVOKE ALL ON TABLE sales_rows FROM anon;
REVOKE ALL ON TABLE report_config_items FROM anon;

GRANT EXECUTE ON FUNCTION tabela_dinamica_geral(INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION base_de_compra(INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION base_de_itens(INT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION bagagitos(INT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION geral(INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dashboard_summary(INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_distinct_years() TO authenticated;
GRANT EXECUTE ON FUNCTION get_distinct_clients() TO authenticated;
GRANT EXECUTE ON FUNCTION product_catalog() TO authenticated;

REVOKE ALL ON FUNCTION tabela_dinamica_geral(INT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION base_de_compra(INT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION base_de_itens(INT[]) FROM anon;
REVOKE ALL ON FUNCTION bagagitos(INT[]) FROM anon;
REVOKE ALL ON FUNCTION geral(INT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION dashboard_summary(INT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION get_distinct_years() FROM anon;
REVOKE ALL ON FUNCTION get_distinct_clients() FROM anon;
REVOKE ALL ON FUNCTION product_catalog() FROM anon;

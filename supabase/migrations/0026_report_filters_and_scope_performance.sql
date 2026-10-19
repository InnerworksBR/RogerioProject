-- Filtros não precisam somar o catálogo inteiro de vendas. As consultas abaixo
-- filtram no banco antes de limitar e mantêm o escopo RLS do usuário autenticado.
CREATE OR REPLACE FUNCTION search_products(p_query TEXT DEFAULT '', p_limit INT DEFAULT 40)
RETURNS TABLE (cod_referencia TEXT, descr_produto TEXT)
LANGUAGE SQL STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT sales.cod_referencia, MAX(sales.descr_produto)
  FROM sales_rows sales
  WHERE TRIM(COALESCE(p_query, '')) = ''
    OR sales.cod_referencia ILIKE '%' || TRIM(p_query) || '%'
    OR sales.descr_produto ILIKE '%' || TRIM(p_query) || '%'
  GROUP BY sales.cod_referencia
  ORDER BY sales.cod_referencia
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
$$;

CREATE OR REPLACE FUNCTION get_report_revenue_types()
RETURNS TABLE (descr_hist_financ TEXT)
LANGUAGE SQL STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT sales.descr_hist_financ
  FROM sales_rows sales
  WHERE NULLIF(TRIM(sales.descr_hist_financ), '') IS NOT NULL
  ORDER BY sales.descr_hist_financ;
$$;

REVOKE ALL ON FUNCTION search_products(TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_report_revenue_types() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION search_products(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_report_revenue_types() TO authenticated;

-- Subconsultas escalares viram InitPlans: contexto da sessão calculado uma vez
-- por consulta em vez de uma chamada auth/conta para cada linha examinada.
-- As condições de leitura e escrita são as mesmas das migrations 0004 e 0023.
ALTER POLICY saas_sales_access ON sales_rows
  USING (
    user_id = (SELECT auth.uid())
    OR user_id IN (SELECT id FROM profiles WHERE leader_id = (SELECT auth.uid()))
  )
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY client_groups_read_account ON client_groups
  USING (account_owner_id = (SELECT current_account_owner_id()));
ALTER POLICY client_groups_write_leader ON client_groups
  USING (account_owner_id = (SELECT auth.uid()) AND (SELECT is_current_account_leader()))
  WITH CHECK (
    account_owner_id = (SELECT auth.uid())
    AND created_by = (SELECT auth.uid())
    AND (SELECT is_current_account_leader())
  );
ALTER POLICY client_group_members_read_account ON client_group_members
  USING (account_owner_id = (SELECT current_account_owner_id()));
ALTER POLICY client_group_members_write_leader ON client_group_members
  USING (account_owner_id = (SELECT auth.uid()) AND (SELECT is_current_account_leader()))
  WITH CHECK (account_owner_id = (SELECT auth.uid()) AND (SELECT is_current_account_leader()));
ALTER POLICY account_config_read ON report_config_items
  USING (user_id = (SELECT current_account_owner_id()));

CREATE OR REPLACE FUNCTION tabela_dinamica_geral(
  p_ano INT,
  p_cod_cliente TEXT DEFAULT NULL,
  p_cod_referencia TEXT DEFAULT NULL,
  p_semestre INT DEFAULT NULL,
  p_descr_hist_financ TEXT DEFAULT NULL
)
RETURNS TABLE (ano SMALLINT, cod_cliente TEXT, nome_cliente TEXT, apelido TEXT, cod_referencia TEXT, descr_produto TEXT, jan NUMERIC, fev NUMERIC, mar NUMERIC, abr NUMERIC, mai NUMERIC, jun NUMERIC, jul NUMERIC, ago NUMERIC, set_ NUMERIC, out_ NUMERIC, nov NUMERIC, dez NUMERIC, total_ano NUMERIC, total_valor NUMERIC)
LANGUAGE SQL STABLE AS $$
  SELECT
    s.ano,
    COALESCE('group:' || g.id::TEXT, s.cod_cliente),
    COALESCE(g.name, MAX(s.nome_cliente)),
    CASE WHEN g.id IS NULL THEN MAX(s.apelido) ELSE NULL END,
    s.cod_referencia,
    MAX(s.descr_produto),
    SUM(CASE WHEN s.mes=1 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=2 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=3 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=4 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes=5 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=6 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=7 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=8 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes=9 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=10 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=11 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=12 THEN s.quantidade ELSE 0 END),
    SUM(s.quantidade), SUM(s.valor_total)
  FROM sales_rows s
  LEFT JOIN client_group_members m
    ON m.account_owner_id = (SELECT current_account_owner_id()) AND m.cod_cliente = s.cod_cliente
  LEFT JOIN client_groups g ON g.id = m.group_id
  WHERE s.ano = p_ano
    AND (p_cod_cliente IS NULL OR s.cod_cliente IN (SELECT code.cod_cliente FROM resolve_client_codes(p_cod_cliente) code))
    AND (p_cod_referencia IS NULL OR s.cod_referencia = p_cod_referencia)
    AND (p_semestre IS NULL OR (p_semestre=1 AND s.mes BETWEEN 1 AND 6) OR (p_semestre=2 AND s.mes BETWEEN 7 AND 12))
    AND (p_descr_hist_financ IS NULL OR s.descr_hist_financ = p_descr_hist_financ)
  GROUP BY s.ano, COALESCE('group:' || g.id::TEXT, s.cod_cliente), g.id, g.name, s.cod_referencia
  ORDER BY COALESCE(g.name, MAX(s.nome_cliente)), s.cod_referencia;
$$;

NOTIFY pgrst, 'reload schema';

-- Production privilege hardening for application RPCs.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, so revoking
-- only the anon role is not enough to prevent unauthenticated RPC execution.

CREATE OR REPLACE FUNCTION get_rep_ranking(p_ano INT DEFAULT NULL)
RETURNS TABLE (
  rep_id UUID,
  rep_email TEXT,
  total_faturado NUMERIC,
  total_pedidos BIGINT,
  num_clientes BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    sales.user_id AS rep_id,
    users.email AS rep_email,
    COALESCE(SUM(sales.valor_total), 0) AS total_faturado,
    COUNT(DISTINCT sales.codigo_pedido) AS total_pedidos,
    COUNT(DISTINCT sales.cod_cliente) AS num_clientes
  FROM sales_rows sales
  JOIN auth.users users ON users.id = sales.user_id
  WHERE (p_ano IS NULL OR sales.ano = p_ano)
    AND (
      sales.user_id = auth.uid()
      OR sales.user_id IN (
        SELECT profile.id
        FROM profiles profile
        WHERE profile.leader_id = auth.uid()
      )
    )
  GROUP BY sales.user_id, users.email
  ORDER BY total_faturado DESC;
$$;

CREATE OR REPLACE FUNCTION get_client_ranking(p_ano INT DEFAULT NULL)
RETURNS TABLE (
  cod_cliente TEXT,
  nome_cliente TEXT,
  rep_email TEXT,
  total_faturado NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    sales.cod_cliente,
    MAX(sales.nome_cliente) AS nome_cliente,
    MAX(users.email) AS rep_email,
    COALESCE(SUM(sales.valor_total), 0) AS total_faturado
  FROM sales_rows sales
  JOIN auth.users users ON users.id = sales.user_id
  WHERE (p_ano IS NULL OR sales.ano = p_ano)
    AND (
      sales.user_id = auth.uid()
      OR sales.user_id IN (
        SELECT profile.id
        FROM profiles profile
        WHERE profile.leader_id = auth.uid()
      )
    )
  GROUP BY sales.cod_cliente
  ORDER BY total_faturado DESC;
$$;

-- Revoke inherited PUBLIC execution from every application function currently
-- exposed through the public schema. Explicit authenticated grants are restored
-- below only for the RPC surface used by the portal.
DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT
      namespace.nspname AS schema_name,
      procedure.proname AS function_name,
      pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  END LOOP;
END;
$$;

-- Restore only the authenticated RPCs intentionally consumed by the app.
DO $$
DECLARE
  function_signature TEXT;
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.mes_abrev(smallint)',
    'public.tabela_dinamica_geral(integer,text,text,integer,text)',
    'public.base_de_compra(integer,text,text,integer,text)',
    'public.dashboard_summary(integer,text,text,integer,text)',
    'public.geral(integer,text,text,integer,text)',
    'public.configured_report_rows(text,integer[],text,text,integer,text)',
    'public.base_de_itens(integer[],text,text,integer,text)',
    'public.bagagitos(integer[],text,text,integer,text)',
    'public.get_distinct_years()',
    'public.get_distinct_clients()',
    'public.product_catalog()',
    'public.get_rep_ranking(integer)',
    'public.get_client_ranking(integer)',
    'public.get_effective_subscription_plan()',
    'public.chat_can_read_sales_owner(uuid)',
    'public.chat_top_clients(integer,integer)',
    'public.chat_resolve_client(text,integer)',
    'public.chat_top_products(integer,text,integer,text,integer)',
    'public.chat_sales_trend(integer,integer,text,text)',
    'public.chat_recent_orders(text,integer)',
    'public.chat_inactive_clients(date,integer,integer)',
    'public.chat_rep_performance(integer,integer)'
  ]
  LOOP
    IF to_regprocedure(function_signature) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', function_signature);
    END IF;
  END LOOP;
END;
$$;

-- Keep future functions private until a migration explicitly grants access.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;


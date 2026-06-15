-- Performance de consultas e dashboard de cliente (Implementação 009)
-- Criado em: 2026-06-15
--
-- Esta migration fecha o eixo P2 da implementação 005 (seção 7, tarefas 15-18):
--   1. Reaplicar índices da 0012 com IF NOT EXISTS (idempotente).
--   2. RPC de busca de clientes paginada/limitada.
--   3. RPCs agregadas para o dashboard de cliente.
--   4. Recriar chat_* com CTE authorized_owners em vez de chat_can_read_sales_owner por linha.
--
-- NOTA: Este arquivo é numerado como 0021 (e não 0016 como planejado originalmente
-- na spec 009) porque as migrations 0019 e 0020 já existem no repositório e
-- inserir 0016 quebraria a ordenação de aplicação do Supabase.

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 1: Índices (reaplicados com IF NOT EXISTS — idempotente)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sales_user_year_client
  ON sales_rows(user_id, ano, cod_cliente);

CREATE INDEX IF NOT EXISTS idx_sales_user_date_client
  ON sales_rows(user_id, data_pedido, cod_cliente);

-- Índice de apoio à busca textual de clientes (cod_cliente, nome_cliente)
-- sem restrição de user_id — a autorização é feita via JOIN na RPC.
CREATE INDEX IF NOT EXISTS idx_sales_client_lookup
  ON sales_rows(cod_cliente, nome_cliente);

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 2: Busca de clientes paginada/limitada
-- ─────────────────────────────────────────────────────────────────────────────

-- Substitui o padrão get_distinct_clients() global (sem filtro nem limite)
-- por uma RPC que filtra por código OU nome no banco, respeitando o escopo
-- de proprietários autorizados do usuário autenticado.

CREATE OR REPLACE FUNCTION search_clients(
  p_query  TEXT    DEFAULT '',
  p_limit  INT     DEFAULT 12,
  p_offset INT     DEFAULT 0
)
RETURNS TABLE (
  cod_cliente  TEXT,
  nome_cliente TEXT
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
  ),
  filtered AS (
    SELECT
      sales.cod_cliente,
      MAX(sales.nome_cliente) AS nome_cliente
    FROM sales_rows sales
    JOIN authorized_owners owner ON owner.user_id = sales.user_id
    WHERE
      TRIM(p_query) = ''
      OR LOWER(sales.cod_cliente)   LIKE '%' || LOWER(TRIM(p_query)) || '%'
      OR LOWER(sales.nome_cliente)  LIKE '%' || LOWER(TRIM(p_query)) || '%'
    GROUP BY sales.cod_cliente
  )
  SELECT
    filtered.cod_cliente,
    filtered.nome_cliente
  FROM filtered
  ORDER BY filtered.nome_cliente ASC, filtered.cod_cliente ASC
  LIMIT  LEAST(GREATEST(COALESCE(p_limit, 12), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION search_clients(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION search_clients(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION search_clients(TEXT, INT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 3: RPCs agregadas para o dashboard de cliente
-- ─────────────────────────────────────────────────────────────────────────────
-- Todas as RPCs abaixo usam authorized_owners CTE para aplicar o mesmo
-- escopo de visibilidade que as chat_* usam, sem chamar
-- chat_can_read_sales_owner por linha.

-- 3a. Resumo anual do cliente (ano corrente e ano anterior em uma só chamada)
CREATE OR REPLACE FUNCTION client_dashboard_summary(
  p_cod_cliente TEXT,
  p_ano         INT
)
RETURNS TABLE (
  periodo             TEXT,      -- 'current' | 'previous'
  ano                 INT,
  total_faturado      NUMERIC,
  total_unidades      NUMERIC,
  total_pedidos       BIGINT,
  total_produtos      BIGINT,
  meses_ativos        INT,
  melhor_mes          SMALLINT,
  ultimo_pedido       DATE,
  faturamento_vitalicio NUMERIC,
  pedidos_vitalicios  BIGINT,
  anos_ativos         BIGINT
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
  ),
  base AS (
    SELECT
      sales.ano,
      sales.mes,
      sales.codigo_pedido,
      sales.valor_total,
      sales.quantidade,
      sales.cod_referencia,
      sales.data_pedido
    FROM sales_rows sales
    JOIN authorized_owners owner ON owner.user_id = sales.user_id
    WHERE sales.cod_cliente = p_cod_cliente
  ),
  vitalicio AS (
    SELECT
      COALESCE(SUM(b.valor_total), 0)                   AS faturamento_vitalicio,
      COUNT(DISTINCT b.codigo_pedido)                   AS pedidos_vitalicios,
      COUNT(DISTINCT b.ano)                             AS anos_ativos,
      MAX(b.data_pedido)                                AS ultimo_pedido
    FROM base b
  ),
  por_periodo AS (
    SELECT
      b.ano,
      COALESCE(SUM(b.valor_total), 0)                   AS total_faturado,
      COALESCE(SUM(b.quantidade), 0)                    AS total_unidades,
      COUNT(DISTINCT b.codigo_pedido)                   AS total_pedidos,
      COUNT(DISTINCT b.cod_referencia)                  AS total_produtos,
      COUNT(DISTINCT CASE WHEN b.valor_total > 0 THEN b.mes END) AS meses_ativos
    FROM base b
    WHERE b.ano IN (p_ano, p_ano - 1)
    GROUP BY b.ano
  ),
  mes_faturado AS (
    SELECT
      b.ano,
      b.mes,
      COALESCE(SUM(b.valor_total), 0) AS faturado_mes
    FROM base b
    WHERE b.ano IN (p_ano, p_ano - 1)
    GROUP BY b.ano, b.mes
  ),
  melhor_mes_por_ano AS (
    SELECT DISTINCT ON (mf.ano)
      mf.ano,
      mf.mes AS melhor_mes
    FROM mes_faturado mf
    ORDER BY mf.ano, mf.faturado_mes DESC
  )
  SELECT
    CASE WHEN pp.ano = p_ano THEN 'current' ELSE 'previous' END AS periodo,
    pp.ano,
    pp.total_faturado,
    pp.total_unidades,
    pp.total_pedidos,
    pp.total_produtos,
    COALESCE(pp.meses_ativos, 0)::INT                           AS meses_ativos,
    COALESCE(mm.melhor_mes, 1)::SMALLINT                        AS melhor_mes,
    v.ultimo_pedido,
    v.faturamento_vitalicio,
    v.pedidos_vitalicios,
    v.anos_ativos
  FROM por_periodo pp
  CROSS JOIN vitalicio v
  LEFT JOIN melhor_mes_por_ano mm ON mm.ano = pp.ano
  ORDER BY pp.ano DESC;
$$;

REVOKE ALL ON FUNCTION client_dashboard_summary(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION client_dashboard_summary(TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION client_dashboard_summary(TEXT, INT) TO authenticated;

-- 3b. Tendência mensal (ano corrente e ano anterior, 12 meses cada)
CREATE OR REPLACE FUNCTION client_monthly_trend(
  p_cod_cliente TEXT,
  p_ano         INT
)
RETURNS TABLE (
  ano            INT,
  mes            SMALLINT,
  total_faturado NUMERIC,
  total_unidades NUMERIC,
  total_pedidos  BIGINT
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
  )
  SELECT
    sales.ano::INT,
    sales.mes,
    COALESCE(SUM(sales.valor_total), 0)        AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0)         AS total_unidades,
    COUNT(DISTINCT sales.codigo_pedido)        AS total_pedidos
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  WHERE sales.cod_cliente = p_cod_cliente
    AND sales.ano IN (p_ano, p_ano - 1)
  GROUP BY sales.ano, sales.mes
  ORDER BY sales.ano ASC, sales.mes ASC;
$$;

REVOKE ALL ON FUNCTION client_monthly_trend(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION client_monthly_trend(TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION client_monthly_trend(TEXT, INT) TO authenticated;

-- 3c. Histórico anual completo do cliente (todos os anos)
CREATE OR REPLACE FUNCTION client_yearly_history(
  p_cod_cliente TEXT
)
RETURNS TABLE (
  ano            INT,
  total_faturado NUMERIC,
  total_unidades NUMERIC,
  total_pedidos  BIGINT,
  total_produtos BIGINT
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
  )
  SELECT
    sales.ano::INT,
    COALESCE(SUM(sales.valor_total), 0)      AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0)       AS total_unidades,
    COUNT(DISTINCT sales.codigo_pedido)      AS total_pedidos,
    COUNT(DISTINCT sales.cod_referencia)     AS total_produtos
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  WHERE sales.cod_cliente = p_cod_cliente
  GROUP BY sales.ano
  ORDER BY sales.ano DESC;
$$;

REVOKE ALL ON FUNCTION client_yearly_history(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION client_yearly_history(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION client_yearly_history(TEXT) TO authenticated;

-- 3d. Top produtos do cliente (ano corrente e anterior para comparativo)
CREATE OR REPLACE FUNCTION client_top_products(
  p_cod_cliente TEXT,
  p_ano         INT,
  p_limit       INT DEFAULT 50
)
RETURNS TABLE (
  cod_referencia   TEXT,
  descr_produto    TEXT,
  ano              INT,
  total_faturado   NUMERIC,
  total_unidades   NUMERIC,
  total_pedidos    BIGINT,
  ultimo_pedido    DATE
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
  )
  SELECT
    sales.cod_referencia,
    MAX(sales.descr_produto)                   AS descr_produto,
    sales.ano::INT,
    COALESCE(SUM(sales.valor_total), 0)        AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0)         AS total_unidades,
    COUNT(DISTINCT sales.codigo_pedido)        AS total_pedidos,
    MAX(sales.data_pedido)                     AS ultimo_pedido
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  WHERE sales.cod_cliente = p_cod_cliente
    AND sales.ano IN (p_ano, p_ano - 1)
  GROUP BY sales.cod_referencia, sales.ano
  ORDER BY sales.ano DESC, total_faturado DESC;
$$;

REVOKE ALL ON FUNCTION client_top_products(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION client_top_products(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION client_top_products(TEXT, INT, INT) TO authenticated;

-- 3e. Pedidos recentes do cliente (sob demanda, com LIMIT)
CREATE OR REPLACE FUNCTION client_recent_orders(
  p_cod_cliente TEXT,
  p_limit       INT DEFAULT 8
)
RETURNS TABLE (
  codigo_pedido     TEXT,
  data_pedido       DATE,
  total_faturado    NUMERIC,
  total_unidades    NUMERIC,
  total_linhas      BIGINT,
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
  ),
  -- Calcular order_key em subconsulta separada para poder usar no GROUP BY
  linhas AS (
    SELECT
      COALESCE(
        NULLIF(TRIM(sales.codigo_pedido), ''),
        NULLIF(TRIM(sales.numero_pedido_talao), ''),
        NULLIF(TRIM(sales.pedido_cliente_opc), '')
      )                                              AS codigo_pedido,
      COALESCE(sales.data_pedido::TEXT, 'sem-data')
        || '-'
        || COALESCE(
             NULLIF(TRIM(sales.codigo_pedido), ''),
             NULLIF(TRIM(sales.numero_pedido_talao), ''),
             NULLIF(TRIM(sales.pedido_cliente_opc), ''),
             sales.cod_referencia
           )                                         AS order_key,
      sales.data_pedido,
      sales.valor_total,
      sales.quantidade,
      sales.descr_produto
    FROM sales_rows sales
    JOIN authorized_owners owner ON owner.user_id = sales.user_id
    WHERE sales.cod_cliente = p_cod_cliente
      AND sales.data_pedido IS NOT NULL
  ),
  ranked AS (
    SELECT
      MIN(l.codigo_pedido)                                         AS codigo_pedido,
      l.order_key,
      MAX(l.data_pedido)                                           AS data_pedido,
      COALESCE(SUM(l.valor_total), 0)                              AS total_faturado,
      COALESCE(SUM(l.quantidade), 0)                               AS total_unidades,
      COUNT(*)                                                     AS total_linhas,
      (ARRAY_AGG(l.descr_produto ORDER BY l.valor_total DESC NULLS LAST))[1:2]
                                                                   AS produtos_destaque
    FROM linhas l
    GROUP BY l.order_key
  )
  SELECT
    ranked.codigo_pedido,
    ranked.data_pedido,
    ranked.total_faturado,
    ranked.total_unidades,
    ranked.total_linhas,
    ranked.produtos_destaque
  FROM ranked
  ORDER BY ranked.data_pedido DESC NULLS LAST, ranked.order_key DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
$$;

REVOKE ALL ON FUNCTION client_recent_orders(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION client_recent_orders(TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION client_recent_orders(TEXT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 4: Recriar chat_* com CTE authorized_owners (em vez de por linha)
-- Preserva exatamente o mesmo escopo de visibilidade das funções originais.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION chat_top_clients(
  p_ano   INT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  cod_cliente   TEXT,
  nome_cliente  TEXT,
  total_faturado NUMERIC,
  total_pedidos  BIGINT
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
  )
  SELECT
    sales.cod_cliente,
    MAX(sales.nome_cliente)                   AS nome_cliente,
    COALESCE(SUM(sales.valor_total), 0)       AS total_faturado,
    COUNT(DISTINCT sales.codigo_pedido)       AS total_pedidos
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  WHERE sales.ano = p_ano
  GROUP BY sales.cod_cliente
  ORDER BY total_faturado DESC, nome_cliente ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

REVOKE ALL ON FUNCTION chat_top_clients(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_top_clients(INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION chat_top_clients(INT, INT) TO authenticated;

-- chat_top_products: mesma assinatura, CTE em vez de por linha
CREATE OR REPLACE FUNCTION chat_top_products(
  p_ano              INT,
  p_cod_cliente      TEXT    DEFAULT NULL,
  p_semestre         INT     DEFAULT NULL,
  p_descr_hist_financ TEXT   DEFAULT NULL,
  p_limit            INT     DEFAULT 10
)
RETURNS TABLE (
  cod_referencia TEXT,
  descr_produto  TEXT,
  total_faturado NUMERIC,
  total_unidades NUMERIC,
  total_pedidos  BIGINT
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
  )
  SELECT
    sales.cod_referencia,
    MAX(sales.descr_produto)                   AS descr_produto,
    COALESCE(SUM(sales.valor_total), 0)        AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0)         AS total_unidades,
    COUNT(DISTINCT sales.codigo_pedido)        AS total_pedidos
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  WHERE sales.ano = p_ano
    AND (p_cod_cliente IS NULL OR sales.cod_cliente = p_cod_cliente)
    AND (p_semestre IS NULL
         OR (p_semestre = 1 AND sales.mes BETWEEN 1 AND 6)
         OR (p_semestre = 2 AND sales.mes BETWEEN 7 AND 12))
    AND (p_descr_hist_financ IS NULL OR sales.descr_hist_financ = p_descr_hist_financ)
  GROUP BY sales.cod_referencia
  ORDER BY total_faturado DESC, descr_produto ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

REVOKE ALL ON FUNCTION chat_top_products(INT, TEXT, INT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_top_products(INT, TEXT, INT, TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION chat_top_products(INT, TEXT, INT, TEXT, INT) TO authenticated;

-- chat_sales_trend: mesma assinatura, CTE em vez de por linha
CREATE OR REPLACE FUNCTION chat_sales_trend(
  p_start_year   INT,
  p_end_year     INT,
  p_cod_cliente  TEXT DEFAULT NULL,
  p_cod_referencia TEXT DEFAULT NULL
)
RETURNS TABLE (
  ano            SMALLINT,
  mes            SMALLINT,
  total_faturado NUMERIC,
  total_unidades NUMERIC,
  total_pedidos  BIGINT
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
  )
  SELECT
    sales.ano,
    sales.mes,
    COALESCE(SUM(sales.valor_total), 0)       AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0)        AS total_unidades,
    COUNT(DISTINCT sales.codigo_pedido)       AS total_pedidos
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  WHERE sales.ano BETWEEN p_start_year AND p_end_year
    AND p_end_year >= p_start_year
    AND p_end_year - p_start_year <= 4
    AND (p_cod_cliente IS NULL OR sales.cod_cliente = p_cod_cliente)
    AND (p_cod_referencia IS NULL OR sales.cod_referencia = p_cod_referencia)
  GROUP BY sales.ano, sales.mes
  ORDER BY sales.ano ASC, sales.mes ASC;
$$;

REVOKE ALL ON FUNCTION chat_sales_trend(INT, INT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_sales_trend(INT, INT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION chat_sales_trend(INT, INT, TEXT, TEXT) TO authenticated;

-- chat_recent_orders: mesma assinatura, CTE em vez de por linha
CREATE OR REPLACE FUNCTION chat_recent_orders(
  p_cod_cliente TEXT,
  p_limit       INT DEFAULT 10
)
RETURNS TABLE (
  codigo_pedido     TEXT,
  data_pedido       DATE,
  total_faturado    NUMERIC,
  total_unidades    NUMERIC,
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
  )
  SELECT
    sales.codigo_pedido,
    MAX(sales.data_pedido)                                            AS data_pedido,
    COALESCE(SUM(sales.valor_total), 0)                              AS total_faturado,
    COALESCE(SUM(sales.quantidade), 0)                               AS total_unidades,
    (ARRAY_AGG(DISTINCT sales.descr_produto ORDER BY sales.descr_produto))[1:5]
                                                                      AS produtos_destaque
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  WHERE sales.cod_cliente = p_cod_cliente
    AND sales.codigo_pedido IS NOT NULL
  GROUP BY sales.codigo_pedido
  ORDER BY data_pedido DESC NULLS LAST, sales.codigo_pedido DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

REVOKE ALL ON FUNCTION chat_recent_orders(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_recent_orders(TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION chat_recent_orders(TEXT, INT) TO authenticated;

-- chat_rep_performance: mesma assinatura, CTE em vez de por linha
CREATE OR REPLACE FUNCTION chat_rep_performance(
  p_ano   INT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  rep_id         UUID,
  rep_email      TEXT,
  total_faturado NUMERIC,
  total_pedidos  BIGINT,
  total_clientes BIGINT
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
  )
  SELECT
    sales.user_id                              AS rep_id,
    users.email                               AS rep_email,
    COALESCE(SUM(sales.valor_total), 0)       AS total_faturado,
    COUNT(DISTINCT sales.codigo_pedido)       AS total_pedidos,
    COUNT(DISTINCT sales.cod_cliente)         AS total_clientes
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  JOIN auth.users users ON users.id = sales.user_id
  WHERE sales.ano = p_ano
  GROUP BY sales.user_id, users.email
  ORDER BY total_faturado DESC, rep_email ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$$;

REVOKE ALL ON FUNCTION chat_rep_performance(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_rep_performance(INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION chat_rep_performance(INT, INT) TO authenticated;

-- chat_resolve_client: recriar usando CTE authorized_owners
-- (a versão 0018 também chamava chat_can_read_sales_owner por linha)
CREATE OR REPLACE FUNCTION chat_resolve_client(
  p_query TEXT,
  p_limit INT DEFAULT 8
)
RETURNS TABLE (
  cod_cliente  TEXT,
  nome_cliente TEXT
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
  ),
  normalized AS (
    SELECT
      NULLIF(LOWER(TRIM(p_query)), '')                                            AS query_text,
      NULLIF(REGEXP_REPLACE(LOWER(TRIM(p_query)), '[^a-z0-9]+', '', 'g'), '')    AS query_compact,
      NULLIF(REGEXP_REPLACE(TRIM(p_query), '[^0-9]+', '', 'g'), '')              AS query_digits
  )
  SELECT
    sales.cod_cliente,
    MAX(sales.nome_cliente) AS nome_cliente
  FROM sales_rows sales
  JOIN authorized_owners owner ON owner.user_id = sales.user_id
  CROSS JOIN normalized query
  WHERE query.query_text IS NOT NULL
    AND (
      LOWER(sales.cod_cliente)  = query.query_text
      OR LOWER(sales.nome_cliente) = query.query_text
      OR LOWER(sales.cod_cliente)  LIKE '%' || query.query_text || '%'
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
REVOKE ALL ON FUNCTION chat_resolve_client(TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION chat_resolve_client(TEXT, INT) TO authenticated;

-- Nota: chat_inactive_clients já usa o padrão CTE authorized_owners (0012).
-- Não é recriada aqui — apenas garantir que os índices acima estejam presentes.

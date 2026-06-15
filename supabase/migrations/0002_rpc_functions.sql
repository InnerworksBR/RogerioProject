-- =============================================================
-- Autimex Reports - RPC Pivot Functions
-- Run this AFTER 0001_initial_schema.sql
-- =============================================================

-- Helper: month number → Portuguese abbreviation
-- Used internally by the functions below
CREATE OR REPLACE FUNCTION mes_abrev(p_mes SMALLINT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE p_mes
    WHEN 1  THEN 'JAN' WHEN 2  THEN 'FEV' WHEN 3  THEN 'MAR'
    WHEN 4  THEN 'ABR' WHEN 5  THEN 'MAI' WHEN 6  THEN 'JUN'
    WHEN 7  THEN 'JUL' WHEN 8  THEN 'AGO' WHEN 9  THEN 'SET'
    WHEN 10 THEN 'OUT' WHEN 11 THEN 'NOV' WHEN 12 THEN 'DEZ'
    ELSE 'UNK'
  END;
$$;

-- =============================================================
-- RPC 1: tabela_dinamica_geral
-- Pivot: Client × Product × Month (quantity sold)
-- Returns one row per (ano, cod_cliente, cod_referencia)
-- =============================================================
CREATE OR REPLACE FUNCTION tabela_dinamica_geral(
  p_ano          INT,
  p_cod_cliente  TEXT DEFAULT NULL,
  p_cod_referencia TEXT DEFAULT NULL
)
RETURNS TABLE (
  ano            SMALLINT,
  cod_cliente    TEXT,
  nome_cliente   TEXT,
  apelido        TEXT,
  cod_referencia TEXT,
  descr_produto  TEXT,
  jan NUMERIC, fev NUMERIC, mar NUMERIC, abr NUMERIC,
  mai NUMERIC, jun NUMERIC, jul NUMERIC, ago NUMERIC,
  set_ NUMERIC, out_ NUMERIC, nov NUMERIC, dez NUMERIC,
  total_ano      NUMERIC,
  total_valor    NUMERIC
)
LANGUAGE SQL STABLE AS $$
  SELECT
    s.ano,
    s.cod_cliente,
    MAX(s.nome_cliente)                                           AS nome_cliente,
    MAX(s.apelido)                                                AS apelido,
    s.cod_referencia,
    MAX(s.descr_produto)                                          AS descr_produto,
    SUM(CASE WHEN s.mes = 1  THEN s.quantidade ELSE 0 END)       AS jan,
    SUM(CASE WHEN s.mes = 2  THEN s.quantidade ELSE 0 END)       AS fev,
    SUM(CASE WHEN s.mes = 3  THEN s.quantidade ELSE 0 END)       AS mar,
    SUM(CASE WHEN s.mes = 4  THEN s.quantidade ELSE 0 END)       AS abr,
    SUM(CASE WHEN s.mes = 5  THEN s.quantidade ELSE 0 END)       AS mai,
    SUM(CASE WHEN s.mes = 6  THEN s.quantidade ELSE 0 END)       AS jun,
    SUM(CASE WHEN s.mes = 7  THEN s.quantidade ELSE 0 END)       AS jul,
    SUM(CASE WHEN s.mes = 8  THEN s.quantidade ELSE 0 END)       AS ago,
    SUM(CASE WHEN s.mes = 9  THEN s.quantidade ELSE 0 END)       AS set_,
    SUM(CASE WHEN s.mes = 10 THEN s.quantidade ELSE 0 END)       AS out_,
    SUM(CASE WHEN s.mes = 11 THEN s.quantidade ELSE 0 END)       AS nov,
    SUM(CASE WHEN s.mes = 12 THEN s.quantidade ELSE 0 END)       AS dez,
    SUM(s.quantidade)                                             AS total_ano,
    SUM(s.valor_total)                                            AS total_valor
  FROM sales_rows s
  WHERE s.ano = p_ano
    AND (p_cod_cliente   IS NULL OR s.cod_cliente    = p_cod_cliente)
    AND (p_cod_referencia IS NULL OR s.cod_referencia = p_cod_referencia)
  GROUP BY s.ano, s.cod_cliente, s.cod_referencia
  ORDER BY MAX(s.nome_cliente), s.cod_referencia;
$$;

-- =============================================================
-- RPC 2: base_de_compra
-- Pivot: Product × Month (no client grouping)
-- =============================================================
CREATE OR REPLACE FUNCTION base_de_compra(
  p_ano          INT,
  p_cod_cliente  TEXT DEFAULT NULL,
  p_cod_referencia TEXT DEFAULT NULL
)
RETURNS TABLE (
  ano            SMALLINT,
  cod_referencia TEXT,
  descr_produto  TEXT,
  jan NUMERIC, fev NUMERIC, mar NUMERIC, abr NUMERIC,
  mai NUMERIC, jun NUMERIC, jul NUMERIC, ago NUMERIC,
  set_ NUMERIC, out_ NUMERIC, nov NUMERIC, dez NUMERIC,
  total_ano      NUMERIC
)
LANGUAGE SQL STABLE AS $$
  SELECT
    s.ano,
    s.cod_referencia,
    MAX(s.descr_produto)                                          AS descr_produto,
    SUM(CASE WHEN s.mes = 1  THEN s.quantidade ELSE 0 END)       AS jan,
    SUM(CASE WHEN s.mes = 2  THEN s.quantidade ELSE 0 END)       AS fev,
    SUM(CASE WHEN s.mes = 3  THEN s.quantidade ELSE 0 END)       AS mar,
    SUM(CASE WHEN s.mes = 4  THEN s.quantidade ELSE 0 END)       AS abr,
    SUM(CASE WHEN s.mes = 5  THEN s.quantidade ELSE 0 END)       AS mai,
    SUM(CASE WHEN s.mes = 6  THEN s.quantidade ELSE 0 END)       AS jun,
    SUM(CASE WHEN s.mes = 7  THEN s.quantidade ELSE 0 END)       AS jul,
    SUM(CASE WHEN s.mes = 8  THEN s.quantidade ELSE 0 END)       AS ago,
    SUM(CASE WHEN s.mes = 9  THEN s.quantidade ELSE 0 END)       AS set_,
    SUM(CASE WHEN s.mes = 10 THEN s.quantidade ELSE 0 END)       AS out_,
    SUM(CASE WHEN s.mes = 11 THEN s.quantidade ELSE 0 END)       AS nov,
    SUM(CASE WHEN s.mes = 12 THEN s.quantidade ELSE 0 END)       AS dez,
    SUM(s.quantidade)                                             AS total_ano
  FROM sales_rows s
  WHERE s.ano = p_ano
    AND (p_cod_cliente    IS NULL OR s.cod_cliente    = p_cod_cliente)
    AND (p_cod_referencia IS NULL OR s.cod_referencia = p_cod_referencia)
  GROUP BY s.ano, s.cod_referencia
  ORDER BY s.cod_referencia;
$$;

-- =============================================================
-- RPC 3: base_de_itens
-- Configured items list with annual totals
-- =============================================================
CREATE OR REPLACE FUNCTION base_de_itens(
  p_anos         INT[]   -- array of years to include
)
RETURNS TABLE (
  id             BIGINT,
  sort_order     INTEGER,
  cod_referencia TEXT,
  label          TEXT,
  extra_data     JSONB,
  -- One column per year: year_2024, year_2025, etc. — returned as JSONB
  totals_by_year JSONB
)
LANGUAGE SQL STABLE AS $$
  SELECT
    c.id,
    c.sort_order,
    c.cod_referencia,
    COALESCE(c.label, MAX(s.descr_produto), c.cod_referencia) AS label,
    c.extra_data,
    COALESCE(
      jsonb_object_agg(s.ano::TEXT, s.qty) FILTER (WHERE s.ano IS NOT NULL),
      '{}'::JSONB
    ) AS totals_by_year
  FROM report_config_items c
  LEFT JOIN (
    SELECT cod_referencia, ano, SUM(quantidade) AS qty, MAX(descr_produto) AS descr_produto
    FROM sales_rows
    WHERE ano = ANY(p_anos)
    GROUP BY cod_referencia, ano
  ) s ON s.cod_referencia = c.cod_referencia
  WHERE c.report_key = 'base_itens'
  GROUP BY c.id, c.sort_order, c.cod_referencia, c.label, c.extra_data
  ORDER BY c.sort_order, c.cod_referencia;
$$;

-- =============================================================
-- RPC 4: bagagitos
-- Bagagito products list with annual totals
-- =============================================================
CREATE OR REPLACE FUNCTION bagagitos(
  p_anos         INT[]
)
RETURNS TABLE (
  id             BIGINT,
  sort_order     INTEGER,
  cod_referencia TEXT,
  label          TEXT,
  extra_data     JSONB,
  totals_by_year JSONB
)
LANGUAGE SQL STABLE AS $$
  SELECT
    c.id,
    c.sort_order,
    c.cod_referencia,
    COALESCE(c.label, MAX(s.descr_produto), c.cod_referencia) AS label,
    c.extra_data,
    COALESCE(
      jsonb_object_agg(s.ano::TEXT, s.qty) FILTER (WHERE s.ano IS NOT NULL),
      '{}'::JSONB
    ) AS totals_by_year
  FROM report_config_items c
  LEFT JOIN (
    SELECT cod_referencia, ano, SUM(quantidade) AS qty, MAX(descr_produto) AS descr_produto
    FROM sales_rows
    WHERE ano = ANY(p_anos)
    GROUP BY cod_referencia, ano
  ) s ON s.cod_referencia = c.cod_referencia
  WHERE c.report_key = 'bagagitos'
  GROUP BY c.id, c.sort_order, c.cod_referencia, c.label, c.extra_data
  ORDER BY c.sort_order, c.cod_referencia;
$$;

-- =============================================================
-- RPC 5: geral
-- All products grouped by category, with monthly × yearly totals
-- =============================================================
CREATE OR REPLACE FUNCTION geral(
  p_ano          INT,
  p_cod_cliente  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id             BIGINT,
  sort_order     INTEGER,
  categoria      TEXT,
  cod_referencia TEXT,
  label          TEXT,
  extra_data     JSONB,
  jan NUMERIC, fev NUMERIC, mar NUMERIC, abr NUMERIC,
  mai NUMERIC, jun NUMERIC, jul NUMERIC, ago NUMERIC,
  set_ NUMERIC, out_ NUMERIC, nov NUMERIC, dez NUMERIC,
  total_ano      NUMERIC
)
LANGUAGE SQL STABLE AS $$
  SELECT
    c.id,
    c.sort_order,
    c.categoria,
    c.cod_referencia,
    COALESCE(c.label, MAX(s.descr_produto), c.cod_referencia) AS label,
    c.extra_data,
    SUM(CASE WHEN s.mes = 1  THEN s.quantidade ELSE 0 END)    AS jan,
    SUM(CASE WHEN s.mes = 2  THEN s.quantidade ELSE 0 END)    AS fev,
    SUM(CASE WHEN s.mes = 3  THEN s.quantidade ELSE 0 END)    AS mar,
    SUM(CASE WHEN s.mes = 4  THEN s.quantidade ELSE 0 END)    AS abr,
    SUM(CASE WHEN s.mes = 5  THEN s.quantidade ELSE 0 END)    AS mai,
    SUM(CASE WHEN s.mes = 6  THEN s.quantidade ELSE 0 END)    AS jun,
    SUM(CASE WHEN s.mes = 7  THEN s.quantidade ELSE 0 END)    AS jul,
    SUM(CASE WHEN s.mes = 8  THEN s.quantidade ELSE 0 END)    AS ago,
    SUM(CASE WHEN s.mes = 9  THEN s.quantidade ELSE 0 END)    AS set_,
    SUM(CASE WHEN s.mes = 10 THEN s.quantidade ELSE 0 END)    AS out_,
    SUM(CASE WHEN s.mes = 11 THEN s.quantidade ELSE 0 END)    AS nov,
    SUM(CASE WHEN s.mes = 12 THEN s.quantidade ELSE 0 END)    AS dez,
    SUM(COALESCE(s.quantidade, 0))                             AS total_ano
  FROM report_config_items c
  LEFT JOIN sales_rows s
    ON  s.cod_referencia = c.cod_referencia
    AND s.ano = p_ano
    AND (p_cod_cliente IS NULL OR s.cod_cliente = p_cod_cliente)
  WHERE c.report_key = 'geral'
  GROUP BY c.id, c.sort_order, c.categoria, c.cod_referencia, c.label, c.extra_data
  ORDER BY c.sort_order, c.categoria, c.cod_referencia;
$$;

-- =============================================================
-- RPC 6: dashboard_summary
-- Aggregate KPIs shown in the summary cards
-- =============================================================
CREATE OR REPLACE FUNCTION dashboard_summary(
  p_ano         INT DEFAULT NULL,
  p_cod_cliente TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_pedidos      BIGINT,
  total_faturado     NUMERIC,
  num_clientes       BIGINT,
  num_produtos       BIGINT,
  total_unidades     NUMERIC,
  data_inicio        DATE,
  data_fim           DATE,
  anos_disponiveis   INT[]
)
LANGUAGE SQL STABLE AS $$
  SELECT
    COUNT(*)                              AS total_pedidos,
    SUM(valor_total)                      AS total_faturado,
    COUNT(DISTINCT cod_cliente)           AS num_clientes,
    COUNT(DISTINCT cod_referencia)        AS num_produtos,
    SUM(quantidade)                       AS total_unidades,
    MIN(data_pedido)                      AS data_inicio,
    MAX(data_pedido)                      AS data_fim,
    ARRAY(SELECT DISTINCT ano FROM sales_rows ORDER BY ano) AS anos_disponiveis
  FROM sales_rows
  WHERE (p_ano         IS NULL OR ano         = p_ano)
    AND (p_cod_cliente IS NULL OR cod_cliente = p_cod_cliente);
$$;

-- ─── Optimized Helpers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_distinct_years()
RETURNS TABLE (ano SMALLINT) 
LANGUAGE SQL STABLE AS $$
  SELECT DISTINCT ano FROM sales_rows ORDER BY ano;
$$;

CREATE OR REPLACE FUNCTION get_distinct_clients()
RETURNS TABLE (cod_cliente TEXT, nome_cliente TEXT) 
LANGUAGE SQL STABLE AS $$
  SELECT DISTINCT cod_cliente, MAX(nome_cliente) as nome_cliente
  FROM sales_rows 
  GROUP BY cod_cliente
  ORDER BY nome_cliente;
$$;

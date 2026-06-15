-- Migration 0019: Mover filtros p_cod_referencia e p_cod_cliente da cláusula ON
-- do LEFT JOIN para o WHERE da função geral().
--
-- Comportamento ANTERIOR (0006_report_filters.sql):
--   Os filtros ficavam no ON do LEFT JOIN, fazendo com que linhas sem venda
--   correspondente continuassem no resultado com todos os meses zerados
--   ("config-driven": sempre exibe todas as linhas configuradas).
--
-- Comportamento NOVO (este arquivo):
--   Os filtros ficam no WHERE, removendo do resultado as linhas que não
--   possuem vendas correspondentes ao filtro aplicado — alinhando a aba
--   Geral ao comportamento dos demais relatórios.
--
-- REVERTÍVEL: para restaurar o comportamento "config-driven" basta
-- re-executar a definição de geral() da migration 0006 (ou criar uma
-- migration 0020 com o CREATE OR REPLACE equivalente).
--
-- NOTA DE PRODUTO: este é o comportamento recomendado (filtrar = remover
-- linhas). Confirmar com o cliente se preferir o comportamento config-driven
-- (linhas zeradas) — ver spec §9 e tasks.md T-002/T-004.

CREATE OR REPLACE FUNCTION geral(
  p_ano              INT,
  p_cod_cliente      TEXT DEFAULT NULL,
  p_cod_referencia   TEXT DEFAULT NULL,
  p_semestre         INT  DEFAULT NULL,
  p_descr_hist_financ TEXT DEFAULT NULL
)
RETURNS TABLE (
  id          BIGINT,
  sort_order  INTEGER,
  categoria   TEXT,
  cod_referencia TEXT,
  label       TEXT,
  extra_data  JSONB,
  jan         NUMERIC,
  fev         NUMERIC,
  mar         NUMERIC,
  abr         NUMERIC,
  mai         NUMERIC,
  jun         NUMERIC,
  jul         NUMERIC,
  ago         NUMERIC,
  set_        NUMERIC,
  out_        NUMERIC,
  nov         NUMERIC,
  dez         NUMERIC,
  total_ano   NUMERIC
)
LANGUAGE SQL STABLE AS $$
  SELECT
    c.id,
    c.sort_order,
    c.categoria,
    c.cod_referencia,
    COALESCE(c.label, MAX(s.descr_produto), c.cod_referencia),
    c.extra_data,
    SUM(CASE WHEN s.mes = 1  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 2  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 3  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 4  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 5  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 6  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 7  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 8  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 9  THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 10 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 11 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes = 12 THEN s.quantidade ELSE 0 END),
    SUM(COALESCE(s.quantidade, 0))
  FROM report_config_items c
  -- O join mantém apenas os predicados estruturais: código e ano.
  -- Os filtros de cliente/produto foram movidos para o WHERE (abaixo),
  -- garantindo que linhas sem correspondência sejam removidas do resultado.
  JOIN sales_rows s
    ON  s.cod_referencia = c.cod_referencia
    AND s.ano            = p_ano
  WHERE c.report_key = 'geral'
    AND (p_cod_cliente     IS NULL OR s.cod_cliente     = p_cod_cliente)
    AND (p_cod_referencia  IS NULL OR s.cod_referencia  = p_cod_referencia)
    AND (p_semestre        IS NULL OR
         (p_semestre = 1 AND s.mes BETWEEN 1 AND 6) OR
         (p_semestre = 2 AND s.mes BETWEEN 7 AND 12))
    AND (p_descr_hist_financ IS NULL OR s.descr_hist_financ = p_descr_hist_financ)
  GROUP BY c.id, c.sort_order, c.categoria, c.cod_referencia, c.label, c.extra_data
  ORDER BY c.sort_order, c.categoria, c.cod_referencia;
$$;

-- Garantir que a função não seja acessível anonimamente (padrão de 0013).
REVOKE EXECUTE ON FUNCTION geral(INT, TEXT, TEXT, INT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION geral(INT, TEXT, TEXT, INT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION geral(INT, TEXT, TEXT, INT, TEXT) TO authenticated;

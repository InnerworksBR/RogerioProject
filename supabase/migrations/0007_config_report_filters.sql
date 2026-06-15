-- Apply the shared filter DTO to configured reports too.
DROP FUNCTION IF EXISTS base_de_itens(INT[]);
DROP FUNCTION IF EXISTS bagagitos(INT[]);

CREATE OR REPLACE FUNCTION configured_report_rows(
  p_report_key TEXT,
  p_anos INT[],
  p_cod_cliente TEXT DEFAULT NULL,
  p_cod_referencia TEXT DEFAULT NULL,
  p_semestre INT DEFAULT NULL,
  p_descr_hist_financ TEXT DEFAULT NULL
)
RETURNS TABLE (id BIGINT, sort_order INTEGER, cod_referencia TEXT, label TEXT, extra_data JSONB, totals_by_year JSONB)
LANGUAGE SQL STABLE AS $$
  SELECT c.id, c.sort_order, c.cod_referencia, COALESCE(c.label, MAX(s.descr_produto), c.cod_referencia), c.extra_data,
    COALESCE(jsonb_object_agg(s.ano::TEXT, s.qty) FILTER (WHERE s.ano IS NOT NULL), '{}'::JSONB)
  FROM report_config_items c
  LEFT JOIN (
    SELECT sr.cod_referencia, sr.ano, SUM(sr.quantidade) AS qty, MAX(sr.descr_produto) AS descr_produto
    FROM sales_rows sr
    WHERE sr.ano = ANY(p_anos)
      AND (p_cod_cliente IS NULL OR sr.cod_cliente=p_cod_cliente)
      AND (p_cod_referencia IS NULL OR sr.cod_referencia=p_cod_referencia)
      AND (p_semestre IS NULL OR (p_semestre=1 AND sr.mes BETWEEN 1 AND 6) OR (p_semestre=2 AND sr.mes BETWEEN 7 AND 12))
      AND (p_descr_hist_financ IS NULL OR sr.descr_hist_financ=p_descr_hist_financ)
    GROUP BY sr.cod_referencia, sr.ano
  ) s ON s.cod_referencia=c.cod_referencia
  WHERE c.report_key=p_report_key
  GROUP BY c.id,c.sort_order,c.cod_referencia,c.label,c.extra_data
  ORDER BY c.sort_order,c.cod_referencia;
$$;

CREATE OR REPLACE FUNCTION base_de_itens(p_anos INT[], p_cod_cliente TEXT DEFAULT NULL, p_cod_referencia TEXT DEFAULT NULL, p_semestre INT DEFAULT NULL, p_descr_hist_financ TEXT DEFAULT NULL)
RETURNS TABLE (id BIGINT, sort_order INTEGER, cod_referencia TEXT, label TEXT, extra_data JSONB, totals_by_year JSONB)
LANGUAGE SQL STABLE AS $$
  SELECT * FROM configured_report_rows('base_itens', p_anos, p_cod_cliente, p_cod_referencia, p_semestre, p_descr_hist_financ);
$$;

CREATE OR REPLACE FUNCTION bagagitos(p_anos INT[], p_cod_cliente TEXT DEFAULT NULL, p_cod_referencia TEXT DEFAULT NULL, p_semestre INT DEFAULT NULL, p_descr_hist_financ TEXT DEFAULT NULL)
RETURNS TABLE (id BIGINT, sort_order INTEGER, cod_referencia TEXT, label TEXT, extra_data JSONB, totals_by_year JSONB)
LANGUAGE SQL STABLE AS $$
  SELECT * FROM configured_report_rows('bagagitos', p_anos, p_cod_cliente, p_cod_referencia, p_semestre, p_descr_hist_financ);
$$;

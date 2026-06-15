-- Shared report filters for dashboards, reports and exports.
DROP FUNCTION IF EXISTS tabela_dinamica_geral(INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS base_de_compra(INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS geral(INT, TEXT);
DROP FUNCTION IF EXISTS dashboard_summary(INT, TEXT);

CREATE OR REPLACE FUNCTION tabela_dinamica_geral(p_ano INT, p_cod_cliente TEXT DEFAULT NULL, p_cod_referencia TEXT DEFAULT NULL, p_semestre INT DEFAULT NULL, p_descr_hist_financ TEXT DEFAULT NULL)
RETURNS TABLE (ano SMALLINT, cod_cliente TEXT, nome_cliente TEXT, apelido TEXT, cod_referencia TEXT, descr_produto TEXT, jan NUMERIC, fev NUMERIC, mar NUMERIC, abr NUMERIC, mai NUMERIC, jun NUMERIC, jul NUMERIC, ago NUMERIC, set_ NUMERIC, out_ NUMERIC, nov NUMERIC, dez NUMERIC, total_ano NUMERIC, total_valor NUMERIC)
LANGUAGE SQL STABLE AS $$
  SELECT s.ano, s.cod_cliente, MAX(s.nome_cliente), MAX(s.apelido), s.cod_referencia, MAX(s.descr_produto),
    SUM(CASE WHEN s.mes=1 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=2 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=3 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=4 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes=5 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=6 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=7 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=8 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes=9 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=10 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=11 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=12 THEN s.quantidade ELSE 0 END),
    SUM(s.quantidade), SUM(s.valor_total)
  FROM sales_rows s WHERE s.ano=p_ano
    AND (p_cod_cliente IS NULL OR s.cod_cliente=p_cod_cliente) AND (p_cod_referencia IS NULL OR s.cod_referencia=p_cod_referencia)
    AND (p_semestre IS NULL OR (p_semestre=1 AND s.mes BETWEEN 1 AND 6) OR (p_semestre=2 AND s.mes BETWEEN 7 AND 12))
    AND (p_descr_hist_financ IS NULL OR s.descr_hist_financ=p_descr_hist_financ)
  GROUP BY s.ano, s.cod_cliente, s.cod_referencia ORDER BY MAX(s.nome_cliente), s.cod_referencia;
$$;

CREATE OR REPLACE FUNCTION base_de_compra(p_ano INT, p_cod_cliente TEXT DEFAULT NULL, p_cod_referencia TEXT DEFAULT NULL, p_semestre INT DEFAULT NULL, p_descr_hist_financ TEXT DEFAULT NULL)
RETURNS TABLE (ano SMALLINT, cod_referencia TEXT, descr_produto TEXT, jan NUMERIC, fev NUMERIC, mar NUMERIC, abr NUMERIC, mai NUMERIC, jun NUMERIC, jul NUMERIC, ago NUMERIC, set_ NUMERIC, out_ NUMERIC, nov NUMERIC, dez NUMERIC, total_ano NUMERIC)
LANGUAGE SQL STABLE AS $$
  SELECT s.ano, s.cod_referencia, MAX(s.descr_produto),
    SUM(CASE WHEN s.mes=1 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=2 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=3 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=4 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes=5 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=6 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=7 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=8 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes=9 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=10 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=11 THEN s.quantidade ELSE 0 END), SUM(CASE WHEN s.mes=12 THEN s.quantidade ELSE 0 END), SUM(s.quantidade)
  FROM sales_rows s WHERE s.ano=p_ano
    AND (p_cod_cliente IS NULL OR s.cod_cliente=p_cod_cliente) AND (p_cod_referencia IS NULL OR s.cod_referencia=p_cod_referencia)
    AND (p_semestre IS NULL OR (p_semestre=1 AND s.mes BETWEEN 1 AND 6) OR (p_semestre=2 AND s.mes BETWEEN 7 AND 12))
    AND (p_descr_hist_financ IS NULL OR s.descr_hist_financ=p_descr_hist_financ)
  GROUP BY s.ano, s.cod_referencia ORDER BY s.cod_referencia;
$$;

CREATE OR REPLACE FUNCTION dashboard_summary(p_ano INT DEFAULT NULL, p_cod_cliente TEXT DEFAULT NULL, p_cod_referencia TEXT DEFAULT NULL, p_semestre INT DEFAULT NULL, p_descr_hist_financ TEXT DEFAULT NULL)
RETURNS TABLE (total_pedidos BIGINT, total_faturado NUMERIC, num_clientes BIGINT, num_produtos BIGINT, total_unidades NUMERIC, data_inicio DATE, data_fim DATE, anos_disponiveis INT[])
LANGUAGE SQL STABLE AS $$
  SELECT COUNT(DISTINCT codigo_pedido), COALESCE(SUM(valor_total),0), COUNT(DISTINCT cod_cliente), COUNT(DISTINCT cod_referencia), COALESCE(SUM(quantidade),0), MIN(data_pedido), MAX(data_pedido), ARRAY(SELECT DISTINCT ano FROM sales_rows ORDER BY ano)
  FROM sales_rows WHERE (p_ano IS NULL OR ano=p_ano) AND (p_cod_cliente IS NULL OR cod_cliente=p_cod_cliente)
    AND (p_cod_referencia IS NULL OR cod_referencia=p_cod_referencia)
    AND (p_semestre IS NULL OR (p_semestre=1 AND mes BETWEEN 1 AND 6) OR (p_semestre=2 AND mes BETWEEN 7 AND 12))
    AND (p_descr_hist_financ IS NULL OR descr_hist_financ=p_descr_hist_financ);
$$;

CREATE OR REPLACE FUNCTION geral(p_ano INT, p_cod_cliente TEXT DEFAULT NULL, p_cod_referencia TEXT DEFAULT NULL, p_semestre INT DEFAULT NULL, p_descr_hist_financ TEXT DEFAULT NULL)
RETURNS TABLE (id BIGINT, sort_order INTEGER, categoria TEXT, cod_referencia TEXT, label TEXT, extra_data JSONB, jan NUMERIC, fev NUMERIC, mar NUMERIC, abr NUMERIC, mai NUMERIC, jun NUMERIC, jul NUMERIC, ago NUMERIC, set_ NUMERIC, out_ NUMERIC, nov NUMERIC, dez NUMERIC, total_ano NUMERIC)
LANGUAGE SQL STABLE AS $$
  SELECT c.id,c.sort_order,c.categoria,c.cod_referencia,COALESCE(c.label,MAX(s.descr_produto),c.cod_referencia),c.extra_data,
    SUM(CASE WHEN s.mes=1 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=2 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=3 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=4 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes=5 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=6 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=7 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=8 THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.mes=9 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=10 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=11 THEN s.quantidade ELSE 0 END),SUM(CASE WHEN s.mes=12 THEN s.quantidade ELSE 0 END),SUM(COALESCE(s.quantidade,0))
  FROM report_config_items c LEFT JOIN sales_rows s ON s.cod_referencia=c.cod_referencia AND s.ano=p_ano
    AND (p_cod_cliente IS NULL OR s.cod_cliente=p_cod_cliente) AND (p_cod_referencia IS NULL OR s.cod_referencia=p_cod_referencia)
    AND (p_semestre IS NULL OR (p_semestre=1 AND s.mes BETWEEN 1 AND 6) OR (p_semestre=2 AND s.mes BETWEEN 7 AND 12))
    AND (p_descr_hist_financ IS NULL OR s.descr_hist_financ=p_descr_hist_financ)
  WHERE c.report_key='geral' GROUP BY c.id,c.sort_order,c.categoria,c.cod_referencia,c.label,c.extra_data ORDER BY c.sort_order,c.categoria,c.cod_referencia;
$$;

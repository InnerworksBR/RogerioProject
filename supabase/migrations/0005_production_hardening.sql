-- Autimex Reports - production hardening
-- Run after 0004_saas_architecture.sql.

DROP INDEX IF EXISTS idx_report_config_unique_report_ref;
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_config_unique_user_report_ref
  ON report_config_items(user_id, report_key, cod_referencia)
  WHERE cod_referencia IS NOT NULL;

ALTER TABLE uploads ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS skipped_rows INTEGER NOT NULL DEFAULT 0;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS skip_summary JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_unique_user_fingerprint
  ON uploads(user_id, fingerprint)
  WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uploads_user_period
  ON uploads(user_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS share_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  client_id   TEXT NOT NULL,
  year        SMALLINT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_links_active ON share_links(token_hash, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_links_owner_access" ON share_links
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE share_links TO authenticated;
REVOKE ALL ON TABLE share_links FROM anon;

-- Dashboard cards count real orders, not line items.
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
    COUNT(DISTINCT codigo_pedido)          AS total_pedidos,
    COALESCE(SUM(valor_total), 0)          AS total_faturado,
    COUNT(DISTINCT cod_cliente)            AS num_clientes,
    COUNT(DISTINCT cod_referencia)         AS num_produtos,
    COALESCE(SUM(quantidade), 0)           AS total_unidades,
    MIN(data_pedido)                       AS data_inicio,
    MAX(data_pedido)                       AS data_fim,
    ARRAY(SELECT DISTINCT ano FROM sales_rows ORDER BY ano) AS anos_disponiveis
  FROM sales_rows
  WHERE (p_ano IS NULL OR ano = p_ano)
    AND (p_cod_cliente IS NULL OR cod_cliente = p_cod_cliente);
$$;

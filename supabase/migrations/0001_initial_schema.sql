-- =============================================================
-- Autimex Reports - Initial Schema
-- Run this in the Supabase SQL Editor
-- =============================================================

-- Table: uploads
-- Tracks each uploaded XLS file
CREATE TABLE IF NOT EXISTS uploads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT NOT NULL,
  row_count   INTEGER,
  status      TEXT NOT NULL DEFAULT 'processing', -- processing | complete | error
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: sales_rows
-- Stores every parsed & filtered sales row (SituacaoItem = 'LIQ' only)
CREATE TABLE IF NOT EXISTS sales_rows (
  id                    BIGSERIAL PRIMARY KEY,
  upload_id             UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  -- Client
  cod_cliente           TEXT NOT NULL,
  nome_cliente          TEXT NOT NULL,
  apelido               TEXT,
  -- Product
  cod_referencia        TEXT NOT NULL,  -- always string: "402", "402-CL", "101M"
  descr_produto         TEXT NOT NULL,
  -- Order details
  data_pedido           DATE,
  codigo_pedido         TEXT,
  numero_pedido_talao   TEXT,
  pedido_cliente_opc    TEXT,
  -- Quantities & values
  preco_unitario        NUMERIC(12,4),
  quantidade            NUMERIC(12,4) NOT NULL DEFAULT 0,
  valor_total           NUMERIC(14,4) NOT NULL DEFAULT 0,
  desconto_fiscal       NUMERIC(14,4),
  qtd_saldo             NUMERIC(12,4),
  unid_venda            TEXT,
  situacao_item         TEXT,
  -- Company / accounting
  cod_empresa           TEXT,
  nome_empresa          TEXT,
  cod_hist_financeiro   TEXT,
  descr_hist_financ     TEXT,
  data_limite_entrega   DATE,
  cod_intermediador     TEXT,
  nome_intermediador    TEXT,
  -- Derived fields (computed on parse)
  mes                   SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano                   SMALLINT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes critical for report query performance
CREATE INDEX IF NOT EXISTS idx_sales_ano                ON sales_rows(ano);
CREATE INDEX IF NOT EXISTS idx_sales_ano_cliente        ON sales_rows(ano, cod_cliente);
CREATE INDEX IF NOT EXISTS idx_sales_cod_referencia     ON sales_rows(cod_referencia);
CREATE INDEX IF NOT EXISTS idx_sales_upload_id          ON sales_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_sales_cod_cliente        ON sales_rows(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_sales_codigo_pedido     ON sales_rows(codigo_pedido);

-- Table: report_config_items
-- Stores user-managed lists for BASE DE ITENS, BAGAGITOS, and GERAL reports
CREATE TABLE IF NOT EXISTS report_config_items (
  id             BIGSERIAL PRIMARY KEY,
  report_key     TEXT NOT NULL,   -- 'base_itens' | 'bagagitos' | 'geral'
  cod_referencia TEXT,            -- key for lookup against sales_rows
  categoria      TEXT,            -- grouping label used by GERAL report
  label          TEXT,            -- display name override (descricao)
  sort_order     INTEGER NOT NULL DEFAULT 0,
  -- Extra fields stored as JSONB to avoid schema changes per report type
  -- For base_itens: { dts, r2a, lumax, loma, lancamento }
  -- For bagagitos:  { emb, plastiron, ano_aplicacao, aplicacao, cor, outros_dados }
  -- For geral:      { status, emb, plastiron, ano_aplicacao, aplicacao, cor, outros_dados }
  extra_data     JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_report_key ON report_config_items(report_key);

-- =============================================================
-- Row Level Security (open for MVP demo - no auth required)
-- =============================================================
ALTER TABLE uploads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_rows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_config_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_uploads"  ON uploads             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sales"    ON sales_rows           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_config"   ON report_config_items  FOR ALL USING (true) WITH CHECK (true);

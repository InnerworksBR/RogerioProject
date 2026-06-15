-- Autimex Reports - idempotent upload integrity
-- Run after 0013_production_security_hardening.sql.

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_unique_user_fingerprint
  ON uploads(user_id, fingerprint)
  WHERE fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS upload_chunks (
  upload_id     UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL CHECK (chunk_index >= 0),
  total_chunks  INTEGER NOT NULL CHECK (total_chunks > 0),
  row_count     INTEGER NOT NULL CHECK (row_count > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (upload_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_upload_chunks_user_upload
  ON upload_chunks(user_id, upload_id);

ALTER TABLE upload_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upload_chunks_owner_access" ON upload_chunks;
CREATE POLICY "upload_chunks_owner_access" ON upload_chunks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON TABLE upload_chunks TO authenticated;
REVOKE ALL ON TABLE upload_chunks FROM PUBLIC;
REVOKE ALL ON TABLE upload_chunks FROM anon;

CREATE OR REPLACE FUNCTION append_upload_chunk(
  p_upload_id UUID,
  p_chunk_index INTEGER,
  p_total_chunks INTEGER,
  p_rows JSONB
)
RETURNS TABLE (
  applied BOOLEAN,
  chunk_row_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_upload_status TEXT;
  v_row_count INTEGER;
  v_existing upload_chunks%ROWTYPE;
  v_current_row_count BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_chunk_index IS NULL OR p_total_chunks IS NULL
    OR p_chunk_index < 0 OR p_total_chunks < 1 OR p_total_chunks > 400
    OR p_chunk_index >= p_total_chunks THEN
    RAISE EXCEPTION 'Invalid chunk metadata' USING ERRCODE = '22023';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Rows must be a JSON array' USING ERRCODE = '22023';
  END IF;

  v_row_count := jsonb_array_length(p_rows);
  IF v_row_count < 1 OR v_row_count > 500 THEN
    RAISE EXCEPTION 'Invalid chunk size' USING ERRCODE = '22023';
  END IF;

  SELECT status
    INTO v_upload_status
  FROM uploads
  WHERE id = p_upload_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
    INTO v_existing
  FROM upload_chunks
  WHERE upload_id = p_upload_id
    AND chunk_index = p_chunk_index;

  IF FOUND THEN
    IF v_existing.user_id <> v_user_id
      OR v_existing.total_chunks <> p_total_chunks
      OR v_existing.row_count <> v_row_count THEN
      RAISE EXCEPTION 'Chunk replay metadata mismatch' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY SELECT FALSE, v_existing.row_count;
    RETURN;
  END IF;

  IF v_upload_status <> 'processing' THEN
    RAISE EXCEPTION 'Upload is not processing' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM upload_chunks
    WHERE upload_id = p_upload_id
      AND total_chunks <> p_total_chunks
  ) THEN
    RAISE EXCEPTION 'Total chunks mismatch' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(row_count), 0)
    INTO v_current_row_count
  FROM upload_chunks
  WHERE upload_id = p_upload_id;

  IF v_current_row_count + v_row_count > 100000 THEN
    RAISE EXCEPTION 'Upload row limit exceeded' USING ERRCODE = '22023';
  END IF;

  INSERT INTO upload_chunks (upload_id, user_id, chunk_index, total_chunks, row_count)
  VALUES (p_upload_id, v_user_id, p_chunk_index, p_total_chunks, v_row_count);

  INSERT INTO sales_rows (
    upload_id, user_id, cod_empresa, nome_empresa, cod_hist_financeiro,
    descr_hist_financ, cod_cliente, nome_cliente, apelido, data_pedido,
    codigo_pedido, numero_pedido_talao, pedido_cliente_opc, cod_referencia,
    descr_produto, preco_unitario, quantidade, situacao_item,
    data_limite_entrega, qtd_saldo, unid_venda, valor_total, desconto_fiscal,
    cod_intermediador, nome_intermediador, mes, ano
  )
  SELECT
    p_upload_id, v_user_id, row.cod_empresa, row.nome_empresa,
    row.cod_hist_financeiro, row.descr_hist_financ, row.cod_cliente,
    row.nome_cliente, row.apelido, row.data_pedido, row.codigo_pedido,
    row.numero_pedido_talao, row.pedido_cliente_opc, row.cod_referencia,
    row.descr_produto, row.preco_unitario, row.quantidade, row.situacao_item,
    row.data_limite_entrega, row.qtd_saldo, row.unid_venda, row.valor_total,
    row.desconto_fiscal, row.cod_intermediador, row.nome_intermediador,
    row.mes, row.ano
  FROM jsonb_to_recordset(p_rows) AS row(
    cod_empresa TEXT,
    nome_empresa TEXT,
    cod_hist_financeiro TEXT,
    descr_hist_financ TEXT,
    cod_cliente TEXT,
    nome_cliente TEXT,
    apelido TEXT,
    data_pedido DATE,
    codigo_pedido TEXT,
    numero_pedido_talao TEXT,
    pedido_cliente_opc TEXT,
    cod_referencia TEXT,
    descr_produto TEXT,
    preco_unitario NUMERIC,
    quantidade NUMERIC,
    situacao_item TEXT,
    data_limite_entrega DATE,
    qtd_saldo NUMERIC,
    unid_venda TEXT,
    valor_total NUMERIC,
    desconto_fiscal NUMERIC,
    cod_intermediador TEXT,
    nome_intermediador TEXT,
    mes SMALLINT,
    ano SMALLINT
  );

  RETURN QUERY SELECT TRUE, v_row_count;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_upload(
  p_upload_id UUID,
  p_total_chunks INTEGER
)
RETURNS TABLE (
  row_count INTEGER,
  already_complete BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_upload_status TEXT;
  v_upload_row_count INTEGER;
  v_chunk_count INTEGER;
  v_first_chunk INTEGER;
  v_last_chunk INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_total_chunks IS NULL OR p_total_chunks < 1 OR p_total_chunks > 400 THEN
    RAISE EXCEPTION 'Invalid total chunks' USING ERRCODE = '22023';
  END IF;

  SELECT status, uploads.row_count
    INTO v_upload_status, v_upload_row_count
  FROM uploads
  WHERE id = p_upload_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_upload_status = 'complete' THEN
    RETURN QUERY SELECT COALESCE(v_upload_row_count, 0), TRUE;
    RETURN;
  END IF;

  IF v_upload_status <> 'processing' THEN
    RAISE EXCEPTION 'Upload is not processing' USING ERRCODE = '55000';
  END IF;

  SELECT COUNT(*)::INTEGER, MIN(chunk_index), MAX(chunk_index),
         COALESCE(SUM(upload_chunks.row_count), 0)::INTEGER
    INTO v_chunk_count, v_first_chunk, v_last_chunk, v_upload_row_count
  FROM upload_chunks
  WHERE upload_id = p_upload_id
    AND user_id = v_user_id
    AND total_chunks = p_total_chunks;

  IF v_chunk_count <> p_total_chunks
    OR v_first_chunk <> 0
    OR v_last_chunk <> p_total_chunks - 1 THEN
    RAISE EXCEPTION 'Upload chunks are incomplete' USING ERRCODE = '55000';
  END IF;

  UPDATE uploads
  SET status = 'complete',
      row_count = v_upload_row_count,
      error_msg = NULL
  WHERE id = p_upload_id
    AND user_id = v_user_id;

  RETURN QUERY SELECT v_upload_row_count, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION append_upload_chunk(UUID, INTEGER, INTEGER, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION append_upload_chunk(UUID, INTEGER, INTEGER, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION append_upload_chunk(UUID, INTEGER, INTEGER, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION finalize_upload(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION finalize_upload(UUID, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION finalize_upload(UUID, INTEGER) TO authenticated;

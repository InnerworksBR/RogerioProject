-- Autimex Reports - reimportacao com substituicao por periodo exato
-- Run after 0021_report_query_optimizations.sql.
--
-- Regra de negocio: o usuario pode reenviar uma planilha do MESMO periodo
-- (mesmas datas de inicio/fim) com dados corrigidos. A versao nova passa a ser
-- a verdade daquele periodo: os uploads anteriores do periodo exato sao removidos
-- (em cascata, junto com sales_rows e upload_chunks) ao finalizar o novo upload.
--
-- Por isso o fingerprint deixa de ser uma trava de unicidade: reenviar a mesma
-- planilha (ou uma versao corrigida) precisa ser permitido.

DROP INDEX IF EXISTS idx_uploads_unique_user_fingerprint;

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
  v_period_start DATE;
  v_period_end DATE;
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

  SELECT status, uploads.row_count, period_start, period_end
    INTO v_upload_status, v_upload_row_count, v_period_start, v_period_end
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

  -- Substituicao por periodo exato: remove versoes anteriores (e orfaos com erro)
  -- do MESMO periodo deste usuario. O cascade apaga sales_rows e upload_chunks.
  DELETE FROM uploads
  WHERE user_id = v_user_id
    AND id <> p_upload_id
    AND period_start IS NOT DISTINCT FROM v_period_start
    AND period_end IS NOT DISTINCT FROM v_period_end;

  RETURN QUERY SELECT v_upload_row_count, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION finalize_upload(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION finalize_upload(UUID, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION finalize_upload(UUID, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';

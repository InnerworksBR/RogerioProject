-- Rate-limit atômico para o endpoint público de compartilhamento de links.
-- Espelha o padrão de consume_ai_rate_limit (0017_ai_usage_limits.sql):
-- SECURITY DEFINER, pg_advisory_xact_lock, RLS + REVOKE ALL em PUBLIC/anon.
-- Chave: token_hash (não forjável pelo cliente), janela de 60 s, 30 req/min.

CREATE TABLE IF NOT EXISTS share_link_rate_limit (
  token_hash        TEXT      NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count     INT       NOT NULL CHECK (request_count > 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_hash, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_share_link_rate_limit_cleanup
  ON share_link_rate_limit(window_started_at);

ALTER TABLE share_link_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE share_link_rate_limit FROM PUBLIC;
REVOKE ALL ON TABLE share_link_rate_limit FROM anon;
REVOKE ALL ON TABLE share_link_rate_limit FROM authenticated;

CREATE OR REPLACE FUNCTION consume_share_link_request(p_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit           INT := 30;
  v_window_seconds  INT := 60;
  v_window_start    TIMESTAMPTZ := date_trunc('minute', NOW());
  v_count           INT;
BEGIN
  -- Impede que um token NULL ou vazio seja passado
  IF p_token_hash IS NULL OR length(trim(p_token_hash)) = 0 THEN
    RAISE EXCEPTION 'token_hash invalido' USING ERRCODE = '22023';
  END IF;

  -- Lock por token para garantir atomicidade entre instâncias concorrentes
  PERFORM pg_advisory_xact_lock(hashtextextended(p_token_hash, 0));

  -- Expurga janelas antigas (mais de 2 janelas de folga)
  DELETE FROM share_link_rate_limit
   WHERE token_hash = p_token_hash
     AND window_started_at < v_window_start - (v_window_seconds * 2 || ' seconds')::INTERVAL;

  SELECT COALESCE(MAX(request_count), 0)
    INTO v_count
    FROM share_link_rate_limit
   WHERE token_hash = p_token_hash
     AND window_started_at = v_window_start;

  IF v_count >= v_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO share_link_rate_limit (token_hash, window_started_at, request_count)
  VALUES (p_token_hash, v_window_start, 1)
  ON CONFLICT (token_hash, window_started_at)
  DO UPDATE SET
    request_count = share_link_rate_limit.request_count + 1,
    updated_at    = NOW();

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION consume_share_link_request(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_share_link_request(TEXT) FROM anon;
-- Acessada pelo service_role (cliente admin server-side da rota pública).
-- anon não tem acesso direto: o endpoint autenticado pelo service_role chama a RPC.
GRANT EXECUTE ON FUNCTION consume_share_link_request(TEXT) TO service_role;

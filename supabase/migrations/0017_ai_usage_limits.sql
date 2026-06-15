-- Atomic per-user limits for AI endpoints. Authenticated clients can only
-- consume quotas through the RPC and cannot read or mutate counters directly.
CREATE TABLE IF NOT EXISTS ai_usage_limits (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint          TEXT NOT NULL CHECK (endpoint IN ('ai_report_chat', 'ai_report_summary')),
  window_seconds    INT NOT NULL CHECK (window_seconds IN (60, 86400)),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count     INT NOT NULL CHECK (request_count > 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, endpoint, window_seconds, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_limits_cleanup
  ON ai_usage_limits(window_started_at);

ALTER TABLE ai_usage_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai_usage_limits FROM PUBLIC;
REVOKE ALL ON TABLE ai_usage_limits FROM anon;
REVOKE ALL ON TABLE ai_usage_limits FROM authenticated;

CREATE OR REPLACE FUNCTION consume_ai_rate_limit(p_endpoint TEXT)
RETURNS TABLE (
  allowed BOOLEAN,
  retry_after_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_minute_limit INT;
  v_day_limit INT;
  v_minute_start TIMESTAMPTZ := date_trunc('minute', NOW());
  v_day_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_minute_count INT;
  v_day_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  CASE p_endpoint
    WHEN 'ai_report_chat' THEN
      v_minute_limit := 6;
      v_day_limit := 100;
    WHEN 'ai_report_summary' THEN
      v_minute_limit := 3;
      v_day_limit := 30;
    ELSE
      RAISE EXCEPTION 'invalid AI rate limit endpoint' USING ERRCODE = '22023';
  END CASE;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT || ':' || p_endpoint, 0));

  DELETE FROM ai_usage_limits
   WHERE user_id = v_user_id
     AND endpoint = p_endpoint
     AND window_started_at < v_day_start - INTERVAL '1 day';

  SELECT COALESCE(MAX(request_count), 0)
    INTO v_minute_count
    FROM ai_usage_limits
   WHERE user_id = v_user_id
     AND endpoint = p_endpoint
     AND window_seconds = 60
     AND window_started_at = v_minute_start;

  SELECT COALESCE(MAX(request_count), 0)
    INTO v_day_count
    FROM ai_usage_limits
   WHERE user_id = v_user_id
     AND endpoint = p_endpoint
     AND window_seconds = 86400
     AND window_started_at = v_day_start;

  IF v_minute_count >= v_minute_limit THEN
    RETURN QUERY SELECT FALSE, GREATEST(CEIL(EXTRACT(EPOCH FROM (v_minute_start + INTERVAL '1 minute' - NOW())))::INT, 1);
    RETURN;
  END IF;

  IF v_day_count >= v_day_limit THEN
    RETURN QUERY SELECT FALSE, GREATEST(CEIL(EXTRACT(EPOCH FROM (v_day_start + INTERVAL '1 day' - NOW())))::INT, 1);
    RETURN;
  END IF;

  INSERT INTO ai_usage_limits (user_id, endpoint, window_seconds, window_started_at, request_count)
  VALUES
    (v_user_id, p_endpoint, 60, v_minute_start, 1),
    (v_user_id, p_endpoint, 86400, v_day_start, 1)
  ON CONFLICT (user_id, endpoint, window_seconds, window_started_at)
  DO UPDATE SET
    request_count = ai_usage_limits.request_count + 1,
    updated_at = NOW();

  RETURN QUERY SELECT TRUE, 0;
END;
$$;

REVOKE ALL ON FUNCTION consume_ai_rate_limit(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_ai_rate_limit(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION consume_ai_rate_limit(TEXT) TO authenticated;

-- Persistent AI report chat history and authorized client ranking.
CREATE TABLE IF NOT EXISTS report_chat_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_chat_conversations_user_updated
  ON report_chat_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS report_chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES report_chat_conversations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_chat_messages_conversation_created
  ON report_chat_messages(conversation_id, created_at ASC);

ALTER TABLE report_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_chat_conversations_owner_access" ON report_chat_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "report_chat_messages_owner_read" ON report_chat_messages
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM report_chat_conversations conversation
      WHERE conversation.id = conversation_id
        AND conversation.user_id = auth.uid()
    )
  );

CREATE POLICY "report_chat_messages_owner_insert" ON report_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM report_chat_conversations conversation
      WHERE conversation.id = conversation_id
        AND conversation.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE report_chat_conversations TO authenticated;
GRANT SELECT, INSERT ON TABLE report_chat_messages TO authenticated;
REVOKE ALL ON TABLE report_chat_conversations FROM anon;
REVOKE ALL ON TABLE report_chat_messages FROM anon;

CREATE OR REPLACE FUNCTION chat_top_clients(
  p_ano INT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  cod_cliente TEXT,
  nome_cliente TEXT,
  total_faturado NUMERIC,
  total_pedidos BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sales.cod_cliente,
    MAX(sales.nome_cliente) AS nome_cliente,
    COALESCE(SUM(sales.valor_total), 0) AS total_faturado,
    COUNT(DISTINCT sales.codigo_pedido) AS total_pedidos
  FROM sales_rows sales
  WHERE sales.ano = p_ano
    AND (
      sales.user_id = auth.uid()
      OR sales.user_id IN (
        SELECT profile.id
        FROM profiles profile
        WHERE profile.leader_id = auth.uid()
      )
    )
  GROUP BY sales.cod_cliente
  ORDER BY total_faturado DESC, nome_cliente ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

REVOKE ALL ON FUNCTION chat_top_clients(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION chat_top_clients(INT, INT) TO authenticated;
REVOKE ALL ON FUNCTION chat_top_clients(INT, INT) FROM anon;

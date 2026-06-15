-- ============================================================================
-- Reset de DADOS para ENTREGA — Autimex Reports
-- ============================================================================
-- O QUE FAZ: limpa TODOS os dados transacionais, PRESERVANDO o schema, as
-- migrations e os usuarios de autenticacao (auth.users) + seus perfis (profiles).
--
-- COMO RODAR: cole no Supabase -> SQL Editor e execute.
--   ACAO DESTRUTIVA E IRREVERSIVEL. Confirme que esta no projeto CORRETO antes
--   de rodar (Project Settings -> General -> Reference ID).
--   Recomendado fazer um backup/branch do banco no Supabase antes.
--
-- NAO afeta: schema/migrations, auth.users (logins) nem public.profiles (papeis).
--
-- ATENCAO sobre report_config_items: contem as listas configuradas pelo usuario
-- (Base de Itens / Bagagitos / Geral). Esta INCLUIDO no TRUNCATE abaixo. Se quiser
-- MANTER essas listas para a entrega, remova a linha `public.report_config_items,`.
--
-- DEPOIS deste reset, para o sistema ficar pronto para entrega ainda e preciso:
--   1) Aplicar as migrations novas 0019, 0020 e 0021 (nesta ordem) se ainda nao
--      foram aplicadas (supabase db push ou via SQL Editor).
--   2) Rotacionar SUPABASE_SERVICE_ROLE_KEY e OPENAI_API_KEY (ver deploy-checklist).
--   3) (Opcional) Re-seed das listas de relatorio pela tela de Configuracoes.
-- ============================================================================

BEGIN;

TRUNCATE TABLE
  public.sales_rows,
  public.upload_chunks,
  public.uploads,
  public.report_config_items,
  public.share_link_rate_limit,
  public.share_links,
  public.license_requests,
  public.report_chat_messages,
  public.report_chat_conversations,
  public.rep_offboarding_operations,
  public.ai_usage_limits
RESTART IDENTITY CASCADE;

COMMIT;

-- Verificacao: todas as linhas abaixo devem retornar 0 (exceto profiles, preservado).
SELECT 'sales_rows'                 AS tabela, count(*) AS linhas FROM public.sales_rows
UNION ALL SELECT 'uploads',                    count(*) FROM public.uploads
UNION ALL SELECT 'upload_chunks',              count(*) FROM public.upload_chunks
UNION ALL SELECT 'report_config_items',        count(*) FROM public.report_config_items
UNION ALL SELECT 'share_links',                count(*) FROM public.share_links
UNION ALL SELECT 'share_link_rate_limit',      count(*) FROM public.share_link_rate_limit
UNION ALL SELECT 'license_requests',           count(*) FROM public.license_requests
UNION ALL SELECT 'report_chat_conversations',  count(*) FROM public.report_chat_conversations
UNION ALL SELECT 'report_chat_messages',       count(*) FROM public.report_chat_messages
UNION ALL SELECT 'rep_offboarding_operations', count(*) FROM public.rep_offboarding_operations
UNION ALL SELECT 'ai_usage_limits',            count(*) FROM public.ai_usage_limits
UNION ALL SELECT 'profiles (PRESERVADO)',      count(*) FROM public.profiles;

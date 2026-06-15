-- ============================================================================
-- Reset de DADOS para ENTREGA — Autimex Reports
-- ============================================================================
-- O QUE FAZ: limpa TODOS os dados transacionais, PRESERVANDO o schema, as
-- migrations e os usuarios de autenticacao (auth.users) + seus perfis (profiles).
--
-- COMO RODAR: cole no Supabase -> SQL Editor e execute.
--   ACAO DESTRUTIVA E IRREVERSIVEL. Confirme que esta no projeto CORRETO antes
--   (Project Settings -> General -> Reference ID). Recomendado tirar um backup /
--   criar um branch do banco no Supabase antes de rodar.
--
-- NAO afeta: schema/migrations, auth.users (logins) nem public.profiles (papeis).
--
-- TOLERANTE A ORDEM: o bloco abaixo so trunca tabelas que EXISTEM, entao funciona
-- tanto antes quanto depois de aplicar as migrations novas (0019/0020/0021).
--
-- ATENCAO sobre report_config_items: contem as listas configuradas pelo usuario
-- (Base de Itens / Bagagitos / Geral). Esta INCLUIDO no reset. Se quiser MANTER
-- essas listas, remova 'report_config_items' do array abaixo.
--
-- ORDEM RECOMENDADA DE ENTREGA:
--   1) Aplicar migrations 0019, 0020 e 0021 (nesta ordem) — supabase db push
--      ou colando os .sql no SQL Editor.
--   2) Rodar este reset.
--   3) Rotacionar SUPABASE_SERVICE_ROLE_KEY e OPENAI_API_KEY (ver deploy-checklist).
--   4) (Opcional) Re-seed das listas de relatorio pela tela de Configuracoes.
-- ============================================================================

DO $$
DECLARE
  t text;
  alvos text[] := ARRAY[
    'sales_rows',
    'upload_chunks',
    'uploads',
    'report_config_items',
    'share_link_rate_limit',
    'share_links',
    'license_requests',
    'report_chat_messages',
    'report_chat_conversations',
    'rep_offboarding_operations',
    'ai_usage_limits'
  ];
BEGIN
  FOREACH t IN ARRAY alvos LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
      RAISE NOTICE 'truncada: public.%', t;
    ELSE
      RAISE NOTICE 'ignorada (nao existe ainda): public.%', t;
    END IF;
  END LOOP;
END $$;

-- Verificacao (tabelas presentes desde as primeiras migrations): devem retornar 0,
-- exceto profiles, que e PRESERVADO.
SELECT 'sales_rows'          AS tabela, count(*) AS linhas FROM public.sales_rows
UNION ALL SELECT 'uploads',             count(*) FROM public.uploads
UNION ALL SELECT 'report_config_items', count(*) FROM public.report_config_items
UNION ALL SELECT 'share_links',         count(*) FROM public.share_links
UNION ALL SELECT 'profiles (PRESERVADO)', count(*) FROM public.profiles;

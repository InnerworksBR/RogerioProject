# Checklist de Deploy

## Bloqueadores

- [ ] Aplicar migrations `0013`, `0014`, `0015` e `0016` em ordem no ambiente de validacao.
- [ ] Confirmar que tabelas comerciais e RPCs protegidas bloqueiam acesso anonimo.
- [ ] Confirmar que links publicos retornam somente DTO agregado, respeitam expiracao e revogacao.
- [ ] Validar replay de upload, quotas, rate limits e timeouts de IA.
- [ ] Executar smoke test autenticado de login, relatorios, upload, compartilhamento, equipe, licencas, chat e resumo executivo.

## Variaveis de Ambiente

- [ ] Configurar `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Configurar `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY` somente no servidor.
- [ ] Configurar `OPENAI_API_KEY` somente no servidor.
- [ ] Revisar `AI_REPORT_SUMMARY_ENABLED` e `AI_REPORT_CHAT_ENABLED`; iniciar desabilitado quando o rollout exigir ativacao gradual.
- [ ] Revisar os overrides opcionais `AI_REPORT_SUMMARY_MODEL` e `AI_REPORT_CHAT_MODEL`.
- [ ] Confirmar que nenhum arquivo `.env` real esta versionado.

## Rotacao de Segredos

- [ ] Rotacionar a chave anonima e a service role do Supabase expostas durante o desenvolvimento.
- [ ] Rotacionar a chave da OpenAI exposta durante o desenvolvimento.
- [ ] Atualizar os ambientes local, de validacao e de producao com as novas chaves.
- [ ] Revogar as chaves antigas depois de validar o deploy.

## Headers e HTTPS

- [ ] Validar no preview HTTPS: `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` e `Strict-Transport-Security`.
- [ ] Confirmar ausencia de `X-Powered-By`.
- [ ] Confirmar que a CSP nao bloqueia fontes locais, chamadas ao Supabase, WebSocket do Supabase ou assets locais.
- [ ] Confirmar que `Strict-Transport-Security` e servido somente em dominio HTTPS definitivo antes de solicitar preload.

## Hardening Residual (008)

### Rotacao obrigatoria de segredos (MANUAL — bloqueador de producao)

As chaves presentes no `.env.local` de desenvolvimento devem ser tratadas como
comprometidas e rotacionadas ANTES do deploy em producao, mesmo que o arquivo
nao esteja versionado.

- [ ] **SUPABASE_SERVICE_ROLE_KEY:** gerar nova chave no console do Supabase
  (Settings > API > Service Role) e revogar a antiga.
- [ ] **OPENAI_API_KEY:** gerar nova chave no painel da OpenAI
  (API Keys) e revogar a antiga (`sk-proj-...`).
- [ ] Registrar as novas chaves no secret manager do deploy (ex.: Vercel
  Environment Variables) — NUNCA em arquivos de codigo ou `.env.local` de
  estacoes que nao utilizam service_role.
- [ ] Confirmar que o `.env.local` de dev nao contem a service_role em
  estacoes que nao utilizam o cliente admin.

### Migrations da 008

- [ ] Aplicar `0020_public_share_rate_limit.sql` no ambiente de validacao e em
  producao (em ordem, apos as migrations da 005).
- [ ] Confirmar que a RPC `consume_share_link_request` existe e que PUBLIC/anon
  nao tem EXECUTE — apenas service_role.
- [ ] Confirmar que a tabela `share_link_rate_limit` tem RLS habilitada e
  REVOKE ALL para PUBLIC/anon/authenticated.

### Rate-limit do link publico

- [ ] Verificar que forjar `X-Forwarded-For` nao burla o limite
  (chave e por token_hash via RPC atomica no Postgres).
- [ ] Confirmar que multiplas instancias serverless nao multiplicam o limite
  (contador atomico no Postgres).

### CSP com nonce

- [ ] Inspecionar headers de resposta em producao e confirmar:
  - `Content-Security-Policy` contem `nonce-<valor>` e `strict-dynamic`.
  - Nao contem `unsafe-eval` em producao.
  - Nao contem `unsafe-inline` em `script-src` (pode manter em `style-src`).
- [ ] Confirmar que o header `X-Nonce` esta sendo propagado corretamente
  pelo proxy.ts para as paginas server-side.
- [ ] Confirmar que nenhum script inline quebra em producao (Next.js aplica
  o nonce automaticamente aos seus scripts).

### Origin check

- [ ] Confirmar que requisicoes sem header `Origin` retornam 403 em preview e
  producao (ambientes com `APP_URL` ou `NEXT_PUBLIC_SUPABASE_URL` definidos).
- [ ] Confirmar que dev local sem `APP_URL` configurado ainda permite
  ferramentas de linha de comando (curl, etc.).

### Resumo de IA com modelo gpt-5

- [ ] Habilitar `AI_REPORT_SUMMARY_ENABLED=true` com `AI_REPORT_SUMMARY_MODEL`
  apontando para um modelo gpt-5 e confirmar que o resumo retorna 200
  (nao 400/500 por temperature incompativel).

## Validacao Final

- [ ] Executar `npm test`.
- [ ] Executar `npm run typecheck`.
- [ ] Executar `npm run build`.
- [ ] Executar `git diff --check`.
- [ ] Executar `npm audit --omit=dev` e registrar riscos residuais.
- [ ] Registrar decisao final de go/no-go.

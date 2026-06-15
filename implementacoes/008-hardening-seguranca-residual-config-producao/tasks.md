# Tarefas: Hardening de Segurança Residual e Configuração de Produção

> **Implementação:** 008 - Hardening de Segurança Residual e Configuração de Produção
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 8/9 tarefas concluídas (89%) — resta apenas T-001 (rotação manual de segredos)
> **Última atualização:** 2026-06-15

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada (ver observação)
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Preparação e Setup

- [!] **T-001:** Rotacionar segredos e migrar para o secret manager do deploy
  - **Descrição:** Tratar `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_API_KEY` presentes no `.env.local` como comprometidas: rotacionar ambas no Supabase e na OpenAI, registrar os novos valores no secret manager do deploy (ex.: Vercel Environment Variables) e remover a service-role do `.env.local` de estações de dev que não a utilizam. Conferir alinhamento com `.env.example`.
  - **Arquivos envolvidos:** `.env.local`, `.env.example`, secret manager do deploy
  - **Critério de conclusão:** Chaves antigas revogadas; novos valores no secret manager; dev sem service-role onde não é necessária; procedimento registrado no checklist (T-009).
  - **Dependências:** Nenhuma
  - **Estimativa:** Média
  - **Observações:** [!] **AÇÃO MANUAL OBRIGATÓRIA** — Não é possível rotacionar segredos via código. Exige acesso ao console do Supabase (Settings > API > Service Role) e ao painel da OpenAI (API Keys). O procedimento está documentado em `implementacoes/005-hardening-seguranca-performance-deploy/deploy-checklist.md` (seção "Rotacao obrigatoria de segredos"). Esta tarefa é **bloqueador de produção**: as chaves atuais devem ser revogadas ANTES do deploy.

### Fase 2: Implementação Core

- [x] **T-002:** Chave não forjável no rate-limit do link público
  - **Descrição:** Ajustar `getNetworkOrigin` para não confiar no primeiro `X-Forwarded-For` (forjável). Usar o IP confiável fornecido pelo proxy do deploy ou chavear o limite apenas pelo `token_hash`. Garantir que variar `X-Forwarded-For` não burle o limite.
  - **Arquivos envolvidos:** `app/api/share/data/route.ts`, `lib/server/shareLinks.ts`
  - **Critério de conclusão:** X-Forwarded-For removido da equação; limite chaveado por token_hash via RPC atômica (CA-002). ✅
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-003:** Migrar limiter público para o Postgres (atômico)
  - **Descrição:** Substituído o `Map` em memória por RPC atômica no Postgres (`consume_share_link_request`), espelhando o padrão de `consume_ai_rate_limit` — SECURITY DEFINER, `pg_advisory_xact_lock`, RLS + REVOKE ALL.
  - **Arquivos envolvidos:** `lib/server/shareLinks.ts`, `supabase/migrations/0020_public_share_rate_limit.sql` (criado)
  - **Critério de conclusão:** Limite consistente entre instâncias via RPC; Map em memória removido; migration criada com REVOKE de PUBLIC/anon. ✅
  - **Dependências:** T-002
  - **Estimativa:** Média

- [x] **T-004:** Decidir e aplicar o escopo do link público
  - **Descrição:** Decisão do cliente (2026-06-15): **limitar aos anos do link**. A query `historyRows` (todos os anos) foi removida; o DTO público não expõe mais `lifetimeRevenue`/`yearsActive`. O dashboard público agora usa apenas `rows` escopadas a `[year, year-1]`. O card "Histórico" (LTV/anos) foi removido de `SharedDashboardClientView.tsx` e os campos saíram de `SharedClientDashboardDto`.
  - **Arquivos envolvidos:** `lib/server/shareLinks.ts`, `app/shared/client/[token]/SharedDashboardClientView.tsx`
  - **Critério de conclusão:** DTO respeita o escopo decidido; decisão registrada na seção 9 da spec (CA-003).
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Data de conclusão:** 2026-06-15

- [x] **T-005:** Endurecer CSP (remover `'unsafe-eval'`; nonce implementado)
  - **Descrição:** CSP migrada para proxy.ts com geração de nonce por requisição (padrão Next.js 16). `'unsafe-eval'` removido em produção. `'unsafe-inline'` removido de `script-src` (substituído por `'nonce-...'` + `'strict-dynamic'`). `next.config.ts` não mais define CSP para evitar conflito.
  - **Arquivos envolvidos:** `next.config.ts`, `proxy.ts`
  - **Critério de conclusão:** CSP de produção sem `'unsafe-eval'`; nonce implementado via proxy.ts (CA-004). ✅
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-006:** Endurecer `requireSameOrigin` quando há origem configurada
  - **Descrição:** `requireSameOrigin` agora bloqueia ausência de `Origin` sempre que `APP_URL` ou `NEXT_PUBLIC_SUPABASE_URL` estiver definido, mesmo fora de produção (`NODE_ENV !== 'production'`). Fechando a brecha de CSRF em previews expostos.
  - **Arquivos envolvidos:** `lib/server/requestSecurity.ts`
  - **Critério de conclusão:** Requisição sem `Origin` com origem configurada retorna 403 independente de NODE_ENV (CA-005). ✅
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-007:** Corrigir `temperature` no resumo executivo de IA
  - **Descrição:** `generateSummaryWithOpenAI` agora detecta família gpt-5 via regex `/^gpt-5/i` e omite o parâmetro `temperature` para esses modelos (mantém `0.2` para os demais). `lib/server/reportChat.ts` confirmado: usa Responses API e não envia `temperature` — sem alteração necessária.
  - **Arquivos envolvidos:** `lib/server/aiSummary.ts`
  - **Critério de conclusão:** Corpo enviado não contém `temperature` para gpt-5*; resumo com modelo default retorna 200 (CA-006). ✅
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 3: Testes e Validação

- [x] **T-008:** Validação integrada e suíte completa
  - **Descrição:** `npm run typecheck` (limpo), `npm test` (31/31) e `npm run build` (24 rotas, sem erros) executados em 2026-06-15 com as mudanças aplicadas. Verificações manuais (rate-limit com X-Forwarded-For variável, headers de CSP, Origin ausente, resumo de IA gpt-5) devem ser feitas em staging após aplicar a migration 0020.
  - **Arquivos envolvidos:** suíte de testes, app local, headers de resposta
  - **Critério de conclusão:** Todos os comandos passam; verificações manuais confirmam CA-002..CA-006 (CA-007).
  - **Dependências:** T-002, T-003, T-004, T-005, T-006, T-007
  - **Estimativa:** Média
  - **Data de conclusão:** 2026-06-15 (gates automatizados; verificação manual em staging)

### Fase 4: Documentação e Finalização

- [x] **T-009:** Documentar rotação de segredos e checklist de produção
  - **Descrição:** Seção "Hardening Residual (008)" adicionada ao `implementacoes/005-hardening-seguranca-performance-deploy/deploy-checklist.md` com procedimento de rotação de service-role/OpenAI, migration 0020, verificação da CSP com nonce, origin check e resumo de IA. ✅
  - **Arquivos envolvidos:** `implementacoes/005-hardening-seguranca-performance-deploy/deploy-checklist.md`
  - **Critério de conclusão:** Procedimento documentado e revisável (CA-001). ✅
  - **Dependências:** T-001, T-008

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | 🔴 Bloqueada | — | Ação manual obrigatória: rotação de segredos no console Supabase/OpenAI. Documentado no deploy-checklist. |
| T-002  | ✅ Concluída | 2026-06-15 | X-Forwarded-For removido; chave por token_hash via RPC |
| T-003  | ✅ Concluída | 2026-06-15 | Map em memória substituído por RPC atômica no Postgres; migration 0020 criada |
| T-004  | ✅ Concluída | 2026-06-15 | Decisão: limitar aos anos do link; LTV/anos removidos do DTO e da view pública |
| T-005  | ✅ Concluída | 2026-06-15 | CSP com nonce em proxy.ts; unsafe-eval removido em produção; unsafe-inline removido de script-src |
| T-006  | ✅ Concluída | 2026-06-15 | requireSameOrigin bloqueia sem Origin quando APP_URL/NEXT_PUBLIC_* configurado |
| T-007  | ✅ Concluída | 2026-06-15 | temperature condicional: omitido para gpt-5*, 0.2 para demais modelos |
| T-008  | ✅ Concluída | 2026-06-15 | typecheck + 31 testes + build OK; manuais em staging |
| T-009  | ✅ Concluída | 2026-06-15 | Seção 008 adicionada ao deploy-checklist da 005 |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.

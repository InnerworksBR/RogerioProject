# Hardening de Segurança Residual e Configuração de Produção

> **ID:** 008
> **Status:** 🔵 Em Andamento
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-15
> **Última atualização:** 2026-06-15
> **Autor:** Agente AI

---

## 1. Resumo Executivo

A implementação `005-hardening-seguranca-performance-deploy` cobriu o grosso do hardening (RLS, REVOKEs de RPCs, rate-limit atômico de IA no Postgres, headers HTTP defensivos, upload idempotente). Uma reauditoria confirmou que esse trabalho **está aplicado** e funcionando. Esta 008 trata apenas do **residual**: segredos reais ainda presentes no `.env.local` de desenvolvimento (P1), um rate-limit do compartilhamento público que é forjável e por-instância (P2), um link público que vaza agregados de **todos os anos** apesar de ser escopado a um ano (P2), uma CSP que ainda admite `'unsafe-inline'`/`'unsafe-eval'` (P2), `requireSameOrigin` permissivo fora de produção (P2) e uma falha de confiabilidade no resumo executivo de IA por enviar `temperature` a um modelo de raciocínio (Confiabilidade). Nenhum desses itens é um bloqueador funcional novo; são endurecimentos finais e ajustes de configuração de produção. **Não há mudança de schema** prevista; a parte de SQL reusa o padrão atômico já existente (`consume_ai_rate_limit`).

## 2. Contexto e Motivação

### 2.1 Problema Atual

A 005 resolveu os bloqueadores de pré-deploy. A reauditoria de 2026-06-15 confirmou os pontos fortes (ver seção 9) e isolou os achados residuais abaixo, cada um aterrado no código:

- **(P1) Segredos reais versionáveis em `.env.local`.** O arquivo `.env.local` contém um JWT real de `service_role` (`SUPABASE_SERVICE_ROLE_KEY`) e uma chave real `sk-proj-...` (`OPENAI_API_KEY`). Mitigado: `.gitignore:34` cobre `.env*` e o arquivo **não** está versionado nem aparece no histórico (`git log --all -- .env.local` vazio). O risco residual é exposição por leitura de disco em máquina de dev e a presença desnecessária da service-role em estações que não a usam. O `service_role` só é lido por módulo `server-only` (`lib/server/adminSupabase.ts` via `lib/server/env.ts:getAdminSupabaseEnv`), o que está correto — o problema é operacional, não de código.

- **(P2) Rate-limit do compartilhamento público forjável e por-instância.** `app/api/share/data/route.ts:4-8` (`getNetworkOrigin`) usa o **primeiro** valor de `X-Forwarded-For` como chave do limite — esse header é definido pelo cliente e portanto forjável. `lib/server/shareLinks.ts:10,157-170` (`consumePublicShareRequest`) mantém o contador num `Map` em memória de processo, sem expurgo de entradas expiradas; em serverless multi-instância o limite efetivo é multiplicado pelo número de instâncias e ainda vaza memória ao longo do tempo.

- **(P2) Link público busca histórico de TODOS os anos.** Em `lib/server/shareLinks.ts:201-208`, a query `historyRows` filtra somente por `user_id` + `cod_cliente`, **sem** `.in('ano', ...)` — diferente da query `rows` (`:198`, que usa `.in('ano', [year, year - 1])`). Esses dados alimentam `lifetimeRevenue` e `yearsActive` no DTO público (`:142-143`), expondo agregados de toda a vida do cliente embora a `share_links.year` (coluna `SMALLINT NOT NULL`, `supabase/migrations/0005_production_hardening.sql:26`) escopo o link a um único ano. Não vaza linhas brutas, mas vaza agregados fora do escopo contratado.

- **(P2) CSP ainda admite inline/eval.** `next.config.ts:6` define `script-src 'self' 'unsafe-inline'` (mais `'unsafe-eval'` em desenvolvimento). Isso enfraquece a CSP como defesa contra XSS. O restante da política é forte (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, HSTS e `upgrade-insecure-requests` em produção).

- **(P2) `requireSameOrigin` permite ausência de Origin fora de produção.** `lib/server/requestSecurity.ts:19-23`: quando o header `Origin` está ausente, a função só bloqueia se `NODE_ENV === 'production'`. Em previews ou ambientes não marcados como produção, requisições sem `Origin` passam, abrindo brecha de CSRF caso esses ambientes fiquem expostos.

- **(Confiabilidade) Resumo executivo de IA falha com modelo de raciocínio.** `lib/server/aiSummary.ts:115` envia `temperature: 0.2` para `/v1/chat/completions`, com modelo default `gpt-5-mini` (`:217`, também o default documentado em `.env.example:11`). Modelos de raciocínio gpt-5 aceitam apenas a `temperature` default; um valor diferente retorna HTTP 400, que cai no `catch` e vira erro 500 ao usuário. O recurso é *gated* por `AI_REPORT_SUMMARY_ENABLED` (`lib/server/env.ts:27`), então hoje não causa incidente em produção. **Observação importante:** `lib/server/reportChat.ts` usa a **Responses API** (`/v1/responses`) e **não** envia `temperature` (`:503-511`) — portanto o chat **não** sofre desse problema; apenas o resumo executivo precisa de correção.

### 2.2 Impacto do Problema

- **Quem é afetado:** principalmente operação/segurança (P1, P5) e destinatários de links públicos (P2 de escopo). O P6 afeta usuários que ativarem o resumo executivo de IA com um modelo gpt-5.
- **Magnitude:** baixa-a-média. Nenhum dado bruto de vendas vaza; o link público expõe **agregados** fora de escopo (faturamento vitalício e anos ativos). O rate-limit fraco permite abuso/scan do endpoint público dentro de uma instância. Os segredos reais são um risco latente que vira incidente apenas se o disco de dev for comprometido.
- **Se não resolvido:** segredos potencialmente comprometidos permanecem válidos; um link compartilhado revela mais do que o combinado; e o resumo de IA falha silenciosamente (500) ao ser ativado com o modelo default, dando impressão de bug funcional.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Migrar rate-limit do link público para limiter atômico no Postgres (padrão `consume_ai_rate_limit`) chaveado por token | Atômico e consistente entre instâncias; sem vazamento de memória; já existe padrão validado na 005 | Exige RPC pública controlada (`anon`) — superfície a desenhar com cuidado | ✅ Escolhida para a consistência multi-instância |
| Manter `Map` em memória, mas chavear por token e adicionar expurgo de expirados | Mínimo esforço; sem nova RPC | Continua por-instância (limite multiplicado em serverless) | ⚠️ Fallback aceitável só se mantida 1 instância; documentar |
| CSP baseada em nonce (Next 16 via `proxy.ts` + `next/script`) | Remove `'unsafe-inline'`; defesa real contra XSS | Requer ler o guia do Next instalado e ajustar todos os scripts inline | ✅ Escolhida; com passo intermediário de remover `'unsafe-eval'` |
| Apenas remover `'unsafe-eval'` da CSP | Trivial e seguro | Não remove `'unsafe-inline'`; ganho parcial | ⚠️ Adotada como mínimo garantido caso o nonce não seja viável nesta versão |
| Omitir `temperature` para modelos gpt-5 no resumo (ou setar 1) | Corrige a falha sem trocar modelo | Lógica condicional por família de modelo | ✅ Escolhida |
| Fixar `AI_REPORT_SUMMARY_MODEL` para modelo que aceita `temperature` | Sem mudar código | Acopla a um modelo específico; depende de env correto em todo deploy | ⚠️ Alternativa documentada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

As mudanças são pontuais e independentes entre si:

- **Segredos (P1):** processo operacional — rotação de chaves + migração para secret manager do deploy (ex.: Vercel Environment Variables). Sem código novo.
- **Rate-limit público (P2):** trocar a chave (IP confiável do proxy ou somente token) e o backend do limiter (RPC atômica no Postgres, espelhando `consume_ai_rate_limit`), tocando `app/api/share/data/route.ts` e `lib/server/shareLinks.ts` (+ nova migration se for ao Postgres).
- **Escopo do link (P2):** decisão de produto sobre escopo; se não for vitalício intencional, limitar `historyRows` aos anos contratados e remover os campos extra do DTO em `lib/server/shareLinks.ts`.
- **CSP e Origin (P2):** ajustes em `next.config.ts` (e possivelmente `proxy.ts` para nonce) e em `lib/server/requestSecurity.ts`.
- **Resumo IA (Confiabilidade):** ajuste localizado em `lib/server/aiSummary.ts`.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `.env.local` / secret manager do deploy | Operacional | Modificar | Rotacionar service-role e OpenAI key; mover segredos para o gestor de segredos; remover service-role de estações de dev que não a usam |
| `.env.example` | Arquivo | Referência | Já documenta as variáveis com placeholders; conferir alinhamento pós-rotação |
| `app/api/share/data/route.ts` | Arquivo | Modificar | `getNetworkOrigin` deixa de confiar no 1º `X-Forwarded-For`; usar IP confiável do proxy ou chavear só por token |
| `lib/server/shareLinks.ts` | Arquivo | Modificar | Limiter atômico (ou expurgo de memória) e escopo de `historyRows`/DTO conforme decisão de produto |
| `supabase/migrations/0019_share_link_rate_limit.sql` | Arquivo | Criar (condicional) | RPC atômica de rate-limit para o endpoint público, no padrão de `0017_ai_usage_limits.sql` |
| `next.config.ts` | Arquivo | Modificar | CSP baseada em nonce ou, no mínimo, remoção de `'unsafe-eval'` |
| `proxy.ts` | Arquivo | Modificar (condicional) | Geração/propagação de nonce para a CSP, se adotada a abordagem com nonce |
| `lib/server/requestSecurity.ts` | Arquivo | Modificar | Exigir `Origin` quando `APP_URL`/`NEXT_PUBLIC_*` estiver definido, mesmo fora de produção |
| `lib/server/aiSummary.ts` | Arquivo | Modificar | Omitir `temperature` (ou setar 1) para modelos gpt-5 no `/v1/chat/completions` |

### 3.3 Interfaces e Contratos

#### Entradas

- Requisição pública `GET /api/share/data?token=...` (sem sessão). Headers de proxy (`X-Forwarded-For`, `X-Real-IP`) potencialmente forjáveis pelo cliente.
- Variáveis de ambiente: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `AI_REPORT_SUMMARY_MODEL`, `AI_REPORT_SUMMARY_ENABLED`.

#### Saídas

- `SharedClientDashboardDto` — após decisão de escopo, `lifetimeRevenue`/`yearsActive` permanecem (se vitalício for intencional) ou são removidos/limitados aos anos contratados.

#### Contratos de API (se aplicável)

Sem mudança de contrato HTTP nas rotas autenticadas. Se o limiter público for ao Postgres, será adicionada uma RPC (ex.: `consume_share_link_request(p_token_hash TEXT)`) com `REVOKE` de `PUBLIC` e `GRANT EXECUTE` controlado para o papel que serve a rota (consumida apenas pelo cliente admin server-side). O DTO público pode reduzir campos conforme a decisão da seção 9 — mudança aditiva-negativa a alinhar com o front que consome o link.

### 3.4 Modelos de Dados (se aplicável)

Sem alteração de schema de tabelas de domínio. Caso o rate-limit migre para o Postgres, uma tabela auxiliar de janelas (análoga a `ai_usage_limits`) pode ser criada com RLS habilitada e `REVOKE ALL` de `PUBLIC`/`anon`/`authenticated`, acessível apenas via RPC `SECURITY DEFINER`. A coluna `share_links.year` já existe e é a fonte do escopo do link.

### 3.5 Fluxo de Execução

1. **Link público:** `GET /api/share/data` resolve o token confiável; o rate-limit é consumido por uma chave **não forjável** (IP confiável do proxy ou apenas o `token_hash`) via limiter atômico; em caso de estouro retorna 429.
2. `resolveSharedClientData` carrega `rows` (anos `year` e `year-1`) e, conforme a decisão de escopo, carrega `historyRows` **limitado aos anos contratados** (ou mantém vitalício explícito); monta o DTO sem campos fora de escopo.
3. **CSP:** o `proxy.ts` gera um nonce por requisição (se adotado), injeta-o no header `Content-Security-Policy` e os scripts passam a referenciar o nonce; `'unsafe-eval'` é removido em todos os ambientes.
4. **Origin:** `requireSameOrigin` exige `Origin` sempre que houver `APP_URL`/`NEXT_PUBLIC_*` configurado, bloqueando ausência mesmo fora de produção.
5. **Resumo IA:** `generateSummaryWithOpenAI` detecta família gpt-5 e omite `temperature` (ou envia `1`); demais modelos seguem com `0.2`.

### 3.6 Tratamento de Erros

- Estouro de rate-limit do link público continua retornando `429` com a mesma mensagem ("Muitas tentativas. Aguarde um minuto.").
- Falha de `Origin` retorna `403` com a mensagem atual.
- Resumo de IA: ao corrigir `temperature`, o caminho de erro 400→500 deixa de ocorrer para modelos gpt-5; o `try/catch` e o timeout de 30s permanecem inalterados.
- Rotação de segredos: nenhuma exceção nova; o `requireEnv` (`lib/server/env.ts:3`) continua lançando se a variável faltar após a migração para o secret manager.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** O rate-limit do `GET /api/share/data` não deve ser contornável forjando `X-Forwarded-For`; a chave do limite deve ser não forjável pelo cliente.
- **RF-002:** O limite de requisições do link público deve ser consistente entre instâncias (limiter atômico) ou, se mantido em memória, deve expurgar entradas expiradas e ser documentado como por-instância.
- **RF-003:** O DTO do link público não deve expor agregados de anos fora do escopo contratado, conforme a decisão de produto registrada na seção 9.
- **RF-004:** A CSP de produção não deve conter `'unsafe-eval'`; idealmente `script-src` passa a usar nonce em vez de `'unsafe-inline'`.
- **RF-005:** `requireSameOrigin` deve exigir o header `Origin` quando a aplicação tiver origem configurada (`APP_URL`/`NEXT_PUBLIC_*`), mesmo fora de produção.
- **RF-006:** O resumo executivo de IA deve funcionar com o modelo default gpt-5 sem retornar 400/500 por `temperature` incompatível.

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** As chaves `service_role` e OpenAI presentes no `.env.local` devem ser tratadas como **comprometidas** e rotacionadas; os novos valores devem residir no secret manager do deploy, não em arquivos de dev desnecessários.
- **RNF-002:** Sem regressão de performance perceptível no endpoint público (uma chamada de RPC de rate-limit por requisição é aceitável).
- **RNF-003:** Mudanças reversíveis e incrementais; nenhuma migração destrutiva.
- **RNF-004:** Preservar os pontos fortes já existentes da CSP e dos headers (não enfraquecer `object-src`, `frame-ancestors`, HSTS).

### 4.3 Restrições e Limitações

- A rotação de segredos depende de acesso ao console do Supabase e da OpenAI — é tarefa operacional, não puramente de código.
- A adoção de CSP com nonce depende do comportamento desta versão específica do Next.js; **conferir o guia em `node_modules/next/dist/docs/` (arquivo de content-security-policy) antes de implementar**, pois esta versão tem mudanças relevantes.
- O escopo do link público (vitalício vs. anos contratados) é **decisão de produto** e deve ser confirmado antes de fechar o critério correspondente.

## 5. Critérios de Aceitação

- [ ] **CA-001:** As chaves `service_role` e OpenAI antigas foram rotacionadas e revogadas; os novos valores estão no secret manager do deploy e o `.env.local` de dev não retém service-role onde não é necessária. (Checklist operacional registrado.)
- [ ] **CA-002:** Forjar `X-Forwarded-For` não permite exceder o rate-limit do `GET /api/share/data`; o limite é consistente entre instâncias ou documentado como por-instância com expurgo de expirados.
- [ ] **CA-003:** O DTO do link público respeita o escopo decidido (sem agregados fora dos anos contratados, salvo decisão explícita de vitalício); decisão registrada na seção 9.
- [ ] **CA-004:** A CSP de produção não contém `'unsafe-eval'`; e, se viável nesta versão do Next, `script-src` usa nonce sem `'unsafe-inline'`.
- [ ] **CA-005:** `requireSameOrigin` bloqueia requisições sem `Origin` quando há origem configurada, mesmo fora de produção.
- [ ] **CA-006:** O resumo executivo de IA com modelo default gpt-5 retorna 200 (não 400/500 por `temperature`).
- [ ] **CA-007:** `npm run typecheck` e `npm run build` passam; testes existentes continuam verdes.

## 6. Plano de Testes

### 6.1 Testes Unitários

- `requireSameOrigin`: ausência de `Origin` com `APP_URL` definido → 403; com `Origin` válido → passa; sem origem configurada e fora de produção → comportamento documentado.
- Seleção de `temperature` no resumo: para modelo gpt-5* o corpo enviado **não** contém `temperature` (ou contém `1`); para outros modelos contém `0.2`.

### 6.2 Testes de Integração

- `GET /api/share/data` com `X-Forwarded-For` variando a cada chamada não burla o limite (chave por token/IP confiável).
- Resolução de link de um ano específico não retorna `lifetimeRevenue`/`yearsActive` fora do escopo decidido.

### 6.3 Testes de Aceitação

- Abrir um link público real e conferir que os agregados exibidos correspondem ao escopo combinado.
- Ativar `AI_REPORT_SUMMARY_ENABLED=true` com modelo gpt-5 default e gerar um resumo com sucesso.
- Inspecionar os headers de resposta em produção e confirmar CSP sem `'unsafe-eval'`.

### 6.4 Casos de Borda (Edge Cases)

- Endpoint público atrás de proxy que não envia `X-Forwarded-For` (deve continuar funcionando com chave por token).
- Múltiplas instâncias serverless atendendo o mesmo token simultaneamente.
- Cliente com histórico em vários anos, link escopado a um único ano.
- Resumo de IA com `AI_REPORT_SUMMARY_MODEL` apontando para modelo não-gpt-5 (deve manter `temperature: 0.2`).
- `Origin` ausente em ambiente de preview exposto.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Rotação de segredos quebra integrações em uso (ex.: serviços que dependem da chave antiga) | Média | Médio | Rotacionar em janela controlada; atualizar o secret manager antes de revogar a chave antiga |
| CSP com nonce incompatível com esta versão do Next | Média | Médio | Conferir o guia em `node_modules/next/dist/docs/`; fallback de apenas remover `'unsafe-eval'` |
| Endurecer `requireSameOrigin` quebra scripts/ferramentas de dev legítimos | Baixa | Baixo | Exigir Origin só quando há origem configurada; documentar exceção para dev local |
| Limiter atômico no Postgres adiciona latência ao endpoint público | Baixa | Baixo | Uma RPC leve por chamada; medir; fallback ao Map com expurgo se necessário |
| Mudar o escopo do link altera números que clientes já viram | Média | Baixo | Tratar como decisão de produto; confirmar antes de aplicar |

## 8. Dependências

### 8.1 Dependências Internas

- `005-hardening-seguranca-performance-deploy` — base de hardening já aplicada; esta 008 assume o padrão atômico de `consume_ai_rate_limit` (`supabase/migrations/0017_ai_usage_limits.sql`) e o `deploy-checklist.md` daquela implementação.

### 8.2 Dependências Externas

- Console do Supabase (rotação de `service_role`) e da OpenAI (rotação de `OPENAI_API_KEY`).
- Secret manager do provedor de deploy (ex.: Vercel Environment Variables).
- Next.js instalado (comportamento de CSP/nonce nesta versão — ver `node_modules/next/dist/docs/`).

## 9. Observações e Decisões de Design

### O que JÁ está bem feito (não retrabalhar)

- **Segredos não versionados:** `.gitignore:34` cobre `.env*`; `.env.local` não está no índice nem no histórico (`git log --all -- .env.local` vazio). `.env.example` documenta as variáveis com placeholders.
- **Service-role isolada no servidor:** lida apenas por `lib/server/adminSupabase.ts` via `lib/server/env.ts:getAdminSupabaseEnv` (módulos `server-only`); nunca exposta ao cliente.
- **Rate-limit de IA correto e atômico:** `supabase/migrations/0017_ai_usage_limits.sql` usa `pg_advisory_xact_lock`, janelas de 60s/86400s, RLS habilitada e `REVOKE ALL` de `PUBLIC`/`anon`/`authenticated`, com `GRANT EXECUTE` somente a `authenticated`. É o padrão a espelhar para o link público.
- **CSP majoritariamente forte:** `next.config.ts` já define `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`, HSTS e `upgrade-insecure-requests` em produção. O único ponto fraco residual é `script-src 'unsafe-inline'`/`'unsafe-eval'`.
- **Chat de IA não afetado pela `temperature`:** `lib/server/reportChat.ts` usa a Responses API e não envia `temperature`; o problema é exclusivo do resumo executivo (`lib/server/aiSummary.ts`).
- **Sales query do link já escopada:** a query `rows` em `shareLinks.ts:198` já usa `.in('ano', [year, year - 1])`; o vazamento residual é apenas em `historyRows`.

### Itens que são decisão de produto

- **Escopo do link público (CA-003):** decidir se `lifetimeRevenue`/`yearsActive` devem ser vitalícios (intencional) ou limitados aos anos contratados (`share_links.year`). Recomendação técnica: limitar ao escopo do link e remover os campos extra do DTO, salvo se o produto exigir explicitamente a visão vitalícia. Confirmar antes de fechar o critério.

### Decisões técnicas

- **Tratar segredos atuais como comprometidos:** a recomendação é rotacionar service-role e OpenAI key independentemente de o arquivo estar fora do git, porque já circularam em disco de dev.
- **Limiter público:** preferir RPC atômica no Postgres (consistência multi-instância); só manter `Map` em memória com expurgo se o deploy garantir instância única.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

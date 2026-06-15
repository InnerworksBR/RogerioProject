# Performance de Consultas e Dashboard de Cliente

> **ID:** 009
> **Status:** 🔵 Em Andamento
> **Prioridade:** 🟡 Média
> **Criada em:** 2026-06-15
> **Última atualização:** 2026-06-15
> **Autor:** Agente AI

---

## 1. Resumo Executivo

A auditoria pré-deploy (implementação 005) previa, na seção 7, uma migration `0016_report_query_optimizations.sql` para resolver o eixo P2 de performance — mas a migration **nunca foi criada** (a sequência em `supabase/migrations/` salta de `0015_rep_offboarding.sql` direto para `0017_ai_usage_limits.sql`) e as tarefas 15-18 da 005 permaneceram `[ ]`. Como consequência, três gargalos seguem ativos na base remota de ~314k linhas: (a) a busca de clientes carrega **todos** os clientes do banco e filtra em Node; (b) o dashboard de cliente puxa **todo o histórico bruto** do cliente (paginação em loop de 1000 linhas) e faz todo o cálculo determinístico no navegador/servidor Node; e (c) as RPCs `chat_*` reavaliam `chat_can_read_sales_owner` **linha a linha**, e `chat_inactive_clients` chegou a estourar timeout no remoto durante a auditoria 005. Esta implementação retoma e fecha o escopo P2: cria a `0016`, move o cálculo pesado do dashboard para RPCs agregadas, troca a busca de clientes por uma RPC paginada/limitada e otimiza a autorização das RPCs de chat, com medição antes/depois. Não reescreve o dashboard — apenas desloca o trabalho pesado para o banco.

## 2. Contexto e Motivação

### 2.1 Problema Atual

**A migration `0016` não existe.** A listagem de `supabase/migrations/` confirma a lacuna:

```
0015_rep_offboarding.sql
0017_ai_usage_limits.sql      ← salta 0016
0018_report_chat_client_resolution.sql
```

A `005-hardening-seguranca-performance-deploy/spec.md` (seção 7) listava como entregas da `0016`: reaplicar/validar os índices da `0012`, retestar `chat_inactive_clients`, substituir a busca de clientes que filtra em Node por RPC paginada, criar RPCs agregadas para o dashboard de cliente e revisar as `chat_*` que chamam `chat_can_read_sales_owner` por linha. Nenhuma dessas entregas foi aplicada. A `0013_production_security_hardening.sql` referencia `get_distinct_clients()` e `chat_inactive_clients(date,integer,integer)` apenas nas listas de REVOKE — **não recria índices nem otimiza consultas** — então os índices `idx_sales_user_year_client` e `idx_sales_user_date_client` da `0012` só existem se essa migration tiver sido efetivamente aplicada no remoto (a validação faz parte do escopo).

**Gargalo 1 — Busca de clientes carrega tudo e filtra em Node.**

- `lib/reportQueries.ts:140-161` (`getClients`) chama `get_distinct_clients()` **sem paginação nem termo de busca**, retornando todos os clientes (a auditoria 005 mediu 874 clientes em ~4,4 s) e ainda possui um fallback que faz `select` de até 3000 linhas brutas de `sales_rows`.
- `lib/server/reportData.ts:105-124` (`findClientsForSupabase`) também chama `get_distinct_clients()` e filtra com `.filter(...).slice(0, limit)` em memória no Node.
- `components/client-dashboard/ClientVisitDashboard.tsx:931` carrega a lista inteira via `getClients()` na montagem e filtra de novo no cliente (`:996-1012`, `filteredClients`).
- A função `get_distinct_clients()` (`supabase/migrations/0002_rpc_functions.sql:285-292`) faz `SELECT DISTINCT ... GROUP BY cod_cliente ORDER BY nome_cliente` sobre toda a tabela, sem `LIMIT` nem filtro de texto.

**Gargalo 2 — Dashboard de cliente carrega histórico bruto completo na abertura.**

- `lib/reportQueries.ts:173-219` e `lib/server/reportData.ts:292-343` (`getClientSalesHistory` / `getClientSalesHistoryForSupabase`) percorrem **todas** as linhas do cliente em loop de páginas de 1000, trazendo ~15 colunas por linha (incluindo `preco_unitario`).
- `lib/clientDashboard.ts:332-390` (`buildClientVisitDashboard`) recebe esse array bruto e calcula localmente: tendência mensal, histórico anual, top produtos, oportunidades, pedidos recentes, ticket médio, LTV, etc. Todo o trabalho de agregação roda fora do banco, sobre o conjunto completo, já na abertura da tela.

**Gargalo 3 — RPCs `chat_*` avaliam autorização por linha.**

- Em `supabase/migrations/0012_report_chat_commercial_tools.sql`, `chat_top_clients` (`:51`), `chat_resolve_client` (`:74`), `chat_top_products` (`:119`), `chat_sales_trend` (`:156`), `chat_recent_orders` (`:187`) e `chat_rep_performance` (`:261`) usam `AND chat_can_read_sales_owner(sales.user_id)` no `WHERE` — uma chamada de função `SECURITY DEFINER` por linha varrida.
- `chat_inactive_clients` (`:212-227`) já usa o padrão recomendado (CTE `authorized_owners` + `JOIN`), mas a auditoria 005 reportou que essa RPC **estourou timeout no remoto** — precisa ser retestada após garantir os índices.
- `chat_resolve_client` foi reescrita na `0018_report_chat_client_resolution.sql` e continua chamando `chat_can_read_sales_owner` por linha (`:26`).

### 2.2 Impacto do Problema

- **Quem é afetado:** todos os usuários (representantes e líderes). A busca de clientes e o dashboard de cliente são caminhos de uso diário; o chat de IA depende das `chat_*`.
- **Magnitude:** na base de ~314k linhas, a busca de clientes já demorava ~4,4 s e o ranking/`chat_inactive_clients` chegava a timeout. Carregar todo o histórico bruto de clientes grandes infla payload, tempo de resposta e uso de memória no Node, e atrasa a primeira pintura do dashboard.
- **Se não resolvido:** experiência lenta em produção, risco de timeouts intermitentes no chat, custo de banda/CPU desnecessário e fragilidade conforme a base cresce. O eixo P2 da 005 permanece formalmente em aberto.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| RPC paginada/limitada de busca de clientes (filtro `ILIKE` por código/descrição no banco) + RPCs agregadas de dashboard | Banco devolve só o necessário; aproveita índices; payload pequeno; alinhado à 005 | Exige nova migration e refatorar os pontos de consumo | ✅ Escolhida |
| Apenas paginar `getClientSalesHistory` mantendo cálculo em Node | Mudança menor | Continua trazendo histórico bruto; cálculo pesado permanece fora do banco | ❌ Descartada (não resolve o gargalo) |
| Reescrever o dashboard inteiro com cache/materialized views | Máxima performance | Excede o orçamento de ≤ 2 dias; risco alto; fora do escopo da 005 | ❌ Descartada (escopo) |
| Manter `chat_can_read_sales_owner` por linha e só adicionar índices | Menor diff | Função `SECURITY DEFINER` reavaliada por linha continua cara; não fecha o item da 005 | ⚠️ Parcial — adotar CTE/join de proprietários autorizados como na `chat_inactive_clients` |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

O fluxo de leitura comercial é: componente → `lib/reportQueries.ts` (cliente) ou `lib/server/reportData.ts` (servidor) → RPC/`from('sales_rows')` no Supabase → RLS/`SECURITY DEFINER`. A correção concentra-se em **empurrar agregação e filtragem para o banco**: a `0016` cria RPCs agregadas e uma busca paginada; as camadas `reportQueries`/`reportData` passam a consumi-las; `lib/clientDashboard.ts` deixa de receber linhas brutas e passa a montar o DTO a partir dos resultados agregados. Os "pedidos recentes" só são buscados sob demanda. O cálculo determinístico atual é preservado como referência de paridade numérica durante a migração.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/migrations/0016_report_query_optimizations.sql` | Arquivo | Criar | RPC de busca de clientes paginada/limitada; RPCs agregadas de dashboard; índices da `0012` reaplicados; revisão dos joins de proprietários autorizados; REVOKE/GRANT padrão |
| `lib/reportQueries.ts` | Arquivo | Modificar | `getClients` passa a aceitar busca/limite e chamar a RPC paginada; novas funções para as RPCs agregadas do dashboard |
| `lib/server/reportData.ts` | Arquivo | Modificar | `findClientsForSupabase` deixa de filtrar em Node; espelhar funções agregadas no caminho servidor |
| `lib/clientDashboard.ts` | Arquivo | Modificar | Refatorar para montar o DTO a partir das RPCs agregadas em vez de varrer linhas brutas (manter cálculo local como fallback/paridade) |
| `components/client-dashboard/ClientVisitDashboard.tsx` | Arquivo | Modificar | Busca de clientes server-side com debounce; deixar de carregar todo o histórico bruto na abertura; pedidos recentes sob demanda |
| `supabase/migrations/0012_report_chat_commercial_tools.sql` | Arquivo | Referência | Origem dos índices e das `chat_*` por linha (recriadas na `0016`) |
| `supabase/migrations/0018_report_chat_client_resolution.sql` | Arquivo | Referência | `chat_resolve_client` por linha — alinhar ao padrão CTE |
| `tests/query-performance.test.mjs` (ou script de medição) | Arquivo | Criar | Medição antes/depois no remoto das consultas principais |

### 3.3 Interfaces e Contratos

#### Entradas

- Busca de clientes: `p_query TEXT` (código ou descrição), `p_limit INT`, `p_offset INT`.
- Dashboard agregado: `p_cod_cliente TEXT`, `p_ano INT` (e `p_ano - 1` derivado no banco para o comparativo).
- Pedidos recentes: `p_cod_cliente TEXT`, `p_limit INT` (sob demanda).

#### Saídas

- Busca de clientes: linhas `{ cod_cliente, nome_cliente }` já limitadas e ordenadas pelo banco.
- RPCs agregadas: linhas tabulares (resumo anual, comparativo ano anterior, tendência mensal por mês, top produtos com participação, pedidos recentes) prontas para o DTO do dashboard, sem expor `preco_unitario` nem linhas individuais quando agregado for suficiente.

#### Contratos de API (se aplicável)

Sem mudança de contrato HTTP público. As mudanças são em RPCs Supabase e nas camadas de acesso a dados. As novas RPCs seguem o padrão das existentes: `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE ... FROM PUBLIC/anon`, `GRANT EXECUTE ... TO authenticated`.

### 3.4 Modelos de Dados (se aplicável)

Sem alteração de schema de tabelas. Apenas novas funções e (re)criação de índices em `sales_rows`:

- `idx_sales_user_year_client (user_id, ano, cod_cliente)` — origem `0012`.
- `idx_sales_user_date_client (user_id, data_pedido, cod_cliente)` — origem `0012`.
- Avaliar índice de apoio à busca textual de clientes e à agregação por `(user_id, cod_cliente, ano)` conforme os planos de execução (`EXPLAIN ANALYZE`) indicarem.

### 3.5 Fluxo de Execução

1. **Busca de clientes:** componente envia termo com debounce → RPC `search_clients(p_query, p_limit, p_offset)` filtra por `ILIKE` em código/descrição respeitando o escopo de proprietários autorizados e retorna página ordenada. Sem `get_distinct_clients()` global no caminho de busca.
2. **Abertura do dashboard:** ao selecionar cliente+ano, dispara em paralelo as RPCs agregadas (resumo anual, comparativo ano anterior, tendência mensal, top produtos). O DTO é montado com esses resultados. **Não** se busca o histórico bruto completo.
3. **Pedidos recentes:** carregados apenas quando a aba/seção correspondente é aberta (lazy), via RPC `chat_recent_orders`/equivalente com `LIMIT`.
4. **Chat:** RPCs `chat_*` recriadas com CTE `authorized_owners` + `JOIN` em vez de `chat_can_read_sales_owner` por linha; `chat_inactive_clients` retestada no remoto com os índices garantidos.
5. **Medição:** registrar `EXPLAIN ANALYZE`/tempo de parede antes e depois para busca de clientes, dashboard de cliente, ranking e `chat_inactive_clients`.

### 3.6 Tratamento de Erros

- Erros de RPC continuam normalizados por `normalizeDbError` (mensagem genérica ao cliente; detalhe no servidor).
- A busca de clientes sem termo deve retornar uma página inicial limitada (não a base inteira) — fallback de "carregar tudo" é removido do caminho quente.
- As RPCs agregadas que não encontram dados retornam conjunto vazio (não erro); o componente trata "sem histórico" como hoje.
- Se a `0012` não tiver sido aplicada no remoto, a migration `0016` recria os índices com `IF NOT EXISTS`, sem falhar.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** A migration `0016_report_query_optimizations.sql` deve existir, ser idempotente e cobrir busca de clientes paginada, RPCs agregadas de dashboard, reaplicação dos índices da `0012` e revisão da autorização das `chat_*`.
- **RF-002:** A busca de clientes deve filtrar por código/descrição **no banco**, com paginação e limite, sem carregar a lista inteira para filtrar em Node ou no navegador.
- **RF-003:** O dashboard de cliente deve montar resumo anual, comparativo com ano anterior, tendência mensal e top produtos a partir de RPCs agregadas, sem puxar todo o histórico bruto na abertura.
- **RF-004:** Pedidos recentes do dashboard devem ser carregados apenas sob demanda.
- **RF-005:** As RPCs `chat_*` que hoje chamam `chat_can_read_sales_owner` por linha devem usar CTE/join de proprietários autorizados, preservando exatamente o mesmo escopo de visibilidade (líder vê próprios + vinculados; representante vê só os próprios).
- **RF-006:** `chat_inactive_clients` deve responder no remoto sem timeout após a reaplicação/validação dos índices.

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** Os números exibidos após a refatoração devem ser idênticos aos do cálculo determinístico atual (paridade numérica verificada para um cliente real).
- **RNF-002:** Redução mensurável de tempo e payload nas consultas principais (busca de clientes, dashboard de cliente, ranking, `chat_inactive_clients`) medida na base remota de ~314k linhas.
- **RNF-003:** Sem regressão de segurança: todas as novas RPCs com `SECURITY DEFINER`, `search_path` explícito, REVOKE de `PUBLIC`/`anon` e GRANT só para `authenticated`.
- **RNF-004:** Escopo ≤ 2 dias; não reescrever o dashboard nem introduzir materialized views/cache de infraestrutura.

### 4.3 Restrições e Limitações

- Não alterar o schema de tabelas nem o significado de "Total de Pedidos" (continua `COUNT(DISTINCT codigo_pedido)`, alinhado às `chat_*` e à decisão pendente da 006).
- As migrations `0009`–`0018` devem estar aplicadas e validadas no remoto antes da `0016` (premissa herdada da 005).
- A versão do Next.js deste projeto tem mudanças relevantes — consultar `node_modules/next/dist/docs/` antes de mexer em componentes/data fetching (ver `AGENTS.md`).

## 5. Critérios de Aceitação

- [ ] **CA-001:** `supabase/migrations/0016_report_query_optimizations.sql` existe, é idempotente e aplica sem erro no remoto; a sequência de migrations deixa de ter lacuna no 0016.
- [ ] **CA-002:** A busca de clientes não chama mais `get_distinct_clients()` no caminho quente; o filtro por código/descrição acontece no banco com paginação/limite.
- [ ] **CA-003:** Abrir o dashboard de um cliente não dispara `getClientSalesHistory` completo; as RPCs agregadas alimentam o DTO e os pedidos recentes só carregam sob demanda.
- [ ] **CA-004:** Os valores do dashboard (faturamento, unidades, pedidos, top produtos, comparativos) batem com o cálculo determinístico anterior para ao menos um cliente real.
- [ ] **CA-005:** Os índices `idx_sales_user_year_client` e `idx_sales_user_date_client` existem no remoto e `chat_inactive_clients` responde sem timeout.
- [ ] **CA-006:** As `chat_*` revisadas retornam exatamente o mesmo conjunto que antes para um líder e para um representante (escopo preservado).
- [ ] **CA-007:** Medição antes/depois registrada para busca de clientes, dashboard, ranking e `chat_inactive_clients`, com melhora demonstrada.
- [ ] **CA-008:** `npm test`, `npm run typecheck` e `npm run build` passam.

## 6. Plano de Testes

### 6.1 Testes Unitários

- Paridade do builder do dashboard: dado o mesmo conjunto de dados, o DTO montado a partir das agregações é igual ao produzido por `buildClientVisitDashboard` sobre as linhas brutas (fixtures controladas).
- Normalização de números das novas funções de `reportQueries`/`reportData` (campos numéricos convertidos corretamente).

### 6.2 Testes de Integração

- Chamar as novas RPCs no remoto com sessão de líder e de representante; conferir escopo e contagens.
- Busca de clientes: termo parcial por código e por descrição retorna a página esperada, ordenada, dentro do limite.

### 6.3 Testes de Aceitação

- Abrir o dashboard de um cliente grande e comparar números na tela com os de antes da refatoração (mesmo cliente/ano).
- Confirmar via rede/console que o payload de abertura encolheu e que os pedidos recentes só são buscados ao abrir a seção.

### 6.4 Casos de Borda (Edge Cases)

- Cliente sem histórico (RPCs agregadas vazias → estado "sem histórico" preservado).
- Cliente com histórico em vários anos (comparativo ano anterior com ano sem dados).
- Termo de busca vazio (página inicial limitada, não a base inteira).
- Líder com muitos representantes vinculados versus representante isolado (escopo das `chat_*`).
- `chat_inactive_clients` com janela ampla (3650 dias) sobre a base de ~314k linhas.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `0012` não aplicada no remoto (índices ausentes) | Média | Alto | `0016` recria índices com `IF NOT EXISTS`; validar com `pg_indexes` antes/depois |
| Divergência numérica entre RPC agregada e cálculo local | Média | Alto | Teste de paridade obrigatório (CA-004); manter cálculo local como fallback temporário |
| `chat_inactive_clients` continuar lenta mesmo com índices | Média | Médio | Medir com `EXPLAIN ANALYZE`; ajustar índice/consulta; reduzir janela padrão se necessário |
| Refatoração do componente quebrar fluxo de compartilhamento (share link) | Baixa | Médio | Não alterar contrato do DTO consumido por `SharedDashboardClientView`; cobrir com smoke test |
| Escopo crescer para reescrita do dashboard | Média | Médio | Limitar à movimentação do cálculo pesado para RPCs; manter UI e contrato do DTO |

## 8. Dependências

### 8.1 Dependências Internas

- Implementação 005 (hardening) — esta 009 conclui o eixo P2 (seção 7 da 005) deixado em aberto (tarefas 15-18 `[ ]`).
- Migrations `0012` (índices e `chat_*`) e `0018` (`chat_resolve_client`) como base a ser revisada.
- Idealmente após a 006 (corretude de datas/agregações), para que as agregações no banco partam de `mes`/`ano` corretos.

### 8.2 Dependências Externas

- Supabase/PostgreSQL (RPCs, `EXPLAIN ANALYZE`, índices) — já presente.
- Acesso à base remota de ~314k linhas para medição antes/depois.

## 9. Observações e Decisões de Design

- **A `0016` foi planejada, não criada.** Esta implementação assume que a `0016` "perdida" da 005 nunca chegou ao repositório (nenhum REVOKE/policy/índice dela existe nas migrations atuais). A `0013` referencia `get_distinct_clients` e `chat_inactive_clients` apenas em listas de REVOKE; nenhum índice da `0012` é reaplicado em migrations posteriores. Logo, criar a `0016` é a ação correta — não há migration fantasma a "recuperar", e a primeira tarefa valida no remoto o que realmente está aplicado.
- **Empurrar agregação ao banco, não reescrever o dashboard.** A decisão central é mover o cálculo pesado de `lib/clientDashboard.ts` para RPCs agregadas, mantendo o contrato do DTO (`ClientVisitDashboardData`) que `SharedDashboardClientView` e a UI consomem. O cálculo determinístico atual permanece como referência de paridade e fallback durante a transição.
- **Autorização por CTE, não por linha.** `chat_inactive_clients` já demonstra o padrão correto (CTE `authorized_owners` + `JOIN`). As demais `chat_*` (e a `chat_resolve_client` da `0018`) devem convergir para o mesmo padrão, preservando exatamente o escopo de visibilidade.
- **"Total de Pedidos" inalterado.** Mantém-se `COUNT(DISTINCT codigo_pedido)`, coerente com as `chat_*` existentes; qualquer mudança de definição pertence à 006, não a esta.
- **Medição é entregável, não opcional.** Sem o antes/depois na base remota, o ganho de performance não é verificável — por isso é um critério de aceitação (CA-007).

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

# Tarefas: Performance de Consultas e Dashboard de Cliente

> **Implementação:** 009 - Performance de Consultas e Dashboard de Cliente
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 6/8 tarefas concluídas (75%) — T-007/T-008 dependem da base remota (staging)
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

- [x] **T-001:** Investigar a `0016` ausente e levantar baseline no remoto
  - **Descrição:** Confirmado que a `0016` nunca foi criada (sequência salta de `0015` para `0017`). Os índices `idx_sales_user_year_client` e `idx_sales_user_date_client` estão declarados na `0012` mas precisam ser validados no remoto com `pg_indexes` antes da `0021`. A migration foi numerada `0021` (não `0016`) pois `0019` e `0020` já existem — inserir `0016` quebraria a ordenação do Supabase.
  - **Observações:** Baseline de tempo na base remota (~314k linhas) não pôde ser coletado neste ambiente. Marque como [!] a T-007 para execução em staging.
  - **Data de conclusão:** 2026-06-15

### Fase 2: Implementação Core

- [x] **T-002:** Criar a migration `0021_report_query_optimizations.sql` — índices e busca de clientes
  - **Descrição:** Migration criada em `supabase/migrations/0021_report_query_optimizations.sql`. Inclui:
    - Reaplicação idempotente (`IF NOT EXISTS`) dos índices da `0012` (`idx_sales_user_year_client`, `idx_sales_user_date_client`) mais índice auxiliar de lookup de clientes (`idx_sales_client_lookup`).
    - RPC `search_clients(p_query, p_limit, p_offset)` com CTE `authorized_owners`, filtro `ILIKE`, paginação e limite.
    - REVOKE/GRANT padrão (authenticated-only).
  - **Data de conclusão:** 2026-06-15

- [x] **T-003:** Adicionar à migration as RPCs agregadas do dashboard de cliente
  - **Descrição:** Na mesma migration, criadas as RPCs:
    - `client_dashboard_summary(p_cod_cliente, p_ano)` — resumo anual + comparativo ano anterior + vitalício em uma chamada.
    - `client_monthly_trend(p_cod_cliente, p_ano)` — tendência mensal para ano corrente e anterior.
    - `client_yearly_history(p_cod_cliente)` — histórico completo por ano.
    - `client_top_products(p_cod_cliente, p_ano, p_limit)` — top produtos com split corrente/anterior.
    - `client_recent_orders(p_cod_cliente, p_limit)` — pedidos recentes sob demanda.
    - Todas com CTE `authorized_owners`, SECURITY DEFINER, search_path seguro e REVOKE/GRANT padrão.
  - **Data de conclusão:** 2026-06-15

- [x] **T-004:** Revisar a autorização das `chat_*` (CTE em vez de por linha)
  - **Descrição:** Recriadas na migration `0021` as funções `chat_top_clients`, `chat_top_products`, `chat_sales_trend`, `chat_recent_orders`, `chat_rep_performance` e `chat_resolve_client` usando CTE `authorized_owners + JOIN` em vez de `chat_can_read_sales_owner(sales.user_id)` por linha. Escopo de visibilidade preservado identicamente. `chat_inactive_clients` já usava CTE (desde 0012) e não foi alterada.
  - **Observações:** Retestar `chat_inactive_clients` no remoto após aplicar `0021` (índices garantidos).
  - **Data de conclusão:** 2026-06-15

- [x] **T-005:** Trocar a busca de clientes por consulta paginada no banco
  - **Descrição:**
    - `lib/reportQueries.ts`: nova função `searchClients(query, limit, offset)` chama RPC `search_clients`; `getClients()` mantida como `@deprecated` delegando para `searchClients('', 100, 0)`.
    - `lib/server/reportData.ts`: `findClientsForSupabase` reescrita para chamar `search_clients` em vez de `get_distinct_clients()` + filtro em Node.
    - `components/client-dashboard/ClientVisitDashboard.tsx`: estado `clientQuery` com debounce de 300 ms alimenta `searchClients`; Combobox recebe `onInputChange` para capturar o texto digitado.
    - `components/ui/combobox.tsx`: prop `onInputChange` adicionada.
  - **Data de conclusão:** 2026-06-15

- [x] **T-006:** Refatorar o dashboard para consumir as RPCs agregadas
  - **Descrição:**
    - `types/clientDashboard.ts`: tipos `ClientDashboardSummaryRow`, `ClientMonthlyTrendRow`, `ClientYearlyHistoryRow`, `ClientTopProductRow`, `ClientRecentOrderRow` adicionados.
    - `lib/clientDashboard.ts`: nova função `buildClientVisitDashboardFromAggregates` monta o DTO `ClientVisitDashboardData` a partir das RPCs sem varrer linhas brutas. Contrato do DTO preservado integralmente.
    - `lib/reportQueries.ts`: funções `getClientDashboardSummary`, `getClientMonthlyTrend`, `getClientYearlyHistory`, `getClientTopProducts`, `getClientRecentOrders` adicionadas.
    - `lib/server/reportData.ts`: funções `*ForSupabase` equivalentes adicionadas para uso server-side.
    - `components/client-dashboard/ClientVisitDashboard.tsx`: ao selecionar cliente+ano, dispara `Promise.all` das 5 RPCs agregadas em vez de `getClientSalesHistory`; linhas brutas carregadas sob demanda somente ao abrir a aba Produtos.
    - Função original `buildClientVisitDashboard` e `getClientSalesHistory` preservadas (ainda usadas em `reportChat.ts` e `aiSummary.ts`).
  - **Data de conclusão:** 2026-06-15

### Fase 3: Testes e Validação

- [!] **T-007:** Medição antes/depois e paridade numérica
  - **Descrição:** A medição de tempo (`EXPLAIN ANALYZE`) e validação de paridade numérica requerem a base remota de ~314k linhas, sem acesso neste ambiente. Executar em staging após aplicar as migrations `0019`, `0020` e `0021`.
  - **Observações:** **BLOQUEADA — requer acesso ao banco remoto.** Antes de executar: (1) aplicar as migrations; (2) validar `idx_sales_user_year_client` e `idx_sales_user_date_client` com `SELECT * FROM pg_indexes WHERE tablename = 'sales_rows';`; (3) medir `search_clients('', 12, 0)` e `client_dashboard_summary` com `EXPLAIN ANALYZE`; (4) comparar números do dashboard com o cálculo antigo (mesmo cliente/ano).
  - **Data de conclusão:** —

### Fase 4: Documentação e Finalização

- [ ] **T-008:** Registrar resultados e fechar o eixo P2 da 005
  - **Descrição:** Documentar o antes/depois após T-007, o estado dos índices/RPCs no remoto e marcar as tarefas 15-18 da implementação 005 como concluídas.
  - **Dependências:** T-007
  - **Data de conclusão:** —

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-15 | Migration numerada 0021 (não 0016) |
| T-002  | ✅ Concluída | 2026-06-15 | search_clients + índices |
| T-003  | ✅ Concluída | 2026-06-15 | 5 RPCs agregadas |
| T-004  | ✅ Concluída | 2026-06-15 | chat_* com CTE authorized_owners |
| T-005  | ✅ Concluída | 2026-06-15 | Combobox com debounce + searchClients |
| T-006  | ✅ Concluída | 2026-06-15 | buildClientVisitDashboardFromAggregates |
| T-007  | 🚧 Bloqueada | — | Requer base remota; aplicar 0019/0020/0021 primeiro |
| T-008  | ⬜ Pendente | — | Aguarda T-007 |

---

> **NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.

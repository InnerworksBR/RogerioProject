# Tarefas

- [x] **T-001:** Criar contratos, parser e limites do BFF de relatórios
  - **Cobre:** RF-001, RF-005
  - **Valida:** CA-002, CA-010, CA-011, CA-017
  - **Testes:** CT-001, CT-002
  - **Arquivos esperados:** `types/reportApi.ts`, `tests/report-query-orchestration.test.mjs`
  - **Dependências:** nenhuma
  - **Risco:** medium
  - **Critério de conclusão:** entradas inválidas falham antes do banco; limites e flag `truncated` têm testes.

- [x] **T-002:** Implementar telemetria estruturada e redaction
  - **Cobre:** RF-006
  - **Valida:** CA-013, CA-016
  - **Testes:** CT-003
  - **Arquivos esperados:** `lib/server/queryTelemetry.ts`, `tests/report-query-orchestration.test.mjs`
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** log contém métricas permitidas e rejeita/omite PII e credenciais.

- [x] **T-003:** Implementar Query Orchestrator server-only
  - **Cobre:** RF-001, RF-002, RF-005, RF-006
  - **Valida:** CA-001, CA-003, CA-010, CA-011, CA-016
  - **Testes:** CT-004, CT-005
  - **Arquivos esperados:** `lib/server/reportQueryOrchestrator.ts`, `lib/server/reportData.ts`
  - **Dependências:** T-001, T-002
  - **Risco:** high
  - **Critério de conclusão:** bootstrap e consultas de aba reutilizam acesso server-side e retornam DTO tipado/medido.

- [x] **T-004:** Criar Route Handlers autenticados de bootstrap e consulta
  - **Cobre:** RF-001, RF-002
  - **Valida:** CA-001, CA-002, CA-004, CA-016
  - **Testes:** CT-006, CT-007
  - **Arquivos esperados:** `app/api/reports/bootstrap/route.ts`, `app/api/reports/query/route.ts`
  - **Dependências:** T-003
  - **Risco:** high
  - **Critério de conclusão:** endpoints autenticam, validam, chamam o orquestrador uma vez e normalizam erros.

- [x] **T-005:** Adicionar QueryProvider e cliente HTTP deduplicado
  - **Cobre:** RF-003
  - **Valida:** CA-005, CA-007
  - **Testes:** CT-008, CT-009
  - **Arquivos esperados:** `components/providers/QueryProvider.tsx`, `lib/client/reportApi.ts`, `app/layout.tsx` ou `app/(protected)/layout.tsx`
  - **Dependências:** T-001
  - **Risco:** medium
  - **Critério de conclusão:** chaves incluem todos os filtros, fetch recebe AbortSignal e cache preserva último dado válido.

- [x] **T-006:** Migrar bootstrap, filtros e KPIs para o BFF
  - **Cobre:** RF-001, RF-002, RF-003, RF-005
  - **Valida:** CA-001, CA-003, CA-004, CA-005, CA-010
  - **Testes:** CT-010, CT-011
  - **Arquivos esperados:** `app/(protected)/reports/page.tsx`, `components/reports/ReportFilterBar.tsx`, `components/reports/SummaryCards.tsx`, `components/reports/useEnsureReportYears.ts`
  - **Dependências:** T-004, T-005
  - **Risco:** high
  - **Critério de conclusão:** carga inicial usa bootstrap e anos têm um único owner.

- [x] **T-007:** Migrar as cinco views para consulta por aba ativa
  - **Cobre:** RF-001, RF-002, RF-003, RF-005
  - **Valida:** CA-001, CA-003, CA-005, CA-007, CA-011
  - **Testes:** CT-012, CT-013
  - **Arquivos esperados:** `components/reports/views/*.tsx`, `app/(protected)/reports/page.tsx`
  - **Dependências:** T-006
  - **Risco:** high
  - **Critério de conclusão:** somente a aba ativa consulta; troca rápida cancela requisições antigas sem substituir dados novos.

- [x] **T-008:** Tornar o resumo de IA explicitamente sob demanda
  - **Cobre:** RF-004
  - **Valida:** CA-008, CA-009
  - **Testes:** CT-014
  - **Arquivos esperados:** `components/reports/ExecutiveSummaryCard.tsx`
  - **Dependências:** T-006
  - **Risco:** medium
  - **Critério de conclusão:** montagem/filtros não chamam IA; botão gera/regenera com estados existentes.

- [x] **T-009:** Invalidar cache após upload e remover caminhos quentes de 10.000 linhas
  - **Cobre:** RF-003, RF-005
  - **Valida:** CA-006, CA-010, CA-012
  - **Testes:** CT-015, CT-016
  - **Arquivos esperados:** `components/upload/DropZone.tsx`, `lib/reportQueries.ts`, `lib/server/reportData.ts`
  - **Dependências:** T-005, T-007
  - **Risco:** high
  - **Critério de conclusão:** upload invalida `reports`; filtros quentes não possuem fallback bruto de 10.000 linhas; exportação continua separada.

- [x] **T-010:** Medir fan-out, executar suíte e registrar evidências
  - **Cobre:** RF-006
  - **Valida:** CA-014, CA-015, CA-017
  - **Testes:** CT-017, CT-018, CT-019, CT-020
  - **Arquivos esperados:** `implementation/017-supabase-query-orchestration/validation.md`, `implementation/017-supabase-query-orchestration/decisions.md`
  - **Dependências:** T-001 a T-009
  - **Risco:** medium
  - **Critério de conclusão:** fan-out antes/depois documentado; testes, typecheck e build verdes ou bloqueio remoto explicitamente evidenciado.

## Matriz de testes

| Teste | Evidência esperada |
|---|---|
| CT-001 | allowlist aceita somente relatórios suportados |
| CT-002 | filtros e limites inválidos retornam erro determinístico |
| CT-003 | telemetria não serializa PII/segredos |
| CT-004 | bootstrap coordena funções server-side esperadas |
| CT-005 | DTO informa `rowCount` e `truncated` |
| CT-006 | bootstrap exige autenticação |
| CT-007 | query handler normaliza 400/401/500 |
| CT-008 | query keys diferenciam todos os filtros |
| CT-009 | AbortSignal chega ao fetcher |
| CT-010 | tela inicial consome bootstrap único |
| CT-011 | anos possuem owner único |
| CT-012 | somente aba ativa consulta |
| CT-013 | resposta obsoleta não vence a mais nova |
| CT-014 | IA só é chamada por ação explícita |
| CT-015 | upload invalida queries `reports` |
| CT-016 | não há fallback quente de 10.000 linhas |
| CT-017 | medição de fan-out antes/depois |
| CT-018 | `npm test` |
| CT-019 | `npm run typecheck` |
| CT-020 | `npm run build` |

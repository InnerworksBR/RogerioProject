# Tarefas

- [x] **T-001:** Criar schema, funções e RLS de grupos de clientes
  - **Cobre:** RF-001, RF-004, RF-008
  - **Valida:** CA-001, CA-002, CA-003, CA-009, CA-019
  - **Testes:** CT-001, CT-002
  - **Arquivos esperados:** `supabase/migrations/0023_client_groups_and_account_scope.sql`
  - **Dependências:** nenhuma
  - **Risco:** high
  - **Critério de conclusão:** migration aditiva isola contas e mantém códigos originais.

- [x] **T-002:** Implementar API e interface de gestão de grupos
  - **Cobre:** RF-001
  - **Valida:** CA-001, CA-002, CA-003
  - **Testes:** CT-003, CT-004
  - **Arquivos esperados:** `app/api/client-groups/route.ts`, `components/clients/ClientGroupsManager.tsx`, `app/(protected)/clientes/page.tsx`
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** líder gerencia grupos e representante recebe interface somente leitura.

- [x] **T-003:** Aplicar cliente canônico a consultas, painel, compartilhamento e IA
  - **Cobre:** RF-002, RF-004
  - **Valida:** CA-004, CA-005, CA-010
  - **Testes:** CT-005, CT-006
  - **Arquivos esperados:** `lib/server/reportData.ts`, `lib/server/reportChat*.ts`, `lib/clientDashboard.ts`, `app/api/share/*`
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** toda superfície resolve a mesma lista de códigos e escopo de owners.

- [x] **T-004:** Evoluir contratos, estado e cache para múltiplos anos
  - **Cobre:** RF-003
  - **Valida:** CA-006, CA-008
  - **Testes:** CT-007, CT-008
  - **Arquivos esperados:** `store/filterStore.ts`, `types/reportApi.ts`, `lib/client/reportApi.ts`, `lib/server/reportQueryOrchestrator.ts`
  - **Dependências:** nenhuma
  - **Risco:** high
  - **Critério de conclusão:** lista normalizada de anos percorre URL, parser, query key e execução.

- [x] **T-005:** Exibir comparação multianual nas cinco visões e KPIs
  - **Cobre:** RF-003
  - **Valida:** CA-006, CA-007, CA-008
  - **Testes:** CT-009, CT-010
  - **Arquivos esperados:** `components/reports/ReportFilterBar.tsx`, `SummaryCards.tsx`, `views/*.tsx`, `app/(protected)/reports/page.tsx`
  - **Dependências:** T-004
  - **Risco:** high
  - **Critério de conclusão:** até quatro anos aparecem simultaneamente com ano explícito.

- [x] **T-006:** Corrigir configuração por conta e permissões da interface
  - **Cobre:** RF-004
  - **Valida:** CA-009
  - **Testes:** CT-011
  - **Arquivos esperados:** migration, `app/(protected)/config/page.tsx`, layout/navegação
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** somente líder altera; representantes consomem a configuração do líder.

- [x] **T-007:** Implementar exportação completa e totais honestos
  - **Cobre:** RF-005
  - **Valida:** CA-011, CA-012
  - **Testes:** CT-012, CT-013
  - **Arquivos esperados:** `app/api/reports/export/route.ts`, `components/reports/ExportButton.tsx`, `ReportTable.tsx`, `views/*.tsx`
  - **Dependências:** T-004, T-005
  - **Risco:** medium
  - **Critério de conclusão:** exportação não usa linhas truncadas e total parcial é rotulado.

- [x] **T-008:** Melhorar confirmação, resultados e exclusão de uploads
  - **Cobre:** RF-006
  - **Valida:** CA-013, CA-014, CA-015
  - **Testes:** CT-014, CT-015
  - **Arquivos esperados:** `app/api/upload/route.ts`, `components/upload/*.tsx`, tipos relacionados
  - **Dependências:** nenhuma
  - **Risco:** high
  - **Critério de conclusão:** substituição/exclusão são confirmadas e cada arquivo tem resultado persistente na tela.

- [x] **T-009:** Reformular home sem IA automática
  - **Cobre:** RF-007
  - **Valida:** CA-016
  - **Testes:** CT-016
  - **Arquivos esperados:** `app/(protected)/page.tsx`
  - **Dependências:** T-003, T-004
  - **Risco:** medium
  - **Critério de conclusão:** home renderiza KPIs reais e zero chamadas automáticas à IA.

- [x] **T-010:** Finalizar acessibilidade e navegação
  - **Cobre:** RF-007
  - **Valida:** CA-017, CA-018
  - **Testes:** CT-017, CT-018
  - **Arquivos esperados:** `components/layout/ProtectedNav.tsx`, `app/(protected)/layout.tsx`, `app/globals.css`, componentes interativos, rotas legadas
  - **Dependências:** T-002, T-005, T-006, T-008
  - **Risco:** medium
  - **Critério de conclusão:** nomes acessíveis, `aria-current`, progresso semântico, movimento reduzido e redirects funcionam.

- [x] **T-011:** Atualizar documentação operacional
  - **Cobre:** RF-008
  - **Valida:** CA-019
  - **Testes:** CT-019
  - **Arquivos esperados:** `README.md`, `implementation/018-clientes-consolidados-multiano/decisions.md`
  - **Dependências:** T-001 a T-010
  - **Risco:** medium
  - **Critério de conclusão:** ordem migration/build/deploy e rollback estão explícitos.

- [x] **T-012:** Executar suíte completa e registrar evidências
  - **Cobre:** RF-008
  - **Valida:** CA-020
  - **Testes:** CT-020, CT-021, CT-022, CT-023, CT-024
  - **Arquivos esperados:** `tests/*.test.mjs`, `implementation/018-clientes-consolidados-multiano/validation.md`
  - **Dependências:** T-001 a T-011
  - **Risco:** medium
  - **Critério de conclusão:** todos os comandos obrigatórios passam e riscos residuais estão documentados.

## Matriz de testes

| Teste | Evidência esperada |
|---|---|
| CT-001 | schema e unicidade por conta/código existem |
| CT-002 | RLS separa leitura/escrita entre contas e papéis |
| CT-003 | CRUD valida nome, membros e papel de líder |
| CT-004 | cliente não pode pertencer a dois grupos da mesma conta |
| CT-005 | chave canônica resolve todos os códigos do grupo |
| CT-006 | cliente simples mantém compatibilidade |
| CT-007 | parser normaliza `years` e compatibilidade com `year` |
| CT-008 | query key distingue conjuntos de anos |
| CT-009 | cinco visões identificam ano |
| CT-010 | seleção limita quatro anos e não fica vazia |
| CT-011 | configuração é escrita apenas pelo líder e lida pela conta |
| CT-012 | exportação usa limite próprio de 100.000 |
| CT-013 | truncamento altera rótulo do total |
| CT-014 | sobreposição e substituição pedem confirmação |
| CT-015 | exclusão concluída exige modo e confirmação da UI |
| CT-016 | home não monta resumo de IA automático |
| CT-017 | controles críticos possuem semântica acessível |
| CT-018 | páginas legadas chamam `redirect('/reports')` |
| CT-019 | documentação inclui ordem de publicação e rollback |
| CT-020 | `npm test` |
| CT-021 | `npm run typecheck` |
| CT-022 | `npm run lint` |
| CT-023 | `npm run build` |
| CT-024 | `git diff --check` |

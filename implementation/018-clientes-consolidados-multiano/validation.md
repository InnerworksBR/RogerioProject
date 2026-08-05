# Validação

## Decisão de convergência

**Aprovado com ressalvas para publicação.** A implementação local converge com os requisitos aprovados, não há tarefa aberta, a suíte automatizada e o build passam e a auditoria de dependências não possui vulnerabilidades conhecidas. A publicação continua condicionada à aplicação autorizada da migration `0023` em staging/produção e aos smoke tests com dados reais descritos no README.

## Matriz de rastreabilidade

| Requisito | Critério | Tarefa | Teste | Evidência | Status |
|---|---|---|---|---|---|
| RF-001 | CA-001 a CA-003 | T-001, T-002 | CT-001 a CT-004 | Migration cria grupos/membros tenant-scoped, constraint de membro único, RLS e RPCs atômicas; API e gestor diferenciam líder e representante; teste `canonical clients are tenant-scoped...` passou | aprovado |
| RF-002 | CA-004, CA-005 | T-003 | CT-005, CT-006 | RPCs de relatório, ranking, painel, compartilhamento e IA resolvem `group:<uuid>`; código legado continua válido; testes de cliente canônico e compartilhamento passaram | aprovado |
| RF-003 | CA-006 a CA-008 | T-004, T-005 | CT-007 a CT-010 | Parser, store, query key, orquestrador, cinco views e Excel usam lista limitada a quatro anos e identificação explícita de ano; teste multianual passou | aprovado |
| RF-004 | CA-009, CA-010 | T-003, T-006 | CT-006, CT-011 | RLS centraliza configuração no líder sem apagar linhas antigas; links respeitam escopo do criador e cliente canônico; testes de segurança/compartilhamento passaram | aprovado |
| RF-005 | CA-011, CA-012 | T-007 | CT-012, CT-013 | Route Handler autenticado exporta até 100.000 linhas e tabelas truncadas mostram `TOTAL PARCIAL`; teste de exportação passou | aprovado |
| RF-006 | CA-013 a CA-015 | T-008 | CT-014, CT-015 | API diferencia substituição/sobreposição com `409`; UI confirma ações destrutivas, mostra resultado por arquivo e invalida cache após exclusão; teste de upload passou | aprovado |
| RF-007 | CA-016 a CA-018 | T-009, T-010 | CT-016 a CT-018 | Home usa KPIs reais sem IA automática; navegação, controles, progresso, foco e movimento reduzido foram ajustados; rotas legadas redirecionam; testes passaram | aprovado |
| RF-008 | CA-019, CA-020 | T-011, T-012 | CT-019 a CT-024 | README documenta publicação/rollback; migration é aditiva; 55 testes, typecheck, lint, build, audit e diff check passaram | aprovado |

## Comandos e resultados

Executados em 2026-08-05, no workspace local:

| Comando | Exit code | Resultado |
|---|---:|---|
| `npm install` | 0 | Next.js 16.3.0 e shadcn 4.16.1 instalados; lockfile regenerado |
| `npm audit fix` | 0 | apenas resoluções transitivas compatíveis; auditoria passou a zero vulnerabilidades |
| `npm run typecheck` | 0 | TypeScript sem erros |
| `npm run lint` | 0 | script atual (`tsc --noEmit`) sem erros |
| `npm test` | 0 | 55 testes aprovados, 0 falhas, 0 ignorados |
| `npm run audit` | 0 | 0 vulnerabilidades conhecidas em dependências de produção |
| `npm ls --all` | 0 | árvore resolvida; ausências exibidas são peers/opcionais específicos de outras plataformas |
| `npm run build` | 0 | Next.js 16.3.0/Turbopack compilou e gerou 33 rotas |
| `git diff --check` | 0 | nenhuma falha de whitespace; somente avisos informativos de conversão LF/CRLF |

Os testes emitem `MODULE_TYPELESS_PACKAGE_JSON` ao importar diretamente um arquivo TypeScript. É um aviso de desempenho do runner de testes, não falha funcional nem erro do build.

## Arquivos alterados

- Banco e contratos: `supabase/migrations/0023_client_groups_and_account_scope.sql`, `types/operations.ts`, `types/reportApi.ts`, `types/sales.ts`.
- APIs e servidor: `app/api/client-groups/route.ts`, `app/api/reports/export/route.ts`, `app/api/config/seed-suggestions/route.ts`, `app/api/share/client/route.ts`, `app/api/upload/route.ts`, `lib/server/reportData.ts`, `lib/server/reportQueryOrchestrator.ts`, `lib/server/shareLinks.ts`, `lib/reportQueries.ts`.
- Relatórios e exportação: `app/(protected)/reports/page.tsx`, as cinco páginas legadas de relatório, `components/reports/ExportButton.tsx`, `ReportFilterBar.tsx`, `ReportTable.tsx`, `SummaryCards.tsx`, cinco componentes em `components/reports/views/`, `lib/client/reportApi.ts`, `lib/exportXlsx.ts`, `store/filterStore.ts`.
- Clientes, navegação e acesso: `app/(protected)/clientes/page.tsx`, `app/(protected)/config/layout.tsx`, `config/page.tsx`, `layout.tsx`, `team/page.tsx`, `components/clients/ClientGroupsManager.tsx`, `components/layout/ProtectedNav.tsx`, `components/client-dashboard/ClientVisitDashboard.tsx`.
- Home, upload e acessibilidade: `app/(protected)/page.tsx`, `app/globals.css`, `components/auth/UserMenu.tsx`, `components/report-chat/ReportChat.tsx`, `components/ui/tabs.tsx`, `components/upload/DropZone.tsx`, `UploadHistory.tsx`, `UploadProgress.tsx`.
- Dependências, documentação e testes: `package.json`, `package-lock.json`, `README.md`, `tests/client-groups-multiyear.test.mjs`, `tests/report-query-orchestration.test.mjs`, `tests/security-regressions.test.mjs` e os seis artefatos em `implementation/018-clientes-consolidados-multiano/`.

## Revisões aplicadas

- Revisão de acessibilidade: achados automáticos de nomes acessíveis, estado de seleção, foco, `aria-live`, `aria-current` e movimento reduzido foram corrigidos. Não equivale a conformidade WCAG integral.
- Revisão de dependências: Next.js foi atualizado de 16.2.6 para a versão estável 16.3.0, o override vulnerável de PostCSS foi removido e transitivos foram atualizados sem `--force`; `npm audit` final encontrou zero vulnerabilidades.
- Revisão PostgreSQL: tabelas/constraints são aditivas, não há reescrita de `sales_rows`, índices cobrem as novas chaves e funções `SECURITY DEFINER` fixam `search_path`; a troca das políticas foi movida para o final para reduzir a retenção de lock.
- Correção pós-validação remota: `chat_recent_orders` foi retirada da migration extensa e isolada em `0024_fix_chat_recent_orders_grouping.sql`, onde linhas brutas e agregação ficam em CTEs distintas. Isso elimina o erro PostgreSQL `42803` sem mudar a chave dos pedidos. A criação das tabelas, índices e políticas da `0023` também aceita reexecução segura caso a tentativa anterior tenha sido parcialmente persistida.
- Convergência: todos os requisitos possuem tarefa, mudança e evidência automatizada; não restou finding local de severidade alta ou crítica.

## Achados e riscos restantes

- **Médio — gate de banco/ambiente:** a migration foi revisada e testada por contrato, mas não foi executada contra um PostgreSQL/Supabase real nesta tarefa. Versão, volume, duração do backfill e espera por lock devem ser medidos em staging. Responsável pelo próximo gate: operador do ambiente, com backup, janela de baixo tráfego e smoke test.
- **Baixo — acessibilidade manual:** teclado completo, leitor de tela, zoom e contraste em navegador real ainda precisam de validação humana.
- **Baixo — volume real:** o limite de exportação é protegido em 100.000 linhas, porém memória/latência devem ser observadas com o maior conjunto real em staging.

## Limitações

- Nenhuma migration, deploy, mensagem externa ou alteração em produção foi executada.
- Não foram usados dados pessoais nem credenciais remotas.
- Não houve teste E2E autenticado com líder, representante e segunda conta, pois depende do ambiente após a migration.
- Não houve benchmark com planilha real de 100.000 linhas nem teste manual com tecnologia assistiva.

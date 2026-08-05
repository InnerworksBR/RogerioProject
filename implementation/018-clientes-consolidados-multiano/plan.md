# Plano

## Estratégia

1. Adicionar identidade canônica tenant-scoped e helpers SQL compatíveis com códigos simples.
2. Corrigir o escopo da configuração e compartilhar os resolvedores no BFF, painel, links públicos e IA.
3. Evoluir contratos, store e orquestrador para uma lista ordenada de anos; executar consultas anuais existentes e concatenar resultados identificados por ano.
4. Separar exportação completa da consulta visual e marcar totais parciais.
5. Entregar CRUD de grupos, operação segura de uploads e home sem IA automática.
6. Finalizar navegação, acessibilidade e redirects; validar contratos, tipos e build.

## Arquivos previstos

### Novos

- `supabase/migrations/0023_client_groups_and_account_scope.sql`
- `app/api/client-groups/route.ts`
- `components/clients/ClientGroupsManager.tsx`
- `app/api/reports/export/route.ts`
- `components/layout/ProtectedNav.tsx`
- `tests/client-groups-multiyear.test.mjs`
- artefatos em `implementation/018-clientes-consolidados-multiano/`

### Modificados

- contratos/store/orquestração em `types/`, `store/`, `lib/client/`, `lib/server/` e `app/api/reports/`;
- views e componentes de relatórios em `components/reports/`;
- páginas protegidas de clientes, config, home, layout e rotas legadas;
- compartilhamento, painel de cliente, chat e resolutores de dados;
- upload route, componentes e tipos;
- `app/globals.css`, componentes de autenticação/chat/config e testes existentes quando contratos mudarem;
- `README.md` com operação e ordem de publicação.

Arquivos adicionais diretamente afetados podem ser incluídos e registrados em `decisions.md`.

## Sequência reversível

- Migration cria tabelas e funções antes de qualquer consumidor, sem reescrever vendas.
- Cliente simples continua aceitando código legado; a chave `group:<uuid>` é aditiva.
- `selectedYear` permanece como compatibilidade durante a migração para `selectedYears`.
- Endpoint de exportação é aditivo; a tela mantém seu limite.
- Rotas legadas apenas redirecionam e podem ser restauradas isoladamente.

## Testes e validações

- Testes estáticos/contratuais de migration, RLS, parsing de anos e chaves de cache.
- Testes negativos para grupos cruzados, mais de quatro anos na UI e exportação acima do limite.
- Testes de regressão para cliente simples e APIs existentes.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`.

## Rollback

- Reverter consumidores para códigos simples e ano único antes de remover funções/tabelas.
- Manter tabelas de grupos sem uso é seguro; nenhum dado original depende delas.
- Restaurar políticas anteriores de `report_config_items` apenas por migration posterior revisada.
- Reverter endpoint/controles de upload não remove importações existentes.

## Aprovações necessárias

- Spec, migration aditiva e alteração de autorização aprovadas pelo pedido explícito do usuário em 2026-08-05, dentro da análise imediatamente anterior.
- Aplicação da migration, deploy, exclusão de dados fora da ação confirmada do próprio produto e qualquer mudança de infraestrutura continuam fora do escopo.

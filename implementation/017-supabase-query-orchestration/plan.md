# Plano

## Estratégia

1. Criar contratos tipados e validação de filtros independentes de UI/HTTP.
2. Criar orquestrador `server-only` que reutiliza `lib/server/reportData.ts`, mede cada operação e produz DTOs limitados.
3. Expor bootstrap e consulta de aba por Route Handlers autenticados.
4. Instalar o provider de TanStack Query no layout e criar hooks/fetchers com `AbortSignal`, chaves completas e `staleTime`.
5. Migrar `/reports`, filtros, KPIs e views para os hooks; remover consultas Supabase diretas desse grafo de componentes.
6. Tornar IA explícita e invalidar queries de relatórios após upload concluído.
7. Validar contratos, fan-out, segurança dos logs, typecheck, testes e build.

## Arquivos previstos

### Novos

- `types/reportApi.ts`
- `lib/server/reportQueryOrchestrator.ts`
- `lib/server/queryTelemetry.ts`
- `lib/client/reportApi.ts`
- `components/providers/QueryProvider.tsx`
- `app/api/reports/bootstrap/route.ts`
- `app/api/reports/query/route.ts`
- `app/api/reports/options/route.ts`
- `tests/report-query-orchestration.test.mjs`

### Modificados

- `app/layout.tsx` ou `app/(protected)/layout.tsx`
- `app/(protected)/reports/page.tsx`
- `components/reports/ReportFilterBar.tsx`
- `components/reports/SummaryCards.tsx`
- `components/reports/ExecutiveSummaryCard.tsx`
- `components/reports/useEnsureReportYears.ts`
- `components/reports/views/TabelaDinamicaView.tsx`
- `components/reports/views/BaseCompraView.tsx`
- `components/reports/views/BaseItensView.tsx`
- `components/reports/views/BagagitosView.tsx`
- `components/reports/views/GeralView.tsx`
- `components/upload/DropZone.tsx`
- `lib/server/reportData.ts`
- `lib/reportQueries.ts` apenas para remover caminhos legados comprovadamente sem consumidores
- documentação e artefatos desta implementação

Arquivos adicionais só serão incluídos se forem indispensáveis a um critério de aceite e registrados em `decisions.md`.

## Sequência reversível

- Introduzir provider, contratos, orquestrador e endpoints sem trocar consumidores.
- Cobrir endpoints por testes antes da migração da UI.
- Migrar primeiro bootstrap/KPI, depois uma view por vez.
- Manter funções antigas até busca de consumidores confirmar que não são mais necessárias.
- Alterar IA e invalidação de upload por último, reduzindo o raio de falha.

## Testes e validações

- Testes unitários de parsing/allowlist/limites e serialização do DTO.
- Testes de contrato dos Route Handlers com Supabase/orquestrador substituídos por doubles.
- Testes de chave de cache, deduplicação, cancelamento e invalidação.
- Teste estático de ausência de acesso Supabase direto nas views.
- Teste de redaction da telemetria.
- `npm test`.
- `npm run typecheck`.
- `npm run build`.
- Inspeção de `rg` para consumidores legados e de `git diff --check`.

## Rollback

- Reverter consumidores para `lib/reportQueries.ts`; endpoints novos são aditivos.
- Remover o provider somente após restaurar todos os consumidores.
- A ação de IA pode voltar ao automático isoladamente, sem tocar dados.
- Nenhum rollback de banco é necessário porque não haverá migration.

## Aprovações necessárias

- Aprovação explícita deste `spec.md` antes do código.
- Nova aprovação se for necessário adicionar cache distribuído, migration, dependência, alteração de RLS, service role ou mudança no comportamento completo da exportação.

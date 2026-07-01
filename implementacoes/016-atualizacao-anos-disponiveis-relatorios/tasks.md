# Tarefas — 016 Atualização da Lista de Anos Disponíveis nos Relatórios

> Spec: [spec.md](./spec.md)
> **Progresso:** 3/3 (código entregue e no `main`; verificação manual em produção recomendada)

| # | Tarefa | Status |
|---|--------|--------|
| 1 | `useEnsureReportYears.ts`: remover o early-return que pulava o fetch quando `availableYears` já tinha itens; sempre buscar ao montar | ✅ Concluída |
| 2 | `useEnsureReportYears.ts`: só ativar `loadingYears` quando o cache está vazio; preservar `selectedYear` se ainda válido após a atualização | ✅ Concluída |
| 3 | Validação: `npm run typecheck` (verde) + `node --test tests/*.test.mjs` (40/40) | ✅ Concluída |

## Pendências (fora do código)

- [ ] **Deploy do código** — mudança é só de front-end, sem migration.
- [ ] **Verificação manual (CA-004):** após o deploy, importar um ano inédito e confirmar que o filtro reflete o novo ano sem F5.

## Notas de Execução

- Commit no `main`: `fix(relatorios): atualiza lista de anos ao voltar para a tela de relatorios` (`f0d7053`).
- Originado de um relato do usuário: upload de "01-01-2026 a 31-05-2026" (54.311 linhas, importação concluída) não aparecia no filtro de anos até recarregar a página. Confirmado que os dados estavam gravados corretamente (visíveis em "Todos os anos" e após F5) — o problema era só o cache da lista de anos no cliente.
- Único arquivo alterado: `components/reports/useEnsureReportYears.ts`.

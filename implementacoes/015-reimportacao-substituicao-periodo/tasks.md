# Tarefas — 015 Reimportação com Substituição por Período Exato

> Spec: [spec.md](./spec.md) · Deploy: [deploy-notes.md](./deploy-notes.md)
> **Progresso:** 5/5 (código entregue e no `main`; verificação manual em produção pendente)

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Migration `0022`: dropar `idx_uploads_unique_user_fingerprint` | ✅ Concluída |
| 2 | Migration `0022`: recriar `finalize_upload` para apagar uploads do período exato ao concluir (cascade) + `NOTIFY pgrst` | ✅ Concluída |
| 3 | `route.ts` (PUT): remover a checagem de duplicado por fingerprint e o tratamento `23505` específico | ✅ Concluída |
| 4 | `route.ts` (PUT): excluir o período exato da lista de `overlaps` (só sobreposição parcial pede confirmação) | ✅ Concluída |
| 5 | Validação: `npm run typecheck` (verde) + `node --test tests/*.test.mjs` (40/40) | ✅ Concluída |

## Pendências (fora do código)

- [ ] **Aplicar a migration `0022` no Supabase de produção** (SQL Editor) — ver `deploy-notes.md`.
- [ ] **Deploy do código** (`route.ts`) — os dois passos são obrigatórios.
- [ ] **Verificação manual (CA-006):** reimportar uma planilha corrigida do mesmo período e conferir que os relatórios refletem só a nova versão (sem dobrar).

## Notas de Execução

- Commit no `main`: `feat(upload): permite reimportar planilha do mesmo periodo substituindo os dados` (`6a14c1f`).
- Apenas 2 arquivos versionados nesta entrega (`route.ts`, `0022_...sql`); o restante do working tree continha WIP de terceiros (recuperação/troca de senha — implementação 014) e **não** foi incluído.
- A regressão `tests/security-regressions.test.mjs` que valida `(user_id, fingerprint)` lê o texto da migration `0005` (intocada) — continua passando mesmo com o índice dropado em runtime pela `0022`.

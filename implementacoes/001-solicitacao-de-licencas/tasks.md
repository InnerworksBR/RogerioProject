# Tarefas - Solicitacao de Licencas por Plano

- [x] 1. Criar a migration `0009_license_requests.sql` com tabela, constraints, indices, RLS, grants e revoke.
- [x] 2. Criar a rota autenticada `app/api/admin/license-requests/route.ts` para listar, solicitar e cancelar licencas. *(Pode ser feito em paralelo com a tarefa 3 usando subagente, depois da tarefa 1.)*
- [x] 3. Evoluir `app/(protected)/team/page.tsx` com cards dos planos, formulario de solicitacao e historico. *(Pode ser feito em paralelo com a tarefa 2 usando subagente, depois da tarefa 1.)*
- [x] 4. Integrar a interface com a API e conferir estados de carregamento, sucesso e erro. *(Depende das tarefas 2 e 3.)*
- [x] 5. Adicionar teste de regressao para schema, RLS e autorizacao da rota.
- [x] 6. Executar `npm test`, `npm run typecheck` e `npm run build`, corrigindo problemas encontrados.
- [x] 7. Atualizar este checklist com as tarefas concluidas e registrar o resultado final.

## Resultado Final

- Migration de solicitacoes comerciais criada com RLS e grants restritos.
- API autenticada criada para listar, enviar e cancelar solicitacoes pendentes.
- Tela de equipe integrada com planos, formulario e historico.
- `npm test`, `npm run typecheck`, `npm run build` e `git diff --check` executados com sucesso.
- Rota protegida `/team` validada via HTTP: sem sessao, responde `307` para `/login?redirectedFrom=%2Fteam`.
- Verificacao visual nao executada porque o navegador integrado nao estava disponivel nesta sessao.

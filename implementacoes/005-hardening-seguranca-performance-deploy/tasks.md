# Tarefas - Hardening de Seguranca, Performance e Preparacao para Deploy

## P0 - Bloqueadores de Deploy

- [x] 1. Criar migration `0013_production_security_hardening.sql` revogando `PUBLIC` e `anon` de todas as RPCs antigas e atuais, concedendo somente as assinaturas necessarias a `authenticated`.
- [x] 2. Recriar RPCs antigas `SECURITY DEFINER` com `search_path` seguro e adicionar `ALTER DEFAULT PRIVILEGES` para impedir novas funcoes publicas. *(Pode ser feito em paralelo com a tarefa 3 usando subagente, dentro da migration 0013.)*
- [ ] 3. Adicionar regressao local e probe remoto anonimo para tabelas e RPCs comerciais. *(Pode ser feito em paralelo com a tarefa 2 usando subagente, depois de listar as assinaturas da tarefa 1.)*
- [ ] 4. Evoluir compartilhamento publico para retornar DTO agregado minimo, filtrando ano compartilhado e comparativo estritamente necessario. *(Pode ser feito em paralelo com as tarefas 5, 7 e 9 usando subagentes.)*
- [ ] 5. Criar migration `0014_upload_integrity.sql` com `upload_chunks`, fingerprint unico e RPCs transacionais de append/finalizacao. *(Pode ser feito em paralelo com as tarefas 4, 7 e 9 usando subagente.)*
- [ ] 6. Evoluir `/api/upload` e worker para enviar `chunkIndex`, impor quotas, validar metadados e ignorar replay sem duplicar vendas. *(Depende da tarefa 5.)*
- [ ] 7. Adicionar rate limit atomico, timeout, limite de output e teto total de tools no chat e no resumo executivo. *(Pode ser feito em paralelo com as tarefas 4, 5 e 9 usando subagente.)*
- [ ] 8. Adicionar testes para replay de upload, DTO publico minimo, rate limit, timeout e limite total de tools. *(Depende das tarefas 4, 6 e 7.)*

## P1 - Hardening Operacional

- [ ] 9. Evoluir `next.config.ts` com headers defensivos, `poweredByHeader: false` e CSP validada. *(Pode ser feito em paralelo com as tarefas 4, 5 e 7 usando subagente.)*
- [ ] 10. Servir localmente o asset de ruido usado pelo layout e remover dependencia de `grainy-gradients.vercel.app`. *(Pode ser feito em paralelo com a tarefa 9 usando subagente.)*
- [ ] 11. Adicionar validacao centralizada de `Origin` em rotas mutaveis autenticadas e respostas publicas sem detalhes internos. *(Pode ser feito em paralelo com as tarefas 12 e 13 usando subagente.)*
- [ ] 12. Criar `.env.example`, checklist de variaveis de deploy e registrar rotacao obrigatoria de chaves expostas. *(Pode ser feito em paralelo com as tarefas 11 e 13 usando subagente.)*
- [ ] 13. Criar migration `0015_rep_offboarding.sql` e substituir exclusao sequencial por fluxo idempotente com fase transacional e retry. *(Pode ser feito em paralelo com as tarefas 11 e 12 usando subagente.)*
- [ ] 14. Paginar ou restringir a consulta de usuarios Auth usada na listagem de representantes. *(Pode ser feito em paralelo com a tarefa 13 usando subagente.)*

## P2 - Performance e Dependencias

- [ ] 15. Criar migration `0016_report_query_optimizations.sql` com busca limitada de clientes, RPCs agregadas de dashboard e revisao dos joins de proprietarios autorizados. *(Pode ser feito em paralelo com a tarefa 17 usando subagente.)*
- [ ] 16. Evoluir `reportData.ts` e dashboards para consumir RPCs agregadas e evitar historico bruto completo na carga inicial. *(Depende da tarefa 15.)*
- [ ] 17. Atualizar dependencias compativeis e resolver ou documentar o risco residual de `postcss < 8.5.10` no Next.js. *(Pode ser feito em paralelo com a tarefa 15 usando subagente.)*
- [ ] 18. Medir consultas principais antes e depois, incluindo busca de clientes, dashboard, ranking e `chat_inactive_clients`. *(Depende das tarefas 15 e 16.)*

## Validacao e Deploy

- [ ] 19. Aplicar migrations `0013`, `0014`, `0015` e `0016` em ordem no remoto de validacao.
- [ ] 20. Executar probe anonimo remoto e confirmar bloqueio de tabelas e RPCs comerciais. *(Depende da tarefa 19.)*
- [ ] 21. Executar smoke test autenticado de login, relatorios, upload, compartilhamento, equipe, licencas, chat e resumo executivo. *(Pode ser feito em paralelo com a tarefa 20 usando subagente, depois da tarefa 19.)*
- [ ] 22. Executar smoke test publico de link valido, expirado, revogado e rate limit. *(Pode ser feito em paralelo com as tarefas 20 e 21 usando subagente, depois da tarefa 19.)*
- [ ] 23. Executar `npm test`, `npm run typecheck`, `npm run build`, `git diff --check` e `npm audit --omit=dev`.
- [ ] 24. Validar headers HTTP no ambiente local e no preview HTTPS.
- [ ] 25. Rotacionar chaves expostas, configurar secrets no ambiente de deploy e confirmar que nenhum `.env` esta versionado.
- [ ] 26. Registrar resultados, riscos residuais e decisao final de go/no-go neste checklist.

## Ordem Recomendada

1. Executar primeiro as tarefas 1 a 3 e aplicar o revoke emergencial no remoto.
2. Executar em paralelo os blocos de compartilhamento, upload, IA e headers.
3. Executar offboarding e performance depois que os bloqueadores P0 estiverem cobertos por testes.
4. Aplicar migrations em ambiente de validacao antes do smoke test final.
5. Publicar somente com todas as tarefas P0 concluidas e sem vazamento anonimo.

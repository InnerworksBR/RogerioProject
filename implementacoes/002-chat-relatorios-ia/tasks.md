# Tarefas - Chat de IA com Acesso aos Relatorios

- [x] 1. Criar migration `0010_ai_report_chat.sql` com `profiles.subscription_plan`, constraint e indice.
- [x] 2. Criar tipos do chat e adicionar feature flag `AI_REPORT_CHAT_ENABLED` no backend. *(Pode ser feito em paralelo com a tarefa 3 usando subagente, depois da tarefa 1.)*
- [x] 3. Evoluir a camada server-side de dados com consultas autorizadas para anos, clientes, dashboard e base de compra filtrada. *(Pode ser feito em paralelo com a tarefa 2 usando subagente, depois da tarefa 1.)*
- [x] 4. Criar `lib/server/reportChat.ts` com prompt, tools controladas, validacao, Responses API e loop limitado de function calling. *(Depende das tarefas 2 e 3.)*
- [x] 5. Criar rota autenticada `app/api/ai/report-chat/route.ts` com verificacao de feature flag, entitlement e limites de payload. *(Depende das tarefas 2 e 4.)*
- [x] 6. Criar pagina `/chat`, componente conversacional e estados de loading, erro, sugestoes e nova conversa. *(Pode ser feito em paralelo com as tarefas 4 e 5 usando subagente.)*
- [x] 7. Adicionar navegacao condicional `Chat IA` para usuarios elegiveis e mensagem comercial no acesso direto sem Plano 3. *(Depende das tarefas 1 e 6.)*
- [x] 8. Adicionar testes de regressao para entitlement, bloqueio da rota, ausencia de SQL livre, uso de cliente autenticado e limites do loop de tools.
- [ ] 9. Executar `npm test`, `npm run typecheck`, `npm run build` e verificacao visual autenticada de `/chat`, corrigindo problemas encontrados. *(Validacoes automatizadas concluidas; verificacao visual autenticada bloqueada ate aplicar `0010_ai_report_chat.sql` e disponibilizar o navegador integrado.)*
- [x] 10. Atualizar este checklist com as tarefas concluidas e registrar o resultado final.

## Resultado Final

- Migration `0010_ai_report_chat.sql` criada com entitlement herdado e RPC autenticada.
- Chat implementado com Responses API, `store: false`, tools controladas e limite de quatro rodadas.
- Rota, pagina `/chat`, navegacao condicional e historico local implementados.
- `AI_REPORT_CHAT_ENABLED=true` e modelo local configurados em `.env.local`.
- `npm test`, `npm run typecheck`, `npm run build` e `git diff --check` executados com sucesso.
- Rota protegida `/chat` validada via HTTP: sem sessao, responde `307` para `/login?redirectedFrom=%2Fchat`.
- Migration `0009_license_requests.sql` confirmada no remoto.
- Migration `0010_ai_report_chat.sql` ainda precisa ser aplicada no SQL Editor do Supabase: o ambiente nao possui Supabase CLI, `psql`, link local ou URL de conexao Postgres.
- Verificacao visual autenticada pendente porque o navegador integrado nao esta disponivel nesta sessao.

# Tarefas - Toolkit Comercial Completo para o Chat IA

- [x] 1. Criar migration `0012_report_chat_commercial_tools.sql` com helper de escopo e RPCs comerciais controladas.
- [x] 2. Evoluir `reportData.ts` com wrappers tipados e normalizacao dos resultados. *(Pode ser feito em paralelo com a tarefa 3 usando subagente, depois da tarefa 1.)*
- [x] 3. Evoluir schemas, validacoes e prompt de `reportChat.ts`, aumentando o limite para seis rodadas seguras. *(Pode ser feito em paralelo com a tarefa 2 usando subagente, depois da tarefa 1.)*
- [x] 4. Integrar `resolve_client`, ranking de produtos, tendencia, pedidos recentes, clientes inativos, representantes e oportunidades por cliente no executor de tools. *(Depende das tarefas 2 e 3.)*
- [x] 5. Adicionar regressao para escopo autenticado, revokes, limites, ausencia de SQL livre e cobertura das novas tools.
- [ ] 6. Executar `npm test`, `npm run typecheck`, `npm run build` e verificacao visual autenticada dos principais fluxos, corrigindo problemas encontrados. *(Validacoes automatizadas concluidas; verificacao visual autenticada depende de reaplicar `0012_report_chat_commercial_tools.sql` no remoto.)*
- [x] 7. Atualizar este checklist com as tarefas concluidas e registrar o resultado final.

## Resultado Final

- Migration `0012_report_chat_commercial_tools.sql` criada com helper de escopo, indices e RPCs comerciais controladas.
- Chat evoluido com resolucao canonica de cliente, ranking de produtos, tendencias, pedidos recentes, clientes inativos, desempenho de representantes e oportunidades por cliente.
- Prompt orientado a reutilizar codigos canonicos e executar consultas diretamente quando possivel.
- Limite de encadeamento aumentado de quatro para seis rodadas seguras.
- Resultados numericos das RPCs normalizados antes do envio ao modelo.
- `npm test`, `npm run typecheck`, `npm run build` e `git diff --check` executados com sucesso.
- Rota protegida `/chat` validada via HTTP: sem sessao, responde `307` para `/login?redirectedFrom=%2Fchat`.
- RPCs remotas testadas: todas responderam, exceto `chat_inactive_clients`, que apresentou timeout na primeira versao aplicada.
- Migration `0012_report_chat_commercial_tools.sql` foi otimizada com indices e pre-selecao de proprietarios autorizados; precisa ser reaplicada no SQL Editor para substituir a funcao lenta no remoto.

# Chat de IA com Acesso aos Relatorios

## Contexto / Objetivo

O portal ja possui relatorios autenticados, dashboards por cliente e uma geracao pontual de resumo executivo com IA. A nova feature deve adicionar um chat comercial capaz de responder perguntas do usuario com base nos dados autorizados dos relatorios.

O chat faz parte da IA avancada do Plano 3. Ele deve responder em portugues do Brasil, explicar os dados utilizados e recusar respostas que nao possam ser sustentadas pelas informacoes disponiveis.

## Escopo Funcional

- Criar uma pagina protegida `/chat`.
- Permitir perguntas livres sobre faturamento, pedidos, clientes, produtos, tendencias, comparacoes anuais e oportunidades comerciais.
- Permitir perguntas globais e perguntas focadas em um cliente.
- Exibir respostas em formato conversacional com estado de carregamento, mensagens de erro e sugestoes iniciais.
- Manter no navegador o historico recente da conversa durante a sessao atual.
- Permitir iniciar uma nova conversa limpando o historico local.

## Controle de Acesso

### Entitlement do Plano 3

- Criar migration `0010_ai_report_chat.sql`.
- Adicionar `subscription_plan` em `profiles`, com valores `plan_1`, `plan_2` ou `plan_3`.
- Usar `plan_1` como valor padrao para perfis existentes.
- Lideres do Plano 3 podem usar o chat com a visao comercial permitida pelas regras atuais.
- Representantes vinculados a um lider do Plano 3 tambem podem usar o chat, limitados aos dados que o RLS ja permite consultar para o representante.
- O provisionamento de `subscription_plan` sera manual nesta primeira versao. Aprovar uma solicitacao comercial continua desacoplado da ativacao do plano.
- Adicionar `AI_REPORT_CHAT_ENABLED=true` como feature flag de ambiente. Quando ausente ou desligada, a rota retorna indisponibilidade sem chamar a OpenAI.

## Arquitetura de IA

### API da OpenAI

- Criar integracao nova com a Responses API (`POST /v1/responses`).
- Nao migrar o resumo executivo existente nesta entrega.
- Usar `AI_REPORT_CHAT_MODEL` como modelo configuravel, com fallback `gpt-5.4-mini`.
- Usar a chave `OPENAI_API_KEY` somente no servidor.

### Function Calling

O modelo nao tera acesso a SQL livre, service role ou tabelas diretamente. Ele podera solicitar somente funcoes server-side predefinidas:

1. `get_dashboard_summary`
   - Entrada: ano obrigatorio e filtros opcionais de cliente, produto, semestre e tipo de receita.
   - Saida: indicadores agregados do dashboard.

2. `get_base_purchase_report`
   - Entrada: ano obrigatorio e filtros opcionais de cliente, produto, semestre e tipo de receita.
   - Saida: linhas agregadas de produtos da base de compra, ordenadas e limitadas para o contexto da IA.

3. `get_client_dashboard`
   - Entrada: codigo do cliente e ano obrigatorios.
   - Saida: resumo do cliente, insights baseados em regra, principais produtos, itens em atencao, produtos em crescimento e pedidos recentes.

4. `list_available_years`
   - Entrada: nenhuma.
   - Saida: anos disponiveis para o usuario autenticado.

5. `find_clients`
   - Entrada: termo de busca.
   - Saida: lista limitada de clientes autorizados cujo codigo ou nome corresponde ao termo.

Todas as funcoes devem executar com o cliente Supabase autenticado da requisicao para preservar o RLS existente.

### Loop da Resposta

- A rota recebe a pergunta atual e ate 10 mensagens recentes da conversa.
- A rota envia contexto, ferramentas permitidas e historico para a Responses API.
- Quando o modelo solicitar uma ferramenta, o servidor valida os argumentos, executa a consulta autorizada e devolve o resultado estruturado ao modelo.
- Limitar a no maximo 4 rodadas de ferramentas por pergunta.
- A resposta final deve destacar quando faltarem dados ou quando a pergunta estiver fora do escopo comercial.

## Backend

- Criar `app/api/ai/report-chat/route.ts`.
- Criar `lib/server/reportChat.ts` para prompt, tools, chamadas a OpenAI, validacao de argumentos e loop de function calling.
- Evoluir `lib/server/reportData.ts` com wrappers server-side para anos, clientes e filtros adicionais usados pelo chat.
- Evoluir `lib/server/env.ts` com `isAIReportChatEnabled()`.
- Criar `types/reportChat.ts` para mensagens, payloads, respostas e erros esperados.
- Validar corpo da requisicao, tamanho maximo das mensagens e quantidade maxima de mensagens aceitas.
- Nunca registrar a chave da OpenAI, prompts completos ou linhas comerciais brutas em logs.

## Frontend

- Criar `app/(protected)/chat/page.tsx`.
- Criar `components/report-chat/ReportChat.tsx`.
- Adicionar item `Chat IA` na navegacao protegida apenas quando o usuario tiver entitlement do Plano 3.
- Exibir:
  - lista de mensagens do usuario e do assistente;
  - campo de pergunta;
  - botao de envio;
  - botao para nova conversa;
  - loading durante a resposta;
  - sugestoes como "Quais clientes mais faturaram no ultimo ano?" e "Quais produtos cairam em relacao ao ano anterior?".
- Quando o usuario nao tiver Plano 3, acesso direto a `/chat` deve exibir uma mensagem comercial de indisponibilidade sem renderizar o formulario.

## Banco de Dados

- A migration deve adicionar `subscription_plan` com constraint.
- Adicionar indice para consultas por plano quando necessario.
- Nao criar tabelas de historico de chat nesta versao.
- Nao persistir prompts ou respostas no Supabase nesta versao.

## Seguranca

- Exigir autenticacao na rota.
- Verificar a feature flag e o entitlement antes de chamar a OpenAI.
- Executar ferramentas com Supabase autenticado, nunca com service role.
- Limitar consultas e payloads enviados ao modelo.
- Nao habilitar web search, file search, code interpreter ou ferramentas externas.
- Orientar o modelo a responder somente com dados retornados pelas ferramentas.
- Tratar tentativas de prompt injection como texto nao confiavel.

## Areas Afetadas

- Navegacao protegida.
- Nova pagina e componentes de chat.
- API autenticada do Next.js.
- Camada server-side de consultas.
- Configuracao de ambiente.
- Schema `profiles`.
- Testes de regressao.

## Criterios de Aceite

- Usuario elegivel do Plano 3 consegue acessar `/chat` e enviar uma pergunta.
- O chat responde perguntas globais e perguntas por cliente usando dados autorizados.
- Representante do Plano 3 nao consegue consultar dados fora do escopo permitido pelo RLS.
- Usuarios sem Plano 3 nao conseguem usar a rota nem o formulario.
- Feature flag desligada impede chamadas a OpenAI.
- O modelo nao recebe SQL livre nem acesso direto ao banco.
- Historico local recente permite perguntas de continuidade durante a sessao.
- Nova conversa limpa o historico local.
- `npm test`, `npm run typecheck` e `npm run build` passam.

## Fora de Escopo

- Persistencia de conversas.
- Streaming de tokens.
- Painel interno para aprovar planos.
- Atualizacao automatica de `subscription_plan` ao aprovar solicitacoes.
- Chat publico em links compartilhados.
- Migracao da feature atual de resumo executivo para Responses API.

## Referencias Tecnicas

- A OpenAI recomenda a Responses API para novos projetos: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Function calling permite conectar o modelo a dados e funcoes da aplicacao por schemas controlados: https://developers.openai.com/api/docs/guides/function-calling
- Conversas multi-turn podem ser mantidas enviando o historico recente a cada requisicao: https://developers.openai.com/api/docs/guides/conversation-state

## Premissas

- O Plano 3 deve ser aplicado ao lider da conta e herdado pelos representantes vinculados.
- Nesta primeira versao, a ativacao do plano sera feita manualmente no banco.
- O chat sera textual, sem anexos e sem persistencia.
- O modelo padrao prioriza custo e latencia; pode ser alterado por ambiente sem mudanca de codigo.

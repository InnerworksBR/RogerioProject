# Historico, Contexto e Markdown no Chat IA

## Contexto / Objetivo

O Chat IA atual responde perguntas usando tools server-side controladas, mas possui tres limitacoes:

1. A conversa existe somente no estado local do componente e desaparece ao recarregar a pagina.
2. Perguntas de continuidade dependem das ultimas mensagens enviadas pelo navegador, sem uma conversa persistida e enderecavel.
3. Respostas Markdown aparecem como texto cru, exibindo marcadores como `**negrito**`.

A imagem de validacao tambem revelou uma lacuna funcional: o modelo consegue consultar o resumo geral do ano, mas nao possui uma tool para ranking de clientes. Por isso, nao consegue responder corretamente perguntas como "qual e meu melhor cliente desse ano?" e falha ao tentar continuar com "pode ser".

Esta evolucao deve persistir conversas por usuario, melhorar o contexto multi-turn, renderizar Markdown com seguranca e adicionar ranking de clientes autorizado.

## Escopo Funcional

### Historico de Conversas

- Criar sidebar do chat com historico persistido.
- Listar conversas do usuario autenticado, ordenadas da mais recente para a mais antiga.
- Permitir criar uma nova conversa.
- Permitir abrir uma conversa anterior e continuar perguntando.
- Permitir excluir uma conversa propria.
- Criar automaticamente o titulo a partir da primeira pergunta, truncado para exibicao.
- Atualizar `updated_at` quando uma nova mensagem for gravada.

### Contexto Multi-turn

- O frontend enviara `conversationId` e somente a nova pergunta.
- O backend carregara do banco as mensagens recentes da conversa autenticada.
- O backend persistira a pergunta antes de chamar a OpenAI.
- O backend persistira a resposta final do assistente apos a conclusao.
- Em caso de falha da OpenAI, manter a pergunta persistida e retornar erro sem criar resposta artificial.
- Limitar o contexto enviado ao modelo as 20 mensagens mais recentes da conversa.
- Manter o limite de quatro rodadas de tools por pergunta.

### Markdown Seguro

- Renderizar respostas do assistente como Markdown.
- Suportar paragrafos, quebras de linha, listas, `**negrito**`, `*italico*`, links, codigo inline e blocos de codigo.
- Usar `react-markdown` e `remark-gfm`.
- Nao habilitar HTML bruto vindo do modelo.
- Abrir links em nova aba com `rel="noopener noreferrer"`.
- Mensagens do usuario continuam como texto simples.

### Ranking de Clientes

- Criar RPC autenticada `chat_top_clients`.
- Receber ano obrigatorio e limite controlado.
- Retornar codigo do cliente, nome, faturamento total e quantidade de pedidos.
- Aplicar o mesmo escopo comercial permitido ao usuario:
  - lider consulta os proprios dados e os dados dos representantes vinculados;
  - representante consulta somente os proprios dados.
- Adicionar tool `get_top_clients` ao chat.
- Orientar o prompt para usar `get_top_clients` ao responder perguntas como "melhor cliente", "maiores clientes" e "ranking de clientes".

## Banco de Dados

Criar migration `0011_report_chat_history.sql`.

### Tabela `report_chat_conversations`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `title TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### Tabela `report_chat_messages`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `conversation_id UUID NOT NULL REFERENCES report_chat_conversations(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `role TEXT NOT NULL CHECK (role IN ('user', 'assistant'))`
- `content TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### RLS

- Ativar RLS nas duas tabelas.
- Usuarios autenticados podem listar, criar, atualizar e excluir somente as proprias conversas.
- Usuarios autenticados podem listar e criar mensagens somente dentro das proprias conversas.
- Mensagens nao podem ser atualizadas.
- Exclusao de conversa remove mensagens por cascade.
- Revogar acesso anonimo.

### RPC `chat_top_clients`

- Criar funcao SQL autenticada e revogar execucao publica.
- Filtrar linhas de venda pelo escopo do usuario autenticado.
- Agregar faturamento e pedidos por cliente.
- Limitar o resultado entre 1 e 20 clientes.

## Backend

### Camada de Historico

- Criar `lib/server/reportChatHistory.ts`.
- Implementar funcoes para listar conversas, criar conversa, carregar conversa propria, listar mensagens recentes, inserir mensagem e excluir conversa.
- Gerar titulo localmente a partir da primeira pergunta, sem chamada extra a OpenAI.

### API

- Evoluir `app/api/ai/report-chat/route.ts`:
  - `GET`: listar conversas ou carregar mensagens de uma conversa propria.
  - `POST`: receber `{ conversationId?: string, content: string }`, criar conversa quando necessario, persistir pergunta, carregar contexto, chamar IA e persistir resposta.
  - `DELETE`: receber `{ conversationId: string }` e excluir conversa propria.
- Manter autenticacao, feature flag e entitlement do Plano 3 em todos os metodos.
- Validar UUID, tamanho da pergunta e ownership da conversa.

### Servico de IA

- Evoluir `lib/server/reportChat.ts`.
- Adicionar tool `get_top_clients`.
- Manter tools preexistentes.
- Melhorar o prompt para:
  - usar ranking quando a pergunta tratar de melhores clientes;
  - considerar mensagens anteriores para resolver continuacoes curtas;
  - responder em Markdown simples e legivel;
  - evitar oferecer uma consulta que ja pode executar diretamente.

## Frontend

- Evoluir `components/report-chat/ReportChat.tsx`.
- Criar layout com sidebar responsiva e area principal da conversa.
- Carregar historico ao abrir `/chat`.
- Abrir a conversa mais recente quando existir.
- Persistir nova conversa apos a primeira pergunta.
- Adicionar exclusao com confirmacao.
- Renderizar mensagens do assistente com componente Markdown seguro.
- Manter loading, erros, sugestoes iniciais e botao de nova conversa.

## Dependencias

- Adicionar `react-markdown`.
- Adicionar `remark-gfm`.

## Seguranca

- Nao persistir outputs intermediarios das tools.
- Nao persistir chaves, prompts de sistema ou payloads enviados a OpenAI.
- Nao renderizar HTML bruto vindo da IA.
- Executar ranking e demais consultas com escopo do usuario autenticado.
- Garantir que IDs de conversa de outro usuario retornem `404` ou acesso negado.

## Areas Afetadas

- Banco de dados Supabase.
- API do chat.
- Servico de IA.
- Interface `/chat`.
- Dependencias npm.
- Testes de regressao.

## Criterios de Aceite

- Conversas permanecem disponiveis apos recarregar a pagina.
- Usuario consegue criar, reabrir, continuar e excluir uma conversa propria.
- Usuario nao consegue ler nem excluir conversa de outro usuario.
- Pergunta "qual e meu melhor cliente desse ano?" usa ranking e retorna cliente sustentado pelos dados.
- Pergunta curta de continuidade, como "pode ser", recebe contexto da conversa persistida.
- Respostas com `**negrito**`, `*italico*` e listas sao renderizadas corretamente.
- HTML bruto retornado pelo modelo nao e executado.
- `npm test`, `npm run typecheck`, `npm run build` e verificacao visual passam.

## Fora de Escopo

- Edicao de mensagens.
- Compartilhamento de conversas.
- Streaming de tokens.
- Busca textual no historico.
- Renomeacao manual de conversa.
- Persistencia dos resultados intermediarios das tools.

## Premissas

- Historico pertence ao usuario que iniciou a conversa, mesmo quando ele for representante.
- O titulo automatico usa a primeira pergunta truncada, sem consumo adicional de IA.
- A sidebar exibira inicialmente as 30 conversas mais recentes.
- O contexto enviado a OpenAI usara as 20 mensagens mais recentes.

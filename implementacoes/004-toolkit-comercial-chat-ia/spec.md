# Toolkit Comercial Completo para o Chat IA

## Contexto / Objetivo

O Chat IA ja possui ferramentas controladas para anos disponiveis, busca de clientes, resumo geral, base de compra, dashboard por cliente e ranking de clientes. A validacao revelou uma nova lacuna:

- a IA retornou corretamente o ranking de clientes;
- ao receber a continuacao "como faco para aumentar ainda mais o faturamento do primeiro cliente?", tentou buscar o dashboard usando uma referencia incorreta;
- o dashboard retornou vazio mesmo com o cliente presente no ranking.

O problema nao deve ser resolvido liberando SQL livre. A evolucao deve criar um toolkit comercial fechado, seguro e amplo o suficiente para responder as principais perguntas de vendas, produtos, clientes e representantes.

## Principios

- Todas as tools executam consultas predefinidas.
- Nenhuma tool aceita SQL, nomes de tabelas, colunas arbitrarias ou operadores livres.
- Toda consulta respeita o escopo do usuario autenticado:
  - lider consulta os proprios dados e dados dos representantes vinculados;
  - representante consulta somente os proprios dados.
- Toda entidade retornada deve incluir identificadores canonicos reutilizaveis nas proximas tools.
- Resultados enviados ao modelo devem ser agregados, limitados e adequados para analise comercial.

## Toolkit de Tools

### Tools Existentes Mantidas

1. `list_available_years`
2. `find_clients`
3. `get_dashboard_summary`
4. `get_base_purchase_report`
5. `get_client_dashboard`
6. `get_top_clients`

### Tools Novas

1. `resolve_client`
   - Entrada: `query`.
   - Busca por codigo exato, nome exato ou parte do nome.
   - Retorna correspondencia canonica `{ codCliente, nomeCliente }`.
   - Quando houver mais de uma correspondencia plausivel, retorna lista curta para desambiguacao.
   - Deve ser usada antes de abrir dashboard quando a referencia vier de texto livre.

2. `get_top_products`
   - Entrada: `year`, `limit`, filtros opcionais de cliente, semestre e tipo de receita.
   - Retorna produtos com codigo, descricao, faturamento, unidades e quantidade de pedidos.
   - Permite responder melhores produtos, produtos mais vendidos e mix de um cliente.

3. `get_sales_trend`
   - Entrada: intervalo de anos e filtros opcionais de cliente e produto.
   - Retorna serie agregada por ano e mes com faturamento, unidades e pedidos.
   - Permite comparar periodos, identificar crescimento, queda e sazonalidade.

4. `get_recent_orders`
   - Entrada: `codCliente`, limite.
   - Retorna pedidos recentes agregados com data, codigo, faturamento, unidades e produtos em destaque.
   - Permite responder ultima compra, frequencia recente e preparacao de visita.

5. `get_inactive_clients`
   - Entrada: `referenceDate`, `inactiveDays`, limite.
   - Retorna clientes sem compra desde o corte, com ultima compra, faturamento historico e dias sem pedido.
   - Permite responder clientes parados e oportunidades de reativacao.

6. `get_rep_performance`
   - Entrada: `year`, limite.
   - Retorna ranking de representantes com email, faturamento, pedidos e clientes.
   - Disponivel apenas para lideres; representante recebe somente a propria linha ou indisponibilidade controlada.

7. `get_client_product_opportunities`
   - Entrada: `codCliente`, `year`.
   - Reutiliza dashboard autorizado e retorna produtos em queda, produtos em crescimento, principais itens, insights e produtos sem recompra.
   - Permite recomendar acoes para aumentar faturamento de um cliente.

## Banco de Dados

Criar migration `0012_report_chat_commercial_tools.sql`.

### Funcao Auxiliar

- Criar `chat_can_read_sales_owner(p_owner_id UUID) RETURNS BOOLEAN`.
- Centralizar a regra de escopo comercial do usuario autenticado.
- Usar `SECURITY DEFINER`, `SET search_path = public`, revoke de `PUBLIC` e grant somente para `authenticated`.

### RPCs

Criar RPCs autenticadas:

- `chat_resolve_client(p_query TEXT, p_limit INT DEFAULT 8)`
- `chat_top_products(p_ano INT, p_cod_cliente TEXT DEFAULT NULL, p_semestre INT DEFAULT NULL, p_descr_hist_financ TEXT DEFAULT NULL, p_limit INT DEFAULT 10)`
- `chat_sales_trend(p_start_year INT, p_end_year INT, p_cod_cliente TEXT DEFAULT NULL, p_cod_referencia TEXT DEFAULT NULL)`
- `chat_recent_orders(p_cod_cliente TEXT, p_limit INT DEFAULT 10)`
- `chat_inactive_clients(p_reference_date DATE, p_inactive_days INT DEFAULT 90, p_limit INT DEFAULT 10)`
- `chat_rep_performance(p_ano INT, p_limit INT DEFAULT 10)`

Tambem atualizar `chat_top_clients` para reutilizar a regra central de escopo.

### Limites

- Limites numericos devem ser restringidos no SQL e no TypeScript.
- Intervalo de tendencia limitado a no maximo cinco anos.
- Busca de clientes limitada a oito resultados.
- Rankings e pedidos limitados a no maximo vinte resultados.
- Clientes inativos limitados a no maximo vinte resultados.

## Backend

### Camada de Dados

- Evoluir `lib/server/reportData.ts` com wrappers tipados para todas as RPCs.
- Normalizar valores numericos antes de enviar resultados ao modelo.
- Preservar codigos canonicos de clientes e produtos.

### Servico de IA

- Evoluir `lib/server/reportChat.ts`.
- Registrar schemas estritos para todas as tools.
- Adicionar validacao local de argumentos.
- Aumentar `MAX_TOOL_ROUNDS` de 4 para 6 para permitir encadeamentos seguros:
  - listar ano mais recente;
  - obter ranking;
  - resolver cliente;
  - carregar oportunidades;
  - responder.
- Manter limite total de resultados por tool.
- Melhorar o prompt:
  - reutilizar identificadores canonicos retornados pelas tools;
  - nunca passar nome livre para `get_client_dashboard`;
  - usar `resolve_client` quando houver somente nome ou referencia textual;
  - usar `get_client_product_opportunities` para sugestoes de aumento de faturamento;
  - executar consultas diretamente quando possivel, sem pedir permissao desnecessaria;
  - solicitar esclarecimento somente em caso real de ambiguidade.

### Tratamento de Erros

- Se cliente nao for encontrado, usar `resolve_client`.
- Se houver multiplos clientes plausiveis, pedir ao usuario escolher entre as opcoes retornadas.
- Se uma tool retornar vazio, explicar a ausencia de dados e tentar uma tool de resolucao quando aplicavel.
- Erro de uma tool nao deve expor detalhes internos do banco.

## Cobertura de Perguntas

O toolkit deve permitir responder, entre outras:

- Qual foi meu melhor cliente em 2026?
- Como aumentar o faturamento do primeiro cliente?
- Quais clientes estao sem comprar ha mais de 90 dias?
- Quais produtos mais faturaram neste semestre?
- Qual produto caiu mais em relacao ao ano anterior?
- Como evoluiu o faturamento deste cliente nos ultimos tres anos?
- Qual foi a ultima compra do cliente X?
- Quais representantes mais faturaram?
- Quais produtos devo oferecer ao cliente X na proxima visita?
- Qual foi o melhor mes do ano?
- Quantos pedidos e clientes ativos tivemos no periodo?

## Seguranca

- Revogar execucao publica de todas as RPCs.
- Conceder execucao somente a `authenticated`.
- Nao usar service role no chat.
- Nao enviar linhas brutas completas de vendas para a OpenAI.
- Nao permitir consultas arbitrarias.
- Nao expor dados de outros lideres ou representantes fora do escopo.

## Areas Afetadas

- Migrations Supabase.
- Camada server-side de dados.
- Servico de IA do chat.
- Testes de regressao.

## Criterios de Aceite

- Pergunta sobre melhor cliente retorna ranking autorizado.
- Pergunta de continuidade sobre como aumentar faturamento do primeiro cliente resolve o codigo canonico e retorna oportunidades reais.
- Perguntas sobre produtos, tendencias, pedidos recentes, inatividade e representantes usam tools adequadas.
- Lider ve dados consolidados da equipe.
- Representante nao ve dados de outros representantes.
- Nenhuma tool aceita SQL livre.
- `npm test`, `npm run typecheck` e `npm run build` passam.

## Fora de Escopo

- Tool generica de SQL.
- Escrita de dados comerciais pelo chat.
- Integracao com CRM externo.
- Projecoes financeiras preditivas.
- Busca semantica com embeddings.
- Dashboard administrativo para configurar tools.

## Premissas

- A migration `0011_report_chat_history.sql` sera aplicada antes de `0012`.
- A resposta continua textual em Markdown.
- O modelo continuara configuravel por `AI_REPORT_CHAT_MODEL`.
- As tools cobrem analise comercial operacional; perguntas fora desse dominio devem ser recusadas educadamente.

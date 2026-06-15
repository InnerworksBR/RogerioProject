# Hardening de Seguranca, Performance e Preparacao para Deploy

## Contexto / Objetivo

A auditoria pre-deploy encontrou bloqueadores de seguranca, integridade e custo operacional. O banco remoto possui aproximadamente 314 mil linhas de vendas e ja demonstrou impacto mensuravel:

- uma chamada sem sessao conseguiu listar anos disponiveis;
- uma chamada sem sessao conseguiu listar 874 clientes em aproximadamente 4,4 segundos;
- RPCs antigas de ranking puderam ser iniciadas anonimamente e atingiram timeout;
- links publicos de cliente carregam linhas brutas de todos os anos, embora o link registre um ano especifico;
- uploads podem ser repetidos ou finalizados com contagem informada pelo navegador;
- chamadas de IA nao possuem rate limit, timeout ou teto total de tools;
- a exclusao de representantes executa operacoes destrutivas em sequencia sem transacao;
- a aplicacao nao envia headers HTTP defensivos;
- `npm audit --omit=dev` identifica vulnerabilidade moderada no `postcss` transitivo do Next.js.

Esta implementacao deve resolver os bloqueadores antes do deploy e deixar validacoes repetiveis para impedir regressao.

## Principios

- Aplicar menor privilegio no banco: nenhuma RPC comercial pode ser executada por `PUBLIC` ou `anon`.
- Nao confiar em valores derivados enviados pelo navegador.
- Nao enviar linhas brutas de vendas para paginas publicas ou para a OpenAI quando agregados forem suficientes.
- Controlar consumo de recursos por usuario, endpoint e janela de tempo.
- Preservar RLS e escopo comercial existente:
  - lider consulta os proprios dados e os representantes vinculados;
  - representante consulta somente os proprios dados;
  - link publico consulta somente a apresentacao explicitamente compartilhada.
- Fazer mudancas incrementais, testaveis e reversiveis.

## Escopo

### 1. Hardening de Privilegios SQL

Criar migration `0013_production_security_hardening.sql`.

#### Revokes Obrigatorios

- Revogar `EXECUTE` de `PUBLIC` e `anon` em todas as RPCs da aplicacao, incluindo assinaturas antigas e atuais:
  - `mes_abrev`
  - `tabela_dinamica_geral`
  - `base_de_compra`
  - `base_de_itens`
  - `bagagitos`
  - `geral`
  - `dashboard_summary`
  - `get_distinct_years`
  - `get_distinct_clients`
  - `product_catalog`
  - `configured_report_rows`
  - `get_rep_ranking`
  - `get_client_ranking`
  - `get_effective_subscription_plan`
  - RPCs `chat_*`
- Conceder `EXECUTE` somente para `authenticated` nas assinaturas efetivamente usadas.
- Revogar por padrao a execucao publica de novas funcoes criadas pelo papel dono das migrations:
  - `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`.

#### Funcoes `SECURITY DEFINER`

- Recriar `get_rep_ranking` e `get_client_ranking` com `SET search_path = public, pg_temp`.
- Revisar todas as funcoes `SECURITY DEFINER` existentes para garantir:
  - `search_path` explicito;
  - validacao por `auth.uid()`;
  - retorno limitado quando aplicavel;
  - ausencia de SQL dinamico;
  - revoke de `PUBLIC`.

#### Regressao

- Adicionar teste remoto controlado com chave anonima.
- Confirmar que tabelas comerciais e RPCs protegidas retornam `42501` ou equivalente sem sessao.
- Confirmar que `authenticated` continua executando relatorios autorizados.

### 2. Compartilhamento Publico Minimo

Evoluir `lib/server/shareLinks.ts`, `/api/share/data` e `/shared/client/[token]`.

- Manter token opaco aleatorio, hash SHA-256, expiracao e revogacao.
- Eliminar o retorno de `rows` brutas na API publica.
- Consultar somente os periodos necessarios:
  - ano compartilhado;
  - ano anterior, apenas quando necessario para comparativos;
  - agregados historicos minimos para LTV e anos ativos, sem expor pedidos individuais.
- Construir a apresentacao no servidor e enviar ao navegador um DTO publico limitado.
- Nao expor `preco_unitario`, codigos internos de pedido ou historico completo.
- Retornar erro generico ao cliente e registrar detalhes somente no servidor.
- Validar existencia do ano solicitado ao criar link.
- Aplicar rate limit ao endpoint publico por token e origem de rede anonimizada.
- Remover dependencia externa de `grainy-gradients.vercel.app`, servindo o asset localmente.

### 3. Upload Idempotente e Com Quotas

Criar migration `0014_upload_integrity.sql` e evoluir `/api/upload`.

#### Banco

- Criar tabela `upload_chunks` com:
  - `upload_id`
  - `user_id`
  - `chunk_index`
  - `row_count`
  - `created_at`
- Criar unicidade em `(upload_id, chunk_index)`.
- Criar unicidade segura de fingerprint por usuario para evitar corrida entre uploads iguais.
- Criar RPC autenticada e transacional para registrar chunk uma unica vez.
- Criar RPC autenticada e transacional para finalizar upload calculando `row_count` no banco.
- Revogar `PUBLIC` e `anon` nas novas RPCs.

#### API

- Receber `chunkIndex` e `totalChunks`.
- Rejeitar chunk repetido de forma idempotente.
- Validar UUID, tamanho de strings, formato de datas, intervalo de periodo e limites numericos.
- Impor quotas configuraveis:
  - tamanho maximo por arquivo;
  - maximo de linhas por chunk;
  - maximo de linhas por upload;
  - maximo de uploads em processamento por usuario;
  - limite de requisicoes por janela.
- Nao aceitar `total_rows` calculado pelo navegador como fonte de verdade.
- Tratar erro de limpeza explicitamente.

### 4. Controle de Custo e Resiliencia da IA

Evoluir `lib/server/reportChat.ts`, `/api/ai/report-chat`, `lib/server/aiSummary.ts` e `/api/ai/report-summary`.

- Manter no maximo seis rodadas de tools para suportar encadeamentos comerciais.
- Adicionar teto absoluto de chamadas de tools por pergunta.
- Limitar quantidade de function calls processadas em cada rodada.
- Adicionar timeout com `AbortController` para OpenAI e consultas sensiveis.
- Definir limite de output do modelo.
- Limitar tamanho da resposta persistida.
- Aplicar rate limit atomico por usuario:
  - chat por minuto e por dia;
  - resumo executivo por minuto e por dia;
  - uploads por minuto.
- Retornar resposta controlada `429` com mensagem amigavel.
- Nao usar service role no chat.
- Nao registrar prompts, respostas completas ou chaves em logs.
- Manter feature flags para desligamento imediato.

### 5. Offboarding Seguro de Representantes

Criar migration `0015_rep_offboarding.sql` e evoluir `/api/admin/reps`.

- Substituir a exclusao destrutiva sequencial por fluxo idempotente:
  1. bloquear login do representante;
  2. registrar operacao de offboarding;
  3. transferir vendas e uploads em transacao;
  4. remover ou revogar dados dependentes conforme politica definida;
  5. excluir usuario Auth somente apos sucesso da fase transacional;
  6. permitir retry seguro se a exclusao Auth falhar.
- Preferir desativacao logica quando exclusao definitiva nao for obrigatoria.
- Nao deixar vendas ou uploads sem proprietario.
- Paginar o enriquecimento de representantes ou buscar somente IDs necessarios, evitando `listUsers()` global sem paginacao.

### 6. Headers HTTP e Configuracao de Producao

Evoluir `next.config.ts`.

- Desabilitar `poweredByHeader`.
- Adicionar headers:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `X-Frame-Options: DENY`
- Preparar `Strict-Transport-Security` para ambiente HTTPS.
- Validar CSP com fontes do Next.js, Supabase e recursos locais realmente usados.
- Centralizar validacao de `Origin` para rotas mutaveis autenticadas como defesa adicional contra CSRF.
- Criar `.env.example` sem segredos e checklist de variaveis de producao.
- Rotacionar chaves que tenham sido expostas durante desenvolvimento antes do deploy.

### 7. Performance de Consultas

Criar migration `0016_report_query_optimizations.sql`.

- Reaplicar e validar os indices da migration `0012_report_chat_commercial_tools.sql`.
- Retestar `chat_inactive_clients` no remoto.
- Substituir busca que carrega todos os clientes e filtra em Node por RPC paginada e limitada.
- Criar RPCs agregadas para o dashboard de cliente:
  - resumo anual;
  - comparativo com ano anterior;
  - tendencia mensal;
  - top produtos;
  - pedidos recentes somente quando solicitados.
- Evitar carregar todo o historico bruto do cliente na abertura do dashboard.
- Revisar as RPCs `chat_*` que chamam `chat_can_read_sales_owner` por linha e preferir CTE ou join de proprietarios autorizados.
- Medir tempo das consultas principais com a base remota antes e depois.

### 8. Dependencias e Supply Chain

- Atualizar dependencias compativeis em lote pequeno.
- Tratar a vulnerabilidade transitiva `postcss < 8.5.10`:
  - preferir versao oficial do Next.js que inclua correcao;
  - usar override somente se validado por build, testes e smoke test;
  - nao aplicar downgrade automatico sugerido pelo `npm audit`.
- Executar `npm audit --omit=dev` ao final.
- Registrar risco residual caso a correcao oficial ainda nao esteja disponivel.

## Areas Afetadas

- Migrations Supabase.
- RLS e privilegios SQL.
- API publica de compartilhamento.
- API e worker de upload.
- API e servicos de IA.
- API administrativa de representantes.
- Dashboard compartilhado e dashboard autenticado.
- Configuracao Next.js.
- Dependencias npm.
- Testes automatizados e checklist de deploy.

## Estrategia de Rollout

1. Aplicar revokes emergenciais da migration `0013`.
2. Validar chamadas anonimas no remoto.
3. Publicar compartilhamento minimo e upload idempotente.
4. Ativar limites de IA e headers defensivos.
5. Publicar offboarding transacional e otimizacoes de consulta.
6. Executar smoke test autenticado, teste publico e auditoria final.
7. Rotacionar chaves e configurar variaveis no ambiente de deploy.

## Criterios de Aceite

- Nenhuma RPC comercial retorna dados ou inicia consulta pesada com chave anonima.
- Link publico nao entrega linhas brutas nem anos fora do escopo permitido.
- Reenvio do mesmo chunk nao duplica vendas.
- Contagem final do upload e calculada no banco.
- Chat e resumo executivo possuem rate limit, timeout e limite de output.
- Exclusao ou desativacao de representante nao deixa estado parcial.
- Headers defensivos aparecem nas respostas HTTP.
- `chat_inactive_clients` responde sem timeout no remoto.
- Busca de clientes nao carrega toda a lista para filtrar em Node.
- `npm test`, `npm run typecheck`, `npm run build`, `git diff --check` e `npm audit --omit=dev` passam ou possuem risco residual documentado.
- Smoke tests autenticados e publicos passam antes da publicacao.

## Fora de Escopo

- Troca de provedor de autenticacao.
- Reescrita completa do dashboard.
- Streaming do chat.
- CRM externo.
- Observabilidade paga obrigatoria.
- Exclusao automatica retroativa de dados comerciais.

## Premissas

- Migrations `0009` a `0012` serao aplicadas e validadas antes das novas migrations.
- A aplicacao continuara usando Supabase e Next.js.
- O deploy ocorrera somente apos aprovacao dos bloqueadores P0.
- Chaves secretas serao configuradas no ambiente de deploy e nunca commitadas.


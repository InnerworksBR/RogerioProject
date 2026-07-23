---
id: "017"
title: "Orquestração e controle de consumo do Supabase"
status: approved
priority: high
risk: high
created_at: 2026-07-23
updated_at: 2026-07-23
owner: ai-agent
depends_on: ["009", "016"]
requirements: ["RF-001", "RF-002", "RF-003", "RF-004", "RF-005", "RF-006"]
---

# Especificação

## Objetivo e escopo

Reduzir o fan-out, o volume transferido e a falta de visibilidade das consultas do Autimex Reports ao Supabase, aplicando a arquitetura alvo registrada em `docs/architecture/autimex-supabase-current-vs-target.html` sem alterar os números dos relatórios nem exigir infraestrutura externa nova.

O escopo cobre:

- centralização das leituras da tela `/reports` em um BFF autenticado do Next.js;
- uma resposta de bootstrap para metadados, resumo e relatório da aba inicial;
- cache/deduplicação no cliente com TanStack Query, já instalado no projeto;
- apenas a aba ativa consultando dados, com cancelamento de requisições obsoletas;
- invalidação explícita do cache após upload concluído;
- resumo de IA sob demanda, em vez de automático a cada montagem ou troca de cliente/ano;
- telemetria estruturada de duração, quantidade de linhas, resultado e origem da consulta;
- limites explícitos de payload e remoção dos fallbacks de 10.000 linhas nos caminhos quentes de filtros.

## Fora de escopo

- Redis, Upstash, Vercel KV ou outro cache distribuído pago;
- materialized views, mudança de plano Supabase ou aplicação de migrations no ambiente remoto;
- alteração das fórmulas de relatórios, RLS, escopo de tenants ou definição de “Total de Pedidos”;
- reescrita dos fluxos de chat, compartilhamento público, administração ou CRUD de configuração;
- deploy externo e configuração de dashboards/alertas no painel Supabase.

## Requisitos e critérios

### RF-001 — BFF de relatórios

As leituras da tela `/reports` devem passar por Route Handlers autenticados e por uma camada `server-only`; os componentes de relatório não podem importar ou instanciar o cliente Supabase do navegador.

- **CA-001:** busca estática confirma ausência de `getSupabaseClient`, `.rpc(` e `.from(` nos componentes da tela `/reports` e suas views.
- **CA-002:** entradas de relatório, ano, cliente, produto, semestre e receita são validadas por allowlist e limites antes de chegar ao Supabase.

### RF-002 — Bootstrap e eliminação de fan-out duplicado

A abertura de `/reports` deve obter em uma resposta coordenada: anos, opções iniciais limitadas, resumo de KPI e dados da aba inicial. `get_distinct_years` não pode ser disparado por cada view.

- **CA-003:** somente o contêiner da tela controla anos e aba ativa; `useEnsureReportYears` deixa de existir nas cinco views.
- **CA-004:** teste de contrato comprova uma chamada HTTP de bootstrap para a carga inicial, sem chamadas paralelas independentes das views.

### RF-003 — Cache, deduplicação e invalidação

TanStack Query deve fornecer cache privado no navegador, deduplicação de requisições em voo, chaves completas por relatório/filtros e cancelamento via `AbortSignal`.

- **CA-005:** consultas idênticas concorrentes compartilham uma execução e visitas repetidas dentro do `staleTime` não consultam novamente.
- **CA-006:** upload finalizado invalida as chaves `reports`, incluindo anos e opções; a visita seguinte refaz o bootstrap.
- **CA-007:** falha de uma consulta não remove o último resultado válido da tela.

### RF-004 — IA sob demanda

O resumo executivo com IA deve ser solicitado apenas por ação explícita do usuário e reutilizado enquanto ano/cliente não mudarem.

- **CA-008:** montar `/reports` ou mudar filtros não envia automaticamente `POST /api/ai/report-summary`.
- **CA-009:** o usuário consegue gerar e regenerar o resumo; estados de carregamento, indisponibilidade e rate limit permanecem tratados.

### RF-005 — Limites e contratos de payload

Consultas para UI devem retornar somente campos necessários e possuir limite explícito. Catálogos devem ser filtrados no banco; nenhum fallback do caminho quente pode ler 10.000 linhas brutas.

- **CA-010:** clientes e produtos usam busca limitada e debounced; tipos de receita usam resposta distinta e limitada do servidor.
- **CA-011:** cada resposta informa `rowCount` e `truncated`; truncamento é visível e não é apresentado como conjunto completo.
- **CA-012:** exportação consolidada preserva o comportamento atual, mas permanece separada da carga automática da UI.

### RF-006 — Observabilidade e evidência

Cada operação do orquestrador deve emitir log estruturado sem PII com `operation`, `durationMs`, `rowCount`, `status`, `cacheStatus` e identificador de requisição.

- **CA-013:** testes garantem que logs não incluem token, e-mail, nome ou código de cliente/produto.
- **CA-014:** uma medição reproduzível compara o fan-out lógico antes/depois; o caminho frio de `/reports` deve ficar abaixo da estimativa atual de 13–17 operações Supabase ou documentar precisamente o impedimento remoto.

### Critérios globais

- **CA-015:** `npm test`, `npm run typecheck` e `npm run build` passam.
- **CA-016:** erros permanecem genéricos para o cliente e detalhados somente no log servidor.
- **CA-017:** nenhuma migration, dependência nova ou alteração destrutiva é introduzida.

## Restrições

- Seguir as APIs documentadas em `node_modules/next/dist/docs/` para Next.js 16.2.6.
- Preservar as mudanças locais já existentes no worktree, especialmente em `proxy.ts` e autenticação.
- Não cachear dados de um usuário sob chave reutilizável por outro usuário.
- Cache compartilhado entre instâncias fica para uma implementação futura que aprove infraestrutura e custo explicitamente.
- O BFF deve usar o cliente Supabase autenticado do request; não usar `service_role` para relatórios privados.

## Riscos

- **Alto — isolamento de tenant:** chave incompleta pode vazar dados. Mitigação: cache principal no navegador autenticado e nenhum cache servidor compartilhado entre usuários nesta fase.
- **Alto — regressão numérica:** centralização pode alterar parâmetros. Mitigação: testes de contrato e reutilização das funções `lib/server/reportData.ts`.
- **Médio — BFF adicionar autenticações:** Route Handlers adicionam custo de auth. Mitigação: bootstrap agregado, IA sob demanda e medição do número real de operações.
- **Médio — truncamento:** limites podem ocultar linhas. Mitigação: indicador `truncated`, UI explícita e exportação separada.
- **Médio — worktree sujo:** arquivos de auth/proxy possuem mudanças do usuário. Mitigação: evitar esses arquivos salvo necessidade comprovada; nunca sobrescrever alterações existentes.

## Estado de aprovação

**Aprovada em 2026-07-23 pelo usuário nesta tarefa do Codex.** A execução está autorizada dentro do escopo acima; novos gastos, migrations, mudanças de autorização ou infraestrutura continuam sujeitos a um novo gate.

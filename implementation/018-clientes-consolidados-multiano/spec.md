---
id: "018"
title: "Clientes consolidados, comparação multianual e confiabilidade operacional"
status: approved
priority: high
risk: high
created_at: 2026-08-05
updated_at: 2026-08-05
owner: ai-agent
depends_on: ["017"]
requirements: ["RF-001", "RF-002", "RF-003", "RF-004", "RF-005", "RF-006", "RF-007", "RF-008"]
---

# Especificação

## Objetivo e escopo

Consolidar diferentes razões sociais pertencentes ao mesmo cliente sem alterar os dados importados, permitir a comparação simultânea de vários anos e corrigir os problemas de integridade, operação e usabilidade identificados na análise funcional aprovada pelo usuário.

O escopo cobre:

- cadastro de grupos de clientes por conta, com associação reversível de códigos/razões sociais;
- aplicação da identidade consolidada em filtros, relatórios, KPIs, rankings, painel de cliente, compartilhamento e IA;
- seleção de até quatro anos simultâneos na interface e exportação explícita de todos os anos selecionados;
- configuração comercial única por conta, mantida pelo líder e consumida pelos representantes;
- compartilhamento com o mesmo escopo de dados do criador e sem contagens restritas incorretamente ao `user_id` do líder;
- exportação completa separada do limite visual e totais claramente marcados quando a tela estiver truncada;
- upload com confirmação de substituição, resultado por arquivo, detalhes de linhas ignoradas e exclusão confirmada pelo usuário;
- home com indicadores reais sem chamada automática de IA;
- acessibilidade, redução de movimento e redirecionamento das rotas legadas para a experiência consolidada.

## Fora de escopo

- alteração ou fusão dos códigos originais em `sales_records`;
- deduplicação automática de clientes por similaridade de nome;
- deploy, aplicação remota de migrations ou exclusão automática de dados existentes;
- dependência nova, serviço externo, cobrança ou infraestrutura adicional;
- redesenho completo da identidade visual.

## Requisitos e critérios

### RF-001 — Identidade consolidada de clientes

- **CA-001:** líder consegue criar, renomear, associar e desassociar um grupo usando clientes existentes na conta.
- **CA-002:** um código pertence a no máximo um grupo por conta; operações de outra conta são bloqueadas por RLS.
- **CA-003:** filtros e consultas aceitam chaves canônicas sem modificar códigos e nomes importados.

### RF-002 — Consistência analítica do cliente consolidado

- **CA-004:** KPIs, relatórios, rankings, painel de cliente, compartilhamento e contexto de IA somam todos os membros do grupo.
- **CA-005:** clientes não agrupados continuam disponíveis e produzem os mesmos números anteriores.

### RF-003 — Comparação multianual

- **CA-006:** usuário seleciona de um a quatro anos simultaneamente; o estado nunca fica sem ano válido quando há anos disponíveis.
- **CA-007:** as cinco visões exibem o ano de cada linha/total e KPIs comparáveis por ano.
- **CA-008:** URL, cache e exportação diferenciam a lista ordenada de anos.

### RF-004 — Escopo comercial e compartilhamento

- **CA-009:** configuração de relatórios é única por conta, escrita pelo líder e lida pelos representantes.
- **CA-010:** compartilhamento reproduz o escopo do criador e suporta cliente consolidado sem vazamento entre contas.

### RF-005 — Exportação e totais confiáveis

- **CA-011:** exportação explícita busca até 100.000 linhas independentemente do limite visual.
- **CA-012:** tabela truncada não apresenta soma parcial como total completo.

### RF-006 — Operação de uploads

- **CA-013:** substituições exatas e sobreposições parciais exigem confirmação informada.
- **CA-014:** fila mostra resultado de cada arquivo e histórico expõe linhas ignoradas em português.
- **CA-015:** usuário pode excluir uma importação própria somente após confirmação explícita na interface.

### RF-007 — Home, navegação e acessibilidade

- **CA-016:** home mostra KPIs reais e não chama IA automaticamente.
- **CA-017:** navegação informa página atual; controles têm nomes acessíveis, progresso semântico e suporte a `prefers-reduced-motion`.
- **CA-018:** rotas individuais antigas redirecionam para `/reports`.

### RF-008 — Qualidade e entrega

- **CA-019:** migration é aditiva e documenta rollback operacional.
- **CA-020:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check` passam.

## Restrições

- Seguir a documentação embarcada do Next.js 16.3.0 em `node_modules/next/dist/docs/`.
- Preservar dados de venda e configurações históricas; políticas novas podem deixar configurações antigas de representantes inativas, sem apagá-las.
- Não usar `service_role` para relatórios privados; compartilhamento público usa apenas o resolvedor servidor já autorizado.
- Não executar migration ou deploy remoto nesta implementação.
- Tratar a aprovação do usuário em 2026-08-05 — “OK, FAÇA AS IMPLEMENTAÇÕES PARA RESOLVER TUDO ISSO” — como aprovação explícita deste escopo derivado da análise imediatamente anterior.

## Riscos

- **Alto — isolamento de conta:** grupo canônico mal escopado pode misturar tenants. Mitigação: `account_owner_id`, RLS e chaves compostas.
- **Alto — regressão numérica:** filtros canônicos e múltiplos anos podem alterar totais. Mitigação: preservar clientes simples, executar cada ano nas RPCs existentes e cobrir contratos.
- **Alto — autorização:** configuração passa a ser do líder. Mitigação: políticas explícitas de leitura da conta e escrita apenas pelo owner.
- **Médio — volume de exportação:** 100.000 linhas podem ser pesadas. Mitigação: ação explícita, limite rígido e erro claro ao exceder.
- **Médio — migração não aplicada:** código novo depende do schema. Mitigação: ordem de deploy documentada e falhas normalizadas.

## Estado de aprovação

**Aprovada explicitamente pelo usuário em 2026-08-05 nesta tarefa do Codex**, após receber a análise funcional completa. A autorização cobre código e migration aditiva no repositório; não cobre aplicação remota, deploy ou exclusão automática de dados.

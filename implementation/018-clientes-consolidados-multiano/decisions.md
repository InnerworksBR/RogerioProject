# Decisões

## D-001 — Dados originais permanecem imutáveis

- **Estado:** aprovado
- **Decisão:** representar consolidação em tabelas de grupo e membros; não alterar `sales_rows.cod_cliente` ou `nome_cliente`.
- **Motivo:** auditoria, reversibilidade e compatibilidade com importações futuras.

## D-002 — Chave canônica compatível

- **Estado:** aprovado
- **Decisão:** usar `group:<uuid>` para grupos e manter o código original para clientes não agrupados.
- **Motivo:** evolução aditiva sem invalidar links, filtros e registros existentes.

## D-003 — Configuração pertence ao líder da conta

- **Estado:** aprovado
- **Decisão:** considerar a linha do líder como configuração efetiva; representantes leem e apenas o líder escreve.
- **Motivo:** eliminar duplicidade e divergência de cálculo dentro da mesma equipe sem excluir configurações antigas.

## D-004 — Comparação multianual por linhas identificadas

- **Estado:** aprovado
- **Decisão:** executar as RPCs anuais atuais por ano, concatenar resultados e exibir coluna `Ano`; KPIs são retornados por ano.
- **Motivo:** reduz risco de reescrever fórmulas SQL e torna a comparação explícita em todas as visões.

## D-005 — Limites distintos para tela e exportação

- **Estado:** aprovado
- **Decisão:** tela continua limitada e sinaliza truncamento; exportação explícita possui limite rígido de 100.000 linhas.
- **Motivo:** equilibrar resposta interativa e completude operacional.

## D-006 — Migration e deploy

- **Estado:** aprovado apenas para criação no repositório
- **Decisão:** não aplicar a migration nem publicar externamente nesta tarefa.
- **Motivo:** a autorização do usuário cobre a implementação, enquanto mudanças remotas permanecem um gate separado.

## D-007 — Compatibilidade das configurações existentes

- **Estado:** aprovado pelo escopo funcional
- **Decisão:** se o líder ainda não tiver a mesma referência configurada, copiar para ele a linha mais recente encontrada entre os representantes; preservar todas as linhas originais.
- **Motivo:** ativar a configuração única da conta sem deixar relatórios vazios em equipes que cadastraram itens pelo acesso de representante.

## Aprovação

Escopo aprovado explicitamente pelo usuário em 2026-08-05 após a análise funcional completa.

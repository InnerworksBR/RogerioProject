# Autimex Reports

Sistema comercial para importar planilhas de vendas, acompanhar indicadores, analisar clientes e gerar relatórios em Excel. A aplicação usa Next.js 16, React 19, Supabase/PostgreSQL e TanStack Query.

## Funcionalidades principais

- upload de arquivos `.xls` e `.xlsx`, com validação, confirmação de sobreposição/substituição, resultado por arquivo e histórico removível;
- indicadores comerciais e rankings na página inicial, sem consumo automático de IA;
- cinco relatórios reunidos em `/reports`, com filtros por cliente, produto, semestre, tipo de receita e comparação de até quatro anos;
- exportação explícita com consulta completa ao servidor, limitada a 100.000 linhas e sem reutilizar o recorte da tela;
- clientes consolidados: várias razões sociais podem representar um único cliente comercial sem alterar os dados importados;
- painel de visita, compartilhamento público temporário e ferramentas de IA compatíveis com clientes consolidados;
- configuração única por conta: o líder administra e os representantes utilizam a mesma configuração;
- gestão de representantes, planos, conta e recuperação de senha.

## Papéis e escopo de dados

O `leader` enxerga os próprios dados e os de seus representantes, gerencia grupos de clientes, configurações e equipe. O `rep` trabalha com seu escopo comercial e lê os grupos/configurações definidos pelo líder.

Um cliente consolidado possui a chave `group:<uuid>`. Os códigos e nomes originais em `sales_rows` continuam intactos. Remover um grupo apenas desfaz a associação; não exclui vendas nem clientes importados.

## Ambiente local

Requisitos:

- Node.js 20.18.1 ou superior;
- projeto Supabase com as migrations aplicadas;
- variáveis copiadas de `.env.example` para `.env.local`.

Instalação e validação:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`.

Variáveis obrigatórias:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`, somente no servidor, para administração e links públicos;
- `APP_URL`, com a origem HTTPS da aplicação em produção, usada na proteção de requisições mutáveis.

A IA é opcional. Para habilitá-la, configure `OPENAI_API_KEY` e os flags `AI_REPORT_SUMMARY_ENABLED` e/ou `AI_REPORT_CHAT_ENABLED`. As chaves secretas nunca devem usar o prefixo `NEXT_PUBLIC_`.

## Banco de dados

As migrations ficam em `supabase/migrations` e devem ser aplicadas em ordem. A entrega de clientes consolidados depende de:

```text
0023_client_groups_and_account_scope.sql
```

Essa migration é aditiva para os dados de vendas: cria `client_groups` e `client_group_members`, adiciona RLS por conta, centraliza a configuração no líder e atualiza as funções de relatório, busca, ranking, compartilhamento e IA. Quando o líder ainda não possui um item de configuração, a versão mais recente encontrada entre seus representantes é copiada para ele; as linhas antigas são preservadas. A migration não modifica `sales_rows.cod_cliente` nem `sales_rows.nome_cliente`.

A correção isolada de agregação de pedidos deve ser aplicada logo depois:

```text
0024_fix_chat_recent_orders_grouping.sql
```

Antes de aplicá-la em produção:

1. gere um backup/snapshot recuperável do banco;
2. valide a migration em um ambiente de staging com uma conta líder, um representante e outra conta isolada;
3. confira a lista/ordem das migrations no processo já adotado pelo projeto;
4. programe uma janela de baixo tráfego e monitore locks em `report_config_items` durante a troca das políticas;
5. aplique a `0023` e, em seguida, a `0024` antes de publicar o código desta versão;
6. só então execute o build e publique a aplicação.

Quando o projeto estiver vinculado ao Supabase CLI, use primeiro a inspeção/dry-run do processo da equipe e depois o comando de aplicação aprovado. Não execute uma migration de produção a partir de uma estação sem backup, vínculo e ambiente confirmados.

## Checklist de publicação

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. backup do banco
6. aplicação da migration `0023_client_groups_and_account_scope.sql`
7. smoke test autenticado no banco/aplicação
8. publicação do código
9. repetição do smoke test e observação dos logs

Smoke test mínimo:

- líder cria, edita e remove um grupo com duas razões sociais;
- representante vê o grupo e não consegue alterá-lo;
- duas contas diferentes não enxergam grupos/configurações entre si;
- filtro pelo grupo soma todos os seus códigos em relatórios, dashboard e exportação;
- seleção de dois anos mostra os dois períodos e KPIs separados;
- exportação contém mais linhas que a tela quando ela estiver truncada;
- upload repetido exige confirmação e a exclusão remove suas linhas por cascata;
- link compartilhado continua limitado ao cliente e ao período autorizados;
- home não dispara chamada de IA; IA só é executada por ação explícita.

## Rollback

Se apenas o código precisar voltar, reverta a aplicação primeiro e mantenha a migration: as novas tabelas são aditivas e os dados originais permanecem válidos.

Se também for necessário desfazer o comportamento do banco, crie uma nova migration de rollback revisada; não apague nem edite uma migration já aplicada. Essa migration deve:

1. restaurar as definições anteriores das funções e políticas de `report_config_items` a partir da versão anterior;
2. confirmar que nenhuma versão ativa da aplicação usa chaves `group:<uuid>`;
3. exportar ou preservar `client_groups` e `client_group_members` antes de removê-las;
4. remover funções auxiliares, políticas e tabelas apenas depois dessas verificações.

Excluir as tabelas de grupos perde somente as associações e nomes canônicos, mas ainda é uma operação destrutiva. Vendas importadas não devem ser removidas no rollback.

## Qualidade e segurança

Comandos disponíveis:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run audit
npm run security:probe-anon
```

`security:probe-anon` exige as variáveis públicas do Supabase e testa o projeto configurado; execute somente contra o ambiente explicitamente escolhido. Mudanças mutáveis das APIs exigem sessão autenticada, mesma origem e políticas RLS.

Os artefatos de requisitos, decisões, tarefas, testes e evidências desta entrega estão em `implementation/018-clientes-consolidados-multiano`.

# Solicitacao de Licencas por Plano

## Contexto / Objetivo

O portal ja permite que um usuario com papel `leader` convide e gerencie representantes ate o limite armazenado em `profiles.license_count`. A evolucao deve permitir que esse administrador solicite novas licencas para os seus usuarios escolhendo um dos tres planos comerciais disponiveis.

A solicitacao deve ser persistida para atendimento posterior. Criar uma solicitacao nao libera acessos automaticamente: a quantidade efetiva continua sendo controlada por `profiles.license_count`, preservando o fluxo de aprovacao comercial.

## Planos

### Plano 1

- Relatorios.
- 6 horas de suporte mensal.

### Plano 2

- Relatorios.
- Pequenas melhorias.
- 12 horas de suporte mensal.
- IA basica.

### Plano 3

- Relatorios.
- 16 horas de suporte mensal.
- Evolucao do portal.
- IA avancada com chat para consulta dos dados dos clientes.

## Requisitos Tecnicos

### Banco de Dados

- Criar migration `0009_license_requests.sql`.
- Criar tabela `license_requests` vinculada ao usuario `leader`.
- Armazenar plano escolhido, quantidade de licencas solicitadas, status, observacao opcional e datas de criacao/atualizacao.
- Restringir os planos aos valores `plan_1`, `plan_2` e `plan_3`.
- Restringir os status a `pending`, `approved`, `rejected` e `cancelled`.
- Permitir leitura e criacao somente pelo proprio lider autenticado.
- Permitir cancelamento somente de solicitacoes pendentes pertencentes ao proprio lider.
- Revogar acesso anonimo.

### Backend

- Criar rota autenticada `app/api/admin/license-requests/route.ts`.
- Reutilizar o papel `leader` como administrador da conta.
- Implementar `GET` para listar as solicitacoes do lider atual.
- Implementar `POST` para registrar uma nova solicitacao com plano, quantidade positiva e observacao opcional.
- Implementar `PATCH` para cancelar uma solicitacao pendente.
- Manter a liberacao efetiva de acessos desacoplada da solicitacao comercial.

### Frontend

- Evoluir `app/(protected)/team/page.tsx`.
- Exibir os tres planos com beneficios claros.
- Permitir selecionar um plano, informar quantidade de licencas adicionais e enviar a solicitacao.
- Exibir historico com plano, quantidade, data e status.
- Permitir cancelar solicitacoes pendentes.
- Manter a secao existente de representantes e o indicador de licencas usadas.

### Testes

- Adicionar teste de regressao para confirmar a existencia da tabela, RLS, restricoes principais e protecao da rota para lideres.
- Executar `npm test`.
- Executar `npm run typecheck`.
- Executar `npm run build`.

## Areas Afetadas

- Banco de dados Supabase.
- API autenticada do Next.js.
- Tela de gestao da equipe.
- Testes de regressao.

## Criterios de Aceite

- Um lider consegue visualizar os tres planos e seus beneficios.
- Um lider consegue solicitar uma quantidade positiva de licencas para um plano.
- A solicitacao aparece no historico como pendente.
- Um lider consegue cancelar uma solicitacao pendente.
- Uma solicitacao nao aumenta automaticamente `profiles.license_count`.
- Representantes nao conseguem criar, listar ou cancelar solicitacoes de licenca.
- Usuarios anonimos nao possuem acesso a tabela.
- O gerenciamento atual de representantes continua funcional.

## Premissas

- O usuario administrador mencionado no requisito corresponde ao papel `leader` ja existente.
- O atendimento da solicitacao, aprovacao comercial e atualizacao de `profiles.license_count` ocorrera fora desta entrega, pois o portal ainda nao possui papel de operador interno ou painel administrativo global.
- Os recursos de IA descritos nos planos sao informativos nesta etapa. O controle de acesso por plano para funcionalidades futuras sera implementado quando essas funcionalidades forem adicionadas.

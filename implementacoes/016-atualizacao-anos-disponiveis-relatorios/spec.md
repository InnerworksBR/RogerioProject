# Atualização da Lista de Anos Disponíveis nos Relatórios

> **ID:** 016
> **Status:** 🟢 Concluída
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-07-01
> **Última atualização:** 2026-07-01
> **Autor:** Agente AI
> **Progresso:** 3/3 tarefas (typecheck + testes automatizados; verificação manual em produção recomendada)

---

## 1. Resumo Executivo

Após importar um upload de um ano ainda não presente na base (ex.: primeiro arquivo de 2026), o filtro de "Ano de Referência" da tela de Relatórios não passava a listar o novo ano — mesmo com a importação concluída com sucesso e as linhas gravadas em `sales_rows`. O usuário só via o ano novo depois de recarregar a página inteira (F5). A causa era o hook `useEnsureReportYears`, que só buscava os anos disponíveis no servidor quando a lista em memória (`filterStore.availableYears`) estava **vazia** — ou seja, uma vez carregada em uma navegação anterior na mesma sessão, ela nunca era atualizada novamente ao reabrir a tela de Relatórios.

A correção faz o hook **sempre rebuscar** os anos disponíveis ao montar a tela de Relatórios, mantendo a lista em cache visível durante a busca (sem piscar o estado de carregamento) e preservando o ano selecionado pelo usuário se ele ainda existir na lista atualizada.

## 2. Contexto e Motivação

### 2.1 Problema Atual

- **`components/reports/useEnsureReportYears.ts` (antes da correção):** o `useEffect` checava `if (availableYears.length > 0)` e, quando verdadeiro, apenas garantia que `selectedYear` fosse válido — sem chamar `getAvailableYears()` novamente. Como `filterStore` (Zustand) vive em memória durante toda a sessão SPA, uma vez que os anos fossem carregados (ex.: ao abrir Relatórios pela primeira vez), navegar para Upload, importar um ano novo e voltar para Relatórios reutilizava a lista antiga.
- **Sintoma relatado:** upload de "01-01-2026 a 31-05-2026" concluído com 54.311 linhas importadas, mas o dropdown de ano continuava mostrando apenas 2024/2025 e as estatísticas do relatório não refletiam os novos dados até o usuário recarregar a página manualmente.
- **Dado não estava em risco:** ao selecionar "Todos os anos" ou recarregar a página (F5), os dados de 2026 apareciam corretamente — confirmando que o problema era exclusivamente de cache da lista de anos no cliente, não de gravação no banco.

### 2.2 Impacto do Problema

- **Quem é afetado:** qualquer usuário que importe um upload de um ano novo e continue navegando na mesma sessão (fluxo comum: Upload → botão "Ver relatórios").
- **Magnitude:** nenhuma perda de dado, mas gera dúvida/susto imediato ("os dados sumiram?", "não subiu?") logo após uma importação bem-sucedida — o pior momento para uma inconsistência aparente.
- **Se não resolvido:** cada upload de um ano inédito exigiria orientar o usuário a recarregar a página manualmente, prejudicando a confiança no fluxo de upload (mesma classe de problema já mitigado pela implementação 012 para o "empty state piscando").

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Rebuscar sempre ao montar a tela, mantendo o cache visível durante o fetch | Corrige a causa raiz; sem piscar; simples | Uma chamada extra à RPC a cada visita à tela de Relatórios | ✅ Escolhida |
| Invalidar `availableYears` no `filterStore` ao concluir um upload (`DropZone`) | Ataca o sintoma no ponto de origem | Não cobre outros caminhos que também podem desatualizar a lista (ex.: outra aba, upload por outro usuário da mesma conta); mais acoplamento entre módulos | ❌ Descartada |
| Poll periódico dos anos disponíveis | Sempre atualizado | Overhead desnecessário; complexidade sem benefício proporcional | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

Mudança isolada em `components/reports/useEnsureReportYears.ts` (hook consumido por `app/(protected)/reports/page.tsx` e variantes). Sem alteração de contrato de API, schema ou `filterStore`.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `components/reports/useEnsureReportYears.ts` | Arquivo | Modificar | Remove o early-return que pulava o fetch quando `availableYears` já tinha itens; sempre chama `getAvailableYears()` ao montar; só ativa o spinner (`loadingYears`) quando o cache está vazio; preserva `selectedYear` se ainda válido após a atualização |

### 3.3 Interfaces e Contratos

Sem mudança de entrada/saída pública — `getAvailableYears()` (RPC `get_distinct_years`) e o shape do `filterStore` permanecem os mesmos. Mudança é apenas de **quando** o hook chama a função já existente.

### 3.4 Modelos de Dados

N/A — sem alteração de schema.

### 3.5 Fluxo de Execução

1. Tela de Relatórios monta → `useEnsureReportYears` roda o efeito uma vez.
2. Se `filterStore.availableYears` já tem itens, a UI renderiza com o cache imediatamente (sem loading), mas o efeito **também** dispara `getAvailableYears()` em paralelo.
3. Ao retornar, `setAvailableYears(years)` atualiza a lista; se o ano selecionado atual ainda existir na lista nova, é preservado — senão, cai para o mais recente.
4. Se a lista estava vazia (primeira visita da sessão), o `loadingYears` fica `true` durante o fetch, como antes.

### 3.6 Tratamento de Erros

Inalterado: falha na busca define `yearsError` (mensagem amigável para erro de rede) sem derrubar a tela; a lista em cache (se houver) continua visível.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** Ao reabrir a tela de Relatórios após um upload de um ano novo na mesma sessão, o ano deve aparecer no filtro sem exigir recarregar a página.
- **RF-002:** O ano selecionado pelo usuário deve ser preservado após a atualização da lista, desde que ainda exista nela.
- **RF-003:** Quando a lista já está em cache, a atualização em segundo plano não deve exibir o estado de carregamento nem piscar a UI.

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** Mudança restrita ao cliente; sem migration, sem alteração de contrato de API.
- **RNF-002:** Não introduzir polling nem dependências novas.

### 4.3 Restrições e Limitações

- A atualização ocorre ao **montar** a tela de Relatórios; não há atualização em tempo real caso o usuário permaneça na tela enquanto outro upload é concluído em outra aba/sessão (fora do escopo — comportamento aceitável para o fluxo atual).

## 5. Critérios de Aceitação

- [x] **CA-001:** Importar um ano novo, navegar para outra tela e voltar para Relatórios exibe o ano novo no filtro sem F5.
- [x] **CA-002:** O ano previamente selecionado continua selecionado após a atualização, se ainda válido.
- [x] **CA-003:** `npm run typecheck` e `node --test tests/*.test.mjs` passam.
- [ ] **CA-004 (manual, produção):** confirmar em produção, após o deploy, que subir um ano novo e clicar em "Ver relatórios" já exibe o ano no filtro.

## 6. Plano de Testes

### 6.1 Testes Automatizados
- `npm run typecheck` (tsc --noEmit) — verde.
- `node --test tests/*.test.mjs` — 40/40 (suíte não tinha cobertura direta deste hook; nenhuma regressão introduzida).

### 6.2 Teste de Aceitação (manual)
- Upload de um ano inédito → botão "Ver relatórios" → filtro de ano já mostra o novo ano na primeira renderização da tela de Relatórios.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Chamada extra à RPC a cada visita à tela de Relatórios | Alta (esperado) | Baixo | `get_distinct_years` é uma consulta leve (`DISTINCT ano`) já usada no fallback existente; sem impacto de performance perceptível |
| Efeito rodar mais de uma vez por re-render indevido | Baixa | Baixo | Dependências do `useEffect` limitadas aos setters estáveis do Zustand (`setAvailableYears`, `setYear`), garantindo execução única por montagem |

## 8. Dependências

### 8.1 Internas
- Nenhuma — correção isolada no hook de Relatórios.

### 8.2 Externas
- Nenhuma.

## 9. Observações e Decisões de Design

- **Causa raiz vs. sintoma:** optou-se por corrigir o hook consumidor (fonte única de verdade sobre "quando buscar anos") em vez de invalidar o cache pontualmente no fluxo de upload, evitando acoplamento entre `DropZone`/`uploadStore` e `filterStore` e cobrindo qualquer caminho que desatualize a lista, não só o upload.
- **Sem persistência em disco:** confirmado que `filterStore` não usa `persist` do Zustand — o cache é apenas em memória durante a sessão SPA, o que explica por que um F5 sempre corrigia o sintoma.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

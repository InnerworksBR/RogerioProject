# Refinamento do Fluxo de Upload

> **ID:** 012
> **Status:** 🟢 Concluída
> **Prioridade:** 🟡 Média
> **Criada em:** 2026-06-15
> **Última atualização:** 2026-06-15
> **Autor:** Agente AI
> **Progresso:** 7/7 tarefas (gates automatizados; verificação manual em staging)

---

## 1. Resumo Executivo

O fluxo de upload de planilhas funciona, mas diverge do que o PRD descreve na seção "Fluxo do Usuário no Webapp" (itens 1-2) e destoa visualmente do restante do app. Quatro pontos concentram a divergência: (a) as etapas de processamento mostradas ao usuário ("Lendo e processando arquivo..." → "Salvando dados...") não correspondem às três fases visíveis especificadas no PRD ("Lendo arquivos..." → "Calculando pivot..." → "Gerando relatórios..."), e a barra de progresso "salta" porque o trecho 50→100% não tem rótulo de etapa; (b) o preview consolidado pós-drop previsto no PRD ("3 arquivos carregados: Jan 2024 – Jan 2026 | 47.832 linhas") não existe — hoje só aparece "Fila: x/y" e o período por arquivo fica escondido no histórico; (c) o redirect automático para `/reports` ocorre antes do recarregamento dos anos disponíveis, fazendo a tela piscar um empty state "Nenhum ano disponível"; e (d) `DropZone`/`UploadProgress` usam paleta `gray/blue/green/red` crua e texto "XLS", fora do design system slate/indigo/emerald/rose + `glass`, e a página usa jargão de marketing ("Motor de Dados", "Command Center") inadequado ao usuário-alvo. Esta implementação alinha o fluxo de upload ao PRD e ao design system, sem alterar a lógica de parsing nem os contratos de API.

## 2. Contexto e Motivação

### 2.1 Problema Atual

- **Etapas de processamento divergentes (`components/upload/UploadProgress.tsx:15-21`):** `STATUS_LABELS` só expõe `parsing → "Lendo e processando arquivo..."` e `uploading → "Salvando dados..."`. O PRD (item 2) pede três fases visíveis: "Lendo arquivos..." → "Calculando pivot..." → "Gerando relatórios...". Além disso, em `components/upload/DropZone.tsx:73` o progresso de parsing é dividido por 2 (`event.data.percent / 2`), cobrindo 0-50%; o trecho 50→100% vem de `store.setChunks` (`store/uploadStore.ts:51-58`), mas nenhuma fase nomeia esse intervalo, então a barra muda de origem sem rótulo e parece "saltar". O `phase: string` que o worker já emite em cada evento `progress` (`lib/xlsParser.ts:14-17,46-47`) é descartado pela UI.

- **Preview consolidado ausente (`components/upload/DropZone.tsx:123-135`):** o drop processa os arquivos em série e mostra apenas "Fila: {completedFiles}/{queuedFiles.length}" (`DropZone.tsx:167-171`) e o progresso do arquivo atual. O período detectado por arquivo (`metadata.periodStart`/`periodEnd`) só é visível depois, no `UploadHistory` (`components/upload/UploadHistory.tsx:26-28`). O PRD (item 1) pede um resumo consolidado logo após o drop com total de arquivos, período mínimo–máximo e total de linhas.

- **Redirect automático desorienta (`components/upload/DropZone.tsx:132-134`):** ao terminar a fila, o código chama `filterStore.setAvailableYears([])`, `filterStore.setYear(null)` e `router.push('/reports')` imediatamente. Como os anos são zerados, `/reports` renderiza o empty state "Nenhum ano disponível" até `useEnsureReportYears` (`components/reports/useEnsureReportYears.ts:25-55`) recarregar os anos via `getAvailableYears()`, gerando um "pisca" desorientador.

- **Fora do design system (`components/upload/DropZone.tsx:151-165`, `UploadProgress.tsx`):** `DropZone` usa `border-gray-700`, `bg-gray-900`, `text-gray-200/400`, `border-blue-500` e o título "XLS" em texto puro; `UploadProgress` usa `gray-*`, `blue-500`, `green-500`, `red-500` crus e o emoji `✓`. O restante do app usa paleta slate/indigo/emerald/rose, classes `glass`/`glass-card` e ícones Lucide.

- **Jargão de marketing (`app/(protected)/upload/page.tsx:11-17,31`):** "Motor de Dados", "Sincronização ERP", "Command Center" e "Protocolo de Ingestão" destoam do tom direto do resto do app e do usuário-alvo (vendedor/analista).

### 2.2 Impacto do Problema

- **Quem é afetado:** todos os usuários que importam planilhas (representantes e líderes) — é a primeira tela do fluxo e a porta de entrada dos dados.
- **Magnitude:** não há perda de dados, mas há perda de confiança e clareza: a barra que salta e o empty state piscando fazem o upload parecer instável; o jargão e a paleta destoante quebram a coesão visual; a ausência do preview impede o usuário de conferir rapidamente se importou o período/quantidade esperados antes de prosseguir.
- **Se não resolvido:** o produto entrega uma experiência de ingestão inconsistente com o que o PRD prometeu e com o restante da interface, aumentando dúvida e suporte ("os dados subiram?", "por que não tem nada no relatório?").

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Mapear 3 fases com rótulos e dividir a barra proporcionalmente (parse 0-50, upload 50-95, finalização 95-100), reaproveitando o `phase` já emitido pelo worker | Alinha ao PRD; barra sem saltos; reusa dado existente | Exige ajuste em `setChunks` e no mapeamento de rótulos | ✅ Escolhida |
| Manter os 2 rótulos atuais e só suavizar a animação da barra | Mínimo esforço | Continua divergente do PRD; barra ainda muda de origem sem rótulo | ❌ Descartada |
| Tornar o redirect ação explícita do usuário via botão "Ver relatórios" no card-resumo, e/ou aguardar o recarregamento dos anos antes de navegar | Elimina o "pisca"; dá ao usuário o controle e a confirmação visual do que foi importado | Um clique a mais no caminho feliz | ✅ Escolhida (botão explícito; pré-carregar anos como reforço) |
| Redirect automático mantido, apenas aguardando `getAvailableYears()` antes de navegar | Mantém o fluxo sem clique extra | Não entrega o preview do PRD; usuário não confirma o que importou | ⚠️ Adotada apenas como reforço do carregamento de anos |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

O fluxo é: `app/(protected)/upload/page.tsx` (layout e copy) → `DropZone` (orquestra drop, parse via `parseXLSFile`, envio de chunks à `/api/upload`, estado em `uploadStore`) → `UploadProgress` (barra/rótulos) → redirect para `/reports`. Toda a mudança é de UI/estado no cliente: rótulos de fase, agregação de um resumo consolidado a partir dos eventos `metadata`/`done` já emitidos pelo parser, controle do momento do redirect e migração visual para o design system. Não há alteração na lógica de parsing (`lib/xlsParser*`), nos contratos de `/api/upload`, nem no schema.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `components/upload/UploadProgress.tsx` | Arquivo | Modificar | 3 fases nomeadas; barra proporcional; paleta do tema; ícones Lucide |
| `components/upload/DropZone.tsx` | Arquivo | Modificar | Mapear fases no progresso; agregar resumo consolidado; card-resumo + botão "Ver relatórios"; redirect controlado; paleta do tema |
| `store/uploadStore.ts` | Arquivo | Modificar | Suportar a fase de finalização (95-100) e, se necessário, acumular o resumo consolidado (total de arquivos, período min–max, linhas) |
| `app/(protected)/upload/page.tsx` | Arquivo | Modificar | Substituir jargão de marketing por linguagem direta ("Upload de planilhas", "Como funciona") |
| `components/upload/UploadHistory.tsx` | Arquivo | Referência | Origem atual da exibição de período por upload; alvo de coerência visual |

### 3.3 Interfaces e Contratos

#### Entradas

- Eventos do parser (`ParseEvent` em `lib/xlsParser.ts:27-32`): `progress` (com `phase`/`percent`), `metadata` (`periodStart`, `periodEnd`, `totalRows`), `chunk`, `done` (`totalRows`), `error`.
- Estado do upload (`uploadStore`): `status`, `progress`, `currentFile`, `rowCount`, `chunksDone`, `chunksTotal`.

#### Saídas

- UI com três fases rotuladas e barra contínua (0-50 parse, 50-95 upload, 95-100 finalização).
- Card-resumo consolidado: total de arquivos, período mínimo–máximo agregado e total de linhas, com botão "Ver relatórios".

#### Contratos de API (se aplicável)

N/A — sem mudança nos contratos de `/api/upload` (PUT/POST/DELETE/GET) nem nos eventos do worker.

### 3.4 Modelos de Dados (se aplicável)

Sem alteração de schema. Possível extensão do `uploadStore` com campos derivados (ex.: `summary: { files, periodStart, periodEnd, totalRows }`) puramente client-side.

### 3.5 Fluxo de Execução

1. Usuário arrasta/seleciona 1+ arquivos; `onDrop` registra a fila.
2. Para cada arquivo: `parsing` mostra "Lendo arquivos..." (0-50%, derivado de `event.data.percent / 2`).
3. Ao receber `metadata`, cria o upload e passa para `uploading` mostrando "Calculando pivot..." (50-95%, proporcional aos chunks).
4. Na finalização do arquivo (último chunk / `done`), exibe "Gerando relatórios..." (95-100%) e acumula o resumo (incrementa contagem de arquivos, ajusta período min/max, soma linhas).
5. Ao concluir toda a fila, status `complete`: exibe o card-resumo consolidado (total de arquivos, período min–max, total de linhas) com botão "Ver relatórios".
6. O redirect para `/reports` só ocorre ao clicar "Ver relatórios"; antes (ou ao clicar), os anos disponíveis são recarregados para evitar o empty state piscando.

### 3.6 Tratamento de Erros

- Erro em um arquivo da fila mantém o comportamento atual (DELETE do upload, `store.setError`, toast) e não deve quebrar o resumo dos arquivos já concluídos.
- Se nenhum arquivo concluir com sucesso, não exibir o card-resumo (mostrar apenas o estado de erro atual).
- O botão "Ver relatórios" só fica disponível quando há pelo menos um upload concluído.
- A copy de erro permanece em paleta `rose` do tema (substituindo `red-*`).

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** A barra de progresso deve exibir três fases nomeadas conforme o PRD: "Lendo arquivos...", "Calculando pivot...", "Gerando relatórios...".
- **RF-002:** A barra deve avançar de forma contínua e proporcional (parse 0-50, upload 50-95, finalização 95-100), sem saltos perceptíveis na troca de fase.
- **RF-003:** Ao concluir a fila, deve ser exibido um card-resumo consolidado com total de arquivos, período mínimo–máximo agregado e total de linhas.
- **RF-004:** O redirect para `/reports` deve ser ação explícita do usuário (botão "Ver relatórios"); o app não deve navegar automaticamente antes do recarregamento dos anos disponíveis.
- **RF-005:** `DropZone` e `UploadProgress` devem usar a paleta slate/indigo/emerald/rose, classes `glass`/`glass-card` e ícones Lucide (ex.: `UploadCloud`, `CircleCheck`), sem `gray-*`/`blue-500`/`green-500`/`red-500` crus nem o texto "XLS" como título.
- **RF-006:** A página de upload deve usar linguagem direta ("Upload de planilhas", "Como funciona"), sem os jargões "Motor de Dados", "Sincronização ERP", "Command Center" e "Protocolo de Ingestão".

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** Sem alteração na lógica de parsing nem nos contratos de `/api/upload`; mudança restrita a UI/estado client-side.
- **RNF-002:** A coerência visual deve se manter em tema escuro (único tema do app na área protegida).
- **RNF-003:** O resumo consolidado não deve degradar a performance do upload em série de múltiplos arquivos grandes.

### 4.3 Restrições e Limitações

- O cálculo do período min–max consolidado depende de `metadata.periodStart`/`periodEnd` por arquivo; arquivos sem período detectado ("sem periodo") devem ser tratados sem quebrar a agregação.
- Esta versão do Next/React pode diferir do conhecido; conferir os guias em `node_modules/next/dist/docs/` antes de escrever código (ver `AGENTS.md`).
- Não introduzir dependências novas: ícones via `lucide-react` já presente; estado via `zustand` já presente.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Durante o upload, os rótulos "Lendo arquivos...", "Calculando pivot..." e "Gerando relatórios..." aparecem nas fases correspondentes.
- [ ] **CA-002:** A barra de progresso vai de 0 a 100% sem retroceder nem saltar visivelmente na troca de fase (parse 0-50, upload 50-95, finalização 95-100).
- [ ] **CA-003:** Após concluir a importação de N arquivos, é exibido um card-resumo com "N arquivos carregados", o período mínimo–máximo consolidado e o total de linhas.
- [ ] **CA-004:** O app só navega para `/reports` ao clicar "Ver relatórios", e `/reports` não exibe o empty state "Nenhum ano disponível" indevidamente após o upload.
- [ ] **CA-005:** `DropZone` e `UploadProgress` não contêm classes `gray-*`/`blue-500`/`green-500`/`red-500` cruas nem o texto "XLS" como título; usam paleta do tema e ícones Lucide.
- [ ] **CA-006:** A página de upload não contém os termos "Motor de Dados", "Sincronização ERP", "Command Center" nem "Protocolo de Ingestão".
- [ ] **CA-007:** `npm run typecheck` e `npm run build` passam.

## 6. Plano de Testes

### 6.1 Testes Unitários

- Função pura de mapeamento de progresso: dado `(fase, percent)` retorna o valor global esperado (0-50 / 50-95 / 95-100).
- Função pura de agregação do resumo: dada uma lista de metadados por arquivo, retorna `{ files, periodStart, periodEnd, totalRows }` corretos, inclusive com arquivos sem período.

### 6.2 Testes de Integração

- Drop de múltiplos arquivos (mock do `parseXLSFile` e de `/api/upload`): verifica transição de fases, contagem da fila e montagem do card-resumo.

### 6.3 Testes de Aceitação

- Upload manual de 1 e de 3 arquivos: conferir rótulos das fases, barra contínua, card-resumo correto e navegação só pelo botão "Ver relatórios" sem o empty state piscando.

### 6.4 Casos de Borda (Edge Cases)

- Upload de um único arquivo (resumo deve dizer "1 arquivo carregado").
- Arquivo sem período detectado (agregação de min–max deve ignorar/representar adequadamente).
- Falha em um dos arquivos da fila (card-resumo só com os concluídos; estado de erro visível).
- `availableYears` já populado antes do upload (não deve haver flicker nem recarregamento desnecessário).
- Cancelamento por sobreposição de período (`window.confirm`) no meio da fila.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Ajuste no mapeamento da barra introduzir regressão de progresso (saltos/retrocessos) | Média | Médio | Centralizar o cálculo em função pura testada; cobrir as três fases por teste |
| Redirect controlado deixar o usuário "preso" na tela de upload | Baixa | Médio | Botão "Ver relatórios" claro e em destaque no card-resumo; foco/scroll para o card ao concluir |
| Migração de paleta divergir de tokens do design system | Baixa | Baixo | Reusar classes `glass`/`glass-card` e paleta slate/indigo/emerald/rose já adotadas no app |
| Agregação de período min–max com formatos de data inesperados | Baixa | Baixo | Tratar `null`/"sem periodo"; comparar strings ISO já normalizadas pelo parser |

## 8. Dependências

### 8.1 Dependências Internas

- Recomenda-se executar após a **006 - Corretude de Datas e Agregações dos Relatórios**, pois o período exibido no resumo depende da datação correta. Não é bloqueante para a parte visual/fluxo.

### 8.2 Dependências Externas

- `lucide-react` (ícones) — já presente. `zustand` (estado) — já presente. `react-dropzone` — já presente. Sem novas dependências.

## 9. Observações e Decisões de Design

- **Reuso do `phase` do worker:** o parser já emite `phase` em cada evento `progress` (`lib/xlsParser.ts:14-17`), hoje descartado pela UI; ele deve ser a fonte dos rótulos da fase de leitura, evitando strings duplicadas.
- **Redirect como ação explícita:** decidiu-se transformar o redirect em clique no botão "Ver relatórios" (em vez de redirect automático "silencioso"), o que resolve simultaneamente o problema do empty state piscando e entrega o preview do PRD; o pré-carregamento dos anos é reforço para o caso de o usuário navegar por conta própria.
- **Sem mudança de contrato:** todo o trabalho é client-side (UI + `uploadStore`); nenhuma migração, rota ou assinatura de API é tocada, reduzindo o risco da mudança.
- **Linguagem do produto:** a copy passa a falar a língua do usuário-alvo (vendedor/analista) — "Upload de planilhas" e "Como funciona" — mantendo as instruções úteis já existentes (formato `.xls/.xlsx`, situação LIQ, histórico por período).

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

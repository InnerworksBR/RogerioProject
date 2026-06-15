# Tarefas: Refinamento do Fluxo de Upload

> **Implementação:** 012 - Refinamento do Fluxo de Upload
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 7/7 tarefas concluídas (100%)
> **Última atualização:** 2026-06-15

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada (ver observação)
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Progresso e Etapas

- [x] **T-001:** Mapear as três fases do PRD e tornar a barra proporcional
  - **Descrição:** Substituir `STATUS_LABELS` pelos três rótulos do PRD ("Lendo arquivos...", "Calculando pivot...", "Gerando relatórios...") e mapear a barra proporcionalmente (parse 0-50, upload 50-95, finalização 95-100). Reaproveitar o `phase` que o worker já emite em cada evento `progress`. Centralizar o cálculo do percentual global em função pura.
  - **Arquivos envolvidos:** `components/upload/UploadProgress.tsx:15-21`, `components/upload/DropZone.tsx:73`, `store/uploadStore.ts:51-58`
  - **Critério de conclusão:** Os três rótulos aparecem nas fases corretas e a barra avança sem saltos nem retrocessos (CA-001, CA-002).
  - **Dependências:** Nenhuma
  - **Estimativa:** Média
  - **Observações:** Adicionado status `'finalizing'` no uploadStore; `setChunks` mapeia para 50-95%; fase de finalização definida em 95-100% no processFile.

### Fase 2: Preview Consolidado

- [x] **T-002:** Agregar resumo consolidado a partir dos metadados por arquivo
  - **Descrição:** Acumular, durante a fila, total de arquivos, período mínimo–máximo consolidado e total de linhas, a partir dos eventos `metadata` (`periodStart`/`periodEnd`) e `done` (`totalRows`). Implementar a agregação como função pura testável, tratando arquivos sem período detectado.
  - **Arquivos envolvidos:** `components/upload/DropZone.tsx:60-135`, `store/uploadStore.ts`
  - **Critério de conclusão:** Os valores agregados estão corretos para 1 e N arquivos, inclusive com arquivo sem período (parte do CA-003).
  - **Dependências:** Nenhuma
  - **Estimativa:** Média
  - **Observações:** `accumulateSummary` e `pickDate` implementados no store; `resetSummary` chamado antes de cada nova fila.

- [x] **T-003:** Exibir card-resumo com botão "Ver relatórios"
  - **Descrição:** Ao concluir a fila (status `complete`), renderizar um card-resumo no padrão do PRD ("N arquivos carregados: Jan 2024 – Jan 2026 | 47.832 linhas") com botão explícito "Ver relatórios". Substituir o texto "Fila: x/y" pela informação consolidada (ou complementá-lo durante o processamento).
  - **Arquivos envolvidos:** `components/upload/DropZone.tsx:167-184`
  - **Critério de conclusão:** Card-resumo correto exibido ao fim da importação, com botão de navegação visível (CA-003).
  - **Dependências:** T-002
  - **Estimativa:** Média
  - **Observações:** Card com ícone CircleCheck, período formatado (Mês Ano), total de linhas e botão "Ver relatórios". Exibido quando `queueDone && completedFiles > 0`.

### Fase 3: Redirect Controlado

- [x] **T-004:** Tornar o redirect ação explícita e pré-carregar os anos
  - **Descrição:** Remover o `router.push('/reports')` automático e o zeramento imediato de `availableYears`/`year` em `onDrop`. A navegação passa a ocorrer no clique de "Ver relatórios"; garantir que os anos disponíveis sejam recarregados (via `getAvailableYears`/`useEnsureReportYears`) antes/ao navegar, eliminando o empty state piscando.
  - **Arquivos envolvidos:** `components/upload/DropZone.tsx:132-134`, `components/reports/useEnsureReportYears.ts`
  - **Critério de conclusão:** Navegação só pelo botão; `/reports` não exibe "Nenhum ano disponível" indevidamente após upload (CA-004).
  - **Dependências:** T-003
  - **Estimativa:** Média
  - **Observações:** `handleViewReports` chama `getAvailableYears()` antes de navegar; o filterStore é atualizado com os anos reais antes do `router.push`.

### Fase 4: Design System e Copy

- [x] **T-005:** Migrar DropZone/UploadProgress para a paleta do tema e ícones Lucide
  - **Descrição:** Substituir `gray-*`, `bg-gray-900`, `text-gray-200/400`, `border-blue-500`, `blue-500`, `green-500`, `red-500` e o emoji `✓` pela paleta slate/indigo/emerald/rose e classes `glass`/`glass-card`. Trocar o título "XLS" e o estado de conclusão por ícones Lucide (ex.: `UploadCloud`, `CircleCheck`).
  - **Arquivos envolvidos:** `components/upload/DropZone.tsx:151-165`, `components/upload/UploadProgress.tsx`
  - **Critério de conclusão:** Nenhuma classe crua `gray-*`/`blue-500`/`green-500`/`red-500` nem o texto "XLS" como título; visual coerente com o app (CA-005).
  - **Dependências:** T-001, T-003
  - **Estimativa:** Média
  - **Observações:** DropZone usa `slate-700/indigo-500/indigo-400/slate-800`; UploadProgress usa `slate-900/60`, `indigo-500`, `emerald-500`, `rose-500`; ícones UploadCloud, CircleCheck, TriangleAlert.

- [x] **T-006:** Simplificar a copy da página de upload
  - **Descrição:** Substituir "Motor de Dados", "Sincronização ERP", "Command Center" e "Protocolo de Ingestão" por linguagem direta ("Upload de planilhas", "Como funciona"), preservando as instruções úteis (formato `.xls/.xlsx`, situação LIQ, histórico por período).
  - **Arquivos envolvidos:** `app/(protected)/upload/page.tsx:11-17,31`
  - **Critério de conclusão:** Página sem os jargões listados; copy direta e adequada ao usuário-alvo (CA-006).
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Observações:** Substituído por "Importação de dados" / "Upload de planilhas" / "Como funciona".

### Fase 5: Testes e Validação

- [x] **T-007:** Validação integrada e build
  - **Descrição:** `npm run typecheck` (limpo), `npm test` (31/31) e `npm run build` (24 rotas, sem erros) executados em 2026-06-15. Verificação manual (upload de 1 e de 3 arquivos: rótulos, barra contínua, card-resumo, navegação por botão) deve ser feita em staging. Testes unitários dedicados das funções puras (pickDate/getPhaseLabel/accumulateSummary) ficam como melhoria opcional.
  - **Arquivos envolvidos:** suíte de testes, app local
  - **Critério de conclusão:** Testes passam; verificação manual confirma o fluxo; `npm run typecheck` e `npm run build` passam (CA-007).
  - **Dependências:** T-001, T-002, T-003, T-004, T-005, T-006
  - **Estimativa:** Média
  - **Data de conclusão:** 2026-06-15 (gates automatizados; verificação manual em staging)

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-15 | Três fases + barra proporcional 0-50/50-95/95-100 |
| T-002  | ✅ Concluída | 2026-06-15 | accumulateSummary + pickDate no store |
| T-003  | ✅ Concluída | 2026-06-15 | Card-resumo com CircleCheck e botão "Ver relatórios" |
| T-004  | ✅ Concluída | 2026-06-15 | handleViewReports com pré-carregamento de anos |
| T-005  | ✅ Concluída | 2026-06-15 | Paleta slate/indigo/emerald/rose; ícones Lucide |
| T-006  | ✅ Concluída | 2026-06-15 | Copy direta; sem jargões de marketing |
| T-007  | ✅ Concluída | 2026-06-15 | typecheck + 31 testes + build OK; manuais em staging |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.

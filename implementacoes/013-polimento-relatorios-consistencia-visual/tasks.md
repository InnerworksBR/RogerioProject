# Tarefas: Polimento de Relatórios e Consistência Visual

> **Implementação:** 013 - Polimento de Relatórios e Consistência Visual
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 9/9 tarefas concluídas (100%)
> **Última atualização:** 2026-06-15

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada (ver observação)
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Feedback e Padronização de Componentes

- [x] **T-001:** Padronizar o `ExportButton` com ícone, spinner e toasts
  - **Descrição:** Substituir o emoji `⬇` pelo ícone Lucide `Download`, exibir `Loader2` animado durante a exportação e envolver `handleExport` em `try/catch` com `toast.success`/`toast.error` (e `console.error`), no padrão do `DownloadAllButton`. Restaurar o estado em `finally`.
  - **Arquivos envolvidos:** `components/reports/ExportButton.tsx:14-36`, referência: `app/(protected)/reports/page.tsx:106-168`
  - **Critério de conclusão:** Spinner durante a exportação; toast de sucesso ao concluir; toast de erro ao falhar (sem falha silenciosa).
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 2: Melhorias nas Tabelas de Relatório

- [x] **T-002:** Adicionar cabeçalho agrupado por Ano ao `ReportTable`
  - **Descrição:** Permitir (via prop opcional, default-off) uma linha de cabeçalho superior que agrupa as colunas de meses sob o rótulo do Ano, mantendo a virtualização intacta (header fora do range virtualizado).
  - **Arquivos envolvidos:** `components/reports/ReportTable.tsx:89-110`
  - **Critério de conclusão:** Header de Ano renderizado acima dos meses sem quebrar o scroll/sticky.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-003:** Adicionar linha de totais em negrito ao rodapé do `ReportTable`
  - **Descrição:** Permitir (via prop opcional) um `tfoot`/linha final com os totais das colunas numéricas em negrito, fora do range virtualizado. Não somar linhas de cabeçalho de categoria (caso da `GeralView`).
  - **Arquivos envolvidos:** `components/reports/ReportTable.tsx:111-157`
  - **Critério de conclusão:** Linha de totais coerente com a soma das linhas visíveis; ausente quando não há dados.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-004:** Indicador visível de scroll horizontal nas tabelas
  - **Descrição:** Adicionar sombra/gradiente na borda direita do container rolável e reforçar a affordance da scrollbar (hoje `custom-scrollbar` ~6px, quase invisível) para sinalizar conteúdo rolável, especialmente em mobile.
  - **Arquivos envolvidos:** `components/reports/ReportTable.tsx:83-88`, estilos de `custom-scrollbar`
  - **Critério de conclusão:** Em viewport estreita, é visível que a tabela rola horizontalmente.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-005:** Conectar as views ao header de Ano e à linha de totais
  - **Descrição:** Passar a definição de grupo (Ano) e o cálculo da linha de totais das colunas mensais/anuais ao `ReportTable` em cada view, respeitando suas colunas específicas e (na `GeralView`) as linhas de categoria.
  - **Arquivos envolvidos:** `components/reports/views/TabelaDinamicaView.tsx`, `BaseCompraView.tsx`, `BaseItensView.tsx`, `GeralView.tsx`
  - **Critério de conclusão:** As quatro views exibem cabeçalho de Ano e linha de totais em negrito.
  - **Dependências:** T-002, T-003
  - **Estimativa:** Média

### Fase 3: Filtro de Produto (Autocomplete)

- [x] **T-006:** Substituir o filtro de produto por um Combobox com autocomplete
  - **Descrição:** Trocar o `Input` livre por um Combobox acessível que busca por código ou descrição e oferece sugestões, chamando `setProduct(codigo)` na seleção. Reutilizou o Combobox acessível da implementação 010 (`components/ui/combobox.tsx`). Fonte dos produtos: função `searchProducts` adicionada em `lib/reportQueries.ts` (usa RPC `product_catalog` com fallback em `sales_rows`).
  - **Arquivos envolvidos:** `components/reports/ReportFilterBar.tsx:149-171`, `components/ui/combobox.tsx`, `lib/reportQueries.ts`
  - **Critério de conclusão:** Filtro de produto sugere e filtra por código e descrição; selecionar recalcula os relatórios.
  - **Dependências:** Combobox da impl. 010 (disponível em `components/ui/combobox.tsx`)
  - **Estimativa:** Média

### Fase 4: Consistência de Formatação e Texto

- [x] **T-007:** Corrigir formatação de moeda no `config/page.tsx`
  - **Descrição:** Trocar `R$ {item.total_valor.toLocaleString('pt-BR')}` pelo helper `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` (2 casas), eliminando os decimais brutos.
  - **Arquivos envolvidos:** `app/(protected)/config/page.tsx:503`
  - **Critério de conclusão:** Valor exibido como "R$ 1.234,57" (2 casas), não com decimais brutos.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-008:** Revisar e corrigir acentuação dos textos
  - **Descrição:** Corrigiu acentuação ausente nos textos voltados ao usuário em todos os arquivos citados.
  - **Arquivos envolvidos:** `app/login/page.tsx`, `components/auth/LoginForm.tsx`, `components/upload/UploadHistory.tsx`, `app/(protected)/team/page.tsx`, `components/report-chat/ReportChat.tsx`, `app/shared/client/[token]/page.tsx`
  - **Critério de conclusão:** Todos os textos citados aparecem acentuados corretamente.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-009:** Padronizar tooltips de gráfico acessíveis no `ClientVisitDashboard`
  - **Descrição:** Substituiu atributo HTML `title` por `aria-label` nos gráficos de barras. Os valores (faturamento/unidades) já ficam sempre visíveis como texto abaixo de cada barra, satisfazendo a acessibilidade por toque e teclado.
  - **Arquivos envolvidos:** `components/client-dashboard/ClientVisitDashboard.tsx:234,239,664`
  - **Critério de conclusão:** Tooltips/valores funcionam por toque e teclado (valores sempre visíveis como texto).
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-15 | ExportButton: Download + Loader2 + toast.success/error |
| T-002  | ✅ Concluída | 2026-06-15 | ReportTable: prop groupHeaders adicionada |
| T-003  | ✅ Concluída | 2026-06-15 | ReportTable: prop getTotalsRow + tfoot sticky |
| T-004  | ✅ Concluída | 2026-06-15 | ReportTable: gradiente borda direita como indicador de scroll |
| T-005  | ✅ Concluída | 2026-06-15 | TabelaDinamicaView, BaseCompraView, BaseItensView, GeralView atualizadas |
| T-006  | ✅ Concluída | 2026-06-15 | ReportFilterBar: Combobox com searchProducts (RPC + fallback) |
| T-007  | ✅ Concluída | 2026-06-15 | config/page.tsx: toLocaleString com style:'currency' |
| T-008  | ✅ Concluída | 2026-06-15 | Acentuação corrigida em 6 arquivos |
| T-009  | ✅ Concluída | 2026-06-15 | title= -> aria-label=; valores já visíveis como texto |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.

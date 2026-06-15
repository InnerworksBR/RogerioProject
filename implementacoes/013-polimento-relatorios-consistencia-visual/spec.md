# Polimento de Relatórios e Consistência Visual

> **ID:** 013
> **Status:** 🟢 Concluída
> **Prioridade:** 🟢 Baixa
> **Criada em:** 2026-06-15
> **Última atualização:** 2026-06-15
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Esta implementação reúne um conjunto de ajustes de polimento visual, feedback de interação e consistência de formatação nos relatórios e telas correlatas, identificados em auditoria de UX/UI. Nenhum item altera regras de negócio ou agregações — o foco é alinhar a camada de apresentação ao que o PRD descreve e ao padrão já adotado em outros pontos do produto. Os ajustes incluem: padronizar o `ExportButton` com ícone Lucide, spinner e toasts de sucesso/erro (eliminando falha silenciosa); enriquecer as tabelas largas com cabeçalho agrupado por Ano, linha de totais em negrito no rodapé e um indicador visível de scroll horizontal; substituir o filtro de produto por um Combobox com autocomplete por código e descrição; corrigir formatação de moeda divergente; revisar acentuação ausente em vários textos; e padronizar tooltips de gráficos caseiros para serem acessíveis por toque e teclado. A reescrita de exibição multi-ano (todos os anos lado a lado) é explicitamente mantida **fora de escopo** e registrada como decisão de produto na seção 9.

## 2. Contexto e Motivação

### 2.1 Problema Atual

Auditoria de consistência visual e interação encontrou os seguintes pontos:

- **`ExportButton` fora do padrão e sem feedback** (`components/reports/ExportButton.tsx:14-36`): usa o emoji `⬇` em vez do ícone Lucide `Download`, mostra "Gerando..." sem spinner e o `handleExport` não tem `try/catch` nem toast — uma falha de exportação é silenciosa. O padrão correto já existe no `DownloadAllButton` (`app/(protected)/reports/page.tsx:106`), que usa `Download`, `Loader2` animado e toasts `sonner` de sucesso/erro.
- **Tabelas largas sem cabeçalho de Ano, sem linha de totais e sem pista de scroll** (`components/reports/ReportTable.tsx` e as views `GeralView.tsx`, `BaseItensView.tsx`, `TabelaDinamicaView.tsx`, `BaseCompraView.tsx`): o PRD pede colunas agrupadas por **Ano → Mês → Total do Ano → Total Período** e **linha de totais em negrito**. Na tela, a Tabela Dinâmica e a Base de Compra mostram apenas 12 meses + Total Ano de um único ano, sem cabeçalho de ano agrupado e sem linha de totais ao final. No mobile, são ~17-20 colunas roláveis sem indicação; o `custom-scrollbar` tem apenas 6px e fica praticamente invisível.
- **Filtro de produto não é autocomplete** (`components/reports/ReportFilterBar.tsx:149-171`): é um `Input` livre ("Cód. Referência...") que só filtra por código exato no Enter/botão, não busca por descrição e não oferece sugestões — inconsistente com o filtro de cliente, que é um `Select` completo. O PRD (seção "Filtros Globais") pede "autocomplete/search por código ou descrição".
- **Moeda inconsistente** (`app/(protected)/config/page.tsx:503`): `R$ {item.total_valor.toLocaleString('pt-BR')}` não usa `style:'currency'`, produzindo valores com decimais brutos (ex.: "R$ 1.234,5678"), contrariando o PRD ("formatar sempre com 2 casas").
- **Acentuação ausente** em vários textos voltados ao usuário: "Area protegida", "e liberado", "Historico recente", "ate", "licencas", "solicitacao", "invalido ou expirado", etc. Locais: `app/login/page.tsx:33,39-41`; `components/auth/LoginForm.tsx:113-124`; `components/upload/UploadHistory.tsx`; `app/(protected)/team/page.tsx`; `components/report-chat/ReportChat.tsx`; `app/shared/client/[token]/page.tsx:16,26`.
- **Tooltips de gráfico via atributo `title`** (`components/client-dashboard/ClientVisitDashboard.tsx:234,239,664`): tooltips dependem do atributo HTML `title`, que não funciona por toque nem por teclado, prejudicando mobile e acessibilidade. O `SharedDashboardClientView` já usa Recharts, que oferece tooltip acessível.

### 2.2 Impacto do Problema

- **Quem é afetado:** todos os usuários (representantes e líderes), com impacto maior em quem acessa por celular (tabelas largas e tooltips por hover) e em quem confia nas exportações (falha silenciosa do `ExportButton`).
- **Magnitude:** não há perda de dado nem número incorreto — é degradação de experiência e desvio do padrão visual descrito no PRD. A falha silenciosa de exportação é a de maior risco prático, pois o usuário pode acreditar que baixou um arquivo que nunca foi gerado.
- **Se não resolvido:** o produto permanece com inconsistências perceptíveis (moeda mal formatada, textos sem acento, filtro de produto limitado, tabelas sem totais), erodindo a percepção de qualidade e tornando a leitura em mobile difícil.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Reaproveitar o padrão de feedback do `DownloadAllButton` no `ExportButton` | Consistência imediata; baixo custo; padrão já validado | Nenhum relevante | ✅ Escolhida |
| Adicionar header agrupado (Ano), rodapé de totais e indicador de scroll ao `ReportTable` atual | Atende o PRD com baixo esforço; mantém a virtualização | Não exibe múltiplos anos lado a lado | ✅ Escolhida |
| Reescrever as views para exibir todos os anos lado a lado (multi-ano) | Aderência total ao layout do Excel de referência | Alto esforço; muda contratos das RPCs/queries; decisão de produto | ❌ Fora de escopo (ver seção 9) |
| Combobox acessível com autocomplete (código + descrição) para produto | Atende o PRD; consistente com o filtro de cliente | Depende do Combobox da impl. 010 | ✅ Escolhida |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

Todos os ajustes ficam na camada de apresentação (componentes React client-side e páginas). Não há mudança de schema, de RPC, de contrato HTTP nem de lógica de agregação. O `ReportTable` é um componente genérico compartilhado pelas cinco views de relatório, então a adição de header agrupado, rodapé de totais e indicador de scroll é feita preferencialmente nele (via props opcionais) para propagar a todas as views sem duplicação. O filtro de produto passa a usar o Combobox acessível reaproveitado da implementação 010. As correções de acentuação, moeda e tooltips são pontuais nos arquivos citados.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `components/reports/ExportButton.tsx` | Arquivo | Modificar | Ícone `Download`, `Loader2` animado, `try/catch` com toasts de sucesso/erro |
| `components/reports/ReportTable.tsx` | Arquivo | Modificar | Header agrupado por Ano (opcional), rodapé de totais em negrito (opcional), indicador de scroll horizontal |
| `components/reports/views/TabelaDinamicaView.tsx` | Arquivo | Modificar | Passar definição de grupo de Ano e linha de totais ao `ReportTable` |
| `components/reports/views/BaseCompraView.tsx` | Arquivo | Modificar | Idem TabelaDinamica |
| `components/reports/views/BaseItensView.tsx` | Arquivo | Modificar | Idem, conforme colunas da view |
| `components/reports/views/GeralView.tsx` | Arquivo | Modificar | Idem, respeitando as linhas de categoria (header) já existentes |
| `components/reports/ReportFilterBar.tsx` | Arquivo | Modificar | Substituir `Input` de produto por Combobox com autocomplete (código + descrição) |
| `app/(protected)/config/page.tsx` | Arquivo | Modificar | Trocar `toLocaleString('pt-BR')` por `fmtBRL` na linha 503 |
| `app/login/page.tsx` | Arquivo | Modificar | Corrigir acentuação (linhas 33, 39-41) |
| `components/auth/LoginForm.tsx` | Arquivo | Modificar | Corrigir acentuação (linhas 113-124) |
| `components/upload/UploadHistory.tsx` | Arquivo | Modificar | Corrigir acentuação ("Historico recente", "ate", etc.) |
| `app/(protected)/team/page.tsx` | Arquivo | Modificar | Corrigir acentuação (vários: "licencas", "solicitacao", etc.) |
| `components/report-chat/ReportChat.tsx` | Arquivo | Modificar | Corrigir acentuação |
| `app/shared/client/[token]/page.tsx` | Arquivo | Modificar | Corrigir acentuação (linhas 16, 26) |
| `components/client-dashboard/ClientVisitDashboard.tsx` | Arquivo | Modificar | Padronizar tooltips (Recharts ou valor sempre visível) nos gráficos (linhas 234, 239, 664) |
| Combobox da impl. 010 | Componente | Reutilizar | Combobox acessível criado em `010-acessibilidade-padroes-interacao` |
| `lib/format.ts` (ou helper equivalente) | Arquivo | Referência | Helper `fmtBRL` consistente para moeda em 2 casas |

### 3.3 Interfaces e Contratos

#### Entradas

- Dados já carregados pelas views (`TabelaDinamicaRow`, `BaseDeCompraRow`, etc.) — sem mudança de shape.
- Lista de produtos (código + descrição) para alimentar o Combobox de autocomplete, obtida via query existente de produtos/itens.

#### Saídas

- UI atualizada: botão de exportar com feedback, tabelas com header de Ano + linha de totais + sombra/indicador de scroll, filtro de produto como Combobox, moeda em 2 casas, textos acentuados, tooltips acessíveis.

#### Contratos de API (se aplicável)

N/A — nenhum contrato HTTP, RPC ou schema é alterado. Apenas leitura dos dados já disponíveis.

### 3.4 Modelos de Dados (se aplicável)

Sem alteração de modelo de dados. As novas props do `ReportTable` (ex.: agrupamento de cabeçalho, função de cálculo da linha de totais) são opcionais e default-off, preservando compatibilidade com chamadas existentes.

### 3.5 Fluxo de Execução

1. **Exportar:** usuário clica em "Baixar Excel" → `ExportButton` entra em estado `exporting` com `Loader2`; em sucesso, toast de sucesso; em erro capturado por `try/catch`, toast de erro; `finally` restaura o estado.
2. **Tabela:** `ReportTable` renderiza `thead` com uma linha superior de grupo (Ano) acima dos meses, o corpo virtualizado e um `tfoot`/linha final com os totais em negrito; um gradiente/sombra na borda direita sinaliza conteúdo rolável horizontalmente.
3. **Filtro de produto:** ao digitar, o Combobox filtra a lista por código ou descrição e sugere opções; ao selecionar, chama `setProduct(codigo)` no `filterStore`, disparando o recálculo dos relatórios como hoje.
4. **Moeda/acentuação/tooltips:** ajustes pontuais aplicados nos pontos de renderização citados.

### 3.6 Tratamento de Erros

- `ExportButton`: qualquer exceção em `exportReport` é capturada e exibida via toast de erro (`toast.error`), com `console.error` para diagnóstico; o estado de carregamento sempre é restaurado em `finally`.
- Combobox de produto: lista vazia ou falha ao carregar produtos não quebra o filtro — exibir estado vazio/placeholder e permitir limpar a seleção.
- Demais ajustes (moeda, acentuação, tooltips) não introduzem novos caminhos de erro.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** O `ExportButton` deve usar o ícone `Download`, exibir `Loader2` animado durante a exportação e emitir toast de sucesso ao concluir e toast de erro em caso de falha.
- **RF-002:** As tabelas de relatório devem exibir um cabeçalho agrupado por Ano sobre as colunas de meses, conforme o PRD.
- **RF-003:** As tabelas de relatório devem exibir uma linha de totais em negrito ao final.
- **RF-004:** As tabelas largas devem apresentar um indicador visível de scroll horizontal (sombra/gradiente na borda direita e/ou scrollbar mais visível que os 6px atuais).
- **RF-005:** O filtro de produto deve ser um Combobox com autocomplete que busca por código **ou** descrição e oferece sugestões.
- **RF-006:** Valores monetários no `config/page.tsx` (linha 503) devem ser exibidos com 2 casas decimais via `fmtBRL`.
- **RF-007:** Os textos citados devem estar acentuados corretamente em português.
- **RF-008:** Os tooltips dos gráficos caseiros do `ClientVisitDashboard` devem ser acessíveis por toque e teclado (ou os valores devem ficar sempre visíveis).

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** Sem regressão de performance perceptível; a virtualização do `ReportTable` deve ser preservada.
- **RNF-002:** Mudanças não devem alterar números/agregações exibidos — apenas a forma de apresentação.
- **RNF-003:** Novas props do `ReportTable` devem ser retrocompatíveis (opcionais, default-off).
- **RNF-004:** Tooltips e Combobox devem respeitar contraste e navegação por teclado (alinhado à impl. 010).

### 4.3 Restrições e Limitações

- A exibição multi-ano (todos os anos lado a lado, como no Excel de referência) **não** faz parte deste escopo — ver decisão na seção 9. As tabelas continuam mostrando um ano por vez, agora com cabeçalho de Ano e linha de totais.
- O Combobox de produto depende do componente acessível da implementação 010 (ver seção 8.1); enquanto ela não estiver disponível, esta tarefa fica bloqueada.
- Este é um projeto Next.js 16 / React 19 cujas APIs podem diferir do conhecido; conferir `node_modules/next/dist/docs/` antes de codificar.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Ao clicar em "Baixar Excel", o botão mostra spinner `Loader2`; ao concluir, surge toast de sucesso; ao forçar uma falha de exportação, surge toast de erro (sem falha silenciosa).
- [ ] **CA-002:** As tabelas (Tabela Dinâmica, Base de Compra, Base de Itens, Geral) exibem cabeçalho agrupado por Ano e uma linha de totais em negrito ao final.
- [ ] **CA-003:** Em viewport mobile, há indicação visível de que a tabela rola horizontalmente (sombra/gradiente na borda direita e/ou scrollbar perceptível).
- [ ] **CA-004:** O filtro de produto é um Combobox que sugere e filtra por código e por descrição; selecionar uma opção recalcula os relatórios.
- [ ] **CA-005:** O valor em `config/page.tsx` aparece com 2 casas decimais (ex.: "R$ 1.234,57"), não com decimais brutos.
- [ ] **CA-006:** Os textos citados estão acentuados corretamente ("Área protegida", "é liberado", "Histórico recente", "até", "licenças", "solicitação", "inválido ou expirado", etc.).
- [ ] **CA-007:** Os tooltips dos gráficos do `ClientVisitDashboard` funcionam por toque e teclado (ou os valores ficam sempre visíveis).
- [ ] **CA-008:** `npm run lint`, `npm run typecheck` e `npm run build` passam.

## 6. Plano de Testes

### 6.1 Testes Unitários

- Render do `ExportButton`: estado `exporting` mostra `Loader2`; sucesso chama `toast.success`; erro chama `toast.error` (mockando `exportReport`).
- Helper de cálculo da linha de totais do `ReportTable`: soma de colunas numéricas confere com os dados.
- Filtro do Combobox de produto: digitar trecho de descrição e de código retorna as opções esperadas.

### 6.2 Testes de Integração

- View de relatório com dados de fixture: cabeçalho de Ano renderizado, rodapé de totais presente e coerente com a soma das linhas.
- Selecionar produto no Combobox dispara `setProduct` e o relatório recalcula.

### 6.3 Testes de Aceitação

- Percorrer cada tela citada e confirmar acentuação, formatação de moeda, feedback de exportação e tooltips acessíveis.

### 6.4 Casos de Borda (Edge Cases)

- Exportação que lança exceção (rede/arquivo) → toast de erro e botão reabilitado.
- Tabela sem linhas (filtro vazio) → não renderizar linha de totais inconsistente; manter mensagem de vazio.
- Combobox com lista de produtos vazia ou ainda carregando.
- Produto buscado por descrição com acento e por código alfanumérico (ex.: "402-CL").
- Viewport estreita (mobile) e larga (desktop) para o indicador de scroll.
- `GeralView` com suas linhas de categoria (header) — totais não devem somar as linhas de cabeçalho de categoria.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Header agrupado/rodapé quebrar a virtualização do `ReportTable` | Média | Médio | Manter `thead`/`tfoot` fora do range virtualizado; testar com dataset grande |
| Combobox da impl. 010 não disponível a tempo | Média | Médio | Tarefa do filtro de produto fica `[!]` bloqueada até a 010; demais tarefas seguem em paralelo |
| Expectativa de multi-ano confundida com este escopo | Média | Baixo | Decisão registrada na seção 9; comunicar que multi-ano é trabalho separado |
| Correção de acentuação introduzir erro de encoding | Baixa | Baixo | Garantir arquivos em UTF-8; revisar diff de cada texto |

## 8. Dependências

### 8.1 Dependências Internas

- **Combobox acessível da implementação 010 (`010-acessibilidade-padroes-interacao`):** o filtro de produto (autocomplete por código + descrição) deve reutilizar o componente Combobox acessível criado naquela implementação. Esta é uma dependência de pré-requisito para a tarefa de filtro; as demais tarefas podem prosseguir independentemente. Observação: no momento desta spec, a implementação 010 ainda não existe no diretório `implementacoes/` (presentes apenas 001-006) — a dependência é, portanto, sobre a entrega futura/planejada da 010.

### 8.2 Dependências Externas

- `lucide-react` (ícones `Download`, `Loader2`) — já presente.
- `sonner` (toasts) — já presente.
- `recharts` — já presente (usado no `SharedDashboardClientView`).
- `@tanstack/react-table` e `@tanstack/react-virtual` — já presentes.

## 9. Observações e Decisões de Design

- **Multi-ano fora de escopo (decisão de produto):** o PRD descreve colunas agrupadas com **vários anos lado a lado** (cabeçalho de anos mesclado, Total do Ano repetindo por ano, Total Período). Hoje as views exibem **um ano por vez**. Migrar para a exibição multi-ano é mudança de maior esforço que afeta as queries/RPCs e o contrato das views, sendo uma decisão de produto. **Decisão:** manter um ano por vez nesta implementação e entregar apenas o polimento de baixo custo (cabeçalho de Ano agrupado sobre os meses, linha de totais em negrito e indicador de scroll). A reescrita multi-ano deve ser planejada como implementação separada.
- **Reuso em vez de duplicação:** as melhorias de tabela são concentradas no `ReportTable` via props opcionais, evitando replicar lógica nas cinco views.
- **Padrão de feedback único:** o `ExportButton` passa a seguir exatamente o padrão do `DownloadAllButton` (ícone, spinner, toasts), consolidando a experiência de exportação.
- **Scroll horizontal:** o `custom-scrollbar` atual tem ~6px e é quase invisível; além do gradiente/sombra de borda, avaliar aumentar levemente a espessura/contraste da scrollbar para reforçar a affordance em mobile.
- **Tooltips:** preferir Recharts (já usado em outra tela) para consistência; alternativa aceitável é exibir os valores como texto sempre visível, eliminando a dependência de hover.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

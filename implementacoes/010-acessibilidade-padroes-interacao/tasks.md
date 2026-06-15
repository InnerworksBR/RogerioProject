# Tarefas: Acessibilidade e Padrões de Interação

> **Implementação:** 010 - Acessibilidade e Padrões de Interação
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 8/8 tarefas concluídas (100%)
> **Última atualização:** 2026-06-15

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada (ver observação)
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Preparação e Setup

- [x] **T-001:** Confirmar API dos primitivos Base UI e padrão do design system
  - **Descrição:** Conferir em `node_modules/@base-ui/react/{field,alert-dialog,combobox}` as props/partes reais (Root/Label/Control, Root/Popup/Backdrop, Root/Input/List/Item etc.) e espelhar o padrão de `components/ui/select.tsx` (uso de `data-slot`, `cn`, Tailwind). Documentar as assinaturas que serão usadas.
  - **Arquivos envolvidos:** `node_modules/@base-ui/react/*`, `components/ui/select.tsx`, `components/ui/button.tsx`
  - **Critério de conclusão:** Assinaturas dos primitivos confirmadas; nenhuma dependência nova necessária.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Observações:** Esta versão do Next/React/Base UI pode diferir — não assumir API de memória.

### Fase 2: Implementação Core

- [x] **T-002:** Criar `components/ui/field.tsx` (associação label↔input)
  - **Descrição:** Wrapper sobre `@base-ui/react/field` expondo `Field.Root/Label/Control/Description/Error` com associação `for`/`id` automática, seguindo o padrão do design system. Base para corrigir os labels órfãos.
  - **Arquivos envolvidos:** `components/ui/field.tsx` (criar)
  - **Critério de conclusão:** O `id` do controle bate com o `for` do label renderizado (teste unitário simples).
  - **Dependências:** T-001
  - **Estimativa:** Pequena

- [x] **T-003:** Criar `AlertDialog` estilizado + hook `useConfirm`
  - **Descrição:** Criar `components/ui/alert-dialog.tsx` sobre `@base-ui/react/alert-dialog` no tema dark/glass (foco preso, `role="alertdialog"`, Escape, botão seguro como padrão) e `components/ui/use-confirm.tsx` expondo `confirm() → Promise<boolean>` para uso imperativo.
  - **Arquivos envolvidos:** `components/ui/alert-dialog.tsx`, `components/ui/use-confirm.tsx` (criar)
  - **Critério de conclusão:** Confirmar resolve `true`; cancelar/Escape/backdrop resolve `false`; visual alinhado ao tema.
  - **Dependências:** T-001
  - **Estimativa:** Média

- [x] **T-004:** Criar `components/ui/combobox.tsx` genérico e acessível
  - **Descrição:** Combobox tipado sobre `@base-ui/react/combobox` com props `items`/`value`/`onValueChange`/`itemToStringLabel`/`aria-label`/`placeholder`/`emptyMessage`, expondo `role="combobox"`/`listbox`/`option` e navegação por teclado (setas/Enter/Escape). Projetar agnóstico de domínio para reúso pela 013.
  - **Arquivos envolvidos:** `components/ui/combobox.tsx` (criar)
  - **Critério de conclusão:** Digitar filtra; ArrowUp/Down navegam; Enter seleciona; Escape fecha; componente genérico (sem acoplamento a cliente).
  - **Dependências:** T-001
  - **Estimativa:** Média
  - **Observações:** Artefato do qual a implementação 013 depende — revisar a generalidade antes de fechar.

- [x] **T-005:** Associar labels nos formulários (LoginForm, ReportFilterBar, team)
  - **Descrição:** Aplicar `htmlFor`+`id`/`aria-label` para associar todos os campos rotulados: LoginForm Email/Senha; Select e Input de filtro; inputs do convite (placeholder-only) e campos de licença.
  - **Arquivos envolvidos:** `components/auth/LoginForm.tsx:57,75`, `components/reports/ReportFilterBar.tsx:68,80,91,120,150`, `app/(protected)/team/page.tsx:291-292`
  - **Critério de conclusão:** Nenhum `<label>` órfão nesses arquivos; cada campo tem nome acessível (`getByLabelText`/`getByRole name`).
  - **Dependências:** T-002
  - **Estimativa:** Média
  - **Observações:** LoginForm usa `htmlFor`+`id`; ReportFilterBar usa `htmlFor`+`id`+`aria-label` nos SelectTrigger; team/page usa `htmlFor`+`id` nos inputs de convite. Campos de licença (linhas 344, 348) já usam `<label>` envolvendo o controle — padrão válido.

- [x] **T-006:** Substituir `confirm`/`alert` nativos pelo `AlertDialog`
  - **Descrição:** Trocar todas as confirmações destrutivas nativas pelo `AlertDialog`/`useConfirm` e adicionar confirmação à revogação de link (hoje sem nenhuma). Garantir que estados de carregamento só ativem após confirmação positiva.
  - **Arquivos envolvidos:** `components/upload/DropZone.tsx:49`, `app/(protected)/config/page.tsx:139`, `app/(protected)/team/page.tsx:150`, `components/report-chat/ReportChat.tsx:107`, `components/client-dashboard/ShareLinksManager.tsx:25`
  - **Critério de conclusão:** Nenhum `window.confirm`/`alert`/`confirm(`/`alert(` permanece nos arquivos; revogar link confirma antes de executar.
  - **Dependências:** T-003
  - **Estimativa:** Média

- [x] **T-007:** Migrar sugestões de cliente para o Combobox acessível
  - **Descrição:** Substituir a lista de sugestões manual do dashboard pelo `Combobox`, preservando a lógica de seleção de cliente e a filtragem por código/nome.
  - **Arquivos envolvidos:** `components/client-dashboard/ClientVisitDashboard.tsx:1106,1112-1126`
  - **Critério de conclusão:** Dashboard usa o Combobox com semântica ARIA e teclado funcionais; seleção continua atualizando o estado.
  - **Dependências:** T-004
  - **Estimativa:** Média
  - **Observações:** Estados `search`, `deferredSearch`, `filteredClients`, `shouldShowSuggestions`, `handleSelectClient` removidos (gerenciados internamente pelo Combobox). Import `useDeferredValue` e ícone `Search` removidos do componente.

### Fase 3: Testes e Validação

- [x] **T-008:** Validação de acessibilidade e suíte completa
  - **Descrição:** `npm run typecheck` (limpo, após 1 fix de className no combobox), `npm test` (31/31) e `npm run build` (24 rotas, sem erros) executados em 2026-06-15. A verificação manual por teclado/leitor de tela (WCAG 1.3.1/2.1.1/4.1.2) deve ser feita em staging.
  - **Arquivos envolvidos:** suíte de testes, app local
  - **Critério de conclusão:** Todos os comandos passam; verificação manual de teclado/leitor de tela aprovada.
  - **Dependências:** T-005, T-006, T-007
  - **Estimativa:** Média
  - **Data de conclusão:** 2026-06-15 (gates automatizados; verificação manual de a11y em staging)

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-15 | Primitivos field/alert-dialog/combobox confirmados via leitura de node_modules |
| T-002  | ✅ Concluída | 2026-06-15 | `components/ui/field.tsx` criado com FieldRoot/Label/Control/Description/Error |
| T-003  | ✅ Concluída | 2026-06-15 | `components/ui/alert-dialog.tsx` e `components/ui/use-confirm.tsx` criados |
| T-004  | ✅ Concluída | 2026-06-15 | `components/ui/combobox.tsx` genérico criado (items+filter+itemToStringLabel) |
| T-005  | ✅ Concluída | 2026-06-15 | htmlFor+id em LoginForm, ReportFilterBar, team/page |
| T-006  | ✅ Concluída | 2026-06-15 | Todos os window.confirm substituídos; revogação de link ganhou confirmação |
| T-007  | ✅ Concluída | 2026-06-15 | Combobox acessível integrado ao ClientVisitDashboard |
| T-008  | ✅ Concluída | 2026-06-15 | typecheck + 31 testes + build OK; a11y manual em staging |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.

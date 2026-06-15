# Acessibilidade e Padrões de Interação

> **ID:** 010
> **Status:** 🟢 Concluída
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-15
> **Última atualização:** 2026-06-15
> **Autor:** Agente AI

---

## 1. Resumo Executivo

A interface possui três lacunas sistêmicas de acessibilidade e consistência de interação que degradam a usabilidade com teclado/leitor de tela e quebram o tema dark/glassmorphism premium. **(1)** Nenhum `<label>` do app associa-se ao seu input (zero usos de `htmlFor` em toda a árvore, inputs sem `id`) e existe apenas **um** `aria-label` em todos os componentes (`components/report-chat/ReportChat.tsx:154`) — leitores de tela não conseguem anunciar a maioria dos campos. **(2)** Confirmações destrutivas usam `window.confirm`/`alert()` nativos do navegador, que ignoram o design system, não são estilizáveis e parecem deslocados; além disso, revogar um link de compartilhamento é uma ação destrutiva que **não** pede confirmação. **(3)** A lista de sugestões de cliente no dashboard não tem navegação por teclado nem semântica ARIA de combobox.

Esta implementação corrige a associação `label`↔`input` de forma sistêmica (preferindo o primitivo `Field` do Base UI já presente), cria um componente `AlertDialog` de confirmação estilizado em `components/ui/` para substituir todos os `confirm`/`alert` nativos (incluindo a revogação de link, que passa a confirmar), e cria um componente `Combobox` acessível e **genérico** — projetado para reúso pela implementação 013 (autocomplete do filtro de produto). Nenhuma regra de negócio ou cálculo é afetado: o escopo é puramente de interface (client components React).

## 2. Contexto e Motivação

### 2.1 Problema Atual

**Achado 1 — Labels não associados a inputs (sistêmico).** Verificado: `grep htmlFor` retorna **zero** ocorrências em todo o repositório, e só há **um** `aria-label` na árvore de componentes (`components/report-chat/ReportChat.tsx:154`).

- `components/auth/LoginForm.tsx:57,75` — `<label>` de "Email" e "Senha" são apenas texto visual; o `<Input>` correspondente não tem `id` nem é envolvido pelo label.
- `components/reports/ReportFilterBar.tsx:68,80,91,120,150` — labels de Semestre, Tipo de receita, Ano de Referência, Cliente/Parceiro e Filtro de Produto são `<label>` soltos; os `Select`/`Input` não recebem `aria-label` nem `id`.
- `app/(protected)/team/page.tsx:291-292` — inputs "Nome completo" e "email@empresa.com.br" do convite de representante só têm `placeholder` (sem label nem `aria-label`); `:344,348` — campos de quantidade/observação de licença usam `<label>` envolvendo o controle de forma inconsistente.

**Achado 2 — Confirmações destrutivas via API nativa do navegador.** O design system é dark/glassmorphism; os diálogos nativos do navegador quebram a estética e não são estilizáveis nem testáveis de forma consistente.

- `components/upload/DropZone.tsx:49` — `window.confirm` para sobreposição de período de upload.
- `app/(protected)/config/page.tsx:139` — `confirm('Tem certeza que deseja excluir este item?')`.
- `app/(protected)/team/page.tsx:150` — `window.confirm` para excluir representante.
- `components/report-chat/ReportChat.tsx:107` — `window.confirm('Excluir esta conversa?')`.
- `components/client-dashboard/ShareLinksManager.tsx:25` — `revoke()` executa a exclusão **imediatamente**, sem nenhuma confirmação, apesar de ser destrutiva e irreversível.

**Achado 3 — Sugestões de cliente sem navegação por teclado.** Em `components/client-dashboard/ClientVisitDashboard.tsx:1112-1126`, a lista de sugestões é um `<div>` absoluto contendo `<button>`s. Não há `role="listbox"`/`role="option"`, o `<Input>` (linha 1106) não expõe `role="combobox"`/`aria-expanded`/`aria-controls`/`aria-activedescendant`, e não há navegação por setas (ArrowUp/ArrowDown), seleção por Enter nem fechamento por Escape. Só é possível interagir com mouse.

### 2.2 Impacto do Problema

- **Quem é afetado:** usuários de leitores de tela e de navegação por teclado (acessibilidade), e todos os usuários quando encontram um diálogo nativo cinza fora do tema premium (consistência percebida do produto).
- **Magnitude:** o problema de labels é sistêmico (atinge praticamente todos os formulários); os diálogos nativos aparecem em 4 fluxos destrutivos; a revogação de link pode ocorrer por clique acidental sem qualquer rede de proteção.
- **Se não resolvido:** barreiras de acessibilidade (risco de conformidade WCAG 2.1 AA, critérios 1.3.1, 4.1.2, 2.1.1), perda de confiança visual e risco de ações destrutivas acidentais (revogação de link sem confirmação).

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Associar label/input com o primitivo `Field` do Base UI (`Field.Root` + `Field.Label` + `Field.Control`) | Já presente no pacote `@base-ui/react`; associação `for`/`id` automática; integra com `Field.Description`/`Field.Error`; alinha ao design system existente (Input/Select/Button são Base UI) | Exige refatorar wrappers dos campos | ✅ Escolhida (preferencial) |
| Adicionar `id` manual + `htmlFor` em cada `<label>` | Mudança mínima, sem novo wrapper | Repetitivo, propenso a IDs duplicados, não cobre `Select`/placeholder-only | ⚠️ Fallback pontual onde `Field` não couber |
| Criar `AlertDialog` em `components/ui/` sobre `@base-ui/react/alert-dialog` | Estilizável (dark/glass), acessível por padrão (foco preso, `role="alertdialog"`, Escape), reutilizável, testável | Requer adaptar callers de `confirm` síncrono para fluxo assíncrono/controlado | ✅ Escolhida |
| Manter `window.confirm`, apenas estilizar via CSS | Sem código novo | Impossível — diálogos nativos não são estilizáveis | ❌ Descartada |
| Combobox acessível sobre `@base-ui/react/combobox` (genérico e reutilizável) | ARIA combobox + teclado (setas/Enter/Escape) prontos; filtro embutido; reúso direto pela 013 | Primeira adoção do primitivo no projeto | ✅ Escolhida |
| Implementar handlers de teclado/ARIA à mão na lista atual | Sem dependência nova | Reinventa o padrão ARIA combobox, propenso a bugs, não genérico para a 013 | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

O design system vive em `components/ui/*` e é construído sobre **`@base-ui/react`** (Base UI) — confirmado em `components/ui/button.tsx`, `input.tsx` e `select.tsx`, todos usando primitivos `@base-ui/react/*` + `cva` + helper `cn`. O pacote já traz os primitivos necessários (`@base-ui/react/field`, `@base-ui/react/alert-dialog`, `@base-ui/react/combobox`), então **nenhuma dependência nova** é introduzida. Esta implementação adiciona três peças ao design system — `Field`, `AlertDialog` e `Combobox` — seguindo o mesmo padrão (`data-slot`, `cn`, classes Tailwind do tema) e refatora os call sites citados para consumi-las. O foco é client components React puros; nenhuma rota/RPC/SQL é alterada.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `components/ui/field.tsx` | Arquivo | Criar | Wrapper sobre `@base-ui/react/field` (`Field.Root/Label/Control/Description/Error`) que associa label↔input automaticamente |
| `components/ui/alert-dialog.tsx` | Arquivo | Criar | Diálogo de confirmação estilizado (dark/glass) sobre `@base-ui/react/alert-dialog` |
| `components/ui/use-confirm.tsx` | Arquivo | Criar | Hook/provider que expõe `confirm()` imperativo retornando `Promise<boolean>`, para substituir `window.confirm` sem reescrever a lógica de cada caller |
| `components/ui/combobox.tsx` | Arquivo | Criar | Combobox **genérico** e acessível sobre `@base-ui/react/combobox` (props para itens, label, placeholder, `onValueChange`) |
| `components/auth/LoginForm.tsx` | Arquivo | Modificar | Associar labels de Email/Senha aos inputs (linhas 57,75) |
| `components/reports/ReportFilterBar.tsx` | Arquivo | Modificar | `aria-label`/associação nos Select e Input de filtro (linhas 68,80,91,120,150) |
| `app/(protected)/team/page.tsx` | Arquivo | Modificar | Labels/`aria-label` nos inputs do convite (291-292, 344, 348); trocar `confirm` (150) pelo `AlertDialog` |
| `components/upload/DropZone.tsx` | Arquivo | Modificar | Trocar `window.confirm` de sobreposição (49) pelo `AlertDialog` |
| `app/(protected)/config/page.tsx` | Arquivo | Modificar | Trocar `confirm` de exclusão (139) pelo `AlertDialog` |
| `components/report-chat/ReportChat.tsx` | Arquivo | Modificar | Trocar `window.confirm` de exclusão de conversa (107) pelo `AlertDialog` |
| `components/client-dashboard/ShareLinksManager.tsx` | Arquivo | Modificar | Adicionar confirmação ao `revoke()` (25) via `AlertDialog` |
| `components/client-dashboard/ClientVisitDashboard.tsx` | Arquivo | Modificar | Trocar a lista de sugestões manual (1106,1112-1126) pelo `Combobox` acessível |

### 3.3 Interfaces e Contratos

#### Entradas

- `Field`: `children` (label + controle), `htmlFor` derivado automaticamente pelo primitivo; props opcionais de descrição/erro.
- `AlertDialog` (declarativo): `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `cancelLabel`, `variant` (`'destructive' | 'default'`), `onConfirm`.
- `useConfirm` (imperativo): `confirm({ title, description, confirmLabel?, cancelLabel?, variant? }) → Promise<boolean>`.
- `Combobox<T>`: `items: T[]`, `value`, `onValueChange`, `itemToString`/`itemToValue`, `label`/`aria-label`, `placeholder`, `emptyMessage`.

#### Saídas

- Markup acessível: `Field` produz `<label for=...>` + controle com `id` correspondente; `AlertDialog` produz `role="alertdialog"` com foco preso e fechamento por Escape; `Combobox` produz `role="combobox"`/`role="listbox"`/`role="option"` com `aria-expanded`/`aria-controls`/`aria-activedescendant`.
- `useConfirm` resolve `true` (confirmado) ou `false` (cancelado/Escape/clique fora).

#### Contratos de API (se aplicável)

N/A — nenhuma mudança de contrato HTTP, RPC ou schema. Apenas componentes de UI client-side.

### 3.4 Modelos de Dados (se aplicável)

N/A — sem alteração de dados ou persistência.

### 3.5 Fluxo de Execução

**Confirmação destrutiva (ex.: revogar link / excluir conversa):**
1. Usuário aciona a ação destrutiva.
2. O caller chama `await confirm({ title, description, variant: 'destructive' })` (hook) — ou renderiza `<AlertDialog>` controlado.
3. O diálogo abre com foco no botão seguro (Cancelar), prende o foco e escuta Escape.
4. Se o usuário confirma → a Promise resolve `true` e a ação prossegue (fetch DELETE etc.); caso contrário resolve `false` e nada acontece.

**Combobox de cliente:**
1. Usuário foca o input → `role="combobox"`, `aria-expanded` reflete o estado.
2. Ao digitar, a lista (`role="listbox"`) filtra e expõe `role="option"`.
3. ArrowDown/ArrowUp movem o `aria-activedescendant`; Enter seleciona; Escape fecha.
4. A seleção dispara `onValueChange`, mantendo a lógica atual de `handleSelectClient`.

### 3.6 Tratamento de Erros

- `useConfirm`/`AlertDialog`: cancelar, pressionar Escape ou clicar no backdrop equivale a "não confirmado" (resolve `false`) — nunca executa a ação destrutiva por engano.
- Se um caller for migrado para fluxo assíncrono, garantir que o estado de carregamento (`processingId`, `submitting`) só seja ativado **após** a confirmação positiva.
- `Combobox`: lista vazia exibe `emptyMessage` acessível; nenhuma exceção nova é introduzida; o fallback de teclado é fornecido pelo primitivo.
- Associação de label não altera validação existente (`required`, `type=email`) — apenas adiciona semântica.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** Todo input/select com rótulo visível deve estar programaticamente associado ao seu rótulo (via `Field`/`htmlFor`+`id` ou `aria-label`), sem `<label>` órfão.
- **RF-002:** Inputs que hoje só têm `placeholder` (convite de representante em `team/page.tsx:291-292`) devem receber rótulo acessível (`label` associado ou `aria-label`).
- **RF-003:** Os Select de filtro (`ReportFilterBar.tsx:68,80,91,120`) e o Input de produto (`:150`) devem expor `aria-label` quando o rótulo não estiver associado por `for`/`id`.
- **RF-004:** Todas as confirmações destrutivas via `window.confirm`/`alert` (DropZone:49, config:139, team:150, ReportChat:107) devem usar o novo `AlertDialog` estilizado.
- **RF-005:** A revogação de link (`ShareLinksManager.tsx:25`) deve pedir confirmação explícita antes de executar.
- **RF-006:** A lista de sugestões de cliente (`ClientVisitDashboard.tsx:1112-1126`) deve ser substituída por um Combobox com semântica ARIA combobox e navegação por teclado (setas, Enter, Escape).
- **RF-007:** O Combobox deve ser genérico (tipado, agnóstico de domínio) e exportado de `components/ui/` para reúso pela implementação 013.

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** Sem dependências novas — usar os primitivos `@base-ui/react` já instalados (`field`, `alert-dialog`, `combobox`).
- **RNF-002:** Os novos componentes seguem o padrão do design system: `data-slot`, helper `cn`, classes Tailwind do tema dark/glass, e (quando aplicável) `cva` como em `button.tsx`.
- **RNF-003:** Conformidade com WCAG 2.1 AA nos critérios 1.3.1 (informação e relações), 2.1.1 (teclado), 4.1.2 (nome, função, valor).
- **RNF-004:** Sem regressão visual perceptível nos formulários e sem mudança de comportamento das ações não destrutivas.

### 4.3 Restrições e Limitações

- Esta versão do Next/React pode diferir do conhecido; conferir a API real de `@base-ui/react/field`, `/alert-dialog` e `/combobox` em `node_modules` antes de codar (os primitivos foram confirmados presentes, mas as props exatas devem ser verificadas).
- Migrar `window.confirm` (síncrono) para diálogo controlado exige tornar o handler assíncrono — atenção a callers que disparam dentro de `onSubmit`.
- Escopo limitado a client components de UI; não cobre auditoria completa de contraste de cores nem de toda a árvore (foco nos achados listados).

## 5. Critérios de Aceitação

- [ ] **CA-001:** `grep htmlFor` (ou equivalente via `Field`) passa a encontrar associação para todos os campos rotulados de LoginForm, ReportFilterBar e team/page; nenhum `<label>` órfão permanece nesses arquivos.
- [ ] **CA-002:** Os inputs do convite de representante (Nome/Email) têm rótulo acessível anunciado por leitor de tela.
- [ ] **CA-003:** Existe `components/ui/alert-dialog.tsx` estilizado no tema dark/glass, com foco preso e fechamento por Escape.
- [ ] **CA-004:** Nenhum `window.confirm`/`window.alert`/`confirm(`/`alert(` permanece em DropZone, config/page, team/page e ReportChat (verificável por busca).
- [ ] **CA-005:** Revogar link exibe confirmação; cancelar não revoga; confirmar revoga.
- [ ] **CA-006:** Existe `components/ui/combobox.tsx` genérico; o dashboard de cliente o usa com `role="combobox"`/`role="listbox"`/`role="option"` e navegação por teclado (setas/Enter/Escape) funcionais.
- [ ] **CA-007:** `npm run lint`, `npm run typecheck` e `npm run build` passam.

## 6. Plano de Testes

### 6.1 Testes Unitários

- `AlertDialog`/`useConfirm`: confirmar resolve `true`; cancelar/Escape/backdrop resolve `false` (React Testing Library).
- `Combobox`: digitar filtra opções; ArrowDown move o item ativo; Enter seleciona e dispara `onValueChange`; Escape fecha.
- `Field`: o `id` do controle bate com o `for` do label renderizado.

### 6.2 Testes de Integração

- LoginForm/ReportFilterBar: cada campo tem nome acessível (consultar por `getByLabelText`/`getByRole` com `name`).
- Fluxo de exclusão de conversa (ReportChat): abrir diálogo → confirmar → chamada DELETE; cancelar → nenhuma chamada.

### 6.3 Testes de Aceitação

- Percorrer LoginForm, ReportFilterBar, team (convite) e o dashboard de cliente **apenas com teclado** e com leitor de tela (NVDA/VoiceOver), confirmando rótulos e navegação do combobox.
- Verificar que todos os diálogos destrutivos respeitam o tema dark/glass.

### 6.4 Casos de Borda (Edge Cases)

- Combobox sem resultados (lista vazia) — exibe `emptyMessage` e não trava o teclado.
- Confirmação acionada dentro de `onSubmit` (convite/licença) — não submeter antes de confirmar.
- Múltiplos `ShareLinksManager` na mesma página — cada confirmação isola seu link.
- Foco retorna ao gatilho após fechar o diálogo.
- Tab order correto quando o combobox está aberto sobre o conteúdo (z-index do popup).

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| API real do primitivo Base UI diferente do esperado (`field`/`combobox`/`alert-dialog`) | Média | Médio | Conferir tipos em `node_modules/@base-ui/react/*` antes de codar; espelhar o padrão de `select.tsx` |
| Migração de `confirm` síncrono → assíncrono introduzir regressão em handlers | Média | Médio | Preferir o hook `useConfirm` (mantém fluxo imperativo `await`); cobrir com teste de integração |
| Combobox não ficar realmente genérico e travar a reutilização pela 013 | Baixa | Alto | Projetar com props tipadas (`items`/`itemToString`/`onValueChange`) e revisar com o caso de uso da 013 antes de fechar |
| Regressão visual nos formulários ao introduzir `Field` | Baixa | Baixo | Manter as classes Tailwind atuais nos controles; revisão visual nos formulários afetados |

## 8. Dependências

### 8.1 Dependências Internas

- **Pré-requisito recomendado:** nenhuma implementação bloqueia esta; é uma melhoria transversal de UI.
- **Dependente desta (importante):** a **implementação 013 (autocomplete do filtro de produto)** depende diretamente do componente `components/ui/combobox.tsx` criado aqui. O Combobox deve ser projetado genérico para que a 013 o reutilize sem fork. A 013 **não** deve começar antes de o Combobox estar estabilizado nesta implementação.

### 8.2 Dependências Externas

- `@base-ui/react` — já presente; primitivos `field`, `alert-dialog` e `combobox` confirmados em `node_modules`.
- `lucide-react` (ícones) e `class-variance-authority`/`cn` — já presentes e usados pelo design system.

## 9. Observações e Decisões de Design

- **Base UI, não Radix:** o design system (`components/ui/button.tsx`, `input.tsx`, `select.tsx`) é construído sobre `@base-ui/react`. Os novos componentes devem usar os mesmos primitivos (`Field`, `AlertDialog`, `Combobox`) e convenções (`data-slot`, `cn`, Tailwind), evitando introduzir Radix ou handlers ARIA manuais.
- **`Field` como solução preferencial de labels:** em vez de espalhar `id`+`htmlFor` manualmente (com risco de IDs duplicados), o primitivo `@base-ui/react/field` faz a associação automaticamente e ainda padroniza descrição/erro. `aria-label` fica reservado para controles sem rótulo visível (ícones, alguns Select de filtro).
- **`useConfirm` para minimizar churn:** expor um hook imperativo que retorna `Promise<boolean>` permite trocar `if (!window.confirm(...)) return;` por `if (!(await confirm({...}))) return;`, preservando a estrutura dos handlers existentes.
- **Combobox genérico por design:** o componente nasce agnóstico de domínio porque será o alicerce de pelo menos dois consumidores (dashboard de cliente aqui e filtro de produto na 013). Decisão registrada para que a 013 dependa deste artefato.
- **Sem dependência nova / sem mudança de dados:** toda a implementação reusa primitivos já instalados e não toca rotas, RPCs nem schema — risco contido à camada de apresentação.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

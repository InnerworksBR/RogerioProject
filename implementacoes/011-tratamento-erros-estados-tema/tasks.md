# Tarefas: Tratamento de Erros, Estados e Tema

> **Implementação:** 011 - Tratamento de Erros, Estados e Tema
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

### Fase 1: Preparação e Setup

- [x] **T-001:** Confirmar convenções desta versão do Next
  - **Descrição:** Antes de criar qualquer arquivo-convenção, ler os docs de error handling / not-found instalados e anotar assinaturas e regras (props de `error`/`global-error`, exigência de `<html>/<body>` no `global-error`, comportamento de `not-found`).
  - **Arquivos envolvidos:** `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`
  - **Critério de conclusão:** Assinaturas e restrições confirmadas e registradas; nenhuma suposição vinda do conhecimento prévio.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Observações:** Orientação do `AGENTS.md` — esta versão tem convenções alteradas.

### Fase 2: Implementação Core

- [x] **T-002:** Criar `app/(protected)/error.tsx` (error boundary glass)
  - **Descrição:** Client Component (`"use client"`) que captura exceções das páginas protegidas, exibe tela no padrão glass/dark e oferece botão "Tentar novamente" chamando `reset()`. Sem expor stack ao usuário; logar `error.digest` se útil.
  - **Arquivos envolvidos:** `app/(protected)/error.tsx` (criar), `app/(protected)/page.tsx` e `app/(protected)/reports/*` (origem dos erros), `app/layout.tsx` (padrão glass)
  - **Critério de conclusão:** Forçar uma exceção numa página protegida exibe a tela glass e o botão reexecuta a rota (CA-001).
  - **Dependências:** T-001
  - **Estimativa:** Média

- [x] **T-003:** Criar `app/not-found.tsx` e `app/global-error.tsx` no padrão glass
  - **Descrição:** `not-found.tsx` no tema glass com link para `/`. `global-error.tsx` como Client Component que renderiza `<html lang="pt-BR">/<body>` próprios e a tela glass, cobrindo falhas do root layout.
  - **Arquivos envolvidos:** `app/not-found.tsx` (criar), `app/global-error.tsx` (criar), `app/layout.tsx` (referência de markup/tema)
  - **Critério de conclusão:** URL inexistente exibe o 404 glass com link funcional; `global-error.tsx` monta `<html>/<body>` próprios (CA-002, CA-003).
  - **Dependências:** T-001
  - **Estimativa:** Média

- [x] **T-004:** Fixar tema dark no Toaster (sonner)
  - **Descrição:** Eliminar a dependência do default `"system"` do `useTheme()` sem `ThemeProvider`: fixar `theme="dark"` no `<Sonner>` (opção recomendada na seção 9) ou montar `ThemeProvider` com `forcedTheme="dark"`. Garantir toasts em dark com o SO em modo claro.
  - **Arquivos envolvidos:** `components/ui/sonner.tsx:8,12`, `app/layout.tsx:19,26`
  - **Critério de conclusão:** Com o SO em modo claro, os toasts aparecem em tema dark (CA-004).
  - **Dependências:** Nenhuma (pode ir em paralelo com T-002/T-003)
  - **Estimativa:** Pequena

- [x] **T-005:** Diferenciar "sem dados" de "erro" na home
  - **Descrição:** No bloco de IA de `app/(protected)/page.tsx`, consumir o `reason` de `buildAIReportSummary` (`no_data` × `missing_api_key`/`missing_year`) e tratar a exceção capturada no `try/catch` como estado de erro próprio — não como "ainda não processou dados suficientes". Nos rankings de líder, capturar `{ data, error }` das RPCs e não exibir erro como "Nenhum dado encontrado.".
  - **Arquivos envolvidos:** `app/(protected)/page.tsx:42-45,48-59,158-162,188,214`, `lib/server/aiSummary.ts:220,224,235,259` (referência do `reason`)
  - **Critério de conclusão:** IA indisponível por config/rede exibe mensagem distinta de "sem dados"; erro de RPC não vira lista vazia (CA-005).
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-006:** Corrigir a copy do hero do dashboard de cliente
  - **Descrição:** Ajustar o texto em `ClientVisitDashboard.tsx:1169-1170` para refletir o cálculo determinístico local de `buildClientVisitDashboard`, removendo a promessa de "A inteligência artificial fará o cruzamento de histórico". Apenas texto; sem mudança de lógica.
  - **Arquivos envolvidos:** `components/client-dashboard/ClientVisitDashboard.tsx:1169-1170`
  - **Critério de conclusão:** O hero não menciona IA fazendo o cruzamento; a copy descreve o dashboard instantâneo gerado localmente (CA-006).
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 3: Testes e Validação

- [x] **T-007:** Validação integrada e suíte completa
  - **Descrição:** `npm run typecheck` (limpo — `unstable_retry` confere com a versão instalada do Next 16.2.6), `npm test` (31/31) e `npm run build` (24 rotas, sem erros) executados em 2026-06-15. Verificação manual (erro server-side, 404, toast, hero) deve ser feita em staging.
  - **Arquivos envolvidos:** suíte de build/typecheck, app local
  - **Critério de conclusão:** Comandos passam; verificação manual confirma fronteiras de erro, 404, tema do toast e copy corrigida (CA-001..CA-007).
  - **Dependências:** T-002, T-003, T-004, T-005, T-006
  - **Estimativa:** Média
  - **Data de conclusão:** 2026-06-15 (gates automatizados; verificação manual em staging)

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-15 | Next v16 usa `unstable_retry`, não `reset`; `not-found` sem props |
| T-002  | ✅ Concluída | 2026-06-15 | `app/(protected)/error.tsx` criado com padrão glass |
| T-003  | ✅ Concluída | 2026-06-15 | `app/not-found.tsx` e `app/global-error.tsx` criados |
| T-004  | ✅ Concluída | 2026-06-15 | `theme="dark"` fixado; `useTheme()` removido |
| T-005  | ✅ Concluída | 2026-06-15 | Discriminador `reason` consumido; erros de RPC capturados |
| T-006  | ✅ Concluída | 2026-06-15 | Copy do hero corrigida — sem menção à IA |
| T-007  | ✅ Concluída | 2026-06-15 | typecheck + 31 testes + build OK; manuais em staging |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.

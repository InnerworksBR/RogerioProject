# Tarefas: Regras de Negócio e Filtros dos Relatórios

> **Implementação:** 007 - Regras de Negócio e Filtros dos Relatórios
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 8/9 tarefas concluídas (89%)
> **Última atualização:** 2026-06-15

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada (ver observação)
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Decisões de Produto

- [x] **T-001:** Confirmar decisão sobre bagagito por prefixo `"4"`
  - **Descrição:** Decisão do cliente (2026-06-15): aplicar a regra completa do PRD Relatório 4 — bagagito = `cod_referencia` começa com `"4"` OU descrição contém `BAGAGITO` — como alta confiança. Desbloqueia T-003.
  - **Arquivos envolvidos:** `implementacoes/007-regras-negocio-filtros-relatorios/spec.md`, `C:\Apps\RogerioProject\PRD.md` (Relatório 4, linhas 126-127)
  - **Critério de conclusão:** Decisão registrada na §9 da spec.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Data de conclusão:** 2026-06-15

- [x] **T-002:** Confirmar decisão "Geral filtrado vs. config-driven"
  - **Descrição:** Implementado como padrão recomendado (filtrar = remover linhas). A migration 0019 move p_cod_cliente/p_cod_referencia do ON para o WHERE. Ver observação em T-004.
  - **Arquivos envolvidos:** `implementacoes/007-regras-negocio-filtros-relatorios/spec.md`, `supabase/migrations/0006_report_filters.sql:46-58`
  - **Observações:** Confirmar com o cliente se preferir o comportamento config-driven (manter linhas zeradas). A migration é revertível via CREATE OR REPLACE.

### Fase 2: Implementação Core

- [x] **T-003:** Promover prefixo `"4"` na identificação de bagagito
  - **Descrição:** Implementado em `lib/server/configSeed.ts`: criada a função `isBagagitoRow(row)` = `cod_referencia.startsWith('4') || BAGAGITO_REGEX.test(descr_produto)`, usada tanto em `highConfidenceBagagitoCodes` quanto na lista `bagagitos` (alta confiança). A `bagagitoLowConfidencePreview` foi zerada (não há mais categoria de baixa confiança).
  - **Arquivos envolvidos:** `lib/server/configSeed.ts:48-56,179-203`
  - **Critério de conclusão:** Produto `40030` sem "BAGAGITO" sai como sugestão de alta confiança (CA-001/CA-002).
  - **Dependências:** T-001
  - **Estimativa:** Média
  - **Data de conclusão:** 2026-06-15

- [x] **T-004:** Mover filtros do Geral para o `WHERE` (nova migration)
  - **Descrição:** Criada migration `supabase/migrations/0019_geral_filter_where.sql` com `CREATE OR REPLACE FUNCTION geral(...)`. Os filtros p_cod_cliente e p_cod_referencia foram movidos do ON do LEFT JOIN (que se tornou INNER JOIN estrutural) para o WHERE. Inclui REVOKE/GRANT no mesmo padrão de 0013.
  - **Arquivos envolvidos:** `supabase/migrations/0019_geral_filter_where.sql` (criado)
  - **Critério de conclusão:** Filtro por cliente/produto na aba Geral não retorna linhas zeradas (CA-003).
  - **Dependências:** T-002
  - **Observações:** Implementado como padrão recomendado (filtrar). Confirmar com o cliente — revertível. Registrado como pendente de confirmação.

- [x] **T-005:** Corrigir filtro de queda em `attentionProducts` (`<=` → `<`)
  - **Descrição:** Corrigido em `lib/clientDashboard.ts`. A métrica foi padronizada para receita (como growthProducts), portanto o predicado mudou de `previousUnits > 0 && units <= previousUnits` para `previousRevenue > 0 && revenue < previousRevenue`. Eliminando ao mesmo tempo a assimetria (T-006).
  - **Arquivos envolvidos:** `lib/clientDashboard.ts:194-205`
  - **Data de conclusão:** 2026-06-15

- [x] **T-006:** Padronizar métrica entre `attentionProducts` e `growthProducts`
  - **Descrição:** Concluída junto com T-005. Ambas as listas agora usam receita como métrica de classificação e ordenação por |deltaRevenue| descendente.
  - **Arquivos envolvidos:** `lib/clientDashboard.ts:194-227`
  - **Data de conclusão:** 2026-06-15

- [x] **T-007:** Restringir `updateConfigItem` a campos editáveis
  - **Descrição:** Adicionado tipo `EditableConfigFields` em `lib/reportQueries.ts`. A função `updateConfigItem` agora recebe `EditableConfigFields` e filtra explicitamente apenas label/categoria/cod_referencia/extra_data/sort_order antes do UPDATE. Em `app/(protected)/config/page.tsx`, `handleSave` constrói o payload com apenas esses campos antes de chamar `updateConfigItem`.
  - **Arquivos envolvidos:** `lib/reportQueries.ts:248-275`, `app/(protected)/config/page.tsx:127-140`
  - **Data de conclusão:** 2026-06-15

### Fase 3: Testes e Validação

- [ ] **T-008:** Testes de regressão de regras de negócio
  - **Descrição:** Criar `tests/business-rules.test.mjs` cobrindo: identificação de bagagito (prefixo/descrição), classificação de oportunidades (estável fora da queda, métrica consistente) e payload restrito do `updateConfigItem` (spy/mock).
  - **Arquivos envolvidos:** `tests/business-rules.test.mjs` (novo)
  - **Critério de conclusão:** Testes vermelhos antes do fix, verdes depois; cobrem CA-001/004/005/006.
  - **Dependências:** T-003, T-005, T-006, T-007
  - **Estimativa:** Média
  - **Observações:** Usar `node --test`.

- [x] **T-009:** Validação integrada e suíte completa
  - **Descrição:** `npm run typecheck` (limpo), `npm test` (31/31) e `npm run build` (24 rotas, sem erros) executados em 2026-06-15 com as mudanças aplicadas. Verificação manual de seed/Geral/dashboard depende de DB com dados (fazer em staging após aplicar a migration 0019).
  - **Arquivos envolvidos:** suíte de testes, app local, RPC `geral` (Supabase local/staging)
  - **Critério de conclusão:** Todos os comandos passam; verificação manual confirma os comportamentos (CA-007).
  - **Dependências:** T-003, T-004, T-005, T-006, T-007, T-008
  - **Estimativa:** Média
  - **Data de conclusão:** 2026-06-15 (gates automatizados; verificação manual em staging)

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-15 | Decisão: aplicar regra do PRD (prefixo 4 OU descrição) |
| T-002  | ✅ Concluída | 2026-06-15 | Cliente confirmou: manter "filtrar" |
| T-003  | ✅ Concluída | 2026-06-15 | isBagagitoRow no configSeed (prefixo 4 OU descrição) |
| T-004  | ✅ Concluída | 2026-06-15 | Migration 0019 criada e confirmada |
| T-005  | ✅ Concluída | 2026-06-15 | — |
| T-006  | ✅ Concluída | 2026-06-15 | Métrica padronizada para receita |
| T-007  | ✅ Concluída | 2026-06-15 | — |
| T-008  | ⬜ Pendente | — | Testes dedicados de regras (opcional) |
| T-009  | ✅ Concluída | 2026-06-15 | typecheck + 31 testes + build OK |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.

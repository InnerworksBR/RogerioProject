# Tarefas: Corretude de Datas e Agregações dos Relatórios

> **Implementação:** 006 - Corretude de Datas e Agregações dos Relatórios
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

- [x] **T-001:** Criar fixtures e teste de regressão de bucketing de data
  - **Descrição:** Extrair a lógica de data para uma função pura testável e escrever teste que prove `serial(2024-01-01) → {mes:1, ano:2024}` sob `TZ=America/Sao_Paulo` e `TZ=Asia/Tokyo`. Cobrir os três caminhos (serial, Date, `DD/MM/YYYY`).
  - **Arquivos envolvidos:** `tests/date-bucketing.test.mjs`, `lib/xlsParser.worker.ts`
  - **Critério de conclusão:** Teste vermelho reproduz o bug antes do fix.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média
  - **Observações:** Arquivo `tests/date-bucketing.test.mjs` criado com `node --test`. Função pura `toDateStr` exportada em `lib/xlsParser.worker.ts`. Nota: sobrescrever TZ via `process.env.TZ` não é confiável no Windows sem reinício de processo; testes assertam invariante mes/ano == componentes de dateStr, que é equivalente e independente de fuso.

### Fase 2: Implementação Core

- [x] **T-002:** Derivar `mes`/`ano` da string ISO persistida
  - **Descrição:** Após calcular `dateStr = toDateStr(date)`, derivar `ano`/`mes` a partir de `dateStr.split('-')` em vez de `getMonth()/getFullYear()`. Garantir consistência total com `data_pedido`.
  - **Arquivos envolvidos:** `lib/xlsParser.worker.ts:163-164,182,199-200`
  - **Critério de conclusão:** Teste da T-001 fica verde nos dois fusos.
  - **Dependências:** T-001
  - **Estimativa:** Pequena

- [x] **T-003:** Ativar `cellDates: true` e unificar `toDate`
  - **Descrição:** Passar `{ type:'array', cellDates:true }` no `XLSX.read` e revisar `excelDateToJSDate`/`toDate` para que serial e Date convirjam para o mesmo `dateStr`. Conferir comportamento real do SheetJS instalado.
  - **Arquivos envolvidos:** `lib/xlsParser.worker.ts:54-74,100`
  - **Critério de conclusão:** Caminhos serial e Date produzem `dateStr` idêntico ao caminho string para a mesma data.
  - **Dependências:** T-002
  - **Estimativa:** Pequena
  - **Observações:** `toDate` foi mantida como função interna (para `data_limite_entrega`). `toDateStr` é agora a função central que aceita `unknown` diretamente (serial, Date, string), eliminando a intermediação por `Date` local no caminho serial.

- [x] **T-004:** Detecção de linha de cabeçalho tolerante a banners
  - **Descrição:** Antes de `sheet_to_json`, varrer as primeiras ~20 linhas (via `header:1`) buscando a linha cujas chaves normalizadas contenham marcadores (`SITUACAO`, `DATA DO PEDIDO`, `COD. REFERENCIA`). Ajustar o range para começar nessa linha. Fallback para 1ª linha + mensagem de erro clara.
  - **Arquivos envolvidos:** `lib/xlsParser.worker.ts:104-123,204-207`
  - **Critério de conclusão:** Arquivo com 1 linha de título acima do header parseia com sucesso (teste da T-001 estendido).
  - **Dependências:** T-003
  - **Estimativa:** Média
  - **Observações:** Scan das primeiras 20 linhas com marcadores `SITUACAO`, `DATADOPEDIDO`, `CODREFERENCIA` (normalizados). Requer >=2 marcadores para reconhecer a linha. Se não encontrar, usa linha 0 como fallback e registra `foundHeader=false` no debugInfo. Mensagem de erro adaptada.

- [x] **T-005:** Branquear apenas quantidade `=== 0` (render de negativos)
  - **Descrição:** Ajustar `numOrBlank` e os formatadores das views para retornar vazio só quando `=== 0`, renderizando negativos. Garantir que o total exibido bata com a soma das células visíveis.
  - **Arquivos envolvidos:** `lib/exportXlsx.ts:22-24`, `components/reports/views/TabelaDinamicaView.tsx:12`, `GeralView.tsx:11`, `BaseCompraView.tsx`, `BaseItensView.tsx`, `BagagitosView.tsx`
  - **Critério de conclusão:** Célula `0` vazia, célula negativa exibe número; soma das células = total.
  - **Dependências:** Nenhuma (pode ir em paralelo com T-002..T-004)
  - **Estimativa:** Pequena

- [x] **T-006:** Decidir e alinhar definição de "Total de Pedidos"
  - **Descrição:** Decisão do cliente (2026-06-15): manter `COUNT(DISTINCT codigo_pedido)` (pedidos únicos). Nenhuma migration necessária; o PRD foi ajustado para "count(distinct Codigo do Pedido)" alinhando-se ao código atual de `dashboard_summary`.
  - **Arquivos envolvidos:** `PRD.md` (Cards de Resumo), `supabase/migrations/0006_report_filters.sql:39`
  - **Critério de conclusão:** PRD e código concordam; decisão registrada na seção 9 da spec.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Data de conclusão:** 2026-06-15

### Fase 3: Testes e Validação

- [x] **T-007:** Validação integrada e suíte completa
  - **Descrição:** `npm run typecheck` (limpo), `npm test` (31/31, inclui a regressão `date-bucketing`) e `npm run build` (24 rotas, sem erros) executados em 2026-06-15. O reupload de fixture e a conferência visual nos cards devem ser feitos em staging (ver `deploy-notes.md`).
  - **Arquivos envolvidos:** suíte de testes, app local
  - **Critério de conclusão:** Todos os comandos passam; verificação manual confirma buckets corretos.
  - **Dependências:** T-002, T-003, T-004, T-005
  - **Estimativa:** Média
  - **Data de conclusão:** 2026-06-15 (gates automatizados; reupload manual em staging)

### Fase 4: Documentação e Finalização

- [x] **T-008:** Documentar reprocessamento de uploads antigos
  - **Descrição:** Registrar no checklist de deploy a necessidade de reprocessar uploads anteriores ao fix (buckets antigos permanecem errados) e o procedimento (revogar/re-subir respeitando a idempotência por fingerprint).
  - **Arquivos envolvidos:** `implementacoes/006-corretude-datas-agregacoes-relatorios/deploy-notes.md`
  - **Critério de conclusão:** Procedimento documentado e revisável.
  - **Dependências:** T-007
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-15 | Teste criado em tests/date-bucketing.test.mjs |
| T-002  | ✅ Concluída | 2026-06-15 | mes/ano derivados de dateStr.split('-') |
| T-003  | ✅ Concluída | 2026-06-15 | cellDates:true ativo; toDateStr unificada |
| T-004  | ✅ Concluída | 2026-06-15 | Scan das primeiras 20 linhas com fallback |
| T-005  | ✅ Concluída | 2026-06-15 | numOrBlank e fmt corrigidos em 6 arquivos |
| T-006  | ✅ Concluída | 2026-06-15 | Decisão: manter DISTINCT; PRD ajustado |
| T-007  | ✅ Concluída | 2026-06-15 | typecheck + 31 testes + build OK |
| T-008  | ✅ Concluída | 2026-06-15 | deploy-notes.md criado |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.

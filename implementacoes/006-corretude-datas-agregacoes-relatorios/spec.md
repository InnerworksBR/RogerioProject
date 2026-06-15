# Corretude de Datas e Agregações dos Relatórios

> **ID:** 006
> **Status:** 🟢 Concluída
> **Prioridade:** 🔴 Crítica
> **Criada em:** 2026-06-15
> **Última atualização:** 2026-06-15
> **Autor:** Agente AI

---

## 1. Resumo Executivo

O parsing de planilhas XLS atribui `mes`/`ano` a partir de getters de fuso local (`getMonth`/`getFullYear`) enquanto a data armazenada (`data_pedido`) é derivada de `toISOString()` (UTC). Como datas seriais do Excel são convertidas para meia-noite **UTC**, no fuso do Brasil (UTC-3) toda venda do **dia 1º de cada mês** é contabilizada no mês/ano **anterior**, invalidando silenciosamente todos os relatórios pivô. Esta implementação corrige a derivação de mês/ano para que seja consistente com a data persistida, torna o parsing tolerante a linhas de título acima do cabeçalho e alinha a definição de "Total de Pedidos" e o tratamento de quantidades negativas com a regra de exibição. É a correção de maior impacto da auditoria.

## 2. Contexto e Motivação

### 2.1 Problema Atual

Em `lib/xlsParser.worker.ts`:

- `excelDateToJSDate` (linhas 54-58) constrói `new Date(utcDays * 86400 * 1000)`, ou seja, **meia-noite UTC** do dia.
- `toDateStr` (linhas 87-90) usa `d.toISOString().split('T')[0]` → string de calendário em **UTC**.
- `mes`/`ano` (linhas 163-164) usam `dataPedido.getMonth()+1` e `getFullYear()` → componentes de **fuso local**.

Para um serial correspondente a `2024-01-01`, `data_pedido` resulta em `"2024-01-01"` (UTC), mas em `America/Sao_Paulo` (UTC-3) a mesma instância é `2023-12-31T21:00`, então `mes = 12` e `ano = 2023`. Verificado executando o código: a divergência ocorre em toda data serial cujo horário UTC seja 00:00, o que é sempre o caso do caminho serial — então o **dia** sempre regride para o anterior, e **mês/ano** regridem quando o dia é o 1º.

Problemas correlatos detectados na mesma auditoria de corretude:

- **Cabeçalho assumido na 1ª linha** (`sheet_to_json` em modo objeto, linha 104): se o export do ERP tiver uma linha de título/banner acima do cabeçalho, todas as chaves quebram e o arquivo inteiro é rejeitado ("Nenhuma linha válida").
- **`total_pedidos` diverge do PRD**: `dashboard_summary` usa `COUNT(DISTINCT codigo_pedido)` (`supabase/migrations/0006_report_filters.sql:39`), enquanto o PRD define "Total de Pedidos = count(rows)". É preciso decidir e alinhar PRD↔código.
- **Quantidades negativas (devoluções)**: as views e o export branqueiam células `<= 0` (`lib/exportXlsx.ts:22-24`, `views/*`), mas o total anual somado nas RPCs inclui o negativo — mês visível pode não bater com o total exibido.

### 2.2 Impacto do Problema

- **Quem é afetado:** todos os usuários (representantes e líderes) — os números exibidos em todos os 5 relatórios, nos cards de resumo e no dashboard de cliente ficam errados para vendas no 1º do mês e para a virada de ano (1º de janeiro vai para o ano anterior).
- **Magnitude:** silencioso e sistêmico. Não há erro visível; os totais simplesmente caem no bucket errado. Em uma base de ~314k linhas, qualquer fração de pedidos no dia 1º distorce os pivôs mensais/anuais.
- **Se não resolvido:** o produto entrega números incorretos como se fossem corretos — risco de decisão comercial baseada em dado inválido e perda de confiança no sistema.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Derivar `mes`/`ano` a partir da string ISO já persistida (`data_pedido`) | Garante consistência absoluta entre data armazenada e bucket, independentemente do caminho (serial/string) e do fuso | Exige um único ponto de derivação | ✅ Escolhida |
| Trocar getters por `getUTCMonth()/getUTCFullYear()` | Corrige o caminho serial | Caminho string (`new Date(y,m-1,d)`, hora local) volta a divergir em fusos positivos | ❌ Descartada (corrige só metade) |
| Usar `cellDates: true` no `XLSX.read` e confiar no Date do SheetJS | Alinha ao PRD (ponto 5) | SheetJS ainda devolve Date em meia-noite UTC para datas sem hora; não elimina o problema de getters locais sozinho | ⚠️ Adotada como reforço, combinada com a solução escolhida |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

O fluxo de ingestão é: arquivo → Web Worker (`xlsParser.worker.ts`) → chunks → `/api/upload` → RPC `append_upload_chunk`/`finalize_upload` → `sales_rows`. A correção concentra-se no Worker, que é a única fonte de `mes`/`ano`/`data_pedido`. As RPCs já gravam o que o Worker envia, então corrigir a derivação na origem propaga a correção para todo o sistema sem migração de schema.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `lib/xlsParser.worker.ts` | Arquivo | Modificar | Derivar `mes`/`ano` da string ISO; detectar linha de cabeçalho; `cellDates:true` |
| `lib/xlsParser.ts` | Arquivo | Modificar | Espelhar a mesma lógica de data se houver caminho de parsing fora do worker |
| `supabase/migrations/0006_report_filters.sql` | Arquivo | Referência | Definição de `total_pedidos` (decisão; nova migration se mudar) |
| `lib/exportXlsx.ts` | Arquivo | Modificar | Branquear apenas `=== 0`, renderizar negativos |
| `components/reports/views/*.tsx` | Arquivos | Modificar | Branquear apenas `=== 0` nas células de quantidade |
| `tests/date-bucketing.test.mjs` | Arquivo | Criar | Teste de regressão da atribuição mês/ano |
| `PRD.md` | Arquivo | Modificar | Alinhar definição de "Total de Pedidos" à decisão |

### 3.3 Interfaces e Contratos

#### Entradas

- Buffer `ArrayBuffer` de arquivo `.xls`/`.xlsx`; valores de data como serial numérico do Excel, `Date`, ou string `DD/MM/YYYY`.

#### Saídas

- `ParsedRow` com `data_pedido: "YYYY-MM-DD"`, `mes: 1-12`, `ano: number` **mutuamente consistentes**.

#### Contratos de API (se aplicável)

N/A — sem mudança de contrato HTTP. Caso a definição de `total_pedidos` mude, será via nova migration `CREATE OR REPLACE FUNCTION dashboard_summary(...)` mantendo a assinatura atual.

### 3.4 Modelos de Dados (se aplicável)

Sem alteração de schema. `sales_rows.mes` (smallint) e `sales_rows.ano` (smallint) passam a refletir a mesma data de `data_pedido`.

### 3.5 Fluxo de Execução

1. Worker lê o workbook com `cellDates: true`.
2. Detecta a linha de cabeçalho: procura a primeira linha cujas chaves normalizadas contenham marcadores conhecidos (`SITUACAO`, `DATA DO PEDIDO`, `COD. REFERENCIA`). Usa essa linha como header (range ajustado) antes de `sheet_to_json`.
3. Para cada linha: resolve a data via `toDate` (serial/Date/string).
4. Calcula `dateStr = toDateStr(date)` (fonte única da verdade).
5. Deriva `[ano, mes] = dateStr.split('-')` → grava `mes`/`ano` a partir da mesma string. (Alternativa equivalente: derivar a partir dos componentes brutos quando string `DD/MM/YYYY`, e de `getUTC*` quando serial; o resultado deve ser idêntico ao `dateStr`.)
6. Emite chunks normalmente.

### 3.6 Tratamento de Erros

- Se nenhuma linha de cabeçalho reconhecível for encontrada, manter a mensagem de erro atual ("Nenhuma linha válida...") acrescida da dica "cabeçalho não localizado — verifique se o arquivo tem linhas de título acima dos dados".
- Datas inválidas continuam contabilizadas em `skippedByData` com amostra para diagnóstico.
- Nenhuma exceção nova introduzida; comportamento de chunk/erro preservado.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** `mes` e `ano` de cada `ParsedRow` devem corresponder exatamente ao mês e ano de `data_pedido` (string ISO persistida), independentemente do fuso do navegador.
- **RF-002:** Uma venda com data `2024-01-01` deve ser contabilizada em `mes=1, ano=2024` (não dezembro/2023).
- **RF-003:** O parsing deve localizar o cabeçalho mesmo se houver até N linhas de título/banner acima dele.
- **RF-004:** A definição de "Total de Pedidos" deve ser única e idêntica entre PRD e `dashboard_summary`.
- **RF-005:** Células de quantidade devem ficar em branco apenas quando o valor for exatamente `0`; valores negativos devem ser renderizados (e somar coerentemente ao total).

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** Sem regressão de performance perceptível no parsing (a detecção de cabeçalho percorre no máximo as primeiras ~20 linhas).
- **RNF-002:** Correção determinística e independente do fuso/locale da máquina do usuário.
- **RNF-003:** Sem migração destrutiva; dados já ingeridos com bucket errado devem poder ser corrigidos por re-upload (documentar necessidade de reprocessar uploads anteriores).

### 4.3 Restrições e Limitações

- Dados já gravados em `sales_rows` com `mes`/`ano` errados **não** são corrigidos retroativamente por esta mudança — é necessário reprocessar os uploads afetados. Documentar no checklist.
- Esta versão do Next/SheetJS pode diferir do conhecido; conferir `node_modules` antes de assumir comportamento de `XLSX.read`.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Teste automatizado prova que serial de `2024-01-01` resulta em `mes=1, ano=2024` em qualquer fuso (forçar `TZ=America/Sao_Paulo` e `TZ=Asia/Tokyo` no teste).
- [ ] **CA-002:** `data_pedido`, `mes` e `ano` são sempre consistentes para os três caminhos (serial, `Date`, `DD/MM/YYYY`).
- [ ] **CA-003:** Um arquivo com 1 linha de título acima do cabeçalho é parseado com sucesso.
- [ ] **CA-004:** PRD e `dashboard_summary` concordam na definição de "Total de Pedidos"; a decisão está registrada na seção 9.
- [ ] **CA-005:** Célula de quantidade `0` aparece vazia; quantidade negativa aparece com o número (não vazia).
- [ ] **CA-006:** `npm test`, `npm run typecheck` e `npm run build` passam.

## 6. Plano de Testes

### 6.1 Testes Unitários

- Função pura de derivação de data: para serial X, retorna `{dateStr, mes, ano}` esperado; rodar sob dois valores de `TZ`.
- Detecção de cabeçalho: matriz com linha de título extra → header correto identificado.

### 6.2 Testes de Integração

- Parsear um `.xls` de fixture com datas em 1º de mês/ano e conferir que os buckets batem com o esperado após `append_upload_chunk` simulado (mock).

### 6.3 Testes de Aceitação

- Reupload de um arquivo conhecido → cards e Base de Compra exibem os totais nos meses corretos.

### 6.4 Casos de Borda (Edge Cases)

- Data serial em 1º de janeiro (virada de ano).
- Data string `DD/MM/YYYY` com dia 1.
- Arquivo sem cabeçalho reconhecível.
- Quantidade negativa (devolução/estorno) e quantidade zero na mesma linha-produto.
- Fuso do navegador positivo (UTC+9) e negativo (UTC-3).

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Detecção de cabeçalho falha em layout incomum do ERP | Média | Médio | Lista de marcadores múltiplos + fallback para 1ª linha + mensagem de erro clara |
| Dados antigos permanecem com bucket errado | Alta | Alto | Documentar e orientar reprocessamento dos uploads existentes |
| Mudar `total_pedidos` altera número que o cliente já conhece | Média | Baixo | Decidir com o cliente antes; registrar decisão na spec |

## 8. Dependências

### 8.1 Dependências Internas

- Nenhuma implementação pré-requisito. É a base de corretude e deve ser executada **antes** das demais.

### 8.2 Dependências Externas

- SheetJS (`xlsx`) — já presente.

## 9. Observações e Decisões de Design

- **Fonte única da verdade para datas:** toda derivação de `mes`/`ano` passa a vir da string ISO `data_pedido`, eliminando a divergência UTC↔local na origem.
- **Decisão pendente de `total_pedidos`:** recomendação técnica é manter `COUNT(DISTINCT codigo_pedido)` (semanticamente correto para "pedidos") e **ajustar o PRD**, em vez de voltar a `COUNT(*)` (que conta itens/linhas). Confirmar com o cliente antes de fechar o CA-004.
- **Reprocessamento:** após o deploy, os uploads anteriores ao fix mantêm buckets errados; incluir no checklist a orientação de reupload (a idempotência por fingerprint exige revogar/re-subir).

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

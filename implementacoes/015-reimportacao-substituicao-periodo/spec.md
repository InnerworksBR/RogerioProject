# Reimportação com Substituição por Período Exato

> **ID:** 015
> **Status:** 🟢 Concluída
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-30
> **Última atualização:** 2026-06-30
> **Autor:** Agente AI
> **Progresso:** 5/5 tarefas (typecheck + testes automatizados; verificação manual pendente em produção)

---

## 1. Resumo Executivo

O usuário precisa reenviar uma planilha do **mesmo período** (mesmas datas de início/fim) com dados corrigidos, e a base deve passar a refletir a versão mais nova daquele período — sem duplicar valores. O fluxo de upload anterior **impedia** isso por duas travas: (a) um índice único `(user_id, fingerprint)` mais a checagem de duplicado em `PUT /api/upload` bloqueavam qualquer arquivo já visto com a mensagem "Este arquivo ja foi importado." — inclusive registros-fantasma de tentativas que falharam, que não têm nenhuma linha de venda; e (b) a checagem de sobreposição de período tratava o período exato como conflito, exigindo confirmação e, se confirmado, **acumulava** os dois uploads (dobrando os valores do período nos relatórios).

Esta implementação adota a semântica **"substituir o período exato"**: reenviar uma planilha do mesmo período é permitido e automático; a versão nova vira a verdade daquele período. A troca acontece em `finalize_upload` (SQL), que — depois de concluir o novo upload com sucesso — apaga os uploads do **período exato** daquele usuário (cascateando `sales_rows` e `upload_chunks`). Como a remoção só ocorre no finalize, o dado antigo permanece intacto se a importação nova falhar no meio. Sobreposições **parciais** (período diferente que cruza) continuam pedindo confirmação e acumulando, como antes.

## 2. Contexto e Motivação

### 2.1 Problema Atual

- **Bloqueio por fingerprint (`app/api/upload/route.ts`, PUT):** havia uma consulta a `uploads` por `(user_id, fingerprint)` que retornava 409 "Este arquivo ja foi importado." para qualquer registro com o mesmo fingerprint, **independente do status**. Tentativas anteriores que falharam (status `error`/`processing`, sem `sales_rows`) deixavam um registro-fantasma que travava a reimportação. Reforçado pelo índice único `idx_uploads_unique_user_fingerprint` (migration `0005`), que também fazia o `INSERT` falhar com `23505`.
- **Período exato tratado como sobreposição (`route.ts`, PUT):** a checagem `status='complete'` + período sobreposto retornava 409 "Periodo sobreposto." mesmo quando as datas eram idênticas. Ao confirmar (`confirmOverlap`), o sistema inseria um **novo** upload com novas `sales_rows`, somando ao período já existente — dobrando os números nos relatórios.
- **Relatórios somam `sales_rows` sem filtrar status do upload:** as RPCs/consultas (`supabase/migrations/0002_rpc_functions.sql`, `lib/server/reportData.ts`, `lib/reportQueries.ts`) leem `sales_rows` diretamente, então uploads duplicados do mesmo período inflam todos os agregados.

### 2.2 Impacto do Problema

- **Quem é afetado:** todos os usuários que reenviam correções de planilhas (representantes e líderes).
- **Magnitude:** sem solução, o usuário fica **travado** ("arquivo já importado") mesmo após uma falha que não gravou dado, ou — pior — duplica os valores do período se forçar a sobreposição.
- **Se não resolvido:** impossibilidade de corrigir dados já importados sem intervenção manual no banco; risco de relatórios com valores dobrados.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Substituir o período exato no `finalize_upload` (remove uploads do mesmo período após concluir o novo) | Atômico no servidor; não perde dado se a nova importação falhar; não duplica; limpa órfãos do período | Exige migration que altera a função e dropa o índice de fingerprint | ✅ Escolhida |
| Mesclar linha-a-linha (manter iguais, adicionar diferentes, remover ausentes) | Mais próximo de "apenas dados diferentes" | `sales_rows` **não tem chave de negócio única** confiável → diff inseguro; bem mais complexo | ❌ Descartada |
| Acumular os dois uploads (somar) | Menor mudança | Duplica/dobra os valores do período nos relatórios | ❌ Descartada |
| Deletar o período antigo no `PUT` (antes de inserir o novo) | Simples | Perde o dado antigo se a nova importação falhar no meio | ❌ Descartada (a favor do finalize) |

**Decisão de casamento:** substituir apenas quando o período for **exato** (datas de início e fim idênticas). Sobreposições parciais permanecem com o comportamento de aviso/confirmação anterior, por serem ambíguas e poderem remover dados de um upload legítimo de período diferente.

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

Fluxo: `DropZone` (cliente) → `PUT /api/upload` (cria o upload `processing`) → `POST /api/upload` por chunk (`append_upload_chunk`) → último chunk chama `finalize_upload`. A substituição é inteiramente **server-side**: o `PUT` deixa de bloquear o período exato, e o `finalize_upload` faz a troca ao concluir. O cliente não precisa de alterações.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `supabase/migrations/0022_replace_period_on_reupload.sql` | Arquivo | Criar | Dropa `idx_uploads_unique_user_fingerprint`; recria `finalize_upload` para apagar uploads do período exato ao concluir; `NOTIFY pgrst` |
| `app/api/upload/route.ts` (PUT) | Arquivo | Modificar | Remove a checagem de duplicado por fingerprint; exclui o período exato do aviso de sobreposição; remove o tratamento `23505` específico do fingerprint |
| `components/upload/DropZone.tsx` | Arquivo | Referência | Sem alteração — o fluxo de confirmação de sobreposição parcial continua válido |

### 3.3 Interfaces e Contratos

#### Entradas
- `PUT /api/upload`: `{ filename, fingerprint, periodStart, periodEnd, ..., confirmOverlap }` (inalterado).
- `POST /api/upload`: chunks → `append_upload_chunk` (inalterado); último chunk → `finalize_upload(p_upload_id, p_total_chunks)` (assinatura inalterada).

#### Saídas
- `PUT`: 409 "Periodo sobreposto." **apenas** para sobreposições parciais (período exato é excluído da lista `overlaps`). Período exato e fingerprint repetido **não** bloqueiam mais.
- `finalize_upload`: além de marcar o upload como `complete`, remove os uploads do mesmo período exato do usuário (cascade em `sales_rows`/`upload_chunks`).

#### Contratos de API
Assinaturas inalteradas (`PUT/POST/DELETE/GET` e `finalize_upload`/`append_upload_chunk`). Mudança é de comportamento, não de contrato.

### 3.4 Modelos de Dados

Sem novas colunas. Remoção do índice único `idx_uploads_unique_user_fingerprint` — o `fingerprint` deixa de ser chave de unicidade (vira informativo). FKs `sales_rows.upload_id` e `upload_chunks.upload_id` já são `ON DELETE CASCADE`, garantindo a limpeza ao remover o upload antigo.

### 3.5 Fluxo de Execução

1. `PUT`: valida metadados; busca uploads `complete` com período sobreposto; **filtra** os de período exato (que serão substituídos); só pede confirmação se restar sobreposição **parcial**; insere o novo upload (`processing`).
2. `POST` por chunk: `append_upload_chunk` grava `sales_rows` e contabiliza chunks.
3. Último chunk → `finalize_upload`: marca `complete`, lê `period_start`/`period_end` do upload e **apaga** os demais uploads do usuário com o mesmo período exato (cascade). Troca atômica dentro da função.

### 3.6 Tratamento de Erros

- Se a nova importação falhar antes do finalize, o `DELETE /api/upload` marca o upload novo como `error` e remove suas `sales_rows`/`upload_chunks`; **o período antigo permanece intacto** (a remoção só ocorre no finalize bem-sucedido).
- `finalize_upload` mantém os `RAISE EXCEPTION` de autenticação, chunks incompletos e status inválido.
- A remoção é escopada por `v_user_id` (RLS/SECURITY DEFINER), sem afetar outros usuários.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** Reenviar uma planilha do mesmo período exato (datas iguais) deve ser permitido sem o erro "arquivo já importado".
- **RF-002:** Ao concluir a reimportação, os dados anteriores do período exato (de qualquer status) devem ser removidos, deixando apenas a nova versão.
- **RF-003:** Sobreposições **parciais** de período devem continuar exigindo confirmação (`confirmOverlap`) e acumulando se confirmadas.
- **RF-004:** Reenviar o mesmo arquivo (fingerprint idêntico) não deve mais ser bloqueado por unicidade.
- **RF-005:** A troca não deve remover o dado antigo se a nova importação falhar antes de finalizar.

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** A substituição ocorre server-side, sem alteração de contrato de API nem necessidade de mudança no cliente.
- **RNF-002:** A remoção é escopada por usuário (multi-tenant) e atômica dentro de `finalize_upload`.

### 4.3 Restrições e Limitações

- Casamento por **período exato** apenas; sobreposições parciais não substituem a parte em comum (decisão consciente — exigiria granularidade por mês/linha).
- Durante a janela de processamento do novo upload (antes do finalize), os relatórios podem somar temporariamente o período antigo + o novo, pois leem `sales_rows` sem filtrar status. A inconsistência é breve e se resolve no finalize.
- Esta versão do Next pode diferir do conhecido; conferir os guias em `node_modules/next/dist/docs/` antes de escrever código (ver `AGENTS.md`).

## 5. Critérios de Aceitação

- [x] **CA-001:** Com a 0022 aplicada e o código no ar, reenviar a planilha do mesmo período não retorna "arquivo já importado".
- [x] **CA-002:** `route.ts` não contém mais a checagem de duplicado por fingerprint nem o tratamento `23505` específico de fingerprint.
- [x] **CA-003:** O período exato é excluído da lista de `overlaps` (só sobreposição parcial pede confirmação).
- [x] **CA-004:** `finalize_upload` lê o período do upload e apaga os demais uploads do usuário com o mesmo período exato.
- [x] **CA-005:** `npm run typecheck` e `node --test tests/*.test.mjs` passam.
- [ ] **CA-006 (manual, produção):** após deploy + migration, reimportar uma planilha corrigida do mesmo período substitui os dados sem duplicar nos relatórios.

## 6. Plano de Testes

### 6.1 Testes Automatizados
- `npm run typecheck` (tsc --noEmit) — verde.
- `node --test tests/*.test.mjs` — 40/40 (inclui a regressão que verifica o texto `(user_id, fingerprint)` na migration `0005`, que permanece intocada).

### 6.2 Testes de Aceitação (manual em produção)
- Importar período A; reimportar A corrigido → relatórios refletem só a nova versão (sem dobrar).
- Importar período A; importar período B parcialmente sobreposto → aparece a confirmação de sobreposição.
- Forçar falha no meio da reimportação de A → dado antigo de A permanece.

### 6.3 Casos de Borda
- Registro-fantasma (status `error`, sem `sales_rows`) do mesmo período → removido no finalize do novo upload.
- Reenvio de arquivo byte-idêntico (mesmo fingerprint) → permitido; resultado idêntico, sem duplicar.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Deploy do código sem aplicar a 0022 (ou vice-versa) | Média | Alto | Documentar em `deploy-notes.md` que os **dois** passos são obrigatórios e a ordem recomendada |
| Substituição remover dado de um upload concorrente do mesmo período | Baixa | Médio | Fluxo de upload é sequencial no cliente; escopo por usuário; casamento por período exato |
| Janela de dupla contagem antes do finalize | Baixa | Baixo | Janela de segundos; resolve no finalize; relatórios consultados após o upload |

## 8. Dependências

### 8.1 Internas
- Reaproveita `append_upload_chunk`/`finalize_upload` da **migration 0014** (integridade de upload) e as colunas `period_start`/`period_end` da **migration 0005**.

### 8.2 Externas
- Aplicação da migration `0022` no banco de produção (Supabase). Deploy de banco é **manual via SQL Editor** neste projeto.

## 9. Observações e Decisões de Design

- **Troca no finalize, não no PUT:** garante que o dado antigo só seja removido quando o novo já estiver gravado por completo — evita perda em caso de falha no meio.
- **Fingerprint deixa de ser trava:** com substituição por período, o fingerprint não é mais identidade; vira informativo. O índice único é dropado para permitir reenvio de arquivo idêntico/corrigido.
- **Período exato vs. parcial:** só o período exato substitui; o parcial mantém o comportamento anterior (aviso + acúmulo) por ser ambíguo. Evoluir para substituição parcial exigiria chave por mês/linha — fora de escopo.
- **Sem mudança no cliente:** `DropZone` segue igual; o `confirmOverlap` continua válido para sobreposição parcial.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

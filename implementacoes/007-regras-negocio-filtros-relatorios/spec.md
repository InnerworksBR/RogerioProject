# Regras de Negócio e Filtros dos Relatórios

> **ID:** 007
> **Status:** 🔵 Em Andamento
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-15
> **Última atualização:** 2026-06-15
> **Autor:** Agente AI

---

## 1. Resumo Executivo

Quatro regras de negócio dos relatórios divergem da especificação do produto ou produzem números enganosos. A identificação automática de Bagagitos ignora metade do critério do PRD (prefixo de código `"4"`), tratando-o como mero preview manual de baixa confiança. O filtro de produto/cliente no relatório **Geral** está posicionado no `ON` do `LEFT JOIN` em vez do `WHERE`, fazendo com que linhas não correspondentes apareçam **zeradas** em vez de **removidas**, divergindo do comportamento dos demais relatórios. As "oportunidades de atenção" do dashboard de cliente classificam produtos **estáveis** como queda (`<=` em vez de `<`) e medem queda por unidades enquanto medem alta por receita, gerando listas inconsistentes. Por fim, `updateConfigItem` envia o objeto inteiro (incluindo `id`, `user_id`, `report_key`, `created_at`) no `UPDATE`, prática frágil ainda que hoje neutralizada por RLS. Esta implementação alinha cada regra ao PRD/intenção, registrando explicitamente os pontos que são **decisões de produto**.

## 2. Contexto e Motivação

### 2.1 Problema Atual

**(1) Identificação de Bagagitos diverge do PRD.** Em `lib/server/configSeed.ts:185-217`, o auto-cadastro de bagagitos só promove a "alta confiança" produtos cuja `descr_produto` casa com `BAGAGITO_REGEX = /\bBAGAGITO\b/i` (linha 32). Produtos cujo `cod_referencia` começa com `"4"` (mas sem "BAGAGITO" na descrição) são rebaixados a um `bagagitoLowConfidencePreview` limitado a 12 itens (`.slice(0, 12)`, linha 208) e marcados como `'low'` — ou seja, "não serão usados sozinhos". A mesma assimetria está na RPC `configured_report_rows` (`supabase/migrations/0007_config_report_filters.sql:5-43`), que só agrega o que já estiver cadastrado em `report_config_items`. O PRD (`C:\Apps\RogerioProject\PRD.md`, Relatório 4, linhas 126-127) define explicitamente: *"Produtos cujo `Cód. Referência` começa com `"4"` ... OU cujo `Descr. Produto` contém 'BAGAGITO'"*. Portanto o prefixo `"4"` é critério de **primeira classe**, não preview.

**(2) Filtro de produto/cliente no Geral está no `ON` do `LEFT JOIN`, não no `WHERE`.** Em `supabase/migrations/0006_report_filters.sql:46-58`, a função `geral(...)` aplica `(p_cod_cliente IS NULL OR s.cod_cliente=p_cod_cliente)` e `(p_cod_referencia IS NULL OR s.cod_referencia=p_cod_referencia)` na cláusula `ON` do join (linhas 54-55). Como é um `LEFT JOIN`, quando o filtro derruba as vendas de uma linha de configuração, a linha **permanece** no resultado com todos os meses zerados, em vez de desaparecer. Os demais relatórios fazem o oposto: `configured_report_rows` filtra dentro do subselect agregado e `dashboard_summary` (`0006_report_filters.sql:36-44`) aplica o filtro no `WHERE`, removendo as linhas não correspondentes.

**(3) `attentionProducts` marca produto estável como "Queda" e usa métrica assimétrica.** Em `lib/clientDashboard.ts:194-205`, o filtro de produtos "em atenção" é `product.previousUnits > 0 && product.units <= product.previousUnits`. O operador `<=` inclui produtos cujas unidades **não caíram** (`units === previousUnits`), classificando estabilidade como queda. Além disso, a "queda" é medida em **unidades** (`product.units <= product.previousUnits`), enquanto `growthProducts` (linhas 213-227) mede "alta" em **receita** (`product.revenue > product.previousRevenue`). As duas listas, que deveriam ser espelhos, usam métricas diferentes.

**(4) `updateConfigItem` envia o objeto inteiro no `UPDATE`.** Em `app/(protected)/config/page.tsx:119-129`, `handleEdit` popula `editForm` com `{ ...item, extra_data: {...} }` (linhas 121-124) — espalhando `id`, `user_id`, `report_key` e `created_at` junto. `handleSave` repassa esse `editForm` inteiro a `updateConfigItem(id, editForm)` (linha 129), que executa `.update(updates)` sem filtrar campos (`lib/reportQueries.ts:248-260`). Hoje é inofensivo porque o RLS rejeita reescrita de `user_id` e os demais campos coincidem, mas é frágil: qualquer mudança de policy ou de schema pode permitir corromper `report_key`/`user_id`.

### 2.2 Impacto do Problema

- **(1) Bagagitos:** o relatório Bagagitos sai **incompleto** — toda a linha de códigos `4xxxx` sem a palavra "BAGAGITO" fica de fora do auto-cadastro de alta confiança, exigindo cadastro manual e contrariando a regra que o cliente espera do produto. Afeta a completude do Relatório 4.
- **(2) Geral filtrado:** ao usar o filtro de produto ou cliente na aba Geral, o usuário vê **dezenas de linhas zeradas** poluindo a tela, em vez da linha enxuta que vê nos outros relatórios. Confunde e contradiz a expectativa de "filtrar = mostrar só o que importa".
- **(3) Oportunidades de cliente:** representantes recebem recomendações **erradas** — produtos estáveis listados como "em queda" e priorização inconsistente entre as duas listas (uma por unidades, outra por receita). Mina a confiança na ferramenta de prospecção.
- **(4) updateConfigItem:** sem impacto visível hoje; é dívida técnica/segurança defensiva. Se não corrigido, vira vetor de bug silencioso quando o RLS/schema mudar.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| **(1)** Promover prefixo `"4"` a alta confiança no `configSeed` (igual à regra "OU" do PRD) | Cumpre o PRD; auto-cadastro completo; sem cadastro manual | Pode trazer falso-positivo se houver código `4xxxx` que não seja bagagito | ⚠️ Decisão de produto (ver §9) |
| **(1-alt)** Manter `"4"` como preview, mas oferecer toggle "incluir por prefixo" na UI de seed | Controle do usuário; reversível | Mais UI; mantém divergência do PRD por padrão | ⚠️ Alternativa (ver §9) |
| **(2)** Nova migration `CREATE OR REPLACE FUNCTION geral(...)` movendo `p_cod_referencia`/`p_cod_cliente` para o `WHERE` | Alinha Geral aos demais relatórios; remove linhas zeradas | Muda o comportamento que o usuário possa já ter memorizado | ⚠️ Decisão de produto (ver §9) |
| **(2-alt)** Manter o filtro no `ON` ("config-driven": sempre mostrar todas as linhas configuradas) | Lista de produtos estável entre filtros | Diverge dos outros relatórios; linhas zeradas | ⚠️ Alternativa (ver §9) |
| **(3)** Trocar `<=` por `<` na queda e padronizar a métrica (receita em ambas as listas) | Corrige classificação e consistência | Nenhum relevante | ✅ Escolhida |
| **(4)** Enviar só campos editáveis (`label`, `categoria`, `cod_referencia`, `extra_data`, `sort_order`) no `UPDATE` | Robusto; segue princípio do menor privilégio | Pequeno refactor do `editForm`/`updateConfigItem` | ✅ Escolhida |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

As correções tocam três camadas independentes: (a) o **seed de configuração** server-side (`configSeed.ts`), que sugere itens de relatório a partir do catálogo de produtos; (b) as **RPCs SQL** que agregam vendas por configuração (`geral` na migration 0006); e (c) o **dashboard de cliente** + **CRUD de configuração** no front/edge (`clientDashboard.ts`, `config/page.tsx`, `reportQueries.ts`). Nenhuma mudança de schema é necessária — apenas lógica de seleção/filtro e uma migration `CREATE OR REPLACE` (caso a decisão (2) seja "filtrar").

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `lib/server/configSeed.ts` | Arquivo | Modificar | Promover prefixo `cod_referencia` `"4"` a alta confiança (conforme decisão §9); unificar critério bagagito |
| `supabase/migrations/0007_config_report_filters.sql` | Arquivo | Referência | RPC de relatórios configurados — base para entender o critério de cadastro |
| `supabase/migrations/0008_geral_where_filter.sql` | Arquivo | Criar (condicional) | `CREATE OR REPLACE FUNCTION geral(...)` movendo filtros para o `WHERE` (se decisão = "filtrar") |
| `supabase/migrations/0006_report_filters.sql` | Arquivo | Referência | Função `geral` atual com filtro no `ON` |
| `lib/clientDashboard.ts` | Arquivo | Modificar | `<` na queda (linha 195) e padronizar métrica entre `attentionProducts` e `growthProducts` |
| `app/(protected)/config/page.tsx` | Arquivo | Modificar | `handleSave`/`editForm` enviar só campos editáveis |
| `lib/reportQueries.ts` | Arquivo | Modificar | `updateConfigItem` aceitar/filtrar apenas campos editáveis |
| `C:\Apps\RogerioProject\PRD.md` | Arquivo | Referência | Relatório 4 (linhas 126-127) — critério oficial de bagagito |
| `tests/business-rules.test.mjs` | Arquivo | Criar | Regressão de identificação de bagagito e de classificação de oportunidades |

### 3.3 Interfaces e Contratos

#### Entradas

- **Seed:** `ProductCatalogRow[]` (`cod_referencia`, `descr_produto`, totais) — critério bagagito = `cod_referencia` começa com `"4"` **OU** `descr_produto` casa `/\bBAGAGITO\b/i`.
- **Geral RPC:** `geral(p_ano INT, p_cod_cliente TEXT, p_cod_referencia TEXT, p_semestre INT, p_descr_hist_financ TEXT)` — assinatura **inalterada**.
- **updateConfigItem:** `(id: number, updates: EditableConfigFields)` onde `EditableConfigFields = { label, categoria, cod_referencia, extra_data, sort_order }`.

#### Saídas

- **Seed:** sugestões de bagagito com `confidence: 'high'` para os itens que satisfazem qualquer ramo do critério.
- **Geral RPC (se filtrar):** apenas linhas com vendas correspondentes ao filtro aplicado (sem linhas zeradas).
- **Oportunidades:** `attentionProducts` somente com produtos cujas unidades **caíram** (`units < previousunits`); métrica de ordenação consistente com `growthProducts`.

#### Contratos de API (se aplicável)

N/A — nenhum contrato HTTP muda. A correção (2) preserva a assinatura da função `geral` via `CREATE OR REPLACE`. A correção (4) restringe o payload de `updateConfigItem`, mas não altera sua assinatura pública `(id, updates)`.

### 3.4 Modelos de Dados (se aplicável)

Sem alteração de schema. `report_config_items` (`id`, `user_id`, `report_key`, `cod_referencia`, `categoria`, `label`, `sort_order`, `extra_data`, `created_at`) permanece igual; muda apenas **quais** colunas são enviadas no `UPDATE`.

### 3.5 Fluxo de Execução

1. **Seed bagagito:** ao montar sugestões, marcar como alta confiança todo produto onde `cod_referencia.startsWith('4')` **OU** `BAGAGITO_REGEX.test(descr_produto)` (decisão §9). Remover/realocar o `bagagitoLowConfidencePreview` conforme a decisão.
2. **Geral (se "filtrar"):** nova migration move `p_cod_cliente`/`p_cod_referencia` do `ON` para o `WHERE`, mantendo `s.ano=p_ano` e `s.cod_referencia=c.cod_referencia` no `ON`.
3. **Oportunidades:** filtrar queda com `previousUnits > 0 && units < previousUnits`; alinhar a métrica de queda à de alta (ambas por receita, com ordenação por `|deltaRevenue|`).
4. **updateConfigItem:** `handleSave` extrai apenas `{ label, categoria, cod_referencia, extra_data, sort_order }` de `editForm` antes de chamar `updateConfigItem`; `reportQueries.updateConfigItem` tipa/filtra esse subconjunto.

### 3.6 Tratamento de Erros

- **Seed:** se o catálogo vier vazio, comportamento atual preservado (sem sugestões). Falsos-positivos do prefixo `"4"` são mitigáveis pela própria UI de preview/aprovação antes de aplicar.
- **Geral RPC:** `CREATE OR REPLACE` é idempotente; se a migration falhar, a função antiga permanece. Sem novo caminho de erro.
- **updateConfigItem:** se `updates` vier sem campos editáveis, o Supabase retorna no-op; `normalizeDbError` já trata erros de RLS/constraint existentes. Nenhuma exceção nova introduzida.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** O auto-cadastro de bagagitos deve tratar `cod_referencia` começando com `"4"` como critério de alta confiança, em paridade com a descrição contendo "BAGAGITO" (sujeito à decisão §9).
- **RF-002:** O critério de identificação de bagagito no sistema deve corresponder ao PRD (Relatório 4): `"4"` no código **OU** "BAGAGITO" na descrição.
- **RF-003:** Ao aplicar filtro de produto/cliente na aba Geral, as linhas sem vendas correspondentes devem ser **removidas** do resultado (não exibidas zeradas) — conforme decisão §9.
- **RF-004:** `attentionProducts` deve listar apenas produtos cujas unidades **diminuíram** (`units < previousUnits`), nunca estáveis.
- **RF-005:** `attentionProducts` e `growthProducts` devem usar a **mesma** métrica de classificação (receita) entre alta e queda.
- **RF-006:** `updateConfigItem` deve persistir apenas os campos editáveis (`label`, `categoria`, `cod_referencia`, `extra_data`, `sort_order`).

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** As correções não devem introduzir regressão de performance perceptível nas RPCs nem no seed (o critério de prefixo é uma comparação O(1) por linha).
- **RNF-002:** A migration da função `geral` deve ser idempotente (`CREATE OR REPLACE`) e reversível por rollback documentado.
- **RNF-003:** A restrição de campos no `UPDATE` não deve depender de RLS para corretude — deve ser segura por construção (princípio do menor privilégio).

### 4.3 Restrições e Limitações

- A decisão de promover o prefixo `"4"` e a decisão de filtrar vs. config-driven no Geral são **de produto** e devem ser confirmadas com o cliente antes de fechar os CAs correspondentes (ver §9).
- Esta versão do Next/Supabase pode divergir do conhecido; conferir os guias em `node_modules/next/dist/docs/` e o comportamento de RLS antes de assumir.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Um produto com `cod_referencia = "40030"` e descrição **sem** "BAGAGITO" é sugerido como bagagito de **alta** confiança (após a decisão §9 confirmada como "promover").
- [ ] **CA-002:** O critério de bagagito implementado coincide com o PRD (Relatório 4), e a decisão correspondente está registrada na §9.
- [ ] **CA-003:** Filtrando a aba Geral por um `cod_cliente`/`cod_referencia`, o resultado **não** contém linhas com todos os meses zerados (após a decisão §9 confirmada como "filtrar").
- [ ] **CA-004:** Teste prova que produto com `units === previousUnits` **não** aparece em `attentionProducts`, e que `units < previousUnits` aparece.
- [ ] **CA-005:** `attentionProducts` e `growthProducts` ordenam pela mesma métrica (receita); a inconsistência unidades↔receita foi eliminada.
- [ ] **CA-006:** Após salvar uma edição na página de config, o payload enviado ao Supabase contém **apenas** `label`, `categoria`, `cod_referencia`, `extra_data`, `sort_order`.
- [ ] **CA-007:** `npm test`, `npm run typecheck` e `npm run build` passam.

## 6. Plano de Testes

### 6.1 Testes Unitários

- Função de classificação de bagagito: tabela de casos (`40030`/sem "BAGAGITO" → high; `30017`/sem "BAGAGITO" → não-bagagito; `12345`/"...BAGAGITO..." → high).
- `buildOpportunities`: produto estável (`units === previousUnits`) ausente de `attentionProducts`; produto em queda presente; ambas as listas ordenadas por receita.

### 6.2 Testes de Integração

- Executar a RPC `geral` (em ambiente Supabase local/staging) com e sem filtro de cliente/produto e verificar a ausência de linhas zeradas (no cenário "filtrar").
- Salvar edição via `updateConfigItem` e inspecionar (mock/spy) o objeto passado a `.update(...)`.

### 6.3 Testes de Aceitação

- Na UI: aplicar filtro na aba Geral e confirmar visualmente que as linhas não correspondentes somem.
- Rodar o seed sobre um catálogo de fixture e conferir que os códigos `4xxxx` aparecem como sugestão de bagagito de alta confiança.

### 6.4 Casos de Borda (Edge Cases)

- Produto com `cod_referencia` começando com `"4"` que **não** é bagagito (falso-positivo) — validar o fluxo de aprovação manual.
- Produto com `previousUnits = 0` (não deve entrar em queda; é "sem_recompra"/novo).
- `units === previousUnits` exatamente (estável) — não é queda.
- Edição de config sem nenhum campo alterado — `UPDATE` no-op sem erro.
- Filtro Geral que não casa nenhuma venda — resultado vazio (não linhas zeradas).

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Promover prefixo `"4"` traz falso-positivo de bagagito | Média | Médio | Manter etapa de preview/aprovação manual antes de aplicar o seed; documentar decisão na §9 |
| Mudar o Geral para filtrar altera comportamento que o usuário já conhece | Média | Baixo | Confirmar com o cliente; migration `CREATE OR REPLACE` reversível |
| Padronizar métrica de oportunidades muda a lista que o representante já vê | Baixa | Baixo | Comunicar a mudança; a métrica por receita é a mais coerente com o negócio |
| Restringir campos do `UPDATE` quebra algum fluxo que dependia do payload completo | Baixa | Baixo | Cobrir com teste de integração; só são removidos campos imutáveis (`id`/`user_id`/`report_key`/`created_at`) |

## 8. Dependências

### 8.1 Dependências Internas

- Recomenda-se executar **após** a 006 (corretude de datas/agregações), pois esta implementação assume `mes`/`ano` e somas já corretos. Não há bloqueio rígido — os escopos não se sobrepõem em código.

### 8.2 Dependências Externas

- Supabase (PostgreSQL/RLS) — já presente. Nenhuma nova dependência de pacote.

## 9. Observações e Decisões de Design

- **Decisão de produto — Bagagito por prefixo `"4"`:** o PRD (Relatório 4) trata `"4"` como critério de primeira classe (`OU`). A recomendação técnica é **promover** o prefixo a alta confiança no `configSeed`, mantendo a etapa de aprovação manual como salvaguarda contra falso-positivo. A alternativa é oferecer um **toggle** "incluir por prefixo" na UI de seed, mantendo o padrão atual. **Confirmar com o cliente antes de fechar CA-001/CA-002.**
- **Decisão de produto — Geral config-driven vs. filtrado:** mover o filtro do `ON` para o `WHERE` alinha o Geral aos demais relatórios (filtrar = remover linhas). A alternativa "config-driven" mantém todas as linhas configuradas visíveis (zeradas quando não há venda), o que pode ser desejável para uma visão de catálogo estável. A recomendação técnica é **filtrar** (consistência), mas é uma escolha de UX. **Confirmar com o cliente antes de fechar CA-003.**
- **Correções sem ambiguidade:** a troca `<=` → `<` na queda e a padronização da métrica de oportunidades (3), bem como a restrição de campos no `updateConfigItem` (4), são correções técnicas sem decisão de produto — podem prosseguir independentemente das confirmações acima.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

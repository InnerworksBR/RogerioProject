# Tratamento de Erros, Estados e Tema

> **ID:** 011
> **Status:** 🟢 Concluída
> **Prioridade:** 🟡 Média
> **Criada em:** 2026-06-15
> **Última atualização:** 2026-06-15
> **Autor:** Agente AI

---

## 1. Resumo Executivo

O aplicativo não possui nenhuma fronteira de erro do App Router (`error.tsx`, `global-error.tsx`) nem página `not-found.tsx`. Como as páginas server-side (`app/(protected)/page.tsx`, `app/(protected)/reports/*`) executam queries Supabase, RPCs e chamadas de IA, qualquer exceção não tratada derruba o usuário na tela de erro genérica e sem estilo do Next — fora do tema dark/glass do produto. Em paralelo, há três problemas menores de consistência de estados e tema: o `Toaster` (sonner) chama `useTheme()` sem nenhum `ThemeProvider` montado (o dark é forçado por `className="...dark"` no `<html>`), caindo no default `"system"` e podendo renderizar toasts em modo claro; a home confunde "sem dados" com "erro de IA/rede" no empty state e nos rankings de líder; e o hero do dashboard de cliente promete um cruzamento por "inteligência artificial" que não existe — o cálculo é determinístico e local. Esta implementação fecha essas lacunas criando as fronteiras de erro no padrão glass, fixando o tema dos toasts, diferenciando vazio de erro na home e corrigindo a copy enganosa.

## 2. Contexto e Motivação

### 2.1 Problema Atual

**Ausência de fronteiras de erro e de página 404 (Alta).** Um glob por `app/**/{error,global-error,not-found}.tsx` retorna vazio — nenhum desses arquivos existe. As páginas protegidas fazem trabalho que pode lançar:

- `app/(protected)/page.tsx`: `getAvailableYears()`, `supabase.rpc('get_rep_ranking'|'get_client_ranking')` e `buildAIReportSummary(...)`.
- `app/(protected)/reports/*`: queries e RPCs de relatório.

Se qualquer uma lançar, o usuário cai na tela de erro padrão do Next (sem o tema dark/glass), e uma URL inexistente cai no 404 padrão — ambos quebrando a identidade visual e sem ação de recuperação.

> **Atenção (AGENTS.md):** esta versão do Next tem convenções alteradas em relação ao conhecido. Antes de implementar, conferir os arquivos de error handling / not-found em `node_modules/next/dist/docs/` — confirmados presentes: `01-app/01-getting-started/10-error-handling.md`, `01-app/03-api-reference/03-file-conventions/error.md`, `01-app/03-api-reference/03-file-conventions/not-found.md` e `01-app/03-api-reference/04-functions/not-found.md`.

**`useTheme()` sem `ThemeProvider` (Média — consistência).** `components/ui/sonner.tsx:8` faz `const { theme = "system" } = useTheme()` e repassa `theme` ao `<Sonner>`. Não há `ThemeProvider` do `next-themes` em lugar nenhum: `app/layout.tsx:19` força o dark via `className="...dark"` no `<html>`. Sem provider, `useTheme()` devolve o default `"system"`, então os toasts seguem a preferência do SO em vez do dark do app — podem aparecer em modo claro sobre a interface escura.

**Empty state da home falha silenciosamente (Média — vazio/erro).** Em `app/(protected)/page.tsx:48-59`, `buildAIReportSummary` está num `try/catch` que só faz `console.error`; quando lança (config/rede da IA) ou retorna `available:false`, o `globalAI` fica `null` e o usuário vê o fallback "...ainda não processou dados suficientes" (linha 160) — enganoso, pois pode ter havido erro, não falta de dados. Importante: `buildAIReportSummary` **já** retorna um discriminador útil (`lib/server/aiSummary.ts:220,224,235,259` → `reason: 'missing_api_key' | 'missing_year' | 'no_data'`), mas a página descarta o `reason`. Os rankings de líder (`app/(protected)/page.tsx:42-45`) usam `await supabase.rpc(...)` direto com `reps || []` / `clients || []`, sem loading nem tratamento de erro — um erro de RPC vira `[]` e renderiza "Nenhum dado encontrado." (linhas 188 e 214) como se a base estivesse vazia.

**Hero do dashboard de cliente promete IA inexistente (Média — vazio).** `components/client-dashboard/ClientVisitDashboard.tsx:1169-1170`: a copy diz "...A inteligência artificial fará o cruzamento de histórico." Mas o dashboard é produzido por `buildClientVisitDashboard` (cálculo determinístico local), não por IA. A copy cria expectativa incorreta sobre o produto.

### 2.2 Impacto do Problema

- **Quem é afetado:** todos os usuários. A falta de `error.tsx`/`not-found.tsx` afeta qualquer um que esbarre numa exceção server-side ou numa URL inválida; o tema dos toasts afeta quem usa SO em modo claro; o empty state e a copy afetam a leitura de quem chega à home e ao dashboard de cliente.
- **Magnitude:** a ausência de fronteira de erro é a de maior impacto — uma falha pontual de Supabase/IA tira o usuário do produto e da identidade visual, sem botão de recuperação. Os demais são problemas de confiança e clareza: número certo mostrado como "vazio", erro mostrado como "sem dados", e promessa de funcionalidade que não existe.
- **Se não resolvido:** percepção de instabilidade e de produto "quebrado" em qualquer falha transitória, além de mensagens que induzem o usuário a conclusões erradas sobre os próprios dados.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Criar `error.tsx` no grupo `(protected)` + `not-found.tsx` + `global-error.tsx` no padrão glass | Cobre os três níveis (segmento protegido, 404 e erro de root layout) com o tema do app e ação de recuperação | Exige `global-error.tsx` renderizar seu próprio `<html>/<body>` | ✅ Escolhida |
| Tratar erros apenas com `try/catch` em cada página | Granular | Repetitivo, não cobre erros fora do `try`, ignora a convenção do App Router | ❌ Descartada |
| Fixar `theme="dark"` direto no `<Sonner>` | Mínimo, alinhado ao dark forçado do `<html>`; remove dependência de `useTheme()` | — | ✅ Escolhida (preferida) |
| Montar `ThemeProvider` com `forcedTheme="dark"` | Resolve o `useTheme()` de forma genérica para futuros consumidores | Adiciona provider/montagem para um caso hoje único | ⚠️ Alternativa aceitável |
| Diferenciar vazio×erro consumindo o `reason` que a IA já devolve | Reusa contrato existente; sem nova infraestrutura | Exige propagar o estado de erro dos rankings também | ✅ Escolhida |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

As fronteiras de erro são arquivos-convenção do App Router. `app/(protected)/error.tsx` cobre as páginas protegidas (Client Component com `reset()`); `app/not-found.tsx` cobre 404 global; `app/global-error.tsx` cobre falhas do próprio root layout (precisa renderizar `<html>` e `<body>`). O tema é resolvido fixando o dark no `Toaster` para casar com o `<html className="...dark">`. A diferenciação vazio×erro na home reusa o discriminador `reason` já retornado por `buildAIReportSummary` e adiciona estado de erro aos rankings. A copy do hero é texto estático em um componente cliente.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `app/(protected)/error.tsx` | Arquivo | Criar | Error boundary do segmento protegido, no padrão glass, com botão "Tentar novamente" (`reset()`) |
| `app/not-found.tsx` | Arquivo | Criar | Página 404 no padrão glass com link de volta ao início |
| `app/global-error.tsx` | Arquivo | Criar | Boundary de root; renderiza `<html lang="pt-BR">`/`<body>` próprios no padrão glass |
| `components/ui/sonner.tsx` | Arquivo | Modificar | Fixar `theme="dark"` (ou consumir provider com `forcedTheme`), removendo a dependência do default `"system"` |
| `app/(protected)/page.tsx` | Arquivo | Modificar | Diferenciar "sem dados" de "erro" no bloco de IA (usar `reason`) e nos rankings (capturar `error` das RPCs) |
| `components/client-dashboard/ClientVisitDashboard.tsx` | Arquivo | Modificar | Ajustar a copy do hero (linhas 1169-1170) para refletir o cálculo determinístico local |
| `app/layout.tsx` | Arquivo | Referência | Origem do dark forçado (`className="...dark"`, linha 19); base da decisão de tema |
| `lib/server/aiSummary.ts` | Arquivo | Referência | Fonte do discriminador `available`/`reason` reusado na home |

### 3.3 Interfaces e Contratos

#### Entradas

- `error.tsx` / `global-error.tsx`: props `{ error: Error & { digest?: string }, reset: () => void }` (convenção do App Router — confirmar assinatura exata em `node_modules/next/dist/docs`).
- Home: resposta de `buildAIReportSummary` (`{ available: true, summary, ... } | { available: false, reason }`) e o par `{ data, error }` das RPCs `get_rep_ranking` / `get_client_ranking`.

#### Saídas

- Telas de erro/404 renderizadas no tema dark/glass, com ação de recuperação (`reset`) ou navegação de volta.
- Toasts sempre em tema dark.
- Empty states que distinguem "sem dados" de "erro ao gerar/consultar".

#### Contratos de API (se aplicável)

N/A — sem mudança de contrato HTTP nem de RPC. Apenas consumo diferente, no cliente/servidor, de respostas já existentes.

### 3.4 Modelos de Dados (se aplicável)

N/A — sem alteração de schema ou de RPCs.

### 3.5 Fluxo de Execução

1. Uma página protegida lança durante render/data fetch → o App Router renderiza `app/(protected)/error.tsx` (tema glass) com botão "Tentar novamente" que chama `reset()`.
2. Uma URL inexistente (ou `notFound()`) → renderiza `app/not-found.tsx` no tema glass com link para `/`.
3. Uma falha no próprio root layout → renderiza `app/global-error.tsx`, que monta `<html>/<body>` próprios e exibe a tela glass.
4. A home chama `buildAIReportSummary`; com `available:true` mostra o "Raio-X"; com `available:false` distingue pela `reason` ("sem dados" × "indisponível/erro"); se o `try/catch` capturar exceção, exibe estado de erro (não "sem dados").
5. Os rankings capturam `{ data, error }` das RPCs: `error` → estado de erro; `data` vazio → "Nenhum dado encontrado".
6. O `Toaster` renderiza sempre em `theme="dark"`, independentemente da preferência do SO.

### 3.6 Tratamento de Erros

- `error.tsx`/`global-error.tsx` devem ser Client Components (`"use client"`), exibir mensagem amigável (sem stack para o usuário), opcionalmente logar `error.digest`, e oferecer `reset()`.
- Na home, separar três situações no bloco de IA: indisponível por configuração/rede (mensagem neutra de "indisponível no momento"), sem dados suficientes (mensagem atual) e erro capturado (mensagem de erro), sem expor detalhes técnicos.
- Os rankings não devem mascarar erro de RPC como lista vazia.
- Nenhuma exceção nova introduzida; o comportamento das páginas em sucesso é preservado.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** Existe `app/(protected)/error.tsx` que captura exceções das páginas protegidas, exibe tela no padrão glass e oferece botão "Tentar novamente" via `reset()`.
- **RF-002:** Existe `app/not-found.tsx` no padrão glass, com link de retorno ao início, exibido em rotas inexistentes.
- **RF-003:** Existe `app/global-error.tsx` no padrão glass, renderizando seu próprio `<html>/<body>`, cobrindo falhas do root layout.
- **RF-004:** Os toasts (sonner) renderizam sempre em tema dark, coerentes com o `<html className="...dark">`, independentemente do tema do SO.
- **RF-005:** Na home, "sem dados" e "erro/indisponível" são estados visuais distintos, tanto para o resumo de IA quanto para os rankings de líder.
- **RF-006:** A copy do hero do dashboard de cliente (`ClientVisitDashboard.tsx:1169-1170`) descreve o cálculo determinístico local, sem prometer IA.

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** As telas de erro/404 seguem o padrão glass/dark do produto (classes `glass`/`glass-card`, fundo `#030712`, tipografia existente).
- **RNF-002:** Mensagens ao usuário não expõem stack traces nem detalhes internos.
- **RNF-003:** Sem regressão de performance ou de comportamento das páginas em caminho de sucesso.
- **RNF-004:** As convenções de arquivo seguem exatamente esta versão do Next (validar em `node_modules/next/dist/docs/`).

### 4.3 Restrições e Limitações

- `global-error.tsx` só atua em produção para erros do root layout; em desenvolvimento o overlay de erro do Next pode aparecer antes — validar conforme a doc instalada.
- Esta versão do Next pode diferir do conhecido (ver `AGENTS.md`); não assumir assinaturas/props — conferir `node_modules/next/dist/docs/` antes de codar.
- A decisão entre fixar `theme="dark"` no `<Sonner>` e montar `ThemeProvider` com `forcedTheme="dark"` deve ser única; recomenda-se a opção mais simples (tema fixo).

## 5. Critérios de Aceitação

- [ ] **CA-001:** Forçar uma exceção numa página protegida exibe `app/(protected)/error.tsx` no tema glass, e o botão "Tentar novamente" reexecuta a rota via `reset()`.
- [ ] **CA-002:** Acessar uma URL inexistente exibe `app/not-found.tsx` no tema glass com link funcional para `/`.
- [ ] **CA-003:** `app/global-error.tsx` existe, renderiza `<html>/<body>` próprios e segue o padrão glass.
- [ ] **CA-004:** Com o SO em modo claro, os toasts ainda aparecem em tema dark.
- [ ] **CA-005:** Na home, com IA indisponível por configuração/rede a mensagem difere de "sem dados suficientes"; um erro de RPC de ranking não é exibido como "Nenhum dado encontrado".
- [ ] **CA-006:** O hero do dashboard de cliente não menciona "inteligência artificial fará o cruzamento"; a copy reflete o cálculo local.
- [ ] **CA-007:** `npm run typecheck` e `npm run build` passam.

## 6. Plano de Testes

### 6.1 Testes Unitários

- N/A para os arquivos-convenção (são telas). Caso a lógica de mapeamento `reason → mensagem` da home seja extraída para função pura, cobri-la com teste de mapeamento (`no_data` → "sem dados"; `missing_api_key`/erro → "indisponível").

### 6.2 Testes de Integração

- Simular falha de uma RPC/IA (mock que lança ou retorna erro) e verificar que a home exibe o estado de erro correto, não o de vazio.

### 6.3 Testes de Aceitação

- Verificação manual no app: provocar erro server-side (ex.: env inválida), acessar rota 404, alternar o SO para modo claro e disparar um toast, e abrir o dashboard de cliente sem seleção para ler o hero.

### 6.4 Casos de Borda (Edge Cases)

- Erro lançado durante o render do root layout (`global-error.tsx`).
- IA sem `OPENAI_API_KEY` (`reason: 'missing_api_key'`) versus base vazia (`reason: 'no_data'`).
- RPC de ranking que retorna `error` versus que retorna `[]` legítimo.
- SO em modo claro, modo escuro e "system".
- `reset()` chamado após erro transitório já resolvido (deve recarregar com sucesso).

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Assinatura/props de `error`/`global-error` diferentes nesta versão do Next | Média | Médio | Conferir `node_modules/next/dist/docs/` (error.md, not-found.md) antes de codar |
| `global-error.tsx` mal montado (sem `<html>/<body>`) quebra a renderização | Baixa | Alto | Seguir o exemplo da doc instalada; testar em build de produção |
| Esconder erro real de RPC ao tratar como erro genérico | Baixa | Baixo | Logar `error` no servidor; manter mensagem amigável só na UI |
| Mudança de tema do toast conflitar com futuro `ThemeProvider` | Baixa | Baixo | Escolher uma única estratégia e registrar na seção 9 |

## 8. Dependências

### 8.1 Dependências Internas

- Padrão visual glass/dark já estabelecido em `app/layout.tsx` e nas páginas existentes (classes `glass`/`glass-card`).
- Discriminador `available`/`reason` de `lib/server/aiSummary.ts` (já implementado).

### 8.2 Dependências Externas

- `next` (App Router) — convenções de `error`/`not-found`/`global-error`; validar versão instalada via `node_modules/next/dist/docs/`.
- `next-themes` e `sonner` — já presentes.

## 9. Observações e Decisões de Design

- **Tema dos toasts:** decisão recomendada é fixar `theme="dark"` direto no `<Sonner>`, alinhado ao dark forçado no `<html>`, evitando montar um `ThemeProvider` para um único consumidor. Caso o produto venha a oferecer alternância de tema no futuro, migrar para `ThemeProvider` com `forcedTheme`/`defaultTheme`.
- **Reuso do contrato de IA:** a home não precisa de nova infraestrutura para diferenciar vazio×erro — basta consumir o `reason` que `buildAIReportSummary` já devolve e tratar a exceção capturada como estado próprio (não "sem dados").
- **Convenções do Next:** por orientação do `AGENTS.md`, esta versão tem convenções alteradas; a implementação deve conferir os docs de error handling / not-found em `node_modules/next/dist/docs/` antes de escrever os arquivos-convenção.
- **Copy do hero:** ajuste de texto puro; não altera a lógica determinística de `buildClientVisitDashboard`.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.

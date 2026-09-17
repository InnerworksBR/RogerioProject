# Relatório para reunião com o cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Transformar Clientes em um fluxo de preparar, apresentar e compartilhar um relatório comercial claro, com oportunidades sustentadas pelos dados e tema claro nas superfícies desse fluxo.

**Architecture:** Criar um contrato de apresentação que transporte o recorte seguro de cliente, ano, resumo, evolução, produtos e oportunidades. A prévia autenticada e o link público renderizam o mesmo componente de apresentação, mas cada uma carrega os dados pelo caminho que já respeita suas permissões. A tela de Clientes mantém a busca e as consultas agregadas existentes, enquanto uma rota de apresentação sem a navegação administrativa usa o cliente e ano da URL para preservar o contexto ao entrar e sair da reunião.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2, TypeScript 5, Tailwind CSS 4, Base UI, Recharts, Supabase Auth/PostgreSQL/RLS, Node node:test.

**Spec:** docs/superpowers/specs/2026-09-17-client-report-experience-design.md

## Global Constraints

- Ler os guias relevantes de App Router e Client Components em node_modules/next/dist/docs/ antes de escrever componentes ou rotas Next.js.
- Não adicionar dependências nem alterar migrations, políticas RLS, validade de sete dias, revogação ou rate limit dos links públicos.
- Manter o recorte do relatório em cliente ou grupo e em um ano, comparado somente com o ano anterior. Semestre e demais filtros não entram no link enquanto não existir suporte equivalente no contrato público.
- A IA é opcional: preparar, apresentar, compartilhar e exportar não podem depender de flags nem chamadas de IA.
- Usar cópia em português voltada ao cliente: “Valor comprado”, “Preparar relatório” e “Apresentar relatório”. Não expor group:<uuid>, “Modo Pitch Deck” ou “Painel Técnico”.
- Toda oportunidade deve mostrar produto, anos comparados, valores e unidades; não inferir estoque, reposição garantida ou potencial de produto nunca comprado.
- Quando o ano anterior for zero, mostrar “Sem base anterior” em vez de um percentual. Quando o período atual não tiver compra de um produto anterior, mostrar “Sem compra registrada no período”.
- O tema claro aplica-se ao shell, à preparação, à apresentação autenticada e à página pública deste fluxo. A reformulação visual completa de Relatórios detalhados, Importações, Configurações, Equipe e Conta fica fora deste plano.
- A correção da transição Base de Compra → Base de Itens, convite, atualização do histórico de importação e fidelidade estrutural do Excel é trabalho de estabilização separado. O Excel existente permanece acessível e não deve ser alterado neste plano.

---

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| types/clientReport.ts | Contrato serializável e mínimo que a apresentação autenticada e a pública consomem. |
| lib/clientReport.ts | Adaptadores puros que convertem o dashboard agregado ou linhas públicas no mesmo contrato, incluindo oportunidades com evidência. |
| components/client-report/ClientReportPresentation.tsx | Relatório em modo reunião e compartilhado: resumo, evolução, produtos, oportunidades e atalhos de seção. |
| components/client-report/ClientReportShareControls.tsx | Criar, copiar e revogar links, com validade explícita. |
| components/client-report/useClientReportData.ts | Hook cliente que executa as cinco consultas agregadas existentes e produz ClientVisitDashboardData. |
| app/(presentation)/layout.tsx | Protege a rota de reunião autenticada sem renderizar a navegação administrativa. |
| app/(presentation)/apresentar/page.tsx | Lê client e year da URL e monta a apresentação autenticada. |
| app/(presentation)/apresentar/ClientReportPresentationPage.tsx | Carrega o relatório da URL, mostra estados de carregamento/erro e oferece retorno à preparação. |
| components/client-dashboard/ClientVisitDashboard.tsx | Concentra a preparação: busca, escolha de ano, prévia e entrada na apresentação; mantém a visão interna existente. |
| app/shared/client/[token]/SharedDashboardClientView.tsx | Torna-se adaptador fino para o componente de apresentação comum. |
| lib/server/shareLinks.ts | Converte as linhas já autorizadas no contrato comum e entrega oportunidades no link. |
| components/client-dashboard/ShareLinksManager.tsx | Mostra links ativos com validade e revogação. |
| app/layout.tsx, app/globals.css, app/(protected)/layout.tsx, components/layout/ProtectedNav.tsx, components/auth/UserMenu.tsx, app/(protected)/page.tsx | Tema claro e hierarquia do shell: entrada “Preparar relatório” e visão gerencial secundária. |
| tests/client-report-experience.test.mjs | Guarda contrato, apresentação comum, rótulos e proteções do link com testes compatíveis com a suíte atual. |

## Task 1: Contrato comum de dados e evidência das oportunidades

**Files:**
- Create: types/clientReport.ts
- Create: lib/clientReport.ts
- Modify: lib/server/shareLinks.ts
- Create: tests/client-report-experience.test.mjs

**Interfaces:**
- Consumes: ClientVisitDashboardData, ClientOpportunity e ClientSalesRow de types/clientDashboard.ts; linhas autorizadas de sales_rows já carregadas por resolveSharedClientData.
- Produces: ClientReportData, toClientReportData(dashboard, clientName, year) e buildClientReportDataFromRows(rows, clientName, year) para as Tasks 2–4.

- [ ] **Step 1: Write the failing contract test**

Criar tests/client-report-experience.test.mjs usando node:test e readFile, como os testes existentes.

~~~
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('client report contract carries comparable evidence instead of stock claims', async () => {
  const types = await read('types/clientReport.ts');
  const model = await read('lib/clientReport.ts');

  for (const reason of ['sem_recompra', 'queda', 'oportunidade', 'em_alta']) {
    assert.match(types, new RegExp("'" + reason + "'"));
  }
  assert.match(model, /export function toClientReportData/);
  assert.match(model, /export function buildClientReportDataFromRows/);
  assert.doesNotMatch(model, /estoque atual|reposição garantida/i);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test tests/client-report-experience.test.mjs

Expected: FAIL porque types/clientReport.ts e lib/clientReport.ts ainda não existem.

- [ ] **Step 3: Implement the report contract and pure adapters**

Em types/clientReport.ts, criar:

~~~
import type {
  ClientMonthlyTrendPoint,
  ClientOpportunity,
  ClientProductSummary,
} from './clientDashboard';

export interface ClientReportData {
  clientName: string;
  year: number;
  preparedAt: string;
  summary: {
    totalRevenue: number;
    previousRevenue: number;
    totalUnits: number;
    previousUnits: number;
    orderCount: number;
    previousOrderCount: number;
    uniqueProducts: number;
    previousUniqueProducts: number;
  };
  monthlyTrend: ClientMonthlyTrendPoint[];
  topProducts: ClientProductSummary[];
  attentionProducts: ClientOpportunity[];
  growthProducts: ClientOpportunity[];
}
~~~

Em lib/clientReport.ts, definir um tipo de linha mínimo com código de produto, descrição, data/pedido, quantidade, valor, ano e mês. Implementar exatamente estas assinaturas:

~~~
export function toClientReportData(
  dashboard: ClientVisitDashboardData,
  clientName: string,
  year: number,
  preparedAt = new Date().toISOString()
): ClientReportData;

export function buildClientReportDataFromRows(
  rows: ClientReportSalesRow[],
  clientName: string,
  year: number,
  preparedAt = new Date().toISOString()
): ClientReportData;
~~~

O primeiro adaptador copia somente os campos declarados de summary, monthlyTrend, topProducts, attentionProducts e growthProducts. O segundo calcula esses campos para year e year - 1: incluir os doze meses, produtos sem recompra, queda, produtos novos e produtos em alta. Reutilizar a regra atual de comparação por receita (> 5%, < -5%) e fornecer unidades, valores e deltas. Não importar React nem cliente Supabase nesse módulo.

Em lib/server/shareLinks.ts, substituir SharedClientDashboardDto e buildSharedDashboard pelo contrato comum e buildClientReportDataFromRows. Preservar sem alteração a resolução de grupo, ownerIds, token opaco, hash, expiração, revogação e rate limit.

- [ ] **Step 4: Run contract and security tests**

Run: node --test tests/client-report-experience.test.mjs tests/security-regressions.test.mjs

Expected: PASS. O teste de segurança continua encontrando randomBytes(32), hash SHA-256, ownerIds, client_group_members e a restrição por clientCodes.

- [ ] **Step 5: Validate types**

Run: npm run typecheck

Expected: exit 0, sem adaptação implícita entre o DTO público e o dashboard interno.

- [ ] **Step 6: Commit**

~~~powershell
git add types/clientReport.ts lib/clientReport.ts lib/server/shareLinks.ts tests/client-report-experience.test.mjs
git commit -m "feat: unify client report data"
~~~

## Task 2: Apresentação única para reunião e link enviado

**Files:**
- Create: components/client-report/ClientReportPresentation.tsx
- Modify: app/shared/client/[token]/SharedDashboardClientView.tsx
- Modify: app/shared/client/[token]/page.tsx
- Modify: tests/client-report-experience.test.mjs

**Interfaces:**
- Consumes: ClientReportData da Task 1.
- Produces: ClientReportPresentation({ report, mode, toolbar }), usado pela rota pública nesta tarefa e pela rota autenticada na Task 4.

- [ ] **Step 1: Write the failing composition test**

Acrescentar:

~~~
test('authenticated and public reports use one client-facing presentation', async () => {
  const presentation = await read('components/client-report/ClientReportPresentation.tsx');
  const sharedView = await read('app/shared/client/[token]/SharedDashboardClientView.tsx');

  for (const id of ['resumo', 'evolucao', 'produtos', 'oportunidades']) {
    assert.match(presentation, new RegExp('id="' + id + '"'));
  }
  assert.match(presentation, /Sem compra registrada no período/);
  assert.match(presentation, /Sem base anterior/);
  assert.match(sharedView, /ClientReportPresentation/);
  assert.doesNotMatch(presentation, /Modo Pitch Deck|Painel Técnico|estoque atual/i);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test tests/client-report-experience.test.mjs

Expected: FAIL porque a apresentação comum ainda não existe.

- [ ] **Step 3: Implement the common presentation**

Criar ClientReportPresentation.tsx como Client Component:

~~~
export function ClientReportPresentation({
  report,
  mode,
  toolbar,
}: {
  report: ClientReportData;
  mode: 'meeting' | 'shared';
  toolbar?: ReactNode;
})
~~~

Renderizar, nesta ordem e sem hero de altura de viewport:

1. cabeçalho com “Relatório de compras”, nome do cliente, ano comparado com year - 1 e “Dados consultados em” usando preparedAt;
2. atalhos âncora para #resumo, #evolucao, #produtos e #oportunidades;
3. section id="resumo" com valor comprado, unidades, pedidos e produtos, sempre exibindo o dado anterior junto ao atual;
4. section id="evolucao" com gráfico Recharts de ambos os anos e legenda textual com os anos;
5. section id="produtos" com produto, referência, valor comprado e unidades;
6. section id="oportunidades" com “Produtos para retomar” e “Produtos em crescimento”.

Para cada oportunidade, usar uma função local pura:

~~~
function getOpportunityEvidence(item: ClientOpportunity, year: number) {
  if (item.reason === 'sem_recompra') {
    return 'Sem compra registrada em ' + year + '; em ' + (year - 1) +
      ', foram ' + fmtNumber(item.previousUnits) + ' unidades e ' +
      fmtBRL(item.previousRevenue) + '.';
  }
  if (item.reason === 'oportunidade') {
    return 'Novo no histórico comparado: ' + fmtNumber(item.currentUnits) +
      ' unidades e ' + fmtBRL(item.currentRevenue) + ' em ' + year + '.';
  }
  return fmtNumber(item.previousUnits) + ' para ' + fmtNumber(item.currentUnits) +
    ' unidades e ' + fmtBRL(item.previousRevenue) + ' para ' +
    fmtBRL(item.currentRevenue) + ' entre ' + (year - 1) + ' e ' + year + '.';
}
~~~

Não renderizar um grupo vazio como recomendação genérica; informar que não há evidência suficiente. Em meeting, toolbar aceita retorno à preparação; em shared, não renderizar controles internos. Usar superfície clara, tipografia grafite, contraste suficiente, foco visível, botões e links com texto e sem framer-motion durante a leitura.

Modificar SharedDashboardClientView.tsx para remover cenário escuro, saudação, cards decorativos e bloco opcional de IA. Durante esta tarefa, ele continua aceitando o dashboard interno atual para que a página de Clientes permaneça tipada antes da extração da Task 3:

~~~
export function SharedDashboardClientView({
  dashboardData,
  clientName,
  year,
}: {
  dashboardData: ClientReportData | ClientVisitDashboardData;
  clientName?: string;
  year?: number;
}) {
  const report = 'preparedAt' in dashboardData
    ? dashboardData
    : toClientReportData(dashboardData, clientName ?? '', year ?? new Date().getFullYear());
  return <ClientReportPresentation report={report} mode="shared" />;
}
~~~

Em app/shared/client/[token]/page.tsx, trocar as cores dos estados inválido/sem dados por tokens claros e manter os mesmos status de link.

- [ ] **Step 4: Run tests and typecheck**

Run: node --test tests/client-report-experience.test.mjs && npm run typecheck

Expected: exit 0. As rotas públicas continuam tratando link inválido, expirado e sem dados.

- [ ] **Step 5: Verify public page with local Supabase**

Run: npm run local:check

Gerar um link a partir de um cliente da massa local, abri-lo sem sessão e confirmar visualmente resumo, evolução, produtos e oportunidades no tema claro. Revogar esse link e confirmar que a rota pública volta a mostrar “Acesso inválido ou expirado”.

- [ ] **Step 6: Commit**

~~~powershell
git add components/client-report/ClientReportPresentation.tsx app/shared/client/[token]/SharedDashboardClientView.tsx app/shared/client/[token]/page.tsx tests/client-report-experience.test.mjs
git commit -m "feat: add client meeting presentation"
~~~

## Task 3: Preparação, compartilhamento e contexto da reunião

**Files:**
- Create: components/client-report/useClientReportData.ts
- Create: components/client-report/ClientReportShareControls.tsx
- Modify: components/client-dashboard/ClientVisitDashboard.tsx
- Modify: components/client-dashboard/ShareLinksManager.tsx
- Modify: tests/client-report-experience.test.mjs

**Interfaces:**
- Consumes: cinco consultas de lib/reportQueries.ts, buildClientVisitDashboardFromAggregates, ClientReportData da Task 1 e endpoints atuais em /api/share/client.
- Produces: useClientReportData(clientKey, year) e controles de link usados pelo preparador e pela página de apresentação da Task 4.

- [ ] **Step 1: Write failing flow test**

Acrescentar:

~~~
test('report preparation keeps a client/year context and makes sharing expiry visible', async () => {
  const dashboard = await read('components/client-dashboard/ClientVisitDashboard.tsx');
  const controls = await read('components/client-report/ClientReportShareControls.tsx');
  const hook = await read('components/client-report/useClientReportData.ts');

  assert.match(dashboard, /\/apresentar\?client=/);
  assert.match(dashboard, /Preparar relatório para o cliente/);
  assert.match(dashboard, /Apresentar relatório/);
  assert.match(controls, /expiresAt/);
  assert.match(controls, /Válido até/);
  assert.match(hook, /Promise\.all\(\[/);
  assert.match(hook, /buildClientVisitDashboardFromAggregates/);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test tests/client-report-experience.test.mjs

Expected: FAIL porque o hook, controles e rota ainda não foram criados.

- [ ] **Step 3: Extract aggregate loading**

Criar useClientReportData.ts:

~~~
export function useClientReportData(clientKey: string | null, year: number | null) {
  // retorna { data, error, isLoading, preparedAt }
}
~~~

Quando clientKey ou year for nulo, retornar estado sem dados. Quando mudarem, cancelar o efeito anterior com flag local, limpar os dados anteriores e executar getClientDashboardSummary, getClientMonthlyTrend, getClientYearlyHistory, getClientTopProducts e getClientRecentOrders em Promise.all. Usar buildClientVisitDashboardFromAggregates e registrar preparedAt no momento em que a resposta é aceita. Não buscar getClientSalesHistory neste hook.

Alterar ClientVisitDashboard.tsx para usar esse hook. A cronologia bruta permanece somente na aba Produtos da visão interna. Corrigir a chave de cache para incluir cliente e ano:

~~~
const historyKey = selectedClient && selectedYear
  ? selectedClient + ':' + selectedYear
  : null;
~~~

Usar historyKey no guard e após a carga para que trocar o ano não reaproveite linhas que foram limpas.

- [ ] **Step 4: Implement sharing and preparation**

Criar ClientReportShareControls.tsx:

~~~
export function ClientReportShareControls({
  clientId,
  year,
}: {
  clientId: string;
  year: number;
})
~~~

Ao criar link, manter POST /api/share/client, copiar a URL e informar “Link copiado. Válido até DD/MM/AAAA.” Delegar lista/revogação para ShareLinksManager, mantendo confirmação destrutiva. Atualizar o gerente para título “Links ativos para este relatório” e validade legível.

No modo de preparação de ClientVisitDashboard.tsx:

- trocar o título por “Preparar relatório para o cliente”;
- manter busca por nome/código e anos já permitidos;
- inserir “Comparação com {ano - 1}” após a seleção;
- exibir prévia resumida, “Dados consultados em …”, botão principal “Apresentar relatório” e secundários de compartilhar e Excel quando houver dados;
- navegar para /apresentar?client=<cliente-codificado>&year=<ano>;
- manter visão interna como ação secundária explícita;
- usar o vazio “Escolha um cliente para preparar o relatório” e ligar ausência de histórico à importação somente para quem tem acesso;
- remover “Modo Pitch Deck” e “Painel Técnico”.

Não alterar o contrato de Excel nem chamar IA nesta tela.

- [ ] **Step 5: Run regression tests**

Run: node --test tests/client-report-experience.test.mjs tests/client-groups-multiyear.test.mjs && npm test && npm run typecheck

Expected: todos passam. A cronologia de Produtos após alternar ano não fica zerada.

- [ ] **Step 6: Validate preparation locally**

Com a conta líder da massa local, selecionar o grupo de dois clientes, escolher 2026, verificar resumo de R$ 4.600 e comparação com 2025 de R$ 3.400, criar link e conferir validade. Alternar para 2025, abrir Produtos na visão interna e confirmar cronologia não zerada.

- [ ] **Step 7: Commit**

~~~powershell
git add components/client-report/useClientReportData.ts components/client-report/ClientReportShareControls.tsx components/client-dashboard/ClientVisitDashboard.tsx components/client-dashboard/ShareLinksManager.tsx tests/client-report-experience.test.mjs
git commit -m "feat: streamline client report preparation"
~~~

## Task 4: Rota de reunião sem navegação administrativa

**Files:**
- Create: app/(presentation)/layout.tsx
- Create: app/(presentation)/apresentar/page.tsx
- Create: app/(presentation)/apresentar/ClientReportPresentationPage.tsx
- Modify: tests/client-report-experience.test.mjs

**Interfaces:**
- Consumes: createServerSupabaseClient, useClientReportData, toClientReportData e ClientReportPresentation das Tasks 1–3.
- Produces: rota autenticada /apresentar?client=<codigo-ou-grupo>&year=<ano> que volta para /clientes preservando parâmetros.

- [ ] **Step 1: Write the failing route test**

~~~
test('meeting route authenticates without rendering the protected admin shell', async () => {
  const layout = await read('app/(presentation)/layout.tsx');
  const page = await read('app/(presentation)/apresentar/ClientReportPresentationPage.tsx');

  assert.match(layout, /createServerSupabaseClient/);
  assert.match(layout, /redirect\('\/login'/);
  assert.doesNotMatch(layout, /ProtectedNav|UserMenu/);
  assert.match(page, /ClientReportPresentation/);
  assert.match(page, /\/clientes\?client=/);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test tests/client-report-experience.test.mjs

Expected: FAIL porque a rota ainda não existe.

- [ ] **Step 3: Create presentation layout and page**

Em app/(presentation)/layout.tsx, usar createServerSupabaseClient, chamar auth.getUser() e redirecionar usuários sem sessão para /login?redirectedFrom=/apresentar. Renderizar apenas children; não importar ProtectedNav ou UserMenu.

Em page.tsx, receber searchParams assíncronos e passar valores brutos para ClientReportPresentationPage. No componente cliente, validar year como inteiro de 2000 a 2100 e exigir client. Para entrada inválida, mostrar explicação com link para /clientes. Para entrada válida, usar useClientReportData, converter com toClientReportData e renderizar:

~~~
<ClientReportPresentation
  report={report}
  mode="meeting"
  toolbar={
    <Link href={'/clientes?client=' + encodeURIComponent(client) + '&year=' + year}>
      Voltar à preparação
    </Link>
  }
/>
~~~

No carregamento, usar esqueleto claro que preserve a área de resumo. No erro ou ausência de dados, identificar cliente e ano, explicar a ausência e manter retorno à preparação. Não confiar no parâmetro para autorização: as RPCs autenticadas do hook continuam a autoridade de escopo.

- [ ] **Step 4: Run tests and types**

Run: node --test tests/client-report-experience.test.mjs && npm run typecheck

Expected: exit 0.

- [ ] **Step 5: Verify complete meeting flow**

1. Entrar como líder e abrir Clientes.
2. Selecionar o grupo da massa local e 2026.
3. Acionar “Apresentar relatório”; confirmar ausência de menu administrativo e presença de nome, 2026 vs 2025, resumo, evolução, produtos e oportunidades.
4. Usar Tab e Enter nos quatro atalhos, conferindo foco visível e salto para a seção correta.
5. Acionar “Voltar à preparação”; confirmar cliente e ano preservados.
6. Abrir URL de cliente fora do escopo com a conta representante; confirmar estado sem dados, sem exposição de outra carteira.

- [ ] **Step 6: Commit**

~~~powershell
git add app/(presentation)/layout.tsx app/(presentation)/apresentar/page.tsx app/(presentation)/apresentar/ClientReportPresentationPage.tsx tests/client-report-experience.test.mjs
git commit -m "feat: add client meeting route"
~~~

## Task 5: Tema claro e entrada centrada em preparar relatório

**Files:**
- Modify: app/layout.tsx
- Modify: app/globals.css
- Modify: app/(protected)/layout.tsx
- Modify: components/layout/ProtectedNav.tsx
- Modify: components/auth/UserMenu.tsx
- Modify: app/(protected)/page.tsx
- Modify: tests/client-report-experience.test.mjs

**Interfaces:**
- Consumes: rotas existentes /clientes, /reports e /upload.
- Produces: shell claro com entrada “Preparar relatório” e visão gerencial disponível sem competir com a tarefa principal.

- [ ] **Step 1: Write failing theme test**

~~~
test('application shell defaults to a light report-first workspace', async () => {
  const root = await read('app/layout.tsx');
  const shell = await read('app/(protected)/layout.tsx');
  const home = await read('app/(protected)/page.tsx');

  assert.doesNotMatch(root, /h-full antialiased dark/);
  assert.doesNotMatch(root, /bg-\[#030712\]/);
  assert.match(shell, /Preparar relatório/);
  assert.match(home, /Preparar relatório para o cliente/);
  assert.match(home, /Visão gerencial/);
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --test tests/client-report-experience.test.mjs

Expected: FAIL porque o shell ainda força a classe dark e fundo #030712.

- [ ] **Step 3: Apply light theme**

Em app/layout.tsx, remover a classe dark, fundo #030712, textura e gradiente escuro forçados. Usar bg-background text-foreground e seleção de alto contraste baseada em primary.

Em app/globals.css, manter tokens raiz claros e atualizar .glass, .glass-card e barra de rolagem para superfícies brancas/cinza claro, bordas discretas, sombra curta e foco por --ring. Não remover o media query de preferência por movimento reduzido. Não forçar .dark no HTML; componentes deste fluxo devem usar tokens background, foreground, muted, border e primary em vez de cores rígidas de azul-noite.

No layout protegido, usar cabeçalho branco com borda clara. Em ProtectedNav.tsx e UserMenu.tsx, substituir cores rígidas white, slate-400 e fundos escuros por tokens de tema com hover e foco legíveis.

- [ ] **Step 4: Reorganize entry and navigation**

No layout protegido, renomear /clientes para “Preparar relatório” e /upload para “Importações”. Manter Relatórios detalhados como “Relatórios”; não alterar URLs ou permissões.

No início, inserir antes dos indicadores um bloco com título “Preparar relatório para o cliente”, texto “Escolha um cliente, confira o período e apresente os dados na reunião.” e botão principal para /clientes. Renomear indicadores e rankings para “Visão gerencial”, preservando consultas e regras de líder. Remover “Torre de Controle — Operação Brasil” e “Visão Executiva”.

- [ ] **Step 5: Run complete checks**

Run: node --test tests/client-report-experience.test.mjs && npm test && npm run typecheck && npm run build

Expected: todos passam. Corrigir warnings de rota, hidratação ou importação antes de continuar.

- [ ] **Step 6: Review visually in local environment**

Abrir em 1280 px e verificar barra sem quebra de “Chat IA”, entrada “Preparar relatório” visível, fundo claro e nenhum texto branco em superfície clara. Repetir em 390 px, conferindo menu e botão sem corte horizontal. No link público, verificar contraste e as quatro seções em largura móvel.

- [ ] **Step 7: Commit**

~~~powershell
git add app/layout.tsx app/globals.css app/(protected)/layout.tsx components/layout/ProtectedNav.tsx components/auth/UserMenu.tsx app/(protected)/page.tsx tests/client-report-experience.test.mjs
git commit -m "feat: prioritize client report preparation"
~~~

## Task 6: Validação final de escopo, dados e permissões

**Files:**
- Modify: docs/qa/local-review-2026-09-17.md
- Modify: tests/client-report-experience.test.mjs somente se uma regressão observada exigir um guarda automatizado específico.

**Interfaces:**
- Consumes: resultado das Tasks 1–5, massa Supabase local e perfis líder/representante.
- Produces: evidência atualizada sem ocultar bloqueios de Excel e relatórios técnicos fora deste plano.

- [ ] **Step 1: Run complete automated verification**

Run: npm test && npm run typecheck && npm run local:check

Expected: exit 0 em todos. Não afrouxar uma asserção para ocultar regressão.

- [ ] **Step 2: Execute manual permission matrix**

| Perfil | Ação | Resultado esperado |
| --- | --- | --- |
| Líder | Preparar cliente/grupo em 2026 | Prévia e reunião mostram cliente/ano e comparação 2025 iguais. |
| Líder | Compartilhar e abrir sem sessão | Quatro seções, incluindo oportunidades; sem ferramentas internas ou outra carteira. |
| Líder | Revogar link | Página e GET /api/share/data deixam de autorizar token. |
| Representante | Abrir URL de cliente fora da carteira | Nenhum dado de outra carteira ou conta. |
| Qualquer perfil | Base anterior zero | Texto “Sem base anterior”, sem percentual enganoso. |
| Qualquer perfil | Produto anterior e zero no atual | Texto “Sem compra registrada no período” e valores dos dois anos. |

- [ ] **Step 3: Update QA evidence**

Em docs/qa/local-review-2026-09-17.md, adicionar seção datada “Experiência de relatório para reunião” com comandos, perfis, resultados da matriz e capturas novas quando ajudarem a reproduzir o resultado. Manter falhas P1/P2 anteriores que não foram corrigidas; não declarar Excel resolvido.

- [ ] **Step 4: Commit**

~~~powershell
git add docs/qa/local-review-2026-09-17.md tests/client-report-experience.test.mjs
git commit -m "test: validate client report experience"
~~~

## Self-Review

| Requisito da especificação | Task |
| --- | --- |
| Preparar: busca, ano, comparação, prévia e ações | 3 |
| Apresentar: resumo → evolução → produtos → oportunidades | 2 e 4 |
| Oportunidades explicadas por dados e sem inferir estoque | 1 e 2 |
| Enviar: link, validade, revogação e mesma composição | 1, 2 e 3 |
| Escopo seguro da conta e do cliente/grupo | 1, 2, 4 e 6 |
| Tema claro e prioridade da preparação | 5 |
| Excel separado e disponível | Global Constraints e 3 |
| Estados de vazio, erro, base zero e link inválido | 2, 3, 4 e 6 |
| Validação local, por papel e por dispositivo | 2, 4, 5 e 6 |

Não há lacunas de trabalho marcadas, nem interfaces usadas antes de serem introduzidas. As referências de caminho e comando foram conferidas contra o repositório atual. O plano não presume um arquivo Excel-modelo inexistente e não promete equivalência visual de exportação sem ele.

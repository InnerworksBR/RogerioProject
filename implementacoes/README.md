# Índice de Implementações — Autimex Reports

Este diretório segue **Spec-Driven Development**: cada implementação é uma pasta numerada
`NNN-nome` contendo `spec.md` (contrato) e `tasks.md` (plano de execução). Atualize o status
aqui sempre que uma implementação mudar de estado.

## Legenda de Status

🟡 Planejada · 🔵 Em Andamento · 🟢 Concluída · 🔴 Bloqueada · ⚪ Cancelada

---

## Histórico (implementações anteriores)

| Nº | Nome | Domínio | Status |
|----|------|---------|--------|
| 001 | Solicitação de Licenças | Time/licenças | 🟢 Concluída* |
| 002 | Chat de Relatórios com IA | IA/chat | 🟢 Concluída* |
| 003 | Histórico e Contexto Markdown do Chat | IA/chat | 🟢 Concluída* |
| 004 | Toolkit Comercial do Chat IA | IA/chat | 🟢 Concluída* |
| 005 | Hardening de Segurança, Performance e Deploy | Backend/segurança | 🟢 Parcial* |

\* Status inferido do código (a maior parte da 005 está aplicada no código; o eixo P2 de
performance — migration `0016` — ficou em aberto e é retomado pela 009. As tarefas 3–26 do
`tasks.md` da 005 estão desatualizadas em relação ao código real).

---

## Remediação da Auditoria (segurança + funcionalidades + UX)

Decomposição dos achados da auditoria completa pré-entrega em 8 implementações coesas.

| Nº | Nome | Domínio | Prioridade | Status | Depende de |
|----|------|---------|-----------|--------|-----------|
| [006](./006-corretude-datas-agregacoes-relatorios/spec.md) | Corretude de Datas e Agregações dos Relatórios | Parsing/dados | 🔴 Crítica | 🟢 Concluída (8/8) | — |
| [007](./007-regras-negocio-filtros-relatorios/spec.md) | Regras de Negócio e Filtros dos Relatórios | Lógica de relatório | 🟠 Alta | 🔵 Em Andamento (8/9) | — |
| [008](./008-hardening-seguranca-residual-config-producao/spec.md) | Hardening de Segurança Residual e Config de Produção | Backend/segurança | 🟠 Alta | 🔵 Em Andamento (8/9) | 005 |
| [009](./009-performance-consultas-dashboard-cliente/spec.md) | Performance de Consultas e Dashboard de Cliente | Performance/SQL | 🟡 Média | 🔵 Em Andamento (6/8 — resta medição em staging) | 005 |
| [010](./010-acessibilidade-padroes-interacao/spec.md) | Acessibilidade e Padrões de Interação | a11y/UI | 🟠 Alta | 🟢 Concluída (8/8) | — |
| [011](./011-tratamento-erros-estados-tema/spec.md) | Tratamento de Erros, Estados e Tema | Resiliência UI | 🟡 Média | 🟢 Concluída (7/7) | — |
| [012](./012-refinamento-fluxo-upload/spec.md) | Refinamento do Fluxo de Upload | UX upload | 🟡 Média | 🟢 Concluída (7/7) | — |
| [013](./013-polimento-relatorios-consistencia-visual/spec.md) | Polimento de Relatórios e Consistência Visual | UI/polish | 🟢 Baixa | 🟢 Concluída (9/9) | 010 (Combobox) |

---

## Ordem de Execução Recomendada

1. **006 — Corretude de Datas (🔴 PRIMEIRO).** Bloqueador de corretude: hoje vendas do dia 1º
   de cada mês caem no mês/ano anterior, invalidando todos os relatórios. Nada de UX/polish
   adianta enquanto os números estiverem errados.
2. **008 e 010 em paralelo (🟠 Alta).** 008 fecha o hardening residual de segurança/produção
   (segredos, rate-limit do link público, CSP, confiabilidade da IA); 010 entrega a base de
   acessibilidade e os componentes (AlertDialog, Combobox) reutilizados depois.
3. **007 (🟠 Alta).** Regras de negócio e filtros — alguns itens dependem de decisão do cliente
   (bagagito prefixo "4"; Geral filtrado vs. config-driven).
4. **009, 011, 012 em paralelo (🟡 Média).** Performance, resiliência de erros/estados/tema e
   refinamento do upload — independentes entre si.
5. **013 por último (🟢 Baixa).** Polimento de relatórios e consistência visual; o autocomplete
   de produto reutiliza o Combobox da 010.

## Itens que Exigem Decisão do Cliente (antes de fechar as specs)

- **006 / Total de Pedidos:** `DISTINCT codigo_pedido` (atual, recomendado) vs. `count(*)` do PRD.
- **007 / Bagagitos:** aplicar o prefixo de referência "4" como alta confiança (regra do PRD) ou
  manter só por descrição com revisão manual.
- **007 / Relatório Geral:** filtrar linhas por produto/cliente (mover filtro para o WHERE) ou
  manter "config-driven" (mostra todos os itens cadastrados, zerando os não filtrados).
- **008 / Link público:** escopo "lifetime" (atual) vs. limitar aos anos contratados do link.
- **013 / Layout multi-ano:** exibir todos os anos lado a lado (PRD) é esforço maior, registrado
  como decisão fora do escopo da 013 (que cobre cabeçalho de Ano + linha de totais + scroll).

---

## Resumo da Auditoria (origem desta remediação)

- **Segurança:** nenhum P0. A 005 cobriu o grosso (RLS multi-tenant, REVOKEs de PUBLIC/anon,
  rate-limit de IA no Postgres, upload idempotente, headers defensivos). Residual em 008.
- **Funcionalidades:** 1 bug crítico de corretude (datas → mês/ano) em 006; bugs/gaps médios de
  regra de negócio em 007; performance pendente em 009.
- **UX:** base visual forte (dark/glass, virtualização, formatação pt-BR); lacunas em
  acessibilidade (010), boundaries de erro/tema (011), fluxo de upload (012) e polimento (013).

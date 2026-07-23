# Decisões

## D-001 — Cache desta fase

- **Estado:** aprovado
- **Decisão:** usar TanStack Query para cache privado/deduplicação no navegador e agregação por BFF; não introduzir cache servidor compartilhado.
- **Motivo:** o projeto já possui a dependência, não há infraestrutura de cache aprovada e um cache servidor mal chaveado representa risco de vazamento entre tenants.
- **Consequência:** instâncias diferentes do Next.js não compartilham cache; essa evolução exige implementação própria com aprovação de custo e segurança.

## D-002 — IA deixa de ser automática

- **Estado:** aprovado
- **Decisão:** gerar o resumo executivo somente após ação explícita.
- **Motivo:** a montagem atual pode abrir rate limit + três consultas de dados + chamada OpenAI sem intenção do usuário.
- **Consequência:** reduz custo e fan-out, mas adiciona um clique para gerar o conteúdo.

## D-003 — Sem migration nesta fase

- **Estado:** aprovado
- **Decisão:** reutilizar as RPCs agregadas e índices já entregues pela implementação 009/migration 0021.
- **Motivo:** o problema atual é principalmente coordenação, repetição e payload; mudanças remotas exigiriam outro gate.
- **Consequência:** medição pode revelar uma consulta que ainda precise de migration futura, registrada como novo escopo.

## D-004 — Exportação separada da UI

- **Estado:** aprovado
- **Decisão:** limites do BFF valem para renderização; exportação consolidada continua uma ação explícita e não aquece automaticamente o cache da UI.
- **Motivo:** exportação precisa de completude enquanto a tela precisa de resposta limitada e rápida.
- **Consequência:** exportação ainda pode ser custosa e deverá ser medida separadamente.

## Aprovação

Spec e decisões aprovadas explicitamente pelo usuário em 2026-07-23 nesta tarefa do Codex.

## D-005 — Endpoint limitado de opções

- **Estado:** aprovado por aderência ao escopo RF-005
- **Decisão:** adicionar `GET /api/reports/options` para busca debounced de clientes e produtos.
- **Motivo:** o bootstrap entrega apenas uma página inicial; sem endpoint dedicado, a UI precisaria carregar catálogos inteiros ou repetir todo o bootstrap a cada tecla.
- **Consequência:** um Route Handler adicional, autenticado e coberto pelos mesmos limites/telemetria, sem ampliar dados ou permissões.

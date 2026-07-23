# Validação da implementação 017

Data: 2026-07-23

## Resultado

Implementação concluída dentro do escopo aprovado, sem migration, dependência nova, alteração de RLS, `service_role` ou deploy externo.

## Fan-out lógico reproduzível

A contagem abaixo considera operações de dados emitidas ao Supabase pelo carregamento automático de `/reports`. A autenticação pode acrescentar uma operação no proxy e outra no Route Handler, conforme a sessão.

| Cenário | Antes | Depois |
|---|---:|---:|
| Carga fria de `/reports` | 13–17 operações estimadas | 6 operações de dados no bootstrap; 7–8 incluindo autenticação |
| Repetição dentro de `staleTime` | repetia efeitos independentes | 0 operações de dados, atendida pelo cache privado do navegador |
| Troca de filtro | efeitos paralelos por KPI/view/opções | 2 operações coordenadas: relatório ativo + KPI; 3 nas abas que também precisam dos anos configurados |
| Resumo por IA | automático na montagem e troca de ano/cliente | 0 automático; executa somente após clique explícito |

O valor posterior é reproduzido diretamente pelas operações instrumentadas em `getReportsBootstrap`: anos, clientes, produtos, tipos de receita, KPI e relatório inicial. Cada uma emite `report_query` com `requestId`, duração, linhas, status e estado de cache. A execução local não possui tráfego de produção para comparar métricas reais do painel Supabase; os logs adicionados permitem medir isso após publicação, que ficou fora do escopo aprovado.

## Evidências automatizadas

| Comando | Código de saída | Evidência |
|---|---:|---|
| `npm test` | 0 | 47 testes aprovados, incluindo 7 testes da orquestração de relatórios |
| `npm run typecheck` | 0 | TypeScript sem erros |
| `npm run lint` | 0 | script do projeto (`tsc --noEmit`) sem erros |
| `npm run build` | 0 | Next.js 16.2.6 compilou, tipou e gerou 31 páginas; as três rotas `/api/reports/*` foram reconhecidas |
| `git diff --check` | 0 | sem erros de whitespace; apenas avisos de normalização LF/CRLF do Git |

## Critérios verificados

- As cinco views não importam `reportQueries`, `useEnsureReportYears` ou cliente Supabase.
- A tela possui um owner para bootstrap, filtros, aba ativa e consulta.
- As chaves de cache incluem relatório, ano, cliente, produto, semestre, receita e limite.
- `AbortSignal`, `keepPreviousData`, `staleTime`, deduplicação do TanStack Query e invalidação pós-upload estão ativos.
- IA não faz `fetch` em efeito de montagem; gerar e tentar novamente dependem de ação explícita.
- Consultas de UI têm limite máximo de 20.000 linhas, padrão de 10.000, flag `truncated` e aviso visual.
- Catálogos automáticos são limitados; não há fallback de 10.000 linhas no caminho server-side dos filtros.
- Erros retornados ao cliente são genéricos; telemetria não inclui token, e-mail ou identificadores de cliente/produto.

## Limitações e risco residual

- A exportação consolidada continua usando o caminho legado e pode ler volumes maiores, conforme CA-012; ela só roda por clique e fica separada da carga automática.
- Páginas legadas individuais (`/reports/base-compra`, por exemplo) não fazem parte do grafo da tela consolidada e continuam no fluxo antigo. A rota principal `/reports` já não as monta.
- A comprovação de redução real de egress/requests no painel Supabase depende de publicar e observar tráfego real; deploy não foi autorizado nesta implementação.

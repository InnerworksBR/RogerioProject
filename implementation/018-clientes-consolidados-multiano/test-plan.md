# Plano de testes

## Estratégia

Combinar testes contratuais estáticos para migration/Next.js, testes unitários dos parsers e chaves, typecheck e build de produção. Sem credenciais e banco isolado local, operações SQL remotas não serão executadas; essa limitação será explicitada.

## Unitários

- normalização, ordenação, deduplicação e limites da seleção de anos;
- compatibilidade de `year` e `years`;
- chaves de cache e payload de exportação;
- rótulo de total parcial e estados de upload.

## Integração e contrato

- tabelas, constraints, helpers e políticas RLS da migration;
- autorização de CRUD dos grupos e configuração;
- resolvedor de cliente simples/canônico em relatórios, compartilhamento e IA;
- redirects e Route Handlers conforme Next.js 16.3.0.

## End-to-end

- build de produção garante fronteiras Server/Client e geração das rotas;
- fluxos remotos de Supabase ficam para smoke test pós-migration no ambiente autorizado.

## Casos de borda

- anos duplicados, inválidos, vazios e mais de quatro;
- grupo vazio, membro duplicado e UUID inválido;
- exportação truncada acima de 100.000;
- substituição exata, sobreposição parcial e exclusão de upload sem confirmação.

## Dados e ambiente

- somente arquivos do repositório e doubles existentes;
- nenhuma conexão a produção, credencial ou dado real será usado.

## Comandos, resultados e evidências

Resultados serão registrados em `validation.md` com exit code e limitações.

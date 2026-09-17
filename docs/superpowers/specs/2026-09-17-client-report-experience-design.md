# Proposta de experiência: relatório para reunião com o cliente

Data: 17/09/2026. Status: proposta para revisão; implementação ainda não iniciada.

## Decisões confirmadas na conversa

- A tarefa principal é preparar um relatório para mostrar ao cliente.
- O uso principal ocorre na tela durante uma reunião; também deve ser possível enviar o relatório.
- O conteúdo pode incluir oportunidades de compra, além de histórico e comparações.
- O usuário considera a interface atual pouco intuitiva e desaprova a aparência escura.
- O Excel deve preservar o modelo original, com anos lado a lado, agrupamentos e totais. A tela pode ter outra organização.

## Direção recomendada

Organizar a experiência em preparar, apresentar e compartilhar um relatório contínuo. A página inicial deve tornar a escolha do cliente e a preparação do relatório imediatamente visíveis. O painel gerencial continua disponível em uma posição secundária.

A alternativa de slides organiza a conversa em etapas rígidas, mas dificulta consultar rapidamente produtos e períodos. Um editor livre de apresentações exigiria escolhas de composição e aumentaria o trabalho de preparação. O relatório contínuo com atalhos para suas seções é a recomendação para esta revisão.

O tema recomendado é claro: fundo cinza muito claro, superfícies brancas, texto grafite e azul como cor principal de ação. Verde e âmbar comunicam situações acompanhadas de texto. A identidade e a cor exata ainda serão avaliadas na prévia visual; não são decisões confirmadas pelo usuário.

## 1. Preparar o relatório

Título: “Preparar relatório para o cliente”.

Ordem da tela:

1. Busca do cliente por nome ou código, incluindo os grupos já cadastrados e autorizados para a conta.
2. Escolha do período e indicação explícita do período de comparação.
3. Prévia do relatório e informação sobre a atualização dos dados.
4. Ação principal “Apresentar”; ações secundárias “Compartilhar” e “Baixar Excel”.

Pesquisa, seleção e prévia ficam na mesma área de trabalho. Evitar um assistente que obrigue a avançar por páginas para cada escolha. A administração de grupos fica em Clientes, fora do início da preparação.

No estado inicial, orientar “Escolha um cliente para preparar o relatório”. Sem histórico, explicar a ausência e oferecer o caminho para importar os dados a quem tiver permissão. Durante a carga, indicar cliente e período solicitados; dados da seleção anterior não podem parecer pertencer à nova seleção.

## 2. Apresentar na reunião

O modo de apresentação usa toda a área útil da página, ocultando a navegação administrativa. Mantém um controle discreto para voltar à preparação, sem perder cliente e período. Deve funcionar mesmo sem entrar na tela cheia do navegador.

O relatório começa com nome do cliente, período e resumo útil. Retirar a abertura atual de quase uma tela inteira com saudação e conteúdo decorativo.

Sequência proposta:

| Seção | Conteúdo e função na conversa |
| --- | --- |
| Resumo de compras | Valor comprado, unidades, pedidos e comparação com o período anterior |
| Evolução | Comparação mensal e entre anos, com períodos e unidades explicitamente identificados |
| Produtos | Produtos comprados, quantidades e valores; detalhamento acessível conforme surgir uma pergunta |
| Oportunidades de compra | Produtos sem recompra, com redução ou em crescimento, acompanhados dos números que sustentam a leitura |

Atalhos “Resumo”, “Evolução”, “Produtos” e “Oportunidades” permitem mudar de assunto durante a reunião sem uma longa rolagem. A apresentação deve funcionar com teclado, com foco visível, e não depender de passar o mouse para revelar um número essencial.

A linguagem deve refletir a perspectiva do cliente: “Valor comprado” em vez de “Receita”, “Apresentar relatório” em vez de “Modo Pitch Deck”, “Preparar relatório” em vez de “Painel Técnico”. Evitar animações que atrasem a leitura durante a conversa.

## 3. Oportunidades com evidência

A inclusão desta seção foi confirmada pelo usuário. A apresentação proposta não depende de IA: os cálculos existentes já distinguem redução, ausência de recompra, crescimento e produtos novos no histórico comparado.

Cada item mostra produto, períodos comparados, unidades, valor e motivo da sugestão. Exemplo ilustrativo, não dado real: “Produto A: 120 unidades no período anterior e 40 no atual. Houve redução de 80 unidades; vale conversar sobre a próxima compra”.

Cuidados de interpretação que fazem parte do resultado esperado:

- Ausência de registro deve aparecer como “Sem compra registrada no período”.
- Crescimento de valor não significa necessariamente crescimento de unidades; a explicação precisa usar a métrica que realmente variou.
- Um produto comprado apenas no período atual é “Novo no histórico comparado”. Isso não comprova recomendação de um produto ainda não comprado.
- O histórico de compras permite sugerir uma conversa sobre reposição; ele não informa o estoque atual do cliente.
- Não calcular percentual de crescimento com denominador zero como se houvesse uma base comparável.
- Mostrar intervalos de comparação equivalentes. Se a base estiver incompleta, tornar essa limitação visível e não interpretar meses futuros como queda nas compras.

Na ausência de evidência suficiente, a seção informa isso diretamente. Não preencher o relatório com sugestões genéricas para ocupar espaço.

## 4. Enviar ao cliente

Recomendação: compartilhar um link de consulta com a mesma organização e o mesmo escopo de cliente e período da prévia. A apresentação recebida deve ser legível também no celular. A exportação Excel permanece uma ação disponível ao representante para envio do arquivo.

O envio por link é uma proposta de mecanismo, ainda não uma preferência explicitamente escolhida pelo usuário. O aplicativo já possui links de consulta com revogação e validade de sete dias; a proposta preserva esse comportamento e torna a validade visível junto da ação de copiar.

O link atual consulta a base ao ser aberto. A proposta mantém esse comportamento, com indicação de atualização dos dados: não prometer que o conteúdo fica congelado na data da reunião. Preservar uma cópia imutável de cada apresentação seria uma mudança de escopo a discutir separadamente.

O visitante recebe apenas os dados autorizados para aquele cliente ou grupo. Configuração, equipe, carteira de outros clientes e ferramentas internas não fazem parte dessa visão.

Há uma lacuna concreta: `SharedClientDashboardDto`, em `lib/server/shareLinks.ts`, contém resumo, evolução e principais produtos, mas não contém oportunidades. O bloco de oportunidades de IA em `SharedDashboardClientView.tsx` depende de uma propriedade opcional; isso não resolve a ausência dos cálculos de oportunidades no contrato compartilhado. A implementação deverá alinhar esses conteúdos explicitamente.

## 5. Destino das funcionalidades existentes

| Funcionalidade atual | Papel na experiência proposta |
| --- | --- |
| Início e indicadores gerais | Preparação como entrada principal; visão gerencial acessível em segundo plano |
| Clientes e grupos | Busca, consulta e manutenção da carteira; grupos disponíveis na seleção sem exigir sua administração antes de preparar |
| Apresentação do cliente | Destino principal do fluxo, com tema claro e conteúdo organizado para reunião |
| Cinco relatórios tabulares | Continuam disponíveis como relatórios detalhados, com descrição do propósito de cada um |
| Excel individual e consolidado | Manter ambos e cumprir a organização exigida no modelo original |
| Upload e histórico | Área “Importações”, com período, resultado e histórico atualizado após concluir |
| Compartilhamento e revogação | Acessíveis junto do relatório preparado; estado e validade visíveis |
| Oportunidades | Integradas à apresentação e ao conteúdo compartilhado, sustentadas pelos dados |
| Resumo e chat com IA | Apoio opcional, com disponibilidade clara e sem bloquear preparar ou apresentar |
| Configuração de produtos | Área administrativa, usando linguagem de negócio |
| Equipe, convites e licenças | Área administrativa, preservando as permissões existentes |
| Conta, login e recuperação | Acesso e manutenção da conta; estados de erro com caminho de recuperação funcional |

Menu proposto: “Preparar relatório”, “Clientes”, “Relatórios detalhados” e “Importações”. Agrupar gestão e configurações em uma área administrativa; manter a visão geral disponível como consulta gerencial. Os rótulos e a posição definitiva serão avaliados no desenho visual.

## 6. Limites e organização da implementação futura

Preservar os cálculos e as permissões existentes que atendem ao escopo. Separar a preparação, o conteúdo de apresentação e os controles de compartilhamento, permitindo que a prévia autenticada e a página compartilhada usem a mesma composição visual e definições de cálculo. O contrato público continua limitado aos campos necessários ao cliente.

Os filtros que determinam os dados precisam acompanhar toda a sequência. Hoje o compartilhamento representa cliente e ano; ampliar a seleção para semestre ou outros recortes exige suporte equivalente no contrato e na consulta do link antes de oferecer esses filtros no novo fluxo.

Exportar Excel permanece uma responsabilidade distinta da composição visual da apresentação. A fidelidade do arquivo será avaliada por estrutura, agrupamentos, totais e comparação com o modelo original. O arquivo original ainda é necessário para verificar detalhes que não foram fornecidos, como dimensões e formatação exata.

Esta proposta não acrescenta criação de pedidos, previsão de estoque, catálogo de produtos inéditos, editor de slides ou envio automático de mensagens. A integração de PDF também não foi definida nesta conversa.

## 7. Critérios para validar o resultado

- Um usuário encontra “Preparar relatório” e consegue escolher cliente e período sem conhecer os nomes dos cinco relatórios técnicos.
- A primeira área visível da apresentação identifica cliente, período e resumo, com leitura confortável em notebook durante uma reunião.
- O representante consegue consultar produtos e oportunidades e retornar à preparação sem perder o contexto.
- Com a mesma base e filtros, resumo, detalhes, apresentação, link e Excel exibem valores compatíveis.
- Cada oportunidade explica os dados que a sustentam e distingue variação de valor de variação de unidades.
- O link inclui as seções prometidas na prévia e funciona no celular, sem acesso a outras carteiras ou às ferramentas internas.
- Cliente ou período sem dados, base anterior zero, carga incompleta, falha de rede, link expirado e link revogado têm estados compreensíveis e recuperáveis.
- O Excel mantém anos lado a lado, agrupamentos e totais. Sua aparência não depende do tema da tela.
- A disponibilidade da IA é indicada antes da tentativa de uso; o fluxo principal funciona com IA desativada.

Validar com navegação real no ambiente Supabase local, pelos perfis de líder e representante e por visitante sem sessão. Conferir os valores com a massa fictícia, testar mudança de cliente/período e comparar os arquivos efetivamente baixados. Para a interface, verificar teclado, legibilidade, foco, projeção em notebook e consulta do link no celular.

## Relação com a revisão funcional

A proposta complementa `docs/qa/local-review-2026-09-17.md`. A falha ao trocar relatórios, a recuperação de erro, o convite, a cronologia por ano e a divergência do Excel continuam pendentes. A reformulação visual não representa correção dessas falhas.

A inspeção deste documento é uma análise de design e código. Não houve nova rodada de testes nem implementação de interface nesta etapa.

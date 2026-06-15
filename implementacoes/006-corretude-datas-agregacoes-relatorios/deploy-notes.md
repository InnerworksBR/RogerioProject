# Notas de Deploy — 006 Corretude de Datas e Agregações

> **Implementação:** 006
> **Data:** 2026-06-15

## Reprocessamento de Uploads Anteriores ao Fix

### Por que é necessário

O bug de fuso (mes/ano derivados de getters locais em vez da string ISO) afetava todos
os uploads realizados antes do deploy desta correção. Registros com data de pedido no
dia 1º de cada mês foram gravados em `sales_rows` com `mes`/`ano` do mês anterior.
Por exemplo, vendas de `2024-01-01` estão gravadas como `mes=12, ano=2023`.

### Dados afetados

Qualquer linha em `sales_rows` cujo campo `data_pedido` tenha dia `01` e cuja data de
upload seja anterior ao deploy desta versão. Em fusos negativos (América/São Paulo,
UTC-3), isso inclui **todo dia 1º de qualquer mês**.

### Procedimento de correção

Para corrigir os dados históricos, os uploads afetados precisam ser reprocessados:

1. **Identificar os uploads** com `data_pedido` contendo dia `01`:
   ```sql
   SELECT DISTINCT DATE_TRUNC('month', data_pedido::date) AS mes_afetado, COUNT(*)
   FROM sales_rows
   WHERE EXTRACT(day FROM data_pedido::date) = 1
   GROUP BY 1
   ORDER BY 1;
   ```

2. **Revogar os uploads** pelo painel de administração ou via RPC `revoke_upload`
   para que o hash de fingerprint seja liberado para re-upload.

3. **Re-subir os arquivos** originais — o parser corrigido irá gravar `mes`/`ano`
   corretos desta vez.

> **Atenção:** a idempotência de upload é baseada em fingerprint (hash do arquivo).
> Se o arquivo original não foi modificado, é necessário revogar o upload anterior
> antes de re-submeter — caso contrário o sistema rejeitará como duplicata.

### Impacto de não reprocessar

Os relatórios continuarão exibindo dados históricos incorretos para datas no dia 1º de
cada mês. Novos uploads (após o deploy) já estarão corretos.

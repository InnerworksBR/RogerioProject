# Notas de Deploy — 015 Reimportação com Substituição por Período Exato

> **Implementação:** 015
> **Data:** 2026-06-30

## Resumo

Esta entrega tem **dois passos obrigatórios**: aplicar a migration `0022` no banco de
produção **e** publicar o código novo (`app/api/upload/route.ts`). Enquanto o código antigo
estiver no ar, o bloqueio por fingerprint continua barrando a reimportação — os dois passos
precisam ir juntos. O deploy de banco neste projeto é **manual via SQL Editor** do Supabase.

## Passo 1 — Aplicar a migration 0022 (SQL Editor de produção)

Cole e rode o conteúdo de `supabase/migrations/0022_replace_period_on_reupload.sql`. Ela:

1. Dropa o índice único `idx_uploads_unique_user_fingerprint` (deixa de travar reimportação).
2. Recria `finalize_upload` para, ao concluir, **apagar os uploads do mesmo período exato**
   do usuário (cascateando `sales_rows` e `upload_chunks`).
3. Executa `NOTIFY pgrst, 'reload schema'` para recarregar o schema cache do PostgREST.

Aplicar via SQL Editor já recarrega o cache automaticamente; o `NOTIFY` é reforço.

> **Pré-requisito:** as migrations `0014`–`0021` precisam já estar aplicadas em produção. Se
> o ambiente estiver atrasado (sintoma: erro "Could not find the function
> public.append_upload_chunk ... in the schema cache"), rode primeiro a sequência `0014`→`0021`.

## Passo 2 — Deploy do código

Publicar a branch `main` (commit `6a14c1f`) com a mudança em `app/api/upload/route.ts`:
remoção do bloqueio por fingerprint e exclusão do período exato do aviso de sobreposição.

## Limpeza de registros-fantasma (opcional)

As tentativas que falharam antes deste fix deixaram registros em `uploads` (status `error`,
sem `sales_rows`) que podem travar a reimportação no código antigo. Após o deploy + migration,
**eles somem sozinhos no finalize** quando o mesmo período é reimportado. Para destravar antes
do deploy (ex.: testar imediatamente), remova os uploads não concluídos do usuário:

```sql
delete from uploads u
using auth.users au
where au.id = u.user_id
  and au.email = '<email-do-usuario>'
  and u.status <> 'complete';
```

## Verificação pós-deploy

1. Importar um período; reimportar o mesmo período corrigido → relatórios refletem só a nova
   versão, **sem dobrar** valores.
2. Importar um período parcialmente sobreposto a outro → a confirmação de sobreposição aparece.
3. (Opcional) Forçar falha no meio de uma reimportação → o dado antigo do período permanece.

## Rollback

- **Código:** reverter o commit `6a14c1f` restabelece o bloqueio por fingerprint/sobreposição.
- **Banco:** para restaurar a trava de unicidade, recriar o índice:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_unique_user_fingerprint
    ON uploads(user_id, fingerprint) WHERE fingerprint IS NOT NULL;
  ```
  A versão anterior de `finalize_upload` está na migration `0014`. Atenção: reverter só o banco
  sem reverter o código (ou vice-versa) recria o estado inconsistente que esta entrega resolve.

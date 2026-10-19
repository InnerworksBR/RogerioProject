import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createShareToken, getShareLinkExpiry } from '@/lib/server/shareLinks';

export class ClientShareError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function createClientShare(
  supabase: SupabaseClient,
  userId: string,
  input: unknown
) {
  const { clientId, year } = (input && typeof input === 'object' ? input : {}) as {
    clientId?: unknown; year?: unknown;
  };
  if (typeof clientId !== 'string' || !clientId.trim() || clientId.length > 160
    || typeof year !== 'number' || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ClientShareError(400, 'Selecione um cliente e um ano válidos para compartilhar.');
  }

  const { data: resolvedCodes, error: resolveError } = await supabase.rpc('resolve_client_codes', {
    p_client_key: clientId,
  });
  if (resolveError) throw new ClientShareError(500, 'Não foi possível validar o cliente. Tente novamente.', resolveError);
  const clientCodes = ((resolvedCodes ?? []) as Array<{ cod_cliente: string }>).map((item) => item.cod_cliente);
  if (clientCodes.length === 0) throw new ClientShareError(403, 'Cliente fora do seu escopo.');

  // Só precisamos comprovar a existência de uma venda visível, sem contar a base inteira.
  const { data: sales, error: salesError } = await supabase
    .from('sales_rows').select('id').in('cod_cliente', clientCodes).eq('ano', year).limit(1);
  if (salesError) throw new ClientShareError(500, 'Não foi possível verificar as compras do cliente. Tente novamente.', salesError);
  if (!sales?.length) {
    throw new ClientShareError(422, `Este cliente não possui compras em ${year}. Selecione um ano com compras para gerar o link.`);
  }

  const { token, tokenHash } = createShareToken();
  const expiresAt = getShareLinkExpiry();
  const { data, error } = await supabase.from('share_links').insert({
    user_id: userId, token_hash: tokenHash, client_id: clientId, year, expires_at: expiresAt,
  }).select('id').single();
  if (error) throw new ClientShareError(500, 'Não foi possível salvar o link de compartilhamento. Tente novamente.', error);
  return { id: data.id as string, token, expiresAt };
}

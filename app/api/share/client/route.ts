import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { requireSameOrigin } from '@/lib/server/requestSecurity';
import { createShareToken, getShareLinkExpiry } from '@/lib/server/shareLinks';

export async function GET() {
  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('share_links')
    .select('id, client_id, year, expires_at, revoked_at, created_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ links: data ?? [] });
}

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { clientId, year } = (await request.json().catch(() => ({}))) as {
    clientId?: string;
    year?: number;
  };

  if (!clientId || !Number.isInteger(year) || year! < 2000 || year! > 2100) {
    return NextResponse.json({ error: 'Cliente e ano sao obrigatorios.' }, { status: 400 });
  }

  const { count, error: clientError } = await supabase
    .from('sales_rows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('cod_cliente', clientId)
    .eq('ano', year!);

  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'Cliente ou ano fora do seu escopo.' }, { status: 403 });

  const { token, tokenHash } = createShareToken();
  const expiresAt = getShareLinkExpiry();
  const { data, error } = await supabase
    .from('share_links')
    .insert({
      user_id: user.id,
      token_hash: tokenHash,
      client_id: clientId,
      year,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shareLink = `${request.nextUrl.origin}/shared/client/${token}`;
  return NextResponse.json({ id: data.id, shareLink, expiresAt });
}

export async function DELETE(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Link obrigatorio.' }, { status: 400 });

  const { error } = await supabase
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { requireSameOrigin } from '@/lib/server/requestSecurity';
import { ClientShareError, createClientShare } from '@/lib/server/clientShare';

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

  try {
    const { id, token, expiresAt } = await createClientShare(supabase, user.id, await request.json().catch(() => null));
    const shareLink = `${request.nextUrl.origin}/shared/client/${token}`;
    return NextResponse.json({ id, shareLink, expiresAt });
  } catch (error) {
    if (error instanceof ClientShareError && error.status < 500) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[share.create]', error);
    return NextResponse.json({ error: error instanceof ClientShareError ? error.message : 'Não foi possível gerar o link. Tente novamente.' }, { status: 500 });
  }
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

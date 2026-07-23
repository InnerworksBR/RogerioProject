import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { normalizeInternalPath } from '@/lib/passwordPolicy';

/**
 * Callback de autenticação do Supabase (PKCE).
 *
 * Atende tanto ao fluxo de recuperação de senha (`resetPasswordForEmail`)
 * quanto ao convite de representantes (`inviteUserByEmail`): ambos entregam um
 * `code` que é trocado por uma sessão. Em sucesso, redireciona para o destino
 * interno (`next`, sanitizado); em código ausente/expirado, volta ao login com
 * um indicador de erro.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = normalizeInternalPath(searchParams.get('next'), '/');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=link_invalido', origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/login?error=link_invalido', origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}

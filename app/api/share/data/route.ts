import { NextRequest, NextResponse } from 'next/server';
import { consumePublicShareRequest, resolveSharedClientData } from '@/lib/server/shareLinks';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token obrigatorio.' }, { status: 400 });

  // O rate-limit é chaveado pelo token (não forjável pelo cliente).
  // X-Forwarded-For não é usado: é definido pelo cliente e portanto forjável.
  const allowed = await consumePublicShareRequest(token);
  if (!allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
  }

  try {
    const result = await resolveSharedClientData(token);
    return result
      ? NextResponse.json(result)
      : NextResponse.json({ error: 'Link invalido ou expirado.' }, { status: 401 });
  } catch (error) {
    console.error('Failed to load public share link.', error);
    return NextResponse.json({ error: 'Erro ao carregar link.' }, { status: 500 });
  }
}

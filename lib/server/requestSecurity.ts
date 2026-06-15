import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Retorna a URL de origem configurada para a aplicação, considerando
 * APP_URL e variáveis NEXT_PUBLIC_* que indiquem um ambiente com origem
 * conhecida (preview, staging, produção).
 */
function getConfiguredAppOrigin(request: NextRequest): string | null {
  const appUrl = process.env.APP_URL && normalizeOrigin(process.env.APP_URL);
  if (appUrl) return appUrl;

  // NEXT_PUBLIC_SUPABASE_URL indica que a aplicação tem configuração de
  // ambiente: qualquer deploy que defina essa variável tem uma origem
  // pública e deve exigir o header Origin.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) return request.nextUrl.origin;

  return null;
}

export function requireSameOrigin(request: NextRequest) {
  const requestOrigin = request.headers.get('origin');

  if (!requestOrigin) {
    // Bloqueia ausência de Origin sempre que houver origem configurada
    // (APP_URL ou NEXT_PUBLIC_*), independente de NODE_ENV. Isso protege
    // previews e ambientes de staging contra CSRF.
    const configuredOrigin = getConfiguredAppOrigin(request);
    if (configuredOrigin || process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Origem da requisicao obrigatoria.' }, { status: 403 });
    }
    // Dev local sem origem configurada: permite ferramentas de linha de comando.
    return null;
  }

  const allowedOrigins = new Set([request.nextUrl.origin]);
  const configuredAppOrigin = process.env.APP_URL && normalizeOrigin(process.env.APP_URL);
  if (configuredAppOrigin) allowedOrigins.add(configuredAppOrigin);

  return allowedOrigins.has(normalizeOrigin(requestOrigin) ?? '')
    ? null
    : NextResponse.json({ error: 'Origem da requisicao invalida.' }, { status: 403 });
}


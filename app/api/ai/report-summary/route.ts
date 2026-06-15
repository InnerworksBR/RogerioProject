import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { buildAIReportSummary } from '@/lib/server/aiSummary';
import { RateLimitExceededError } from '@/lib/server/rateLimit';
import { requireSameOrigin } from '@/lib/server/requestSecurity';

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { supabase, response } = await requireAuthenticatedRouteUser();

  if (response) {
    return response;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      year?: number | null;
      codCliente?: string | null;
      scope?: string;
    };

    const result = await buildAIReportSummary(supabase, {
      year: body.year ?? null,
      codCliente: body.codCliente ?? null,
      scope: body.scope,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: 'Limite de resumos com IA atingido. Aguarde um pouco e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    console.error('Error generating AI report summary:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Nao foi possivel gerar o resumo agora.' }, { status: 500 });
  }
}

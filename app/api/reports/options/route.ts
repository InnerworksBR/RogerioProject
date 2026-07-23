import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { getReportOptions } from '@/lib/server/reportQueryOrchestrator';
import { MAX_FILTER_TEXT_LENGTH, ReportRequestError } from '@/types/reportApi';

function parseOptionsRequest(params: URLSearchParams) {
  const resource = params.get('resource');
  if (resource !== 'clients' && resource !== 'products') {
    throw new ReportRequestError('resource deve ser clients ou products.');
  }
  const search = params.get('search')?.trim() ?? '';
  if (search.length > MAX_FILTER_TEXT_LENGTH) {
    throw new ReportRequestError(`search excede ${MAX_FILTER_TEXT_LENGTH} caracteres.`);
  }
  const rawLimit = params.get('limit') ?? '40';
  if (!/^\d+$/.test(rawLimit)) throw new ReportRequestError('limit inválido.');
  const limit = Number(rawLimit);
  if (limit < 1 || limit > 100) throw new ReportRequestError('limit deve estar entre 1 e 100.');
  return { resource, search, limit } as const;
}

export async function GET(request: NextRequest) {
  const { supabase, response } = await requireAuthenticatedRouteUser();
  if (response) return response;

  const requestId = crypto.randomUUID();
  try {
    const input = parseOptionsRequest(request.nextUrl.searchParams);
    const options = await getReportOptions(
      supabase,
      requestId,
      input.resource,
      input.search,
      input.limit
    );
    return NextResponse.json(
      { requestId, options },
      { headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId } }
    );
  } catch (error) {
    if (error instanceof ReportRequestError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 400 });
    }
    console.error('[reports.options]', requestId, error);
    return NextResponse.json(
      { error: 'Não foi possível carregar as opções.', requestId },
      { status: 500 }
    );
  }
}

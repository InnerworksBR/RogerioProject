import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { getReportsBootstrap } from '@/lib/server/reportQueryOrchestrator';
import { parseReportRequest, ReportRequestError } from '@/types/reportApi';

export async function GET(request: NextRequest) {
  const { supabase, response } = await requireAuthenticatedRouteUser();
  if (response) return response;

  const requestId = crypto.randomUUID();
  try {
    const parsed = parseReportRequest(request.nextUrl.searchParams);
    const data = await getReportsBootstrap(supabase, requestId, parsed);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId },
    });
  } catch (error) {
    if (error instanceof ReportRequestError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 400 });
    }
    console.error('[reports.bootstrap]', requestId, error);
    return NextResponse.json(
      { error: 'Não foi possível carregar os relatórios.', requestId },
      { status: 500 }
    );
  }
}


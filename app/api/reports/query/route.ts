import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { executeReportScreenQuery } from '@/lib/server/reportQueryOrchestrator';
import { parseReportRequest, ReportRequestError } from '@/types/reportApi';

export async function GET(request: NextRequest) {
  const { supabase, response } = await requireAuthenticatedRouteUser();
  if (response) return response;

  const requestId = crypto.randomUUID();
  try {
    const parsed = parseReportRequest(request.nextUrl.searchParams);
    const result = await executeReportScreenQuery(supabase, requestId, parsed);
    return NextResponse.json(
      result,
      { headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId } }
    );
  } catch (error) {
    if (error instanceof ReportRequestError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 400 });
    }
    console.error('[reports.query]', requestId, error);
    return NextResponse.json(
      { error: 'Não foi possível carregar o relatório.', requestId },
      { status: 500 }
    );
  }
}

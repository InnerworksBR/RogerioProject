import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { executeReportQuery } from '@/lib/server/reportQueryOrchestrator';
import {
  MAX_EXPORT_ROW_LIMIT,
  parseReportRequest,
  ReportRequestError,
} from '@/types/reportApi';

export async function GET(request: NextRequest) {
  const { supabase, response } = await requireAuthenticatedRouteUser();
  if (response) return response;

  const requestId = crypto.randomUUID();
  try {
    const parsed = parseReportRequest(request.nextUrl.searchParams, {
      maxLimit: MAX_EXPORT_ROW_LIMIT,
      defaultLimit: MAX_EXPORT_ROW_LIMIT,
    });
    const result = await executeReportQuery(supabase, requestId, {
      ...parsed,
      limit: MAX_EXPORT_ROW_LIMIT,
    });
    if (result.truncated) {
      return NextResponse.json(
        { error: `A exportação excede ${MAX_EXPORT_ROW_LIMIT.toLocaleString('pt-BR')} linhas. Refine os filtros.`, requestId },
        { status: 413 }
      );
    }
    return NextResponse.json({ ...result, requestId, summary: null, summaries: [] }, {
      headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId },
    });
  } catch (error) {
    if (error instanceof ReportRequestError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 400 });
    }
    console.error('[reports.export]', requestId, error);
    return NextResponse.json(
      { error: 'Não foi possível preparar a exportação.', requestId },
      { status: 500 }
    );
  }
}

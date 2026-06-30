import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { requireSameOrigin } from '@/lib/server/requestSecurity';
import type { ParsedRow } from '@/lib/xlsParser.worker';

const MAX_ROWS_PER_CHUNK = 500;
const MAX_FILE_SIZE_BYTES = readPositiveInteger('UPLOAD_MAX_FILE_BYTES', 25 * 1024 * 1024);
const MAX_ROWS_PER_UPLOAD = Math.min(readPositiveInteger('UPLOAD_MAX_ROWS', 100_000), 100_000);
const MAX_PROCESSING_UPLOADS = readPositiveInteger('UPLOAD_MAX_PROCESSING', 3);
const MAX_REQUESTS_PER_MINUTE = readPositiveInteger('UPLOAD_MAX_REQUESTS_PER_MINUTE', 500);
const MAX_TOTAL_CHUNKS = Math.min(readPositiveInteger('UPLOAD_MAX_CHUNKS', 400), 400);
const requestWindows = new Map<string, { count: number; expiresAt: number }>();

function readPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasValidLength(value: unknown, maxLength: number, required = false) {
  return typeof value === 'string' && value.length <= maxLength && (!required || value.length > 0);
}

function isNullableString(value: unknown, maxLength: number) {
  return value === null || hasValidLength(value, maxLength);
}

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function exceedsRequestLimit(userId: string) {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || current.expiresAt <= now) {
    requestWindows.set(userId, { count: 1, expiresAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_MINUTE;
}

function rateLimitResponse(userId: string) {
  return exceedsRequestLimit(userId)
    ? NextResponse.json({ error: 'Muitas requisicoes de upload. Aguarde um minuto e tente novamente.' }, { status: 429 })
    : null;
}

function isValidRow(row: ParsedRow) {
  return Boolean(
    row &&
    hasValidLength(row.cod_empresa, 100) &&
    hasValidLength(row.nome_empresa, 255) &&
    hasValidLength(row.cod_hist_financeiro, 100) &&
    hasValidLength(row.descr_hist_financ, 255) &&
    hasValidLength(row.cod_cliente, 100, true) &&
    hasValidLength(row.nome_cliente, 255, true) &&
    hasValidLength(row.apelido, 255) &&
    isIsoDate(row.data_pedido) &&
    hasValidLength(row.codigo_pedido, 100) &&
    isNullableString(row.numero_pedido_talao, 100) &&
    isNullableString(row.pedido_cliente_opc, 255) &&
    hasValidLength(row.cod_referencia, 100, true) &&
    hasValidLength(row.descr_produto, 500, true) &&
    isFiniteNumber(row.preco_unitario) &&
    isFiniteNumber(row.quantidade) &&
    row.situacao_item === 'LIQ' &&
    (row.data_limite_entrega === null || isIsoDate(row.data_limite_entrega)) &&
    isFiniteNumber(row.qtd_saldo) &&
    hasValidLength(row.unid_venda, 50) &&
    isFiniteNumber(row.valor_total) &&
    isFiniteNumber(row.desconto_fiscal) &&
    isNullableString(row.cod_intermediador, 100) &&
    isNullableString(row.nome_intermediador, 255) &&
    Number.isInteger(row.mes) &&
    row.mes >= 1 &&
    row.mes <= 12 &&
    Number.isInteger(row.ano)
  );
}

function isValidSkipSummary(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 20 && entries.every(([key, count]) =>
    key.length <= 100 && Number.isInteger(count) && count >= 0 && count <= MAX_ROWS_PER_UPLOAD
  );
}

export async function GET() {
  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('uploads')
    .select('id, filename, fingerprint, status, row_count, period_start, period_end, error_msg, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ uploads: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rateLimit = rateLimitResponse(user.id);
  if (rateLimit) return rateLimit;

  const body = (await req.json().catch(() => ({}))) as {
    filename?: string;
    fingerprint?: string;
    periodStart?: string;
    periodEnd?: string;
    skippedRows?: number;
    skipSummary?: Record<string, number>;
    fileSize?: number;
    totalRows?: number;
    confirmOverlap?: boolean;
  };

  if (
    !hasValidLength(body.filename, 255, true) ||
    typeof body.fingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/.test(body.fingerprint) ||
    !isIsoDate(body.periodStart) ||
    !isIsoDate(body.periodEnd) ||
    body.periodStart > body.periodEnd ||
    !isIntegerInRange(body.fileSize, 1, MAX_FILE_SIZE_BYTES) ||
    !isIntegerInRange(body.totalRows, 1, MAX_ROWS_PER_UPLOAD) ||
    !Number.isInteger(body.skippedRows ?? 0) ||
    (body.skippedRows ?? 0) < 0 ||
    !isValidSkipSummary(body.skipSummary ?? {})
  ) {
    return NextResponse.json({ error: 'Metadados de upload invalidos.' }, { status: 400 });
  }

  // Reimportacao do MESMO periodo (datas iguais) e permitida: a planilha nova
  // substitui a anterior. A troca acontece em finalize_upload, que remove os
  // uploads do periodo exato apos concluir o novo. Por isso nao bloqueamos por
  // fingerprint nem tratamos o periodo exato como sobreposicao.
  const { data: overlaps, error: overlapError } = await supabase
    .from('uploads')
    .select('id, filename, period_start, period_end')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .lte('period_start', body.periodEnd)
    .gte('period_end', body.periodStart);

  if (overlapError) return NextResponse.json({ error: overlapError.message }, { status: 500 });

  // Sobreposicoes PARCIAIS (periodo diferente que cruza) ainda exigem confirmacao.
  // O periodo exato e excluido porque sera substituido automaticamente.
  const partialOverlaps = (overlaps ?? []).filter(
    (item) => !(item.period_start === body.periodStart && item.period_end === body.periodEnd),
  );
  if (partialOverlaps.length > 0 && !body.confirmOverlap) {
    return NextResponse.json({ error: 'Periodo sobreposto.', overlaps: partialOverlaps }, { status: 409 });
  }

  const { count: processingCount, error: processingError } = await supabase
    .from('uploads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'processing');

  if (processingError) return NextResponse.json({ error: processingError.message }, { status: 500 });
  if ((processingCount ?? 0) >= MAX_PROCESSING_UPLOADS) {
    return NextResponse.json({ error: 'Limite de uploads em processamento atingido.' }, { status: 429 });
  }

  const { data, error } = await supabase
    .from('uploads')
    .insert({
      filename: body.filename,
      fingerprint: body.fingerprint,
      period_start: body.periodStart,
      period_end: body.periodEnd,
      skipped_rows: body.skippedRows ?? 0,
      skip_summary: body.skipSummary ?? {},
      status: 'processing',
      user_id: user.id,
    })
    .select('id')
    .single();

  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ upload_id: data.id });
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rateLimit = rateLimitResponse(user.id);
  if (rateLimit) return rateLimit;

  const body = (await req.json().catch(() => ({}))) as {
    upload_id?: string;
    rows?: ParsedRow[];
    chunkIndex?: number;
    totalChunks?: number;
  };

  if (
    !isUuid(body.upload_id) ||
    !Array.isArray(body.rows) ||
    body.rows.length < 1 ||
    body.rows.length > MAX_ROWS_PER_CHUNK ||
    !isIntegerInRange(body.chunkIndex, 0, MAX_TOTAL_CHUNKS - 1) ||
    !isIntegerInRange(body.totalChunks, 1, MAX_TOTAL_CHUNKS) ||
    body.chunkIndex >= body.totalChunks
  ) {
    return NextResponse.json({ error: 'Lote de upload invalido.' }, { status: 400 });
  }
  if (!body.rows.every(isValidRow)) {
    return NextResponse.json({ error: 'O lote contem linhas invalidas.' }, { status: 400 });
  }

  const { data: appendResult, error: appendError } = await supabase.rpc('append_upload_chunk', {
    p_upload_id: body.upload_id,
    p_chunk_index: body.chunkIndex,
    p_total_chunks: body.totalChunks,
    p_rows: body.rows,
  });
  if (appendError) return NextResponse.json({ error: appendError.message }, { status: 400 });

  let finalizedRowCount: number | undefined;
  if (body.chunkIndex === body.totalChunks - 1) {
    const { data: finalizeResult, error: finalizeError } = await supabase.rpc('finalize_upload', {
      p_upload_id: body.upload_id,
      p_total_chunks: body.totalChunks,
    });
    if (finalizeError) return NextResponse.json({ error: finalizeError.message }, { status: 400 });
    finalizedRowCount = finalizeResult?.[0]?.row_count;
  }

  return NextResponse.json({
    ok: true,
    applied: appendResult?.[0]?.applied ?? false,
    row_count: finalizedRowCount,
  });
}

export async function DELETE(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rateLimit = rateLimitResponse(user.id);
  if (rateLimit) return rateLimit;

  const { upload_id, errorMessage } = (await req.json().catch(() => ({}))) as {
    upload_id?: string;
    errorMessage?: string;
  };
  if (!isUuid(upload_id) || (errorMessage !== undefined && !hasValidLength(errorMessage, 1000))) {
    return NextResponse.json({ error: 'Upload obrigatorio.' }, { status: 400 });
  }

  const { error: salesError } = await supabase.from('sales_rows').delete().eq('upload_id', upload_id).eq('user_id', user.id);
  if (salesError) return NextResponse.json({ error: salesError.message }, { status: 500 });

  const { error: chunksError } = await supabase.from('upload_chunks').delete().eq('upload_id', upload_id).eq('user_id', user.id);
  if (chunksError) return NextResponse.json({ error: chunksError.message }, { status: 500 });

  const { error } = await supabase
    .from('uploads')
    .update({ status: 'error', error_msg: errorMessage ?? 'Falha durante a importacao.' })
    .eq('id', upload_id)
    .eq('user_id', user.id);

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ ok: true });
}

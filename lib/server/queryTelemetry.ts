import 'server-only';

export type QueryTelemetryStatus = 'ok' | 'error';
export type QueryCacheStatus = 'miss' | 'hit' | 'bypass';

export interface QueryTelemetryInput {
  requestId: string;
  operation: string;
  durationMs: number;
  rowCount: number;
  status: QueryTelemetryStatus;
  cacheStatus?: QueryCacheStatus;
}

export interface QueryTelemetryRecord {
  event: 'report_query';
  requestId: string;
  operation: string;
  durationMs: number;
  rowCount: number;
  status: QueryTelemetryStatus;
  cacheStatus: QueryCacheStatus;
}

const SAFE_OPERATION = /^[a-z0-9_.-]{1,80}$/;

export function createQueryTelemetryRecord(input: QueryTelemetryInput): QueryTelemetryRecord {
  if (!SAFE_OPERATION.test(input.operation)) {
    throw new Error('Nome de operação inválido para telemetria.');
  }

  return {
    event: 'report_query',
    requestId: input.requestId.slice(0, 80),
    operation: input.operation,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    rowCount: Math.max(0, Math.trunc(input.rowCount)),
    status: input.status,
    cacheStatus: input.cacheStatus ?? 'bypass',
  };
}

export function logQueryTelemetry(input: QueryTelemetryInput): void {
  const record = createQueryTelemetryRecord(input);
  const serialized = JSON.stringify(record);
  if (record.status === 'error') {
    console.error(serialized);
    return;
  }
  console.info(serialized);
}

export async function measureQuery<T>(
  input: Pick<QueryTelemetryInput, 'requestId' | 'operation'>,
  query: () => Promise<T>,
  countRows: (value: T) => number
): Promise<T> {
  const startedAt = performance.now();
  try {
    const value = await query();
    logQueryTelemetry({
      ...input,
      durationMs: performance.now() - startedAt,
      rowCount: countRows(value),
      status: 'ok',
      cacheStatus: 'bypass',
    });
    return value;
  } catch (error) {
    logQueryTelemetry({
      ...input,
      durationMs: performance.now() - startedAt,
      rowCount: 0,
      status: 'error',
      cacheStatus: 'bypass',
    });
    throw error;
  }
}


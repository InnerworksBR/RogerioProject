import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<any, 'public', any>;
type AIRateLimitEndpoint = 'ai_report_chat' | 'ai_report_summary';

interface RateLimitRow {
  allowed: boolean;
  retry_after_seconds: number;
}

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Limite de uso da IA atingido.');
    this.name = 'RateLimitExceededError';
  }
}

export async function consumeAIRateLimit(
  supabase: DbClient,
  endpoint: AIRateLimitEndpoint
) {
  const { data, error } = await supabase.rpc('consume_ai_rate_limit', {
    p_endpoint: endpoint,
  });

  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row || typeof row.allowed !== 'boolean') {
    throw new Error('Resposta invalida ao verificar limite de uso da IA.');
  }

  return {
    allowed: row.allowed,
    retryAfterSeconds: Math.max(Number(row.retry_after_seconds) || 1, 1),
  };
}

export async function enforceAIRateLimit(
  supabase: DbClient,
  endpoint: AIRateLimitEndpoint
) {
  const result = await consumeAIRateLimit(supabase, endpoint);
  if (!result.allowed) throw new RateLimitExceededError(result.retryAfterSeconds);
}

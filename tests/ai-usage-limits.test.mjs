import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('AI chat has bounded OpenAI and tool usage', async () => {
  const chat = await read('lib/server/reportChat.ts');

  assert.match(chat, /const MAX_TOOL_ROUNDS = 6;/);
  assert.match(chat, /const MAX_FUNCTION_CALLS_PER_ROUND = 4;/);
  assert.match(chat, /const MAX_TOTAL_FUNCTION_CALLS = 12;/);
  assert.match(chat, /max_output_tokens: MAX_OUTPUT_TOKENS/);
  assert.match(chat, /signal: controller\.signal/);
});

test('AI entry points consume atomic authenticated quotas and enforce same origin', async () => {
  const [chatRoute, summaryRoute, summary, migration] = await Promise.all([
    read('app/api/ai/report-chat/route.ts'),
    read('app/api/ai/report-summary/route.ts'),
    read('lib/server/aiSummary.ts'),
    read('supabase/migrations/0017_ai_usage_limits.sql'),
  ]);

  assert.match(chatRoute, /requireSameOrigin\(request\)/);
  assert.match(summaryRoute, /requireSameOrigin\(request\)/);
  assert.match(chatRoute, /consumeAIRateLimit\(context\.supabase, 'ai_report_chat'\)/);
  assert.match(summary, /enforceAIRateLimit\(supabase, 'ai_report_summary'\)/);
  assert.match(chatRoute, /status: 429/);
  assert.match(summaryRoute, /status: 429/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /REVOKE ALL ON TABLE ai_usage_limits FROM authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION consume_ai_rate_limit\(TEXT\) TO authenticated/);
});

test('AI summary bounds completion output and aborts slow OpenAI requests', async () => {
  const summary = await read('lib/server/aiSummary.ts');

  assert.match(summary, /max_completion_tokens: MAX_COMPLETION_TOKENS/);
  assert.match(summary, /signal: controller\.signal/);
  assert.doesNotMatch(summary, /await response\.text\(\)/);
});

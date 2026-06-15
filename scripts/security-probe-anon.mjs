import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

async function loadLocalEnv() {
  const contents = await readFile(new URL('../.env.local', import.meta.url), 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
  }
}

function assertDenied(label, result) {
  if (!result.error) {
    throw new Error(`${label}: acesso anonimo inesperadamente permitido.`);
  }

  return {
    label,
    denied: true,
    code: result.error.code ?? 'unknown',
  };
}

await loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false },
});

const checks = [];
checks.push(assertDenied('sales_rows.select', await anon.from('sales_rows').select('id').limit(1)));
checks.push(
  assertDenied(
    'report_chat_conversations.select',
    await anon.from('report_chat_conversations').select('id').limit(1)
  )
);
checks.push(assertDenied('get_distinct_years', await anon.rpc('get_distinct_years')));
checks.push(assertDenied('get_distinct_clients', await anon.rpc('get_distinct_clients')));
checks.push(assertDenied('get_rep_ranking', await anon.rpc('get_rep_ranking', { p_ano: 2026 })));
checks.push(assertDenied('get_client_ranking', await anon.rpc('get_client_ranking', { p_ano: 2026 })));
checks.push(
  assertDenied('chat_top_clients', await anon.rpc('chat_top_clients', { p_ano: 2026, p_limit: 1 }))
);

console.log(JSON.stringify({ ok: true, checks }, null, 2));


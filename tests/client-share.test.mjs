import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
    if (specifier.startsWith('@/')) {
      return nextResolve(pathToFileURL(path.join(process.cwd(), `${specifier.slice(2)}.ts`)).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { createClientShare, ClientShareError } = await import('../lib/server/clientShare.ts');
const { copyClientShareLink, createClientShareLink } = await import('../lib/client/shareApi.ts');
hooks.deregister();

function database({ codes = ['client-a'], sales = [{ id: 1 }], resolveError = null, insertError = null } = {}) {
  const calls = [];
  let stored;
  return {
    calls,
    get stored() { return stored; },
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({ data: codes.map((code) => ({ cod_cliente: code })), error: resolveError });
    },
    from(table) {
      const chain = {
        select() { return chain; },
        in(column, values) { calls.push({ column, values }); return chain; },
        eq(column, value) { calls.push({ column, value }); return chain; },
        limit(value) { calls.push({ limit: value }); return Promise.resolve({ data: sales, error: null }); },
        insert(value) { stored = value; return chain; },
        single() { return Promise.resolve({ data: { id: 'share-1' }, error: insertError }); },
      };
      assert.ok(['sales_rows', 'share_links'].includes(table));
      return chain;
    },
  };
}

test('sharing rejects a year without purchases with an actionable message and creates no token record', async () => {
  const db = database({ sales: [] });
  await assert.rejects(createClientShare(db, 'user-a', { clientId: 'client-a', year: 2026 }),
    (error) => error instanceof ClientShareError && error.status === 422 && /2026.*ano com compras/.test(error.message));
  assert.equal(db.stored, undefined);
});

test('sharing persists only a token hash, scoped to the authenticated user, resolved client codes and chosen year', async () => {
  const db = database({ codes: ['client-a', 'client-b'] });
  const result = await createClientShare(db, 'user-a', { clientId: 'group:test', year: 2025 });
  assert.equal(result.id, 'share-1');
  assert.equal(db.stored.user_id, 'user-a');
  assert.equal(db.stored.client_id, 'group:test');
  assert.equal(db.stored.year, 2025);
  assert.equal(db.stored.token_hash, createHash('sha256').update(result.token).digest('hex'));
  assert.equal(db.stored.token, undefined);
  assert.deepEqual(db.calls.find((call) => call.column === 'cod_cliente').values, ['client-a', 'client-b']);
  assert.ok(db.calls.some((call) => call.column === 'ano' && call.value === 2025));
  assert.ok(db.calls.some((call) => call.limit === 1));
});

test('unresolved clients and invalid request bodies cannot create shares', async () => {
  const db = database({ codes: [] });
  await assert.rejects(createClientShare(db, 'user-a', { clientId: 'other-group', year: 2025 }),
    (error) => error.status === 403);
  for (const input of [null, [], { clientId: 123, year: 2025 }, { clientId: 'client-a', year: '2025' }]) {
    await assert.rejects(createClientShare(db, 'user-a', input), (error) => error.status === 400);
  }
  assert.equal(db.stored, undefined);
});

test('database failures return a safe message without presenting creation as successful', async () => {
  const db = database({ insertError: { message: 'private database detail' } });
  await assert.rejects(createClientShare(db, 'user-a', { clientId: 'client-a', year: 2025 }),
    (error) => error.status === 500 && /salvar o link/.test(error.message) && !error.message.includes('private'));
});

test('client fetch preserves the server explanation instead of replacing it with a generic toast', async (t) => {
  const message = 'Este cliente não possui compras em 2026. Selecione um ano com compras para gerar o link.';
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: message }), { status: 422 }));
  await assert.rejects(createClientShareLink('client-a', 2026), { message });
});

test('client fetch returns the generated URL independently of clipboard permissions', async (t) => {
  const created = { id: 'share-1', shareLink: 'https://example.test/shared/client/test-token', expiresAt: '2026-10-26' };
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(created)));
  const result = await createClientShareLink('client-a', 2025);
  assert.deepEqual(result, created);
  assert.equal(await copyClientShareLink(result.shareLink, { async writeText() { throw new Error('Permission denied'); } }), false);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(result.shareLink, created.shareLink);
});

test('copy reports success only after writing and handles an unavailable clipboard', async () => {
  let copied;
  assert.equal(await copyClientShareLink('https://example.test/shared/client/token', { async writeText(value) { copied = value; } }), true);
  assert.equal(copied, 'https://example.test/shared/client/token');
  assert.equal(await copyClientShareLink('https://example.test/shared/client/token', undefined), false);
});

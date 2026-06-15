import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('public sharing uses opaque hashed tokens scoped to the owner', async () => {
  const shareLinks = await read('lib/server/shareLinks.ts');
  const packageJson = await read('package.json');
  assert.match(shareLinks, /randomBytes\(32\)/);
  assert.match(shareLinks, /createHash\('sha256'\)/);
  assert.match(shareLinks, /\.eq\('user_id', shareLink\.user_id\)/);
  assert.doesNotMatch(packageJson, /jsonwebtoken/);
});

test('production migration scopes config references and upload fingerprints per user', async () => {
  const migration = await read('supabase/migrations/0005_production_hardening.sql');
  assert.match(migration, /\(user_id, report_key, cod_referencia\)/);
  assert.match(migration, /\(user_id, fingerprint\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS share_links/);
});

test('parser rejects missing situation instead of assuming LIQ', async () => {
  const worker = await read('lib/xlsParser.worker.ts');
  assert.match(worker, /if \(!situacao\)/);
  assert.match(worker, /skippedByMissingSituacao\+\+/);
  assert.doesNotMatch(worker, /situacao\s*\|\|\s*'LIQ'/);
});

test('report filters include semester and revenue type', async () => {
  const migration = await read('supabase/migrations/0006_report_filters.sql');
  const configMigration = await read('supabase/migrations/0007_config_report_filters.sql');
  const store = await read('store/filterStore.ts');
  assert.match(migration, /p_semestre INT DEFAULT NULL/);
  assert.match(migration, /p_descr_hist_financ TEXT DEFAULT NULL/);
  assert.match(configMigration, /configured_report_rows/);
  assert.match(store, /selectedSemester/);
  assert.match(store, /selectedRevenueType/);
});

test('representatives can be disabled without losing commercial history', async () => {
  const migration = await read('supabase/migrations/0008_rep_lifecycle.sql');
  const route = await read('app/api/admin/reps/route.ts');
  assert.match(migration, /is_active BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(route, /ban_duration: isActive \? 'none' : '876000h'/);
  assert.match(route, /rpc\('offboard_representative'/);
});

test('license requests are leader-scoped commercial requests without automatic activation', async () => {
  const migration = await read('supabase/migrations/0009_license_requests.sql');
  const route = await read('app/api/admin/license-requests/route.ts');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS license_requests/);
  assert.match(migration, /CHECK \(plan IN \('plan_1', 'plan_2', 'plan_3'\)\)/);
  assert.match(migration, /CHECK \(quantity > 0\)/);
  assert.match(migration, /CHECK \(status IN \('pending', 'approved', 'rejected', 'cancelled'\)\)/);
  assert.match(migration, /ALTER TABLE license_requests ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /leader_id = auth\.uid\(\)/);
  assert.match(migration, /status = 'cancelled'/);
  assert.match(migration, /GRANT UPDATE\(status, updated_at\) ON TABLE license_requests TO authenticated/);
  assert.match(migration, /REVOKE ALL ON TABLE license_requests FROM anon/);
  assert.match(route, /profile\?\.role !== 'leader'/);
  assert.match(route, /\.eq\('leader_id', user\.id\)/);
  assert.match(route, /\.eq\('status', 'pending'\)/);
  assert.doesNotMatch(route, /license_count/);
});

test('AI report chat is plan-gated and uses authenticated read-only report tools', async () => {
  const migration = await read('supabase/migrations/0010_ai_report_chat.sql');
  const route = await read('app/api/ai/report-chat/route.ts');
  const chat = await read('lib/server/reportChat.ts');
  const access = await read('lib/server/reportChatAccess.ts');
  assert.match(migration, /subscription_plan TEXT NOT NULL DEFAULT 'plan_1'/);
  assert.match(migration, /subscription_plan IN \('plan_1', 'plan_2', 'plan_3'\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION get_effective_subscription_plan\(\)/);
  assert.match(migration, /WHEN profile\.role = 'rep' THEN COALESCE\(leader\.subscription_plan, 'plan_1'\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION get_effective_subscription_plan\(\) FROM PUBLIC/);
  assert.match(route, /isAIReportChatEnabled\(\)/);
  assert.match(route, /hasAIReportChatAccess\(supabase\)/);
  assert.match(route, /listRecentReportChatMessages/);
  assert.match(chat, /MAX_TOOL_ROUNDS = 6/);
  assert.match(chat, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(chat, /store: false/);
  assert.match(chat, /get_dashboard_summary/);
  assert.match(chat, /get_base_purchase_report/);
  assert.match(chat, /get_client_dashboard/);
  assert.match(access, /\.rpc\('get_effective_subscription_plan'\)/);
  assert.doesNotMatch(chat, /getAdminSupabaseClient|serviceRole|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route, /getAdminSupabaseClient|serviceRole|SUPABASE_SERVICE_ROLE_KEY/);
});

test('AI report chat persists owner-scoped history and renders safe markdown', async () => {
  const migration = await read('supabase/migrations/0011_report_chat_history.sql');
  const route = await read('app/api/ai/report-chat/route.ts');
  const chat = await read('lib/server/reportChat.ts');
  const history = await read('lib/server/reportChatHistory.ts');
  const component = await read('components/report-chat/ReportChat.tsx');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS report_chat_conversations/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS report_chat_messages/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_top_clients/);
  assert.match(migration, /sales\.user_id = auth\.uid\(\)/);
  assert.match(migration, /profile\.leader_id = auth\.uid\(\)/);
  assert.match(chat, /name: 'get_top_clients'/);
  assert.match(chat, /getTopClientsForSupabase/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /listRecentReportChatMessages/);
  assert.match(route, /insertReportChatMessage/);
  assert.match(history, /\.eq\('id', conversationId\)/);
  assert.match(component, /ReactMarkdown/);
  assert.match(component, /remarkGfm/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /rehypeRaw|dangerouslySetInnerHTML/);
});

test('AI report chat exposes a bounded authenticated commercial toolkit without free-form SQL', async () => {
  const migration = await read('supabase/migrations/0012_report_chat_commercial_tools.sql');
  const chat = await read('lib/server/reportChat.ts');
  const data = await read('lib/server/reportData.ts');
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_can_read_sales_owner/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_resolve_client/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_top_products/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_sales_trend/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_recent_orders/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_inactive_clients/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION chat_rep_performance/);
  assert.match(migration, /idx_sales_user_date_client/);
  assert.match(migration, /WITH authorized_owners AS/);
  assert.match(migration, /REVOKE ALL ON FUNCTION chat_resolve_client\(TEXT, INT\) FROM PUBLIC/);
  assert.match(chat, /MAX_TOOL_ROUNDS = 6/);
  assert.match(chat, /name: 'resolve_client'/);
  assert.match(chat, /name: 'get_top_products'/);
  assert.match(chat, /name: 'get_sales_trend'/);
  assert.match(chat, /name: 'get_recent_orders'/);
  assert.match(chat, /name: 'get_inactive_clients'/);
  assert.match(chat, /name: 'get_rep_performance'/);
  assert.match(chat, /name: 'get_client_product_opportunities'/);
  assert.match(data, /\.rpc\('chat_resolve_client'/);
  assert.match(data, /\.rpc\('chat_top_products'/);
  assert.match(data, /\.rpc\('chat_sales_trend'/);
  assert.doesNotMatch(chat, /SELECT\s|INSERT\s|UPDATE\s|DELETE\s|serviceRole|SUPABASE_SERVICE_ROLE_KEY/i);
});

test('production RPC hardening revokes inherited public execution and secures definer search paths', async () => {
  const migration = await read('supabase/migrations/0013_production_security_hardening.sql');
  const probe = await read('scripts/security-probe-anon.mjs');
  assert.match(migration, /REVOKE ALL ON FUNCTION %I\.%I\(%s\) FROM PUBLIC/);
  assert.match(migration, /ALTER DEFAULT PRIVILEGES IN SCHEMA public/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/);
  assert.match(migration, /SET search_path = public, pg_temp/);
  assert.match(migration, /public\.get_distinct_years\(\)/);
  assert.match(migration, /public\.get_distinct_clients\(\)/);
  assert.match(probe, /get_distinct_years/);
  assert.match(probe, /get_distinct_clients/);
  assert.match(probe, /get_rep_ranking/);
  assert.match(probe, /chat_top_clients/);
});

test('authenticated mutation routes enforce same-origin requests in production', async () => {
  const security = await read('lib/server/requestSecurity.ts');
  const licenses = await read('app/api/admin/license-requests/route.ts');
  const seed = await read('app/api/config/seed-suggestions/route.ts');
  assert.match(security, /request\.headers\.get\('origin'\)/);
  assert.match(security, /process\.env\.NODE_ENV === 'production'/);
  assert.match(security, /process\.env\.APP_URL/);
  assert.match(licenses, /requireSameOrigin\(req\)/);
  assert.match(seed, /requireSameOrigin\(request\)/);
});

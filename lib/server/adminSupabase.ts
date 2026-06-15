import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAdminSupabaseEnv } from '@/lib/server/env';

let adminClient: SupabaseClient<any, 'public', any> | null = null;

export function getAdminSupabaseClient() {
  if (!adminClient) {
    const { url, serviceRoleKey } = getAdminSupabaseEnv();
    adminClient = createClient<any>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}

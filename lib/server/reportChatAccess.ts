import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<any, 'public', any>;

export async function getEffectiveSubscriptionPlan(supabase: DbClient) {
  const { data, error } = await supabase.rpc('get_effective_subscription_plan');

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'string' ? data : null;
}

export async function hasAIReportChatAccess(supabase: DbClient) {
  return (await getEffectiveSubscriptionPlan(supabase)) === 'plan_3';
}

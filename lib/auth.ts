import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
}

export async function requireAuthenticatedRouteUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: User | null;
  response: NextResponse | null;
}> {
  const { supabase, user, error } = await getCurrentUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { supabase, user, response: null };
}

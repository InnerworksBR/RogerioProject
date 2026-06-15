import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicSupabaseEnv } from '@/lib/server/env';

function getSupabaseEnv() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return { url, key: anonKey };
}

export function createSupabaseServerClient(
  cookieMethods: CookieMethodsServer
) {
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: cookieMethods,
  });
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Server Components do not allow mutating cookies after rendering starts.
      }
    },
  });
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

function getInitials(email: string) {
  const source = email.split('@')[0] ?? email;
  const cleaned = source.replace(/[^a-zA-Z0-9]/g, '');
  return (cleaned.slice(0, 2) || 'US').toUpperCase();
}

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    const supabase = getSupabaseClient();
    await supabase.auth.signOut();

    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Sessão ativa
        </p>
        <p className="max-w-[220px] truncate text-sm font-semibold text-slate-700 dark:text-slate-300">
          {email}
        </p>
      </div>

      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-slate-200 text-xs font-bold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {getInitials(email)}
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={loading}
        className="h-9 rounded-xl px-3 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
        onClick={handleLogout}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <LogOut className="mr-2 size-4" />
            <span className="hidden sm:inline">Sair</span>
          </>
        )}
      </Button>
    </div>
  );
}

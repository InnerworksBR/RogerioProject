'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { validateNewPassword } from '@/lib/passwordPolicy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SessionState = 'checking' | 'ready' | 'missing';

export function ResetPasswordForm() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!active) return;
      setSessionState(data.user && !userError ? 'ready' : 'missing');
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateNewPassword(password, confirmPassword);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);

    setTimeout(() => {
      router.replace('/');
      router.refresh();
    }, 1200);
  }

  if (sessionState === 'checking') {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Validando o link...
      </div>
    );
  }

  if (sessionState === 'missing') {
    return (
      <div className="space-y-6 text-center">
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          O link de redefinição é inválido ou expirou. Solicite um novo link
          para continuar.
        </p>
        <Link
          href="/recuperar-senha"
          className="inline-flex items-center justify-center text-sm font-semibold text-indigo-500"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Senha atualizada com sucesso. Redirecionando...
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="reset-password"
          className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
        >
          Nova senha
        </label>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
            className="h-12 rounded-xl border-white/60 bg-white/60 pl-10 dark:border-slate-700/60 dark:bg-slate-900/60"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="reset-confirm"
          className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
        >
          Confirmar nova senha
        </label>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="reset-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            className="h-12 rounded-xl border-white/60 bg-white/60 pl-10 dark:border-slate-700/60 dark:bg-slate-900/60"
            required
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-xl premium-gradient text-sm font-bold text-white"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar nova senha'
        )}
      </Button>
    </form>
  );
}

'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, LockKeyhole, Mail } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function normalizeRedirectPath(value: string) {
  if (!value || !value.startsWith('/')) {
    return '/';
  }

  return value;
}

type LoginFormProps = {
  redirectedFrom?: string;
};

export function LoginForm({ redirectedFrom = '/' }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeRedirectPath = normalizeRedirectPath(redirectedFrom);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    router.replace(safeRedirectPath);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="login-email"
          className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            autoComplete="email"
            className="h-12 rounded-xl border-white/60 bg-white/60 pl-10 dark:border-slate-700/60 dark:bg-slate-900/60"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="login-password"
          className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
        >
          Senha
        </label>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
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
            Entrando...
          </>
        ) : (
          'Entrar'
        )}
      </Button>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Precisa de acesso? Solicite a criação do usuário no Supabase Auth pelo
        administrador.
      </p>
      {safeRedirectPath !== '/' && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Após o login, você volta para{' '}
          <Link href={safeRedirectPath} className="font-semibold text-indigo-500">
            {safeRedirectPath}
          </Link>
          .
        </p>
      )}
    </form>
  );
}

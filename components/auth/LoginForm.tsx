'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
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
      setError(signInError.code === 'invalid_credentials'
        ? 'E-mail ou senha incorretos. Confira os dados e tente novamente.'
        : signInError.code === 'email_not_confirmed'
          ? 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
          : 'Não foi possível entrar agora. Tente novamente ou fale com o administrador.');
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
          className="text-xs font-bold uppercase tracking-wide text-slate-600"
        >
          E-mail
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            autoComplete="email"
            className="h-12 rounded-xl border-input bg-white pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="login-password"
          className="text-xs font-bold uppercase tracking-wide text-slate-600"
        >
          Senha
        </label>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
            className="h-12 rounded-xl border-input bg-white pl-10 pr-12"
            required
          />
          <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
        <div className="text-right">
          <Link
            href="/recuperar-senha"
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-700"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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

      <p className="text-center text-xs text-slate-600">
        Precisa de acesso? Fale com o administrador da sua equipe.
      </p>
      {safeRedirectPath !== '/' && (
        <p className="text-center text-xs text-slate-600">
          Após o login, você volta para{' '}
          <Link href={safeRedirectPath} className="font-semibold text-indigo-700">
            {safeRedirectPath}
          </Link>
          .
        </p>
      )}
    </form>
  );
}

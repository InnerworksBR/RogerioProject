'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Informe o email cadastrado.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/redefinir-senha`;

    // Resposta sempre neutra (anti-enumeração): não revelamos se o email existe.
    await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });

    setSent(true);
    setSubmitting(false);
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Se houver uma conta associada a esse email, enviamos um link para
          redefinir a senha. Verifique a caixa de entrada e o spam.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-indigo-500"
        >
          <ArrowLeft className="size-4" />
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="forgot-email"
          className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="forgot-email"
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
            Enviando...
          </>
        ) : (
          'Enviar link de redefinição'
        )}
      </Button>

      <Link
        href="/login"
        className="inline-flex items-center justify-center gap-2 text-center text-sm font-semibold text-indigo-500"
      >
        <ArrowLeft className="size-4" />
        Voltar para o login
      </Link>
    </form>
  );
}

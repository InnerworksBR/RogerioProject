'use client';

import { FormEvent, useState } from 'react';
import { KeyRound, Loader2, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase';
import { validateNewPassword } from '@/lib/passwordPolicy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ChangePasswordForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentPassword) {
      setError('Informe a senha atual.');
      return;
    }

    const validation = validateNewPassword(newPassword, confirmPassword);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    if (newPassword === currentPassword) {
      setError('A nova senha deve ser diferente da atual.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseClient();

    // Reautentica com a senha atual antes de atualizar: o Supabase não exige a
    // senha vigente em updateUser, então confirmamos a posse da credencial para
    // impedir troca por uma sessão sequestrada.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (reauthError) {
      setError('Senha atual incorreta.');
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSubmitting(false);
    toast.success('Senha atualizada com sucesso.');
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="current-password"
          className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
        >
          Senha atual
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Sua senha atual"
            autoComplete="current-password"
            className="h-12 rounded-xl"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="new-password"
          className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
        >
          Nova senha
        </label>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
            className="h-12 rounded-xl"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="confirm-password"
          className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
        >
          Confirmar nova senha
        </label>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            className="h-12 rounded-xl"
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
        className="h-12 w-full rounded-xl premium-gradient text-sm font-bold text-white sm:w-auto sm:px-8"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Atualizando...
          </>
        ) : (
          'Atualizar senha'
        )}
      </Button>
    </form>
  );
}

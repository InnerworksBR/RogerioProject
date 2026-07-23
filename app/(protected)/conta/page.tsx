import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function ContaPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-indigo-500">
          Conta
        </p>
        <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
          Segurança da conta
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sessão de <span className="font-semibold">{user.email}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
          <CardDescription>
            Informe a senha atual e defina uma nova senha com pelo menos 8
            caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm email={user.email ?? ''} />
        </CardContent>
      </Card>
    </div>
  );
}

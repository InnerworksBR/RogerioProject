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
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
          Conta
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Segurança da conta
        </h1>
        <p className="text-sm text-slate-600">
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

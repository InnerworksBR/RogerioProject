import { ClientVisitDashboard } from '@/components/client-dashboard/ClientVisitDashboard';
import { ClientGroupsManager } from '@/components/clients/ClientGroupsManager';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export default async function ClientesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ClientVisitDashboard key={user.id} userId={user.id} />
      <details className="rounded-2xl border border-border bg-white p-4 sm:p-5">
        <summary className="cursor-pointer rounded-lg py-2 font-medium text-slate-700">Gerenciar clientes consolidados</summary>
        <p className="mb-4 mt-2 text-sm text-slate-600">Agrupe as razões sociais de um mesmo cliente para analisar suas compras em conjunto.</p>
        <ClientGroupsManager />
      </details>
    </div>
  );
}

import { SharedDashboardClientView } from './SharedDashboardClientView';
import { resolveSharedClientData } from '@/lib/server/shareLinks';

export default async function SharedClientDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = token ? await resolveSharedClientData(token) : null;

  if (!shared) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-white">Acesso inválido ou expirado</h1>
        <p className="mt-2 text-slate-500">Solicite um novo link ao seu representante.</p>
      </div>
    );
  }

  if (shared.summary.orderCount === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-white">Sem dados</h1>
        <p className="mt-2 text-slate-500">Não há dados suficientes para esta apresentação.</p>
      </div>
    );
  }

  return (
    <SharedDashboardClientView
      dashboardData={shared}
    />
  );
}

import { ClientVisitDashboard } from '@/components/client-dashboard/ClientVisitDashboard';
import { ClientGroupsManager } from '@/components/clients/ClientGroupsManager';

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      <ClientGroupsManager />
      <ClientVisitDashboard />
    </div>
  );
}

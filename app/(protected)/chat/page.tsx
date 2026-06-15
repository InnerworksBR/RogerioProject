import { LockKeyhole } from 'lucide-react';
import { ReportChat } from '@/components/report-chat/ReportChat';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { hasAIReportChatAccess } from '@/lib/server/reportChatAccess';

export default async function ReportChatPage() {
  const supabase = await createServerSupabaseClient();
  const hasAccess = await hasAIReportChatAccess(supabase).catch(() => false);

  if (!hasAccess) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-[2rem] p-10 text-center glass-card">
        <LockKeyhole className="mx-auto mb-4 h-12 w-12 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Chat IA disponivel no Plano 3</h1>
        <p className="mt-3 text-slate-400">Solicite a evolucao do seu plano para consultar relatorios e dados comerciais em formato conversacional.</p>
      </div>
    );
  }

  return <ReportChat />;
}

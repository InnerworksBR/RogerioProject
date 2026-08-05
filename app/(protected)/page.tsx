import Link from 'next/link';
import { AlertTriangle, Globe, LayoutDashboard, Settings2, TrendingUp, Upload } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getAvailableYearsForSupabase, getDashboardSummaryForSupabase } from '@/lib/server/reportData';
import { SummaryCards } from '@/components/reports/SummaryCards';

export const fmtBRL = (value: number) =>
  Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();
  const isLeader = profile?.role === 'leader';

  let years: number[] = [];
  let summary = null;
  let summaryError: string | null = null;
  try {
    years = await getAvailableYearsForSupabase(supabase);
    const year = years.at(-1);
    summary = year ? await getDashboardSummaryForSupabase(supabase, year) : null;
  } catch (error) {
    console.error('[DashboardPage] summary error:', error);
    summaryError = 'Não foi possível carregar os indicadores.';
  }
  const latestYear = years.at(-1) ?? new Date().getFullYear();

  let repRanking: any[] = [];
  let clientRanking: any[] = [];
  let rankingError = false;
  if (isLeader) {
    const [reps, clients] = await Promise.all([
      supabase.rpc('get_rep_ranking', { p_ano: latestYear }),
      supabase.rpc('get_client_ranking', { p_ano: latestYear }),
    ]);
    rankingError = Boolean(reps.error || clients.error);
    if (reps.error) console.error('[DashboardPage] rep ranking:', reps.error.message);
    if (clients.error) console.error('[DashboardPage] client ranking:', clients.error.message);
    repRanking = reps.data ?? [];
    clientRanking = clients.data ?? [];
  }

  const quickActions = [
    { href: '/clientes', title: 'Clientes', description: 'Prepare visitas, consolide razões sociais e compartilhe apresentações.', icon: LayoutDashboard, accent: 'text-indigo-400' },
    { href: '/reports', title: 'Relatórios', description: 'Compare anos, filtre a operação e exporte as bases completas.', icon: TrendingUp, accent: 'text-cyan-400' },
    { href: '/upload', title: 'Importações', description: 'Atualize a base do ERP e acompanhe cada arquivo processado.', icon: Upload, accent: 'text-emerald-400' },
    ...(isLeader ? [{ href: '/config', title: 'Configuração', description: 'Mantenha os cadastros comerciais usados por toda a equipe.', icon: Settings2, accent: 'text-amber-400' }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-24">
      <header className="space-y-4">
        <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1 text-sm text-indigo-300">
          <Globe className="mr-2 size-4" /> Torre de Controle — Operação Brasil
        </div>
        <h1 className="text-4xl font-black tracking-tight text-white lg:text-6xl">
          Visão Executiva <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">{latestYear}</span>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-400">
          Os principais números da operação carregados diretamente da base. A análise por IA permanece disponível sob demanda na Central de Relatórios.
        </p>
      </header>

      <SummaryCards data={summary} summaries={summary ? [{ year: latestYear, summary }] : []} loading={false} error={summaryError} />

      {isLeader && (
        <section className="grid gap-8 lg:grid-cols-2">
          <RankingCard title="Ranking de representantes" rows={repRanking.slice(0, 5).map((rep) => ({ id: rep.rep_id, name: rep.rep_email, detail: `${rep.num_clientes} clientes · ${rep.total_pedidos} pedidos`, value: rep.total_faturado }))} error={rankingError} />
          <RankingCard title="Top clientes consolidados" rows={clientRanking.slice(0, 5).map((client) => ({ id: client.cod_cliente, name: client.nome_cliente, detail: `Atendido por: ${client.rep_email}`, value: client.total_faturado }))} error={rankingError} />
        </section>
      )}

      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Módulos do sistema</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 transition-all hover:border-white/10 hover:bg-white/10">
                <div className="relative z-10 space-y-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-white/5 bg-white/5 transition-transform group-hover:scale-110"><Icon className={`size-6 ${action.accent}`} /></div>
                  <div><h3 className="text-lg font-bold text-white">{action.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{action.description}</p></div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RankingCard({ title, rows, error }: { title: string; rows: Array<{ id: string; name: string; detail: string; value: number }>; error: boolean }) {
  return (
    <div className="glass-card rounded-[2rem] p-6 sm:p-8">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-white"><TrendingUp className="size-6 text-indigo-400" /> {title}</h2>
      <div className="space-y-4">
        {rows.map((row, index) => <div key={row.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/5 p-4"><div className="flex min-w-0 items-center gap-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-bold text-indigo-400">{index + 1}</div><div className="min-w-0"><p className="truncate font-bold text-white">{row.name}</p><p className="text-sm text-slate-400">{row.detail}</p></div></div><p className="shrink-0 font-bold text-emerald-400">{fmtBRL(row.value)}</p></div>)}
        {error && <p className="flex items-center gap-2 text-sm text-rose-400"><AlertTriangle className="size-4" /> Erro ao carregar o ranking.</p>}
        {!error && rows.length === 0 && <p className="text-slate-400">Nenhum dado encontrado.</p>}
      </div>
    </div>
  );
}

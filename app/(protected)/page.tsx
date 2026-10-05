import Link from 'next/link';
import { AlertTriangle, ArrowRight, LayoutDashboard, Settings2, TrendingUp, Upload } from 'lucide-react';
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
    { href: '/clientes', title: 'Clientes', description: 'Prepare visitas, consolide razões sociais e compartilhe apresentações.', icon: LayoutDashboard, accent: 'text-indigo-700' },
    { href: '/reports', title: 'Relatórios', description: 'Compare anos, filtre a operação e exporte as bases completas.', icon: TrendingUp, accent: 'text-cyan-700' },
    { href: '/upload', title: 'Importações', description: 'Atualize a base do ERP e acompanhe cada arquivo processado.', icon: Upload, accent: 'text-emerald-700' },
    ...(isLeader ? [{ href: '/config', title: 'Configuração', description: 'Mantenha os cadastros comerciais usados por toda a equipe.', icon: Settings2, accent: 'text-amber-700' }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Seu dia a dia comercial</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Visão geral das vendas</h1>
          <p className="max-w-xl text-base leading-relaxed text-slate-600">Acompanhe os resultados de {latestYear} e encontre o próximo passo da sua operação.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/reports" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Ver relatórios <ArrowRight className="size-4" /></Link>
          <Link href="/upload" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"><Upload className="size-4" /> Importar planilha</Link>
        </div>
      </header>

      {years.length === 0 && !summaryError && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Comece pelo seu relatório de vendas</h2>
          <p className="mt-1 text-sm text-slate-600">Importe uma planilha do ERP para preencher os indicadores e preparar suas análises.</p>
          <ol className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <li>1. Importe a planilha de vendas.</li><li>2. Escolha o período e o cliente.</li><li>3. Consulte e baixe os relatórios.</li>
          </ol>
        </section>
      )}

      <SummaryCards data={summary} summaries={summary ? [{ year: latestYear, summary }] : []} loading={false} error={summaryError} />

      {isLeader && (
        <section className="grid gap-8 lg:grid-cols-2">
          <RankingCard title="Ranking de representantes" rows={repRanking.slice(0, 5).map((rep) => ({ id: rep.rep_id, name: rep.rep_email, detail: `${rep.num_clientes} clientes · ${rep.total_pedidos} pedidos`, value: rep.total_faturado }))} error={rankingError} />
          <RankingCard title="Top clientes consolidados" rows={clientRanking.slice(0, 5).map((client) => ({ id: client.cod_cliente, name: client.nome_cliente, detail: `Atendido por: ${client.rep_email}`, value: client.total_faturado }))} error={rankingError} />
        </section>
      )}

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900">O que você quer fazer?</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="group rounded-2xl border border-border bg-white p-5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30">
                <div className="relative z-10 space-y-4">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50"><Icon className={`size-5 ${action.accent} `} /></div>
                  <div><h3 className="flex items-center justify-between text-base font-semibold text-slate-900">{action.title}<ArrowRight className="size-4 text-slate-400 group-hover:text-primary" /></h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{action.description}</p></div>
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
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-900"><TrendingUp className="size-6 text-indigo-700" /> {title}</h2>
      <div className="space-y-4">
        {rows.map((row, index) => <div key={row.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex min-w-0 items-center gap-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-bold text-indigo-700">{index + 1}</div><div className="min-w-0"><p className="truncate font-bold text-slate-900">{row.name}</p><p className="text-sm text-slate-600">{row.detail}</p></div></div><p className="shrink-0 font-bold text-emerald-700">{fmtBRL(row.value)}</p></div>)}
        {error && <p className="flex items-center gap-2 text-sm text-rose-700"><AlertTriangle className="size-4" /> Erro ao carregar o ranking.</p>}
        {!error && rows.length === 0 && <p className="text-slate-600">Nenhum dado encontrado.</p>}
      </div>
    </div>
  );
}

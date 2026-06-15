import Link from 'next/link';
import {
  ArrowRight,
  LayoutDashboard,
  Settings2,
  Upload,
  Globe,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  CheckCircle2
} from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getAvailableYears } from '@/lib/reportQueries';
import { buildAIReportSummary } from '@/lib/server/aiSummary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const fmtBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const years = await getAvailableYears();
  const latestYear = years.length > 0 ? years[years.length - 1] : new Date().getFullYear();

  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  const isLeader = profile?.role === 'leader';

  let repRanking: any[] = [];
  let clientRanking: any[] = [];
  let repRankingError = false;
  let clientRankingError = false;

  if (isLeader) {
    const { data: reps, error: repsErr } = await supabase.rpc('get_rep_ranking', { p_ano: latestYear });
    const { data: clients, error: clientsErr } = await supabase.rpc('get_client_ranking', { p_ano: latestYear });

    if (repsErr) {
      console.error('[DashboardPage] get_rep_ranking error:', repsErr.message);
      repRankingError = true;
    } else {
      repRanking = reps || [];
    }

    if (clientsErr) {
      console.error('[DashboardPage] get_client_ranking error:', clientsErr.message);
      clientRankingError = true;
    } else {
      clientRanking = clients || [];
    }
  }

  // Estados possíveis do resumo de IA:
  // 'available'        — resumo gerado com sucesso
  // 'no_data'          — base de dados vazia/insuficiente
  // 'missing_api_key'  — chave de API ausente ou recurso desabilitado
  // 'missing_year'     — ano inválido
  // 'fetch_error'      — exceção capturada (rede/timeout/etc.)
  type AIState =
    | { status: 'available'; summary: NonNullable<Awaited<ReturnType<typeof buildAIReportSummary>>['summary']> }
    | { status: 'no_data' }
    | { status: 'unavailable'; reason: 'missing_api_key' | 'missing_year' }
    | { status: 'fetch_error' }

  let aiState: AIState = { status: 'fetch_error' };
  try {
    const aiResult = await buildAIReportSummary(supabase, {
      year: latestYear,
      scope: 'global',
    });
    if (aiResult.available && aiResult.summary) {
      aiState = { status: 'available', summary: aiResult.summary };
    } else if (aiResult.reason === 'no_data') {
      aiState = { status: 'no_data' };
    } else {
      // missing_api_key | missing_year
      aiState = { status: 'unavailable', reason: aiResult.reason as 'missing_api_key' | 'missing_year' };
    }
  } catch (e) {
    console.error('[DashboardPage] buildAIReportSummary error:', e);
    aiState = { status: 'fetch_error' };
  }

  const quickActions = [
    {
      href: '/clientes',
      title: 'Apresentações de Clientes',
      description: 'Prepare e compartilhe apresentações executivas para as reuniões comerciais.',
      icon: LayoutDashboard,
      accent: 'text-indigo-400',
    },
    {
      href: '/reports',
      title: 'Central de Relatórios',
      description: 'Navegue pelas tabelas consolidadas com filtros globais.',
      icon: TrendingUp,
      accent: 'text-cyan-400',
    },
    {
      href: '/upload',
      title: 'Motor de Dados (Upload)',
      description: 'Atualize os dados processando planilhas do ERP.',
      icon: Upload,
      accent: 'text-emerald-400',
    },
    {
      href: '/config',
      title: 'Configuração do Sistema',
      description: 'Ajuste os parâmetros de categorização e Bagagitos.',
      icon: Settings2,
      accent: 'text-amber-400',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      <header className="space-y-4">
        <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1 text-sm text-indigo-300 backdrop-blur-xl">
          <Globe className="w-4 h-4 mr-2" />
          Torre de Controle — Operação Brasil
        </div>
        <h1 className="text-4xl lg:text-6xl font-black tracking-tight text-white">
          Visão Executiva <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">{latestYear}</span>
        </h1>
        <p className="max-w-2xl text-lg text-slate-400 leading-relaxed">
          Monitoramento global de desempenho da Autimex. Os relatórios analíticos processam seus dados de vendas e transformam os padrões do ERP em insights imediatos.
        </p>
      </header>

      {aiState.status === 'available' ? (
        <section className="relative p-1 rounded-3xl bg-gradient-to-b from-indigo-500/20 to-transparent">
          <div className="glass rounded-[1.4rem] p-8 sm:p-10">
            <div className="flex items-center mb-6">
              <Sparkles className="w-6 h-6 text-indigo-400 mr-3" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Raio-X da Empresa</h2>
            </div>

            <p className="text-xl sm:text-2xl text-indigo-100 font-light leading-relaxed mb-10">
              "{aiState.summary.headline}"
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-4">
                <h3 className="text-emerald-400 font-semibold flex items-center"><TrendingUp className="w-4 h-4 mr-2"/> Destaques Nacionais</h3>
                <ul className="space-y-3">
                  {aiState.summary.highlights.map((item: string, i: number) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 mr-2 shrink-0"/>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-amber-400 font-semibold flex items-center"><Lightbulb className="w-4 h-4 mr-2"/> Oportunidades Macro</h3>
                <ul className="space-y-3">
                  {aiState.summary.opportunities.map((item: string, i: number) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 mr-2 shrink-0"/>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-rose-400 font-semibold flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/> Riscos Observados</h3>
                <ul className="space-y-3">
                  {aiState.summary.risks.map((item: string, i: number) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 mr-2 shrink-0"/>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      ) : aiState.status === 'no_data' ? (
        <section className="glass rounded-[2rem] p-8 text-center border border-slate-800/50">
          <CheckCircle2 className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">
            Ainda não há dados suficientes para gerar o Raio-X de {latestYear}. Faça o upload das planilhas do ERP para habilitar esta análise.
          </p>
        </section>
      ) : aiState.status === 'fetch_error' ? (
        <section className="glass rounded-[2rem] p-8 text-center border border-rose-900/30">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-slate-400">
            Não foi possível gerar o Raio-X neste momento devido a um erro de comunicação. Tente recarregar a página.
          </p>
        </section>
      ) : (
        /* status === 'unavailable': missing_api_key | missing_year */
        <section className="glass rounded-[2rem] p-8 text-center border border-slate-800/50">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">
            O resumo de inteligência artificial está temporariamente indisponível.
          </p>
        </section>
      )}

      {isLeader && (
        <section className="grid lg:grid-cols-2 gap-8">
          <div className="glass-card rounded-[2rem] p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="text-indigo-400 h-6 w-6" />
              Ranking de Representantes
            </h2>
            <div className="space-y-4">
              {repRanking.map((rep: any, idx: number) => (
                <div key={rep.rep_id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">{rep.rep_email}</p>
                      <p className="text-sm text-slate-400">{rep.num_clientes} clientes • {rep.total_pedidos} pedidos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{fmtBRL(rep.total_faturado)}</p>
                  </div>
                </div>
              ))}
              {repRankingError && (
                <p className="text-rose-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Erro ao carregar o ranking. Tente recarregar a página.
                </p>
              )}
              {!repRankingError && repRanking.length === 0 && (
                <p className="text-slate-400">Nenhum dado encontrado.</p>
              )}
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Sparkles className="text-cyan-400 h-6 w-6" />
              Top Clientes da Equipe
            </h2>
            <div className="space-y-4">
              {clientRanking.slice(0, 5).map((client: any, idx: number) => (
                <div key={client.cod_cliente} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">{client.nome_cliente}</p>
                      <p className="text-sm text-slate-400">Atendido por: {client.rep_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{fmtBRL(client.total_faturado)}</p>
                  </div>
                </div>
              ))}
              {clientRankingError && (
                <p className="text-rose-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Erro ao carregar o ranking. Tente recarregar a página.
                </p>
              )}
              {!clientRankingError && clientRanking.length === 0 && (
                <p className="text-slate-400">Nenhum dado encontrado.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Módulos do Sistema</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group relative flex flex-col justify-between rounded-3xl border border-white/5 bg-white/5 p-6 transition-all hover:bg-white/10 hover:border-white/10 overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Icon className={`w-24 h-24 ${action.accent}`} />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className={`rounded-2xl bg-white/5 w-12 h-12 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-6 w-6 ${action.accent}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors">{action.title}</h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

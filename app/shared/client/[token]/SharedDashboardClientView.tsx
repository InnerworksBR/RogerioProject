'use client';

import { 
  Wallet,
  ShoppingCart,
  Package,
  TrendingUp,
  ArrowUpRight,
  MonitorCheck,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { 
  fmtBRL,
  fmtNumber,
  fmtDate,
  getDeltaLabel
} from '@/components/client-dashboard/ClientVisitDashboard';
import type { SharedClientDashboardDto } from '@/lib/server/shareLinks';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type SharedDashboardViewData =
  Omit<SharedClientDashboardDto, 'clientName' | 'year'> &
  Partial<Pick<SharedClientDashboardDto, 'clientName' | 'year'>>;

export function SharedDashboardClientView({
  dashboardData,
  clientName = dashboardData.clientName ?? '',
  year = dashboardData.year ?? 0,
  aiSummary
}: {
  dashboardData: SharedDashboardViewData;
  clientName?: string;
  year?: number;
  rows?: unknown;
  aiSummary?: any;
}) {
  
  // O layout global já controla o dark mode agora.

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const revenueDelta = getDeltaLabel(dashboardData.summary.totalRevenue, dashboardData.summary.previousRevenue);
  const isGrowing = dashboardData.summary.totalRevenue >= dashboardData.summary.previousRevenue;

  return (
    <div className="min-h-screen font-sans selection:bg-indigo-500/30 selection:text-indigo-200 pb-32">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 -z-10 bg-[#030712]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#030712] to-[#030712]" />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-4xl space-y-8"
        >
          <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-300 backdrop-blur-xl">
            <MonitorCheck className="w-4 h-4 mr-2" />
            Ano Base: {year}
          </div>
          
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white">
            Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">{clientName}</span>.
          </h1>
          
          <p className="text-xl sm:text-3xl font-light text-slate-400">
            Sua parceria com a Plastiron gerou <br className="hidden sm:block" />
            <span className="text-white font-bold">{fmtBRL(dashboardData.summary.totalRevenue)}</span> em negócios neste ano.
          </p>

          <div className="flex justify-center pt-8">
            <div className={`inline-flex items-center px-6 py-3 rounded-2xl border ${isGrowing ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-500/30 bg-slate-500/10 text-slate-400'} backdrop-blur-xl text-lg font-medium`}>
              {isGrowing ? <TrendingUp className="w-5 h-5 mr-2" /> : <Wallet className="w-5 h-5 mr-2" />}
              {revenueDelta} vs {year - 1}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 animate-bounce text-slate-500"
        >
          <ChevronDown className="w-8 h-8" />
        </motion.div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
        
        {/* AI Executive Summary */}
        {aiSummary && (
          <motion.section 
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="relative p-1 rounded-3xl bg-gradient-to-b from-indigo-500/20 to-transparent"
          >
            <div className="glass rounded-[1.4rem] p-8 sm:p-12">
              <motion.div variants={itemVariants} className="flex items-center mb-6">
                <Sparkles className="w-6 h-6 text-indigo-400 mr-3" />
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Resumo Executivo</h2>
              </motion.div>
              
              <motion.p variants={itemVariants} className="text-xl sm:text-2xl text-indigo-100 font-light leading-relaxed mb-10">
                "{aiSummary.headline}"
              </motion.p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <motion.div variants={itemVariants} className="space-y-4">
                  <h3 className="text-emerald-400 font-semibold flex items-center"><TrendingUp className="w-4 h-4 mr-2"/> Destaques</h3>
                  <ul className="space-y-3">
                    {aiSummary.highlights.map((item: string, i: number) => (
                      <li key={i} className="text-slate-300 text-sm flex items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 mr-2 shrink-0"/>
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-4">
                  <h3 className="text-amber-400 font-semibold flex items-center"><Lightbulb className="w-4 h-4 mr-2"/> Oportunidades</h3>
                  <ul className="space-y-3">
                    {aiSummary.opportunities.map((item: string, i: number) => (
                      <li key={i} className="text-slate-300 text-sm flex items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 mr-2 shrink-0"/>
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-4">
                  <h3 className="text-indigo-400 font-semibold flex items-center"><CheckCircle2 className="w-4 h-4 mr-2"/> Ações Recomendadas</h3>
                  <ul className="space-y-3">
                    {aiSummary.recommended_actions.map((item: string, i: number) => (
                      <li key={i} className="text-slate-300 text-sm flex items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 mr-2 shrink-0"/>
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Key Metrics Grid */}
        <motion.section 
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <MetricCardModern title="Pedidos" value={fmtNumber(dashboardData.summary.orderCount)} icon={ShoppingCart} desc={`${dashboardData.summary.activeMonths} meses com compra`} />
          <MetricCardModern title="Ticket Médio" value={fmtBRL(dashboardData.summary.averageTicket)} icon={Wallet} desc={`Vs ${fmtBRL(dashboardData.summary.previousAverageTicket)} em ${year - 1}`} />
          <MetricCardModern title="Mix de Produtos" value={fmtNumber(dashboardData.summary.uniqueProducts)} icon={Package} desc={`Vs ${fmtNumber(dashboardData.summary.previousUniqueProducts)} produtos em ${year - 1}`} />
        </motion.section>

        {/* Monthly Journey Chart */}
        <motion.section 
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="space-y-8"
        >
          <motion.div variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white">Sua Jornada de Compras em {year}</h2>
            <p className="text-slate-400 mt-2 text-lg">Distribuição do faturamento ao longo dos meses.</p>
          </motion.div>

          <motion.div variants={itemVariants} className="glass p-6 sm:p-8 rounded-3xl h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis 
                  stroke="#64748b" 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`}
                  tick={{fill: '#94a3b8'}}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                  itemStyle={{ color: '#818cf8' }}
                  formatter={(value) => [fmtBRL(Number(value ?? 0)), 'Faturamento']}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </motion.section>

        {/* Products Showcase */}
        <motion.section 
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="space-y-8"
        >
          <motion.div variants={itemVariants}>
            <h2 className="text-3xl font-bold text-white">Os Campeões do Mix</h2>
            <p className="text-slate-400 mt-2 text-lg">Os produtos que mais representaram seu faturamento.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {dashboardData.topProducts.slice(0, 4).map((product, i) => (
              <motion.div key={i} variants={itemVariants} className="glass p-6 rounded-2xl flex flex-col justify-between hover:bg-white/[0.02] transition-colors">
                <div>
                  <h3 className="text-lg font-semibold text-white leading-tight">{product.descr_produto}</h3>
                  <span className="text-xs text-slate-500 font-mono mt-1 block">Ref: {product.cod_referencia}</span>
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total Faturado</p>
                    <p className="text-2xl font-bold text-indigo-300">{fmtBRL(product.revenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Quantidade</p>
                    <p className="text-xl font-medium text-white">{fmtNumber(product.units)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

      </div>
    </div>
  );
}

function MetricCardModern({ title, value, desc, icon: Icon }: { title: string, value: string, desc: string, icon: any }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="glass p-6 rounded-3xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="w-16 h-16 text-indigo-400" />
      </div>
      <div className="relative z-10">
        <p className="text-slate-400 font-medium mb-2">{title}</p>
        <h3 className="text-3xl font-black text-white tracking-tight">{value}</h3>
        <p className="text-sm text-slate-500 mt-4">{desc}</p>
      </div>
    </motion.div>
  );
}

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  BarChart3, TrendingUp, Users, Map, 
  ArrowUpRight, ArrowDownRight, Globe, 
  Hotel, Calendar, Banknote, PieChart, Activity,
  Target, Zap, MapPin, RefreshCw, Sparkles,
  ChevronRight, ArrowRight, CheckCircle, Trophy, BarChart
} from 'lucide-react'
import { financeApi } from '@/lib/api'
import { clsx } from 'clsx'
import { ConversionFunnel, RevenueForecast } from '@/components/analytics/SalesIntelligence'

export function AnalyticsDashboardPage() {
  const [year, setYear] = useState('2026')

  // ── Data Fetching ──────────────────────────────────────────────
  const { data: biData, isLoading: isBiLoading } = useQuery({
    queryKey: ['executive-bi'],
    queryFn: () => financeApi.getExecutiveBi().then(r => r.data),
    refetchInterval: 60000 // Refresh every minute
  })

  const { data: aiBriefing } = useQuery({
    queryKey: ['ai-briefing'],
    queryFn: () => financeApi.getAiBriefing().then(r => r.data)
  })

  if (isBiLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-6">
        <div className="relative">
           <BarChart3 className="text-rihla animate-pulse" size={60} />
           <RefreshCw className="absolute -top-2 -right-2 text-white animate-spin" size={20} />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Consolidation des données BI S'TOURS...</p>
      </div>
    )
  }

  const kpis = [
    { label: 'Taux de Conversion', value: `${biData?.win_rate || 0}%`, trend: '+12%', icon: Target, color: 'text-rihla' },
    { label: 'Projets Gagnés', value: biData?.won_projects || 0, trend: '+8%', icon: CheckCircle, color: 'text-emerald-500' },
    { label: 'Marge Moyenne Est.', value: '18.5%', trend: '+2.1%', icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Pipeline Total', value: biData?.total_projects || 0, trend: '+4', icon: Activity, color: 'text-blue-500' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-8 py-8 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-[24px] bg-slate-950 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-2xl">
              <BarChart3 size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter italic">Executive BI Command</h1>
              <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-[0.25em] font-black">Performance Management · S'TOURS RIHLA</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select 
              value={year}
              onChange={e => setYear(e.target.value)}
              className="px-6 py-3 bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-900 dark:text-cream outline-none focus:ring-2 focus:ring-rihla/20"
            >
              <option value="2026">Exercice 2026</option>
              <option value="2025">Exercice 2025</option>
            </select>
            <button className="flex items-center gap-3 px-8 py-3.5 bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-2xl hover:-translate-y-1 transition-all">
              Générer Board Review
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12 space-y-12">
        
        {/* AI STRATEGIC BRIEFING */}
        <section className="bg-gradient-to-r from-rihla to-rihla-dark rounded-[48px] p-10 shadow-2xl shadow-rihla/20 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
              <Sparkles size={160} className="text-white" />
           </div>
           <div className="relative z-10 flex items-start gap-8">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-[32px] flex items-center justify-center text-white border border-white/30 shrink-0">
                 <Zap size={32} />
              </div>
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/20">Executive AI Briefing</span>
                    <span className="text-white/40 text-[10px] font-bold">Mis à jour il y a 2 min</span>
                 </div>
                 <h2 className="text-3xl font-black text-white leading-tight">
                   {aiBriefing?.briefing || "Analyse stratégique en cours..."}
                 </h2>
                 <button className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-black transition-all">
                    Approfondir l'analyse par marché <ArrowRight size={16} />
                 </button>
              </div>
           </div>
        </section>

        {/* KPI GRID */}
        <div className="grid grid-cols-4 gap-8">
          {kpis.map((stat, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[48px] border border-slate-200 dark:border-white/10 shadow-sm group hover:shadow-2xl transition-all duration-500 overflow-hidden relative">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className={clsx("w-14 h-14 rounded-[24px] bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6 duration-500 shadow-sm", stat.color)}>
                  <stat.icon size={24} />
                </div>
                <div className={clsx(
                  "flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm",
                  "bg-emerald-500/10 text-emerald-500"
                )}>
                  <ArrowUpRight size={12} />
                  {stat.trend}
                </div>
              </div>
              <p className="text-4xl font-black text-slate-950 dark:text-cream tracking-tighter relative z-10 italic">{stat.value}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-[0.2em] relative z-10">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-10">
          
          {/* Revenue Chart */}
          <div className="col-span-8 bg-white dark:bg-slate-900 rounded-[60px] border border-slate-200 dark:border-white/10 p-10 shadow-sm">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h3 className="text-xl font-black text-slate-950 dark:text-cream tracking-tight">Courbe de Revenus Consolidée</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest italic">Volume mensuel TTC · Exercice {year}</p>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rihla shadow-lg shadow-rihla/20" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-900 shadow-lg" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projection</span>
                </div>
              </div>
            </div>
            
            <div className="h-80 flex items-end justify-between gap-6 px-4">
              {Object.entries(biData?.revenue_by_month || {}).map(([month, val]: any) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-4 group h-full justify-end">
                   <div className="w-full relative h-full flex flex-col justify-end">
                      {/* Projection Line (Shadow) */}
                      <div className="absolute bottom-0 w-full bg-slate-100 dark:bg-white/5 rounded-2xl h-full" />
                      {/* Actual Revenue Bar */}
                      <div 
                        className="relative w-full bg-gradient-to-t from-rihla-dark to-rihla rounded-2xl transition-all duration-1000 shadow-xl group-hover:scale-x-105 group-hover:brightness-110"
                        style={{ height: `${Math.min(100, (val / 50000) * 100)}%` }}
                      >
                         <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 text-white text-[9px] font-black px-2 py-1 rounded-lg">
                            {(val/1000).toFixed(1)}k
                         </div>
                      </div>
                   </div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">M{month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Destinations */}
          <div className="col-span-4 bg-white dark:bg-slate-900 rounded-[60px] border border-slate-200 dark:border-white/10 p-10 shadow-sm">
            <h3 className="text-xl font-black text-slate-950 dark:text-cream tracking-tight mb-10 flex items-center gap-3 italic">
              <MapPin size={24} className="text-rihla" /> Hot Spots
            </h3>
            <div className="space-y-6">
              {biData?.top_destinations.map((dest: any, i: number) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-sm font-black text-slate-400 group-hover:text-rihla transition-colors">
                      0{i+1}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-cream group-hover:italic transition-all">{dest.city}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{dest.count} Dossiers</p>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-200 group-hover:text-rihla transition-colors" size={18} />
                </div>
              ))}
            </div>
            
            <hr className="my-10 border-slate-100 dark:border-white/5" />
            
            <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/10">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Performance Team</p>
               <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900 dark:text-cream italic">Vitesse de Confirmation</span>
                  <span className="text-xs font-black text-emerald-500">2.4 jours</span>
               </div>
            </div>
          </div>

        </div>

        {/* SALES MASTER DASHBOARD (Prop 25) */}
        <section className="space-y-8">
           <div className="flex items-center justify-between">
              <div>
                 <h2 className="text-2xl font-black text-slate-900 dark:text-cream tracking-tight">Sales Master Intelligence</h2>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Optimisation du Taux de Conversion & Performance</p>
              </div>
              <div className="flex gap-2">
                 <button className="px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">Exporter Data</button>
                 <button className="px-4 py-2 bg-rihla text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rihla/20">Analyse IA Funnel</button>
              </div>
           </div>

           <div className="grid grid-cols-3 gap-8">
              {/* Leaderboard Designers */}
              <div className="col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[40px] p-8 shadow-sm">
                 <div className="flex items-center gap-3 mb-8">
                    <Trophy className="text-amber-500" size={24} />
                    <h3 className="text-sm font-black uppercase tracking-widest dark:text-cream">Performance Travel Designers</h3>
                 </div>
                 <div className="space-y-6">
                    {[
                      { name: "Sonia El Amrani", won: 12, value: "185k€", rate: "72%", growth: "+14%" },
                      { name: "Karim Benani", won: 9, value: "142k€", rate: "65%", growth: "+5%" },
                      { name: "Mehdi Alami", won: 7, value: "98k€", rate: "58%", growth: "-2%" },
                      { name: "Sarah Mansouri", won: 5, value: "64k€", rate: "52%", growth: "+12%" },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center justify-between group">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-xs font-black text-slate-500">#{i+1}</div>
                            <div>
                               <p className="text-sm font-black text-slate-800 dark:text-cream">{d.name}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">{d.won} Projets Gagnés · {d.value}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-8">
                            <div className="text-right">
                               <p className="text-xs font-black text-slate-900 dark:text-cream">{d.rate}</p>
                               <p className="text-[9px] text-slate-400 font-bold uppercase">Win Rate</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black ${d.growth.startsWith('+') ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                               {d.growth}
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Churn / Lost Reason Analysis */}
              <div className="bg-slate-950 rounded-[40px] p-8 text-white relative overflow-hidden">
                 <div className="absolute -bottom-10 -right-10 opacity-10">
                    <PieChart size={180} />
                 </div>
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-8">Analyse des Pertes (Churn)</h3>
                 
                 <div className="space-y-4 relative z-10">
                    {[
                      { reason: "Budget trop élevé", pct: 45, color: "bg-rihla" },
                      { reason: "Compétition (Concurrent)", pct: 30, color: "bg-blue-500" },
                      { reason: "Disponibilité Hôtels", pct: 15, color: "bg-amber-500" },
                      { reason: "Destination changée", pct: 10, color: "bg-slate-500" },
                    ].map((r, i) => (
                      <div key={i} className="space-y-1.5">
                         <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                            <span className="text-white/60">{r.reason}</span>
                            <span className="text-white">{r.pct}%</span>
                         </div>
                         <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full ${r.color} transition-all duration-1000`} style={{ width: `${r.pct}%` }} />
                         </div>
                      </div>
                    ))}
                 </div>
                 
                 <div className="mt-12 p-5 bg-white/5 border border-white/10 rounded-3xl relative z-10">
                    <div className="flex items-center gap-2 text-rihla font-black text-[10px] uppercase mb-2">
                       <Sparkles size={14} /> Recommandation IA
                    </div>
                    <p className="text-[11px] text-white/60 italic leading-relaxed">
                       {"L'IA suggère une remise de 5% sur les packages 'Luxury' pour augmenter le win-rate de 12%. Concentrez l'effort sur la réactivité (Brief → 24h)."}
                    </p>
                 </div>
              </div>
           </div>

           {/* Conversion Trends */}
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[48px] p-10">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                       <TrendingUp size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black dark:text-cream tracking-tight">Conversion Funnel Intelligence</h3>
                       <p className="text-xs text-slate-400 font-medium">Analyse mensuelle de l'efficacité du pipe</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="px-6 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-line dark:border-white/5 text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time to Quote</p>
                       <p className="text-xl font-black dark:text-cream tracking-tighter">14.2h</p>
                    </div>
                    <div className="px-6 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-line dark:border-white/5 text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg. Ticket</p>
                       <p className="text-xl font-black dark:text-cream tracking-tighter">18.4k€</p>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-4 gap-4 items-end h-40 px-10">
                 {[40, 65, 85, 55, 95, 75, 60, 90, 100, 80, 70, 95].map((h, i) => (
                    <div key={i} className="relative group">
                       <div className="w-full bg-slate-100 dark:bg-white/5 rounded-t-xl group-hover:bg-rihla/20 transition-all cursor-pointer relative" style={{ height: `${h}%` }}>
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                             {h}%
                          </div>
                       </div>
                       <p className="text-[8px] font-black text-slate-400 text-center mt-3 uppercase">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</p>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* CONVERSION FUNNEL + REVENUE FORECAST */}
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <ConversionFunnel />
          </div>
          <div>
            <RevenueForecast />
          </div>
        </div>
      </div>
    </div>
  )
}


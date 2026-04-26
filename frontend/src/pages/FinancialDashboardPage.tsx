import { useMemo, useState } from 'react'
import { 
  BarChart2, TrendingUp, DollarSign, 
  ArrowUpRight, ArrowDownRight, Briefcase, 
  Target, Zap, ChevronRight, Activity, PieChart,
  Calculator, Percent, AlertCircle, RefreshCcw
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery, useMutation } from '@tanstack/react-query'
import { financeApi, projectsApi } from '@/lib/api'

export function FinancialDashboardPage() {
  // 1. Global Financial Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['finance-summary'],
    queryFn: () => financeApi.getSummary().then(r => r.data)
  })

  // 2. Active Projects for Simulator
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then(r => r.data?.items ?? [])
  })

  const kpis = [
    { label: 'Chiffre Affaires', value: `${summary?.total_revenue?.toLocaleString() || 0} MAD`, trend: '+12.5%', icon: DollarSign, color: 'text-blue-500' },
    { label: 'Marge Brute Moyenne', value: `${summary?.margin_percentage || 0}%`, trend: '+2.1%', icon: PieChart, color: 'text-emerald-500' },
    { label: 'Profit Net Est.', value: `${summary?.total_margin?.toLocaleString() || 0} MAD`, trend: '+18.4%', icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Taux Conversion', value: `${summary?.projects_count ? Math.round((summary.won_count / summary.projects_count) * 100) : 0}%`, trend: '+4', icon: Target, color: 'text-purple-500' },
  ]

  if (isSummaryLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black">ANALYSE EN COURS...</div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">
      
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-12 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Direction <ChevronRight size={10} /> Dashboard Financier
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter">
            Command Center Financier
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            Pilotage de la rentabilité et simulation de stratégie commerciale.
          </p>
        </div>

        <div className="flex gap-3 bg-white dark:bg-slate-900 p-2 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm">
           <button className="px-6 py-2.5 bg-rihla text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-rihla/20 transition-all">Consolidé</button>
           <button className="px-6 py-2.5 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Par Marché</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* ── KPI GRID ─────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-8">
          {kpis.map((kpi, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
              <div className="flex justify-between items-start mb-6">
                <div className={clsx("p-4 rounded-[20px] bg-slate-50 dark:bg-white/5 transition-transform group-hover:scale-110 duration-500", kpi.color)}>
                  <kpi.icon size={24} />
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                  <ArrowUpRight size={12} /> {kpi.trend}
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter">{kpi.value}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* ── ANALYTICS GRID ─────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-10">
          
          {/* Main Table Area */}
          <div className="col-span-12 lg:col-span-8 space-y-10">
            <DiscountSimulator projects={projects} />
            
            {/* Market Exposure Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-white/10 shadow-sm p-10">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black flex items-center gap-3">
                    <PieChart className="text-rihla" size={24} /> Exposition Marché & Devises
                  </h3>
               </div>
               <div className="grid grid-cols-3 gap-8">
                  {[
                    { country: 'France', rev: '42%', color: 'bg-blue-500' },
                    { country: 'UK (GBP)', rev: '28%', color: 'bg-rihla' },
                    { country: 'Gulf Regions', rev: '15%', color: 'bg-emerald-500' },
                  ].map(m => (
                    <div key={m.country} className="space-y-3">
                       <div className="flex justify-between items-end">
                          <span className="text-sm font-black italic">{m.country}</span>
                          <span className="text-[10px] font-bold text-slate-400">{m.rev}</span>
                       </div>
                       <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div className={clsx("h-full rounded-full", m.color)} style={{ width: m.rev }} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
             <div className="bg-slate-900 rounded-[48px] p-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10">
                   <TrendingUp size={120} />
                </div>
                <h3 className="text-2xl font-black mb-8 relative z-10">Conseil S'TOURS</h3>
                <div className="space-y-6 relative z-10">
                   <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                      <p className="text-[10px] font-black text-rihla uppercase tracking-widest mb-3">Alerte Marge</p>
                      <p className="text-sm font-medium leading-relaxed">
                         Le marché <span className="font-black text-white italic">UK</span> montre une baisse de 4% ce mois-ci. L'IA suggère d'ajuster les tarifs transport.
                      </p>
                   </div>
                   <button className="w-full py-5 bg-white text-slate-950 text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-2xl hover:-translate-y-1 transition-all">
                      Générer Rapport IA
                   </button>
                </div>
             </div>

             <div className="bg-emerald-500/10 border border-emerald-500/20 p-10 rounded-[48px] flex flex-col items-center text-center group">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl group-hover:scale-110 transition-transform">
                   <Zap size={32} />
                </div>
                <h4 className="text-xl font-black text-slate-900 dark:text-cream mb-2 italic">Cashflow Optima</h4>
                <p className="text-xs text-slate-400 font-medium mb-8">Flux de trésorerie positif pour les 30 prochains jours.</p>
                <div className="w-full h-1 bg-emerald-500/20 rounded-full" />
             </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function DiscountSimulator({ projects }: { projects: any[] }) {
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [discount, setDiscount] = useState(5)
  
  const { data: simulation, mutate, isPending } = useMutation({
    mutationFn: () => financeApi.simulateDiscount(selectedProjectId, discount).then(r => r.data)
  })

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-white/10 shadow-sm p-10">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-2xl font-black flex items-center gap-3">
            <Calculator className="text-rihla" size={28} /> Simulateur de Remise Commerciale
          </h3>
          <p className="text-slate-400 text-sm mt-1 font-medium">Analysez l'impact d'un geste commercial sur votre profit net.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-10">
        <div className="space-y-8">
           <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sélectionner un Dossier</label>
              <select 
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-rihla appearance-none"
              >
                <option value="">Choisir un projet...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
           </div>

           <div className="space-y-3">
              <div className="flex justify-between px-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remise Souhaitée</label>
                 <span className="text-sm font-black text-rihla">{discount}%</span>
              </div>
              <input 
                type="range" min="1" max="25" step="0.5"
                value={discount} onChange={e => setDiscount(parseFloat(e.target.value))}
                className="w-full accent-rihla"
              />
           </div>

           <button 
            onClick={() => mutate()}
            disabled={!selectedProjectId || isPending}
            className="w-full py-5 bg-slate-950 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-2xl disabled:opacity-50 active:scale-95 transition-all"
           >
              {isPending ? 'Simulation en cours...' : 'Calculer l\'Impact'}
           </button>
        </div>

        <div className="bg-slate-50 dark:bg-black/20 rounded-[40px] p-8 flex flex-col justify-center border border-slate-100 dark:border-white/5 relative overflow-hidden">
           {simulation ? (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex justify-between items-end border-b border-slate-200 dark:border-white/5 pb-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase">Nouvelle Marge Est.</p>
                   <p className="text-3xl font-black text-emerald-500">{simulation.new_margin?.toLocaleString()} MAD</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Chute de Profit</p>
                      <p className="text-xl font-black text-red-500">-{simulation.margin_drop_pct}%</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Nouveau Prix Vente</p>
                      <p className="text-xl font-black text-slate-800 dark:text-cream">{simulation.new_selling?.toLocaleString()} MAD</p>
                   </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3">
                   <AlertCircle className="text-amber-500 shrink-0" size={18} />
                   <p className="text-[10px] font-bold text-amber-600 leading-tight">
                      Attention : Cette remise réduit votre marge nette de moitié sur ce dossier.
                   </p>
                </div>
             </div>
           ) : (
             <div className="text-center space-y-4">
                <RefreshCcw size={48} className="mx-auto text-slate-200 animate-spin-slow" />
                <p className="text-sm font-medium text-slate-400">Configurez une simulation à gauche.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  )
}

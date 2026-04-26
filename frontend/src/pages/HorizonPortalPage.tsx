import { useState, useMemo } from 'react'
import { 
  Bus, Users, MapPin, Calendar, 
  ShieldAlert, Settings, Download, Search,
  TrendingUp, Clock, CheckCircle2, MoreHorizontal,
  Navigation, AlertTriangle, ArrowUpRight, Filter,
  Maximize2, Eye, Edit3
} from 'lucide-react'
import { clsx } from 'clsx'

// ── Types & Mock Data ─────────────────────────────────────────────
interface Mission {
  id: string
  group: string
  vehicle: string
  driver: string
  status: 'active' | 'scheduled' | 'maintenance' | 'completed'
  start: string
  end: string
  route: string
}

const MISSIONS: Mission[] = [
  { id: 'M-771', group: 'US Adventure Co.', vehicle: 'Sprinter 12A', driver: 'Ahmed L.', status: 'active', start: '2026-04-20', end: '2026-04-30', route: 'Marrakech > Merzouga' },
  { id: 'M-775', group: 'Prestige Tours Paris', vehicle: 'Minibus 05B', driver: 'Youssef B.', status: 'scheduled', start: '2026-04-25', end: '2026-05-02', route: 'Casablanca > Chefchaouen' },
  { id: 'M-762', group: 'Nordic Adventures', vehicle: '4x4 Toyota', driver: 'Said M.', status: 'completed', start: '2026-04-10', end: '2026-04-18', route: 'Atlas Trek' },
  { id: 'M-Maintenance', group: '—', vehicle: 'Sprinter 09C', driver: '—', status: 'maintenance', start: '2026-04-22', end: '2026-04-24', route: 'Garage Service' },
]

const STATS = [
  { label: 'Véhicules actifs', value: '18', trend: '+2', icon: Bus, color: 'text-cyan-400' },
  { label: 'Chauffeurs en route', value: '14', trend: 'Stable', icon: Users, color: 'text-amber-400' },
  { label: 'Missions du mois', value: '142', trend: '+15%', icon: Navigation, color: 'text-emerald-400' },
  { label: 'Taux de service', value: '98%', trend: 'Optimum', icon: CheckCircle2, color: 'text-blue-400' },
]

export function HorizonPortalPage() {
  const [view, setView] = useState<'all' | 'active' | 'maintenance'>('all')

  const filteredMissions = useMemo(() => {
    if (view === 'all') return MISSIONS
    return MISSIONS.filter(m => m.status === view)
  }, [view])

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-300 transition-colors">
      
      {/* ── HEADER (Control Center Style) ─────────────────────── */}
      <header className="border-b border-white/5 bg-[#0D1425]/80 backdrop-blur-xl px-8 py-6 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                <Bus size={24} />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tighter uppercase italic">
                  HORIZON <span className="text-cyan-400">Control</span>
                </h1>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                  <p className="text-[10px] font-black text-cyan-400/80 uppercase tracking-widest">Live Connect System</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setView('all')}
                className={clsx("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", view === 'all' ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "text-slate-500 hover:text-white")}
              >
                Global
              </button>
              <button 
                onClick={() => setView('active')}
                className={clsx("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", view === 'active' ? "bg-cyan-500 text-white" : "text-slate-500 hover:text-white")}
              >
                En Route
              </button>
              <button 
                onClick={() => setView('maintenance')}
                className={clsx("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", view === 'maintenance' ? "bg-cyan-500 text-white" : "text-slate-500 hover:text-white")}
              >
                Maintenance
              </button>
            </div>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-white/10 text-white text-[10px] font-black rounded-xl hover:bg-white/20 transition-all uppercase tracking-widest border border-white/5">
              <Download size={14} /> Log Exports
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-8 py-8">
        
        {/* ── TOP STATS ───────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-6 mb-10">
          {STATS.map((stat, i) => (
            <div key={i} className="bg-[#111827] p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                <stat.icon size={80} />
              </div>
              <div className="flex justify-between items-start mb-4">
                <div className={clsx("w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center", stat.color)}>
                  <stat.icon size={20} />
                </div>
                <span className="text-[10px] font-black text-slate-500 flex items-center gap-1 uppercase">
                  {stat.trend} <ArrowUpRight size={10} />
                </span>
              </div>
              <p className="text-3xl font-black text-white tracking-tighter">{stat.value}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase mt-1 tracking-widest">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-8">
          
          {/* ── LEFT: DISPATCH BOARD ───────────────────────────── */}
          <div className="col-span-8 bg-[#111827] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="font-black text-white flex items-center gap-3 text-sm uppercase tracking-widest">
                <Navigation size={18} className="text-cyan-400" /> Flux Logistique Actif
              </h3>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                <Search size={14} className="text-slate-500" />
                <input type="text" placeholder="Rechercher mission..." className="bg-transparent border-none text-[10px] font-bold outline-none text-white w-40" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-black text-slate-500 border-b border-white/5 bg-white/[0.01]">
                    <th className="px-8 py-5">ID / Mission</th>
                    <th className="px-6 py-5">Chauffeur</th>
                    <th className="px-6 py-5">Véhicule</th>
                    <th className="px-6 py-5">Dates</th>
                    <th className="px-6 py-5">Status</th>
                    <th className="px-6 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredMissions.map(m => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-white tracking-wide">{m.id} · {m.group}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 flex items-center gap-1">
                          <MapPin size={10} className="text-cyan-500" /> {m.route}
                        </p>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-[10px] text-cyan-400">
                            {m.driver.split(' ')[0][0]}
                          </div>
                          <span className="text-xs font-bold text-slate-300">{m.driver}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] font-black text-white">
                          {m.vehicle}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <p className="text-[10px] font-black text-slate-400">{m.start}</p>
                        <p className="text-[10px] font-black text-slate-500">→ {m.end}</p>
                      </td>
                      <td className="px-6 py-6">
                        <span className={clsx(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                          m.status === 'active' ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                          m.status === 'scheduled' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          m.status === 'maintenance' ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                          "bg-slate-500/10 text-slate-400"
                        )}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button title="Envoyer Signal" className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500 hover:text-white transition-all"><Navigation size={14} /></button>
                          <button className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all"><Eye size={14} /></button>
                          <button className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-cyan-400 transition-all"><Edit3 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── RIGHT: FLEET STATUS ────────────────────────────── */}
          <div className="col-span-4 space-y-8">
            
            {/* Maintenance & Health */}
            <div className="bg-[#111827] rounded-[40px] border border-white/5 p-8 shadow-2xl">
              <h3 className="font-black text-white flex items-center gap-3 text-xs uppercase tracking-widest mb-8">
                <ShieldAlert size={18} className="text-amber-500" /> Alertes Maintenance
              </h3>
              <div className="space-y-4">
                {[
                  { vehicle: 'Sprinter 09C', issue: 'Révision 60,000km', urgent: true },
                  { vehicle: 'Minibus 05B', issue: 'Pneumatiques AR', urgent: false },
                ].map((alert, i) => (
                  <div key={i} className={clsx("p-4 rounded-2xl border", alert.urgent ? "bg-red-500/5 border-red-500/20" : "bg-white/5 border-white/10")}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-black text-white">{alert.vehicle}</span>
                      {alert.urgent && <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-md">URGENT</span>}
                    </div>
                    <p className="text-[10px] font-bold text-slate-500">{alert.issue}</p>
                    <button className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase text-white rounded-xl transition-all">
                      Assigner Atelier
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Dispatch Action */}
            <div className="bg-gradient-to-br from-cyan-600 to-blue-800 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
              <h4 className="text-lg font-black tracking-tight mb-2">Nouveau Dispatch</h4>
              <p className="text-[11px] text-white/60 leading-relaxed mb-6">Assignez rapidement un chauffeur disponible à un projet client en attente.</p>
              <button className="w-full py-4 bg-white text-ink rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-cyan-900/50">
                Ouvrir le Planificateur
              </button>
            </div>

            {/* Drivers Live Map Preview (Simulated) */}
            <div className="bg-[#111827] rounded-[40px] border border-white/5 p-6 shadow-2xl h-[300px] relative overflow-hidden">
               <div className="absolute inset-0 opacity-10" style={{
                 backgroundImage: 'radial-gradient(circle, #22d3ee 1px, transparent 1px)',
                 backgroundSize: '20px 20px'
               }} />
               <div className="relative h-full flex flex-col justify-between">
                 <div className="flex justify-between items-center">
                    <h3 className="font-black text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
                      <Navigation size={14} className="text-cyan-400" /> Live Tracking
                    </h3>
                    <span className="text-[8px] font-black text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full">BETA</span>
                 </div>
                 <div className="flex-1 flex items-center justify-center">
                   <div className="text-center">
                     <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Simulation Radar...</p>
                     <p className="text-[9px] text-slate-700 mt-1 italic">Vecteurs de mouvement détectés</p>
                   </div>
                 </div>
                 <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                   <p className="text-[9px] font-bold text-slate-500">Dernière mise à jour : il y a 2 min</p>
                 </div>
               </div>
            </div>

          </div>

        </div>
      </main>

    </div>
  )
}

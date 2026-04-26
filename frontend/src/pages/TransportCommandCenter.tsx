import { useState, useEffect } from 'react'
import { 
  Bus, MapPin, AlertCircle, CheckCircle2, 
  Activity, Users, Clock, Search, Filter, 
  ChevronRight, Bell, Shield, Radio, Map
} from 'lucide-react'
import { clsx } from 'clsx'

// ── Mock Real-time Missions ───────────────────────────────────────
const MISSIONS = [
  { id: 'M1', driver: 'Hassan E.', vehicle: 'Mercedes V-Class', pax: 4, location: 'Marrakech', status: 'active', task: 'Transfert Aéroport', delay: 0 },
  { id: 'M2', driver: 'Youssef B.', vehicle: 'Minibus VIP', pax: 12, location: 'Casablanca', status: 'active', task: 'City Tour', delay: 15 },
  { id: 'M3', driver: 'Ahmed L.', vehicle: 'Toyota PRADO', pax: 2, location: 'Désert Agafay', status: 'warning', task: 'Transfert Bivouac', delay: -5 },
  { id: 'M4', driver: 'Karim M.', vehicle: 'Mercedes Sprinter', pax: 15, location: 'Fès', status: 'completed', task: 'Départ Hôtel', delay: 0 },
]

const CITIES = [
  { name: 'Tanger', x: 45, y: 10 },
  { name: 'Rabat', x: 35, y: 30 },
  { name: 'Casablanca', x: 28, y: 40 },
  { name: 'Marrakech', x: 25, y: 65 },
  { name: 'Fès', x: 50, y: 35 },
  { name: 'Agadir', x: 15, y: 85 },
  { name: 'Ouarzazate', x: 35, y: 75 },
]

export function TransportCommandCenter() {
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [liveFeed, setLiveFeed] = useState([
    { time: '15:02', msg: 'Hassan E. est arrivé à destination (Marrakech)', type: 'info' },
    { time: '14:55', msg: 'Alerte : Retard détecté sur M2 (Casablanca)', type: 'warning' },
    { time: '14:48', msg: 'Youssef B. a débuté la mission M2', type: 'success' },
  ])

  // Simple auto-scroll simulation
  useEffect(() => {
    const interval = setInterval(() => {
      // simulate random updates
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex h-full bg-[#0A0F1D] text-white overflow-hidden font-sans">
      
      {/* ── LEFT PANEL: LIVE RADAR ──────────────────────────── */}
      <div className="w-[450px] border-r border-white/10 flex flex-col bg-slate-900/40 backdrop-blur-xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
              <Radio className="text-rihla animate-pulse" size={20} />
              TRANSPORT OPS
            </h1>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded border border-emerald-500/30">LIVE SYNC</span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
            <input 
              type="text" 
              placeholder="Rechercher chauffeur ou véhicule..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-rihla/50 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {MISSIONS.map(m => (
            <div key={m.id} className={clsx(
              "p-4 rounded-2xl border transition-all cursor-pointer group",
              m.status === 'warning' ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/5 hover:border-white/20"
            )}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    m.status === 'warning' ? "bg-amber-500 text-white" : "bg-rihla/20 text-rihla"
                  )}>
                    <Bus size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{m.id} · {m.vehicle}</p>
                    <h3 className="text-[13px] font-bold">{m.driver}</h3>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-black">{m.location}</p>
                  <p className={clsx(
                    "text-[9px] font-bold uppercase",
                    m.delay > 0 ? "text-red-400" : "text-emerald-400"
                  )}>
                    {m.delay === 0 ? 'À l\'heure' : m.delay > 0 ? `+${m.delay} min` : `${m.delay} min`}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium text-white/60">
                <div className="flex items-center gap-1.5">
                   <Activity size={12} className="text-rihla" />
                   {m.task}
                </div>
                <div className="flex items-center gap-1.5">
                   <Users size={12} />
                   {m.pax} PAX
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-black/20 border-t border-white/10">
          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Flux d'Activité</h4>
          <div className="space-y-3">
            {liveFeed.map((f, i) => (
              <div key={i} className="flex gap-3 text-[11px]">
                <span className="text-white/30 font-mono">{f.time}</span>
                <p className={clsx(
                  "flex-1 font-medium",
                  f.type === 'warning' ? "text-amber-400" : "text-white/70"
                )}>{f.msg}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CENTER: INTERACTIVE STRATEGIC MAP ────────────────── */}
      <div className="flex-1 relative flex flex-col">
        {/* Map Header */}
        <div className="absolute top-8 left-8 z-10 flex items-center gap-6">
           <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Missions Actives</span>
                <span className="text-2xl font-black text-rihla">24</span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">En Alerte</span>
                <span className="text-2xl font-black text-amber-500">3</span>
              </div>
           </div>
        </div>

        {/* The Map */}
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="relative w-full max-w-2xl aspect-[4/5] bg-white/5 rounded-[48px] border border-white/10 overflow-hidden shadow-inner">
             {/* Simple Morocco Outline Simulation */}
             <svg viewBox="0 0 100 100" className="w-full h-full opacity-20 fill-none stroke-white/20 stroke-1">
                <path d="M40 5 L60 5 L80 20 L90 40 L80 60 L60 80 L40 95 L20 80 L10 60 L15 30 Z" />
             </svg>

             {/* Cities & Active Missions */}
             {CITIES.map(city => {
               const hasMission = MISSIONS.find(m => m.location === city.name)
               return (
                 <div 
                   key={city.name}
                   className="absolute group transition-all"
                   style={{ left: `${city.x}%`, top: `${city.y}%` }}
                   onMouseEnter={() => setSelectedCity(city.name)}
                   onMouseLeave={() => setSelectedCity(null)}
                 >
                    <div className={clsx(
                      "w-4 h-4 rounded-full border-2 transition-all cursor-pointer relative",
                      hasMission 
                        ? (hasMission.status === 'warning' ? "bg-amber-500 border-white" : "bg-rihla border-white")
                        : "bg-white/10 border-white/20 hover:bg-white/30"
                    )}>
                       {hasMission && (
                         <div className="absolute -inset-4 bg-rihla/20 rounded-full animate-ping" />
                       )}
                    </div>
                    
                    {/* Tooltip */}
                    <div className={clsx(
                      "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg whitespace-nowrap transition-all z-20",
                      selectedCity === city.name ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                    )}>
                      <p className="text-[10px] font-black uppercase tracking-widest">{city.name}</p>
                      {hasMission && <p className="text-[9px] text-rihla font-bold mt-0.5">{hasMission.driver}</p>}
                    </div>
                 </div>
               )
             })}
          </div>
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-8 right-8 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex gap-6">
           <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rihla" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Normal</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Alerte Retard</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/10 border border-white/20" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Disponibles</span>
           </div>
        </div>
      </div>

    </div>
  )
}

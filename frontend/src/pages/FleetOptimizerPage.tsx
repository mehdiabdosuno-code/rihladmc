import { useState, useMemo } from 'react'
import { Bus, Users, TrendingDown, AlertCircle, Info, CheckCircle2, ChevronRight, Zap } from 'lucide-react'

// ── Flotte réelle S'TOURS (BDD MEDIA/Transport) ──────────────────
const FLEET_DATABASE = [
  { id: 'sedan',       label: 'Mercedes Classe S — VIP',            capacity: 3,  daily_rate: 2500, icon: Zap,  type: 'sedan' },
  { id: 'sedan_e',     label: 'Mercedes Classe E',                  capacity: 3,  daily_rate: 1800, icon: Zap,  type: 'sedan' },
  { id: '4x4_lc',      label: '4×4 Toyota Land Cruiser — Sahara',   capacity: 4,  daily_rate: 1800, icon: Zap,  type: '4wd' },
  { id: '4x4_hilux',   label: '4×4 Toyota Hilux — Désert',          capacity: 3,  daily_rate: 1200, icon: Zap,  type: '4wd' },
  { id: '4x4_pajero',  label: '4×4 Mitsubishi Pajero — Atlas',      capacity: 4,  daily_rate: 1400, icon: Zap,  type: '4wd' },
  { id: '4x4_g',       label: '4×4 Mercedes Classe G — VIP',        capacity: 4,  daily_rate: 3500, icon: Zap,  type: '4wd' },
  { id: 'vito',        label: 'Mercedes Vito Tourer',               capacity: 8,  daily_rate: 1500, icon: Bus,  type: 'mini-van' },
  { id: 'man_tge',     label: 'MAN TGE 5.180 — Minibus',            capacity: 19, daily_rate: 2200, icon: Bus,  type: 'minibus' },
  { id: 'king_long',   label: 'King Long — Autocar 49 PAX',         capacity: 49, daily_rate: 3200, icon: Bus,  type: 'coach' },
  { id: 'irizar',      label: 'Irizar i6 — Autocar Premium 48 PAX', capacity: 48, daily_rate: 3500, icon: Bus,  type: 'coach' },
  { id: '54_seat',     label: 'MAN — Autocar 54 PAX',               capacity: 54, daily_rate: 4000, icon: Bus,  type: 'coach' },
]

interface Solution {
  vehicleId: string
  label: string
  count: number
  capacity: number
  totalCapacity: number
  totalCost: number
  fillRate: number
  costPerPax: number
}

export function FleetOptimizerPage() {
  const [pax, setPax] = useState<number>(20)
  const [days, setDays] = useState<number>(7)

  const solutions = useMemo(() => {
    if (!pax || pax <= 0) return []

    return FLEET_DATABASE.map(v => {
      const count = Math.ceil(pax / v.capacity)
      const totalCost = count * v.daily_rate * days
      const totalCapacity = count * v.capacity
      const fillRate = (pax / totalCapacity) * 100
      const costPerPax = totalCost / pax

      return {
        vehicleId: v.id,
        label: v.label,
        count,
        capacity: v.capacity,
        totalCapacity,
        totalCost,
        fillRate,
        costPerPax,
      } as Solution
    }).sort((a, b) => a.totalCost - b.totalCost) // Trier par coût total le moins cher
  }, [pax, days])

  const bestSolution = solutions[0]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-16 transition-colors">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' }} className="px-8 py-8 shadow-xl">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Bus size={14} className="text-emerald-400" />
            <span className="text-emerald-400/80 text-[10px] font-bold uppercase tracking-[0.3em]">RIHLA DMC · Fleet Optimizer</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Optimisateur de Flotte Transport</h1>
          <p className="text-slate-400 text-sm mt-1">Calculez la configuration de véhicules la plus rentable pour votre groupe.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 -mt-6">
        <div className="grid grid-cols-12 gap-8">
          
          {/* LEFT: Inputs */}
          <div className="col-span-4 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-800 dark:text-cream mb-6 flex items-center gap-2">
                <Users size={16} className="text-rihla" />
                Paramètres du groupe
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Nombre de PAX</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="1" max="100" value={pax} 
                      onChange={e => setPax(parseInt(e.target.value))}
                      className="flex-1 accent-rihla"
                    />
                    <span className="text-2xl font-black text-ink dark:text-white w-12">{pax}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Durée du circuit (jours)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="1" max="21" value={days} 
                      onChange={e => setDays(parseInt(e.target.value))}
                      className="flex-1 accent-slate-400"
                    />
                    <span className="text-2xl font-black text-ink dark:text-white w-12">{days}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                <div className="flex gap-3">
                  <TrendingDown size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Conseil Optimisation</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400/70 mt-1">
                      {pax % 17 === 0 
                        ? "Configuration parfaite pour Minibus 17." 
                        : `Visez un multiple de capacité pour réduire le coût par pax.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Reference Card */}
            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl text-white">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Tarifs de Référence (MAD/jour)</h3>
              <div className="space-y-3">
                {FLEET_DATABASE.map(v => (
                  <div key={v.id} className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">{v.label}</span>
                    <span className="font-mono font-bold">{v.daily_rate} MAD</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-600 mt-6 italic border-t border-slate-800 pt-3">
                * Tarifs moyens incluant chauffeur et carburant (Hors frais chauffeur nuitée).
              </p>
            </div>
          </div>

          {/* RIGHT: Solutions */}
          <div className="col-span-8 space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2">Configurations Comparées</h2>
            
            <div className="grid gap-4">
              {solutions.map((sol, idx) => {
                const isBest = idx === 0;
                const Icon = FLEET_DATABASE.find(f => f.id === sol.vehicleId)?.icon || Bus
                
                return (
                  <div key={sol.vehicleId} 
                    className={`relative bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all p-6 flex items-center justify-between shadow-sm hover:shadow-md ${isBest ? 'border-emerald-500' : 'border-slate-100 dark:border-slate-700'}`}>
                    
                    {isBest && (
                      <div className="absolute -top-3 left-6 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <CheckCircle2 size={10} /> RECOMMANDÉ
                      </div>
                    )}

                    <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isBest ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Icon size={28} />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-800 dark:text-white text-lg">{sol.count} × {sol.label}</h4>
                          <span className="text-[10px] bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded font-bold uppercase">{sol.capacity} places</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-slate-400">Capacité totale : <strong>{sol.totalCapacity} places</strong></p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-20 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${sol.fillRate > 90 ? 'bg-emerald-500' : sol.fillRate > 70 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                                style={{ width: `${sol.fillRate}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{Math.round(sol.fillRate)}% rempli</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Coût par PAX / circuit</p>
                      <p className={`text-2xl font-black ${isBest ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>{Math.round(sol.costPerPax).toLocaleString('fr-FR')} MAD</p>
                      <p className="text-xs text-slate-400 mt-1">Total : {sol.totalCost.toLocaleString('fr-FR')} MAD</p>
                    </div>

                    <div className="ml-6 pl-6 border-l border-slate-100 dark:border-slate-700">
                      <button className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isBest ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:scale-110' : 'bg-slate-50 dark:bg-white/5 text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}>
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Warning Section */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4 mt-6">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">Note sur la réglementation marocaine</p>
                <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                  Pour les groupes de plus de 15 personnes, l'usage d'un autocar de tourisme agréé est obligatoire. 
                  Le transport en 4x4 ou taxis est limité à des zones spécifiques (Désert, Médinas) et nécessite des dérogations pour les longs trajets inter-villes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

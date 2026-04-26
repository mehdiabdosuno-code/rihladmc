import { useState } from 'react'
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  MapPin, Users, User, Clock, Filter, Search,
  Flag, Info, AlertTriangle, CheckCircle2
} from 'lucide-react'

// ── Mock Data ─────────────────────────────────────────────────────
const GUIDES = ['Ahmed', 'Fatima', 'Youssef', 'Karim', 'Non assigné']
const VEHICLES = ['Sprinter 1 (17p)', 'Vito 1 (7p)', 'Autocar (48p)', '4x4 Prado', 'Non assigné']

const INITIAL_GROUPS = [
  { id: 'G01', name: 'Group Sunset TO', start: 1, end: 11, color: 'bg-blue-500', pax: 22, guide: 'Ahmed', vehicle: 'Sprinter 1 (17p)' },
  { id: 'G02', name: 'Incentive Paris', start: 5, end: 9, color: 'bg-emerald-500', pax: 45, guide: 'Fatima', vehicle: 'Autocar (48p)' },
  { id: 'G03', name: 'Luxury FIT Spain', start: 15, end: 22, color: 'bg-amber-500', pax: 4, guide: 'Youssef', vehicle: '4x4 Prado' },
  { id: 'G04', name: 'Cultural Tour UK', start: 12, end: 20, color: 'bg-indigo-500', pax: 18, guide: 'Karim', vehicle: 'Sprinter 1 (17p)' },
]

const DAYS_IN_MONTH = 30
const DAYS_ARRAY = Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1)

export function OperationsCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState('Novembre 2026')
  const [groups, setGroups] = useState(INITIAL_GROUPS)

  // ── Moteur de Détection de Conflits ──
  const conflicts = groups.reduce((acc, g1, i) => {
    for (let j = i + 1; j < groups.length; j++) {
      const g2 = groups[j]
      const isOverlap = Math.max(g1.start, g2.start) <= Math.min(g1.end, g2.end)
      if (isOverlap) {
        if (g1.guide === g2.guide && g1.guide !== 'Non assigné') {
          acc.push(`Conflit Guide : ${g1.guide} est assigné à ${g1.id} et ${g2.id}`)
        }
        if (g1.vehicle === g2.vehicle && g1.vehicle !== 'Non assigné') {
          acc.push(`Conflit Flotte : ${g1.vehicle} est assigné à ${g1.id} et ${g2.id}`)
        }
      }
    }
    return acc
  }, [] as string[])

  const handleAssign = (id: string, field: 'guide' | 'vehicle', value: string) => {
    setGroups(groups.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-ink flex items-center justify-center text-white shadow-lg">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">Planning des Opérations</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Vue Timeline Groupes</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1">
            <button className="p-1.5 hover:bg-slate-50 rounded-md transition-colors"><ChevronLeft size={16} /></button>
            <span className="px-4 py-1.5 text-sm font-bold text-slate-700">{currentMonth}</span>
            <button className="p-1.5 hover:bg-slate-50 rounded-md transition-colors"><ChevronRight size={16} /></button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">
            <Filter size={14} /> Filtres
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Timeline Grid */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              
              {/* Days Header */}
              <div className="flex border-b border-slate-100 bg-slate-50/50">
                <div className="w-64 flex-shrink-0 border-r border-slate-100 px-6 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-widest">
                  Groupes / Guides
                </div>
                {DAYS_ARRAY.map(day => {
                  const isWeekend = day % 7 === 0 || (day + 1) % 7 === 0;
                  return (
                    <div key={day} className={`flex-1 text-center py-3 text-[10px] font-bold border-r border-slate-50 last:border-0 ${isWeekend ? 'bg-slate-100/50 text-slate-500' : 'text-slate-400'}`}>
                      {day < 10 ? `0${day}` : day}
                    </div>
                  )
                })}
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {groups.map(group => (
                  <div key={group.id} className="flex group hover:bg-slate-50/30 transition-colors">
                    {/* Group Info & Assigment */}
                    <div className="w-64 flex-shrink-0 border-r border-slate-100 p-4">
                      <h4 className="text-xs font-black text-slate-800 mb-2">{group.name} ({group.pax} PAX)</h4>
                      <div className="space-y-1.5">
                        <select 
                          value={group.guide} 
                          onChange={e => handleAssign(group.id, 'guide', e.target.value)}
                          className="w-full text-[10px] font-bold text-rihla bg-slate-50 border border-slate-200 rounded p-1 outline-none"
                        >
                          {GUIDES.map(g => <option key={g} value={g}>👤 {g}</option>)}
                        </select>
                        <select 
                          value={group.vehicle} 
                          onChange={e => handleAssign(group.id, 'vehicle', e.target.value)}
                          className="w-full text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded p-1 outline-none"
                        >
                          {VEHICLES.map(v => <option key={v} value={v}>🚐 {v}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Timeline Bar Container */}
                    <div className="flex-1 relative h-16 flex items-center">
                      {/* Gray grid lines */}
                      {DAYS_ARRAY.map(d => (
                        <div key={d} className="absolute h-full border-r border-slate-50" style={{ left: `${(d-1) * (100/30)}%`, width: `${100/30}%` }} />
                      ))}
                      
                      {/* The actual group bar */}
                      <div 
                        className={`absolute h-8 rounded-lg ${group.color} shadow-lg shadow-blue-500/10 flex items-center px-3 text-[9px] font-bold text-white overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform`}
                        style={{ 
                          left: `${(group.start-1) * (100/30)}%`, 
                          width: `${(group.end - group.start + 1) * (100/30)}%` 
                        }}
                      >
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Flag size={10} />
                          {group.id} — {group.name}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend & Stats */}
        <div className="grid grid-cols-4 gap-8 mt-12">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Statut ce jour</h5>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Arrivées</span>
                <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-black">02</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">En Circuit</span>
                <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-black">05</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Départs</span>
                <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[10px] font-black">01</span>
              </div>
            </div>
          </div>

          <div className={`col-span-2 rounded-2xl p-5 flex gap-4 ${conflicts.length > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-emerald-50 border border-emerald-100'}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${conflicts.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {conflicts.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
            </div>
            <div>
              <h5 className={`text-xs font-bold mb-1 ${conflicts.length > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                {conflicts.length > 0 ? 'Alerte Disponibilité' : 'Planning Validé'}
              </h5>
              {conflicts.length > 0 ? (
                <div className="text-[11px] text-amber-700 leading-relaxed space-y-1">
                  {conflicts.map((c, i) => <p key={i}>⚠️ {c}</p>)}
                </div>
              ) : (
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Aucun conflit détecté. Toutes les ressources logistiques sont correctement affectées.
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 text-white flex flex-col justify-center">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Taux d'occupation</p>
            <p className="text-3xl font-black text-emerald-400">84%</p>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-emerald-400 w-[84%] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

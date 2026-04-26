import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { 
  Hotel, Users, FileCheck, Download, Plus, Trash2, 
  Bed, User, Users as UsersIcon, CheckCircle2, 
  Building2, Calendar, MapPin, Printer, Mail, Send,
  ShieldAlert, Zap, CloudSun, Plane, BarChart3, TrendingDown, Info, AlertTriangle, ShieldCheck
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────
interface RoomingEntry {
  id: string
  pax1: string
  pax1_dietary?: string
  pax2?: string
  pax2_dietary?: string
  type: 'SGL' | 'DBL' | 'TWIN' | 'TPL'
  notes?: string
}

const ROOM_TYPES = [
  { id: 'SGL', label: 'Single', icon: User, pax: 1, color: 'bg-blue-50 text-blue-600' },
  { id: 'DBL', label: 'Double', icon: UsersIcon, pax: 2, color: 'bg-emerald-50 text-emerald-600' },
  { id: 'TWIN', label: 'Twin', icon: Bed, pax: 2, color: 'bg-purple-50 text-purple-600' },
  { id: 'TPL', label: 'Triple', icon: Users, pax: 3, color: 'bg-amber-50 text-amber-600' },
]

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState<'rooming' | 'vouchers' | 'intelligence'>('rooming')
  const [rooming, setRooming] = useState<RoomingEntry[]>([
    { id: '1', pax1: 'MR JAMES HARPER', type: 'SGL' },
    { id: '2', pax1: 'MR ALAN SMITH', pax2: 'MRS JANE SMITH', type: 'DBL' },
    { id: '3', pax1: 'MS SARAH CONNOR', pax2: 'MS LINDA REED', type: 'TWIN' },
  ])

  const stats = useMemo(() => {
    const sgl = rooming.filter(r => r.type === 'SGL').length
    const dbl = rooming.filter(r => r.type === 'DBL' || r.type === 'TWIN').length
    const totalPax = rooming.reduce((acc, r) => acc + (r.type === 'SGL' ? 1 : 2), 0)
    return { sgl, dbl, totalPax }
  }, [rooming])

  const addRoom = (type: 'SGL' | 'DBL' | 'TWIN') => {
    setRooming([...rooming, { id: Date.now().toString(), pax1: '', type }])
  }

  const removeRoom = (id: string) => {
    setRooming(rooming.filter(r => r.id !== id))
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header Panel */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/5 px-8 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold text-slate-900 dark:text-cream tracking-tight">Opérations</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Gestion du circuit · rooming list · vouchers · intelligence</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                <Calendar size={12} /> Nov 2026
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                <MapPin size={12} /> 11 Jours / Maroc
              </div>
            </div>
          </div>

          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border dark:border-white/10">
            <button 
              onClick={() => setActiveTab('rooming')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'rooming' ? 'bg-white dark:bg-slate-800 text-rihla shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-cream'}`}
            >
              <Bed size={14} /> Rooming List
            </button>
            <button 
              onClick={() => setActiveTab('vouchers')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'vouchers' ? 'bg-white dark:bg-slate-800 text-rihla shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-cream'}`}
            >
              <FileCheck size={14} /> Vouchers
            </button>
            <button 
              onClick={() => setActiveTab('intelligence')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'intelligence' ? 'bg-white dark:bg-slate-800 text-rihla shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-cream'}`}
            >
              <Zap size={14} /> Intelligence
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        
        {activeTab === 'rooming' ? (
          <div className="grid grid-cols-12 gap-8">
            
            {/* Left: Rooming Editor */}
            <div className="col-span-8 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-cream flex items-center gap-2">
                    <UsersIcon size={16} className="text-rihla" /> Répartition des Chambres
                  </h3>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10">
                      <Download size={12} className="rotate-180" /> Importer Excel
                    </button>
                    {ROOM_TYPES.slice(0, 3).map(rt => (
                      <button 
                        key={rt.id}
                        onClick={() => addRoom(rt.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all hover:-translate-y-0.5 ${rt.color} dark:bg-opacity-20`}
                      >
                        <Plus size={12} /> {rt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-white/5">
                        <th className="px-6 py-3 w-20">Type</th>
                        <th className="px-6 py-3">Passager(s)</th>
                        <th className="px-6 py-3">Notes</th>
                        <th className="px-6 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {rooming.map((room) => (
                        <tr key={room.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-black ${ROOM_TYPES.find(t => t.id === room.type)?.color} dark:bg-opacity-20`}>
                              {room.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 space-y-2">
                            <div className="flex items-center gap-2">
                               <input 
                                 type="text" 
                                 value={room.pax1} 
                                 onChange={(e) => {
                                   const newRooming = rooming.map(r => r.id === room.id ? { ...r, pax1: e.target.value } : r)
                                   setRooming(newRooming)
                                 }}
                                 placeholder="Nom Passager 1"
                                 className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-cream p-0 placeholder:text-slate-200 dark:placeholder:text-slate-700"
                               />
                               <input 
                                 type="text" 
                                 placeholder="Restauration..."
                                 value={room.pax1_dietary || ''}
                                 onChange={(e) => {
                                   const newRooming = rooming.map(r => r.id === room.id ? { ...r, pax1_dietary: e.target.value } : r)
                                   setRooming(newRooming)
                                 }}
                                 className={clsx(
                                   "w-32 text-[10px] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded px-2 py-0.5 outline-none focus:border-rihla transition-all",
                                   room.pax1_dietary && "border-rihla/30 text-rihla bg-rihla/5 font-bold"
                                 )}
                               />
                            </div>
                            
                            {room.type !== 'SGL' && (
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                 <input 
                                   type="text" 
                                   value={room.pax2} 
                                   onChange={(e) => {
                                     const newRooming = rooming.map(r => r.id === room.id ? { ...r, pax2: e.target.value } : r)
                                     setRooming(newRooming)
                                   }}
                                   placeholder="Nom Passager 2"
                                   className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-cream p-0 placeholder:text-slate-200 dark:placeholder:text-slate-700"
                                 />
                                 <input 
                                   type="text" 
                                   placeholder="Restauration..."
                                   value={room.pax2_dietary || ''}
                                   onChange={(e) => {
                                     const newRooming = rooming.map(r => r.id === room.id ? { ...r, pax2_dietary: e.target.value } : r)
                                     setRooming(newRooming)
                                   }}
                                   className={clsx(
                                     "w-32 text-[10px] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded px-2 py-0.5 outline-none focus:border-rihla transition-all",
                                     room.pax2_dietary && "border-rihla/30 text-rihla bg-rihla/5 font-bold"
                                   )}
                                 />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <input 
                              type="text" 
                              placeholder="Ex: VIP, Allergies..."
                              className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-400 p-0"
                            />
                          </td>
                          <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => removeRoom(room.id)} className="text-slate-300 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <p className="text-xs text-slate-400">Total : {rooming.length} chambres sélectionnées</p>
                  <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 hover:bg-white transition-all">
                      <Printer size={14} /> Imprimer Listes
                    </button>
                    <button className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                      <Download size={14} /> Télécharger Rooming (XLS)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Stats & Summary */}
            <div className="col-span-4 space-y-6">
              <div className="bg-ink rounded-2xl p-6 text-cream shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Hotel size={80} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-6">Récapitulatif PAX</h3>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[10px] text-white/40 uppercase mb-1">Singles</p>
                    <p className="text-2xl font-black text-blue-400">{stats.sgl}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[10px] text-white/40 uppercase mb-1">Doubles/Twins</p>
                    <p className="text-2xl font-black text-emerald-400">{stats.dbl}</p>
                  </div>
                </div>
                <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase mb-1">Total Passagers</p>
                    <p className="text-3xl font-black">{stats.totalPax} PAX</p>
                  </div>
                  <CheckCircle2 size={32} className="text-emerald-500/30" />
                </div>
              </div>

              {/* Financial Impact Panel */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Impact Financier</h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-black uppercase">Live</span>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Suppléments Single (x{stats.sgl})</span>
                    <span className="font-bold text-slate-700">+{stats.sgl * 450} MAD</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Ventes (Chambres)</span>
                    <span className="font-bold text-slate-700">{(stats.totalPax * 1200).toLocaleString()} MAD</span>
                  </div>
                </div>
                <div className="p-4 bg-slate-900 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Marge Estimeé</span>
                    <span className="text-lg font-black text-emerald-400">+18.5%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Actions Logistiques</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-rihla-50 hover:border-rihla/30 transition-all text-xs font-bold text-slate-600">
                    <div className="flex items-center gap-2">
                      <Send size={14} className="text-rihla" />
                      <span>Envoyer tous les Vouchers</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-300" />
                  </button>
                  <button className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-rihla-50 hover:border-rihla/30 transition-all text-xs font-bold text-slate-600">
                    <div className="flex items-center gap-2">
                      <Download size={14} className="text-rihla" />
                      <span>Générer Manifeste Transport</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-300" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'vouchers' ? (
          /* Vouchers View */
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-8 shadow-sm text-center">
              <FileCheck size={48} className="mx-auto text-slate-200 dark:text-white/10 mb-4" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-cream">Générateur de Vouchers</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Préparez les bons d'échange pour tous les prestataires du circuit.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {[
                { provider: 'Hôtel Movenpick Casablanca', service: 'Hébergement (1 nuit)', date: '01 Nov', status: 'Ready' },
                { provider: 'Restaurant Rick’s Café', service: 'Dîner Gastronomique', date: '01 Nov', status: 'Sent' },
                { provider: 'Transport S’TOURS Fleet', service: 'Circuit 11 jours', date: '01-11 Nov', status: 'Draft' },
                { provider: 'Guide National (Mr. Ahmed)', service: 'Accompagnement', date: '01-11 Nov', status: 'Ready' },
              ].map((v, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400">
                      {v.service.includes('Hôtel') ? <Hotel size={20} /> : <FileCheck size={20} />}
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${v.status === 'Sent' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {v.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-cream truncate">{v.provider}</h4>
                  <p className="text-xs text-slate-400 mt-1">{v.service}</p>
                  <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">{v.date}</span>
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 transition-colors"><Printer size={14} /></button>
                      <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 transition-colors"><Mail size={14} /></button>
                      <button className="px-3 py-1.5 bg-rihla text-white text-[10px] font-bold rounded-lg shadow-md">ÉDITER</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Intelligence View */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-4 gap-6">
                <div className="col-span-3 space-y-6">
                   <div className="bg-slate-900 rounded-3xl p-8 border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-12 opacity-5">
                         <BarChart3 size={120} className="text-rihla" />
                      </div>
                      <div className="relative z-10">
                         <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-rihla/20 flex items-center justify-center text-rihla">
                               <ShieldAlert size={24} />
                            </div>
                            <div>
                               <h3 className="text-lg font-black text-white">Project Health Index</h3>
                               <p className="text-xs text-white/40 font-medium tracking-wide uppercase">Analyse prédictive en temps réel</p>
                            </div>
                         </div>
                         
                         <div className="flex items-end gap-6 mb-12">
                            <div className="text-7xl font-black text-white tracking-tighter">94%</div>
                            <div className="pb-2 space-y-1">
                               <div className="flex items-center gap-2 text-emerald-500 font-black text-xs uppercase">
                                  <TrendingDown className="rotate-180" size={14} /> +2.4% vs hier
                               </div>
                               <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Confiance Opérationnelle</p>
                            </div>
                         </div>

                         <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/5">
                            <div className="space-y-2">
                               <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Risque Prestataires</p>
                               <p className="text-sm font-bold text-emerald-400">Très Faible</p>
                            </div>
                            <div className="space-y-2">
                               <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Alerte Météo</p>
                               <p className="text-sm font-bold text-amber-400">1 Vigilance (Fès)</p>
                            </div>
                            <div className="space-y-2">
                               <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Logistique Vol</p>
                               <p className="text-sm font-bold text-emerald-400">À l'heure</p>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-3xl">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <CloudSun size={14} className="text-amber-500" /> Moniteur Météo Terrain
                         </h4>
                         <div className="space-y-4">
                            {[
                              { city: "Casablanca", temp: "22°C", condition: "Ensoleillé", status: "OK" },
                              { city: "Fès", temp: "18°C", condition: "Pluie modérée", status: "Ajuster" },
                              { city: "Marrakech", temp: "26°C", condition: "Dégagé", status: "OK" },
                            ].map((w, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                 <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-700 dark:text-cream">{w.city}</span>
                                    <span className="text-[10px] text-slate-400">{w.temp}</span>
                                 </div>
                                 <span className={`text-[9px] font-black px-2 py-0.5 rounded ${w.status === 'OK' ? 'text-emerald-500' : 'bg-amber-500 text-white'}`}>
                                    {w.status}
                                 </span>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-3xl">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Plane size={14} className="text-blue-500" /> Suivi Aérien (Arrivées)
                         </h4>
                         <div className="space-y-4">
                            {[
                              { flight: "AT 761", from: "Paris CDG", time: "14:20", status: "Arrivé" },
                              { flight: "AF 1496", from: "London LHR", time: "15:45", status: "En vol" },
                              { flight: "TK 617", from: "Istanbul", time: "18:10", status: "À l'heure" },
                            ].map((f, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                 <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-slate-700 dark:text-cream">{f.flight}</span>
                                    <span className="text-[10px] text-slate-400">{f.from}</span>
                                 </div>
                                 <span className="text-[10px] font-bold text-slate-500">{f.time}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>

                <div className="col-span-1 space-y-6">
                   <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-3xl space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matrice des Risques</h4>
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                               <span className="text-slate-500 uppercase">Capacité Hôtelière</span>
                               <span className="text-emerald-500">OPTIMAL</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-emerald-500" style={{ width: '92%' }} />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                               <span className="text-slate-500 uppercase">Dispo Chauffeurs</span>
                               <span className="text-amber-500">TENDU</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-amber-500" style={{ width: '65%' }} />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-black">
                               <span className="text-slate-500 uppercase">Score Prestataires</span>
                               <span className="text-emerald-500">8.9/10</span>
                            </div>
                         </div>
                      </div>
                      
                      <div className="p-4 bg-rihla/5 border border-rihla/10 rounded-2xl">
                         <div className="flex items-center gap-2 text-rihla font-black text-[10px] uppercase mb-2">
                            <Info size={12} /> Action IA suggérée
                         </div>
                         <p className="text-[11px] text-slate-500 italic leading-relaxed">
                            "Le Riad Fès signale un évènement privé. Vérifier le calme des chambres 102-105 ou demander surclassement."
                         </p>
                      </div>
                   </div>

                   <div className="bg-emerald-500 rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/20">
                      <ShieldCheck size={32} className="mb-4 opacity-50" />
                      <h4 className="text-sm font-black mb-2">Certification Qualité</h4>
                      <p className="text-[10px] text-white/80 font-medium leading-relaxed uppercase tracking-wider">
                         Ce dossier respecte 100% des standards de sécurité S'TOURS.
                      </p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChevronRight({ size, className }: { size: number, className: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="9 18 15 12 9 6" /></svg>
}

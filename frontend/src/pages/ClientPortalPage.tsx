import { useState, useMemo } from 'react'
import { 
  Users, Package, FileText, Banknote, 
  ChevronRight, Calendar, MessageSquare, 
  Download, Clock, CheckCircle2, ShieldCheck,
  Building2, ExternalLink, X, Navigation
} from 'lucide-react'
import { projectsApi, invoicesApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'

// ── Mock Agencies ─────────────────────────────────────────────────
const AGENCIES = [
  { id: 'ag-1', name: 'Travel Agency XYZ', contact: 'John Doe', logo: 'TA' },
  { id: 'ag-2', name: 'Prestige Tours Paris', contact: 'Marie Lefebvre', logo: 'PT' },
  { id: 'ag-3', name: 'US Adventure Co.', contact: 'Sarah Miller', logo: 'UA' },
]

export function ClientPortalPage() {
  const [selectedAgency, setSelectedAgency] = useState(AGENCIES[0])
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string[]>>({
    '2': ['Pouvez-vous confirmer si le déjeuner est inclus ?'],
  })

  // Fetch all projects and invoices, then filter by client_name
  const { data: allProjects, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => r.data?.items ?? [])
  })

  const { data: allInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list({ limit: 100 }).then(r => r.data)
  })

  // Filter data for the "logged in" agency
  const agencyProjects = useMemo(() => 
    allProjects?.filter((p: any) => p.client_name === selectedAgency.name) || [],
  [allProjects, selectedAgency])

  const agencyInvoices = useMemo(() => 
    allInvoices?.filter((i: any) => i.client_name === selectedAgency.name) || [],
  [allInvoices, selectedAgency])

  const totalDue = agencyInvoices.reduce((a: number, i: any) => i.status !== 'paid' ? a + Number(i.total) : a, 0)

  const addComment = (dayId: string, text: string) => {
    setComments(prev => ({
      ...prev,
      [dayId]: [...(prev[dayId] || []), text]
    }))
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex overflow-hidden">
      
      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        
        {/* Top Bar (Switcher) */}
        <div className="bg-slate-900 px-8 py-2 flex justify-between items-center text-white/40 text-[9px] font-black uppercase tracking-widest shrink-0">
          <div className="flex items-center gap-4">
            <ShieldCheck size={12} className="text-emerald-500" />
            Accès Sécurisé B2B · {selectedAgency.name}
          </div>
          <div className="flex items-center gap-2">
            <span>Simuler :</span>
            {AGENCIES.map(ag => (
              <button 
                key={ag.id} 
                onClick={() => setSelectedAgency(ag)}
                className={clsx("px-2 py-0.5 rounded", selectedAgency.id === ag.id ? "bg-white/10 text-white" : "hover:text-white")}
              >
                {ag.logo}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-40 shrink-0 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-rihla/10 flex items-center justify-center text-rihla font-black text-xl">
                {selectedAgency.logo}
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{selectedAgency.name}</h1>
                <p className="text-xs text-slate-500 font-bold mt-1 flex items-center gap-2 uppercase tracking-wider">
                  <Clock size={12} /> Dossier Actif : <span className="text-rihla">Grand Tour Maroc #ST-9921</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-5 py-2.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2">
                <FileText size={14} /> Devis PDF
              </button>
              <button className="px-6 py-2.5 bg-rihla text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-rihla/20 hover:scale-105 transition-all">
                Valider & Signer
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto grid grid-cols-12 gap-8">
            
            {/* Timeline (Collaborative) */}
            <div className="col-span-8 space-y-6">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Itinéraire Dynamique</h3>
                 <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[9px] font-black rounded uppercase">Live Sync</span>
               </div>
               
               <div className="space-y-6">
                {[
                  { id: '1', day: 'Jour 1', city: 'Marrakech', title: 'Accueil & Installation', desc: 'Transfert VIP et dîner de bienvenue au Palais Ronsard.' },
                  { id: '2', day: 'Jour 2', city: 'Marrakech', title: 'Secrets de la Médina', desc: 'Visite privée avec historien et déjeuner traditionnel en terrasse.' },
                  { id: '3', day: 'Jour 3', city: 'Agafay', title: 'Désert & Étoiles', desc: 'Safari 4x4 et nuit sous tente de luxe dans le désert d\'Agafay.' },
                ].map((item) => (
                  <div key={item.id} className="relative pl-10 group">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200 group-last:bg-transparent" />
                    <div className="absolute left-0 top-2 w-6 h-6 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:border-rihla group-hover:text-rihla transition-colors">
                      {item.id}
                    </div>
                    
                    <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm group-hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[9px] font-black text-rihla uppercase tracking-widest">{item.city}</span>
                          <h4 className="text-base font-black text-slate-800 mt-1">{item.title}</h4>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setActiveChat(item.id)}
                            className={clsx(
                              "w-10 h-10 rounded-2xl flex items-center justify-center transition-all relative",
                              comments[item.id] ? "bg-rihla text-white shadow-lg shadow-rihla/30" : "bg-slate-50 text-slate-400 hover:text-rihla hover:bg-rihla/5"
                            )}
                          >
                            <MessageSquare size={16} />
                            {comments[item.id] && <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-[9px] flex items-center justify-center rounded-full font-black border-2 border-white">{comments[item.id].length}</span>}
                          </button>
                          <button className="w-10 h-10 bg-slate-50 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-2xl flex items-center justify-center transition-all">
                            <CheckCircle2 size={16} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
               </div>
            </div>

            {/* Sidebar Stats/Docs */}
            <div className="col-span-4 space-y-6">
               <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
                 <h4 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-4">Finance</h4>
                 <div className="space-y-4">
                   <div>
                     <p className="text-2xl font-black text-slate-900">{totalDue.toLocaleString()} <span className="text-xs text-slate-400">MAD</span></p>
                     <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Paiement attendu le 15/05</p>
                   </div>
                   <button className="w-full py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-rihla transition-all">
                     Payer par Carte / Virement
                   </button>
                 </div>
               </div>

               <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
                 <h4 className="font-black text-[10px] uppercase text-slate-400 tracking-widest mb-4">Gestionnaire S'TOURS</h4>
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rihla to-rihla-dark flex items-center justify-center text-white font-black">ST</div>
                    <div>
                      <p className="text-xs font-black text-slate-900">Yassine E.</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Senior Designer</p>
                    </div>
                 </div>
                 <button className="w-full mt-4 py-3 border border-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                   <MessageSquare size={14} /> Chat en direct
                 </button>
               </div>
            </div>

          </div>
        </div>

      </div>

      {/* ── COLLABORATION PANEL ────────────────────────────── */}
      <div className={clsx(
        "w-[400px] bg-white border-l border-slate-200 flex flex-col transition-all duration-500 ease-in-out z-50 shadow-2xl",
        activeChat ? "translate-x-0" : "translate-x-full absolute right-0"
      )}>
        {activeChat && (
          <>
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-md">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest italic">Genius Collaboration</h4>
                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Commentaires Jour {activeChat}</p>
              </div>
              <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* S'TOURS Agent Message */}
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-2xl bg-rihla flex items-center justify-center text-white font-black text-[10px] shrink-0 shadow-lg shadow-rihla/20">ST</div>
                <div className="flex-1">
                  <div className="bg-slate-100 p-4 rounded-[24px] rounded-tl-none">
                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                      Bonjour John ! J'ai ajouté une option pour un déjeuner chez l'habitant à Chefchaouen. Qu'en pensez-vous pour vos clients ?
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold mt-2 block uppercase tracking-tighter">S'TOURS Designer · 10:45</span>
                </div>
              </div>

              {/* Client Messages */}
              {(comments[activeChat] || []).map((msg, i) => (
                <div key={i} className="flex gap-3 flex-row-reverse">
                  <div className="w-9 h-9 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-[10px] shrink-0">CL</div>
                  <div className="flex-1">
                    <div className="bg-rihla text-white p-4 rounded-[24px] rounded-tr-none shadow-lg shadow-rihla/20">
                      <p className="text-[11px] leading-relaxed font-bold">{msg}</p>
                    </div>
                    <span className="text-[9px] text-rihla font-bold mt-2 block uppercase tracking-tighter text-right">Vous · À l'instant</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 border-t border-slate-100 bg-white">
              <div className="relative">
                <textarea 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (e.currentTarget.value.trim()) {
                        addComment(activeChat!, e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }
                  }}
                  placeholder="Posez une question ou demandez une modification..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-[28px] p-5 text-xs text-slate-900 outline-none focus:border-rihla focus:ring-4 focus:ring-rihla/5 transition-all resize-none h-28 font-medium"
                />
                <button className="absolute bottom-4 right-4 bg-rihla text-white p-2 rounded-xl shadow-lg shadow-rihla/20">
                  <Navigation size={14} className="rotate-90" />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 font-black uppercase text-center mt-4 tracking-widest">Discussion sécurisée et archivée</p>
            </div>
          </>
        )}
      </div>

    </div>
  )
}

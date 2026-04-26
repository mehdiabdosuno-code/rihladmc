import { useState } from 'react'
import { 
  BarChart3, Star, MessageSquare, ThumbsUp, 
  ThumbsDown, TrendingUp, AlertCircle, 
  Search, Filter, ChevronRight, User, 
  Building2, Compass, Smile, Frown, Brain
} from 'lucide-react'

// ── Mock Feedback Data ──────────────────────────────────────────
const FEEDBACKS = [
  { id: 'F01', project: 'Grand Tour Morocco', client: 'Travel Agency XYZ', rating: 5, sentiment: 'Positive', comment: "Le guide Ahmed était exceptionnel. L'hôtel à Ouarzazate était un peu daté mais propre.", date: 'Il y a 2 jours' },
  { id: 'F02', project: 'Atlas Trekking', client: 'Nordic Adventures', rating: 4, sentiment: 'Positive', comment: "Excellente organisation. Les tentes étaient de grande qualité. Cuisine locale délicieuse.", date: 'Il y a 4 jours' },
  { id: 'F03', project: 'Marrakech Weekend', client: 'Prestige Tours Paris', rating: 2, sentiment: 'Negative', comment: "Retard au transfert de l'aéroport (30min). Le riad était bruyant à cause des travaux voisins.", date: 'Il y a 1 semaine' },
]

export function QualityPage() {
  const [activeTab, setActiveTab] = useState<'feedbacks' | 'ranking'>('feedbacks')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 shadow-inner">
              <Star size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-cream">Qualité & Satisfaction</h1>
              <p className="text-slate-400 text-xs mt-0.5 uppercase tracking-widest font-bold">Analyse NPS & Retours Clients</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border dark:border-white/10">
              <button 
                onClick={() => setActiveTab('feedbacks')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === 'feedbacks' ? 'bg-white dark:bg-slate-800 text-rihla shadow-sm' : 'text-slate-400'}`}
              >
                Feedbacks
              </button>
              <button 
                onClick={() => setActiveTab('ranking')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === 'ranking' ? 'bg-white dark:bg-slate-800 text-rihla shadow-sm' : 'text-slate-400'}`}
              >
                Classements
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        
        {/* NPS Overview */}
        <div className="grid grid-cols-4 gap-6 mb-10">
          <div className="col-span-2 bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Net Promoter Score Global</p>
              <div className="flex items-end gap-4">
                <p className="text-6xl font-black text-emerald-400">74</p>
                <div className="mb-2">
                  <p className="text-xs font-bold text-emerald-400">+5 points ce mois</p>
                  <p className="text-[10px] text-white/30 uppercase font-bold">Excellent</p>
                </div>
              </div>
              <div className="mt-8 flex gap-8">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-xs font-bold text-white/60">Promoteurs: 82%</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <p className="text-xs font-bold text-white/60">Passifs: 10%</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <p className="text-xs font-bold text-white/60">Détracteurs: 8%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-500">
                  <Brain size={20} />
                </div>
                <span className="text-[10px] font-black text-violet-500 uppercase">AI Insights</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                "La ponctualité des transferts est le levier majeur pour passer à un NPS de 80."
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 mb-4">
                <AlertCircle size={20} />
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-cream">3</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Litiges à traiter</p>
            </div>
          </div>
        </div>

        {activeTab === 'feedbacks' ? (
          <div className="space-y-4">
            <h3 className="font-black text-slate-800 dark:text-cream flex items-center gap-2 mb-4">
              <MessageSquare size={18} className="text-amber-500" /> Derniers Témoignages
            </h3>
            {FEEDBACKS.map(f => (
              <div key={f.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${f.sentiment === 'Positive' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
                    {f.sentiment === 'Positive' ? <Smile size={24} /> : <Frown size={24} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-cream">{f.project}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{f.client} • {f.date}</p>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={14} fill={s <= f.rating ? 'currentColor' : 'none'} className={s <= f.rating ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                      "{f.comment}"
                    </p>
                  </div>
                  <button className="self-center p-3 text-slate-300 hover:text-rihla opacity-0 group-hover:opacity-100 transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            {/* Top Hotels */}
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="font-black text-slate-800 dark:text-cream mb-6 flex items-center gap-2">
                <Building2 size={18} className="text-emerald-500" /> Top Hébergements
              </h3>
              <div className="space-y-4">
                {[
                  { name: 'La Mamounia', score: 4.9, status: 'VIP Choice' },
                  { name: 'Palais Namaskar', score: 4.8, status: 'Premium' },
                  { name: 'Riad Fes', score: 4.7, status: 'Authentic' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-300">#0{i+1}</span>
                      <p className="font-bold text-xs text-slate-700 dark:text-slate-300">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded">{item.status}</span>
                      <span className="font-black text-slate-800 dark:text-cream text-sm">{item.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Guides */}
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="font-black text-slate-800 dark:text-cream mb-6 flex items-center gap-2">
                <Compass size={18} className="text-amber-500" /> Top Guides
              </h3>
              <div className="space-y-4">
                {[
                  { name: 'Ahmed El Mansouri', score: 5.0, trips: 24 },
                  { name: 'Fatima Zahra', score: 4.9, trips: 18 },
                  { name: 'Youssef Ait Taleb', score: 4.8, trips: 31 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-300">#0{i+1}</span>
                      <p className="font-bold text-xs text-slate-700 dark:text-slate-300">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <p className="text-[9px] font-bold text-slate-400 uppercase text-right leading-tight">
                        {item.trips} circuits<br/>réalisés
                      </p>
                      <span className="font-black text-slate-800 dark:text-cream text-sm">{item.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

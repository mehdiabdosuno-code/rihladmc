import { useState, useEffect } from 'react'
import { 
  Sparkles, X, ChevronRight, Lightbulb, 
  TrendingUp, Truck, Map, Zap, MessageSquare,
  Bot, AlertCircle, ArrowRight
} from 'lucide-react'
import { clsx } from 'clsx'

interface Insight {
  id: string
  type: 'upsell' | 'logistic' | 'expert'
  title: string
  description: string
  action: string
  impact: string
}

const MOCK_INSIGHTS: Insight[] = [
  {
    id: '1',
    type: 'upsell',
    title: 'Opportunité de Marge : Montgolfière',
    description: 'Le groupe "Nordic Stars" séjourne 3 nuits à Marrakech. Les conditions météo sont optimales.',
    action: 'Ajouter survol VIP',
    impact: '+450€ Marge'
  },
  {
    id: '2',
    type: 'logistic',
    title: 'Alerte Capacité Véhicule',
    description: 'Le dossier "Prestige Paris" est passé à 16 PAX. Le Minibus actuel (17 places) sera trop limite pour les bagages.',
    action: 'Passer au Bus 24',
    impact: 'Sécurité Client'
  },
  {
    id: '3',
    type: 'expert',
    title: 'Événement Local : Festival des Roses',
    description: 'Le passage à Kelaat M\'Gouna coïncide avec le festival annuel le 12 Mai.',
    action: 'Modifier Itinéraire',
    impact: 'Expérience WOW'
  }
]

export function GeniusAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const toggleOpen = () => {
    setIsOpen(!isOpen)
    if (!isOpen && insights.length === 0) {
      triggerAnalysis()
    }
  }

  const triggerAnalysis = () => {
    setIsAnalyzing(true)
    setTimeout(() => {
      setInsights(MOCK_INSIGHTS)
      setIsAnalyzing(false)
    }, 2000)
  }

  return (
    <>
      {/* ── FLOATING TRIGGER ───────────────────────────────────── */}
      <button 
        onClick={toggleOpen}
        className={clsx(
          "fixed bottom-24 right-8 z-[100] w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group overflow-hidden",
          isOpen ? "bg-white text-rihla scale-90 rotate-90" : "bg-gradient-to-br from-rihla to-rihla-dark text-white shadow-[0_0_20px_rgba(22,40,169,0.4)] hover:scale-110"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        {isOpen ? <X size={24} /> : <Bot size={28} className="animate-pulse" />}
      </button>

      {/* ── GENIUS PANEL ───────────────────────────────────────── */}
      <div className={clsx(
        "fixed top-24 bottom-24 right-8 w-[400px] bg-[#0A0F1D]/95 backdrop-blur-2xl border border-white/10 rounded-[40px] z-[99] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-500 ease-out flex flex-col overflow-hidden",
        isOpen ? "translate-x-0 opacity-100 scale-100" : "translate-x-[450px] opacity-0 scale-95 pointer-events-none"
      )}>
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-gradient-to-br from-rihla/10 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rihla flex items-center justify-center text-white">
              <Zap size={18} fill="currentColor" />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight uppercase italic">
              S'TOURS <span className="text-rihla-light">Genius</span>
            </h3>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Assistant de Vente & Optimisation
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isAnalyzing ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-rihla/20 border-t-rihla animate-spin" />
                <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-rihla" size={24} />
              </div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">Analyse des dossiers en cours...</p>
            </div>
          ) : (
            insights.map((insight) => (
              <div 
                key={insight.id}
                className="group p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-rihla/40 transition-all hover:bg-white/[0.05]"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={clsx(
                    "px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-wider",
                    insight.type === 'upsell' ? "bg-emerald-500/10 text-emerald-400" :
                    insight.type === 'logistic' ? "bg-amber-500/10 text-amber-400" :
                    "bg-cyan-500/10 text-cyan-400"
                  )}>
                    {insight.type === 'upsell' ? 'Augmentation Marge' : 
                     insight.type === 'logistic' ? 'Logistique' : 'Expertise Terrain'}
                  </div>
                  <span className="text-[9px] font-black text-rihla-light">{insight.impact}</span>
                </div>
                
                <h4 className="text-sm font-bold text-white mb-2 leading-tight group-hover:text-rihla-light transition-colors">
                  {insight.title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {insight.description}
                </p>

                <button className="w-full py-2.5 bg-white/5 group-hover:bg-rihla text-white text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2">
                  {insight.action} <ArrowRight size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer / Input */}
        <div className="p-6 bg-white/[0.02] border-t border-white/5">
          <div className="flex items-center gap-2 bg-white/5 p-3 rounded-2xl border border-white/10">
            <MessageSquare size={16} className="text-slate-500" />
            <input 
              type="text" 
              placeholder="Posez une question à Genius..." 
              className="bg-transparent border-none text-[11px] text-white outline-none flex-1 font-medium"
            />
          </div>
        </div>

      </div>
    </>
  )
}

import { FinancialHub } from '@/components/finance/FinancialHub'
import { 
  Briefcase, TrendingUp, DollarSign, 
  ChevronRight, Calendar, User
} from 'lucide-react'

export function FinancialStrategyPage() {
  // Mock data for a typical Luxury Morocco Tour
  const tourData = {
    totalCost: 154500, // Coût réel agence
    totalSell: 185000, // Prix de vente initial
    paxBasis: 12,
    currency: 'MAD'
  }

  return (
    <div className="min-h-screen bg-warm-yellow dark:bg-slate-950 p-8 transition-colors">
      
      {/* ── BREADCRUMBS & HEADER ───────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
          Projets <ChevronRight size={10} /> 
          PRJ-2024-088 <ChevronRight size={10} /> 
          <span className="text-slate-900 dark:text-cream">Stratégie Financière</span>
        </div>
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter">
              Optimisation des Marges
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-medium">
              Projet : <span className="text-rihla font-bold">Légendes Impériales & Désert VIP</span> — Groupe Mr. Henderson
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-rihla/10 flex items-center justify-center text-rihla">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Dates</p>
                <p className="text-xs font-bold text-slate-900 dark:text-cream">14 - 22 Nov 2024</p>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <User size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Travel Designer</p>
                <p className="text-xs font-bold text-slate-900 dark:text-cream">Sarah Alami</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── THE FINANCIAL HUB ───────────────────────────────────── */}
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">
        
        <div className="col-span-12 xl:col-span-8">
          <FinancialHub 
            totalCost={tourData.totalCost}
            totalSell={tourData.totalSell}
            paxBasis={tourData.paxBasis}
            currency={tourData.currency}
          />
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-white/10 shadow-sm">
            <h3 className="text-lg font-black mb-6 flex items-center gap-2">
              <TrendingUp className="text-emerald-500" size={20} />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full py-4 px-6 bg-slate-50 dark:bg-white/5 hover:bg-rihla hover:text-white border border-slate-100 dark:border-white/10 rounded-2xl text-left transition-all group">
                <p className="text-[10px] font-black text-slate-400 group-hover:text-white/60 uppercase tracking-widest mb-1">Option A</p>
                <p className="text-sm font-bold">Augmenter commission transport</p>
              </button>
              <button className="w-full py-4 px-6 bg-slate-50 dark:bg-white/5 hover:bg-rihla hover:text-white border border-slate-100 dark:border-white/10 rounded-2xl text-left transition-all group">
                <p className="text-[10px] font-black text-slate-400 group-hover:text-white/60 uppercase tracking-widest mb-1">Option B</p>
                <p className="text-sm font-bold">Appliquer forfait "Conciergerie VIP"</p>
              </button>
              <button className="w-full py-4 px-6 bg-slate-50 dark:bg-white/5 hover:bg-rihla hover:text-white border border-slate-100 dark:border-white/10 rounded-2xl text-left transition-all group">
                <p className="text-[10px] font-black text-slate-400 group-hover:text-white/60 uppercase tracking-widest mb-1">Option C</p>
                <p className="text-sm font-bold">Passer en monnaie USD (Hedge)</p>
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-rihla p-8 rounded-[32px] text-white shadow-xl shadow-rihla/20">
            <Briefcase size={32} className="mb-6 text-white/30" />
            <h3 className="text-xl font-black mb-2 tracking-tight">Prêt pour l'envoi ?</h3>
            <p className="text-white/60 text-sm mb-8 leading-relaxed font-medium">
              Toutes les marges sont vérifiées. Vous pouvez maintenant générer le document de proposition avec le "Document Studio".
            </p>
            <button className="w-full py-4 bg-white text-rihla font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl active:scale-95 transition-all">
              Générer la Proposition
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}

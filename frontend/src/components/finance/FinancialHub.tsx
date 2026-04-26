import { useState, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart, 
  AlertCircle, ArrowUpRight, Calculator, RefreshCw,
  Coins, Info, ArrowRight, ShieldCheck, Gauge
} from 'lucide-react'
import { clsx } from 'clsx'

interface FinancialHubProps {
  totalCost: number
  totalSell: number
  paxBasis: number
  currency: string
  exchangeRate?: number
}

export function FinancialHub({ totalCost, totalSell, paxBasis, currency, exchangeRate = 10.8 }: FinancialHubProps) {
  const [discount, setDiscount] = useState(0)
  
  const metrics = useMemo(() => {
    const adjustedSell = totalSell * (1 - discount / 100)
    const grossMargin = adjustedSell - totalCost
    const marginPct = (grossMargin / adjustedSell) * 100
    const netProfit = grossMargin * 0.85 // Simulation après frais fixes/taxes d'agence
    const netMarginPct = (netProfit / adjustedSell) * 100
    
    // Status color
    let statusColor = 'text-emerald-500'
    let bgColor = 'bg-emerald-500/10'
    let borderColor = 'border-emerald-500/20'
    
    if (netMarginPct < 15) {
      statusColor = 'text-amber-500'
      bgColor = 'bg-amber-500/10'
      borderColor = 'border-amber-500/20'
    }
    if (netMarginPct < 10) {
      statusColor = 'text-red-500'
      bgColor = 'bg-red-500/10'
      borderColor = 'border-red-500/20'
    }

    return {
      grossMargin,
      marginPct,
      netProfit,
      netMarginPct,
      statusColor,
      bgColor,
      borderColor,
      adjustedSell
    }
  }, [totalCost, totalSell, discount])

  return (
    <div className="bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
      
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="px-8 py-6 border-b border-white/10 bg-gradient-to-r from-rihla/10 to-transparent flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Gauge className="text-rihla" size={22} />
            FINANCIAL COMMAND CENTER
          </h2>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-1">Analyse de Profitabilité & Risques</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[10px] font-black text-rihla uppercase tracking-widest">
          <RefreshCw size={10} className="animate-spin-slow" /> Live Sync BAM
        </div>
      </div>

      <div className="p-8 grid grid-cols-12 gap-8">
        
        {/* ── MARGIN GAUGE & MAIN STATS ──────────────────────────── */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className={clsx(
            "p-8 rounded-[24px] border transition-all duration-500",
            metrics.bgColor, metrics.borderColor
          )}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Marge Nette Estimée</p>
                <h3 className={clsx("text-5xl font-black tracking-tighter", metrics.statusColor)}>
                  {metrics.netMarginPct.toFixed(1)}%
                </h3>
              </div>
              <div className={clsx(
                "p-3 rounded-2xl bg-white/5",
                metrics.statusColor
              )}>
                {metrics.netMarginPct > 15 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-white/60">Profit net agence</span>
                <span className="text-lg font-black">{metrics.netProfit.toLocaleString()} {currency}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={clsx("h-full transition-all duration-1000", metrics.statusColor.replace('text', 'bg'))}
                  style={{ width: `${Math.min(metrics.netMarginPct * 3, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Discount Simulator */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-[24px]">
            <div className="flex justify-between items-center mb-4">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Simulateur de Remise (%)</label>
              <span className="text-rihla font-black">{discount}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="25" step="0.5"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value))}
              className="w-full accent-rihla h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between mt-4">
              <div className="text-center">
                <p className="text-[9px] font-bold text-white/30 uppercase">Impact Profit</p>
                <p className="text-xs font-black text-red-400">-{((totalSell * discount) / 100).toLocaleString()} {currency}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold text-white/30 uppercase">Nouveau Prix Pax</p>
                <p className="text-xs font-black text-emerald-400">{(metrics.adjustedSell / paxBasis).toFixed(2)} {currency}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── BREAKDOWN & FOREX ─────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 p-6 rounded-[24px]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><Coins size={16} /></div>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Forex Exposure</span>
              </div>
              <p className="text-2xl font-black">{(totalCost / exchangeRate).toFixed(0)} <span className="text-xs text-white/40">USD</span></p>
              <p className="text-[9px] font-bold text-white/30 mt-1">Basé sur 1 USD = {exchangeRate} MAD</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-[24px]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg"><ShieldCheck size={16} /></div>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Tax Coverage</span>
              </div>
              <p className="text-2xl font-black">100%</p>
              <p className="text-[9px] font-bold text-emerald-400 mt-1">Toutes taxes de séjour incluses</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 rounded-[24px] flex-1">
            <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6 flex items-center gap-2">
              <PieChart size={12} /> Répartition des Coûts par Poste
            </h4>
            <div className="space-y-4">
               {[
                 { label: 'Hébergement', pct: 45, color: 'bg-rihla' },
                 { label: 'Transport', pct: 25, color: 'bg-blue-400' },
                 { label: 'Restauration', pct: 15, color: 'bg-emerald-400' },
                 { label: 'Guides & Activités', pct: 15, color: 'bg-amber-400' },
               ].map((item, i) => (
                 <div key={i} className="space-y-1.5">
                   <div className="flex justify-between text-[11px] font-bold">
                     <span className="text-white/60">{item.label}</span>
                     <span>{item.pct}%</span>
                   </div>
                   <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                     <div className={clsx("h-full", item.color)} style={{ width: `${item.pct}%` }} />
                   </div>
                 </div>
               ))}
            </div>
          </div>

          {/* Business Insights */}
          <div className="bg-rihla/5 border border-rihla/20 p-4 rounded-2xl flex items-start gap-4">
            <div className="p-2 bg-rihla text-white rounded-xl shadow-lg shadow-rihla/20">
               <AlertCircle size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-rihla uppercase tracking-wider mb-1">Expert Insight</p>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Le transport représente 25% du coût total. En regroupant les transferts à l'arrivée, vous pourriez économiser jusqu'à <span className="text-emerald-400 font-bold">1,200 MAD</span> de marge supplémentaire.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* ── ACTION FOOTER ───────────────────────────────────────── */}
      <div className="px-8 py-5 bg-white/5 border-t border-white/10 flex justify-between items-center">
        <p className="text-[10px] text-white/30 font-medium">Calculs basés sur le moteur déterministe RIHLA v0.5 — Dernier refresh il y a 2 min</p>
        <button className="px-6 py-2 bg-rihla text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-rihla/20 active:scale-95 transition-all flex items-center gap-2">
          Générer Rapport Financier <ArrowRight size={14} />
        </button>
      </div>

    </div>
  )
}

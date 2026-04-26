import { useState, useEffect } from 'react'
import { 
  TrendingUp, TrendingDown, AlertTriangle, 
  RefreshCw, Activity, ArrowUpRight, ArrowDownRight,
  DollarSign, Shield, Zap, Target
} from 'lucide-react'

// ── Simulated Live Rates (in a real app, fetched from an FX API) ──
const BASE_RATES: Record<string, number> = {
  'EUR/MAD': 10.82,
  'USD/MAD': 9.91,
  'GBP/MAD': 12.54,
  'CHF/MAD': 11.20,
}

function useSimulatedRates() {
  const [rates, setRates] = useState(BASE_RATES)
  const [history, setHistory] = useState<Record<string, number[]>>(() => {
    const h: Record<string, number[]> = {}
    Object.entries(BASE_RATES).forEach(([k, v]) => {
      h[k] = Array.from({ length: 30 }, (_, i) => v + (Math.random() - 0.5) * 0.4)
    })
    return h
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setRates(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => {
          const delta = (Math.random() - 0.5) * 0.02
          next[k] = parseFloat((next[k] + delta).toFixed(4))
        })
        return next
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return { rates, history }
}

const ALERT_THRESHOLDS: Record<string, { min: number; max: number }> = {
  'EUR/MAD': { min: 10.50, max: 11.20 },
  'USD/MAD': { min: 9.60,  max: 10.30 },
  'GBP/MAD': { min: 12.00, max: 13.00 },
  'CHF/MAD': { min: 10.80, max: 11.60 },
}

const CURRENCY_COLORS: Record<string, string> = {
  'EUR/MAD': 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  'USD/MAD': 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  'GBP/MAD': 'text-violet-500 bg-violet-50 dark:bg-violet-500/10',
  'CHF/MAD': 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
}

const MINI_CHART_COLORS: Record<string, string> = {
  'EUR/MAD': '#3b82f6',
  'USD/MAD': '#10b981',
  'GBP/MAD': '#8b5cf6',
  'CHF/MAD': '#f59e0b',
}

function MiniSparkline({ data, color }: { data: number[], color: string }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 80
  const h = 32
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ForexDashboardPage() {
  const { rates, history } = useSimulatedRates()
  const [invoice, setInvoice] = useState(100000) // MAD
  const [targetCcy, setTargetCcy] = useState('EUR/MAD')

  const convertedAmount = (invoice / rates[targetCcy]).toFixed(2)
  const prevRate = BASE_RATES[targetCcy]
  const currentRate = rates[targetCcy]
  const rateChange = ((currentRate - prevRate) / prevRate * 100).toFixed(3)
  const isUp = currentRate > prevRate

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-cream">Forex Live Monitor</h1>
              <p className="text-slate-400 text-xs mt-0.5 uppercase tracking-widest font-bold">Suivi des Devises & Impact Marge</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">LIVE · Simulated Feed</span>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all">
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* Live Rate Cards */}
        <div className="grid grid-cols-4 gap-6 mb-10">
          {Object.entries(rates).map(([pair, rate]) => {
            const prev = BASE_RATES[pair]
            const delta = rate - prev
            const pct = ((delta / prev) * 100).toFixed(3)
            const up = delta >= 0
            const threshold = ALERT_THRESHOLDS[pair]
            const atRisk = rate < threshold.min || rate > threshold.max
            const colorClass = CURRENCY_COLORS[pair]
            const sparkColor = MINI_CHART_COLORS[pair]

            return (
              <div key={pair} className={`bg-white dark:bg-slate-900 rounded-3xl border p-6 shadow-sm transition-all ${atRisk ? 'border-red-200 dark:border-red-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
                {atRisk && (
                  <div className="flex items-center gap-1.5 mb-3 text-[10px] font-black uppercase text-red-500">
                    <AlertTriangle size={12} /> Hors Seuil
                  </div>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-2 py-1 rounded text-[10px] font-black uppercase ${colorClass}`}>{pair}</div>
                  <MiniSparkline data={history[pair] || []} color={sparkColor} />
                </div>
                <p className="text-3xl font-black text-slate-800 dark:text-cream tabular-nums">{rate.toFixed(4)}</p>
                <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${up ? 'text-emerald-500' : 'text-red-500'}`}>
                  {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {up ? '+' : ''}{pct}% vs ref.
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-400">
                  <span>Min: {threshold.min}</span>
                  <span className="text-right">Max: {threshold.max}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-12 gap-8">

          {/* Impact Simulator */}
          <div className="col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 dark:text-cream mb-6 flex items-center gap-2">
              <Target size={16} className="text-emerald-500" /> Simulateur d'Impact
            </h3>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Montant du Circuit (MAD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="number" 
                    value={invoice}
                    onChange={e => setInvoice(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-base font-black text-slate-800 dark:text-cream outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Facturer en</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.keys(rates).map(pair => (
                    <button
                      key={pair}
                      onClick={() => setTargetCcy(pair)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${targetCcy === pair ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                    >
                      {pair.split('/')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-100 dark:border-white/10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valeur Facturée Client</p>
                <p className="text-4xl font-black text-slate-800 dark:text-cream tabular-nums">
                  {Number(convertedAmount).toLocaleString('fr-FR')}
                  <span className="text-lg ml-2 text-slate-400">{targetCcy.split('/')[0]}</span>
                </p>
                <div className={`flex items-center gap-2 mt-3 text-xs font-bold ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>Taux actuel : 1 {targetCcy.split('/')[0]} = {currentRate.toFixed(4)} MAD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Panel */}
          <div className="col-span-7 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
              <h3 className="text-sm font-black text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Shield size={14} /> Alertes & Recommandations
              </h3>
              <div className="space-y-4">
                {Object.entries(ALERT_THRESHOLDS).map(([pair, threshold]) => {
                  const rate = rates[pair]
                  const atRisk = rate < threshold.min || rate > threshold.max
                  return (
                    <div key={pair} className={`flex items-center justify-between p-4 rounded-2xl ${atRisk ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/5'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-8 rounded-full ${atRisk ? 'bg-red-400' : 'bg-emerald-400'}`} />
                        <div>
                          <p className="font-bold text-xs">{pair}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">Seuil : [{threshold.min} — {threshold.max}]</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black tabular-nums">{rate.toFixed(4)}</p>
                        {atRisk && (
                          <p className="text-[10px] text-red-400 font-bold mt-0.5 flex items-center justify-end gap-1">
                            <AlertTriangle size={10} /> Revoir vos tarifs
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-emerald-600 rounded-3xl p-8 text-white flex items-center justify-between relative overflow-hidden">
              <div className="absolute -top-16 -right-8 w-40 h-40 bg-white/10 rounded-full pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-xl font-black mb-1 flex items-center gap-2">
                  <Zap size={20} /> Protégez votre marge
                </h3>
                <p className="text-white/70 text-sm">Définissez des alertes email pour être notifié dès qu'un taux dépasse vos seuils critiques.</p>
              </div>
              <button className="relative z-10 px-6 py-3 bg-white text-emerald-700 font-black rounded-2xl shadow-xl hover:scale-105 transition-all whitespace-nowrap text-sm">
                CONFIGURER LES ALERTES
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Target, ArrowUpRight, ArrowDownRight,
  DollarSign, Calendar, BarChart3, AlertTriangle, CheckCircle
} from 'lucide-react'
import { projectsApi } from '@/lib/api'
import { clsx } from 'clsx'

// Funnel stages in order
const STAGES = [
  { id: 'draft',       label: 'Brouillon',     color: 'bg-slate-400',   text: 'text-slate-600' },
  { id: 'in_progress', label: 'En cours',       color: 'bg-blue-500',    text: 'text-blue-600' },
  { id: 'validated',   label: 'Devis Prêt',     color: 'bg-amber-500',   text: 'text-amber-600' },
  { id: 'sent',        label: 'Envoyé Client',  color: 'bg-orange-500',  text: 'text-orange-600' },
  { id: 'won',         label: 'Gagné ✓',        color: 'bg-emerald-500', text: 'text-emerald-600' },
  { id: 'lost',        label: 'Perdu ✗',        color: 'bg-red-500',     text: 'text-red-600' },
]

// Real-time margin calculator component
export function MarginCalculator({ lines = [], pax = 1 }: { lines?: any[]; pax?: number }) {
  const [margin, setMargin] = useState(18)
  const MIN_MARGIN = 12

  const totalCost = useMemo(() => 
    lines.reduce((sum: number, l: any) => sum + (l.total_cost || l.unit_cost * l.quantity || 0), 0),
    [lines]
  )

  const sellingPrice = totalCost * (1 + margin / 100)
  const pricePerPax = pax > 0 ? sellingPrice / pax : 0
  const profit = sellingPrice - totalCost
  const isBelowMin = margin < MIN_MARGIN

  return (
    <div className={clsx(
      "rounded-3xl border p-6 transition-all",
      isBelowMin ? "bg-red-50 border-red-200" : "bg-emerald-50/50 border-emerald-200/50"
    )}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
          <BarChart3 size={14} />
          Marge Temps Réel
        </h3>
        {isBelowMin && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black">
            <AlertTriangle size={11} /> En dessous du seuil
          </div>
        )}
        {!isBelowMin && margin > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black">
            <CheckCircle size={11} /> Marge OK
          </div>
        )}
      </div>

      {/* Margin slider */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
          <span>Marge Commerciale</span>
          <span className={clsx("text-lg font-black", isBelowMin ? "text-red-600" : "text-emerald-600")}>
            {margin}%
          </span>
        </div>
        <div className="relative">
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={clsx("h-full transition-all", isBelowMin ? "bg-red-500" : "bg-emerald-500")}
              style={{ width: `${(margin / 40) * 100}%` }}
            />
            <div className="absolute top-0 h-full w-px bg-amber-500 opacity-70" style={{ left: `${(MIN_MARGIN / 40) * 100}%` }} />
          </div>
          <input
            type="range" min={0} max={40} step={0.5} value={margin}
            onChange={e => setMargin(+e.target.value)}
            className="relative z-10 w-full opacity-0 h-8 cursor-pointer"
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-400">
          <span>0%</span>
          <span className="text-amber-500 font-bold">Seuil min: {MIN_MARGIN}%</span>
          <span>40%</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Coût Total', value: `€ ${totalCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-slate-600' },
          { label: 'Prix de Vente', value: `€ ${sellingPrice.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Bénéfice Brut', value: `€ ${profit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`, icon: isBelowMin ? TrendingDown : TrendingUp, color: isBelowMin ? 'text-red-600' : 'text-emerald-600' },
          { label: `Prix / Pax (${pax} pax)`, value: `€ ${pricePerPax.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`, icon: Target, color: 'text-slate-700' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white/80 rounded-2xl p-4 border border-white/60">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
            <p className={clsx("text-lg font-black tracking-tight", kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Conversion Funnel Component
export function ConversionFunnel() {
  const { data: projectData } = useQuery({
    queryKey: ['projects-funnel'],
    queryFn: () => projectsApi.list({ limit: 500 }).then(r => r.data),
  })

  const projects = (projectData as any)?.items ?? []

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    STAGES.forEach(s => { map[s.id] = 0 })
    projects.forEach((p: any) => {
      if (map[p.status] !== undefined) map[p.status]++
    })
    return map
  }, [projects])

  const total = projects.length || 1
  const wonRate = total > 0 ? Math.round((counts['won'] / total) * 100) : 0
  const sentToWon = counts['sent'] > 0 ? Math.round((counts['won'] / counts['sent']) * 100) : 0

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-cream tracking-tight">Funnel de Conversion</h3>
          <p className="text-xs text-slate-400 font-medium mt-1">Transformation par étape du pipeline</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-emerald-500">{wonRate}%</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Win Rate Global</p>
        </div>
      </div>

      <div className="space-y-3">
        {STAGES.filter(s => s.id !== 'lost').map((stage, i) => {
          const count = counts[stage.id] || 0
          const width = total > 0 ? Math.max(5, (count / total) * 100) : 5
          return (
            <div key={stage.id} className="flex items-center gap-4">
              <div className="w-28 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">{stage.label}</div>
              <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-full h-8 overflow-hidden relative">
                <div
                  className={clsx("h-full rounded-full transition-all duration-700", stage.color)}
                  style={{ width: `${width}%`, opacity: 1 - i * 0.08 }}
                />
                <span className="absolute inset-0 flex items-center px-4 text-[10px] font-black text-slate-700 dark:text-slate-300">
                  {count} dossier{count > 1 ? 's' : ''}
                </span>
              </div>
              <div className="w-16 text-[10px] font-black text-slate-400 text-right">
                {total > 0 ? `${Math.round((count / total) * 100)}%` : '–'}
              </div>
            </div>
          )
        })}

        {/* Lost as separator */}
        <div className="flex items-center gap-4 opacity-50">
          <div className="w-28 text-[10px] font-black text-red-400 uppercase tracking-wider text-right">Perdu ✗</div>
          <div className="flex-1 bg-red-50 dark:bg-red-500/10 rounded-full h-8 overflow-hidden relative border border-red-200/50">
            <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.max(5, (counts['lost'] / total) * 100)}%` }} />
            <span className="absolute inset-0 flex items-center px-4 text-[10px] font-black text-red-600">{counts['lost']} dossier{counts['lost'] > 1 ? 's' : ''}</span>
          </div>
          <div className="w-16 text-[10px] font-black text-red-400 text-right">{total > 0 ? `${Math.round((counts['lost'] / total) * 100)}%` : '–'}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-100 dark:border-white/10">
        <div className="text-center">
          <p className="text-xl font-black text-slate-900 dark:text-cream">{sentToWon}%</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Envoyé → Gagné</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-blue-500">{counts['in_progress']}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">En Étude Active</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-amber-500">{counts['sent']}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">En Attente Client</p>
        </div>
      </div>
    </div>
  )
}

// Revenue Forecast Component
export function RevenueForecast() {
  const { data: projectData } = useQuery({
    queryKey: ['projects-forecast'],
    queryFn: () => projectsApi.list({ limit: 500 }).then(r => r.data),
  })

  const projects = (projectData as any)?.items ?? []
  const pipeline = projects.filter((p: any) => ['in_progress', 'validated', 'sent'].includes(p.status))
  const won = projects.filter((p: any) => p.status === 'won')

  // Mock revenue forecast based on pipeline × win rate
  const avgTicket = 18400
  const winRate = 0.62
  const forecast30 = Math.round(pipeline.filter((p: any) => p.status === 'sent').length * avgTicket * winRate)
  const forecast60 = Math.round(pipeline.filter((p: any) => ['sent', 'validated'].includes(p.status)).length * avgTicket * winRate)
  const forecast90 = Math.round(pipeline.length * avgTicket * winRate)

  return (
    <div className="bg-slate-950 rounded-3xl p-8 text-white">
      <h3 className="text-sm font-black uppercase tracking-widest text-white/40 mb-8 flex items-center gap-2">
        <Calendar size={14} /> Prévisions Pipeline
      </h3>
      <div className="space-y-4">
        {[
          { label: '30 jours', value: forecast30, icon: ArrowUpRight, color: 'text-emerald-400' },
          { label: '60 jours', value: forecast60, icon: ArrowUpRight, color: 'text-blue-400' },
          { label: '90 jours', value: forecast90, icon: ArrowUpRight, color: 'text-amber-400' },
        ].map((f, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
              <f.icon size={16} className={f.color} />
              <span className="text-xs font-black uppercase tracking-widest text-white/60">{f.label}</span>
            </div>
            <span className={clsx("text-xl font-black", f.color)}>
              € {f.value.toLocaleString('fr-FR')}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/30 italic mt-6 text-center">
        Basé sur {pipeline.length} projets en cours × taux win {Math.round(winRate * 100)}%
      </p>
    </div>
  )
}

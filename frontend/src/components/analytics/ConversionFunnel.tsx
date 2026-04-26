import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/lib/api'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { clsx } from 'clsx'

const STAGES = [
  { key: 'draft',       label: 'Brouillons',   color: 'bg-slate-400',   textColor: 'text-slate-500' },
  { key: 'in_progress', label: 'En étude',     color: 'bg-blue-500',    textColor: 'text-blue-600' },
  { key: 'validated',   label: 'Devis prêt',   color: 'bg-violet-500',  textColor: 'text-violet-600' },
  { key: 'sent',        label: 'Envoyé',       color: 'bg-amber-500',   textColor: 'text-amber-600' },
  { key: 'won',         label: 'Gagné',        color: 'bg-emerald-500', textColor: 'text-emerald-600' },
]

export function ConversionFunnel() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis-dashboard'],
    queryFn: () => projectsApi.getKpis().then(r => r.data),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return (
    <div className="h-48 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-rihla/30 border-t-rihla rounded-full animate-spin" />
    </div>
  )

  const byStatus = (kpis as any)?.by_status ?? {}
  const total = Math.max((kpis as any)?.total_projects ?? 1, 1)

  const stageData = STAGES.map(s => ({
    ...s,
    count: byStatus[s.key] ?? 0,
    pct: Math.round(((byStatus[s.key] ?? 0) / total) * 100),
  }))

  const maxCount = Math.max(...stageData.map(s => s.count), 1)

  // Taux de conversion global draft → won
  const wonCount = byStatus['won'] ?? 0
  const conversionRate = Math.round((wonCount / total) * 100)
  const sentCount = (byStatus['sent'] ?? 0) + wonCount
  const closingRate = sentCount > 0 ? Math.round((wonCount / sentCount) * 100) : 0

  return (
    <div className="space-y-6">
      {/* KPI banners */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Taux de conversion global</p>
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{conversionRate}%</p>
          <p className="text-[10px] text-emerald-500 mt-1">Brief → Dossier gagné</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Taux de closing</p>
          <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{closingRate}%</p>
          <p className="text-[10px] text-blue-500 mt-1">Envoyé → Confirmé</p>
        </div>
      </div>

      {/* Funnel bars */}
      <div className="space-y-3">
        {stageData.map((stage, i) => {
          const barWidth = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
          // Taux de conversion vers l'étape suivante
          const nextCount = i < stageData.length - 1 ? stageData[i + 1].count : null
          const dropRate = nextCount !== null && stage.count > 0
            ? Math.round(((stage.count - nextCount) / stage.count) * 100)
            : null

          return (
            <div key={stage.key} className="relative">
              <div className="flex items-center gap-3 mb-1">
                <span className={clsx("text-[10px] font-black uppercase tracking-widest w-28 flex-shrink-0", stage.textColor)}>
                  {stage.label}
                </span>
                <div className="flex-1 h-8 bg-slate-100 dark:bg-white/5 rounded-xl overflow-hidden">
                  <div
                    className={clsx("h-full rounded-xl transition-all duration-700", stage.color)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200 w-10 text-right">{stage.count}</span>
                <span className="text-[10px] text-slate-400 w-10 text-right">{stage.pct}%</span>
              </div>

              {/* Drop rate entre étapes */}
              {dropRate !== null && i < stageData.length - 1 && (
                <div className="flex items-center gap-1 ml-32 mb-1">
                  <div className="w-px h-3 bg-slate-200 dark:bg-white/10 ml-1" />
                  <span className={clsx("text-[9px] font-bold flex items-center gap-0.5",
                    dropRate > 50 ? "text-red-400" : dropRate > 25 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {dropRate > 50 ? <TrendingDown size={9} /> : dropRate > 25 ? <Minus size={9} /> : <TrendingUp size={9} />}
                    {dropRate > 0 ? `-${dropRate}%` : '→'} sortie vers "{stageData[i + 1].label}"
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Projets perdus */}
      {byStatus['lost'] > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl">
          <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">
            <strong>{byStatus['lost']}</strong> dossier{byStatus['lost'] > 1 ? 's' : ''} perdu{byStatus['lost'] > 1 ? 's' : ''} —{' '}
            représente{' '}
            <strong>{Math.round((byStatus['lost'] / total) * 100)}%</strong> du pipeline total
          </p>
        </div>
      )}
    </div>
  )
}

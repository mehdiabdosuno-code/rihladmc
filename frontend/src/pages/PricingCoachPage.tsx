import { useEffect, useState } from 'react'
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Target,
  Sparkles,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { pricingCoachApi } from '@/lib/api'
import type { PricingRecommendation, PricingInsights } from '@/lib/api'

const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

export function PricingCoachPage() {
  const [destination, setDestination] = useState('Marrakech')
  const [duration, setDuration] = useState(8)
  const [pax, setPax] = useState(12)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [reco, setReco] = useState<PricingRecommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<PricingInsights | null>(null)
  const [provider, setProvider] = useState<'demo' | 'anthropic'>('demo')

  useEffect(() => {
    pricingCoachApi.insights().then(r => setInsights(r.data))
    pricingCoachApi.status().then(r => setProvider((r.data as any).provider))
  }, [])

  const run = async () => {
    setLoading(true)
    try {
      const r = await pricingCoachApi.recommend({
        destination,
        duration_days: duration,
        pax,
        departure_month: month,
      })
      setReco(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { run() }, [])

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-50 p-2">
            <Brain className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-slate-900">
              Pricing Coach <span className="text-sm font-normal text-slate-500">— Marge optimale par contexte</span>
            </h1>
            <p className="text-sm text-slate-500">
              Analyse statistique des cotations passées + contexte saisonnier · suggère la marge cible
            </p>
          </div>
        </div>
        {provider === 'anthropic' ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            <Sparkles className="h-3 w-3" />
            Claude actif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            Mode demo
          </span>
        )}
      </div>

      {/* Form */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
          Contexte du nouveau dossier
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-slate-600">Destination</label>
            <input
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="Marrakech, Sahara…"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#B43E20] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Durée (jours)</label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 0)}
              min={1}
              max={30}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#B43E20] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Voyageurs</label>
            <input
              type="number"
              value={pax}
              onChange={e => setPax(parseInt(e.target.value) || 0)}
              min={1}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#B43E20] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Mois de départ</label>
            <select
              value={month}
              onChange={e => setMonth(parseInt(e.target.value))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Analyser
            </button>
          </div>
        </div>
      </div>

      {reco && (
        <>
          {/* Hero recommendation */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 lg:col-span-1">
              <div className="text-xs font-medium uppercase tracking-wider text-indigo-700">
                Marge recommandée
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-indigo-900">
                  {reco.margin_recommended.toFixed(1)}
                </span>
                <span className="text-2xl font-semibold text-indigo-600">%</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-500">Plancher prudent</div>
                  <div className="font-semibold text-slate-700">{reco.margin_min_safe.toFixed(1)}%</div>
                </div>
                <div className="h-px flex-1 bg-slate-200 mx-3" />
                <div className="text-right">
                  <div className="text-slate-500">Plafond agressif</div>
                  <div className="font-semibold text-slate-700">{reco.margin_max_aggressive.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <BarChart3 className="h-3.5 w-3.5" />
                Historique pertinent
              </div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Échantillon</span>
                  <span className="font-medium text-slate-900">{reco.sample_size} cotation(s)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Gagnées</span>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {reco.won_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Perdues</span>
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                    {reco.lost_count}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-slate-600">Taux de conversion</span>
                  <span className="font-semibold text-slate-900">{reco.win_rate.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Target className="h-3.5 w-3.5" />
                Distribution marges gagnées
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Médiane (p50)" value={reco.margin_p50} highlight />
                <Row label="p25 (prudent)" value={reco.margin_p25} />
                <Row label="p75 (agressif)" value={reco.margin_p75} />
                <Row label="Moyenne gagnées" value={reco.margin_won_avg} />
                {reco.margin_lost_avg !== null && (
                  <Row label="Moyenne perdues" value={reco.margin_lost_avg} muted />
                )}
              </div>
            </div>
          </div>

          {/* Flags */}
          {reco.flags.length > 0 && (
            <div className="mb-6 space-y-2">
              {reco.flags.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rationale */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Brain className="h-4 w-4 text-indigo-600" />
              Raisonnement du coach
            </h3>
            <div className="space-y-2 whitespace-pre-line text-sm text-slate-700">
              {reco.rationale.split('\n\n').map((para, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
              ))}
            </div>
          </div>

          {/* Samples used */}
          {reco.samples_used.length > 0 && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">
                Cotations analysées ({reco.samples_used.length})
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Dossier</th>
                    <th className="px-5 py-2 text-left font-medium">Destination</th>
                    <th className="px-5 py-2 text-right font-medium">Marge %</th>
                    <th className="px-5 py-2 text-right font-medium">Selling</th>
                    <th className="px-5 py-2 text-left font-medium">Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reco.samples_used.map(s => (
                    <tr key={s.project_id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-2 font-medium text-slate-900">{s.project_name || '—'}</td>
                      <td className="px-5 py-2 text-slate-600">{s.destination || '—'}</td>
                      <td className="px-5 py-2 text-right font-medium text-slate-900">
                        {s.margin_pct.toFixed(1)}%
                      </td>
                      <td className="px-5 py-2 text-right text-slate-600">
                        {s.total_selling
                          ? `${s.total_selling.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
                          : '—'}
                      </td>
                      <td className="px-5 py-2">
                        <span className={
                          s.outcome === 'won'  ? 'rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700' :
                          s.outcome === 'lost' ? 'rounded-md bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700' :
                                                  'rounded-md bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700'
                        }>
                          {s.outcome === 'won' ? 'Gagné' : s.outcome === 'lost' ? 'Perdu' : 'En cours'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Global insights */}
      {insights && insights.total_samples > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            Vue d'ensemble — {insights.total_samples} cotations dans le pipeline
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Par destination (top)
              </div>
              <div className="space-y-1 text-sm">
                {insights.by_destination.slice(0, 6).map(d => (
                  <div key={d.key} className="flex items-center justify-between">
                    <span className="text-slate-700">{d.key}</span>
                    <span className="text-slate-500">
                      {d.count}× · moy. <strong className="text-slate-800">{d.avg?.toFixed(1)}%</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Par durée
              </div>
              <div className="space-y-1 text-sm">
                {insights.by_duration.map(d => (
                  <div key={d.key} className="flex items-center justify-between">
                    <span className="text-slate-700">{d.key}</span>
                    <span className="text-slate-500">
                      {d.count}× · moy. <strong className="text-slate-800">{d.avg?.toFixed(1)}%</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <strong>Repère marché DMC MENA</strong> · fourchette pairs anonymisés{' '}
            {insights.peer_band[0]}–{insights.peer_band[1]}% · moyenne {insights.peer_avg}%
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight, muted }: { label: string, value: number | null, highlight?: boolean, muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
      <span className={
        highlight ? 'text-base font-semibold text-indigo-700' :
        muted     ? 'text-slate-400' :
                    'font-medium text-slate-900'
      }>
        {value !== null && value !== undefined ? `${value.toFixed(1)}%` : '—'}
      </span>
    </div>
  )
}

export default PricingCoachPage

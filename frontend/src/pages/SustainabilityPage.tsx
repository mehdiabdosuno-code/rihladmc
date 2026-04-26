import { useEffect, useState } from 'react'
import {
  Leaf,
  Plane,
  Building2,
  Bus,
  Activity,
  Download,
  Sparkles,
  Loader2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { projectsApi, sustainabilityApi } from '@/lib/api'
import type { CarbonReport, CsrdAggregate } from '@/lib/api'

interface ProjectLite {
  id: string
  name: string
  client_name?: string | null
  destination?: string | null
  pax_count?: number | null
}

const CAT_META: Record<
  string,
  { label: string; icon: typeof Plane; color: string; bg: string }
> = {
  flight:           { label: 'Vols',           icon: Plane,      color: 'text-orange-700', bg: 'bg-orange-50' },
  ground_transport: { label: 'Transport sol',  icon: Bus,        color: 'text-amber-700',  bg: 'bg-amber-50' },
  hotel:            { label: 'Hébergement',    icon: Building2,  color: 'text-blue-700',   bg: 'bg-blue-50' },
  activity:         { label: 'Activités',      icon: Activity,   color: 'text-emerald-700',bg: 'bg-emerald-50' },
  meals:            { label: 'Restauration',   icon: Activity,   color: 'text-emerald-700',bg: 'bg-emerald-50' },
}

const BENCHMARK_META: Record<string, { label: string; color: string; bg: string; icon: typeof TrendingDown }> = {
  excellent: { label: 'Excellent',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: TrendingDown },
  good:      { label: 'Bon',           color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: TrendingDown },
  average:   { label: 'Moyen',         color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     icon: TrendingUp },
  high:      { label: 'Élevé',         color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',       icon: TrendingUp },
}

export function SustainabilityPage() {
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [projectId, setProjectId] = useState('')
  const [report, setReport] = useState<CarbonReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [csrd, setCsrd] = useState<CsrdAggregate | null>(null)
  const [csrdOpen, setCsrdOpen] = useState(false)

  useEffect(() => {
    projectsApi
      .list({ limit: 50 })
      .then((r) => {
        const items: ProjectLite[] = (r.data?.items ?? r.data ?? []) as ProjectLite[]
        setProjects(items)
        if (items.length) setProjectId(items[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    sustainabilityApi
      .footprint(projectId)
      .then((r) => setReport(r.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [projectId])

  const loadCsrd = () => {
    setCsrdOpen(true)
    sustainabilityApi
      .csrd()
      .then((r) => setCsrd(r.data))
      .catch(() => {})
  }

  const exportPdf = () => {
    window.print()
  }

  if (!report && !loading) {
    return (
      <div className="px-8 py-6">
        <Header onCsrd={loadCsrd} />
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <Leaf className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
          <p>Aucun dossier disponible.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-6 print:px-0 print:py-0">
      <Header onCsrd={loadCsrd} />

      {/* Project picker */}
      <div className="mb-6 flex items-center gap-3 print:hidden">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Dossier
        </label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="flex-1 max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#B43E20] focus:outline-none focus:ring-2 focus:ring-[#B43E20]/20"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.client_name ? `— ${p.client_name}` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={exportPdf}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Exporter PDF
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
        </div>
      )}

      {report && !loading && (
        <>
          {/* Hero KPIs */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">
                Empreinte totale
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-slate-900">
                  {report.total_co2e_t.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-500">tCO₂e</span>
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {report.total_co2e_kg.toLocaleString('fr-FR')} kg équivalent CO₂
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Par voyageur
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-slate-900">
                  {report.per_pax_co2e_kg.toFixed(0)}
                </span>
                <span className="text-sm text-slate-500">kg / pax</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {report.pax_count} voyageur(s) · {report.duration_days} j
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Comparaison filière
              </div>
              {(() => {
                const m = BENCHMARK_META[report.benchmark_label]
                const Icon = m.icon
                return (
                  <div
                    className={`mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium ${m.bg} ${m.color}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label} ({report.benchmark_pct_vs_average >= 0 ? '+' : ''}
                    {report.benchmark_pct_vs_average.toFixed(0)}%)
                  </div>
                )
              })()}
              <div className="mt-2 text-xs text-slate-500">
                Moyenne MENA : 85 kg / pax / jour
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-amber-700">
                Coût compensation
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-slate-900">
                  {report.offset_eur.toFixed(0)}
                </span>
                <span className="text-sm font-medium text-slate-500">€</span>
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Projets nature-based · 18 €/tonne
              </div>
            </div>
          </div>

          {/* Breakdown by category */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Répartition par catégorie</h3>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-100 md:grid-cols-4">
              {(['flight', 'ground_transport', 'hotel', 'activity'] as const).map((cat) => {
                const m = CAT_META[cat]
                const Icon = m.icon
                const total = report.items
                  .filter((i) => i.category === cat)
                  .reduce((s, i) => s + i.co2e_kg, 0)
                const pct = report.total_co2e_kg ? (total / report.total_co2e_kg) * 100 : 0
                return (
                  <div key={cat} className="bg-white p-4">
                    <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${m.bg}`}>
                      <Icon className={`h-4 w-4 ${m.color}`} />
                    </div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">{m.label}</div>
                    <div className="mt-0.5 text-lg font-semibold text-slate-900">
                      {(total / 1000).toFixed(2)} t
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${m.bg.replace('50', '300')}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{pct.toFixed(0)}% du total</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detailed line items */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Détail des émissions ({report.items.length} postes)
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">Catégorie</th>
                  <th className="px-5 py-2 text-left font-medium">Description</th>
                  <th className="px-5 py-2 text-right font-medium">Quantité</th>
                  <th className="px-5 py-2 text-right font-medium">Facteur</th>
                  <th className="px-5 py-2 text-right font-medium">CO₂e</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.items.map((it, i) => {
                  const m = CAT_META[it.category]
                  return (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-5 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${m.bg} ${m.color}`}
                        >
                          {m.label}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-slate-700">{it.label}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">
                        {it.quantity.toLocaleString('fr-FR')} {it.unit}
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-500">
                        {it.factor_kg.toFixed(2)} kg/{it.unit.split('-').pop()}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-slate-900">
                        {it.co2e_kg.toLocaleString('fr-FR')} kg
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Total
                  </td>
                  <td className="px-5 py-2.5 text-right text-base font-semibold text-emerald-700">
                    {report.total_co2e_kg.toLocaleString('fr-FR')} kg
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Methodology */}
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/40 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-blue-600" />
              <div className="text-xs text-blue-900">
                <span className="font-semibold">Méthodologie · </span>
                {report.methodology}
              </div>
            </div>
          </div>
        </>
      )}

      {/* CSRD modal */}
      {csrdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
          onClick={() => setCsrdOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Rapport CSRD — vue agrégée</h3>
              <button
                onClick={() => setCsrdOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            {!csrd && <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" /></div>}
            {csrd && (
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <Stat label="Période" value={`${csrd.period_start.slice(0, 7)} → ${csrd.period_end.slice(0, 7)}`} />
                  <Stat label="Dossiers" value={csrd.projects_count.toString()} />
                  <Stat label="Total CO₂e" value={`${csrd.total_co2e_t.toFixed(1)} t`} />
                </div>
                <div className="mt-6">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Répartition par poste
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(csrd.breakdown_by_category).map(([cat, kg]) => {
                      const m = CAT_META[cat]
                      if (!m) return null
                      const pct = csrd.total_co2e_t ? ((kg as number) / 1000 / csrd.total_co2e_t) * 100 : 0
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className={`w-32 text-xs ${m.color}`}>{m.label}</span>
                          <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full ${m.bg.replace('50', '400')}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-20 text-right text-xs text-slate-600">
                            {((kg as number) / 1000).toFixed(2)} t
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="mt-6">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Top émetteurs
                  </h4>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {csrd.top_emitters.slice(0, 5).map((p) => (
                        <tr key={p.project_id}>
                          <td className="py-1.5 text-slate-700">{p.project_name}</td>
                          <td className="py-1.5 text-right text-slate-500">{p.per_pax_kg.toFixed(0)} kg/pax</td>
                          <td className="py-1.5 text-right font-medium text-slate-900">{p.co2e_t.toFixed(2)} t</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function Header({ onCsrd }: { onCsrd: () => void }) {
  return (
    <div className="mb-6 flex items-start justify-between print:mb-3">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-50 p-2">
          <Leaf className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900">Empreinte carbone</h1>
          <p className="text-sm text-slate-500">
            Calcul ADEME / DEFRA · Rapports CSRD-ready · Compensation nature-based
          </p>
        </div>
      </div>
      <button
        onClick={onCsrd}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 print:hidden"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Rapport CSRD organisation
      </button>
    </div>
  )
}

export default SustainabilityPage

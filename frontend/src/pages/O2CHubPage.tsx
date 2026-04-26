import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Workflow, TrendingUp, Clock, AlertTriangle, ArrowRight, RefreshCw,
  CheckCircle2, Circle, Hourglass, XCircle, ChevronRight, Activity,
  Wallet, BarChart3, Loader2, Search,
} from 'lucide-react'
import {
  o2cApi, type O2CKpis, type O2CFunnel, type O2CLifecycleRow,
  type O2CAging, type O2CBottleneck,
} from '@/lib/api'

const TABS = [
  { id: 'overview', label: 'Vue exécutive', icon: BarChart3 },
  { id: 'funnel',   label: 'Funnel commercial', icon: TrendingUp },
  { id: 'lifecycle',label: 'Cycle dossier', icon: Workflow },
  { id: 'aging',    label: 'Encours clients', icon: Clock },
  { id: 'bottlenecks', label: 'Goulots', icon: AlertTriangle },
] as const
type TabId = typeof TABS[number]['id']

const STAGE_COLORS: Record<string, string> = {
  lead:     'bg-slate-100 text-slate-700',
  quoted:   'bg-blue-100 text-blue-700',
  won:      'bg-violet-100 text-violet-700',
  invoiced: 'bg-amber-100 text-amber-700',
  paid:     'bg-emerald-100 text-emerald-700',
}

function fmtMoney(n: number, cur = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n)
}

function StepIcon({ status }: { status: string }) {
  if (status === 'done')    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  if (status === 'active')  return <Hourglass className="w-4 h-4 text-amber-500" />
  if (status === 'skipped') return <XCircle className="w-4 h-4 text-slate-400" />
  return <Circle className="w-4 h-4 text-slate-300" />
}

export function O2CHubPage() {
  const [tab, setTab] = useState<TabId>('overview')
  const [kpis, setKpis] = useState<O2CKpis | null>(null)
  const [funnel, setFunnel] = useState<O2CFunnel | null>(null)
  const [lifecycle, setLifecycle] = useState<O2CLifecycleRow[]>([])
  const [aging, setAging] = useState<O2CAging | null>(null)
  const [bottlenecks, setBottlenecks] = useState<O2CBottleneck[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [blockedOnly, setBlockedOnly] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const [k, f, l, a, b] = await Promise.all([
        o2cApi.overview(),
        o2cApi.funnel(),
        o2cApi.lifecycle({ limit: 50, blocked_only: blockedOnly }),
        o2cApi.aging(),
        o2cApi.bottlenecks(),
      ])
      setKpis(k.data); setFunnel(f.data); setLifecycle(l.data)
      setAging(a.data); setBottlenecks(b.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [blockedOnly])

  if (loading || !kpis || !funnel || !aging) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Chargement du cockpit O2C…
      </div>
    )
  }

  const cur = kpis.currency
  const filtered = lifecycle.filter(r =>
    !search || r.project_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.client_name || '').toLowerCase().includes(search.toLowerCase())
  )
  const maxFunnelCount = Math.max(...funnel.stages.map(s => s.count), 1)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold leading-tight">Order-to-Cash · Cockpit unifié</h1>
            <p className="text-sm text-slate-500">Pilotage du cycle commercial : demande → devis → confirmation → facture → encaissement</p>
          </div>
        </div>
        <button onClick={refresh}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </button>
      </header>

      {/* KPI hero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Conversion devis → vente" value={`${kpis.conversion_rate}%`}
             hint={`${kpis.quotations_accepted} / ${kpis.quotations_sent} devis`}
             icon={TrendingUp} accent="emerald" />
        <KPI label="DSO · Encours moyen" value={`${kpis.dso_days} j`}
             hint={kpis.invoices_overdue > 0 ? `${kpis.invoices_overdue} en retard` : 'aucun retard'}
             icon={Clock} accent={kpis.invoices_overdue > 0 ? 'amber' : 'slate'} />
        <KPI label="Encaissé" value={fmtMoney(kpis.revenue_collected, cur)}
             hint={`${kpis.invoices_paid} factures payées`}
             icon={Wallet} accent="emerald" />
        <KPI label="En attente d'encaissement" value={fmtMoney(kpis.revenue_outstanding, cur)}
             hint={`${kpis.invoices_issued - kpis.invoices_paid} factures émises`}
             icon={Activity} accent="amber" />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-2 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm flex items-center gap-2 border-b-2 transition-colors ${
              tab === t.id ? 'border-violet-600 text-violet-700 font-medium' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
            {t.id === 'bottlenecks' && bottlenecks.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{bottlenecks.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-violet-600" /> Pipeline commercial</h3>
            <div className="space-y-3">
              {funnel.stages.map((s, i) => {
                const w = Math.max((s.count / maxFunnelCount) * 100, 5)
                return (
                  <div key={s.stage}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">{s.label}</span>
                      <span className="text-slate-500">{s.count} dossier(s) · {fmtMoney(s.value, cur)}</span>
                    </div>
                    <div className="relative h-7 bg-slate-100 rounded-lg overflow-hidden">
                      <div className={`h-full ${['bg-slate-400','bg-blue-500','bg-violet-500','bg-amber-500','bg-emerald-500'][i]} transition-all`}
                           style={{ width: `${w}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Taux de conversion global</span>
              <span className="font-semibold text-violet-700">{funnel.overall_conversion}%</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-violet-600" /> Indicateurs clés</h3>
            <ul className="space-y-3 text-sm">
              <Stat label="Pipeline ouvert (devis envoyés)" value={fmtMoney(kpis.revenue_pipeline, cur)} />
              <Stat label="Délai moyen de paiement" value={kpis.avg_invoice_to_payment_days > 0 ? `${kpis.avg_invoice_to_payment_days} j` : '—'} />
              <Stat label="Devis sans suivi (>7j)" value={String(kpis.leakage_count)}
                    accent={kpis.leakage_count > 0 ? 'amber' : 'slate'} />
              <Stat label="Encours total" value={fmtMoney(aging.total_outstanding, cur)} />
              <Stat label="Goulots détectés" value={String(bottlenecks.length)}
                    accent={bottlenecks.length > 0 ? 'red' : 'emerald'} />
            </ul>
          </div>
        </div>
      )}

      {/* Funnel tab */}
      {tab === 'funnel' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-end justify-between gap-2 h-72">
            {funnel.stages.map((s, i) => {
              const h = Math.max((s.count / maxFunnelCount) * 100, 6)
              const colors = ['bg-slate-400', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500']
              const next = funnel.stages[i + 1]
              const dropoff = next && s.count > 0 ? Math.round((1 - next.count / s.count) * 100) : null
              return (
                <div key={s.stage} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="flex-1 w-full flex items-end relative">
                    <div className={`w-full ${colors[i]} rounded-t-md transition-all hover:opacity-80`}
                         style={{ height: `${h}%` }}>
                      <div className="text-white text-xs font-medium text-center pt-1">{s.count}</div>
                    </div>
                    {dropoff !== null && dropoff > 0 && (
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded">
                        −{dropoff}%
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-700 font-medium text-center">{s.label}</div>
                  <div className="text-[10px] text-slate-500 text-center">{fmtMoney(s.value, cur)}</div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-slate-500 mb-1">Taux de signature</div>
              <div className="text-base font-semibold">
                {funnel.stages[1].count > 0
                  ? `${Math.round(funnel.stages[2].count / funnel.stages[1].count * 100)}%`
                  : '—'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-slate-500 mb-1">Taux de facturation</div>
              <div className="text-base font-semibold">
                {funnel.stages[2].count > 0
                  ? `${Math.round(funnel.stages[3].count / funnel.stages[2].count * 100)}%`
                  : '—'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-slate-500 mb-1">Taux d'encaissement</div>
              <div className="text-base font-semibold">
                {funnel.stages[3].count > 0
                  ? `${Math.round(funnel.stages[4].count / funnel.stages[3].count * 100)}%`
                  : '—'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-violet-50">
              <div className="text-violet-700 mb-1">Lead → Cash global</div>
              <div className="text-base font-semibold text-violet-800">{funnel.overall_conversion}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Lifecycle tab */}
      {tab === 'lifecycle' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher dossier ou client…"
                className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <label className="text-xs flex items-center gap-2 text-slate-600">
              <input type="checkbox" checked={blockedOnly} onChange={e => setBlockedOnly(e.target.checked)} />
              Goulots seulement
            </label>
            <span className="text-xs text-slate-400 ml-auto">{filtered.length} dossier(s)</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Dossier</th>
                  <th className="text-left px-4 py-2.5">Client</th>
                  <th className="text-left px-4 py-2.5">Étape</th>
                  <th className="text-left px-4 py-2.5 w-48">Avancement</th>
                  <th className="text-right px-4 py-2.5">Valeur</th>
                  <th className="text-right px-4 py-2.5">Encaissé</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Aucun dossier.</td></tr>
                )}
                {filtered.map(r => (
                  <RowFragment key={r.project_id} r={r} expanded={expanded === r.project_id}
                               onToggle={() => setExpanded(expanded === r.project_id ? null : r.project_id)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aging tab */}
      {tab === 'aging' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {aging.buckets.map(b => (
              <div key={b.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500 mb-1">{b.label}</div>
                <div className="text-xl font-semibold">{fmtMoney(b.amount, cur)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{b.count} facture(s)</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">N°</th>
                  <th className="text-left px-4 py-2.5">Client</th>
                  <th className="text-left px-4 py-2.5">Échéance</th>
                  <th className="text-left px-4 py-2.5">Tranche</th>
                  <th className="text-right px-4 py-2.5">Montant</th>
                  <th className="text-right px-4 py-2.5">Retard</th>
                </tr>
              </thead>
              <tbody>
                {aging.invoices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Aucun encours client.</td></tr>
                )}
                {aging.invoices.map(i => (
                  <tr key={i.invoice_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs">{i.number}</td>
                    <td className="px-4 py-2.5">{i.client_name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{i.due_date || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        i.bucket === 'À échoir' ? 'bg-emerald-100 text-emerald-700'
                        : i.bucket === '0-30j' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{i.bucket}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(i.amount, i.currency || cur)}</td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {i.days_overdue > 0 ? <span className="text-red-600">{i.days_overdue}j</span> : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottlenecks tab */}
      {tab === 'bottlenecks' && (
        <div className="space-y-3">
          {bottlenecks.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-5 py-6 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5" />
              Aucun goulot d'étranglement détecté. Le funnel est sain.
            </div>
          ) : (
            bottlenecks.map(b => (
              <div key={b.project_id} className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  b.severity === 'critical' ? 'bg-red-100 text-red-600'
                  : b.severity === 'warning' ? 'bg-amber-100 text-amber-600'
                  : 'bg-blue-100 text-blue-600'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link to={`/projects/${b.project_id}`} className="text-sm font-medium hover:underline">
                        {b.project_name}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Bloqué à l'étape <span className={`px-1.5 py-0.5 rounded ${STAGE_COLORS[b.stage]}`}>{b.stage}</span>
                        {' '}depuis <strong>{b.days_stuck} jour(s)</strong>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      b.severity === 'critical' ? 'bg-red-100 text-red-700'
                      : b.severity === 'warning' ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                    }`}>{b.severity}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 italic">→ {b.suggestion}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, hint, icon: Icon, accent = 'slate' }: {
  label: string, value: string, hint?: string, icon: any, accent?: 'slate' | 'emerald' | 'amber' | 'violet'
}) {
  const colors: Record<string, string> = {
    slate:   'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    violet:  'bg-violet-50 text-violet-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[accent]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  )
}

function Stat({ label, value, accent = 'slate' }: { label: string, value: string, accent?: 'slate'|'amber'|'red'|'emerald' }) {
  const colors: Record<string, string> = {
    slate: 'text-slate-700', amber: 'text-amber-700',
    red: 'text-red-700', emerald: 'text-emerald-700',
  }
  return (
    <li className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${colors[accent]}`}>{value}</span>
    </li>
  )
}

function RowFragment({ r, expanded, onToggle }: {
  r: O2CLifecycleRow, expanded: boolean, onToggle: () => void
}) {
  return (
    <>
      <tr className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${r.is_blocked ? 'bg-amber-50/40' : ''}`} onClick={onToggle}>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            <div>
              <div className="font-medium">{r.project_name}</div>
              {r.project_reference && <div className="text-[10px] font-mono text-slate-400">{r.project_reference}</div>}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-slate-700">{r.client_name || '—'}</td>
        <td className="px-4 py-2.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[r.current_stage]}`}>{r.current_stage}</span>
          {r.is_blocked && <AlertTriangle className="w-3 h-3 text-amber-500 inline ml-1.5" />}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${r.progress_pct >= 80 ? 'bg-emerald-500' : r.progress_pct >= 40 ? 'bg-violet-500' : 'bg-blue-500'} transition-all`} style={{ width: `${r.progress_pct}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 w-8 text-right">{r.progress_pct}%</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(r.total_value, r.currency)}</td>
        <td className="px-4 py-2.5 text-right">
          <span className={r.paid_value > 0 ? 'text-emerald-700' : 'text-slate-400'}>
            {fmtMoney(r.paid_value, r.currency)}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <Link to={`/projects/${r.project_id}`} onClick={e => e.stopPropagation()}
                className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1">
            Ouvrir <ArrowRight className="w-3 h-3" />
          </Link>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/60">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {r.steps.map((s, i) => (
                <div key={s.key} className="relative">
                  <div className="flex items-start gap-2">
                    <StepIcon status={s.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700">{s.label}</div>
                      {s.detail && <div className="text-[10px] text-slate-500 truncate">{s.detail}</div>}
                      {s.timestamp && <div className="text-[10px] text-slate-400 mt-0.5">{new Date(s.timestamp).toLocaleDateString('fr-FR')}</div>}
                    </div>
                  </div>
                  {i < r.steps.length - 1 && (
                    <div className="hidden md:block absolute top-2 right-0 w-6 h-px bg-slate-200" />
                  )}
                </div>
              ))}
            </div>
            {r.is_blocked && r.block_reason && (
              <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> {r.block_reason}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

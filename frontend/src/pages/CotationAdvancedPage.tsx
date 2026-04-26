import { useEffect, useState } from 'react'
import {
  Bus, Calculator, Car, FileSignature, Hotel, Loader2,
  Sparkles, Truck, Users,
} from 'lucide-react'
import { cotationApi,
  type CotationFullView, type Vehicle as VehicleT, type RecomputePayload,
} from '@/lib/api'

type Tab = 'pricing' | 'terms' | 'vehicles' | 'lines'

interface Quote { id: string; project_id: string; currency: string; margin_pct: number }
interface Project { id: string; name: string }

const TAB_META: Record<Tab, { label: string; icon: any; sub: string }> = {
  pricing:  { label: 'Grille PAX scaling',   icon: Calculator,    sub: 'Décomposition coût × bracket PAX' },
  terms:    { label: 'Termes & Conditions',  icon: FileSignature, sub: 'Templates S\u2019TOURS + édition' },
  vehicles: { label: 'Catalogue véhicules',  icon: Truck,         sub: 'Specs · capacité · tarif/km' },
  lines:    { label: 'Lignes de cotation',   icon: Hotel,         sub: 'Cycle jour × catégorie' },
}

const DEFAULT_RECOMPUTE: RecomputePayload = {
  pax_brackets: [10, 15, 20, 25, 30, 35],
  foc_count: 1,
  markup_pct: 8,
  bus_total_cost: 31500,
  tour_leader_cost: 9000,
  guide_cost: 9000,
  guide_local_cost: 300,
  single_supplement: 315,
  currency: 'USD',
  extras_per_pax: {
    hotel: 5244, restaurants: 1566, monuments: 620,
    tips_lug: 70, tips_rest: 75, water: 45,
    horse: 100, jeep_4wd: 280, camel: 100,
  },
}

export function CotationAdvancedPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [quotes,   setQuotes]   = useState<Quote[]>([])
  const [selectedQid, setSelectedQid] = useState<string | null>(null)
  const [view, setView] = useState<CotationFullView | null>(null)
  const [vehicles, setVehicles] = useState<VehicleT[]>([])
  const [tab, setTab] = useState<Tab>('pricing')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [recomputeForm, setRecomputeForm] = useState<RecomputePayload>(DEFAULT_RECOMPUTE)

  async function refreshProjects() {
    const r = await cotationApi.projectsWithQuotations()
    const projs: Project[] = []
    const allQuotes: Quote[] = []
    for (const p of r.data) {
      projs.push({ id: p.id, name: p.name })
      for (const q of p.quotations) {
        allQuotes.push({
          id: q.id, project_id: p.id,
          currency: q.currency ?? 'EUR', margin_pct: Number(q.margin_pct ?? 0),
        })
      }
    }
    setProjects(projs)
    setQuotes(allQuotes)
    if (!selectedQid && allQuotes[0]) setSelectedQid(allQuotes[0].id)
  }

  async function refreshFull(qid: string) {
    setBusy(true); setMsg('')
    try {
      const r = await cotationApi.fullView(qid)
      setView(r.data)
      const initialMarkup = Number(r.data.quotation.margin_pct || 8)
      const initialSS = Number(r.data.quotation.single_supplement || 315)
      const initialCur = r.data.quotation.currency || 'USD'
      setRecomputeForm(prev => ({
        ...prev, markup_pct: initialMarkup,
        single_supplement: initialSS, currency: initialCur,
      }))
    } catch (e: any) {
      setMsg(`erreur: ${e.message ?? 'API'}`)
    } finally { setBusy(false) }
  }

  async function refreshVehicles() {
    const r = await cotationApi.vehicles(true)
    setVehicles(r.data)
  }

  useEffect(() => { refreshProjects(); refreshVehicles() }, [])
  useEffect(() => { if (selectedQid) refreshFull(selectedQid) }, [selectedQid])

  async function recompute() {
    if (!selectedQid) return
    setBusy(true); setMsg('')
    try {
      await cotationApi.recomputeGrid(selectedQid, recomputeForm)
      await refreshFull(selectedQid)
      setMsg('grille recalculée')
    } catch (e: any) {
      setMsg(`erreur recompute: ${e.message ?? 'API'}`)
    } finally { setBusy(false) }
  }

  async function seedTerms() {
    if (!selectedQid) return
    setBusy(true)
    try {
      await cotationApi.seedStoursTerms(selectedQid)
      await refreshFull(selectedQid)
      setMsg('templates S\u2019TOURS chargés (13 sections)')
    } finally { setBusy(false) }
  }

  async function seedFleet() {
    setBusy(true)
    try {
      const r = await cotationApi.seedVehicleFleet()
      await refreshVehicles()
      setMsg(`flotte S\u2019TOURS — ${r.data.total} véhicules`)
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Cotation Avancée</h1>
            <p className="text-sm text-slate-500">
              Pricing grid PAX scaling · Catering pivot · T&amp;C structurés · Catalogue véhicules
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                <Sparkles className="h-3 w-3" /> inspiré S'TOURS YS Travel Morocco
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedQid ?? ''}
            onChange={e => setSelectedQid(e.target.value || null)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="">— sélectionner une cotation —</option>
            {quotes.map(q => {
              const proj = projects.find(p => p.id === q.project_id)
              return <option key={q.id} value={q.id}>{proj?.name ?? '?'} · {q.currency}</option>
            })}
          </select>
        </div>
      </header>

      {msg && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{msg}</div>
      )}

      {/* Summary cards */}
      {view && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard label="Lignes cotation" value={view.summary.total_lines} icon={Hotel} color="indigo" />
          <SummaryCard label="Brackets PAX"    value={view.summary.total_brackets} icon={Users} color="amber" />
          <SummaryCard label="Sections T&C"    value={view.summary.total_terms} icon={FileSignature} color="emerald" />
          <SummaryCard label="Devise"          value={view.quotation.currency} icon={Calculator} color="rose" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(Object.keys(TAB_META) as Tab[]).map(k => {
          const M = TAB_META[k]; const Icon = M.icon
          const active = tab === k
          return (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                active ? 'bg-amber-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon className="h-4 w-4" />
              <span>{M.label}</span>
              <span className={`text-xs ${active ? 'text-amber-100' : 'text-slate-400'}`}>· {M.sub}</span>
            </button>
          )
        })}
      </div>

      {/* Tab body */}
      {tab === 'pricing' && (
        <PricingTab view={view} form={recomputeForm} setForm={setRecomputeForm} onRecompute={recompute} busy={busy} />
      )}
      {tab === 'terms' && (
        <TermsTab view={view} onSeed={seedTerms} busy={busy} />
      )}
      {tab === 'vehicles' && (
        <VehiclesTab vehicles={vehicles} onSeed={seedFleet} busy={busy} />
      )}
      {tab === 'lines' && (
        <LinesTab view={view} />
      )}
    </div>
  )
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  const c: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-700', amber: 'from-amber-500 to-orange-600',
    emerald: 'from-emerald-500 to-emerald-700', rose: 'from-rose-500 to-rose-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${c[color]} text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  )
}

// ── Pricing tab ──────────────────────────────────────────────────────────────
function PricingTab({ view, form, setForm, onRecompute, busy }: {
  view: CotationFullView | null; form: RecomputePayload
  setForm: (p: RecomputePayload) => void
  onRecompute: () => void; busy: boolean
}) {
  const ext = form.extras_per_pax ?? {}
  const updExt = (k: string, v: number) => setForm({ ...form, extras_per_pax: { ...ext, [k]: v } })
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-800">Paramètres</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Markup %" value={form.markup_pct ?? 0} step={0.1}
                 onChange={v => setForm({ ...form, markup_pct: v })} />
          <Field label="SS (single)" value={form.single_supplement ?? 0}
                 onChange={v => setForm({ ...form, single_supplement: v })} />
          <Field label="Bus total" value={form.bus_total_cost ?? 0}
                 onChange={v => setForm({ ...form, bus_total_cost: v })} />
          <Field label="Tour Leader" value={form.tour_leader_cost ?? 0}
                 onChange={v => setForm({ ...form, tour_leader_cost: v })} />
          <Field label="Guide" value={form.guide_cost ?? 0}
                 onChange={v => setForm({ ...form, guide_cost: v })} />
          <Field label="Guide local" value={form.guide_local_cost ?? 0}
                 onChange={v => setForm({ ...form, guide_local_cost: v })} />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Extras /PAX</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(['hotel','restaurants','monuments','tips_lug','tips_rest','water','horse','jeep_4wd','camel'] as const).map(k => (
              <Field key={k} label={k.replace('_',' ')} value={Number(ext[k] ?? 0)}
                     onChange={v => updExt(k, v)} />
            ))}
          </div>
        </div>
        <button onClick={onRecompute} disabled={busy}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
          Recalculer la grille
        </button>
      </section>

      {/* Grid output */}
      <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Grille PAX scaling</h3>
          {view && <span className="text-xs text-slate-500">{view.brackets.length} bracket(s) · {view.quotation.currency}</span>}
        </div>
        {!view || view.brackets.length === 0 ? (
          <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
            Aucun bracket — clique sur « Recalculer la grille » pour générer 10/15/20/25/30/35 PAX.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">PAX</th>
                  <th className="px-2 py-2">FOC</th>
                  <th className="px-2 py-2">Hôtel</th>
                  <th className="px-2 py-2">Restau</th>
                  <th className="px-2 py-2">Monum</th>
                  <th className="px-2 py-2">Bus</th>
                  <th className="px-2 py-2">T/L</th>
                  <th className="px-2 py-2">Guide</th>
                  <th className="px-2 py-2">Sous-total</th>
                  <th className="px-2 py-2 text-right">Markup</th>
                  <th className="px-2 py-2 text-right">Prix /PAX</th>
                  <th className="px-2 py-2 text-right">SS</th>
                </tr>
              </thead>
              <tbody>
                {view.brackets.map(b => {
                  const bd = b.breakdown ?? {}
                  return (
                    <tr key={b.id} className="border-b border-slate-100 hover:bg-amber-50/40">
                      <td className="px-2 py-2 font-semibold">{b.pax_basis}</td>
                      <td className="px-2 py-2">+{b.foc_count}</td>
                      <td className="px-2 py-2 text-slate-600">{Number(bd.hotel || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 text-slate-600">{Number(bd.restaurants || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 text-slate-600">{Number(bd.monuments || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 text-slate-600">{Number(bd.bus || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 text-slate-600">{Number(bd.tour_leader || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 text-slate-600">{Number(bd.guide || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 font-medium text-slate-700">{Number(bd.subtotal || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 text-right text-amber-700">+{Number(bd.markup || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 text-right font-bold text-amber-700">{b.price_per_pax.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right text-slate-500">{b.single_supplement.toFixed(0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input type="number" step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </label>
  )
}

// ── Terms tab ────────────────────────────────────────────────────────────────
function TermsTab({ view, onSeed, busy }: { view: CotationFullView | null; onSeed: () => void; busy: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Termes &amp; Conditions</h3>
        <button onClick={onSeed} disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
          Charger les T&amp;C standard S'TOURS
        </button>
      </div>
      {!view || view.terms.length === 0 ? (
        <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
          Aucune section. Clique sur le bouton ci-dessus pour charger les 13 sections type S'TOURS
          (validity, paiement, acompte 20%, annulation, modifications, rooming list, force majeure,
          substitution hôtel, véhicules, services hôteliers, responsabilité, processus de réservation).
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {view.terms.map(t => (
            <article key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{t.section}</span>
                <h4 className="text-sm font-semibold text-slate-800">{t.title || t.section}</h4>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{t.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vehicles tab ─────────────────────────────────────────────────────────────
function VehiclesTab({ vehicles, onSeed, busy }: { vehicles: VehicleT[]; onSeed: () => void; busy: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Catalogue véhicules</h3>
        <button onClick={onSeed} disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
          Charger la flotte S'TOURS (7 véhicules)
        </button>
      </div>
      {vehicles.length === 0 ? (
        <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
          Aucun véhicule. Clique pour seeder Berline, Mini-van 4-7, Mini-bus 11/26 PAX, Autocar 39-48/54 PAX, 4×4 Land Cruiser.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map(v => {
            const Icon = v.type === 'sedan' ? Car : v.type === '4wd' ? Truck : Bus
            return (
              <article key={v.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-700 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{v.label}</h4>
                    <div className="text-xs text-slate-500">{v.type} · {v.capacity_min}–{v.capacity_max} PAX</div>
                  </div>
                </div>
                {v.brand_models && (
                  <p className="mt-2 text-xs italic text-slate-500">{v.brand_models}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span>tarif/km <b className="text-slate-700">{v.rate_per_km} {v.currency}</b></span>
                  {v.rate_per_day != null && (
                    <span>tarif/jour <b className="text-slate-700">{v.rate_per_day} {v.currency}</b></span>
                  )}
                </div>
                {v.specs && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {Object.entries(v.specs).slice(0, 6).map(([k, val]) => (
                      <span key={k} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {k}: {String(val)}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Lines tab ────────────────────────────────────────────────────────────────
function LinesTab({ view }: { view: CotationFullView | null }) {
  if (!view) return null
  if (view.lines.length === 0) {
    return (
      <div className="rounded-md bg-slate-50 p-6 text-center text-sm text-slate-500">
        Aucune ligne sur cette cotation. Ajoute des lignes via la console de cotation classique.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Jour</th>
            <th className="px-3 py-2">Catégorie</th>
            <th className="px-3 py-2">Label</th>
            <th className="px-3 py-2">Ville</th>
            <th className="px-3 py-2">Fournisseur</th>
            <th className="px-3 py-2 text-right">Coût unit</th>
            <th className="px-3 py-2 text-right">Qté</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {view.lines.map(l => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="px-3 py-2">{l.day_number ?? '—'}</td>
              <td className="px-3 py-2">
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{l.category}</span>
              </td>
              <td className="px-3 py-2">{l.label}</td>
              <td className="px-3 py-2 text-slate-500">{l.city ?? '—'}</td>
              <td className="px-3 py-2 text-slate-500">{l.supplier ?? '—'}</td>
              <td className="px-3 py-2 text-right">{l.unit_cost.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{l.quantity}</td>
              <td className="px-3 py-2 text-right font-semibold">{l.total_cost.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

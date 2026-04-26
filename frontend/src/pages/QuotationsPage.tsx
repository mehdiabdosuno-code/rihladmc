import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Download, Trash2, Calculator } from 'lucide-react'
import { quotationsApi, projectsApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge, Spinner, PriceDisplay, SectionTitle, Badge } from '@/components/ui'
import { MarginCalculator } from '@/components/analytics/SalesIntelligence'

const CATEGORIES = [
  { value: 'hotel',       label: '🏨 Hôtel',      unit: 'room' },
  { value: 'restaurant',  label: '🍽 Restaurant',  unit: 'pax' },
  { value: 'monument',    label: '🏛 Monument',    unit: 'pax' },
  { value: 'transport',   label: '🚌 Transport',   unit: 'group' },
  { value: 'guide',       label: '🧭 Guide',       unit: 'group' },
  { value: 'activity',    label: '🐪 Activité',    unit: 'pax' },
  { value: 'misc',        label: '📦 Divers',      unit: 'pax' },
]

const CURRENCY_SYM: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', MAD: 'MAD' }

function fmt(v: number | string | null | undefined, currency = 'EUR') {
  if (v == null) return '–'
  const num = typeof v === 'string' ? parseFloat(v) : v
  const sym = CURRENCY_SYM[currency] ?? currency
  return `${sym} ${new Intl.NumberFormat('fr-FR').format(Math.round(num))}`
}

export function QuotationsPage() {
  const qc = useQueryClient()
  const [selectedProject, setSelectedProject] = useState('')
  const [quotationId, setQuotationId] = useState('')
  const [pax, setPax] = useState(20)
  const [margin, setMargin] = useState(10)
  const [newLine, setNewLine] = useState({
    category: 'hotel', label: '', city: '', unit_cost: 0, quantity: 1, unit: 'room', day_number: 1,
  })
  const [calcResult, setCalcResult] = useState<any>(null)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => r.data?.items ?? []),
  })

  const { data: quotation, isLoading: quotLoading } = useQuery({
    queryKey: ['quotation', quotationId],
    queryFn: () => quotationsApi.get(quotationId).then(r => r.data),
    enabled: !!quotationId,
  })

  const createQuotation = useMutation({
    mutationFn: (data: any) => quotationsApi.create(data),
    onSuccess: (res) => {
      setQuotationId(res.data.id)
      qc.invalidateQueries({ queryKey: ['quotation'] })
    },
  })

  const addLine = useMutation({
    mutationFn: (data: any) => quotationsApi.addLine(quotationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation', quotationId] })
      setNewLine({ category: 'hotel', label: '', city: '', unit_cost: 0, quantity: 1, unit: 'room', day_number: 1 })
    },
  })

  const recalc = useMutation({
    mutationFn: () => quotationsApi.recalculate(quotationId, pax),
    onSuccess: (res) => {
      setCalcResult(res.data)
      qc.invalidateQueries({ queryKey: ['quotation', quotationId] })
    },
  })

  const updateMargin = useMutation({
    mutationFn: () => quotationsApi.update(quotationId, { margin_pct: margin }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotation', quotationId] }),
  })

  const currency = quotation?.currency ?? 'EUR'

  return (
    <div className="min-h-full">
      <PageHeader
        title="Moteur de cotation"
        subtitle="Calcul déterministe · Règle QA : somme des lignes = totaux affichés"
        actions={
          quotationId ? (
            <button onClick={() => recalc.mutate()} className="btn-primary" disabled={recalc.isPending}>
              {recalc.isPending ? <Spinner size={14} className="text-warm" /> : <RefreshCw size={14} />}
              Recalculer
            </button>
          ) : null
        }
      />

      <div className="p-8 space-y-5">

        {/* Step 1 — select project */}
        <div className="card p-5">
          <SectionTitle>1 · Projet source</SectionTitle>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <select
                className="input-base"
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
              >
                <option value="">Sélectionner un projet…</option>
                {projects?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.client_name ? `— ${p.client_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn-primary"
              disabled={!selectedProject || createQuotation.isPending}
              onClick={() => createQuotation.mutate({
                project_id: selectedProject,
                currency: 'EUR',
                margin_pct: margin,
              })}
            >
              <Plus size={14} />
              {quotationId ? 'Nouvelle version' : 'Créer cotation'}
            </button>
          </div>
        </div>

        {quotLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 rounded-lg p-4 animate-pulse">
                <div className="h-5 w-1/3 bg-slate-200/70 dark:bg-white/5 rounded mb-3" />
                <div className="h-4 w-2/3 bg-slate-200/70 dark:bg-white/5 rounded mb-2" />
                <div className="h-4 w-1/2 bg-slate-200/70 dark:bg-white/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {quotation && (
          <>
            {/* Step 2 — params */}
            <div className="grid grid-cols-3 gap-5">
              <div className="col-span-1 space-y-5">
                <div className="card p-5">
                  <SectionTitle>2 · Paramètres</SectionTitle>
                  <div className="space-y-4">
                    <div>
                      <label className="text-label text-muted block mb-1.5">PAX de référence</label>
                      <input type="number" className="input-base font-mono" value={pax} min={1} max={500}
                             onChange={e => setPax(+e.target.value)} />
                    </div>
                    <div>
                      <label className="text-label text-muted block mb-1.5">Devise</label>
                      <select className="input-base" value={quotation.currency}
                              onChange={e => quotationsApi.update(quotationId, { currency: e.target.value })}>
                        {['EUR','USD','MAD','GBP'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <MarginCalculator lines={quotation.lines} pax={pax} />
              </div>

              <div className="col-span-2">
                {/* Step 3 — lines */}
                <div className="card overflow-hidden h-full">
                  <div className="px-5 py-3 border-b border-line flex items-center justify-between">
                    <SectionTitle className="mb-0">3 · Lignes de coût</SectionTitle>
                    <StatusBadge status={quotation.status} />
                  </div>

                  {/* Add line form */}
                  <div className="px-5 py-3 border-b border-line bg-warm/40">
                    <div className="grid grid-cols-7 gap-2 items-end">
                      <div>
                        <label className="text-label text-muted block mb-1">Jour</label>
                        <input type="number" className="input-base font-mono text-xs" min={1}
                               value={newLine.day_number}
                               onChange={e => setNewLine(s => ({ ...s, day_number: +e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-label text-muted block mb-1">Catégorie</label>
                        <select className="input-base text-xs" value={newLine.category}
                                onChange={e => {
                                  const cat = CATEGORIES.find(c => c.value === e.target.value)
                                  setNewLine(s => ({ ...s, category: e.target.value, unit: cat?.unit ?? 'pax' }))
                                }}>
                          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-label text-muted block mb-1">Libellé</label>
                        <input className="input-base text-xs" placeholder="Hôtel Mamounia…"
                               value={newLine.label}
                               onChange={e => setNewLine(s => ({ ...s, label: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-label text-muted block mb-1">Ville</label>
                        <input className="input-base text-xs" placeholder="Marrakech"
                               value={newLine.city}
                               onChange={e => setNewLine(s => ({ ...s, city: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-label text-muted block mb-1">
                          Coût unit. ({currency})
                        </label>
                        <input type="number" className="input-base font-mono text-xs" min={0}
                               value={newLine.unit_cost}
                               onChange={e => setNewLine(s => ({ ...s, unit_cost: +e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-label text-muted block mb-1">Qté</label>
                        <div className="flex gap-1">
                          <input type="number" className="input-base font-mono text-xs" min={0}
                                 value={newLine.quantity}
                                 onChange={e => setNewLine(s => ({ ...s, quantity: +e.target.value }))} />
                          <button className="btn-primary btn-sm px-3"
                                  onClick={() => addLine.mutate(newLine)}
                                  disabled={!newLine.label || addLine.isPending}>
                            {addLine.isPending ? <Spinner size={12} className="text-warm" /> : <Plus size={13} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lines table */}
                  <div className="overflow-y-auto max-h-[500px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-line">
                          {['J.','Catégorie','Libellé','Ville','Coût unit.','Qté','Total'].map(h => (
                            <th key={h} className="text-left text-label text-muted px-4 py-2.5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {quotation.lines?.length === 0 ? (
                          <tr><td colSpan={7} className="text-center text-muted py-8">
                            Aucune ligne — ajoutez des coûts ci-dessus
                          </td></tr>
                        ) : quotation.lines?.map((l: any) => (
                          <tr key={l.id} className="border-b border-line/50 hover:bg-warm/40 transition-colors">
                            <td className="px-4 py-2 font-mono text-muted">{l.day_number ?? '–'}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded-pill text-[10px] font-semibold
                                ${l.category === 'hotel'      ? 'bg-amber-50 text-amber-700'  :
                                  l.category === 'transport'  ? 'bg-blue-50 text-blue-700'   :
                                  l.category === 'restaurant' ? 'bg-green-50 text-green-700' :
                                  'bg-warm text-muted'}`}>
                                {l.category}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-medium text-ink">{l.label}</td>
                            <td className="px-4 py-2 text-muted">{l.city ?? '–'}</td>
                            <td className="px-4 py-2 font-mono">{fmt(l.unit_cost, currency)}</td>
                            <td className="px-4 py-2 font-mono text-muted">{l.quantity} {l.unit}</td>
                            <td className="px-4 py-2 font-mono font-semibold text-ink">
                              {fmt(l.total_cost, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            {calcResult && (
              <>
                {/* Cost breakdown */}
                <div className="card p-5">
                  <SectionTitle>4 · Ventilation des coûts</SectionTitle>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {Object.entries(calcResult.breakdown ?? {})
                      .filter(([, v]: any) => v > 0)
                      .map(([cat, val]: any) => (
                        <div key={cat} className="card-warm px-4 py-3 rounded-card">
                          <p className="text-label text-muted mb-1 capitalize">{cat}</p>
                          <p className="font-mono font-semibold text-ink">{fmt(val, currency)}</p>
                        </div>
                      ))
                    }
                  </div>
                  <div className="flex gap-6 pt-3 border-t border-line">
                    <PriceDisplay value={calcResult.total_cost}    currency={currency} label="Coût total" size="md" />
                    <PriceDisplay value={calcResult.total_selling} currency={currency} label="Prix de vente" size="lg" />
                    <PriceDisplay value={calcResult.price_per_pax} currency={currency} label={`Prix / pax (base ${pax})`} size="md" />
                  </div>
                </div>

                {/* Pricing grid */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-line">
                    <SectionTitle className="mb-0">5 · Grille tarifaire</SectionTitle>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink text-warm">
                        {['Base', 'PAX réels', 'Prix / pax', 'Suppl. SGL', 'Total groupe', 'Marge / pax'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {calcResult.pricing_grid?.map((row: any, i: number) => (
                        <tr key={i} className={`border-b border-line ${i % 2 === 0 ? '' : 'bg-warm/40'}`}>
                          <td className="px-5 py-3 font-semibold">{row.basis}+{row.foc} FOC</td>
                          <td className="px-5 py-3 font-mono text-muted">{row.basis}</td>
                          <td className="px-5 py-3">
                            <span className="font-serif text-xl font-bold text-bordeaux">
                              {fmt(row.price_pax, currency)}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-mono">{fmt(row.single_supplement, currency)}</td>
                          <td className="px-5 py-3 font-mono text-muted">{fmt(row.total_group, currency)}</td>
                          <td className="px-5 py-3">
                            <span className="text-green-700 font-mono font-medium">
                              +{fmt(row.margin_per_pax, currency)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

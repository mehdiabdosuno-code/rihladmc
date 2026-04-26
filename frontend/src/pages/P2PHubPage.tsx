import { useEffect, useMemo, useState } from 'react'
import {
  ShoppingCart, FileSignature, PackageCheck, ReceiptText,
  GitMerge, BarChart3, RefreshCw, Loader2, Sparkles,
  CheckCircle2, AlertTriangle, Circle, Truck, Hotel, Utensils,
  MapPin, UserCheck, Package, Send, ChevronRight,
} from 'lucide-react'
import {
  p2pApi, type P2PAnalytics, type P2PPR, type P2PPO, type P2PMatch,
} from '@/lib/api'

const TABS = [
  { id: 'overview',  label: "Vue d'ensemble",   icon: BarChart3 },
  { id: 'pr',        label: "Demandes d'achat", icon: FileSignature },
  { id: 'po',        label: 'Bons de commande', icon: ShoppingCart },
  { id: 'match',     label: '3-Way Match',      icon: GitMerge },
  { id: 'spend',     label: 'Spend Analytics',  icon: Sparkles },
] as const
type TabId = typeof TABS[number]['id']

const CAT_ICONS: Record<string, React.ElementType> = {
  hotel: Hotel, transport: Truck, restaurant: Utensils,
  activity: MapPin, guide: UserCheck, other: Package,
}

const PR_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Brouillon', cls: 'bg-slate-100 text-slate-700' },
  submitted: { label: 'Soumise',   cls: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approuvée', cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { label: 'Rejetée',   cls: 'bg-rose-100 text-rose-700' },
  sourced:   { label: 'Commandée', cls: 'bg-violet-100 text-violet-700' },
  cancelled: { label: 'Annulée',   cls: 'bg-slate-100 text-slate-600' },
}

const PO_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft:               { label: 'Brouillon',      cls: 'bg-slate-100 text-slate-700' },
  sent:                { label: 'Envoyé',         cls: 'bg-blue-100 text-blue-700' },
  acknowledged:        { label: 'Confirmé',       cls: 'bg-cyan-100 text-cyan-700' },
  partially_received:  { label: 'Réception part.', cls: 'bg-amber-100 text-amber-700' },
  received:            { label: 'Reçu',           cls: 'bg-emerald-100 text-emerald-700' },
  closed:              { label: 'Clôturé',        cls: 'bg-slate-100 text-slate-700' },
  cancelled:           { label: 'Annulé',         cls: 'bg-rose-100 text-rose-700' },
}

const MATCH_STATUS_LABEL: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  matched:     { label: '3-Way Match OK',  cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
  partial:     { label: 'Match partiel',   cls: 'bg-amber-50 border-amber-200 text-amber-700',       icon: Circle },
  discrepancy: { label: 'Écart détecté',   cls: 'bg-rose-50 border-rose-200 text-rose-700',          icon: AlertTriangle },
  unmatched:   { label: 'Non rapproché',   cls: 'bg-slate-50 border-slate-200 text-slate-600',       icon: Circle },
}

function fmtMoney(n: number, cur = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n)
}

export function P2PHubPage() {
  const [tab, setTab] = useState<TabId>('overview')
  const [analytics, setAnalytics] = useState<P2PAnalytics | null>(null)
  const [prs, setPrs] = useState<P2PPR[]>([])
  const [pos, setPos] = useState<P2PPO[]>([])
  const [matches, setMatches] = useState<P2PMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [filter, setFilter] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const [a, p, o, m] = await Promise.all([
        p2pApi.analytics(),
        p2pApi.prList({ limit: 100 }),
        p2pApi.poList({ limit: 100 }),
        p2pApi.matches(),
      ])
      setAnalytics(a.data); setPrs(p.data); setPos(o.data); setMatches(m.data)
    } finally { setLoading(false) }
  }

  async function seed() {
    setSeeding(true)
    try {
      await p2pApi.seedDemo()
      await refresh()
    } finally { setSeeding(false) }
  }

  useEffect(() => { refresh() }, [])

  async function handleApprove(id: string) {
    await p2pApi.prApprove(id); await refresh()
  }
  async function handleReject(id: string) {
    await p2pApi.prReject(id); await refresh()
  }
  async function handleEmitPO(prId: string) {
    await p2pApi.poFromPR({ requisition_id: prId })
    setTab('po')
    await refresh()
  }

  const filteredPRs = useMemo(() => {
    const t = filter.trim().toLowerCase()
    if (!t) return prs
    return prs.filter(p =>
      p.title.toLowerCase().includes(t) ||
      (p.supplier_name ?? '').toLowerCase().includes(t) ||
      p.reference.toLowerCase().includes(t)
    )
  }, [prs, filter])

  const filteredPOs = useMemo(() => {
    const t = filter.trim().toLowerCase()
    if (!t) return pos
    return pos.filter(p =>
      p.supplier_name.toLowerCase().includes(t) ||
      p.reference.toLowerCase().includes(t)
    )
  }, [pos, filter])

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-rose-700 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Procure-to-Pay · Cockpit fournisseurs</h1>
            <p className="text-sm text-slate-500">Cycle complet : demande d'achat → bon de commande → réception → facture → 3-way match</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={seed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            title="Re-seed les données de démo"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Réinitialiser démo
          </button>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </header>

      {/* KPI hero */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Engagement (POs)"   value={fmtMoney(analytics.stats.spend_committed, analytics.stats.currency)} hint={`${analytics.stats.po_total} bons de commande`} accent="indigo" />
          <KPI label="Réceptions"          value={fmtMoney(analytics.stats.spend_received,  analytics.stats.currency)} hint={`${analytics.stats.po_received} POs reçus`} accent="emerald" />
          <KPI label="Facturé fournisseur" value={fmtMoney(analytics.stats.spend_invoiced,  analytics.stats.currency)} hint={`${analytics.stats.invoices_received} factures · ${analytics.stats.invoices_paid} payées`} accent="amber" />
          <KPI label="Santé matching"       value={`${analytics.matching_health.matched_pct}%`} hint={`${analytics.stats.matched_count} match · ${analytics.stats.discrepancies} écarts`} accent={analytics.stats.discrepancies > 0 ? 'rose' : 'emerald'} />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && analytics && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><GitMerge className="w-4 h-4 text-amber-600" /> Santé du rapprochement (3-way match)</h3>
            <div className="space-y-3">
              <BarRow label="Match parfait"  pct={analytics.matching_health.matched_pct}     color="emerald" />
              <BarRow label="Match partiel"  pct={analytics.matching_health.partial_pct}     color="amber" />
              <BarRow label="Écart détecté"  pct={analytics.matching_health.discrepancy_pct} color="rose" />
              <BarRow label="Non rapproché"  pct={analytics.matching_health.unmatched_pct}   color="slate" />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
              <Stat label="POs ouverts" value={analytics.stats.po_open.toString()} />
              <Stat label="PR en attente d'approbation" value={analytics.stats.pr_pending_approval.toString()} accent="amber" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-amber-600" /> Opportunités de négociation</h3>
            {analytics.savings_opportunities.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune opportunité détectée. Continue à construire l'historique d'achats.</p>
            ) : (
              <ul className="space-y-3">
                {analytics.savings_opportunities.map((o, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <Sparkles className="w-4 h-4 text-amber-600 mt-1" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{o.supplier}</div>
                      <p className="text-xs text-slate-600 mt-0.5">{o.rationale}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-700">~{fmtMoney(o.estimated_savings, o.currency)}</div>
                      <div className="text-[10px] text-slate-500">économie potentielle</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><Package className="w-4 h-4 text-amber-600" /> Répartition par catégorie</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {analytics.by_category.map(c => {
                const Icon = CAT_ICONS[c.category] ?? Package
                return (
                  <div key={c.category} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">{c.category}</span>
                    </div>
                    <div className="mt-2 text-lg font-semibold">{fmtMoney(c.spend, analytics.stats.currency)}</div>
                    <div className="text-xs text-slate-500">{c.count} demande(s)</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* PR LIST */}
      {tab === 'pr' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-3">
            <input
              placeholder="Rechercher demande, titre, fournisseur…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-80"
            />
            <span className="text-sm text-slate-500">{filteredPRs.length} demande(s)</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-left px-4 py-3">Demande</th>
                  <th className="text-left px-4 py-3">Fournisseur</th>
                  <th className="text-left px-4 py-3">Cat.</th>
                  <th className="text-right px-4 py-3">Quantité</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPRs.map(pr => {
                  const s = PR_STATUS_LABEL[pr.status] ?? PR_STATUS_LABEL.draft
                  const Icon = CAT_ICONS[pr.category] ?? Package
                  return (
                    <tr key={pr.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{pr.reference}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{pr.title}</div>
                        {pr.needed_by && <div className="text-xs text-slate-500">échéance {pr.needed_by}</div>}
                      </td>
                      <td className="px-4 py-3">{pr.supplier_name ?? '—'}</td>
                      <td className="px-4 py-3"><Icon className="w-4 h-4 text-slate-500" /></td>
                      <td className="px-4 py-3 text-right">{pr.qty} {pr.unit}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtMoney(pr.total, pr.currency)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {pr.status === 'submitted' && (
                          <>
                            <button onClick={() => handleApprove(pr.id)} className="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 mr-1">Approuver</button>
                            <button onClick={() => handleReject(pr.id)} className="text-xs px-2 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50">Rejeter</button>
                          </>
                        )}
                        {pr.status === 'approved' && (
                          <button onClick={() => handleEmitPO(pr.id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700">
                            <Send className="w-3 h-3" /> Émettre PO
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredPRs.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-500">Aucune demande d'achat. Cliquez sur "Réinitialiser démo" pour seeder 12 PRs de démonstration.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PO LIST */}
      {tab === 'po' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-3">
            <input
              placeholder="Rechercher PO ou fournisseur…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-80"
            />
            <span className="text-sm text-slate-500">{filteredPOs.length} bon(s) de commande</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-left px-4 py-3">Fournisseur</th>
                  <th className="text-left px-4 py-3">Émis le</th>
                  <th className="text-left px-4 py-3">Livraison prévue</th>
                  <th className="text-left px-4 py-3">Conditions</th>
                  <th className="text-right px-4 py-3">Montant</th>
                  <th className="text-left px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPOs.map(po => {
                  const s = PO_STATUS_LABEL[po.status] ?? PO_STATUS_LABEL.draft
                  return (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{po.reference}</td>
                      <td className="px-4 py-3 font-medium">{po.supplier_name}</td>
                      <td className="px-4 py-3">{po.issue_date ?? '—'}</td>
                      <td className="px-4 py-3">{po.expected_delivery ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">{po.payment_terms}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtMoney(po.total, po.currency)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span></td>
                    </tr>
                  )
                })}
                {filteredPOs.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">Aucun bon de commande pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3-WAY MATCH */}
      {tab === 'match' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Le rapprochement à 3 voies vérifie que <strong>PO + réception fournisseur + facture</strong> correspondent (à 1 % près).
            Toute discordance déclenche une alerte.
          </p>
          <div className="grid gap-3">
            {matches.map(m => {
              const cfg = MATCH_STATUS_LABEL[m.status] ?? MATCH_STATUS_LABEL.unmatched
              const Icon = cfg.icon
              return (
                <div key={m.po_id} className={`rounded-xl border p-4 ${cfg.cls}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white">{m.po_reference}</span>
                        <span className="font-semibold text-sm">{m.supplier_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-white border">{cfg.label}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-slate-500">PO</div>
                          <div className="font-semibold">{fmtMoney(m.po_amount, m.currency)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-slate-500">Réception</div>
                          <div className={m.has_receipt ? 'font-semibold' : 'text-slate-400'}>{m.has_receipt ? fmtMoney(m.receipt_amount, m.currency) : '—'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-slate-500">Facture fournisseur</div>
                          <div className={m.has_invoice ? 'font-semibold' : 'text-slate-400'}>{m.has_invoice ? fmtMoney(m.invoice_amount, m.currency) : '—'}</div>
                        </div>
                      </div>
                      {m.status === 'discrepancy' && (
                        <div className="mt-3 text-xs text-rose-700 bg-white/70 rounded px-3 py-2">
                          ⚠ Écart de {fmtMoney(m.variance_amount, m.currency)} ({m.variance_pct}%) — vérifier la facture fournisseur.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {matches.length === 0 && (
              <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                Aucun bon de commande à rapprocher. Émettez un PO depuis l'onglet "Demandes d'achat".
              </div>
            )}
          </div>
        </div>
      )}

      {/* SPEND ANALYTICS */}
      {tab === 'spend' && analytics && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-amber-600" /> Top fournisseurs (par montant engagé)</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2">Fournisseur</th>
                  <th className="text-right py-2">POs</th>
                  <th className="text-right py-2">Engagé</th>
                  <th className="text-right py-2">Reçu</th>
                  <th className="text-right py-2">Payé</th>
                  <th className="text-right py-2">PO moyen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.top_suppliers.map((s, i) => (
                  <tr key={i}>
                    <td className="py-3 font-medium">{s.supplier_name}</td>
                    <td className="py-3 text-right">{s.po_count}</td>
                    <td className="py-3 text-right font-semibold">{fmtMoney(s.spend_total, s.currency)}</td>
                    <td className="py-3 text-right">{fmtMoney(s.spend_received, s.currency)}</td>
                    <td className="py-3 text-right">{fmtMoney(s.spend_paid, s.currency)}</td>
                    <td className="py-3 text-right text-slate-500">{fmtMoney(s.avg_po_value, s.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: 'indigo'|'emerald'|'amber'|'rose' }) {
  const accents = {
    indigo: 'from-indigo-500/10 to-indigo-500/0 text-indigo-700',
    emerald:'from-emerald-500/10 to-emerald-500/0 text-emerald-700',
    amber:  'from-amber-500/10 to-amber-500/0 text-amber-700',
    rose:   'from-rose-500/10 to-rose-500/0 text-rose-700',
  }
  return (
    <div className={`rounded-xl border border-slate-200 bg-gradient-to-br ${accents[accent ?? 'indigo']} p-4`}>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'amber' }) {
  return (
    <div className={`rounded-lg border p-3 ${accent === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-semibold mt-1">{value}</div>
    </div>
  )
}

function BarRow({ label, pct, color }: { label: string; pct: number; color: 'emerald'|'amber'|'rose'|'slate' }) {
  const colors = {
    emerald: 'bg-emerald-500', amber: 'bg-amber-500',
    rose: 'bg-rose-500', slate: 'bg-slate-400',
  }
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

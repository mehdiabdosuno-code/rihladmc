import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Database, RefreshCw, Loader2, Sparkles,
  FolderKanban, FileText, Receipt, Map, Image as ImageIcon,
  ShoppingCart, Package, FileSignature, ArrowRight,
} from 'lucide-react'
import {
  dataHubApi,
  type DataHubHit, type DataHubSearch, type DataHubStats, type DataHubSuggestion,
} from '@/lib/api'

const MODULE_META: Record<string, { label: string; icon: React.ElementType; color: string; href: (h: DataHubHit) => string }> = {
  project:              { label: 'Dossier',           icon: FolderKanban, color: 'bg-blue-100 text-blue-700',         href: (h) => `/projects/${h.source_id}` },
  quotation:            { label: 'Devis',             icon: FileText,     color: 'bg-violet-100 text-violet-700',     href: (h) => h.project_id ? `/projects/${h.project_id}` : '#' },
  invoice:              { label: 'Facture',           icon: Receipt,      color: 'bg-amber-100 text-amber-700',       href: (h) => h.project_id ? `/projects/${h.project_id}` : '#' },
  itinerary:            { label: 'Itinéraire',        icon: Map,          color: 'bg-emerald-100 text-emerald-700',   href: (h) => h.project_id ? `/projects/${h.project_id}` : '#' },
  media:                { label: 'Bibliothèque',      icon: ImageIcon,    color: 'bg-pink-100 text-pink-700',         href: () => '/media-library' },
  purchase_requisition: { label: "Demande d'achat",   icon: FileSignature,color: 'bg-cyan-100 text-cyan-700',         href: () => '/p2p' },
  purchase_order:       { label: 'Bon de commande',   icon: ShoppingCart, color: 'bg-indigo-100 text-indigo-700',     href: () => '/p2p' },
  supplier_invoice:     { label: 'Facture fournisseur', icon: Receipt,    color: 'bg-rose-100 text-rose-700',         href: () => '/p2p' },
}

function fmtMoney(n: number | null, cur: string | null): string {
  if (n == null) return ''
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur ?? 'EUR', maximumFractionDigits: 0 }).format(n)
}

export function DataHubPage() {
  const [stats, setStats] = useState<DataHubStats | null>(null)
  const [sugg, setSugg]   = useState<DataHubSuggestion[]>([])
  const [q, setQ]         = useState('')
  const [activeQ, setActiveQ] = useState('')
  const [results, setResults] = useState<DataHubSearch | null>(null)
  const [searching, setSearching] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [moduleFilter, setModuleFilter] = useState<string | null>(null)

  async function loadStats() {
    const [s, su] = await Promise.all([dataHubApi.stats(), dataHubApi.suggestions()])
    setStats(s.data); setSugg(su.data)
  }

  useEffect(() => { loadStats() }, [])

  async function search(query: string, mods?: string | null) {
    if (!query.trim()) return
    setSearching(true); setActiveQ(query)
    try {
      const { data } = await dataHubApi.search(query, mods ? { modules: mods } : undefined)
      setResults(data)
    } finally { setSearching(false) }
  }

  async function reindex() {
    setReindexing(true)
    try {
      await dataHubApi.reindex()
      await loadStats()
      if (activeQ) await search(activeQ, moduleFilter)
    } finally { setReindexing(false) }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModuleFilter(null)
    search(q, null)
  }

  function applyModuleFilter(mod: string | null) {
    setModuleFilter(mod)
    if (activeQ) search(activeQ, mod)
  }

  const filteredHits = useMemo(() => results?.hits ?? [], [results])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-700 flex items-center justify-center">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Hub · Recherche unifiée</h1>
            <p className="text-sm text-slate-500">
              Index transverse — dossiers, devis, factures, itinéraires, bibliothèque, achats fournisseurs.
            </p>
          </div>
        </div>
        <button
          onClick={reindex}
          disabled={reindexing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {reindexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Réindexer
        </button>
      </header>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatBox label="Documents" value={stats.total_documents.toString()} accent />
          {Object.entries(stats.by_module).map(([m, c]) => {
            const meta = MODULE_META[m]
            const Icon = meta?.icon ?? Package
            return (
              <div key={m} className="rounded-lg border border-slate-200 bg-white p-3">
                <Icon className="w-4 h-4 text-slate-500" />
                <div className="text-xs text-slate-500 mt-1 truncate" title={meta?.label ?? m}>{meta?.label ?? m}</div>
                <div className="font-semibold">{c}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Search box */}
      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3 items-center">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          autoFocus
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Cherchez un dossier, fournisseur, destination, facture, photo… (ex: Royal Mansour, Sahara, devis Marrakech)"
          className="flex-1 outline-none text-base"
        />
        <button type="submit" disabled={searching || !q.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Rechercher
        </button>
      </form>

      {/* Suggestions when no active query */}
      {!results && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
            <Sparkles className="w-4 h-4 text-violet-600" /> Suggestions de recherche
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sugg.map((s, i) => (
              <button key={i}
                      onClick={() => { setQ(s.query); search(s.query) }}
                      className="text-left rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 p-3 transition-colors">
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-xs text-slate-500 mt-1">{s.description}</div>
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-violet-600">
                  → {s.query} <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Facets */}
          <aside className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="font-semibold text-sm mb-3">Filtrer par module</h4>
              <ul className="space-y-1">
                <li>
                  <button onClick={() => applyModuleFilter(null)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm ${moduleFilter === null ? 'bg-violet-100 text-violet-700' : 'hover:bg-slate-50'}`}>
                    <span>Tous les modules</span>
                    <span className="text-xs text-slate-500">{results.total}</span>
                  </button>
                </li>
                {Object.entries(results.facets.by_module).map(([mod, count]) => {
                  const meta = MODULE_META[mod]
                  const Icon = meta?.icon ?? Package
                  return (
                    <li key={mod}>
                      <button onClick={() => applyModuleFilter(mod)}
                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm ${moduleFilter === mod ? 'bg-violet-100 text-violet-700' : 'hover:bg-slate-50'}`}>
                        <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" /> {meta?.label ?? mod}</span>
                        <span className="text-xs text-slate-500">{count}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            {Object.keys(results.facets.by_status).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-sm mb-3">Statut</h4>
                <ul className="space-y-1 text-sm">
                  {Object.entries(results.facets.by_status).map(([s, c]) => (
                    <li key={s} className="flex justify-between text-slate-600"><span>{s}</span><span className="text-xs text-slate-400">{c}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {Object.keys(results.facets.by_destination).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-sm mb-3">Destination</h4>
                <ul className="space-y-1 text-sm">
                  {Object.entries(results.facets.by_destination).map(([d, c]) => (
                    <li key={d} className="flex justify-between text-slate-600"><span>{d}</span><span className="text-xs text-slate-400">{c}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* Results list */}
          <div className="space-y-3">
            <div className="text-sm text-slate-500">
              <strong className="text-slate-900">{results.total}</strong> résultat(s) pour <em>"{results.query}"</em>
              {moduleFilter && <span> · filtré par <strong>{MODULE_META[moduleFilter]?.label ?? moduleFilter}</strong></span>}
            </div>
            {filteredHits.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                Aucun résultat. Essayez d'élargir la recherche ou cliquez sur "Réindexer" pour repeupler l'index.
              </div>
            )}
            {filteredHits.map(h => {
              const meta = MODULE_META[h.source_module]
              const Icon = meta?.icon ?? Package
              const href = meta?.href(h) ?? '#'
              return (
                <Link key={h.id} to={href}
                      className="block bg-white rounded-xl border border-slate-200 hover:border-violet-300 hover:shadow-sm transition-all p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg ${meta?.color ?? 'bg-slate-100 text-slate-700'} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${meta?.color ?? 'bg-slate-100 text-slate-700'}`}>
                          {meta?.label ?? h.source_module}
                        </span>
                        <h3 className="font-semibold truncate">{h.title}</h3>
                        <span className="text-[10px] text-slate-400 font-mono ml-auto shrink-0">score {h.score.toFixed(2)}</span>
                      </div>
                      {h.snippet && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{h.snippet}</p>}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        {h.client_name   && <span>👤 {h.client_name}</span>}
                        {h.destination   && <span>📍 {h.destination}</span>}
                        {h.amount != null && <span className="font-semibold text-slate-700">{fmtMoney(h.amount, h.currency)}</span>}
                        {h.status        && <span className="px-1.5 py-0.5 bg-slate-100 rounded">{h.status}</span>}
                        {h.occurred_at   && <span>{h.occurred_at.slice(0, 10)}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${accent ? 'border-2 border-violet-300 bg-violet-50' : 'border border-slate-200 bg-white'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}

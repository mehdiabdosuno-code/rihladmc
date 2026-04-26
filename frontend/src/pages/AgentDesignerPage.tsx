import { useEffect, useMemo, useState } from 'react'
import {
  Bot, Sparkles, Play, RefreshCw, Plus, Trash2, ChevronRight,
  CheckCircle2, XCircle, Loader2, Clock, Zap, Database,
  Mail, MessageSquare, ListChecks, Brain, FileText, Filter, GitBranch,
  AlertTriangle, Receipt, ArrowDown, Search,
} from 'lucide-react'
import { agentDesignerApi, type Agent, type AgentCatalog, type AgentRun } from '@/lib/api'

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  trigger: { label: 'Déclencheurs', color: 'bg-violet-100 text-violet-700' },
  data:    { label: 'Sources',      color: 'bg-blue-100 text-blue-700' },
  logic:   { label: 'Logique',      color: 'bg-amber-100 text-amber-700' },
  action:  { label: 'Actions',      color: 'bg-emerald-100 text-emerald-700' },
}

const TYPE_ICON: Record<string, React.ElementType> = {
  'trigger.manual':    Zap,         'trigger.schedule': Clock,         'trigger.event': Sparkles,
  'data.search_hub':   Search,      'data.invoices_overdue': Receipt,
  'data.po_with_discrepancy': AlertTriangle, 'data.projects_at_risk': FileText,
  'logic.if_count':    GitBranch,   'logic.foreach': ListChecks,       'logic.wait_days': Clock,
  'action.send_email': Mail,        'action.notify_teams': MessageSquare,
  'action.create_task': ListChecks, 'action.llm_summary': Brain,       'action.log': Filter,
}

const COLOR_SWATCH: Record<string, string> = {
  violet: 'from-violet-600 to-fuchsia-700',
  amber:  'from-amber-500 to-orange-600',
  rose:   'from-rose-500 to-red-600',
  orange: 'from-orange-500 to-amber-600',
  emerald:'from-emerald-500 to-teal-600',
}

function nodeColor(type: string): string {
  const cat = type.split('.')[0]
  return CATEGORY_META[cat]?.color ?? 'bg-slate-100 text-slate-700'
}

export function AgentDesignerPage() {
  const [agents, setAgents]       = useState<Agent[]>([])
  const [catalog, setCatalog]     = useState<AgentCatalog | null>(null)
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [runResult, setRunResult] = useState<AgentRun | null>(null)
  const [history, setHistory]     = useState<AgentRun[]>([])
  const [running, setRunning]     = useState(false)
  const [seeding, setSeeding]     = useState(false)
  const [loading, setLoading]     = useState(true)

  const active = useMemo(() => agents.find(a => a.id === activeId) ?? null, [agents, activeId])

  async function refresh() {
    setLoading(true)
    try {
      const [list, cat] = await Promise.all([agentDesignerApi.list(), agentDesignerApi.catalog()])
      setAgents(list.data); setCatalog(cat.data)
      if (!activeId && list.data.length > 0) setActiveId(list.data[0].id)
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (!activeId) { setHistory([]); setRunResult(null); return }
    agentDesignerApi.runs(activeId).then(r => setHistory(r.data)).catch(() => {})
  }, [activeId])

  async function seed() {
    setSeeding(true)
    try { await agentDesignerApi.seedTemplates(); await refresh() }
    finally { setSeeding(false) }
  }

  async function runNow() {
    if (!activeId) return
    setRunning(true); setRunResult(null)
    try {
      const { data } = await agentDesignerApi.run(activeId)
      setRunResult(data)
      const hist = await agentDesignerApi.runs(activeId); setHistory(hist.data)
    } finally { setRunning(false) }
  }

  async function removeAgent(id: string) {
    if (!confirm('Supprimer cet agent ?')) return
    await agentDesignerApi.remove(id)
    setActiveId(null); refresh()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-700 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Joule Agent Designer</h1>
            <p className="text-sm text-slate-500">
              Composez des agents IA no-code · DAG visuel · 15 types de nœuds (déclencheurs, sources, logique, actions).
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={seed} disabled={seeding}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50">
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Charger les templates
          </button>
        </div>
      </header>

      {agents.length === 0 && !loading && (
        <div className="bg-white rounded-xl border-2 border-dashed border-violet-300 p-10 text-center">
          <Sparkles className="w-12 h-12 text-violet-500 mx-auto" />
          <h3 className="font-semibold text-lg mt-3">Aucun agent encore configuré</h3>
          <p className="text-sm text-slate-500 mt-1">
            Cliquez sur <strong>"Charger les templates"</strong> pour démarrer avec 4 agents pré-configurés.
          </p>
          <button onClick={seed} disabled={seeding}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Démarrer
          </button>
        </div>
      )}

      {agents.length > 0 && (
        <div className="grid lg:grid-cols-[260px_1fr_300px] gap-6">
          {/* Agent list */}
          <aside className="bg-white rounded-xl border border-slate-200 p-3 space-y-1">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Mes agents</div>
            {agents.map(a => (
              <button key={a.id}
                      onClick={() => { setActiveId(a.id); setRunResult(null) }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 ${activeId === a.id ? 'bg-violet-50 border border-violet-200' : 'hover:bg-slate-50'}`}>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${COLOR_SWATCH[a.color ?? 'violet']} flex items-center justify-center shrink-0`}>
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{a.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className={`px-1.5 rounded ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>{a.status}</span>
                    <span>·</span>
                    <span>{a.trigger}</span>
                    <span>·</span>
                    <span>{a.nodes.length} étapes</span>
                  </div>
                </div>
              </button>
            ))}
          </aside>

          {/* DAG canvas */}
          <main className="bg-white rounded-xl border border-slate-200 p-6">
            {active && <AgentDAG agent={active} runResult={runResult} />}
            {active && (
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-3">
                <button onClick={runNow} disabled={running}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Exécuter maintenant
                </button>
                {runResult && (
                  <div className={`text-sm ${runResult.status === 'success' ? 'text-emerald-700' : 'text-rose-700'} font-medium`}>
                    {runResult.status === 'success' ? '✓' : '✗'} {runResult.status} · {runResult.duration_ms} ms
                  </div>
                )}
                <button onClick={() => removeAgent(active.id)}
                        className="ml-auto inline-flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              </div>
            )}
          </main>

          {/* Right: catalog + run history */}
          <aside className="space-y-4">
            {catalog && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  Palette de nœuds
                </h4>
                {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                  const items = catalog.nodes.filter(n => n.category === cat)
                  if (items.length === 0) return null
                  return (
                    <div key={cat} className="mb-3 last:mb-0">
                      <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${meta.color.split(' ')[1]}`}>{meta.label} ({items.length})</div>
                      <ul className="space-y-1">
                        {items.map(n => {
                          const Icon = TYPE_ICON[n.type] ?? Bot
                          return (
                            <li key={n.type} className="flex items-center gap-2 text-xs text-slate-700">
                              <Icon className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate" title={n.description}>{n.label}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                Historique des runs
              </h4>
              {history.length === 0 && <div className="text-xs text-slate-500">Aucun run pour le moment.</div>}
              <ul className="space-y-2">
                {history.slice(0, 8).map(r => (
                  <li key={r.id} className="text-xs flex items-center justify-between border-l-2 pl-2"
                      style={{ borderColor: r.status === 'success' ? '#10b981' : '#ef4444' }}>
                    <div>
                      <div className="font-medium">
                        {r.status === 'success' ? '✓ succès' : '✗ échec'} ({r.duration_ms} ms)
                      </div>
                      <div className="text-slate-500">{r.started_at?.slice(0, 19)}</div>
                    </div>
                    <span className="text-slate-400">{r.trace.length} étape(s)</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function AgentDAG({ agent, runResult }: { agent: Agent; runResult: AgentRun | null }) {
  const traceById: Record<string, AgentRun['trace'][0]> = {}
  if (runResult) for (const t of runResult.trace) traceById[t.node_id] = t

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{agent.description}</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-slate-100 rounded">{agent.trigger}</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded">{agent.nodes.length} étapes</span>
            <span className={`px-2 py-0.5 rounded ${agent.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>{agent.status}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {agent.nodes.map((node, idx) => {
          const Icon = TYPE_ICON[node.type] ?? Bot
          const trace = traceById[node.id]
          const stateClass = trace
            ? (trace.status === 'success' ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50')
            : 'border-slate-200 bg-white'
          const isLast = idx === agent.nodes.length - 1
          return (
            <div key={node.id}>
              <div className={`rounded-xl border-2 ${stateClass} p-3 flex items-start gap-3`}>
                <div className={`w-9 h-9 rounded-lg ${nodeColor(node.type)} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">étape {idx + 1}</span>
                    <span className="font-semibold">{node.label || node.type}</span>
                    <span className="text-[10px] font-mono text-slate-400">{node.type}</span>
                    {trace && (
                      <span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${trace.status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {trace.status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {trace.status}
                      </span>
                    )}
                  </div>
                  {node.config && Object.keys(node.config).length > 0 && (
                    <div className="mt-1 text-xs text-slate-500 font-mono truncate">
                      {Object.entries(node.config).map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 40)}`).join('  ·  ')}
                    </div>
                  )}
                  {trace?.output && (
                    <pre className="mt-2 text-[11px] bg-slate-900 text-slate-100 p-2 rounded overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(trace.output, null, 2).slice(0, 400)}
                    </pre>
                  )}
                  {trace?.error && (
                    <div className="mt-2 text-xs text-rose-700 font-mono">{trace.error}</div>
                  )}
                  {node.next_no && node.next_no.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
                      <GitBranch className="w-3 h-3" /> Branche "non" → {node.next_no.join(', ')}
                    </div>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {runResult?.error && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          <strong>Erreur :</strong> {runResult.error}
        </div>
      )}
    </div>
  )
}

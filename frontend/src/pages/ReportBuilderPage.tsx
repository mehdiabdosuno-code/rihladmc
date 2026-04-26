import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart2, Table2, Hash, Plus, Trash2, RefreshCw,
  Download, Filter, Save, ChevronDown, ChevronUp,
  FileText, FileSpreadsheet, Presentation, X,
} from 'lucide-react'
import { dataSourcesApi, reportsApi, aiApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner, EmptyState, SectionTitle, PriceDisplay } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────
type WidgetType = 'kpi' | 'chart' | 'table'
type FieldType  = 'num' | 'str' | 'date'

interface Field { name: string; type: FieldType; label?: string }
interface Widget { id: string; type: WidgetType; order: number }
interface FilterRule { field: string; op: string; value: string }

const CURRENCY_SYM: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', MAD: 'MAD' }
const fmt = (v: number, currency = 'EUR') => {
  const s = CURRENCY_SYM[currency] ?? currency
  return `${s} ${new Intl.NumberFormat('fr-FR').format(Math.round(v))}`
}

// ── Tiny bar chart (pure SVG) ─────────────────────────────────────
function BarChartWidget({
  data, color = '#A8371D',
}: {
  data: { label: string; value: number }[]
  color?: string
}) {
  if (!data.length) return (
    <p className="text-xs text-muted text-center py-6">Aucune donnée agrégée</p>
  )
  const max = Math.max(...data.map(d => d.value), 1)
  const H = 140, BAR_W = Math.min(40, Math.floor(540 / data.length) - 8)
  const gap = Math.floor((560 - data.length * BAR_W) / (data.length + 1))

  return (
    <svg viewBox={`0 0 560 ${H + 32}`} className="w-full" style={{ maxHeight: 180 }}>
      {data.map((d, i) => {
        const barH = Math.max(4, Math.round((d.value / max) * H))
        const x    = gap + i * (BAR_W + gap)
        const y    = H - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} fill={color}
                  rx="3" opacity="0.9" />
            <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle"
                  fontSize="9" fill="#6B6B6B">
              {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
            </text>
            <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle"
                  fontSize="8" fill={color} fontWeight="600">
              {d.value >= 1000 ? `${(d.value / 1000).toFixed(0)}k` : d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Widget block wrapper ──────────────────────────────────────────
function WidgetBlock({
  widget, onRemove, onMoveUp, onMoveDown, children,
}: {
  widget: Widget
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  children: React.ReactNode
}) {
  const icons: Record<WidgetType, React.ElementType> = {
    kpi: Hash, chart: BarChart2, table: Table2,
  }
  const labels: Record<WidgetType, string> = {
    kpi: 'Indicateurs clés', chart: 'Graphique', table: 'Tableau de données',
  }
  const Icon = icons[widget.type]

  return (
    <div className="card overflow-hidden mb-4 animate-fade-up">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-warm/60">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <Icon size={13} className="text-bordeaux" />
          {labels[widget.type]}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp}   className="p-1 rounded hover:bg-line transition-colors"><ChevronUp   size={13} /></button>
          <button onClick={onMoveDown} className="p-1 rounded hover:bg-line transition-colors"><ChevronDown size={13} /></button>
          <button onClick={onRemove}   className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors"><X size={13} /></button>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export function ReportBuilderPage() {
  const qc = useQueryClient()

  // State
  const [sourceId,    setSourceId]    = useState('')
  const [reportId,    setReportId]    = useState('')
  const [reportName,  setReportName]  = useState("Rapport S'TOURS Studio")
  const [subtitle,    setSubtitle]    = useState('')
  const [widgets,     setWidgets]     = useState<Widget[]>([])
  const [filters,     setFilters]     = useState<FilterRule[]>([])
  const [mainColor,   setMainColor]   = useState('#A8371D')
  const [groupBy,     setGroupBy]     = useState('')
  const [chartMetric, setChartMetric] = useState('')
  const [showTotals,  setShowTotals]  = useState(true)
  const [activePanel, setActivePanel] = useState<'design' | 'filters' | 'ai'>('design')
  const [aiPrompt,    setAiPrompt]    = useState('')
  const [aiReply,     setAiReply]     = useState('')
  const [chartData,   setChartData]   = useState<any[]>([])
  const [exporting,   setExporting]   = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)

  // Data
  const { data: sources } = useQuery({
    queryKey: ['datasources'],
    queryFn: () => dataSourcesApi.list().then(r => r.data),
  })

  const { data: savedReports } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.list().then(r => r.data),
  })

  const activeFilters = filters.filter(f => f.field && f.value)

  const { data: recordsResp, isLoading: recordsLoading } = useQuery({
    queryKey: ['records', sourceId, activeFilters],
    queryFn: () => dataSourcesApi.records(sourceId, activeFilters.length ? activeFilters : undefined)
      .then(r => r.data),
    enabled: !!sourceId,
  })

  const currentSource = sources?.find((s: any) => s.id === sourceId)
  const fields: Field[] = currentSource?.fields ?? []
  const records: any[]  = recordsResp?.records ?? []
  const numFields = fields.filter(f => f.type === 'num')
  const strFields = fields.filter(f => f.type === 'str')

  // Auto-set groupBy / chartMetric when source changes
  useEffect(() => {
    if (strFields.length && !groupBy)     setGroupBy(strFields[0].name)
    if (numFields.length && !chartMetric) setChartMetric(numFields[0].name)
  }, [sourceId, fields.length])

  // Fetch chart aggregation
  useEffect(() => {
    if (!sourceId || !groupBy || !chartMetric) return
    dataSourcesApi.aggregate(sourceId, groupBy, chartMetric)
      .then(r => setChartData(r.data.data))
      .catch(() => setChartData([]))
  }, [sourceId, groupBy, chartMetric, activeFilters.length])

  // AI mutation
  const aiMutation = useMutation({
    mutationFn: () => aiApi.generate(aiPrompt),
    onSuccess: (r) => setAiReply(r.data.content),
  })

  // ── Computed KPIs ───────────────────────────────────────────────
  const kpis = numFields.slice(0, 4).map(f => {
    const vals  = records.map(r => parseFloat(r[f.name]) || 0)
    const total = vals.reduce((a, b) => a + b, 0)
    const delta = parseFloat((Math.random() * 20 - 5).toFixed(1))
    return { label: f.label || f.name, total, delta }
  })

  // ── Filtered data for table ─────────────────────────────────────
  const tableData = records.slice(0, 100)

  // ── Column totals ───────────────────────────────────────────────
  const colTotal = (name: string) => {
    const t = records.reduce((a, r) => a + (parseFloat(r[name]) || 0), 0)
    return t >= 10_000 ? `${(t / 1000).toFixed(0)}k` : t.toFixed(0)
  }

  // ── Widget helpers ──────────────────────────────────────────────
  const addWidget = (type: WidgetType) => {
    setWidgets(ws => [...ws, { id: `${type}_${Date.now()}`, type, order: ws.length }])
  }

  const removeWidget = (id: string) => setWidgets(ws => ws.filter(w => w.id !== id))

  const moveWidget = (idx: number, dir: -1 | 1) => {
    setWidgets(ws => {
      const arr = [...ws]
      const j = idx + dir
      if (j < 0 || j >= arr.length) return arr
      ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
      return arr
    })
  }

  // ── Save report ─────────────────────────────────────────────────
  const saveReport = async () => {
    const payload = {
      name: reportName, subtitle,
      data_source_id: sourceId || undefined,
      widgets: widgets.map((w, i) => ({ type: w.type, order: i, config: {} })),
      filters: activeFilters,
      settings: { color: mainColor, group_by: groupBy,
                  chart_metric: chartMetric, show_totals: showTotals },
    }
    if (reportId) {
      await reportsApi.update(reportId, payload)
    } else {
      const r = await reportsApi.create(payload)
      setReportId(r.data.id)
    }
    qc.invalidateQueries({ queryKey: ['reports'] })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Load saved report ───────────────────────────────────────────
  const loadReport = async (id: string) => {
    const { data } = await reportsApi.get(id)
    setReportId(id)
    setReportName(data.name)
    setSubtitle(data.subtitle ?? '')
    setSourceId(data.data_source_id ?? '')
    setWidgets((data.widgets ?? []).map((w: any, i: number) => ({
      id: `${w.type}_${i}_${Date.now()}`, type: w.type, order: w.order ?? i,
    })))
    setFilters(data.filters ?? [])
    if (data.settings) {
      setMainColor(data.settings.color ?? '#A8371D')
      setGroupBy(data.settings.group_by ?? '')
      setChartMetric(data.settings.chart_metric ?? '')
      setShowTotals(data.settings.show_totals ?? true)
    }
  }

  // ── Export ──────────────────────────────────────────────────────
  const doExport = async (fmt: string) => {
    setExporting(fmt)
    try {
      const payload = {
        report_id: reportId || '00000000-0000-0000-0000-000000000000',
        format: fmt,
        data: records,
        fields: fields.map(f => ({ name: f.name, type: f.type, label: f.label })),
        report_name: reportName,
        subtitle,
        settings: { color: mainColor },
      }
      const res = await reportsApi.export(payload)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${reportName.replace(/\s+/g, '_')}.${fmt}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export error', e)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Report Builder"
        subtitle="Créez, filtrez et exportez vos rapports de données"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={saveReport}
              className={`btn-ghost btn-sm ${saved ? 'text-green-600 border-green-300' : ''}`}>
              <Save size={13} /> {saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
            </button>
            {['pdf', 'pptx', 'xlsx', 'csv'].map(fmt => (
              <button key={fmt} onClick={() => doExport(fmt)}
                disabled={!records.length || exporting === fmt}
                className="btn-secondary btn-sm uppercase font-mono text-[11px] tracking-wide">
                {exporting === fmt
                  ? <Spinner size={12} />
                  : fmt === 'pdf'  ? <FileText size={12} />
                  : fmt === 'pptx' ? <Presentation size={12} />
                  : <FileSpreadsheet size={12} />}
                {fmt}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex gap-0 h-[calc(100vh-73px)] overflow-hidden">

        {/* ── Left sidebar: source + reports ────────────────────── */}
        <div className="w-56 flex-shrink-0 bg-white border-r border-line flex flex-col overflow-hidden">
          <div className="p-3 border-b border-line">
            <p className="text-label text-muted mb-2">Source de données</p>
            <select
              className="input-base text-xs"
              value={sourceId}
              onChange={e => { setSourceId(e.target.value); setWidgets([]) }}
            >
              <option value="">Sélectionner…</option>
              {sources?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Fields list */}
          {fields.length > 0 && (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-label text-muted mb-2">Champs ({fields.length})</p>
              {fields.map(f => (
                <div key={f.name} className="flex items-center gap-2 py-1.5 px-2 rounded-brand
                                             hover:bg-warm text-xs cursor-default">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold
                    ${f.type === 'num'  ? 'bg-green-50 text-green-700'  :
                      f.type === 'date' ? 'bg-amber-50 text-amber-700' :
                                          'bg-royal-50 text-royal'}`}>
                    {f.type === 'num' ? '123' : f.type === 'date' ? 'DT' : 'Aa'}
                  </span>
                  <span className="text-ink truncate">{f.label || f.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Saved reports */}
          {!!savedReports?.length && (
            <div className="p-3 border-t border-line">
              <p className="text-label text-muted mb-2">Rapports sauvegardés</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {savedReports.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => loadReport(r.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-brand text-xs transition-colors
                      ${r.id === reportId
                        ? 'bg-bordeaux-100 text-bordeaux font-semibold'
                        : 'text-ink hover:bg-warm'}`}
                  >
                    <p className="truncate">{r.name}</p>
                    <p className="text-muted text-[10px]">{r.widgets_count} widget(s)</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Canvas ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Sub-tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-line bg-white">
            {(['design', 'filters', 'ai'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActivePanel(t)}
                className={`px-3 py-1.5 rounded-brand text-xs font-semibold transition-all
                  ${activePanel === t
                    ? 'bg-bordeaux text-warm'
                    : 'text-muted hover:text-ink hover:bg-warm'}`}
              >
                {t === 'design'  ? '🎨 Conception'    :
                 t === 'filters' ? `⚙️ Filtres ${activeFilters.length ? `(${activeFilters.length})` : ''}` :
                                   '✦ Assistant IA'}
              </button>
            ))}
            {activePanel === 'design' && (
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => addWidget('kpi')}   className="btn-ghost btn-sm">+ KPIs</button>
                <button onClick={() => addWidget('chart')} className="btn-ghost btn-sm">+ Graphique</button>
                <button onClick={() => addWidget('table')} className="btn-ghost btn-sm">+ Tableau</button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-surface">

            {/* DESIGN TAB */}
            {activePanel === 'design' && (
              <div>
                {/* Report header inputs */}
                <div className="card p-4 mb-4">
                  <input
                    className="w-full text-xl font-serif font-bold text-ink border-none outline-none
                               bg-transparent mb-1 placeholder:text-line"
                    value={reportName}
                    onChange={e => setReportName(e.target.value)}
                    placeholder="Titre du rapport…"
                  />
                  <input
                    className="w-full text-sm text-muted border-none outline-none bg-transparent
                               placeholder:text-line/60"
                    value={subtitle}
                    onChange={e => setSubtitle(e.target.value)}
                    placeholder="Sous-titre…"
                  />
                </div>

                {/* Loading */}
                {recordsLoading && (
                  <div className="flex justify-center py-10">
                    <Spinner size={28} />
                  </div>
                )}

                {/* Empty */}
                {!sourceId && (
                  <EmptyState
                    icon={<BarChart2 size={20} />}
                    title="Sélectionnez une source de données"
                    description="Choisissez une source dans le panneau gauche, puis ajoutez des composants."
                  />
                )}

                {sourceId && widgets.length === 0 && !recordsLoading && (
                  <EmptyState
                    icon={<Hash size={20} />}
                    title="Ajoutez des composants"
                    description="Utilisez les boutons + KPIs, + Graphique, + Tableau en haut."
                  />
                )}

                {/* Widgets */}
                {widgets.map((w, wi) => (
                  <WidgetBlock
                    key={w.id} widget={w}
                    onRemove={() => removeWidget(w.id)}
                    onMoveUp={() => moveWidget(wi, -1)}
                    onMoveDown={() => moveWidget(wi, 1)}
                  >
                    {/* KPI widget */}
                    {w.type === 'kpi' && (
                      <div className="grid grid-cols-4 gap-3">
                        {kpis.length === 0 && (
                          <p className="col-span-4 text-xs text-muted text-center py-4">
                            Aucun champ numérique dans cette source
                          </p>
                        )}
                        {kpis.map((k, i) => (
                          <div key={i} className="card-warm rounded-card p-4">
                            <p className="text-label text-muted mb-2">{k.label}</p>
                            <p className="font-serif text-2xl font-bold text-ink">
                              {k.total >= 10_000
                                ? `${(k.total / 1000).toFixed(0)}k`
                                : k.total.toFixed(0)}
                            </p>
                            <p className={`text-xs mt-1 font-medium
                              ${k.delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {k.delta >= 0 ? '▲' : '▼'} {Math.abs(k.delta).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chart widget */}
                    {w.type === 'chart' && (
                      <div>
                        <BarChartWidget data={chartData} color={mainColor} />
                      </div>
                    )}

                    {/* Table widget */}
                    {w.type === 'table' && (
                      <div className="overflow-x-auto -mx-4 -mb-4">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-line">
                              {fields.slice(0, 8).map(f => (
                                <th key={f.name}
                                    className="text-left text-label text-muted px-4 py-2.5 whitespace-nowrap">
                                  {f.label || f.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.slice(0, 12).map((row, ri) => (
                              <tr key={ri}
                                  className="border-b border-line/50 hover:bg-warm/50 transition-colors">
                                {fields.slice(0, 8).map(f => (
                                  <td key={f.name} className={`px-4 py-2.5
                                    ${f.type === 'num' ? 'font-mono text-right text-ink' : 'text-muted'}`}>
                                    {f.type === 'num'
                                      ? (parseFloat(row[f.name]) || 0).toLocaleString('fr-FR')
                                      : row[f.name] ?? '–'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {showTotals && numFields.length > 0 && (
                              <tr className="bg-warm border-t-2 border-bordeaux/20">
                                {fields.slice(0, 8).map((f, fi) => (
                                  <td key={f.name}
                                      className={`px-4 py-2.5 font-semibold text-xs
                                    ${f.type === 'num' ? 'font-mono text-right text-bordeaux' : 'text-muted'}`}>
                                    {fi === 0
                                      ? `Total (${records.length})`
                                      : f.type === 'num' ? colTotal(f.name) : ''}
                                  </td>
                                ))}
                              </tr>
                            )}
                          </tbody>
                        </table>
                        {tableData.length > 12 && (
                          <p className="text-center text-xs text-muted py-2 border-t border-line">
                            + {tableData.length - 12} lignes supplémentaires dans l'export
                          </p>
                        )}
                      </div>
                    )}
                  </WidgetBlock>
                ))}
              </div>
            )}

            {/* FILTERS TAB */}
            {activePanel === 'filters' && (
              <div className="card p-5">
                <SectionTitle>Filtres actifs</SectionTitle>
                <div className="space-y-2 mb-4">
                  {filters.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <select className="input-base text-xs flex-1" value={f.field}
                              onChange={e => setFilters(fs => fs.map((x, i) => i === fi ? { ...x, field: e.target.value } : x))}>
                        <option value="">Champ…</option>
                        {fields.map(fd => (
                          <option key={fd.name} value={fd.name}>{fd.label || fd.name}</option>
                        ))}
                      </select>
                      <select className="input-base text-xs w-28" value={f.op}
                              onChange={e => setFilters(fs => fs.map((x, i) => i === fi ? { ...x, op: e.target.value } : x))}>
                        {['=', 'contient', '>', '<', '>='].map(op => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                      </select>
                      <input className="input-base text-xs flex-1" placeholder="Valeur…"
                             value={f.value}
                             onChange={e => setFilters(fs => fs.map((x, i) => i === fi ? { ...x, value: e.target.value } : x))} />
                      <button
                        onClick={() => setFilters(fs => fs.filter((_, i) => i !== fi))}
                        className="p-1.5 rounded-brand hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters(fs => [...fs, { field: '', op: '=', value: '' }])}
                    className="btn-ghost btn-sm">
                    <Plus size={12} /> Ajouter filtre
                  </button>
                  <button
                    onClick={() => setActivePanel('design')}
                    className="btn-primary btn-sm">
                    Appliquer →
                  </button>
                </div>

                {/* Status */}
                <div className="mt-4 pt-4 border-t border-line text-xs text-muted">
                  {records.length} enregistrement(s) · {activeFilters.length} filtre(s) actif(s)
                </div>
              </div>
            )}

            {/* AI TAB */}
            {activePanel === 'ai' && (
              <div className="card p-5 space-y-4">
                <SectionTitle>Assistant IA — Analyse des données</SectionTitle>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '📊 Analyser ces données', prompt: `Analyse ces données S'TOURS DMC et donne 3 insights clés + 2 recommandations business en français.` },
                    { label: '🏆 Points forts', prompt: `Quels sont les points forts de ces données de performance ? Réponds en français, sois concis.` },
                    { label: '⚠️ Points d\'attention', prompt: `Y a-t-il des anomalies ou points d'attention dans ces données ? Réponds en français.` },
                    { label: '📝 Résumé exécutif', prompt: `Rédige un résumé exécutif de 3 phrases de ces données pour un directeur commercial. Français.` },
                  ].map(s => (
                    <button
                      key={s.label}
                      onClick={() => setAiPrompt(s.prompt)}
                      className="text-left btn-ghost text-xs py-3 px-4 h-auto"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-label text-muted block mb-2">Question libre</label>
                  <textarea
                    className="input-base text-sm"
                    rows={3}
                    placeholder="Posez une question sur vos données…"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                  />
                </div>

                <button
                  onClick={() => aiMutation.mutate()}
                  disabled={!aiPrompt || aiMutation.isPending}
                  className="btn-primary btn-sm"
                >
                  {aiMutation.isPending ? <Spinner size={13} className="text-warm" /> : null}
                  {aiMutation.isPending ? 'Analyse en cours…' : '✦ Analyser'}
                </button>

                {aiReply && (
                  <div className="bg-warm border border-bordeaux-100 rounded-card p-4
                                  text-sm text-ink leading-relaxed whitespace-pre-wrap">
                    {aiReply}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right properties panel ─────────────────────────────── */}
        <div className="w-52 flex-shrink-0 bg-white border-l border-line overflow-y-auto p-4">
          <p className="text-label text-muted mb-4">Propriétés</p>

          <div className="space-y-4">
            {strFields.length > 0 && (
              <div>
                <label className="text-label text-muted block mb-1.5">Grouper par</label>
                <select className="input-base text-xs" value={groupBy}
                        onChange={e => setGroupBy(e.target.value)}>
                  {strFields.map(f => (
                    <option key={f.name} value={f.name}>{f.label || f.name}</option>
                  ))}
                </select>
              </div>
            )}

            {numFields.length > 0 && (
              <div>
                <label className="text-label text-muted block mb-1.5">Métrique graphique</label>
                <select className="input-base text-xs" value={chartMetric}
                        onChange={e => setChartMetric(e.target.value)}>
                  {numFields.map(f => (
                    <option key={f.name} value={f.name}>{f.label || f.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-label text-muted block mb-1.5">Couleur principale</label>
              <div className="flex items-center gap-2">
                <input type="color" value={mainColor}
                       onChange={e => setMainColor(e.target.value)}
                       className="w-8 h-8 rounded border border-line cursor-pointer" />
                <span className="font-mono text-xs text-muted">{mainColor}</span>
              </div>
              <div className="flex gap-1 mt-2">
                {['#A8371D', '#1628A9', '#141414', '#2D7A4F'].map(c => (
                  <button key={c} onClick={() => setMainColor(c)}
                          className="w-6 h-6 rounded-full border-2 transition-all
                                     hover:scale-110"
                          style={{ background: c,
                                   borderColor: mainColor === c ? c : 'transparent' }} />
                ))}
              </div>
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">Ligne de totaux</label>
              <button
                onClick={() => setShowTotals(!showTotals)}
                className={`w-full text-xs py-1.5 rounded-brand border transition-all
                  ${showTotals
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-warm text-muted border-line'}`}
              >
                {showTotals ? '✓ Affichée' : 'Masquée'}
              </button>
            </div>

            <div className="pt-2 border-t border-line">
              <p className="text-label text-muted mb-2">Statistiques</p>
              <div className="space-y-1 text-xs text-muted">
                <div className="flex justify-between">
                  <span>Enregistrements</span>
                  <span className="font-mono font-semibold text-ink">{records.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Champs</span>
                  <span className="font-mono font-semibold text-ink">{fields.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Widgets</span>
                  <span className="font-mono font-semibold text-ink">{widgets.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Filtres</span>
                  <span className="font-mono font-semibold text-ink">{activeFilters.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

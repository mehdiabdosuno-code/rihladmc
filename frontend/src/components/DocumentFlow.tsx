/**
 * DocumentFlow — visual project document chain.
 *
 * Renders Project → Devis → Proposition → Facture → Règlement as an SVG graph.
 *
 * Self-contained (no extra deps). For a richer pan/zoom experience, you can
 * later swap the SVG layout for `reactflow` + `dagre` — same input shape.
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { FileText, Receipt, Send, FolderKanban, BadgeDollarSign } from 'lucide-react'

type NodeType = 'project' | 'quotation' | 'proposal' | 'invoice' | 'payment'

interface FlowNode {
  id: string
  type: NodeType
  label: string
  status?: string | null
  amount?: number | null
  currency?: string | null
  db_id: string
}

interface FlowEdge {
  source: string
  target: string
  label?: string | null
}

interface FlowGraph {
  project_id: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

const COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  project:    { bg: '#eef2ff', border: '#6366f1', text: '#3730a3' },
  quotation:  { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
  proposal:   { bg: '#fce7f3', border: '#db2777', text: '#9d174d' },
  invoice:    { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
  payment:    { bg: '#dcfce7', border: '#16a34a', text: '#166534' },
}

function NodeIcon({ type }: { type: NodeType }) {
  const cls = 'h-4 w-4'
  switch (type) {
    case 'project':   return <FolderKanban className={cls} />
    case 'quotation': return <FileText className={cls} />
    case 'proposal':  return <Send className={cls} />
    case 'invoice':   return <Receipt className={cls} />
    case 'payment':   return <BadgeDollarSign className={cls} />
  }
}

interface Props {
  projectId: string
}

const COL_WIDTH = 220
const NODE_WIDTH = 180
const NODE_HEIGHT = 76
const ROW_HEIGHT = 96
const PAD = 20

const COLUMN_FOR: Record<NodeType, number> = {
  project: 0,
  quotation: 1,
  proposal: 1,
  invoice: 2,
  payment: 3,
}

export function DocumentFlow({ projectId }: Props) {
  const [graph, setGraph] = useState<FlowGraph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get<FlowGraph>(`/document-flow/projects/${projectId}`)
      .then((r) => setGraph(r.data))
      .catch((e) => setError(e?.message || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [projectId])

  // Compute (x, y) for each node by column (type) and row index within column.
  const positions = useMemo(() => {
    if (!graph) return {} as Record<string, { x: number; y: number }>
    const counters: Record<number, number> = {}
    const out: Record<string, { x: number; y: number }> = {}
    for (const n of graph.nodes) {
      const col = COLUMN_FOR[n.type]
      const row = (counters[col] = (counters[col] || 0) + 1) - 1
      out[n.id] = {
        x: PAD + col * COL_WIDTH,
        y: PAD + row * ROW_HEIGHT,
      }
    }
    return out
  }, [graph])

  if (loading) return <div className="p-6 text-sm text-slate-500">Chargement du flow…</div>
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>
  if (!graph || graph.nodes.length === 0)
    return <div className="p-6 text-sm text-slate-500">Aucun document pour ce projet.</div>

  // Compute SVG dimensions
  const maxRowsByCol: Record<number, number> = {}
  for (const n of graph.nodes) {
    const c = COLUMN_FOR[n.type]
    maxRowsByCol[c] = Math.max(maxRowsByCol[c] || 0, 1)
  }
  for (const n of graph.nodes) {
    const c = COLUMN_FOR[n.type]
    const count = graph.nodes.filter((x) => COLUMN_FOR[x.type] === c).length
    maxRowsByCol[c] = Math.max(maxRowsByCol[c] || 0, count)
  }
  const rows = Math.max(...Object.values(maxRowsByCol), 1)
  const cols = Math.max(...graph.nodes.map((n) => COLUMN_FOR[n.type])) + 1
  const width = PAD * 2 + cols * COL_WIDTH
  const height = PAD * 2 + rows * ROW_HEIGHT

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
      <svg width={width} height={height}>
        <defs>
          <marker
            id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* edges */}
        {graph.edges.map((e, idx) => {
          const src = positions[e.source]
          const tgt = positions[e.target]
          if (!src || !tgt) return null
          const x1 = src.x + NODE_WIDTH
          const y1 = src.y + NODE_HEIGHT / 2
          const x2 = tgt.x
          const y2 = tgt.y + NODE_HEIGHT / 2
          const mx = (x1 + x2) / 2
          return (
            <g key={idx}>
              <path
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none" stroke="#94a3b8" strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
              {e.label && (
                <text x={mx} y={(y1 + y2) / 2 - 4} fontSize={10}
                      fill="#64748b" textAnchor="middle">
                  {e.label}
                </text>
              )}
            </g>
          )
        })}

        {/* nodes */}
        {graph.nodes.map((n) => {
          const pos = positions[n.id]
          if (!pos) return null
          const c = COLORS[n.type]
          return (
            <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={NODE_WIDTH} height={NODE_HEIGHT} rx={8} ry={8}
                fill={c.bg} stroke={c.border} strokeWidth={1.5}
              />
              <foreignObject x={0} y={0} width={NODE_WIDTH} height={NODE_HEIGHT}>
                <div
                  {...{ xmlns: 'http://www.w3.org/1999/xhtml' } as any}
                  className="flex h-full flex-col justify-center px-3"
                  style={{ color: c.text }}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase">
                    <NodeIcon type={n.type} />
                    <span>{n.type}</span>
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">{n.label}</div>
                  <div className="mt-0.5 flex items-center justify-between text-xs opacity-80">
                    {n.status && <span>{n.status}</span>}
                    {n.amount != null && (
                      <span className="font-semibold">
                        {n.amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}{' '}
                        {n.currency || 'MAD'}
                      </span>
                    )}
                  </div>
                </div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

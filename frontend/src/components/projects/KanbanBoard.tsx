import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
import { MapPin, Users, GripVertical, Hash, AlertCircle } from 'lucide-react'
import { projectsApi } from '@/lib/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const CURRENCY_SYM: Record<string, string> = { EUR: '€', USD: '$', MAD: 'MAD' }

function fmt(v: number | string | null | undefined, currency = 'EUR') {
  if (v == null) return '–'
  const num = typeof v === 'string' ? parseFloat(v) : v
  const sym = CURRENCY_SYM[currency] ?? currency
  return `${sym} ${new Intl.NumberFormat('fr-FR').format(Math.round(num))}`
}

// ── Config colonnes ───────────────────────────────────────────────
const COLUMNS = [
  { id: 'draft',       label: 'Brouillon',   color: 'bg-slate-100 dark:bg-slate-800',   dot: 'bg-slate-400',   border: 'border-slate-200 dark:border-slate-700' },
  { id: 'in_progress', label: 'En étude',    color: 'bg-blue-50 dark:bg-blue-950/30',   dot: 'bg-blue-500',    border: 'border-blue-200 dark:border-blue-800' },
  { id: 'validated',   label: 'Devis prêt',  color: 'bg-violet-50 dark:bg-violet-950/30', dot: 'bg-violet-500', border: 'border-violet-200 dark:border-violet-800' },
  { id: 'sent',        label: 'Envoyé',      color: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500',   border: 'border-amber-200 dark:border-amber-800' },
  { id: 'won',         label: 'Gagné ✓',     color: 'bg-emerald-50 dark:bg-emerald-950/30', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  { id: 'lost',        label: 'Perdu',       color: 'bg-red-50 dark:bg-red-950/30',     dot: 'bg-red-400',     border: 'border-red-200 dark:border-red-800' },
] as const

type ColId = typeof COLUMNS[number]['id']

// ── Carte projet ──────────────────────────────────────────────────
function ProjectCard({ project, isDragging = false }: { project: any; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isSorting } = useSortable({ id: project.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSorting ? transition : undefined,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm",
        "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
          aria-label="Déplacer"
        >
          <GripVertical size={14} />
        </button>

        <div className="flex-1 min-w-0">
          {/* Référence */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <Hash size={9} className="text-slate-300" />
            <span className="text-[9px] font-mono text-slate-400 truncate">{project.reference || 'REF-PENDING'}</span>
          </div>

          {/* Nom */}
          <Link
            to={`/projects/${project.id}`}
            className="text-sm font-bold text-slate-800 dark:text-cream leading-tight line-clamp-2 hover:text-rihla transition-colors block mb-2"
          >
            {project.name}
          </Link>

          {/* Client */}
          {project.client_name && (
            <p className="text-[10px] text-slate-400 font-medium mb-3 truncate">{project.client_name}</p>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
            <div className="flex flex-col">
               <span className="text-[10px] font-black text-slate-900 dark:text-cream">
                 {fmt(project.total_selling_price || 0)}
               </span>
               <span className={clsx(
                 "text-[8px] font-black uppercase tracking-tighter",
                 (project.margin_pct || 0) < 12 ? "text-red-500" : "text-emerald-500"
               )}>
                 Marge: {project.margin_pct || 15}%
               </span>
            </div>
            <span className="text-[9px] text-slate-300 font-mono">
              {format(new Date(project.updated_at), 'dd/MM', { locale: fr })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Colonne Kanban ────────────────────────────────────────────────
function KanbanColumn({
  column, projects, activeId,
}: {
  column: typeof COLUMNS[number]
  projects: any[]
  activeId: string | null
}) {
  const { setNodeRef } = useSortable({ id: column.id })

  return (
    <div className={clsx("rounded-3xl border p-4 flex flex-col gap-3 min-h-[200px]", column.color, column.border)}>
      {/* Header */}
      <div className="flex flex-col gap-1 mb-4 sticky top-0 bg-inherit z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={clsx("w-2.5 h-2.5 rounded-full shadow-sm", column.dot)} />
            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
              {column.label}
            </span>
          </div>
          <span className="text-[10px] font-black text-slate-400 bg-white/60 dark:bg-white/10 px-2 py-0.5 rounded-full">
            {projects.length}
          </span>
        </div>
        
        {/* Total Revenue Projection */}
        <div className="flex items-baseline gap-1 opacity-60">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline:</span>
           <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-cream">
             {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
               projects.reduce((acc, p) => acc + (p.total_selling_price || 0), 0)
             )}
           </span>
        </div>
      </div>

      {/* Cards drop zone */}
      <div ref={setNodeRef} className="flex flex-col gap-2.5 flex-1">
        <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} isDragging={activeId === p.id} />
          ))}
        </SortableContext>
        {projects.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8 border-2 border-dashed border-current/10 rounded-2xl">
            <p className="text-[10px] text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest">Déposer ici</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Kanban Board principal ────────────────────────────────────────
export function KanbanBoard({ projects }: { projects: any[] }) {
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localProjects, setLocalProjects] = useState<any[]>(projects)
  const [error, setError] = useState<string | null>(null)

  // Sync si les props changent
  if (projects !== localProjects && !activeId) {
    setLocalProjects(projects)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const byStatus = useCallback((status: ColId) =>
    localProjects.filter(p => p.status === status),
  [localProjects])

  const activeProject = activeId ? localProjects.find(p => p.id === activeId) : null

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string)
    setError(null)
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const overId = over.id as string
    const isColumn = COLUMNS.some(c => c.id === overId)
    const targetStatus = isColumn
      ? overId as ColId
      : localProjects.find(p => p.id === overId)?.status

    if (!targetStatus) return

    setLocalProjects(prev =>
      prev.map(p => p.id === active.id ? { ...p, status: targetStatus } : p)
    )
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over) {
      setLocalProjects(projects) // revert
      return
    }

    const draggedProject = localProjects.find(p => p.id === active.id)
    if (!draggedProject) return

    const newStatus = draggedProject.status
    const originalProject = projects.find(p => p.id === active.id)
    if (originalProject?.status === newStatus) return // rien n'a changé

    try {
      await projectsApi.patch(active.id as string, newStatus)
      // Invalide le cache pour refresh les données
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project', active.id] })
    } catch (err: any) {
      setError(`Impossible de déplacer le projet : ${err.response?.data?.detail || err.message}`)
      setLocalProjects(projects) // revert sur erreur
    }
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 font-medium">
          <AlertCircle size={14} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              projects={byStatus(col.id)}
              activeId={activeId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeProject && (
            <div className="rotate-2 scale-105 shadow-2xl">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xl opacity-95">
                <p className="text-sm font-bold text-slate-800 dark:text-cream">{activeProject.name}</p>
                {activeProject.client_name && (
                  <p className="text-[10px] text-slate-400 mt-1">{activeProject.client_name}</p>
                )}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

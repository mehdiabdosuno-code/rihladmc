import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus, Search,
  MapPin, Users, ChevronRight,
  TrendingUp, Hash, LayoutGrid, Kanban,
} from 'lucide-react'
import { projectsApi } from '@/lib/api'
import { StatusBadge, EmptyState } from '@/components/ui'
import { ProjectGridSkeleton } from '@/components/ui/Skeleton'
import { KanbanBoard } from '@/components/projects/KanbanBoard'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { clsx } from 'clsx'

const STATUSES = ['', 'draft', 'in_progress', 'validated', 'sent', 'won', 'lost']
const LABELS: Record<string, string> = {
  '': 'Tous',
  draft: 'Brouillon',
  in_progress: 'Étude active',
  validated: 'Devis prêt',
  sent: 'Envoyé',
  won: 'Gagné',
  lost: 'Perdu',
}

const TYPE_COLORS: Record<string, string> = {
  incentive: 'bg-purple-50 text-purple-700 border-purple-200',
  leisure:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  mice:      'bg-blue-50 text-blue-700 border-blue-200',
  fit:       'bg-amber-50 text-amber-700 border-amber-200',
  luxury:    'bg-rihla/8 text-rihla border-rihla/20',
}

const PAGE_SIZE = 20

export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') ?? '0', 10) || 0)
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>(
    (searchParams.get('view') as 'grid' | 'kanban') ?? 'grid'
  )
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(0) }, [statusFilter])

  // Sync URL with state
  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedSearch) params.q = debouncedSearch
    if (statusFilter) params.status = statusFilter
    if (page > 0) params.page = String(page)
    if (viewMode !== 'grid') params.view = viewMode
    setSearchParams(params, { replace: true })
  }, [debouncedSearch, statusFilter, page, viewMode, setSearchParams])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['projects', debouncedSearch, statusFilter, page],
    queryFn: () => projectsApi.list({
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }).then(r => r.data),
    placeholderData: (prev) => prev,
  })

  const projects = (data as any)?.items ?? []
  const total    = (data as any)?.total ?? 0
  const hasMore  = (data as any)?.has_more ?? false
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const qc = useQueryClient()
  const prefetchProject = useCallback((id: string) => {
    qc.prefetchQuery({
      queryKey: ['project', id],
      queryFn: () => projectsApi.get(id).then(r => r.data),
      staleTime: 60_000,
    })
  }, [qc])

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/5 px-8 py-5">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold text-slate-900 dark:text-cream tracking-tight">Projets</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Tous les dossiers à l'étude, validés ou archivés.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-white/5 p-0.5 rounded-md">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'px-3 py-1.5 rounded text-[12px] font-medium transition-colors flex items-center gap-1.5',
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-cream shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              ><LayoutGrid size={13} strokeWidth={1.75} /> Grille</button>
              <button
                onClick={() => setViewMode('kanban')}
                className={clsx(
                  'px-3 py-1.5 rounded text-[12px] font-medium transition-colors flex items-center gap-1.5',
                  viewMode === 'kanban'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-cream shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              ><Kanban size={13} strokeWidth={1.75} /> Kanban</button>
            </div>
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-rihla hover:bg-rihla-dark text-white text-[13px] font-medium rounded-md transition-colors"
            >
              <Plus size={15} strokeWidth={2} /> Nouveau dossier
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-6">

        {/* Search + status filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
            <input
              className="w-full h-9 pl-9 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-md text-[13px]
                         text-slate-900 dark:text-cream placeholder:text-slate-400
                         focus:outline-none focus:border-rihla focus:ring-2 focus:ring-rihla/15 transition"
              placeholder="Rechercher par référence, agence, destination…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-0.5 rounded-md overflow-x-auto">
            {STATUSES.slice(0, 5).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  'px-3 h-8 rounded text-[12px] font-medium whitespace-nowrap transition-colors',
                  statusFilter === s
                    ? 'bg-rihla/10 text-rihla'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                )}
              >
                {LABELS[s]}
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-1.5 h-9 px-2.5 bg-emerald-50 border border-emerald-100 rounded-md text-emerald-700 text-[12px] font-medium">
            <TrendingUp size={13} strokeWidth={2} /> +12% vs M-1
          </div>
        </div>

        {/* Count + pagination */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] text-slate-500">
              {total} dossier{total > 1 ? 's' : ''} · page {page + 1}/{totalPages || 1}
              {isFetching && !isLoading && <span className="ml-2 text-rihla">↻</span>}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-8 px-3 text-[12px] font-medium bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-md disabled:opacity-40 hover:border-slate-300 transition-colors"
                >←</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(0, Math.min(page - 2 + i, totalPages - 5 + i))
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={clsx(
                        'w-8 h-8 text-[12px] font-medium rounded-md transition-colors',
                        pageNum === page
                          ? 'bg-rihla text-white'
                          : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                      )}
                    >{pageNum + 1}</button>
                  )
                })}
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                  className="h-8 px-3 text-[12px] font-medium bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-md disabled:opacity-40 hover:border-slate-300 transition-colors"
                >→</button>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <ProjectGridSkeleton count={8} />
        ) : !projects?.length ? (
          <EmptyState
            title="Aucun dossier"
            description="Aucun projet ne correspond à vos critères actuels."
            action={
              <Link to="/projects/new" className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-rihla hover:bg-rihla-dark text-white text-[13px] font-medium rounded-md transition-colors">
                <Plus size={14} /> Créer un projet
              </Link>
            }
          />
        ) : viewMode === 'kanban' ? (
          <KanbanBoardWrapper search={debouncedSearch} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p: any) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                onMouseEnter={() => prefetchProject(p.id)}
                onFocus={() => prefetchProject(p.id)}
                className="group bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-white/5 p-4 hover:border-slate-300 hover:shadow-sm transition-all block"
              >
                {/* Status & Type */}
                <div className="flex items-start justify-between mb-3">
                  <StatusBadge status={p.status} />
                  <div className={clsx(
                    'text-[10px] font-medium px-2 py-0.5 rounded border uppercase tracking-wide',
                    TYPE_COLORS[p.project_type] ?? 'bg-slate-50 text-slate-500 border-slate-200'
                  )}>
                    {p.project_type || 'Général'}
                  </div>
                </div>

                {/* Title */}
                <div className="mb-3">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-cream leading-snug group-hover:text-rihla transition-colors line-clamp-2">
                    {p.name}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mt-1">
                    <Hash size={10} strokeWidth={1.75} /> {p.reference || 'REF-PENDING'}
                  </div>
                </div>

                {/* Metrics inline */}
                <div className="flex items-center gap-3 text-[12px] text-slate-600 dark:text-slate-400 mb-3">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} className="text-slate-400" strokeWidth={1.75} />
                    {p.destination || 'Maroc'}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} className="text-slate-400" strokeWidth={1.75} />
                    {p.pax_count || 0} pax
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">Agence</p>
                    <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{p.client_name ?? 'Client direct'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {format(new Date(p.updated_at), 'dd/MM/yy', { locale: fr })}
                    </span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-rihla group-hover:translate-x-0.5 transition-all" strokeWidth={1.75} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanBoardWrapper({ search }: { search: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['projects-kanban', search],
    queryFn: () => projectsApi.list({ search: search || undefined, limit: 200 }).then(r => r.data),
  })
  const projects = (data as any)?.items ?? []

  if (isLoading) return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="min-w-[280px] bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-white/5 p-3 space-y-3">
          <div className="h-4 w-24 bg-slate-200/70 dark:bg-white/5 rounded animate-pulse" />
          {[1,2,3].map(j => (
            <div key={j} className="h-20 bg-slate-100/70 dark:bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )

  return <KanbanBoard projects={projects} />
}

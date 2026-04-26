import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Plus, TrendingUp, FolderKanban,
  ArrowRight, Receipt,
  Activity, Gem, AlertCircle, ChevronRight,
} from 'lucide-react'
import { projectsApi, invoicesApi, dashboardApi } from '@/lib/api'
import { StatusPill, Spinner, StatCard } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { clsx } from 'clsx'
import { InteractiveMoroccoMap } from '@/components/maps/InteractiveMoroccoMap'
import { GroupItineraryMap } from '@/components/maps/GroupItineraryMap'

export function DashboardPage() {
  const { user } = useAuthStore()

  // Fetch up to 100 projects (backend cap) for KPIs + sparklines + activity feed
  const { data: projectsAll, isLoading } = useQuery({
    queryKey: ['projects', 'dashboard-all'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => r.data?.items ?? []),
    staleTime: 30_000,
  })
  const projects = projectsAll as any[] | undefined

  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.kpis().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices', 'dashboard'],
    queryFn: () => invoicesApi.list({ limit: 100 }).then(r => r.data).catch(() => []),
    staleTime: 30_000,
  })

  // Real KPI values from backend
  const total       = kpis?.total_projects ?? projects?.length ?? 0
  const inProgress  = kpis?.active_projects ?? 0
  const recentCount = kpis?.recent_projects_30d ?? 0

  // Real invoice totals
  const paidInvoices    = (invoices as any[])?.filter((i: any) => i.status === 'paid') ?? []
  const pendingInvoices = (invoices as any[])?.filter((i: any) => i.status === 'sent' || i.status === 'overdue') ?? []
  const paidTotal       = paidInvoices.reduce((s: number, i: any) => s + (i.total_amount ?? 0), 0)
  const pendingTotal    = pendingInvoices.reduce((s: number, i: any) => s + (i.total_amount ?? 0), 0)
  const grandTotal      = paidTotal + pendingTotal

  // ── Sparklines: aggregate daily activity over the last 14 days ─────────
  const today0 = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const projectsCreatedSpark = useMemo(() => {
    const buckets = Array(14).fill(0)
    for (const p of projects ?? []) {
      const d = new Date(p.created_at)
      d.setHours(0, 0, 0, 0)
      const diff = Math.floor((today0.getTime() - d.getTime()) / 86400000)
      if (diff >= 0 && diff < 14) buckets[13 - diff] += 1
    }
    return buckets
  }, [projects, today0])

  const projectsUpdatedSpark = useMemo(() => {
    const buckets = Array(14).fill(0)
    for (const p of projects ?? []) {
      const d = new Date(p.updated_at)
      d.setHours(0, 0, 0, 0)
      const diff = Math.floor((today0.getTime() - d.getTime()) / 86400000)
      if (diff >= 0 && diff < 14) buckets[13 - diff] += 1
    }
    return buckets
  }, [projects, today0])

  const invoicesPaidSpark = useMemo(() => {
    const buckets = Array(14).fill(0)
    for (const i of paidInvoices) {
      if (!i.issue_date && !i.created_at) continue
      const d = new Date(i.issue_date ?? i.created_at)
      d.setHours(0, 0, 0, 0)
      const diff = Math.floor((today0.getTime() - d.getTime()) / 86400000)
      if (diff >= 0 && diff < 14) buckets[13 - diff] += i.total_amount ?? 0
    }
    return buckets
  }, [paidInvoices, today0])

  const invoicesPendingSpark = useMemo(() => {
    const buckets = Array(14).fill(0)
    for (const i of pendingInvoices) {
      if (!i.issue_date && !i.created_at) continue
      const d = new Date(i.issue_date ?? i.created_at)
      d.setHours(0, 0, 0, 0)
      const diff = Math.floor((today0.getTime() - d.getTime()) / 86400000)
      if (diff >= 0 && diff < 14) buckets[13 - diff] += i.total_amount ?? 0
    }
    return buckets
  }, [pendingInvoices, today0])

  // Recently updated projects (sorted) for activity feed
  const recentlyUpdated = useMemo(() => {
    return [...(projects ?? [])]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
  }, [projects])
  
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const firstName = user?.full_name?.split(' ')[0] ?? 'Chakir'
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/5 px-8 py-6">
        <div className="max-w-[1600px] mx-auto flex justify-between items-end gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] text-slate-500 capitalize">{today}</span>
            </div>
            <h1 className="text-[24px] font-semibold text-slate-900 dark:text-cream tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Voici un aperçu de votre activité aujourd'hui.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-md transition-colors dark:bg-white/5 dark:border-white/10 dark:text-cream dark:hover:bg-white/10">
              <Activity size={14} strokeWidth={2} />
              Market Watch
            </button>
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium text-white bg-rihla hover:bg-rihla-dark rounded-md transition-colors"
            >
              <Plus size={14} strokeWidth={2.25} />
              Nouveau dossier
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Projets total"
            value={total}
            sub={`${inProgress} actifs`}
            icon={FolderKanban}
            sparkline={projectsUpdatedSpark}
            sparklineColor="rgb(180, 62, 32)"
          />
          <StatCard
            label="Nouveaux (30j)"
            value={recentCount}
            sub="créés ce mois-ci"
            icon={TrendingUp}
            sparkline={projectsCreatedSpark}
            sparklineColor="rgb(16, 185, 129)"
          />
          <StatCard
            label="Facturé"
            value={paidTotal > 0 ? `${(paidTotal/1000).toFixed(0)}k MAD` : '0 MAD'}
            sub={`${paidInvoices.length} facture${paidInvoices.length > 1 ? 's' : ''} payée${paidInvoices.length > 1 ? 's' : ''}`}
            icon={Receipt}
            sparkline={invoicesPaidSpark}
            sparklineColor="rgb(16, 185, 129)"
          />
          <StatCard
            label="En attente"
            value={pendingTotal > 0 ? `${(pendingTotal/1000).toFixed(0)}k MAD` : '0 MAD'}
            sub={`${pendingInvoices.length} facture${pendingInvoices.length > 1 ? 's' : ''} à encaisser`}
            icon={Activity}
            sparkline={invoicesPendingSpark}
            sparklineColor="rgb(245, 158, 11)"
          />
        </div>

        {/* ── IMMERSIVE MAP CENTERPIECE ──────────────────────────── */}
        <div className="stagger-5">
          <InteractiveMoroccoMap />
        </div>

        {/* ── GROUP ITINERARIES — animated routes, day timeline ─── */}
        <div className="stagger-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Itinéraires des groupes</h2>
              <p className="text-[12px] text-slate-500">
                Suivez chaque groupe jour par jour — lancez l'animation, sautez à un jour, comparez les routes.
              </p>
            </div>
          </div>
          <GroupItineraryMap />
        </div>

        <div className="grid grid-cols-12 gap-4">

          {/* MAIN COLUMN — PROJECTS & ACTIVITY (8 cols) */}
          <div className="col-span-12 lg:col-span-8 space-y-4">

            {/* RECENT PROJECTS */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-white/5 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-slate-900 dark:text-cream flex items-center gap-2">
                  <FolderKanban size={15} className="text-slate-400" strokeWidth={2} />
                  Projets en cours
                </h3>
                <Link to="/projects" className="text-[12px] text-rihla hover:underline font-medium flex items-center gap-0.5">
                  Voir tout <ChevronRight size={13} />
                </Link>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-16"><Spinner size={24} /></div>
              ) : (projects?.length ?? 0) === 0 ? (
                <div className="py-16 text-center text-[13px] text-slate-400">Aucun projet</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {recentlyUpdated.map((p: any) => (
                    <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                      <div className="w-8 h-8 rounded-md bg-rihla/8 flex items-center justify-center text-rihla text-[12px] font-semibold flex-shrink-0">
                        {p.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 dark:text-cream truncate">{p.name}</p>
                        <p className="text-[12px] text-slate-500 truncate">{p.client_name}{p.destination && ` · ${p.destination}`}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <StatusPill status={p.status} />
                        <p className="text-[11px] text-slate-400 mt-1">{formatDistanceToNow(new Date(p.updated_at), { locale: fr, addSuffix: true })}</p>
                      </div>
                      <ArrowRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* QUICK ACTIONS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { to: '/forex',                 icon: Activity, label: 'Live Forex',     desc: 'Surveillance devises'      },
                { to: '/operations/concierge',  icon: Gem,      label: 'Conciergerie',   desc: 'Gestion VIP / à la carte'   },
                { to: '/quality',               icon: CheckCircle, label: 'Qualité & NPS', desc: 'Feedback voyageurs'        },
              ].map(action => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 rounded-lg hover:border-slate-300 dark:hover:border-white/10 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 flex items-center justify-center mb-3 group-hover:bg-rihla/8 group-hover:text-rihla transition-colors">
                    <action.icon size={15} strokeWidth={1.75} />
                  </div>
                  <h4 className="text-[13px] font-medium text-slate-900 dark:text-cream">{action.label}</h4>
                  <p className="text-[12px] text-slate-500 mt-0.5">{action.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* SIDE COLUMN — FINANCE & STATUS (4 cols) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* FINANCE WIDGET */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-semibold text-slate-900 dark:text-cream flex items-center gap-2">
                  <Receipt size={14} className="text-slate-400" strokeWidth={2} />
                  Facturation
                </h3>
                <Link to="/invoices" className="text-[12px] text-rihla hover:underline">Détail</Link>
              </div>

              <p className="text-[24px] font-semibold tabular-nums text-slate-900 dark:text-cream tracking-tight">
                {grandTotal > 0 ? `${grandTotal.toLocaleString('fr-MA')} MAD` : '—'}
              </p>
              {paidTotal > 0 && grandTotal > 0 ? (
                <p className="text-[12px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <TrendingUp size={12} strokeWidth={2.25} />
                  {Math.round((paidTotal / grandTotal) * 100)}% encaissé
                </p>
              ) : grandTotal === 0 ? (
                <p className="text-[12px] text-slate-400 mt-1">Aucune facture enregistrée</p>
              ) : null}

              {grandTotal > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-[12px] items-center">
                    <span className="text-slate-500">Payées ({paidInvoices.length})</span>
                    <span className="font-medium tabular-nums text-slate-900 dark:text-cream">{paidTotal.toLocaleString('fr-MA')} MAD</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-500"
                         style={{ width: `${Math.round((paidTotal / grandTotal) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[12px] items-center">
                    <span className="text-slate-500">En attente ({pendingInvoices.length})</span>
                    <span className="font-medium tabular-nums text-slate-900 dark:text-cream">{pendingTotal.toLocaleString('fr-MA')} MAD</span>
                  </div>
                </div>
              )}
            </div>

            {/* ACTIVITY FEED */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 rounded-lg p-5">
              <h3 className="text-[13px] font-semibold text-slate-900 dark:text-cream flex items-center gap-2 mb-4">
                <AlertCircle size={14} className="text-slate-400" strokeWidth={2} />
                Activité récente
              </h3>
              <div className="space-y-3.5">
                {recentlyUpdated.length > 0 ? (
                  recentlyUpdated.slice(0, 5).map((p: any) => {
                    const updated = new Date(p.updated_at)
                    const created = new Date(p.created_at)
                    const isNew = Math.abs(updated.getTime() - created.getTime()) < 60_000
                    return (
                      <Link key={p.id} to={`/projects/${p.id}`} className="flex gap-2.5 items-start group">
                        <div className={clsx(
                          'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                          p.status === 'in_progress' ? 'bg-blue-500' :
                          p.status === 'confirmed' || p.status === 'won' ? 'bg-emerald-500' :
                          p.status === 'draft' ? 'bg-slate-400' :
                          p.status === 'sent' ? 'bg-rihla' : 'bg-amber-500'
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-tight">
                            <span className="font-medium text-slate-900 dark:text-cream">
                              {isNew ? 'Nouveau dossier' : 'Mise à jour'}
                            </span>
                            {' · '}
                            <span className="text-rihla group-hover:underline">{p.name}</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {p.client_name ?? 'Client non défini'}
                            {p.destination && ` · ${p.destination}`}
                            {' · '}
                            {formatDistanceToNow(updated, { locale: fr, addSuffix: true })}
                          </p>
                        </div>
                      </Link>
                    )
                  })
                ) : (
                  <p className="text-[12px] text-slate-400 text-center py-4">Aucune activité récente</p>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

function CheckCircle(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

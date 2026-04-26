/**
 * OpsCockpitPage — Live Operations Cockpit (J-day real-time view).
 *
 * Polls /api/ops-cockpit every 20s. Shows:
 *  - KPIs (active projects, pax, tasks, incidents, SLA)
 *  - Alerts (critical first, then warnings)
 *  - Per-project rollup with task / incident counters
 *  - Live task list and open incidents table
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, AlertTriangle, AlertOctagon, Briefcase, CheckCircle2, Clock,
  MapPin, RefreshCw, Users,
} from 'lucide-react'
import { opsCockpitApi } from '@/lib/api'

interface Snapshot {
  generated_at: string
  company_id: string
  kpis: {
    active_projects: number
    pax_in_country: number
    tasks_today: number
    tasks_in_progress: number
    tasks_completed: number
    open_incidents: number
    critical_incidents: number
    sla_breached: number
  }
  alerts: { severity: string; code: string; message: string; project_id?: string; project_name?: string }[]
  active_projects: {
    id: string; name: string; reference?: string; client_name?: string;
    pax_count?: number; destination?: string; status: string;
    open_tasks: number; open_incidents: number; critical_incidents: number;
  }[]
  tasks: {
    id: string; project_id: string; project_name?: string; staff_name?: string;
    title: string; task_type: string; status: string;
    start_time?: string; location?: string; pax_count?: number; vehicle_info?: string;
  }[]
  incidents: {
    id: string; severity: string; message: string;
    minutes_open?: number; project_name?: string; created_at: string;
  }[]
}

const POLL_MS = 20_000

function severityClasses(sev: string) {
  switch (sev) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200'
    case 'high':     return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'warning':  return 'bg-amber-100 text-amber-800 border-amber-200'
    default:         return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function statusClasses(st: string) {
  switch (st) {
    case 'in_progress': return 'bg-blue-100 text-blue-800'
    case 'completed':   return 'bg-emerald-100 text-emerald-800'
    case 'cancelled':   return 'bg-slate-100 text-slate-600'
    default:            return 'bg-amber-100 text-amber-800'
  }
}

export default function OpsCockpitPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())

  const load = () => {
    setLoading(true)
    opsCockpitApi.snapshot()
      .then((r) => { setSnap(r.data as Snapshot); setError(null) })
      .catch((e) => setError(e?.response?.data?.detail || e.message || 'Erreur'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    const c = setInterval(() => setNow(new Date()), 1_000)
    return () => { clearInterval(t); clearInterval(c) }
  }, [])

  const sortedAlerts = useMemo(() => {
    if (!snap) return []
    const order: Record<string, number> = { critical: 0, high: 1, warning: 2, info: 3 }
    return [...snap.alerts].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  }, [snap])

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Ops Cockpit</h1>
          <p className="text-sm text-slate-500">
            Vue temps réel · {snap && `Dernière maj ${new Date(snap.generated_at).toLocaleTimeString('fr-FR')}`}
            {' · '}{now.toLocaleTimeString('fr-FR')}
          </p>
        </div>
        <button onClick={load}
                className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!snap && !error && (
        <div className="text-sm text-slate-500">Chargement…</div>
      )}

      {snap && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={<Briefcase className="h-4 w-4" />} label="Dossiers actifs"  value={snap.kpis.active_projects} />
            <Kpi icon={<Users className="h-4 w-4" />}     label="Pax in-country"   value={snap.kpis.pax_in_country} />
            <Kpi icon={<Activity className="h-4 w-4" />}  label="Tâches en cours"  value={snap.kpis.tasks_in_progress} hint={`${snap.kpis.tasks_today} aujourd'hui`} />
            <Kpi icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Tâches terminées" value={snap.kpis.tasks_completed} />
            <Kpi icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="Incidents ouverts" value={snap.kpis.open_incidents} />
            <Kpi icon={<AlertOctagon className="h-4 w-4 text-red-600" />}    label="Critiques"          value={snap.kpis.critical_incidents}
                 tone={snap.kpis.critical_incidents > 0 ? 'red' : 'default'} />
            <Kpi icon={<Clock className="h-4 w-4 text-red-600" />}           label="SLA dépassés"      value={snap.kpis.sla_breached}
                 tone={snap.kpis.sla_breached > 0 ? 'red' : 'default'} />
          </div>

          {/* Alerts */}
          {sortedAlerts.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Alertes</h2>
              <div className="space-y-2">
                {sortedAlerts.map((a, i) => (
                  <div key={i}
                       className={`flex items-start gap-2 rounded-md border p-3 text-sm ${severityClasses(a.severity)}`}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">{a.message}</div>
                      {a.project_name && (
                        <Link to={`/projects/${a.project_id}`}
                              className="text-xs underline opacity-80">
                          {a.project_name}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active projects */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Dossiers actifs ({snap.active_projects.length})
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snap.active_projects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`}
                      className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-indigo-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {p.client_name || '—'}{p.destination && ` · ${p.destination}`}
                      </div>
                    </div>
                    {p.pax_count != null && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
                        {p.pax_count} pax
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.open_tasks} tâches</span>
                    {p.open_incidents > 0 && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                        {p.open_incidents} incidents
                      </span>
                    )}
                    {p.critical_incidents > 0 && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">
                        {p.critical_incidents} critiques
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              {snap.active_projects.length === 0 && (
                <div className="col-span-full text-sm text-slate-500">Aucun dossier actif aujourd'hui.</div>
              )}
            </div>
          </section>

          {/* Tasks */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Tâches terrain ({snap.tasks.length})
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Heure</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Tâche</th>
                    <th className="px-3 py-2 text-left">Staff</th>
                    <th className="px-3 py-2 text-left">Lieu</th>
                    <th className="px-3 py-2 text-left">Pax</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.tasks.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-600">{t.start_time || '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5">{t.task_type}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{t.title}</div>
                        {t.project_name && <div className="text-xs text-slate-500">{t.project_name}</div>}
                      </td>
                      <td className="px-3 py-2">{t.staff_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {t.location && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.location}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{t.pax_count ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${statusClasses(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {snap.tasks.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-500">Aucune tâche planifiée.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Incidents */}
          {snap.incidents.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Incidents ouverts ({snap.incidents.length})
              </h2>
              <div className="space-y-2">
                {snap.incidents.map((i) => (
                  <div key={i.id}
                       className={`rounded border p-3 text-sm ${severityClasses(i.severity)}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase">{i.severity}</span>
                      <span className="text-xs text-slate-500">
                        {i.minutes_open != null ? `Ouvert depuis ${i.minutes_open} min` : ''}
                      </span>
                    </div>
                    <div className="mt-1 font-medium">{i.message}</div>
                    {i.project_name && <div className="text-xs opacity-75">Dossier : {i.project_name}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({
  icon, label, value, hint, tone = 'default',
}: {
  icon: React.ReactNode; label: string; value: number;
  hint?: string; tone?: 'default' | 'red';
}) {
  return (
    <div className={`rounded-lg border bg-white p-3 shadow-sm ${tone === 'red' ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
        {icon}<span>{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-bold ${tone === 'red' ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

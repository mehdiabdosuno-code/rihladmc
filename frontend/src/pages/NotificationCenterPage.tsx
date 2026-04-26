import { useEffect, useMemo, useState } from 'react'
import {
  Bell, AlertTriangle, Info, Star, MessageSquare, FolderKanban,
  CheckCheck, Sparkles, Briefcase, RefreshCcw, Loader2,
} from 'lucide-react'
import { useNotificationStore, RihlaNotification } from '@/stores/notificationStore'

type Bucket = 'urgent' | 'success' | 'info' | 'warning'

const TYPE_META: Record<string, { icon: any; bucket: Bucket; label: string; group: string }> = {
  review:            { icon: Star,           bucket: 'success', label: 'Avis',            group: 'reviews' },
  remark:            { icon: MessageSquare,  bucket: 'info',    label: 'Remarque guide',  group: 'guide' },
  agenda_update:     { icon: FolderKanban,   bucket: 'info',    label: 'Agenda',          group: 'guide' },
  incident:          { icon: AlertTriangle,  bucket: 'urgent',  label: 'Incident',        group: 'field' },
  companion_message: { icon: MessageSquare,  bucket: 'warning', label: 'Companion',       group: 'client' },
  system:            { icon: Info,           bucket: 'info',    label: 'Système',         group: 'system' },
}

const FALLBACK_META = { icon: Sparkles, bucket: 'info' as Bucket, label: 'Notification', group: 'system' }

const BUCKET_STYLES: Record<Bucket, string> = {
  urgent:  'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
  success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  info:    'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
}

const BUCKET_ICON_STYLES: Record<Bucket, string> = {
  urgent:  'text-red-500 bg-red-50 dark:bg-red-500/10',
  success: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  warning: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
  info:    'text-slate-400 bg-slate-50 dark:bg-white/5',
}

const FILTERS: Array<{ key: 'all' | string; label: string }> = [
  { key: 'all',     label: 'Tout' },
  { key: 'guide',   label: 'Guides' },
  { key: 'client',  label: 'Client' },
  { key: 'field',   label: 'Terrain' },
  { key: 'reviews', label: 'Avis' },
  { key: 'system',  label: 'Système' },
]

function relativeTime(iso?: string | null): string {
  if (!iso) return ''
  const dt = new Date(iso).getTime()
  if (Number.isNaN(dt)) return ''
  const diff = Math.max(0, Date.now() - dt)
  const min = Math.floor(diff / 60000)
  if (min < 1)   return "À l'instant"
  if (min < 60)  return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)     return `Il y a ${d}j`
  return new Date(iso).toLocaleDateString('fr-FR')
}

function metaFor(n: RihlaNotification) {
  return TYPE_META[n.type] ?? FALLBACK_META
}

export function NotificationCenterPage() {
  const {
    notifications, unreadCount, loading, initialized,
    fetchAll, markRead, markAllRead,
  } = useNotificationStore()
  const [activeFilter, setActiveFilter] = useState<string>('all')

  useEffect(() => {
    if (!initialized) fetchAll()
  }, [initialized, fetchAll])

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return notifications
    return notifications.filter(n => metaFor(n).group === activeFilter)
  }, [notifications, activeFilter])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">

      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 shadow-inner">
                <Bell size={24} />
              </div>
              {unreadCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-rose-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow-lg">
                  {unreadCount}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-cream">Centre de Notifications</h1>
              <p className="text-slate-400 text-xs mt-0.5 uppercase tracking-widest font-bold">
                {loading
                  ? 'Chargement…'
                  : unreadCount > 0
                    ? `${unreadCount} non lues`
                    : 'Tout est à jour'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAll()}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-cream transition-all"
            >
              <RefreshCcw size={14} /> Rafraîchir
            </button>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-cream transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCheck size={14} /> Tout marquer lu
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {FILTERS.map(f => {
            const count = f.key === 'all'
              ? notifications.length
              : notifications.filter(n => metaFor(n).group === f.key).length
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`whitespace-nowrap px-5 py-2 rounded-xl text-xs font-bold border transition-all ${activeFilter === f.key ? 'bg-ink text-white border-ink shadow-lg' : 'bg-white dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-400'}`}
              >
                {f.label}
                <span className="ml-2 text-[9px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {loading && notifications.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <Loader2 size={28} className="mx-auto animate-spin mb-3" />
            <p className="text-sm font-bold">Chargement des notifications…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(notif => {
              const meta = metaFor(notif)
              const Icon = meta.icon
              return (
                <div
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className={`relative p-5 rounded-2xl border cursor-pointer transition-all hover:shadow-md group ${BUCKET_STYLES[meta.bucket]} ${!notif.is_read ? 'ring-1 ring-offset-1 ring-rihla/20' : ''}`}
                >
                  {!notif.is_read && (
                    <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-rihla" />
                  )}
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${BUCKET_ICON_STYLES[meta.bucket]}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className={`text-sm font-bold ${notif.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-cream'}`}>
                          {notif.title}
                        </h4>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{notif.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400">
                        {notif.sender_name && (
                          <span className="inline-flex items-center gap-1">
                            <Briefcase size={10} /> {notif.sender_name}
                          </span>
                        )}
                        <span>{relativeTime(notif.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-24">
            <Bell size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
            <p className="text-sm font-bold text-slate-300 dark:text-slate-700">
              {activeFilter === 'all'
                ? 'Aucune notification pour le moment.'
                : 'Aucune notification dans cette catégorie.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

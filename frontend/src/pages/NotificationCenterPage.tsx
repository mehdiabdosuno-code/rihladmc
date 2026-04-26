import { useState } from 'react'
import { 
  Bell, CheckCircle2, AlertTriangle, Info, 
  CreditCard, Users, Calendar, MapPin,
  Filter, CheckCheck, Trash2, ChevronRight,
  Sparkles, Briefcase, TrendingUp, Bus
} from 'lucide-react'

// ── Mock Notifications ────────────────────────────────────────────
type NotifType = 'finance' | 'operations' | 'project' | 'ai' | 'system'
type Priority  = 'urgent' | 'success' | 'info' | 'warning'

interface Notification {
  id: string
  title: string
  message: string
  time: string
  type: NotifType
  priority: Priority
  read: boolean
  icon: any
}

const NOTIFICATIONS: Notification[] = [
  { id: 'N01', title: 'Paiement reçu', message: "Nordic Adventures a réglé l'acompte de 58,600 MAD pour Atlas Trekking.", time: 'Il y a 5 min', type: 'finance', priority: 'success', read: false, icon: CreditCard },
  { id: 'N02', title: 'Conflit de guide détecté', message: "Ahmed El Mansouri est assigné à 2 groupes les 12-14 Nov. Veuillez réassigner.", time: 'Il y a 18 min', type: 'operations', priority: 'urgent', read: false, icon: Users },
  { id: 'N03', title: 'Projet confirmé', message: "Grand Tour of Morocco (P01) est confirmé par Travel Agency XYZ.", time: 'Il y a 1h', type: 'project', priority: 'success', read: false, icon: CheckCircle2 },
  { id: 'N04', title: 'Taux EUR/MAD hors seuil', message: "Le taux EUR/MAD (10.48) est passé sous le seuil minimal (10.50). Vérifiez vos tarifs.", time: 'Il y a 2h', type: 'finance', priority: 'warning', read: true, icon: TrendingUp },
  { id: 'N05', title: 'Itinéraire généré par IA', message: "L'assistant IA a créé un itinéraire de 7 jours pour le groupe German Explorer.", time: 'Il y a 3h', type: 'ai', priority: 'info', read: true, icon: Sparkles },
  { id: 'N06', title: 'Rooming List importée', message: "Desert Stars Adventure : 18 passagers importés depuis Excel. Validation requise.", time: 'Il y a 5h', type: 'operations', priority: 'info', read: true, icon: Calendar },
  { id: 'N07', title: 'Nouveau partenaire ajouté', message: "Prestige Tours Paris a été ajouté à votre réseau de distribution.", time: 'Hier, 18h30', type: 'project', priority: 'info', read: true, icon: Briefcase },
  { id: 'N08', title: 'Départ de groupe demain', message: "Grand Tour of Morocco (24 PAX) départ demain à 08h00 de l'Aéroport Marrakech-Menara.", time: 'Hier, 09h00', type: 'operations', priority: 'urgent', read: true, icon: Bus },
  { id: 'N09', title: 'Facture en retard', message: "La facture INV-2026-062 pour Luxury Marrakech est en retard de 3 jours.", time: 'Il y a 2 jours', type: 'finance', priority: 'urgent', read: true, icon: AlertTriangle },
  { id: 'N10', title: 'Mise à jour système', message: "RIHLA v2.4.1 : Nouveau module Forex Live disponible.", time: 'Il y a 3 jours', type: 'system', priority: 'info', read: true, icon: Info },
]

const PRIORITY_STYLES: Record<Priority, string> = {
  urgent:  'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
  success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  info:    'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
}

const PRIORITY_ICON_STYLES: Record<Priority, string> = {
  urgent:  'text-red-500 bg-red-50 dark:bg-red-500/10',
  success: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  warning: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
  info:    'text-slate-400 bg-slate-50 dark:bg-white/5',
}

const TYPE_LABELS: Record<NotifType, string> = {
  finance:    'Finance',
  operations: 'Opérations',
  project:    'Projets',
  ai:         'Intelligence IA',
  system:     'Système',
}

export function NotificationCenterPage() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS)
  const [activeFilter, setActiveFilter] = useState<'all' | NotifType>('all')

  const filtered = notifications.filter(n => activeFilter === 'all' || n.type === activeFilter)
  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  const markRead    = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))

  const FILTERS: Array<{ key: 'all' | NotifType; label: string }> = [
    { key: 'all', label: 'Tout' },
    { key: 'finance', label: 'Finance' },
    { key: 'operations', label: 'Opérations' },
    { key: 'project', label: 'Projets' },
    { key: 'ai', label: 'IA' },
    { key: 'system', label: 'Système' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 shadow-inner">
                <Bell size={24} />
              </div>
              {unreadCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow-lg">
                  {unreadCount}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-cream">Centre de Notifications</h1>
              <p className="text-slate-400 text-xs mt-0.5 uppercase tracking-widest font-bold">
                {unreadCount > 0 ? `${unreadCount} notifications non lues` : 'Tout est à jour ✓'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-cream transition-all"
            >
              <CheckCheck size={14} /> Tout marquer lu
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:text-red-500 transition-all">
              <Trash2 size={14} /> Vider
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`whitespace-nowrap px-5 py-2 rounded-xl text-xs font-bold border transition-all ${activeFilter === f.key ? 'bg-ink text-white border-ink shadow-lg' : 'bg-white dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-400'}`}
            >
              {f.label}
              {f.key !== 'all' && (
                <span className="ml-2 text-[9px] opacity-60">
                  {notifications.filter(n => n.type === f.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filtered.map(notif => {
            const Icon = notif.icon
            return (
              <div
                key={notif.id}
                onClick={() => markRead(notif.id)}
                className={`relative p-5 rounded-2xl border cursor-pointer transition-all hover:shadow-md group ${PRIORITY_STYLES[notif.priority]} ${!notif.read ? 'ring-1 ring-offset-1 ring-rihla/20' : ''}`}
              >
                {!notif.read && (
                  <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-rihla" />
                )}
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${PRIORITY_ICON_STYLES[notif.priority]}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className={`text-sm font-bold ${notif.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-cream'}`}>
                        {notif.title}
                      </h4>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">
                        {TYPE_LABELS[notif.type]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold">{notif.time}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-24">
            <Bell size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
            <p className="text-sm font-bold text-slate-300 dark:text-slate-700">Aucune notification dans cette catégorie</p>
          </div>
        )}
      </div>
    </div>
  )
}

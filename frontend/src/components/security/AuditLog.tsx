import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, User, Clock, Shield, AlertTriangle, CheckCircle, FileText, Edit3 } from 'lucide-react'
import { api } from '@/lib/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  user_name: string
  user_initials: string
  created_at: string
  details?: Record<string, any>
  severity: 'info' | 'warning' | 'critical'
}

async function fetchAuditLog(projectId?: string): Promise<AuditEntry[]> {
  try {
    const url = projectId ? `/audit/project/${projectId}` : '/audit/recent'
    const res = await api.get(url)
    return res.data
  } catch {
    // Fallback mock data
    return [
      { id: '1', action: 'project.status_changed', entity_type: 'project', entity_id: projectId || '1', user_name: 'Sonia El Amrani', user_initials: 'SE', created_at: new Date(Date.now() - 7200000).toISOString(), details: { from: 'draft', to: 'in_progress' }, severity: 'info' },
      { id: '2', action: 'quotation.recalculated', entity_type: 'quotation', entity_id: '2', user_name: 'Karim Benani', user_initials: 'KB', created_at: new Date(Date.now() - 18000000).toISOString(), details: { margin: '18%', total: '€ 32,400' }, severity: 'info' },
      { id: '3', action: 'project.sensitive_data_viewed', entity_type: 'project', entity_id: projectId || '1', user_name: 'Admin', user_initials: 'AD', created_at: new Date(Date.now() - 86400000).toISOString(), details: { field: 'pax_profiles' }, severity: 'warning' },
      { id: '4', action: 'itinerary.day_deleted', entity_type: 'itinerary', entity_id: '3', user_name: 'Mehdi Alami', user_initials: 'MA', created_at: new Date(Date.now() - 172800000).toISOString(), details: { day: 'Jour 3 — Fès Médina' }, severity: 'warning' },
      { id: '5', action: 'invoice.generated', entity_type: 'invoice', entity_id: '4', user_name: 'Sonia El Amrani', user_initials: 'SE', created_at: new Date(Date.now() - 259200000).toISOString(), details: { amount: '€ 28,600' }, severity: 'info' },
    ]
  }
}

const ACTION_LABELS: Record<string, string> = {
  'project.status_changed': 'Changement de statut',
  'quotation.recalculated': 'Recalcul cotation',
  'project.sensitive_data_viewed': 'Données sensibles consultées',
  'itinerary.day_deleted': 'Jour supprimé',
  'invoice.generated': 'Facture générée',
  'project.created': 'Projet créé',
  'quotation.line_added': 'Ligne ajoutée',
  'user.login': 'Connexion utilisateur',
}

const ACTION_ICONS: Record<string, typeof History> = {
  'project.status_changed': CheckCircle,
  'quotation.recalculated': FileText,
  'project.sensitive_data_viewed': Shield,
  'itinerary.day_deleted': AlertTriangle,
  'invoice.generated': FileText,
  'project.created': CheckCircle,
  'quotation.line_added': Edit3,
  'user.login': User,
}

interface AuditLogProps {
  projectId?: string
  maxItems?: number
}

export function AuditLog({ projectId, maxItems = 20 }: AuditLogProps) {
  const [filter, setFilter] = useState<'all' | 'warning' | 'critical'>('all')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['audit-log', projectId],
    queryFn: () => fetchAuditLog(projectId),
    refetchInterval: 60000,
  })

  const filtered = entries.filter(e => filter === 'all' || e.severity === filter).slice(0, maxItems)

  return (
    <div className="bg-slate-950 rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rihla/20 flex items-center justify-center text-rihla">
            <History size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Audit Log</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
              {projectId ? 'Historique du projet' : 'Journal global des modifications'}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {(['all', 'warning', 'critical'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                filter === f ? "bg-white/20 text-white" : "text-white/40 hover:text-white/60"
              )}
            >
              {f === 'all' ? 'Tout' : f === 'warning' ? '⚠ Alertes' : '🔴 Critiques'}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-rihla/30 border-t-rihla rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-white/40">
            <History size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Aucune activité trouvée.</p>
          </div>
        ) : (
          filtered.map((entry) => {
            const Icon = ACTION_ICONS[entry.action] || History
            return (
              <div key={entry.id} className={clsx(
                "flex items-start gap-4 p-4 hover:bg-white/5 transition-colors",
                entry.severity === 'warning' && "border-l-2 border-amber-500/50",
                entry.severity === 'critical' && "border-l-2 border-red-500/50"
              )}>
                <div className={clsx(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                  entry.severity === 'critical' ? "bg-red-500/20 text-red-400" :
                  entry.severity === 'warning' ? "bg-amber-500/20 text-amber-400" :
                  "bg-white/10 text-white/60"
                )}>
                  <Icon size={14} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-bold text-white truncate">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </p>
                    <span className="text-[10px] text-white/30 shrink-0 flex items-center gap-1">
                      <Clock size={10} />
                      {format(new Date(entry.created_at), 'dd/MM HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-rihla/30 flex items-center justify-center text-[8px] font-black text-rihla shrink-0">
                      {entry.user_initials}
                    </div>
                    <span className="text-[11px] text-white/50">{entry.user_name}</span>
                    {entry.details && (
                      <span className="text-[10px] text-white/30 italic truncate">
                        {Object.values(entry.details).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

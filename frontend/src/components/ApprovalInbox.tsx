/**
 * ApprovalInbox — list of pending approval requests with quick approve/reject.
 */
import { useEffect, useState } from 'react'
import { Check, X, Clock, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

interface ApprovalStep {
  id: string
  position: number
  approver_role?: string | null
  approver_user_id?: string | null
  status: ApprovalStatus
  decided_at?: string | null
  comment?: string | null
}

interface ApprovalRequest {
  id: string
  entity_type: string
  entity_id: string
  status: ApprovalStatus
  note?: string | null
  submitted_by: string
  steps: ApprovalStep[]
  created_at: string
  snapshot?: Record<string, unknown>
}

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
}

export function ApprovalInbox() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<ApprovalRequest[]>('/approvals', {
        params: { status: 'pending' },
      })
      setRequests(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id)
    try {
      await api.post(`/approvals/${id}/${action}`, { comment: '' })
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Chargement…</div>
  if (error)   return <div className="p-6 text-sm text-red-600 flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{error}</div>
  if (!requests.length) return (
    <div className="p-8 text-center text-sm text-slate-500">
      <Clock className="mx-auto mb-2 h-6 w-6" />
      Aucune demande en attente.
    </div>
  )

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        const currentStep = req.steps.find(s => s.status === 'pending')
        return (
          <div key={req.id}
               className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">
                    {req.entity_type}
                  </span>
                  <span className={clsx('rounded px-2 py-0.5 text-xs font-semibold', STATUS_COLORS[req.status])}>
                    {req.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(req.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  Demande sur {req.entity_type} #{req.entity_id.slice(0, 8)}
                </div>
                {req.note && (
                  <div className="mt-1 text-sm text-slate-500">{req.note}</div>
                )}
                {currentStep && (
                  <div className="mt-2 text-xs text-slate-500">
                    Étape {currentStep.position + 1} — Approbateur :
                    {' '}
                    <span className="font-medium text-slate-700">
                      {currentStep.approver_role || currentStep.approver_user_id}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  disabled={busy === req.id}
                  onClick={() => decide(req.id, 'approve')}
                  className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Approuver
                </button>
                <button
                  disabled={busy === req.id}
                  onClick={() => decide(req.id, 'reject')}
                  className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Rejeter
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

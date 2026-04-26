import { useEffect, useState } from 'react'
import {
  Bot,
  Play,
  Pause,
  Send,
  AlertCircle,
  Clock,
  Mail,
  TrendingUp,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react'
import { paymentAgentApi } from '@/lib/api'
import type {
  AgentQueueItem,
  AgentStats,
  AgentTimeline,
  AgentRunReport,
} from '@/lib/api'

const LEVEL_LABELS = ['Initial', 'J+3 amical', 'J+7 ferme', 'J+10 escalade']
const LEVEL_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-rose-50 text-rose-700 border-rose-200',
]

export function PaymentAgentPage() {
  const [queue, setQueue] = useState<AgentQueueItem[]>([])
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<AgentRunReport | null>(null)
  const [timeline, setTimeline] = useState<AgentTimeline | null>(null)
  const [smtpConfigured, setSmtpConfigured] = useState(false)

  const load = async () => {
    const [q, s, st] = await Promise.all([
      paymentAgentApi.queue(),
      paymentAgentApi.stats(),
      paymentAgentApi.settings(),
    ])
    setQueue(q.data)
    setStats(s.data)
    setSmtpConfigured(s.data ? Boolean((st.data as any).smtp_configured) : false)
  }

  useEffect(() => {
    load()
  }, [])

  const runAgent = async (force: boolean) => {
    setRunning(true)
    setReport(null)
    try {
      const r = await paymentAgentApi.run(force)
      setReport(r.data)
      await load()
      setTimeout(() => setReport(null), 6000)
    } finally {
      setRunning(false)
    }
  }

  const triggerOne = async (invoiceId: string) => {
    await paymentAgentApi.trigger(invoiceId)
    await load()
  }

  const togglePause = async (q: AgentQueueItem) => {
    if (q.is_paused) await paymentAgentApi.resume(q.invoice_id)
    else await paymentAgentApi.pause(q.invoice_id)
    await load()
  }

  const openTimeline = async (invoiceId: string) => {
    const r = await paymentAgentApi.timeline(invoiceId)
    setTimeline(r.data)
  }

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-violet-50 p-2">
            <Bot className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-slate-900">
              Agent Acompte <span className="text-sm font-normal text-slate-500">— Copilot autonome</span>
            </h1>
            <p className="text-sm text-slate-500">
              Relance automatique des factures impayées · J0 / J+3 / J+7 / J+10 escalade
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={running}
            onClick={() => runAgent(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Lancer le cron
          </button>
          <button
            disabled={running}
            onClick={() => runAgent(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Forcer le passage suivant
          </button>
        </div>
      </div>

      {/* Banner: SMTP status */}
      {!smtpConfigured && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          <span>
            <span className="font-semibold">Mode demo</span> — SMTP non configuré, les emails sont simulés
            (loggués en console). Configurez <code className="rounded bg-amber-100 px-1">SMTP_HOST</code>,{' '}
            <code className="rounded bg-amber-100 px-1">SMTP_USER</code>,{' '}
            <code className="rounded bg-amber-100 px-1">SMTP_PASS</code> pour activer la livraison réelle.
          </span>
        </div>
      )}

      {/* Run report banner */}
      {report && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            <span className="font-semibold">Cycle terminé</span> — {report.processed} facture(s) traitée(s) ·{' '}
            {report.sent} email(s) envoyé(s) · {report.skipped_paid} payée(s) · {report.skipped_paused} en pause
          </span>
        </div>
      )}

      {/* Stats KPIs */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
              File d'attente
            </div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{stats.queue_size}</div>
            <div className="mt-1 text-xs text-slate-500">
              {stats.paused} en pause manuelle
            </div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-rose-700">
              Encours à risque
            </div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">
              {stats.total_at_risk.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {Object.entries(stats.currency_breakdown).map(([c, v]) => (
                <span key={c} className="mr-2">
                  {v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {c}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Niveau atteint
            </div>
            <div className="mt-2 space-y-1">
              {LEVEL_LABELS.map((lbl, i) => {
                const cnt = stats.by_level[String(i)] || 0
                if (cnt === 0) return null
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${LEVEL_COLORS[i]}`}>
                      {lbl}
                    </span>
                    <span className="font-medium text-slate-700">{cnt}</span>
                  </div>
                )
              })}
              {Object.keys(stats.by_level).length === 0 && (
                <span className="text-xs text-slate-400">Aucune relance lancée</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Cadence configurée
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-600">
              <div>J0 — Email courtois + lien Stripe</div>
              <div>J+3 — Rappel amical</div>
              <div>J+7 — Rappel ferme</div>
              <div className="text-rose-700 font-medium">J+10 — Escalade commercial</div>
            </div>
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Factures suivies par l'agent ({queue.length})
          </h3>
        </div>
        {queue.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            Aucune facture impayée à relancer.
          </div>
        )}
        {queue.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Facture</th>
                <th className="px-5 py-2 text-left font-medium">Client</th>
                <th className="px-5 py-2 text-right font-medium">Montant</th>
                <th className="px-5 py-2 text-left font-medium">Niveau</th>
                <th className="px-5 py-2 text-left font-medium">Prochaine action</th>
                <th className="px-5 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.map((q) => (
                <tr
                  key={q.invoice_id}
                  className={q.is_paused ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50/50'}
                >
                  <td className="px-5 py-3">
                    <button
                      onClick={() => openTimeline(q.invoice_id)}
                      className="font-medium text-slate-900 hover:text-[#B43E20]"
                    >
                      {q.invoice_number}
                    </button>
                    <div className="text-xs text-slate-500">{q.days_overdue}j depuis émission</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-slate-700">{q.client_name || '—'}</div>
                    <div className="text-xs text-slate-500">{q.client_email || '—'}</div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="font-medium text-slate-900">
                      {q.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {q.currency}
                    </div>
                    <div className="text-xs text-slate-500">
                      acompte {q.deposit_amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {q.last_level === -1 ? (
                      <span className="text-xs text-slate-400">Aucune relance</span>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs ${
                          LEVEL_COLORS[q.last_level] || 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {LEVEL_LABELS[q.last_level] || `Niveau ${q.last_level}`}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {q.next_level === null ? (
                      <span className="text-xs text-rose-700 font-medium">Escalade complète</span>
                    ) : (
                      <div className="text-xs">
                        <div className="text-slate-700">{LEVEL_LABELS[q.next_level]}</div>
                        <div className="text-slate-400">
                          <Clock className="mr-1 inline h-3 w-3" />
                          {q.next_due_at
                            ? new Date(q.next_due_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                              })
                            : '—'}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => triggerOne(q.invoice_id)}
                        disabled={q.next_level === null || q.is_paused}
                        className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        title="Déclencher la relance suivante"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => togglePause(q)}
                        className={`rounded-md border p-1.5 ${
                          q.is_paused
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        title={q.is_paused ? 'Reprendre' : 'Mettre en pause'}
                      >
                        {q.is_paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Timeline drawer */}
      {timeline && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/40"
          onClick={() => setTimeline(null)}
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Timeline · {timeline.invoice_number}</h3>
                <p className="text-xs text-slate-500">{timeline.client_email}</p>
              </div>
              <button onClick={() => setTimeline(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              {timeline.history.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Aucune relance pour le moment.
                </div>
              )}
              <ol className="relative space-y-4 border-l-2 border-slate-100 pl-6">
                {timeline.history.map((h) => (
                  <li key={h.id} className="relative">
                    <span
                      className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white shadow-sm ${
                        h.status === 'sent' ? 'bg-emerald-500' :
                        h.status === 'simulated' ? 'bg-blue-500' : 'bg-rose-500'
                      }`}
                    >
                      <Mail className="h-3 w-3" />
                    </span>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs ${
                            LEVEL_COLORS[h.level] || ''
                          }`}
                        >
                          {LEVEL_LABELS[h.level]}
                        </span>
                        <span className="text-xs text-slate-400">
                          {h.sent_at ? new Date(h.sent_at).toLocaleString('fr-FR') : '—'}
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm font-medium text-slate-900">{h.subject}</div>
                      <div className="mt-1 text-xs text-slate-500">→ {h.recipient}</div>
                      <div className="mt-2 whitespace-pre-line border-t border-slate-100 pt-2 text-xs text-slate-600">
                        {h.body_preview}
                      </div>
                      <div className="mt-2 text-xs">
                        <span
                          className={`rounded-md px-1.5 py-0.5 ${
                            h.status === 'sent' ? 'bg-emerald-50 text-emerald-700' :
                            h.status === 'simulated' ? 'bg-blue-50 text-blue-700' :
                            'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {h.status === 'simulated' ? 'simulé (demo)' : h.status}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
                {timeline.next_level !== null && (
                  <li className="relative opacity-70">
                    <span className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-300 text-white shadow-sm">
                      <Clock className="h-3 w-3" />
                    </span>
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
                          Prochain · {LEVEL_LABELS[timeline.next_level]}
                        </span>
                        <span className="text-xs text-slate-500">
                          {timeline.next_due_at
                            ? new Date(timeline.next_due_at).toLocaleString('fr-FR')
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </li>
                )}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentAgentPage

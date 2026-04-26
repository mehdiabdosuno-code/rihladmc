import { useEffect, useState } from 'react'
import {
  Plug,
  Check,
  AlertCircle,
  CreditCard,
  Calendar,
  Sparkles,
  ExternalLink,
  Loader2,
  Unplug,
  RefreshCw,
} from 'lucide-react'
import {
  paymentsApi,
  calendarSyncApi,
  proposalWriterApi,
  projectsApi,
} from '@/lib/api'
import type {
  PaymentsStatus,
  CalSyncStatus,
  ProposalWriterStatus,
  CalEventPreview,
} from '@/lib/api'

interface ProjectLite {
  id: string
  name: string
}

export function IntegrationsPage() {
  const [pay, setPay] = useState<PaymentsStatus | null>(null)
  const [cal, setCal] = useState<CalSyncStatus | null>(null)
  const [ai, setAI] = useState<ProposalWriterStatus | null>(null)
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [previewProject, setPreviewProject] = useState<string>('')
  const [preview, setPreview] = useState<CalEventPreview[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = async () => {
    const [p, c, a] = await Promise.allSettled([
      paymentsApi.status(),
      calendarSyncApi.status(),
      proposalWriterApi.status(),
    ])
    if (p.status === 'fulfilled') setPay(p.value.data)
    if (c.status === 'fulfilled') setCal(c.value.data)
    if (a.status === 'fulfilled') setAI(a.value.data)
  }

  useEffect(() => {
    refresh()
    projectsApi.list({ limit: 50 }).then((r) => {
      const items = (r.data?.items ?? r.data ?? []) as ProjectLite[]
      setProjects(items)
      if (items.length) setPreviewProject(items[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!previewProject) return
    calendarSyncApi.preview(previewProject).then((r) => setPreview(r.data)).catch(() => {})
  }, [previewProject])

  const handleConnectMs = async () => {
    setLoading('ms')
    try {
      const { data } = await calendarSyncApi.authStart()
      window.location.href = data.auth_url
    } catch (e) {
      setMsg({ kind: 'err', text: 'Échec ouverture OAuth' })
    } finally {
      setLoading(null)
    }
  }

  const handleDisconnect = async () => {
    setLoading('ms')
    try {
      await calendarSyncApi.disconnect()
      await refresh()
      setMsg({ kind: 'ok', text: 'Compte Microsoft déconnecté' })
    } finally {
      setLoading(null)
    }
  }

  const handlePush = async () => {
    if (!previewProject) return
    setLoading('push')
    try {
      const { data } = await calendarSyncApi.push({ project_id: previewProject })
      setMsg({
        kind: data.is_demo ? 'ok' : 'ok',
        text: data.is_demo
          ? `Demo mode : ${data.events_planned} événement(s) seraient ajoutés`
          : `${data.events_pushed} / ${data.events_planned} événement(s) ajoutés à votre Outlook`,
      })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setMsg({ kind: 'err', text: err.response?.data?.detail || 'Échec push' })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="max-w-[1200px] mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rihla/10 flex items-center justify-center">
              <Plug className="w-5 h-5 text-rihla" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-900">Intégrations</h1>
              <p className="text-xs text-slate-500">
                Connectez Claude, Stripe + CMI et Microsoft Outlook
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw size={12} /> Rafraîchir
          </button>
        </div>

        {msg && (
          <div
            className={`mb-4 flex items-start gap-2 p-3 rounded-lg text-sm border ${
              msg.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {msg.kind === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
            <div>{msg.text}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* A2 — Claude */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Anthropic Claude</h3>
                  <p className="text-[11px] text-slate-500">Proposition IA · {ai?.model}</p>
                </div>
              </div>
              <Badge configured={!!ai?.configured} />
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Génère des propositions commerciales en français, anglais et espagnol depuis
              les données de chaque dossier.
            </p>
            {!ai?.configured && (
              <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
                Pour activer : configurer la variable d'environnement{' '}
                <code className="bg-white px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                  ANTHROPIC_API_KEY
                </code>{' '}
                puis redémarrer le backend.
              </div>
            )}
            <a
              href="/proposal-writer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rihla hover:underline"
            >
              Ouvrir Proposition IA <ExternalLink size={11} />
            </a>
          </div>

          {/* B5 — Stripe + CMI */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Paiements en ligne
                  </h3>
                  <p className="text-[11px] text-slate-500">Stripe + CMI Maroc</p>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <Row label="Stripe (carte internationale)" ok={!!pay?.stripe_configured} />
              <Row label="CMI Maroc (carte domestique MAD)" ok={!!pay?.cmi_configured} />
            </div>
            <div className="mt-4 text-[11px] text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
              Variables nécessaires :{' '}
              <code className="bg-white px-1 rounded border border-slate-200">STRIPE_SECRET_KEY</code>,{' '}
              <code className="bg-white px-1 rounded border border-slate-200">CMI_MERCHANT_ID</code>,{' '}
              <code className="bg-white px-1 rounded border border-slate-200">CMI_STORE_KEY</code>.
              Endpoints disponibles dès maintenant en mode demo.
            </div>
            <a
              href="/invoices"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rihla hover:underline"
            >
              Aller aux factures <ExternalLink size={11} />
            </a>
          </div>

          {/* B7 — Microsoft Outlook */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Microsoft Outlook Calendar
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Push transferts, check-ins et briefings vers le calendrier de l'équipe
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge configured={!!cal?.configured} connected={!!cal?.connected} />
                {cal?.connected ? (
                  <button
                    onClick={handleDisconnect}
                    disabled={loading === 'ms'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    {loading === 'ms' ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />}
                    Déconnecter
                  </button>
                ) : (
                  <button
                    onClick={handleConnectMs}
                    disabled={loading === 'ms'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm"
                  >
                    {loading === 'ms' ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                    Connecter Outlook
                  </button>
                )}
              </div>
            </div>

            {cal?.connected && cal.user_email && (
              <div className="mb-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Connecté en tant que <strong>{cal.user_email}</strong>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="md:col-span-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                  Aperçu du dossier
                </label>
                <select
                  value={previewProject}
                  onChange={(e) => setPreviewProject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={handlePush}
                  disabled={!previewProject || loading === 'push'}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-rihla rounded-lg shadow-sm disabled:opacity-50"
                >
                  {loading === 'push' ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                  Pousser dans Outlook
                </button>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                  Événements générés ({preview.length})
                </label>
                <div className="max-h-[260px] overflow-y-auto bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100">
                  {preview.length === 0 && (
                    <div className="text-xs text-slate-400 px-3 py-6 text-center">
                      Aucun événement (le dossier n'a pas d'itinéraire détaillé)
                    </div>
                  )}
                  {preview.map((e, i) => (
                    <div key={i} className="px-3 py-2 flex items-start gap-3 text-xs">
                      <CategoryBadge cat={e.category} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{e.subject}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(e.start).toLocaleString('fr-FR', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                          {e.location && ' · ' + e.location}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Badge({ configured, connected }: { configured: boolean; connected?: boolean }) {
  if (connected) {
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
        Connecté
      </span>
    )
  }
  if (!configured) {
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
        Demo mode
      </span>
    )
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
      Configuré
    </span>
  )
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-700">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
          <Check size={12} /> Configuré
        </span>
      ) : (
        <span className="flex items-center gap-1 text-amber-700 font-semibold">
          <AlertCircle size={12} /> Demo
        </span>
      )}
    </div>
  )
}

function CategoryBadge({ cat }: { cat: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    'check-in': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'CI' },
    transfer: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'TR' },
    briefing: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'BR' },
    activity: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'AC' },
  }
  const m = map[cat] || { bg: 'bg-slate-100', text: 'text-slate-700', label: '••' }
  return (
    <span
      className={`flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md ${m.bg} ${m.text} text-[10px] font-black`}
      title={cat}
    >
      {m.label}
    </span>
  )
}

export default IntegrationsPage

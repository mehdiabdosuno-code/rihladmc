import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Sparkles,
  Wand2,
  Copy,
  Check,
  Languages,
  Mic,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { projectsApi, proposalWriterApi } from '@/lib/api'
import type { ProposalWriterStatus, ProposalWriterResult } from '@/lib/api'

type Lang = 'fr' | 'en' | 'es'
type Tone = 'premium' | 'warm' | 'concise' | 'poetic'

const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
]
const TONES: { id: Tone; label: string; desc: string }[] = [
  { id: 'premium', label: 'Premium', desc: 'Élégant, hôtellerie 5★' },
  { id: 'warm', label: 'Chaleureux', desc: 'Accessible, humain' },
  { id: 'concise', label: 'Concis', desc: 'Factuel, droit au but' },
  { id: 'poetic', label: 'Poétique', desc: 'Littéraire, évocateur' },
]

interface ProjectLite {
  id: string
  name: string
  client_name?: string | null
  destination?: string | null
  duration_days?: number | null
  pax_count?: number | null
}

export function ProposalWriterPage() {
  const [status, setStatus] = useState<ProposalWriterStatus | null>(null)
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [language, setLanguage] = useState<Lang>('fr')
  const [tone, setTone] = useState<Tone>('premium')
  const [extra, setExtra] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProposalWriterResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    proposalWriterApi.status().then((r) => setStatus(r.data)).catch(() => {})
    projectsApi.list({ limit: 50 }).then((r) => {
      const items: ProjectLite[] = (r.data?.items ?? r.data ?? []) as ProjectLite[]
      setProjects(items)
      if (items.length && !projectId) setProjectId(items[0].id)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  const handleGenerate = async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data } = await proposalWriterApi.generate({
        project_id: projectId,
        language,
        tone,
        extra_instructions: extra || undefined,
      })
      setResult(data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err.response?.data?.detail || err.message || 'Erreur génération')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result?.content) return
    await navigator.clipboard.writeText(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rihla/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-rihla" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-900">
                Proposition IA
              </h1>
              <p className="text-xs text-slate-500">
                Rédige une proposition commerciale prête à envoyer en quelques secondes
              </p>
            </div>
          </div>
          {status && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
                status.configured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {status.configured
                ? `Claude actif · ${status.model}`
                : 'Mode demo · configurez ANTHROPIC_API_KEY'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left controls */}
          <div className="col-span-4 space-y-4">
            {/* Project selector */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
                Dossier source
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rihla/20 focus:border-rihla"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.client_name ? ` — ${p.client_name}` : ''}
                  </option>
                ))}
              </select>
              {selected && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-slate-400">Destination</div>
                    <div className="font-semibold text-slate-700 truncate">
                      {selected.destination || '—'}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-slate-400">PAX / Durée</div>
                    <div className="font-semibold text-slate-700">
                      {selected.pax_count ?? '—'} / {selected.duration_days ?? '—'}j
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Language */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Languages size={11} /> Langue
              </label>
              <div className="grid grid-cols-3 gap-2">
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLanguage(l.id)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                      language === l.id
                        ? 'bg-rihla text-white border-rihla shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="mr-1">{l.flag}</span> {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Mic size={11} /> Ton
              </label>
              <div className="space-y-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                      tone === t.id
                        ? 'bg-rihla/5 border-rihla'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900">{t.label}</div>
                    <div className="text-[11px] text-slate-500">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Extra instructions */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
                Instructions additionnelles (optionnel)
              </label>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={3}
                placeholder="Ex: insister sur le SPA, mentionner la loterie privée hammam, ton plus formel…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-rihla/20 focus:border-rihla"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!projectId || loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-rihla text-white text-sm font-bold rounded-xl shadow-lg shadow-rihla/20 hover:shadow-rihla/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Rédaction en cours…
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" /> Rédiger la proposition
                </>
              )}
            </button>
          </div>

          {/* Right preview */}
          <div className="col-span-8">
            <div className="bg-white rounded-xl border border-slate-200 min-h-[600px]">
              {/* toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  {result && (
                    <>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold">
                        {result.word_count} mots
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold">
                        {result.duration_ms} ms
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold uppercase">
                        {result.provider}
                      </span>
                      {result.cost_estimate_usd != null && result.cost_estimate_usd > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                          ~${result.cost_estimate_usd.toFixed(4)}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={handleCopy}
                  disabled={!result?.content}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg disabled:opacity-40 transition"
                >
                  {copied ? (
                    <>
                      <Check size={12} /> Copié
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copier
                    </>
                  )}
                </button>
              </div>

              {/* content */}
              <div className="p-8">
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div>{error}</div>
                  </div>
                )}
                {!result && !loading && !error && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-rihla/5 flex items-center justify-center mb-4">
                      <Sparkles className="w-6 h-6 text-rihla" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-1">
                      Sélectionnez un dossier puis lancez la rédaction
                    </h3>
                    <p className="text-sm text-slate-500 max-w-md">
                      L'IA récupère automatiquement le programme, les hôtels et le tarif
                      pour rédiger une proposition prête à envoyer.
                    </p>
                  </div>
                )}
                {loading && (
                  <div className="space-y-2 animate-pulse">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="h-3 bg-slate-100 rounded"
                        style={{ width: `${60 + Math.random() * 40}%` }}
                      />
                    ))}
                  </div>
                )}
                {result && (
                  <article className="prose prose-slate prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h3:text-base prose-p:text-sm prose-li:text-sm max-w-none">
                    <ReactMarkdown>{result.content}</ReactMarkdown>
                  </article>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProposalWriterPage

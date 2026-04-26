import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail, Sparkles, Loader2, Copy, Check, ArrowRight,
  Users, Calendar, MapPin, Hotel, Bus, Compass, Star,
  AlertTriangle, CheckCircle2, RefreshCw, FileText, Zap,
} from 'lucide-react'
import { aiApi, projectsApi } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────
interface ExtractedQuotation {
  client_name: string | null
  group_size: number | null
  arrival_date: string | null
  departure_date: string | null
  duration_nights: number | null
  cities: string[]
  services: {
    hotel: boolean
    transport: boolean
    activities: boolean
    guide: boolean
  }
  hotel_category: string | null
  special_requests: string | null
  language: 'FR' | 'EN' | 'OTHER'
  confidence_score: number
}

// ── Prompt template ───────────────────────────────────────────────
const buildPrompt = (email: string) => `You are an expert travel assistant specialized in DMC quotations.

Your task is to extract structured data from a client email.

Return ONLY a valid JSON with this structure:

{
  "client_name": "",
  "group_size": number,
  "arrival_date": "",
  "departure_date": "",
  "duration_nights": number,
  "cities": [],
  "services": {
    "hotel": true/false,
    "transport": true/false,
    "activities": true/false,
    "guide": true/false
  },
  "hotel_category": "",
  "special_requests": "",
  "language": "FR/EN/OTHER",
  "confidence_score": 0-1
}

Rules:
- If information is missing, use null
- Extract approximate values if needed (ex: "around 20 people" → 20)
- Detect cities and normalize names
- Detect dates even if informal
- Do not explain anything, only return JSON

EMAIL:
"""
${email}
"""`;

// ── Sample emails for demo ────────────────────────────────────────
const SAMPLES = [
  {
    label: 'Email Anglais (TO anglophone)',
    email: `Hi,

I'm reaching out on behalf of Sunset Tours Australia. We are planning a group trip to Morocco for approximately 22 participants.

We would like to arrive in Casablanca around the 5th of November 2026, and spend about 9 nights exploring the country — including Fes, the Sahara Desert (Merzouga), and finishing in Marrakech.

We need full transportation, 4-star hotels (with breakfast included), an English-speaking guide throughout, and would love to include a camel ride and a night at a desert camp.

Please let me know if you can accommodate this and provide a rough quote.

Best regards,
James Harper
Sunset Tours Australia`,
  },
  {
    label: 'Email Français (agence européenne)',
    email: `Bonjour,

Notre agence (Voyages Lumière, Paris) souhaite organiser un circuit pour un groupe de 30 personnes au Maroc en novembre 2026.

Arrivée prévue à Casablanca le 1er novembre, départ de Marrakech le 10 novembre (9 nuits).

Villes souhaitées : Casablanca, Rabat, Chefchaouen, Fès, Erfoud, Ouarzazate, Marrakech.

Prestations demandées : hôtels 4 étoiles demi-pension, transport autocar climatisé, guide francophone toute la durée, entrées monuments incluses. Demande spéciale : soirée folklore et dîner berbère dans le désert.

Dans l'attente de votre retour,
Marie Dupont - Responsable circuits`,
  },
  {
    label: 'Email informel (client direct)',
    email: `salut, on est une bande d'amis environ 15 personnes, on voudrait faire le maroc en novembre, genre 8-10 jours. on aime les riads, le desert, et la bouffe locale. on a pas trop de budget mais on veut quand meme un bon guide. vous faites des prix pour des petits groupes? merci`,
  },
]

// ── Confidence badge ──────────────────────────────────────────────
function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? '#059669' : pct >= 60 ? '#d97706' : '#e63900'
  const label = pct >= 80 ? 'Haute' : pct >= 60 ? 'Moyenne' : 'Faible'
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${pct} 100`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black" style={{ color }}>{pct}%</span>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700">Confiance {label}</p>
        <p className="text-[10px] text-slate-400">Score d'extraction IA</p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export function EmailQuotationPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [provider, setProvider] = useState<'anthropic' | 'ollama'>('anthropic')
  const [result, setResult] = useState<ExtractedQuotation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [rawJson, setRawJson] = useState('')

  const extract = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await aiApi.generate(buildPrompt(email), provider)
      const raw = res.data?.content || ''
      setRawJson(raw)
      // Parse JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Réponse IA invalide — JSON introuvable')
      const parsed = JSON.parse(jsonMatch[0])
      setResult(parsed)
    } catch (e: any) {
      // Fallback: try parsing directly
      try {
        const parsed = JSON.parse(rawJson)
        setResult(parsed)
      } catch {
        setError(e.message || 'Erreur d\'extraction. Vérifiez la connexion IA.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!result) return
    setSaving(true)
    try {
      const payload = {
        name: `Circuit ${result.cities[0] || 'Maroc'} — ${result.client_name || 'Prospect'}`,
        client_name: result.client_name || 'Client Inconnu',
        project_type: 'leisure',
        destination: result.cities.join(', '),
        duration_days: result.duration_nights ? result.duration_nights + 1 : undefined,
        pax_count: result.group_size || undefined,
        notes: `Extrait d'email via IA.\n\nDemandes spéciales : ${result.special_requests || 'Aucune'}\nLangue : ${result.language}`,
      }
      const res = await projectsApi.create(payload)
      navigate(`/projects/${res.data.id}`)
    } catch (e: any) {
      alert(`Erreur lors de la création du projet : ${e.response?.data?.detail || e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const copyJson = () => {
    navigator.clipboard.writeText(rawJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadSample = (s: typeof SAMPLES[0]) => {
    setEmail(s.email)
    setResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#140800 0%,#2a1200 100%)' }} className="px-8 py-6 shadow-xl">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={13} className="text-amber-400" />
              <span className="text-amber-400/80 text-[10px] font-bold uppercase tracking-[0.3em]">S'TOURS DMC · IA Extraction</span>
            </div>
            <h1 className="text-xl font-bold text-white">Email → Cotation Automatique</h1>
            <p className="text-white/40 text-xs mt-0.5">Collez un email client, l'IA extrait les données de cotation en 1 clic</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setProvider('anthropic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${provider === 'anthropic' ? 'bg-amber-400 text-ink shadow-lg' : 'text-white/60 hover:text-white'}`}
              >
                <Sparkles size={11} /> CLAUDE
              </button>
              <button
                onClick={() => setProvider('ollama')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${provider === 'ollama' ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
              >
                <Zap size={11} /> LOCAL (GEMMA)
              </button>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <Mail size={14} className="text-amber-400" />
              <span className="text-white text-sm font-bold">Extraction IA</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-8">

          {/* LEFT: Input */}
          <div className="col-span-5 space-y-4">
            {/* Sample emails */}
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Exemples d'emails</p>
              <div className="space-y-1.5">
                {SAMPLES.map(s => (
                  <button key={s.label} onClick={() => loadSample(s)}
                    className="w-full text-left px-3 py-2.5 bg-white rounded-lg border border-slate-100 hover:border-rihla/30 hover:bg-rihla/5 transition-all text-xs text-slate-600 font-medium flex items-center justify-between group shadow-sm">
                    <span>{s.label}</span>
                    <ArrowRight size={12} className="text-slate-300 group-hover:text-rihla transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Email textarea */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Mail size={13} className="text-rihla" />
                <span className="text-xs font-bold text-slate-700">Contenu de l'email client</span>
                {email && (
                  <button onClick={() => { setEmail(''); setResult(null); setError(null) }}
                    className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
                    <RefreshCw size={10} /> Effacer
                  </button>
                )}
              </div>
              <textarea
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Collez ici l'email du client ou du tour-opérateur…"
                className="w-full h-64 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none leading-relaxed"
              />
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{email.length} caractères</span>
                <button onClick={extract} disabled={!email.trim() || loading}
                  className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-bold rounded-xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:transform-none"
                  style={{ background: 'linear-gradient(135deg,#e63900,#c93000)' }}>
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" />Extraction…</>
                    : <><Sparkles size={14} />Extraire les données</>}
                </button>
              </div>
            </div>

            {/* Raw JSON (collapsible) */}
            {rawJson && (
              <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-emerald-400 max-h-48 overflow-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">JSON Brut</span>
                  <button onClick={copyJson} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
                    {copied ? <><Check size={10} />Copié</> : <><Copy size={10} />Copier</>}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap break-all">{rawJson}</pre>
              </div>
            )}
          </div>

          {/* RIGHT: Result */}
          <div className="col-span-7">
            {!result && !error && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <Mail size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-600 font-bold mb-1">En attente d'un email</p>
                <p className="text-sm text-slate-400">Collez un email client ou choisissez un exemple, puis cliquez sur "Extraire les données".</p>
              </div>
            )}

            {loading && (
              <div className="h-full flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Loader2 size={32} className="text-rihla animate-spin mb-4" />
                <p className="font-bold text-slate-700">Claude analyse l'email…</p>
                <p className="text-xs text-slate-400 mt-1">Extraction des entités, dates, villes et services</p>
              </div>
            )}

            {error && (
              <div className="p-6 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700">Erreur d'extraction</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                  <p className="text-xs text-red-400 mt-2">Vérifiez que le service IA est actif : <code>uvicorn app.main:app --reload --port 8000</code></p>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Confidence + header */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-500" />
                      Données extraites avec succès
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Langue détectée : <strong>{result.language}</strong> ·
                      Client : <strong>{result.client_name || 'Non identifié'}</strong>
                    </p>
                  </div>
                  <ConfidenceBadge score={result.confidence_score} />
                </div>

                {/* Main grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Group & dates */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Groupe & Dates</p>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-rihla/10 flex items-center justify-center">
                        <Users size={16} className="text-rihla" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Taille du groupe</p>
                        <p className="text-2xl font-black text-rihla">{result.group_size ?? '?'} <span className="text-sm font-normal text-slate-400">pax</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Calendar size={16} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Arrivée → Départ</p>
                        <p className="text-sm font-bold text-slate-700">
                          {result.arrival_date ?? '?'} → {result.departure_date ?? '?'}
                        </p>
                        <p className="text-[10px] text-slate-400">{result.duration_nights ?? '?'} nuits</p>
                      </div>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-3">Services Demandés</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'hotel', label: 'Hôtel', icon: Hotel },
                        { key: 'transport', label: 'Transport', icon: Bus },
                        { key: 'activities', label: 'Activités', icon: Compass },
                        { key: 'guide', label: 'Guide', icon: Star },
                      ].map(s => {
                        const active = result.services?.[s.key as keyof typeof result.services]
                        return (
                          <div key={s.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                            <s.icon size={12} />
                            {s.label}
                            {active ? <CheckCircle2 size={10} className="ml-auto" /> : <span className="ml-auto opacity-40">—</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Cities */}
                {result.cities?.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-3">Villes du Circuit</p>
                    <div className="flex flex-wrap gap-2">
                      {result.cities.map((city, i) => (
                        <div key={city} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 text-xs font-bold text-slate-700">
                          <MapPin size={10} className="text-rihla" />
                          {city}
                          {i < result.cities.length - 1 && <ArrowRight size={9} className="text-slate-300 ml-1" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hotel cat & special requests */}
                <div className="grid grid-cols-2 gap-4">
                  {result.hotel_category && (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Catégorie Hôtel</p>
                      <p className="font-bold text-slate-700 flex items-center gap-1">
                        <Hotel size={13} className="text-amber-500" />
                        {result.hotel_category}
                      </p>
                    </div>
                  )}
                  {result.special_requests && (
                    <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                      <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">Demandes Spéciales</p>
                      <p className="text-xs text-amber-800 leading-relaxed">{result.special_requests}</p>
                    </div>
                  )}
                </div>

                {/* CTA: Create quotation */}
                <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Prêt à créer la cotation ?</p>
                    <p className="text-xs text-slate-400 mt-0.5">Ces données peuvent pré-remplir un nouveau projet</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copyJson}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      JSON
                    </button>
                    <button onClick={handleCreateProject} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#e63900,#c93000)' }}>
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                      {saving ? 'Création...' : 'Créer le projet'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

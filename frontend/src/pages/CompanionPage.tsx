/**
 * CompanionPage — client-facing Travel Companion (no auth).
 *
 * Mounted on /companion/:token. Reads the magic-link token from the URL,
 * fetches the trip view, and renders an itinerary timeline + contacts.
 *
 * Uses native fetch (not the shared axios client) because this page is
 * unauthenticated and must NOT carry the agency JWT.
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Calendar, MapPin, Hotel, UtensilsCrossed, Phone,
  MessageSquare, AlertCircle, Loader2,
} from 'lucide-react'

interface TripDay {
  day_number: number
  date?: string | null
  title: string
  subtitle?: string | null
  city?: string | null
  description?: string | null
  hotel?: string | null
  hotel_category?: string | null
  meal_plan?: string | null
  travel_time?: string | null
  distance_km?: number | null
  activities?: string[] | null
  image_url?: string | null
}
interface TripContact {
  label: string
  name?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
}
interface TripBranding {
  company_name: string
  logo_url?: string | null
  primary_color?: string | null
  welcome_message?: string | null
}
interface TripPublicView {
  project_id: string
  title: string
  client_name?: string | null
  start_date?: string | null
  end_date?: string | null
  branding: TripBranding
  days: TripDay[]
  contacts: TripContact[]
  notices: string[]
}

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) || '/api'

export default function CompanionPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [search] = useSearchParams()
  const pin = search.get('pin') || undefined

  const [trip, setTrip] = useState<TripPublicView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // For sending a message back
  const [msgBody, setMsgBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    const url = `${API_BASE}/companion/${token}${pin ? `?pin=${pin}` : ''}`
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(body.detail || `Erreur ${r.status}`)
        }
        return r.json() as Promise<TripPublicView>
      })
      .then(setTrip)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token, pin])

  const sendMessage = async () => {
    if (!token || !msgBody.trim()) return
    setSending(true)
    try {
      const url = `${API_BASE}/companion/${token}/messages${pin ? `?pin=${pin}` : ''}`
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'message', body: msgBody.trim() }),
      })
      if (r.ok) {
        setSent(true)
        setMsgBody('')
        setTimeout(() => setSent(false), 4000)
      }
    } finally {
      setSending(false)
    }
  }

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )

  if (error || !trip)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <h1 className="text-lg font-semibold">Accès impossible</h1>
          <p className="mt-1 text-sm text-slate-600">{error || 'Lien invalide'}</p>
        </div>
      </div>
    )

  const primary = trip.branding.primary_color || '#3730a3'

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {trip.branding.logo_url && (
            <img src={trip.branding.logo_url} alt={trip.branding.company_name}
                 className="h-10 w-auto" />
          )}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {trip.branding.company_name}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{trip.title}</h1>
            {trip.client_name && (
              <div className="mt-0.5 text-sm text-slate-600">
                Préparé pour {trip.client_name}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Notices */}
      {trip.notices.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pt-4">
          {trip.notices.map((n, i) => (
            <div key={i}
                 className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{n}</span>
            </div>
          ))}
        </section>
      )}

      {/* Welcome */}
      {trip.branding.welcome_message && (
        <section className="mx-auto mt-4 max-w-3xl px-4">
          <div className="rounded-lg bg-white p-4 text-sm text-slate-700 shadow-sm">
            {trip.branding.welcome_message}
          </div>
        </section>
      )}

      {/* Trip dates */}
      {(trip.start_date || trip.end_date) && (
        <section className="mx-auto mt-4 max-w-3xl px-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4" style={{ color: primary }} />
            <span>
              {trip.start_date && new Date(trip.start_date).toLocaleDateString('fr-FR')}
              {trip.end_date && ` → ${new Date(trip.end_date).toLocaleDateString('fr-FR')}`}
            </span>
          </div>
        </section>
      )}

      {/* Days timeline */}
      <section className="mx-auto mt-6 max-w-3xl space-y-4 px-4">
        {trip.days.map((d) => (
          <article key={d.day_number}
                   className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {d.image_url && (
              <img src={d.image_url} alt={d.title}
                   className="h-40 w-full object-cover" loading="lazy" />
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"
                   style={{ color: primary }}>
                <span className="rounded-full px-2 py-0.5 text-white"
                      style={{ backgroundColor: primary }}>
                  Jour {d.day_number}
                </span>
                {d.date && (
                  <span className="text-slate-500">
                    {new Date(d.date).toLocaleDateString('fr-FR', {
                      weekday: 'short', day: '2-digit', month: 'short',
                    })}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{d.title}</h2>
              {d.subtitle && <p className="text-sm text-slate-600">{d.subtitle}</p>}
              {d.description && <p className="mt-2 text-sm text-slate-700">{d.description}</p>}

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                {d.city && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{d.city}</span>
                )}
                {d.hotel && (
                  <span className="flex items-center gap-1">
                    <Hotel className="h-3.5 w-3.5" />
                    {d.hotel}{d.hotel_category && ` · ${d.hotel_category}`}
                  </span>
                )}
                {d.meal_plan && (
                  <span className="flex items-center gap-1">
                    <UtensilsCrossed className="h-3.5 w-3.5" />{d.meal_plan}
                  </span>
                )}
                {d.travel_time && <span>🚐 {d.travel_time}</span>}
              </div>

              {d.activities && d.activities.length > 0 && (
                <ul className="mt-3 list-inside list-disc text-sm text-slate-700">
                  {d.activities.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* Contacts */}
      {trip.contacts.length > 0 && (
        <section className="mx-auto mt-8 max-w-3xl px-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Contacts utiles
          </h2>
          <div className="space-y-2">
            {trip.contacts.map((c, i) => (
              <div key={i}
                   className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{c.label}</div>
                  {c.name && <div className="text-slate-600">{c.name}</div>}
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`}
                     className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-white"
                     style={{ backgroundColor: primary }}>
                    <Phone className="h-4 w-4" /> Appeler
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Message back */}
      <section className="mx-auto mt-8 max-w-3xl px-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <MessageSquare className="mr-1 inline h-4 w-4" /> Une question ? Un souci ?
        </h2>
        <textarea
          value={msgBody} onChange={(e) => setMsgBody(e.target.value)}
          rows={3} placeholder="Écrivez-nous, on revient vers vous au plus vite."
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button onClick={sendMessage}
                disabled={sending || msgBody.trim().length < 2}
                className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: primary }}>
          {sending ? 'Envoi…' : sent ? 'Message envoyé !' : 'Envoyer le message'}
        </button>
      </section>
    </div>
  )
}

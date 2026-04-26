/**
 * SubAgentPortalPage — White-label B2B reseller portal.
 *
 * Authenticated. Reads brand colors from /api/portal/me and applies them
 * to a minimal dashboard:
 *  - "Mes dossiers"   → /api/portal/projects (no costs / margins)
 *  - "Catalogue"      → /api/portal/catalog (validated templates)
 *  - "Nouvelle demande" → POST /api/portal/quote-requests
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase, Globe, MapPin, Send, Sparkles, Users,
} from 'lucide-react'
import { subAgentPortalApi } from '@/lib/api'

interface Identity {
  user_id: string
  email: string
  full_name?: string | null
  partner_id: string
  partner_name: string
  company_id: string
  branding: {
    company_name: string
    logo_url?: string | null
    primary_color?: string | null
    welcome_message?: string | null
    hide_costs: boolean
  }
}
interface PortalProject {
  id: string; name: string; reference?: string | null;
  client_name?: string | null; destination?: string | null;
  pax_count?: number | null; duration_days?: number | null;
  travel_dates?: string | null; status: string; created_at: string;
}
interface CatalogItem {
  id: string; name: string; destination?: string | null;
  duration_days?: number | null; pax_count?: number | null;
  cover_image_url?: string | null; highlights: string[];
  sell_price_from?: number | null; currency: string;
}

type Tab = 'projects' | 'catalog' | 'new'

export default function SubAgentPortalPage() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [projects, setProjects] = useState<PortalProject[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [tab, setTab] = useState<Tab>('projects')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      subAgentPortalApi.me(),
      subAgentPortalApi.projects(),
      subAgentPortalApi.catalog(),
    ])
      .then(([mRes, pRes, cRes]) => {
        setIdentity(mRes.data as Identity)
        setProjects(pRes.data as PortalProject[])
        setCatalog(cRes.data as CatalogItem[])
      })
      .catch((e) => setError(e?.response?.data?.detail || e.message || 'Erreur'))
  }, [])

  const primary = identity?.branding.primary_color || '#3730a3'

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      </div>
    )
  }
  if (!identity) {
    return <div className="p-6 text-sm text-slate-500">Chargement du portail…</div>
  }

  return (
    <div className="min-h-full">
      {/* Brand header */}
      <header className="border-b" style={{ borderColor: `${primary}33`, background: `${primary}0d` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            {identity.branding.logo_url && (
              <img src={identity.branding.logo_url} alt={identity.branding.company_name}
                   className="h-10 w-auto" />
            )}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: primary }}>
                Portail revendeur · {identity.branding.company_name}
              </div>
              <h1 className="text-lg font-bold text-slate-900">
                Bonjour {identity.full_name || identity.email}
              </h1>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            {identity.partner_name}<br />ID&nbsp;{identity.partner_id.slice(0, 8)}
          </div>
        </div>

        {/* Tabs */}
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {([
            ['projects', 'Mes dossiers', <Briefcase className="h-4 w-4" key="i1" />],
            ['catalog',  'Catalogue',    <Sparkles className="h-4 w-4" key="i2" />],
            ['new',      'Nouvelle demande', <Send className="h-4 w-4" key="i3" />],
          ] as [Tab, string, React.ReactNode][]).map(([k, label, icon]) => (
            <button key={k} onClick={() => setTab(k)}
                    className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
                      tab === k ? '' : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                    style={tab === k ? { borderColor: primary, color: primary } : undefined}>
              {icon}{label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'projects' && <ProjectsList projects={projects} primary={primary} />}
        {tab === 'catalog'  && <CatalogList items={catalog} primary={primary} />}
        {tab === 'new'      && <NewQuoteForm primary={primary} onCreated={(p) => {
          setProjects([p, ...projects]); setTab('projects')
        }} />}
      </main>
    </div>
  )
}

function ProjectsList({ projects, primary }: { projects: PortalProject[]; primary: string }) {
  if (projects.length === 0) {
    return <div className="text-sm text-slate-500">Aucun dossier pour l'instant. Créez une nouvelle demande.</div>
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Réf.</th>
            <th className="px-3 py-2 text-left">Dossier</th>
            <th className="px-3 py-2 text-left">Client</th>
            <th className="px-3 py-2 text-left">Destination</th>
            <th className="px-3 py-2 text-left">Pax</th>
            <th className="px-3 py-2 text-left">Statut</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.reference || '—'}</td>
              <td className="px-3 py-2 font-medium" style={{ color: primary }}>{p.name}</td>
              <td className="px-3 py-2">{p.client_name || '—'}</td>
              <td className="px-3 py-2 text-slate-600">{p.destination || '—'}</td>
              <td className="px-3 py-2">{p.pax_count ?? '—'}</td>
              <td className="px-3 py-2 text-xs">
                <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CatalogList({ items, primary }: { items: CatalogItem[]; primary: string }) {
  if (items.length === 0) {
    return <div className="text-sm text-slate-500">Aucun circuit prêt-à-vendre disponible.</div>
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <article key={c.id}
                 className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {c.cover_image_url && (
            <img src={c.cover_image_url} alt={c.name} className="h-36 w-full object-cover" loading="lazy" />
          )}
          <div className="p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase" style={{ color: primary }}>
              {c.duration_days && <span>{c.duration_days} jours</span>}
              {c.destination && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.destination}</span>}
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-900">{c.name}</h3>
            {c.highlights.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                {c.highlights.slice(0, 3).map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function NewQuoteForm({ primary, onCreated }: {
  primary: string; onCreated: (p: PortalProject) => void
}) {
  const [client_name, setClientName] = useState('')
  const [client_email, setClientEmail] = useState('')
  const [client_country, setClientCountry] = useState('')
  const [pax_count, setPaxCount] = useState(2)
  const [destination, setDestination] = useState('')
  const [duration_days, setDurationDays] = useState<number | ''>('')
  const [travel_dates, setTravelDates] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const valid = useMemo(
    () => client_name.trim().length >= 2 && pax_count >= 1,
    [client_name, pax_count],
  )

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await subAgentPortalApi.createQuote({
        client_name, client_email: client_email || undefined,
        client_country: client_country || undefined,
        pax_count,
        destination: destination || undefined,
        duration_days: duration_days || undefined,
        travel_dates: travel_dates || undefined,
        notes: notes || undefined,
      })
      onCreated(r.data as PortalProject)
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } }; message?: string }
      setErr(ax?.response?.data?.detail || ax?.message || 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h2 className="text-base font-semibold text-slate-900">Nouvelle demande de devis</h2>
      <p className="text-sm text-slate-600">
        Renseignez les besoins de votre client. L'équipe revient vers vous avec un devis sous 24 h.
      </p>

      {err && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>}

      <Field label="Nom du client*" value={client_name} onChange={setClientName} icon={<Users className="h-4 w-4" />} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email client" value={client_email} onChange={setClientEmail} type="email" />
        <Field label="Pays" value={client_country} onChange={setClientCountry} icon={<Globe className="h-4 w-4" />} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pax*" value={String(pax_count)} onChange={(v) => setPaxCount(Math.max(1, Number(v) || 1))} type="number" />
        <Field label="Durée (jours)" value={String(duration_days)} onChange={(v) => setDurationDays(Number(v) || '')} type="number" />
      </div>
      <Field label="Destination" value={destination} onChange={setDestination} icon={<MapPin className="h-4 w-4" />} />
      <Field label="Dates de voyage (texte libre)" value={travel_dates} onChange={setTravelDates} />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Notes / besoins spécifiques</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:outline-none"
                  style={{ borderColor: '#cbd5e1' }} />
      </div>
      <button onClick={submit} disabled={!valid || busy}
              className="w-full rounded-md py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: primary }}>
        {busy ? 'Envoi…' : 'Envoyer la demande'}
      </button>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', icon,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-2 rounded-md border border-slate-300 px-2 focus-within:ring-1 focus-within:ring-indigo-500">
        {icon && <span className="text-slate-400">{icon}</span>}
        <input value={value} type={type}
               onChange={(e) => onChange(e.target.value)}
               className="w-full bg-transparent py-1.5 text-sm focus:outline-none" />
      </div>
    </div>
  )
}

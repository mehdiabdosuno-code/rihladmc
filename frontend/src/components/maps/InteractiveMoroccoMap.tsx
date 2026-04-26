/**
 * Interactive Morocco map (Leaflet + light CartoDB Voyager tiles).
 *
 * V2 features:
 *  - LIGHT theme tile layer (CartoDB Voyager) with terracotta/sand accents
 *  - 14 destination markers with project counts + animated DMC routes
 *  - Toggleable Activities layer (25 activities from the S'TOURS catalogue)
 *  - Real-time search bar (filters visible markers by city or activity name)
 *  - Filter chips: All / Hubs / Cités impériales / Désert / Côte / Nord
 *  - Enriched popup: status mini-bar, won %, CTA "Voir les projets"
 *  - Fullscreen toggle, layer panel, recentre control
 *  - Live KPIs (projets / pax / nuitées) responding to current filter
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MapContainer, TileLayer, Marker, Popup, Polyline, ZoomControl, useMap, CircleMarker,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin, Navigation, Sparkles, Layers, Compass, Filter, Search, Maximize2, Minimize2,
  Hotel as HotelIcon, Sparkle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { dashboardApi, type MapDestination, type MapCircuit } from '@/lib/api'
import { ACTIVITIES_CATALOG, type Activity } from '@/data/morocco_activities'

// ── Filter taxonomy ────────────────────────────────────────────────────
type FilterId = 'all' | 'hub' | 'imperiale' | 'desert' | 'cote' | 'nord'
const FILTERS: { id: FilterId; label: string; predicate: (d: MapDestination) => boolean }[] = [
  { id: 'all',        label: 'Tout le Maroc',     predicate: ()    => true },
  { id: 'hub',        label: 'Hubs',              predicate: (d)   => d.tier === 'hub' },
  { id: 'imperiale',  label: 'Cités impériales',  predicate: (d)   => d.tags.includes('imperiale') },
  { id: 'desert',     label: 'Désert',            predicate: (d)   => d.tags.includes('desert') || d.tags.includes('sahara') },
  { id: 'cote',       label: 'Côte',              predicate: (d)   => d.tags.includes('cote') },
  { id: 'nord',       label: 'Nord',              predicate: (d)   => d.tags.includes('nord') },
]

// ── City → coords lookup (extends destinations with extra activity cities) ─
const CITY_COORDS: Record<string, [number, number]> = {
  Marrakech:  [31.6295,  -7.9811],
  Casablanca: [33.5731,  -7.5898],
  Fes:        [34.0181,  -5.0078],
  Fès:        [34.0181,  -5.0078],
  Rabat:      [34.0209,  -6.8417],
  Tanger:     [35.7595,  -5.8340],
  Chefchaouen:[35.1688,  -5.2636],
  Meknes:     [33.8935,  -5.5547],
  Meknès:     [33.8935,  -5.5547],
  Ouarzazate: [30.9189,  -6.8934],
  Merzouga:   [31.0998,  -4.0125],
  Essaouira:  [31.5085,  -9.7595],
  Agadir:     [30.4278,  -9.5981],
  Tetouan:    [35.5786,  -5.3684],
  Tétouan:    [35.5786,  -5.3684],
  Erfoud:     [31.4293,  -4.2299],
  Dakhla:     [23.6848, -15.9579],
  Ourika:     [31.3601,  -7.7997],
}

// Spiral jitter so multiple activities in the same city spread out clearly
function jitter(base: [number, number], i: number): [number, number] {
  const r = 0.10 + (i * 0.025)
  const angle = (i * 137.5) * (Math.PI / 180)
  return [base[0] + Math.cos(angle) * r, base[1] + Math.sin(angle) * r * 1.1]
}

// ── Fit bounds helper ──────────────────────────────────────────────────
function FitToBounds({ bounds, dep }: { bounds: L.LatLngBoundsExpression; dep: number }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40], animate: true, duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
  return null
}

// ── Custom destination icon — terracotta + count badge ─────────────────
function destinationIcon(d: MapDestination, isTop: boolean): L.DivIcon {
  const count = d.projects_total
  const tone =
    isTop ? '#D4A574'
    : d.tier === 'hub'  ? '#C0392B'
    : d.tier === 'city' ? '#E67E22' : '#16A085'
  const ring = `${tone}33`
  const size = isTop ? 28 : count > 0 ? 22 : 16

  return L.divIcon({
    className: 'rihla-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <span style="position:absolute;inset:-10px;border-radius:50%;background:${ring};animation:rihlaPulse 2.4s ease-out infinite;"></span>
        <span style="position:relative;display:block;width:${size}px;height:${size}px;border-radius:50%;background:${tone};box-shadow:0 0 0 3px #fff,0 4px 12px rgba(192,57,43,0.35);"></span>
        ${count > 0 ? `<span style="position:absolute;top:-7px;right:-10px;min-width:18px;height:18px;padding:0 5px;border-radius:9999px;background:#fff;color:${tone};font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);border:1.5px solid ${tone};">${count}</span>` : ''}
        ${isTop ? `<span style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:14px;color:#D4A574;text-shadow:0 1px 2px rgba(0,0,0,0.25);">★</span>` : ''}
      </div>
    `,
  })
}

// ── Build polylines for common DMC circuits ────────────────────────────
function circuitsToLines(circuits: MapCircuit[], dests: MapDestination[]) {
  const byId = new Map(dests.map(d => [d.id, d]))
  return circuits
    .map(c => {
      const points = c.cities
        .map(id => byId.get(id))
        .filter((d): d is MapDestination => Boolean(d))
        .map(d => [d.lat, d.lng] as [number, number])
      return points.length >= 2 ? { circuit: c, points } : null
    })
    .filter((x): x is { circuit: MapCircuit; points: [number, number][] } => Boolean(x))
}

// ── Build positioned activities — group by city + jitter ───────────────
type PositionedActivity = Activity & { lat: number; lng: number }
function positionActivities(): PositionedActivity[] {
  const counts: Record<string, number> = {}
  const out: PositionedActivity[] = []
  for (const a of ACTIVITIES_CATALOG) {
    const base = CITY_COORDS[a.city]
    if (!base) continue
    const i = (counts[a.city] ?? 0)
    counts[a.city] = i + 1
    // Always offset to keep dots clear of the destination marker (even index 0)
    const [lat, lng] = jitter(base, i + 1)
    out.push({ ...a, lat, lng })
  }
  return out
}

const ACTIVITY_COLORS: Record<Activity['category'], string> = {
  desert:        '#D97706',
  cultural:      '#0E7490',
  adventure:     '#7C3AED',
  wellness:      '#10B981',
  gastronomy:    '#DB2777',
  nature:        '#059669',
  entertainment: '#F59E0B',
}

// ── MAIN ───────────────────────────────────────────────────────────────
export function InteractiveMoroccoMap() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const [filter, setFilter] = useState<FilterId>('all')
  const [showCircuits, setShowCircuits] = useState(true)
  const [showActivities, setShowActivities] = useState(false)
  const [search, setSearch] = useState('')
  const [resetTick, setResetTick] = useState(0)
  const [isFs, setIsFs] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['map', 'destinations'],
    queryFn: () => dashboardApi.destinations().then(r => r.data),
    staleTime: 60_000,
  })

  const positionedActivities = useMemo(positionActivities, [])

  const visibleDests = useMemo(() => {
    if (!data) return []
    const pred = FILTERS.find(f => f.id === filter)?.predicate ?? (() => true)
    const q = search.trim().toLowerCase()
    return data.destinations.filter(d => pred(d) && (!q || d.name.toLowerCase().includes(q) || d.tags.some(t => t.includes(q))))
  }, [data, filter, search])

  const visibleActivities = useMemo(() => {
    if (!showActivities) return []
    const q = search.trim().toLowerCase()
    return positionedActivities.filter(a => !q || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q))
  }, [positionedActivities, showActivities, search])

  const lines = useMemo(
    () => (data ? circuitsToLines(data.circuits, data.destinations) : []),
    [data],
  )

  const totals = useMemo(() => {
    if (!visibleDests.length) return { projects: 0, pax: 0, nights: 0, won: 0 }
    return visibleDests.reduce(
      (acc, d) => ({
        projects: acc.projects + d.projects_total,
        pax:      acc.pax + d.total_pax,
        nights:   acc.nights + d.total_nights,
        won:      acc.won + d.projects_won,
      }),
      { projects: 0, pax: 0, nights: 0, won: 0 },
    )
  }, [visibleDests])

  const bounds: L.LatLngBoundsExpression = data
    ? [[data.bounds.south, data.bounds.west], [data.bounds.north, data.bounds.east]]
    : [[27.5, -13.5], [35.95, -1.0]]

  const toggleFs = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFs(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFs(false)).catch(() => {})
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[540px] bg-[#FAF7F2] rounded-[40px] border border-rihla/10 overflow-hidden shadow-[0_30px_80px_-20px_rgba(192,57,43,0.18)]"
    >
      <MapContainer
        bounds={bounds}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full rihla-leaflet-root"
        style={{ background: '#FAF7F2' }}
      >
        {/* Light Voyager tiles — terracotta-friendly */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
          subdomains={['a', 'b', 'c', 'd']}
        />
        <ZoomControl position="bottomleft" />
        <FitToBounds bounds={bounds} dep={resetTick} />

        {showCircuits && lines.map(({ circuit, points }) => (
          <Polyline
            key={circuit.id}
            positions={points}
            pathOptions={{
              color: circuit.color,
              weight: 3.5,
              opacity: 0.9,
              dashArray: '10 12',
              className: 'rihla-flow-line',
            }}
          />
        ))}

        {visibleDests.map(d => {
          const isTop = data?.top_destination_id === d.id
          const wonPct = d.projects_total > 0 ? Math.round((d.projects_won / d.projects_total) * 100) : 0
          return (
            <Marker key={d.id} position={[d.lat, d.lng]} icon={destinationIcon(d, isTop)}>
              <Popup className="rihla-popup" closeButton={false} maxWidth={280}>
                <div className="min-w-[250px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-slate-900">{d.name}</span>
                      {isTop && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold uppercase">Top</span>}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-rihla font-semibold">{d.tier}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <KV label="Projets"   value={d.projects_total.toString()}  accent="rihla" />
                    <KV label="Actifs"    value={d.projects_active.toString()} accent="amber" />
                    <KV label="Gagnés"    value={d.projects_won.toString()}    accent="emerald" />
                    <KV label="Pax"       value={d.total_pax.toString()}       accent="violet" />
                  </div>

                  {d.projects_total > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                        <span>Conversion gagné</span>
                        <span className="font-bold text-emerald-600">{wonPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${wonPct}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {d.tags.map(t => (
                      <span key={t} className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded-full bg-amber-50 text-amber-800">{t}</span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/projects?q=${encodeURIComponent(d.name)}`)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-rihla text-white text-[11px] font-semibold py-1.5 hover:bg-rihla/90 transition"
                  >
                    <Navigation size={11} /> Voir les projets
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Activity layer — small colored dots (rendered above destinations) */}
        {visibleActivities.map(a => (
          <CircleMarker
            key={a.code}
            center={[a.lat, a.lng]}
            radius={8}
            pane="markerPane"
            pathOptions={{
              color:       '#fff',
              weight:      2,
              fillColor:   ACTIVITY_COLORS[a.category],
              fillOpacity: 0.95,
            }}
          >
            <Popup className="rihla-popup" closeButton={false} maxWidth={240}>
              <div className="min-w-[210px]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-slate-900">{a.name}</span>
                  <span className="text-[9px] uppercase tracking-wider font-semibold rounded px-1.5 py-0.5"
                        style={{ background: `${ACTIVITY_COLORS[a.category]}22`, color: ACTIVITY_COLORS[a.category] }}>
                    {a.category}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mb-2">{a.city} · {a.region}</div>
                <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                  <div className="bg-slate-50 rounded px-1 py-1">
                    <div className="font-bold text-slate-900">{a.duration_hours}h</div>
                    <div className="text-slate-400 text-[8px] uppercase">Durée</div>
                  </div>
                  <div className="bg-slate-50 rounded px-1 py-1">
                    <div className="font-bold text-rihla">{a.cost_per_pax} {a.currency}</div>
                    <div className="text-slate-400 text-[8px] uppercase">Prix/pax</div>
                  </div>
                  <div className="bg-slate-50 rounded px-1 py-1">
                    <div className="font-bold text-slate-900">{a.min_pax}–{a.max_pax}</div>
                    <div className="text-slate-400 text-[8px] uppercase">Pax</div>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* ── TOP BAR: search + filters + Live KPIs ─────────────────────── */}
      <div className="absolute top-5 left-5 right-5 z-[1000] flex items-start justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto p-3 rounded-2xl bg-white/85 border border-rihla/10 backdrop-blur-md shadow-lg max-w-[600px] flex-1">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-rihla" />
              <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Réseau de destinations</h3>
            </div>
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une ville…"
                className="pl-7 pr-2 py-1 text-[11px] rounded-md border border-rihla/15 bg-white focus:outline-none focus:ring-2 focus:ring-rihla/30 w-44"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border transition-colors',
                  filter === f.id
                    ? 'bg-rihla text-white border-rihla shadow-sm'
                    : 'bg-white text-slate-600 border-rihla/15 hover:bg-rihla/5',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto p-3 rounded-2xl bg-white/85 border border-rihla/10 backdrop-blur-md shadow-lg text-right">
          <div className="flex items-center justify-end gap-1.5 mb-1.5">
            <Sparkles size={11} className="text-emerald-500" />
            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Live</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 leading-none">{totals.projects}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">projets · {totals.pax} pax · {totals.nights} nuitées</div>
          {totals.projects > 0 && (
            <div className="mt-2 text-[10px] text-emerald-600 font-semibold">{totals.won} gagnés · {Math.round((totals.won / totals.projects) * 100)}%</div>
          )}
        </div>
      </div>

      {/* ── BOTTOM-RIGHT: layer + reset + fullscreen ──────────────────── */}
      <div className="absolute bottom-5 right-5 z-[1000] flex items-center gap-2 pointer-events-none">
        <button
          onClick={() => setShowActivities(s => !s)}
          className={clsx(
            'pointer-events-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider border backdrop-blur-md transition-colors shadow-sm',
            showActivities
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : 'bg-white/85 text-slate-700 border-rihla/15 hover:bg-rihla/5',
          )}
        >
          <Sparkle size={12} /> Activités ({ACTIVITIES_CATALOG.length})
        </button>
        <button
          onClick={() => setShowCircuits(s => !s)}
          className={clsx(
            'pointer-events-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider border backdrop-blur-md transition-colors shadow-sm',
            showCircuits
              ? 'bg-cyan-50 text-cyan-700 border-cyan-300'
              : 'bg-white/85 text-slate-700 border-rihla/15 hover:bg-rihla/5',
          )}
        >
          <Layers size={12} /> Circuits DMC
        </button>
        <button
          onClick={() => setResetTick(t => t + 1)}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/85 text-slate-700 border border-rihla/15 hover:bg-rihla/5 backdrop-blur-md transition-colors shadow-sm"
        >
          <Compass size={12} /> Recentrer
        </button>
        <button
          onClick={toggleFs}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/85 text-slate-700 border border-rihla/15 hover:bg-rihla/5 backdrop-blur-md transition-colors shadow-sm"
        >
          {isFs ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          {isFs ? 'Réduire' : 'Plein écran'}
        </button>
      </div>

      {/* ── BOTTOM-LEFT: legend ───────────────────────────────────────── */}
      <div className="absolute bottom-5 left-20 z-[1000] pointer-events-auto p-3 rounded-2xl bg-white/85 border border-rihla/10 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <Filter size={11} className="text-rihla" />
          <span className="text-[9px] font-bold text-slate-900 uppercase tracking-widest">Légende</span>
        </div>
        <div className="space-y-1.5">
          <LegendDot color="#C0392B" label="Hub stratégique" />
          <LegendDot color="#E67E22" label="Ville importante" />
          <LegendDot color="#16A085" label="Étape circuit" />
          {showActivities && (
            <>
              <div className="border-t border-rihla/10 my-1" />
              <LegendDot color={ACTIVITY_COLORS.desert}     label="Désert" small />
              <LegendDot color={ACTIVITY_COLORS.cultural}   label="Culturel" small />
              <LegendDot color={ACTIVITY_COLORS.adventure}  label="Aventure" small />
              <LegendDot color={ACTIVITY_COLORS.wellness}   label="Bien-être" small />
              <LegendDot color={ACTIVITY_COLORS.gastronomy} label="Gastronomie" small />
            </>
          )}
          {showCircuits && data && (
            <>
              <div className="border-t border-rihla/10 my-1" />
              {data.circuits.map(c => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="inline-block w-3.5 h-[2.5px] rounded-full" style={{ background: c.color }} />
                  <span className="text-[10px] text-slate-700 font-medium">{c.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm pointer-events-none z-[2000]">
          <div className="flex items-center gap-2 text-slate-700 text-xs uppercase tracking-widest">
            <HotelIcon size={12} className="animate-pulse" /> Chargement de la carte…
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small KV cell used inside popups ────────────────────────────────────
function KV({ label, value, accent }: { label: string; value: string; accent: 'rihla'|'amber'|'emerald'|'violet' }) {
  const tone =
    accent === 'rihla'   ? 'text-rihla' :
    accent === 'amber'   ? 'text-amber-600' :
    accent === 'emerald' ? 'text-emerald-600' :
                           'text-violet-600'
  return (
    <div className="flex flex-col rounded-md bg-slate-50 px-2 py-1.5">
      <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={clsx('text-sm font-bold', tone)}>{value}</span>
    </div>
  )
}

function LegendDot({ color, label, small = false }: { color: string; label: string; small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx('inline-block rounded-full', small ? 'w-2 h-2' : 'w-3 h-3')}
        style={{ background: color, boxShadow: small ? 'none' : `0 0 0 2px #fff, 0 0 0 3px ${color}33` }}
      />
      <span className="text-[10px] text-slate-700 font-medium">{label}</span>
    </div>
  )
}

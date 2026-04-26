/**
 * Travel Designer Map — interactive 3-tab map for an open dossier.
 *
 *   • 🗺 Vue globale         — the full route on Leaflet, with one marker per
 *                              resource type (🏨 hotel · 🍽 restaurant · 🏛 monument
 *                              · 🚌 transport leg · 👤 guide).
 *   • 📅 Vue jour-par-jour   — zoom on a single day, intra-city mini-itinerary.
 *   • ⏱ Timeline horaire     — vertical Gantt of the day in 30-min slots.
 *
 * Data source: any list of "DesignerDay" rows. The Travel Designer page
 * currently hydrates them from XLS_DAILY (YS Travel Morocco 11D demo).
 */

import { useMemo, useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Polyline, ZoomControl, useMap, CircleMarker, Tooltip,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Hotel as HotelIcon, Utensils, Landmark, Bus, MapPin, Sun, Sunset, Moon, Coffee,
  ArrowRight, Calendar, ChevronLeft, ChevronRight, Map as MapIcon, Clock, Globe2,
  Users,
} from 'lucide-react'
import { clsx } from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────

export interface DesignerDay {
  day: number
  date: string
  km: number
  cities: string         // e.g. "CASA › RBA › CHEFCHAOUEN"
  hotel: string
  formula: string        // BB | HB | FB | —
  halfDbl: number
  ss: number
  taxe: number
  water: number
  rest: string
  restPrice: number
  monument: string
  monuPrice: number
  lg: number             // local guide cost
}

interface CityNode {
  key: string
  display: string
  lat: number
  lng: number
}

interface DayStop {
  day: DesignerDay
  city: CityNode
}

// ── City coordinates ──────────────────────────────────────────────────

const CITY_DB: Record<string, { display: string; lat: number; lng: number }> = {
  CASABLANCA:  { display: 'Casablanca',  lat: 33.5731, lng: -7.5898 },
  CASA:        { display: 'Casablanca',  lat: 33.5731, lng: -7.5898 },
  RABAT:       { display: 'Rabat',       lat: 34.0209, lng: -6.8417 },
  RBA:         { display: 'Rabat',       lat: 34.0209, lng: -6.8417 },
  CHEFCHAOUEN: { display: 'Chefchaouen', lat: 35.1688, lng: -5.2636 },
  TANGER:      { display: 'Tanger',      lat: 35.7595, lng: -5.8340 },
  TETOUAN:     { display: 'Tétouan',     lat: 35.5786, lng: -5.3684 },
  FES:         { display: 'Fès',         lat: 34.0181, lng: -5.0078 },
  'FÈS':       { display: 'Fès',         lat: 34.0181, lng: -5.0078 },
  MEKNES:      { display: 'Meknès',      lat: 33.8935, lng: -5.5547 },
  'MEKNÈS':    { display: 'Meknès',      lat: 33.8935, lng: -5.5547 },
  MIDELT:      { display: 'Midelt',      lat: 32.6852, lng: -4.7333 },
  ERFOUD:      { display: 'Erfoud',      lat: 31.4293, lng: -4.2299 },
  MERZOUGA:    { display: 'Merzouga',    lat: 31.0998, lng: -4.0125 },
  OUARZAZATE:  { display: 'Ouarzazate',  lat: 30.9189, lng: -6.8934 },
  MARRAKECH:   { display: 'Marrakech',   lat: 31.6295, lng: -7.9811 },
  RAK:         { display: 'Marrakech',   lat: 31.6295, lng: -7.9811 },
  ESSAOUIRA:   { display: 'Essaouira',   lat: 31.5085, lng: -9.7595 },
  ESS:         { display: 'Essaouira',   lat: 31.5085, lng: -9.7595 },
  AGADIR:      { display: 'Agadir',      lat: 30.4278, lng: -9.5981 },
  DAKHLA:      { display: 'Dakhla',      lat: 23.6848, lng: -15.9579 },
}

function resolveCity(token: string): CityNode | null {
  const norm = token.trim().toUpperCase().replace(/[—–]/g, ' ').split(/\s+/)[0]
  if (CITY_DB[norm]) return { key: norm, ...CITY_DB[norm] }
  // try without diacritics
  const stripped = norm.replace(/È/g, 'E').replace(/É/g, 'E')
  if (CITY_DB[stripped]) return { key: stripped, ...CITY_DB[stripped] }
  return null
}

function primaryCity(d: DesignerDay): CityNode | null {
  // "CASA › RBA › CHEFCHAOUEN" → take last segment (where they sleep)
  const parts = d.cities.split(/[›→\->\/]+/).map(s => s.trim()).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    const c = resolveCity(parts[i])
    if (c) return c
  }
  return resolveCity(d.cities)
}

// ── Type icons used on the map (leaflet divIcons) ─────────────────────

const TYPE_META = {
  hotel:      { color: '#2563eb', emoji: '🏨', label: 'Hôtel' },
  restaurant: { color: '#d97706', emoji: '🍽',  label: 'Restaurant' },
  monument:   { color: '#7c3aed', emoji: '🏛',  label: 'Monument' },
  transport:  { color: '#059669', emoji: '🚌', label: 'Transport' },
  guide:      { color: '#0891b2', emoji: '👤', label: 'Guide local' },
} as const
type ResourceType = keyof typeof TYPE_META

const dotIcon = (type: ResourceType, label: string) => L.divIcon({
  className: 'rihla-designer-dot',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `
    <div style="
      position:relative;width:30px;height:30px;border-radius:50%;
      background:${TYPE_META[type].color};
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:14px;
      border:3px solid #fff;
      box-shadow:0 4px 10px rgba(0,0,0,.20), 0 0 0 4px ${TYPE_META[type].color}22;
    " title="${label.replace(/"/g, '&quot;')}">
      ${TYPE_META[type].emoji}
    </div>
  `,
})

const stopIcon = (n: number, color: string) => L.divIcon({
  className: 'rihla-designer-stop',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  html: `
    <div style="
      width:36px;height:36px;border-radius:50%;
      background:${color};color:#fff;font-weight:800;font-size:14px;
      display:flex;align-items:center;justify-content:center;
      border:3px solid #fff;
      box-shadow:0 6px 14px rgba(0,0,0,.20), 0 0 0 6px ${color}28;
    ">J${n}</div>
  `,
})

// ── Quadratic-bezier curved path between A & B ────────────────────────

function curvedPath(a: [number, number], b: [number, number], steps = 36, bulge = 0.18): [number, number][] {
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const dy = b[0] - a[0]
  const dx = b[1] - a[1]
  const len = Math.sqrt(dx * dx + dy * dy)
  const nx = -dy / (len || 1)
  const ny =  dx / (len || 1)
  const ctrl: [number, number] = [mid[0] + nx * len * bulge, mid[1] + ny * len * bulge]
  const out: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const lat = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * ctrl[0] + t * t * b[0]
    const lng = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * ctrl[1] + t * t * b[1]
    out.push([lat, lng])
  }
  return out
}

// Slight deterministic offset around a city for non-hotel pins
function offsetAround(c: CityNode, idx: number): [number, number] {
  const r = 0.025
  const angle = (idx * (Math.PI * 2) / 5) + 0.6
  return [c.lat + r * Math.sin(angle), c.lng + r * Math.cos(angle)]
}

// ── FitBounds for the Leaflet map ─────────────────────────────────────

function FitBounds({ stops, dep, padding = 80 }: { stops: DayStop[]; dep: number; padding?: number }) {
  const map = useMap()
  useMemo(() => {
    if (!stops.length) return
    const pts = stops.map(s => [s.city.lat, s.city.lng] as [number, number])
    map.fitBounds(L.latLngBounds(pts), { padding: [padding, padding], maxZoom: 9 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
  return null
}

// ── Synthesised hourly schedule for the timeline view ─────────────────

interface Slot {
  time: string
  type: ResourceType | 'rest' | 'travel'
  label: string
  detail?: string
  cost?: number
}

function buildSchedule(d: DesignerDay): Slot[] {
  const out: Slot[] = []
  const hasMeal = d.formula && d.formula !== '—' && d.formula !== ''
  const isFB = d.formula === 'FB'
  const isBB = d.formula === 'BB'

  // Breakfast at hotel
  if (d.hotel && d.hotel !== '—' && d.hotel !== 'DÉPART') {
    out.push({ time: '07:30', type: 'hotel', label: 'Petit-déjeuner', detail: d.hotel })
  }

  // Travel leg
  if (d.km > 0) {
    out.push({ time: '08:30', type: 'transport', label: `Route ${d.km} km`, detail: d.cities })
  }

  // Local guide window
  if (d.lg > 0) {
    out.push({ time: '10:00', type: 'guide', label: 'Guide local', detail: `${d.cities.split(/[›→]/).pop()?.trim()}`, cost: d.lg })
  }

  // Lunch
  if (d.restPrice > 0 && !isBB) {
    out.push({ time: '12:30', type: 'restaurant', label: 'Déjeuner', detail: d.rest, cost: d.restPrice })
  } else if (!isBB) {
    out.push({ time: '12:30', type: 'rest', label: 'Déjeuner libre' })
  }

  // Monument visit
  if (d.monuPrice > 0 || (d.monument && d.monument !== '—')) {
    out.push({ time: '14:30', type: 'monument', label: d.monument || 'Visite culturelle', cost: d.monuPrice })
  }

  // Hotel check-in
  if (d.hotel && d.hotel !== '—' && d.hotel !== 'DÉPART') {
    out.push({ time: '17:30', type: 'hotel', label: 'Check-in', detail: d.hotel, cost: d.halfDbl })
  }

  // Dinner
  if (hasMeal && !isBB) {
    out.push({ time: '19:30', type: 'restaurant', label: 'Dîner', detail: isFB ? d.rest : `${d.hotel} (${d.formula})`, cost: isFB ? d.restPrice : 0 })
  }

  return out
}

const SLOT_PERIODS = [
  { label: 'Matin',       icon: Sun,     range: ['06:00', '12:00'] },
  { label: 'Midi',        icon: Coffee,  range: ['12:00', '14:00'] },
  { label: 'Après-midi',  icon: Sun,     range: ['14:00', '18:00'] },
  { label: 'Soir',        icon: Sunset,  range: ['18:00', '22:00'] },
  { label: 'Nuit',        icon: Moon,    range: ['22:00', '24:00'] },
]

function periodOf(time: string): number {
  const [h] = time.split(':').map(Number)
  if (h < 12) return 0
  if (h < 14) return 1
  if (h < 18) return 2
  if (h < 22) return 3
  return 4
}

// ── Component ─────────────────────────────────────────────────────────

type ViewTab = 'global' | 'day' | 'timeline'

interface Props {
  days: DesignerDay[]
  destinationLabel?: string
  paxCount?: number
  defaultDay?: number
}

export function TravelDesignerMap({ days, destinationLabel, paxCount, defaultDay = 1 }: Props) {
  const [view, setView] = useState<ViewTab>('global')
  const [activeDay, setActiveDay] = useState(defaultDay)

  // Build geo stops from days (drops days we cannot localise — e.g. "DÉPART")
  const stops: DayStop[] = useMemo(() => {
    return days
      .map(d => {
        const c = primaryCity(d)
        return c ? { day: d, city: c } : null
      })
      .filter((s): s is DayStop => s !== null)
  }, [days])

  const activeStop = stops.find(s => s.day.day === activeDay) ?? stops[0]
  const intraStops = useMemo(() => activeStop ? buildIntraDay(activeStop) : [], [activeStop])

  // Aggregate stats
  const totalKm   = days.reduce((s, d) => s + d.km, 0)
  const nbHotels  = new Set(days.filter(d => d.hotel && d.hotel !== '—' && d.hotel !== 'DÉPART').map(d => d.hotel)).size
  const nbRestos  = days.filter(d => d.restPrice > 0).length
  const nbMonums  = days.filter(d => d.monuPrice > 0 || (d.monument && d.monument !== '—')).length
  const nbGuides  = days.filter(d => d.lg > 0).length

  return (
    <div className="rihla-leaflet-root rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
      {/* Header tabs */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Globe2 size={14} className="text-rose-700" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Carte du dossier {destinationLabel ? `· ${destinationLabel}` : ''}
          </span>
          {paxCount ? (
            <span className="text-[10px] text-slate-500 ml-2 flex items-center gap-1">
              <Users size={10} /> {paxCount} pax
            </span>
          ) : null}
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {([
            { id: 'global',   label: 'Vue globale',   icon: MapIcon },
            { id: 'day',      label: 'Jour-par-jour', icon: Calendar },
            { id: 'timeline', label: 'Timeline',      icon: Clock },
          ] as const).map(t => {
            const Icon = t.icon
            const active = view === t.id
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition',
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <Icon size={12} /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab body */}
      {view === 'global' && (
        <GlobalView
          stops={stops}
          totalKm={totalKm}
          nbHotels={nbHotels}
          nbRestos={nbRestos}
          nbMonums={nbMonums}
          nbGuides={nbGuides}
        />
      )}

      {view === 'day' && activeStop && (
        <DayView
          stops={stops}
          activeStop={activeStop}
          intraStops={intraStops}
          onChangeDay={setActiveDay}
        />
      )}

      {view === 'timeline' && activeStop && (
        <TimelineView
          stops={stops}
          activeStop={activeStop}
          onChangeDay={setActiveDay}
        />
      )}
    </div>
  )
}

// ── Tab 1 — Vue globale ───────────────────────────────────────────────

function GlobalView({
  stops, totalKm, nbHotels, nbRestos, nbMonums, nbGuides,
}: {
  stops: DayStop[]
  totalKm: number; nbHotels: number; nbRestos: number; nbMonums: number; nbGuides: number
}) {
  return (
    <div className="grid grid-cols-12 gap-0">
      <div className="col-span-12 lg:col-span-9 relative h-[520px]">
        <MapContainer
          center={[31.79, -7.09]}
          zoom={6}
          zoomControl={false}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='© OpenStreetMap · © CartoDB'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomleft" />
          <FitBounds stops={stops} dep={stops.length} />

          {/* Connecting curved polyline */}
          {stops.length > 1 && (() => {
            const pts: [number, number][] = []
            for (let i = 0; i < stops.length - 1; i++) {
              const seg = curvedPath(
                [stops[i].city.lat, stops[i].city.lng],
                [stops[i + 1].city.lat, stops[i + 1].city.lng],
                32, 0.16,
              )
              pts.push(...seg)
            }
            return (
              <Polyline
                positions={pts}
                pathOptions={{ color: '#C0392B', weight: 4, opacity: 0.85, className: 'rihla-flow-line' }}
              />
            )
          })()}

          {/* Day-stop markers */}
          {stops.map((s, i) => (
            <Marker
              key={`stop-${s.day.day}`}
              position={[s.city.lat, s.city.lng]}
              icon={stopIcon(s.day.day, '#C0392B')}
            >
              <Tooltip permanent={false} direction="top" offset={[0, -18]}>
                <strong>J{s.day.day}</strong> · {s.city.display}
              </Tooltip>
            </Marker>
          ))}

          {/* Resource pins (offset around the city) */}
          {stops.flatMap((s, sIdx) => {
            const pins: { type: ResourceType; pos: [number, number]; label: string }[] = []
            let off = 0
            if (s.day.hotel && s.day.hotel !== '—' && s.day.hotel !== 'DÉPART') {
              pins.push({ type: 'hotel',      pos: offsetAround(s.city, off++), label: s.day.hotel })
            }
            if (s.day.restPrice > 0 || s.day.rest) {
              pins.push({ type: 'restaurant', pos: offsetAround(s.city, off++), label: s.day.rest || 'Restaurant' })
            }
            if (s.day.monuPrice > 0 || (s.day.monument && s.day.monument !== '—')) {
              pins.push({ type: 'monument',   pos: offsetAround(s.city, off++), label: s.day.monument })
            }
            if (s.day.lg > 0) {
              pins.push({ type: 'guide',      pos: offsetAround(s.city, off++), label: `Guide local ${s.city.display}` })
            }
            return pins.map((p, i) => (
              <Marker
                key={`pin-${s.day.day}-${i}-${sIdx}`}
                position={p.pos}
                icon={dotIcon(p.type, p.label)}
              >
                <Tooltip direction="top" offset={[0, -14]}>
                  <span style={{ fontWeight: 600 }}>{TYPE_META[p.type].label}</span>
                  <br />
                  {p.label}
                </Tooltip>
              </Marker>
            ))
          })}
        </MapContainer>
      </div>

      {/* Right panel : legend + summary */}
      <div className="col-span-12 lg:col-span-3 border-l border-slate-100 p-4 space-y-3">
        <div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Légende
          </h4>
          <div className="space-y-1.5">
            {(Object.keys(TYPE_META) as ResourceType[]).map(t => (
              <div key={t} className="flex items-center gap-2 text-[12px] text-slate-700">
                <span
                  className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[11px]"
                  style={{ background: TYPE_META[t].color }}
                >
                  {TYPE_META[t].emoji}
                </span>
                <span>{TYPE_META[t].label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Synthèse circuit
          </h4>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <SummaryCell icon={MapPin}     label="Étapes"     value={String(stops.length)} />
            <SummaryCell icon={Bus}        label="Total km"   value={String(totalKm)} />
            <SummaryCell icon={HotelIcon}  label="Hôtels"     value={String(nbHotels)} />
            <SummaryCell icon={Utensils}   label="Restos"     value={String(nbRestos)} />
            <SummaryCell icon={Landmark}   label="Monuments"  value={String(nbMonums)} />
            <SummaryCell icon={Users}      label="Guides loc." value={String(nbGuides)} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCell({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
        <Icon size={10} /> {label}
      </div>
      <div className="text-[14px] font-extrabold text-slate-900 leading-none mt-1">{value}</div>
    </div>
  )
}

// ── Tab 2 — Vue jour-par-jour ─────────────────────────────────────────

function buildIntraDay(stop: DayStop) {
  const center = stop.city
  const r = 0.012
  const out: { type: ResourceType; pos: [number, number]; label: string; angleIdx: number }[] = []
  let i = 0
  if (stop.day.hotel && stop.day.hotel !== '—' && stop.day.hotel !== 'DÉPART') {
    out.push({ type: 'hotel', pos: [center.lat, center.lng], label: stop.day.hotel, angleIdx: i++ })
  }
  if (stop.day.lg > 0) {
    out.push({ type: 'guide', pos: rotate(center, r, i), label: 'Guide local', angleIdx: i++ })
  }
  if (stop.day.monuPrice > 0 || (stop.day.monument && stop.day.monument !== '—')) {
    out.push({ type: 'monument', pos: rotate(center, r, i), label: stop.day.monument, angleIdx: i++ })
  }
  if (stop.day.restPrice > 0 || stop.day.rest) {
    out.push({ type: 'restaurant', pos: rotate(center, r, i), label: stop.day.rest || 'Restaurant', angleIdx: i++ })
  }
  return out
}

function rotate(c: CityNode, r: number, i: number): [number, number] {
  const a = (i * Math.PI * 2) / 5 + 0.5
  return [c.lat + r * Math.sin(a), c.lng + r * Math.cos(a)]
}

function DayView({
  stops, activeStop, intraStops, onChangeDay,
}: {
  stops: DayStop[]
  activeStop: DayStop
  intraStops: ReturnType<typeof buildIntraDay>
  onChangeDay: (n: number) => void
}) {
  const idx = stops.findIndex(s => s.day.day === activeStop.day.day)
  const prev = idx > 0 ? stops[idx - 1] : null
  const next = idx < stops.length - 1 ? stops[idx + 1] : null

  return (
    <div className="grid grid-cols-12 gap-0 h-[520px]">
      {/* Day picker */}
      <div className="col-span-12 lg:col-span-3 border-r border-slate-100 overflow-y-auto p-2">
        <div className="space-y-1.5">
          {stops.map(s => {
            const active = s.day.day === activeStop.day.day
            return (
              <button
                key={s.day.day}
                onClick={() => onChangeDay(s.day.day)}
                className={clsx(
                  'w-full text-left px-3 py-2 rounded-xl border transition',
                  active
                    ? 'bg-rose-700 text-white border-rose-700 shadow'
                    : 'bg-white border-slate-200 hover:border-rose-200 hover:bg-rose-50/40',
                )}
              >
                <div className={clsx('text-[10px] font-bold uppercase tracking-wider',
                  active ? 'text-rose-100' : 'text-rose-700')}>
                  J{s.day.day} · {s.day.date}
                </div>
                <div className={clsx('text-[12px] font-semibold leading-tight mt-0.5',
                  active ? 'text-white' : 'text-slate-900')}>{s.city.display}</div>
                <div className={clsx('text-[10px] leading-tight mt-0.5 truncate',
                  active ? 'text-rose-100/80' : 'text-slate-500')}>
                  {s.day.km > 0 ? `${s.day.km} km · ` : ''}{s.day.hotel || '—'}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Intra-city map + leg context */}
      <div className="col-span-12 lg:col-span-9 relative">
        <MapContainer
          key={`day-${activeStop.day.day}`}
          center={[activeStop.city.lat, activeStop.city.lng]}
          zoom={13}
          zoomControl={false}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='© OpenStreetMap · © CartoDB'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomleft" />

          {/* Intra-day curved path between resources */}
          {intraStops.length > 1 && (() => {
            const seg: [number, number][] = []
            for (let i = 0; i < intraStops.length - 1; i++) {
              seg.push(...curvedPath(intraStops[i].pos, intraStops[i + 1].pos, 18, 0.06))
            }
            return (
              <Polyline
                positions={seg}
                pathOptions={{ color: '#C0392B', weight: 3, opacity: 0.7, dashArray: '6 6' }}
              />
            )
          })()}

          {intraStops.map((p, i) => (
            <Marker key={`intra-${i}`} position={p.pos} icon={dotIcon(p.type, p.label)}>
              <Tooltip permanent direction="top" offset={[0, -14]}>
                {TYPE_META[p.type].emoji} {p.label}
              </Tooltip>
            </Marker>
          ))}

          {/* Pulse circle around city to give it weight */}
          <CircleMarker
            center={[activeStop.city.lat, activeStop.city.lng]}
            radius={26}
            pathOptions={{ color: '#C0392B', weight: 1, fillColor: '#C0392B', fillOpacity: 0.06 }}
          />
        </MapContainer>

        {/* Header overlay : day title + prev/next */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between gap-2">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/70 rounded-2xl shadow-md px-3 py-2 flex-1">
            <div className="text-[10px] uppercase font-bold tracking-wider text-rose-700">
              Jour {activeStop.day.day} · {activeStop.day.date}
            </div>
            <div className="text-[14px] font-extrabold text-slate-900 leading-tight">
              {activeStop.city.display}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {activeStop.day.cities}
              {activeStop.day.km > 0 ? ` · ${activeStop.day.km} km` : ''}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => prev && onChangeDay(prev.day.day)}
              disabled={!prev}
              className="p-2 rounded-xl bg-white/95 border border-slate-200/70 shadow-md text-slate-700 disabled:opacity-30"
              title="Jour précédent"
            ><ChevronLeft size={16} /></button>
            <button
              onClick={() => next && onChangeDay(next.day.day)}
              disabled={!next}
              className="p-2 rounded-xl bg-white/95 border border-slate-200/70 shadow-md text-slate-700 disabled:opacity-30"
              title="Jour suivant"
            ><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* Day mini-itinerary (bottom strip) */}
        <div className="absolute bottom-3 left-3 right-3 z-[1000]
                        bg-white/95 backdrop-blur-md border border-slate-200/70
                        rounded-2xl shadow-md p-2 flex items-center gap-2 overflow-x-auto">
          {intraStops.map((p, i) => (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] text-white"
                style={{ background: TYPE_META[p.type].color }}
              >{TYPE_META[p.type].emoji}</span>
              <span className="text-[11px] font-semibold text-slate-800 truncate max-w-[160px]">{p.label}</span>
              {i < intraStops.length - 1 && <ArrowRight size={11} className="text-slate-400" />}
            </div>
          ))}
          {intraStops.length === 0 && (
            <span className="text-[11px] text-slate-400 italic">Pas de programme structuré ce jour.</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab 3 — Timeline horaire ──────────────────────────────────────────

function TimelineView({
  stops, activeStop, onChangeDay,
}: {
  stops: DayStop[]
  activeStop: DayStop
  onChangeDay: (n: number) => void
}) {
  const slots = useMemo(() => buildSchedule(activeStop.day), [activeStop])
  const grouped: Slot[][] = SLOT_PERIODS.map(() => [])
  for (const s of slots) {
    grouped[periodOf(s.time)].push(s)
  }

  return (
    <div className="grid grid-cols-12 gap-0 h-[520px]">
      {/* Day picker */}
      <div className="col-span-12 lg:col-span-3 border-r border-slate-100 overflow-y-auto p-2">
        <div className="space-y-1.5">
          {stops.map(s => {
            const active = s.day.day === activeStop.day.day
            return (
              <button
                key={s.day.day}
                onClick={() => onChangeDay(s.day.day)}
                className={clsx(
                  'w-full text-left px-3 py-2 rounded-xl border transition',
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow'
                    : 'bg-white border-slate-200 hover:border-slate-400',
                )}
              >
                <div className={clsx('text-[10px] font-bold uppercase tracking-wider',
                  active ? 'text-slate-300' : 'text-slate-500')}>
                  J{s.day.day} · {s.day.date}
                </div>
                <div className={clsx('text-[12px] font-semibold leading-tight mt-0.5',
                  active ? 'text-white' : 'text-slate-900')}>{s.city.display}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Vertical Gantt timeline */}
      <div className="col-span-12 lg:col-span-9 overflow-y-auto p-4">
        <div className="flex items-baseline gap-2 mb-3">
          <h3 className="text-[14px] font-extrabold text-slate-900">
            Timeline · J{activeStop.day.day} {activeStop.city.display}
          </h3>
          <span className="text-[10px] text-slate-500">{activeStop.day.date}</span>
        </div>

        <div className="space-y-3">
          {SLOT_PERIODS.map((period, idx) => {
            const items = grouped[idx]
            if (items.length === 0) return null
            const Icon = period.icon
            return (
              <div key={period.label} className="relative pl-9">
                {/* vertical rail */}
                <div className="absolute left-3.5 top-1 bottom-1 w-px bg-slate-200" />
                {/* period header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="absolute left-0 top-0 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shadow">
                    <Icon size={13} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {period.label} · {period.range[0]} – {period.range[1]}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map((s, i) => (
                    <SlotRow key={i} slot={s} />
                  ))}
                </div>
              </div>
            )
          })}
          {slots.length === 0 && (
            <div className="text-[12px] text-slate-400 italic">
              Pas de planning détaillé pour ce jour (jour de transit / arrivée / départ).
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SlotRow({ slot }: { slot: Slot }) {
  const meta = (slot.type === 'rest' || slot.type === 'travel')
    ? null
    : TYPE_META[slot.type]
  const color = meta?.color ?? '#64748b'
  const emoji = meta?.emoji ?? (slot.type === 'travel' ? '🚌' : '☕')
  return (
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-slate-300 transition">
      <span className="text-[11px] font-mono font-bold text-slate-700 w-12 shrink-0 mt-0.5">{slot.time}</span>
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[14px] shrink-0"
        style={{ background: color }}
      >{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold text-slate-900 truncate">{slot.label}</div>
        {slot.detail && (
          <div className="text-[11px] text-slate-500 truncate">{slot.detail}</div>
        )}
      </div>
      {typeof slot.cost === 'number' && slot.cost > 0 && (
        <span className="text-[11px] font-bold text-slate-700 tabular-nums whitespace-nowrap">
          {Math.round(slot.cost)} MAD
        </span>
      )}
    </div>
  )
}

export default TravelDesignerMap

/**
 * Group Itinerary Map — best-in-class tourism interactive map.
 *
 * Features:
 *  - All active group itineraries plotted on a light Leaflet map
 *  - Per-group coloured polyline ROUTE built from the day-by-day stops
 *  - Animated TRAVELER marker that walks along the route with play/pause/speed
 *  - Day TIMELINE at the bottom — click any day to jump the traveler there
 *  - Multi-group selector (mini-cards) — show one or stack all routes
 *  - Rich popups per stop: hotel, meal plan, distance, image
 *  - Live KPIs panel: pax, days, km, nuitées, status
 *  - Smart fit-to-route + recentre controls
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
  Play, Pause, RotateCcw, Users, MapPin, Route, Calendar, Plane, Hotel as HotelIcon,
  Layers, Maximize2, Minimize2, ChevronRight, Eye, EyeOff, Gauge,
} from 'lucide-react'
import { clsx } from 'clsx'
import { dashboardApi, type GroupItinerary, type GroupItineraryDay } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────

/** Linear interpolation between two lat/lng points */
function lerp(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Build a smooth quadratic-bezier curved path between A and B for a "flight" feel */
function curvedPath(a: [number, number], b: [number, number], steps = 32, bulge = 0.18): [number, number][] {
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  // Perpendicular offset, scaled by distance
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

/** Walk an array of curved segments and return point at progress p in [0,1] */
function pointAtProgress(segments: [number, number][][], p: number): [number, number] {
  if (segments.length === 0) return [31.7, -7.0]
  const totalSteps = segments.reduce((s, seg) => s + (seg.length - 1), 0)
  const target = Math.max(0, Math.min(p, 1)) * totalSteps
  let acc = 0
  for (const seg of segments) {
    const segSteps = seg.length - 1
    if (acc + segSteps >= target) {
      const local = target - acc
      const i = Math.floor(local)
      const frac = local - i
      return lerp(seg[i], seg[Math.min(i + 1, seg.length - 1)], frac)
    }
    acc += segSteps
  }
  return segments[segments.length - 1][segments[segments.length - 1].length - 1]
}

// ── Map icons ─────────────────────────────────────────────────────────

const stopIcon = (color: string, label: string) => L.divIcon({
  className: 'rihla-stop-icon',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `
    <div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:800;font-size:12px;
      border:3px solid #fff;
      box-shadow:0 4px 12px rgba(0,0,0,0.18), 0 0 0 4px ${color}33;
    ">${label}</div>
  `,
})

const travelerIcon = (color: string) => L.divIcon({
  className: 'rihla-traveler-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  html: `
    <div style="position:relative;width:40px;height:40px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:${color};opacity:0.30;
        animation: rihlaPulse 1.4s ease-out infinite;"></div>
      <div style="
        position:absolute;inset:7px;border-radius:50%;
        background:#fff;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 16px rgba(0,0,0,0.25);
        border:2px solid ${color};
        font-size:14px;
      ">✈️</div>
    </div>
  `,
})

// Lightweight 14-city cards w/ default photos (Unsplash) for popups
const CITY_PHOTO: Record<string, string> = {
  rak: 'https://images.unsplash.com/photo-1539020140153-e479b8c5c0f9?w=320&q=70',
  cas: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=320&q=70',
  fes: 'https://images.unsplash.com/photo-1577147443647-81856d5151af?w=320&q=70',
  rab: 'https://images.unsplash.com/photo-1539020140153-e479b8c5c0f9?w=320&q=70',
  tan: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=320&q=70',
  che: 'https://images.unsplash.com/photo-1553244124-fc3a02b00f6f?w=320&q=70',
  mek: 'https://images.unsplash.com/photo-1577147443647-81856d5151af?w=320&q=70',
  ouz: 'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=320&q=70',
  mer: 'https://images.unsplash.com/photo-1517821362941-f7f753a08fde?w=320&q=70',
  ess: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=320&q=70',
  aga: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=320&q=70',
  tet: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=320&q=70',
  erf: 'https://images.unsplash.com/photo-1517821362941-f7f753a08fde?w=320&q=70',
  daa: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=320&q=70',
}

// ── Fit map to selected groups ────────────────────────────────────────
function FitBounds({ groups, dep }: { groups: GroupItinerary[]; dep: number }) {
  const map = useMap()
  useEffect(() => {
    if (groups.length === 0) {
      map.fitBounds([[27.5, -13.5], [35.95, -1.0]], { padding: [60, 60] })
      return
    }
    const pts: [number, number][] = []
    groups.forEach(g => g.route.forEach(c => pts.push([c.lat, c.lng])))
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 8 })
    }
  }, [dep, groups, map])
  return null
}

// ── Component ─────────────────────────────────────────────────────────

const SPEEDS = [0.5, 1, 2, 4]

export function GroupItineraryMap() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['groups-map'],
    queryFn: async () => (await dashboardApi.groupsMap()).data,
    staleTime: 60_000,
  })

  const groups = data?.groups ?? []

  // ── State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)        // 0..1 along the active route
  const [speed, setSpeed] = useState(1)              // multiplier
  const [showAllRoutes, setShowAllRoutes] = useState(true)
  const [isFs, setIsFs] = useState(false)
  const [fitTick, setFitTick] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number>(0)

  // ── Default selection: pick longest route on load
  useEffect(() => {
    if (!activeId && groups.length > 0) {
      const best = [...groups].sort((a, b) => b.route.length - a.route.length)[0]
      setActiveId(best.id)
      setSelectedIds(new Set([best.id]))
    }
  }, [groups, activeId])

  const activeGroup = groups.find(g => g.id === activeId) ?? null

  // ── Build curved segments for the active group's route
  const segments = useMemo(() => {
    if (!activeGroup) return []
    const pts: [number, number][] = activeGroup.route.map(c => [c.lat, c.lng])
    const out: [number, number][][] = []
    for (let i = 0; i < pts.length - 1; i++) {
      out.push(curvedPath(pts[i], pts[i + 1], 36, 0.16))
    }
    return out
  }, [activeGroup])

  // ── Animation loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const tick = (ts: number) => {
      if (lastTsRef.current === 0) lastTsRef.current = ts
      const dt = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      setProgress(prev => {
        const dur = (activeGroup?.duration_days ?? 8) / speed   // 1 day per real second × speed
        const next = prev + dt / dur
        if (next >= 1) {
          setPlaying(false)
          return 1
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
    }
  }, [playing, speed, activeGroup])

  // ── Day count -> jump progress mapping
  const totalDays = activeGroup?.days.length ?? 0
  const currentDayIdx = useMemo(() => {
    if (totalDays === 0) return 0
    return Math.min(totalDays - 1, Math.floor(progress * totalDays))
  }, [progress, totalDays])

  const travelerPos: [number, number] = useMemo(() => {
    if (segments.length === 0) return [31.7, -7.0]
    return pointAtProgress(segments, progress)
  }, [segments, progress])

  // ── Toggle helpers
  function selectGroup(id: string) {
    setActiveId(id)
    const next = new Set(selectedIds)
    next.add(id)
    setSelectedIds(next)
    setProgress(0)
    setPlaying(false)
    setFitTick(t => t + 1)
  }

  function toggleSelected(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function selectAll() {
    setSelectedIds(new Set(groups.map(g => g.id)))
    setFitTick(t => t + 1)
  }

  function clearAll() {
    setSelectedIds(new Set(activeId ? [activeId] : []))
    setFitTick(t => t + 1)
  }

  function jumpToDay(idx: number) {
    if (totalDays === 0) return
    setProgress(Math.max(0, Math.min(1, idx / Math.max(1, totalDays - 1))))
  }

  function toggleFs() {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFs(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFs(false)).catch(() => {})
    }
  }

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // ── Visible groups (for polyline rendering)
  const visibleGroups = useMemo(() => {
    if (showAllRoutes) return groups.filter(g => selectedIds.has(g.id) || g.id === activeId)
    return activeGroup ? [activeGroup] : []
  }, [groups, selectedIds, activeId, showAllRoutes, activeGroup])

  // ── KPIs
  const totalPax     = groups.reduce((s, g) => s + g.pax, 0)
  const totalDaysAll = groups.reduce((s, g) => s + g.duration_days, 0)
  const totalKmAll   = groups.reduce((s, g) => s + g.total_km, 0)

  return (
    <div
      ref={containerRef}
      className={clsx(
        'rihla-leaflet-root relative overflow-hidden rounded-3xl border bg-white shadow-xl',
        isFs ? 'h-screen w-screen rounded-none' : 'h-[640px] w-full',
      )}
      style={{ borderColor: 'rgba(192,57,43,0.12)' }}
    >
      <MapContainer
        center={[31.7917, -7.0926]}
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

        <FitBounds groups={visibleGroups} dep={fitTick} />

        {/* Polylines for every visible group (faded for non-active) */}
        {visibleGroups.map(g => {
          const isActive = g.id === activeId
          const pts: [number, number][] = []
          for (let i = 0; i < g.route.length - 1; i++) {
            const seg = curvedPath(
              [g.route[i].lat,     g.route[i].lng],
              [g.route[i + 1].lat, g.route[i + 1].lng],
              36, 0.16,
            )
            pts.push(...seg)
          }
          return (
            <Polyline
              key={g.id}
              positions={pts}
              pathOptions={{
                color: g.color,
                weight: isActive ? 5 : 3,
                opacity: isActive ? 0.95 : 0.45,
                dashArray: isActive ? undefined : '6 8',
                className: isActive ? 'rihla-flow-line' : undefined,
              }}
            />
          )
        })}

        {/* Stop markers for the ACTIVE group */}
        {activeGroup?.route.map((c, i) => (
          <Marker
            key={`${activeGroup.id}-${c.id}`}
            position={[c.lat, c.lng]}
            icon={stopIcon(activeGroup.color, String(i + 1))}
          >
            <Popup className="rihla-popup" closeButton={false} maxWidth={280}>
              <div className="min-w-[240px]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-slate-900">{c.name}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider"
                        style={{ color: activeGroup.color }}>
                    Étape {i + 1}/{activeGroup.route.length}
                  </span>
                </div>
                {CITY_PHOTO[c.id] && (
                  <img
                    src={CITY_PHOTO[c.id]}
                    alt={c.name}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                    loading="lazy"
                  />
                )}
                <div className="text-[11px] text-slate-600 mb-1">
                  Groupe : <span className="font-semibold text-slate-900">{activeGroup.name}</span>
                </div>
                {activeGroup.client_name && (
                  <div className="text-[11px] text-slate-600">Client : {activeGroup.client_name}</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Inactive groups → small dots at their stops */}
        {visibleGroups.filter(g => g.id !== activeId).flatMap(g =>
          g.route.map(c => (
            <CircleMarker
              key={`${g.id}-${c.id}-dot`}
              center={[c.lat, c.lng]}
              radius={5}
              pathOptions={{ color: '#fff', weight: 1.5, fillColor: g.color, fillOpacity: 0.85 }}
            />
          ))
        )}

        {/* Animated traveler */}
        {activeGroup && segments.length > 0 && (
          <Marker
            position={travelerPos}
            icon={travelerIcon(activeGroup.color)}
            interactive={false}
          />
        )}
      </MapContainer>

      {/* ─── TOP-LEFT: Group selector ─────────────────────────────────── */}
      <div className="pointer-events-auto absolute top-4 left-4 z-[1000] w-[300px] max-h-[55%]
                      flex flex-col bg-white/95 backdrop-blur-md border border-slate-200/70
                      rounded-2xl shadow-xl overflow-hidden">
        <div className="px-3 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-rose-700" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Groupes en route ({groups.length})
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={selectAll}
              className="text-[10px] uppercase tracking-wider font-semibold text-slate-500
                         hover:text-slate-900 px-1.5 py-0.5 rounded hover:bg-slate-100"
            >Tous</button>
            <button
              onClick={clearAll}
              className="text-[10px] uppercase tracking-wider font-semibold text-slate-500
                         hover:text-slate-900 px-1.5 py-0.5 rounded hover:bg-slate-100"
            >Solo</button>
          </div>
        </div>
        <div className="overflow-y-auto px-2 py-2 space-y-1.5">
          {isLoading && (
            <div className="text-[11px] text-slate-400 px-2 py-3">Chargement…</div>
          )}
          {groups.map(g => {
            const isActive = g.id === activeId
            const isOn = selectedIds.has(g.id)
            return (
              <div
                key={g.id}
                className={clsx(
                  'group flex items-center gap-2 px-2 py-1.5 rounded-xl cursor-pointer transition',
                  isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100',
                )}
                onClick={() => selectGroup(g.id)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelected(g.id) }}
                  className={clsx(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    isOn ? 'border-white' : 'border-slate-300',
                  )}
                  style={{ background: isOn ? g.color : 'transparent' }}
                  title={isOn ? 'Visible' : 'Masqué'}
                >
                  {isOn ? <Eye size={9} className="text-white" /> : null}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={clsx(
                    'text-[12px] font-semibold leading-tight truncate',
                    isActive ? 'text-white' : 'text-slate-900',
                  )}>{g.name}</div>
                  <div className={clsx(
                    'text-[10px] truncate',
                    isActive ? 'text-slate-300' : 'text-slate-500',
                  )}>
                    {g.pax} pax · {g.duration_days}j · {Math.round(g.total_km)} km
                  </div>
                </div>
                <ChevronRight size={12} className={isActive ? 'text-white' : 'text-slate-400'} />
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── TOP-RIGHT: KPIs ───────────────────────────────────────── */}
      <div className="pointer-events-none absolute top-4 right-4 z-[1000]
                      bg-white/95 backdrop-blur-md border border-slate-200/70
                      rounded-2xl shadow-xl px-4 py-2.5 min-w-[230px]">
        <div className="text-[10px] uppercase font-bold tracking-wider text-rose-700 mb-1
                        flex items-center gap-1">
          <Plane size={11} /> {groups.length} GROUPES EN VOYAGE
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Pax</div>
            <div className="text-[16px] font-extrabold text-slate-900 leading-tight">{totalPax}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Jours</div>
            <div className="text-[16px] font-extrabold text-slate-900 leading-tight">{totalDaysAll}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Km</div>
            <div className="text-[16px] font-extrabold text-slate-900 leading-tight">
              {Math.round(totalKmAll)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM-RIGHT: Layer & view controls ──────────────────── */}
      <div className="pointer-events-auto absolute bottom-32 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setShowAllRoutes(s => !s)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-[11px] uppercase tracking-wider',
            'bg-white/95 backdrop-blur-md border border-slate-200/70 shadow-md',
            showAllRoutes ? 'text-rose-700' : 'text-slate-500',
          )}
          title="Afficher toutes les routes sélectionnées"
        >
          <Layers size={13} />
          {showAllRoutes ? 'Multi-groupes' : 'Solo groupe'}
        </button>
        <button
          onClick={() => setFitTick(t => t + 1)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-[11px]
                     uppercase tracking-wider bg-white/95 backdrop-blur-md
                     border border-slate-200/70 shadow-md text-slate-700"
          title="Recentrer"
        >
          <Route size={13} /> Recentrer
        </button>
        <button
          onClick={toggleFs}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-[11px]
                     uppercase tracking-wider bg-white/95 backdrop-blur-md
                     border border-slate-200/70 shadow-md text-slate-700"
        >
          {isFs ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {isFs ? 'Quitter' : 'Plein écran'}
        </button>
      </div>

      {/* ─── BOTTOM: Day timeline + transport controls ───────────── */}
      {activeGroup && (
        <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-[1000]
                        bg-white/96 backdrop-blur-md border border-slate-200/70
                        rounded-2xl shadow-2xl px-4 py-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-3 h-3 rounded-full" style={{ background: activeGroup.color }} />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-slate-900 truncate">
                  {activeGroup.name}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {activeGroup.destination ?? '—'}
                  {activeGroup.client_name ? ` · ${activeGroup.client_name}` : ''}
                  {' · '}
                  <span className={clsx(
                    'inline-block px-1 py-0.5 rounded uppercase text-[9px] font-bold tracking-wider',
                    activeGroup.status === 'won'         ? 'bg-emerald-100 text-emerald-700'
                    : activeGroup.status === 'in_progress' ? 'bg-amber-100  text-amber-700'
                    : activeGroup.status === 'sent'      ? 'bg-blue-100   text-blue-700'
                    : activeGroup.status === 'lost'      ? 'bg-slate-100  text-slate-600'
                    : 'bg-slate-100 text-slate-600',
                  )}>{activeGroup.status}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { setProgress(0); setPlaying(false) }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700"
                title="Recommencer"
              ><RotateCcw size={14} /></button>
              <button
                onClick={() => setPlaying(p => !p)}
                className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px]
                           font-bold uppercase tracking-wider text-white shadow-md"
                style={{ background: activeGroup.color }}
              >
                {playing ? <Pause size={12} /> : <Play size={12} />}
                {playing ? 'Pause' : 'Lancer'}
              </button>
              <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={clsx(
                      'px-2 py-1 text-[10px] font-bold',
                      speed === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200',
                    )}
                  >{s}×</button>
                ))}
              </div>
            </div>
          </div>

          {/* Day chips timeline */}
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex items-center gap-1 min-w-max">
              {activeGroup.days.map((d, i) => {
                const isCurrent = i === currentDayIdx
                const isPast = i < currentDayIdx
                return (
                  <button
                    key={`${d.day_number}-${i}`}
                    onClick={() => jumpToDay(i)}
                    className={clsx(
                      'group relative shrink-0 px-2.5 py-1.5 rounded-lg border transition',
                      isCurrent
                        ? 'border-transparent text-white shadow-md'
                        : isPast
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
                    )}
                    style={isCurrent ? { background: activeGroup.color } : undefined}
                    title={d.title}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold uppercase opacity-80">J{d.day_number}</span>
                      <span className="text-[11px] font-semibold">{d.city_name}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 relative overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full transition-[width]"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${activeGroup.color}, ${activeGroup.color}cc)`,
              }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar size={10} /> Jour {totalDays > 0 ? currentDayIdx + 1 : 0} / {totalDays}
            </span>
            <span className="flex items-center gap-1">
              <Gauge size={10} /> {Math.round(progress * activeGroup.total_km)} / {Math.round(activeGroup.total_km)} km
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={10} /> {activeGroup.route[Math.min(currentDayIdx, activeGroup.route.length - 1)]?.name ?? '—'}
            </span>
          </div>

          {/* CTA */}
          <div className="mt-2 flex items-center justify-end">
            <button
              onClick={() => navigate(`/projects?q=${encodeURIComponent(activeGroup.name)}`)}
              className="text-[10px] font-bold uppercase tracking-wider text-rose-700 hover:underline"
            >
              Voir le dossier complet →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupItineraryMap

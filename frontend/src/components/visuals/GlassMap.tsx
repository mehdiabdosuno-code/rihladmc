import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Navigation, Star, ArrowRight } from 'lucide-react'
import { projectsApi } from '@/lib/api'
import { clsx } from 'clsx'

interface City {
  id: string
  name: string
  // search aliases used to match the destination string
  aliases: string[]
  x: number
  y: number
  status: 'high' | 'med' | 'low'
}

const CITIES: City[] = [
  { id: 'rak', name: 'Marrakech',  aliases: ['marrakech'],                    x: 25, y: 70, status: 'high' },
  { id: 'cas', name: 'Casablanca', aliases: ['casablanca', 'casa'],           x: 30, y: 40, status: 'med' },
  { id: 'fes', name: 'Fès',        aliases: ['fes', 'fès', 'fez'],            x: 55, y: 35, status: 'high' },
  { id: 'tan', name: 'Tanger',     aliases: ['tanger', 'tangier'],            x: 45, y: 10, status: 'low' },
  { id: 'ouz', name: 'Ouarzazate', aliases: ['ouarzazate', 'ouz'],            x: 45, y: 75, status: 'med' },
  { id: 'aga', name: 'Agadir',     aliases: ['agadir'],                       x: 15, y: 85, status: 'med' },
]

function matchCity(destination: string | null | undefined, city: City): boolean {
  if (!destination) return false
  const lower = destination.toLowerCase()
  return city.aliases.some(a => lower.includes(a))
}

export function GlassMap() {
  const navigate = useNavigate()
  const [hoveredCity, setHoveredCity] = useState<string | null>(null)

  // Fetch all projects to count per city
  const { data } = useQuery({
    queryKey: ['projects', 'map-counts'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => r.data),
    staleTime: 60_000,
  })
  const projects: any[] = (data as any)?.items ?? []

  // Compute project counts per city
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of CITIES) map[c.id] = 0
    for (const p of projects) {
      for (const c of CITIES) {
        if (matchCity(p.destination, c)) map[c.id] += 1
      }
    }
    return map
  }, [projects])

  const topCity = useMemo(() => {
    let best: { city: City; n: number } | null = null
    for (const c of CITIES) {
      const n = counts[c.id] ?? 0
      if (!best || n > best.n) best = { city: c, n }
    }
    return best?.n ? best.city : null
  }, [counts])

  const goToCity = (city: City) => {
    navigate(`/projects?q=${encodeURIComponent(city.name)}`)
  }

  return (
    <div className="relative w-full h-[500px] bg-[#0A0F1D] rounded-[40px] border border-white/5 overflow-hidden group shadow-2xl">

      {/* ── BACKGROUND GRID & DECOR ────────────────────────── */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(circle, #1628A9 1px, transparent 1px)',
        backgroundSize: '30px 30px'
      }} />
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-rihla/10 via-transparent to-amber-500/5" />

      {/* ── STYLIZED MOROCCO OUTLINE (SVG) ─────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center p-12">
        <svg viewBox="0 0 500 500" className="w-full h-full text-white/5 fill-current">
          <path d="M150,50 L350,20 L480,100 L450,250 L480,450 L300,480 L100,450 L50,300 L80,150 Z" />
        </svg>
      </div>

      {/* ── ANIMATED CONNECTION PATHS ──────────────────────── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1628A9" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
            <stop offset="100%" stopColor="#1628A9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 125 350 Q 175 365 225 375" fill="none" stroke="url(#pathGradient)" strokeWidth="2" strokeDasharray="5,5" className="animate-[dash_10s_linear_infinite]" />
        <path d="M 150 200 Q 135 275 125 350" fill="none" stroke="url(#pathGradient)" strokeWidth="2" strokeDasharray="5,5" className="animate-[dash_15s_linear_infinite]" />
        <path d="M 275 175 Q 200 250 125 350" fill="none" stroke="url(#pathGradient)" strokeWidth="2" strokeDasharray="5,5" className="animate-[dash_12s_linear_infinite]" />
      </svg>

      {/* ── CITY NODES (clickable) ──────────────────────────── */}
      {CITIES.map((city) => {
        const isHovered = hoveredCity === city.id
        const count = counts[city.id] ?? 0
        return (
          <button
            key={city.id}
            type="button"
            onClick={() => goToCity(city)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group/city focus:outline-none focus-visible:ring-2 focus-visible:ring-rihla rounded-full"
            style={{ left: `${city.x}%`, top: `${city.y}%` }}
            onMouseEnter={() => setHoveredCity(city.id)}
            onMouseLeave={() => setHoveredCity(null)}
            aria-label={`Filtrer les projets sur ${city.name}`}
          >
            {/* Pulse Effect */}
            <div className={clsx(
              "absolute inset-0 rounded-full animate-ping opacity-20",
              city.status === 'high' ? "bg-cyan-400" : "bg-rihla-light"
            )} style={{ animationDuration: '3s' }} />

            {/* Node */}
            <div className={clsx(
              "relative w-4 h-4 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all",
              isHovered ? "scale-150 bg-white" : city.status === 'high' ? "bg-cyan-400" : "bg-rihla"
            )} />

            {/* Count badge — visible if count > 0 */}
            {count > 0 && (
              <div className={clsx(
                "absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-rihla text-[9px] font-bold text-white flex items-center justify-center shadow-lg ring-2 ring-[#0A0F1D] transition-transform",
                isHovered ? "scale-110" : ""
              )}>
                {count}
              </div>
            )}

            {/* Label */}
            <div className={clsx(
              "absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all",
              isHovered ? "opacity-100 translate-y-0" : "opacity-60 translate-y-1"
            )}>
              <span className="text-[10px] font-bold text-white uppercase tracking-tighter drop-shadow-lg">
                {city.name}
              </span>
            </div>

            {/* City Info Card (Glassmorphic) */}
            <div className={clsx(
              "absolute bottom-8 left-1/2 -translate-x-1/2 w-52 p-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 z-50 pointer-events-none text-left",
              isHovered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
            )}>
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-xs font-bold text-white uppercase">{city.name}</h4>
                <div className="px-2 py-0.5 rounded bg-white/10 text-[8px] font-bold text-cyan-400 uppercase">Live</div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Projets</span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full transition-all" style={{ width: count > 0 ? `${Math.min(100, count * 18)}%` : '6%' }} />
                </div>
                <div className="flex items-center justify-between gap-1 mt-2 text-[10px] text-rihla-light font-semibold uppercase">
                  <span className="flex items-center gap-1"><Navigation size={10} /> Voir projets</span>
                  <ArrowRight size={10} />
                </div>
              </div>
            </div>
          </button>
        )
      })}

      {/* ── MAP OVERLAYS ───────────────────────────────────── */}
      <div className="absolute top-8 left-8 flex flex-col gap-4">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <h3 className="text-[10px] font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            <MapPin size={12} className="text-rihla-light" /> Réseau de Destination
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-[9px] font-semibold text-slate-400 uppercase">Hubs Stratégiques</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rihla" />
              <span className="text-[9px] font-semibold text-slate-400 uppercase">Villes Étapes</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-white/5 mt-2">
              <div className="w-3 h-3 rounded-full bg-rihla flex items-center justify-center text-[7px] text-white font-bold">N</div>
              <span className="text-[9px] font-semibold text-slate-400 uppercase">Projets actifs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top destination card (interactive) */}
      <button
        type="button"
        onClick={() => topCity && goToCity(topCity)}
        disabled={!topCity}
        className={clsx(
          "absolute bottom-8 right-8 group/top transition-transform",
          topCity ? "hover:scale-[1.02] cursor-pointer" : "opacity-60 cursor-default"
        )}
      >
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#1628A9]/20 border border-rihla/30 backdrop-blur-md">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white">
            <Star size={20} className="text-amber-400 fill-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-white uppercase">Destination Top</p>
            <p className="text-sm font-bold text-rihla-light uppercase tracking-tighter">
              {topCity ? topCity.name : '—'}
            </p>
          </div>
          {topCity && (
            <ArrowRight size={14} className="text-rihla-light opacity-0 group-hover/top:opacity-100 transition-opacity" />
          )}
        </div>
      </button>

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
      `}</style>
    </div>
  )
}

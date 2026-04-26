import { useMemo } from 'react'
import { Navigation, ShieldCheck, Map as MapIcon, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'

interface CityPoint {
  id: string
  name: string
  x: number // 0-100 percentage (approx map coordinate)
  y: number // 0-100 percentage (approx map coordinate)
}

// ── COORDONNÉES RÉELLES APPROXIMATIVES (MAROC) ───────────────────────
const CITY_DATABASE: Record<string, { x: number; y: number }> = {
  'Casablanca': { x: 28, y: 34 },
  'Rabat':      { x: 32, y: 28 },
  'Tanger':     { x: 36, y: 12 },
  'Fès':        { x: 45, y: 32 },
  'Meknès':     { x: 40, y: 33 },
  'Marrakech':  { x: 32, y: 58 },
  'Essaouira':  { x: 22, y: 62 },
  'Agadir':     { x: 24, y: 75 },
  'Ouarzazate': { x: 44, y: 64 },
  'Merzouga':   { x: 68, y: 56 },
  'Erfoud':     { x: 65, y: 52 },
  'Chefchaouen':{ x: 40, y: 18 },
  'Dakhla':     { x: 10, y: 95 },
}

interface ItineraryDay {
  day_number: number
  city?: string
}

export function ItineraryMap({ days = [] }: { days?: ItineraryDay[] }) {
  // Extract unique cities in order of travel
  const travelCities = useMemo(() => {
    const cities: CityPoint[] = []
    const seen = new Set<string>()
    
    days.forEach(d => {
      if (d.city && CITY_DATABASE[d.city] && !seen.has(d.city)) {
        cities.push({
          id: d.city,
          name: d.city,
          ...CITY_DATABASE[d.city]
        })
        seen.add(d.city)
      }
    })
    
    // Fallback if no cities found in database
    if (cities.length === 0) {
      return [
        { id: 'cas', name: 'Casablanca', x: 28, y: 34 },
        { id: 'mar', name: 'Marrakech',  x: 32, y: 58 },
      ]
    }
    return cities
  }, [days])

  const pathData = useMemo(() => {
    return travelCities.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  }, [travelCities])

  return (
    <div className="bg-slate-900 rounded-[48px] border border-white/5 overflow-hidden shadow-2xl relative h-[600px] group">
      
      {/* ── MAP OVERLAY ────────────────────────────────────────── */}
      <div className="absolute top-10 left-10 z-10 space-y-6 max-w-xs">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 p-8 rounded-[32px] shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-rihla/20 text-rihla flex items-center justify-center">
              <Navigation size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider leading-none mb-1">Étapes du Circuit</h3>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{travelCities.length} Villes Clés</p>
            </div>
          </div>
          
          <div className="space-y-4">
             {travelCities.map((city, i) => (
               <div key={city.id} className="flex items-center gap-4 group/item cursor-pointer">
                 <div className="w-6 h-6 rounded-lg border border-rihla/50 flex items-center justify-center text-[10px] font-black text-white bg-slate-800 group-hover/item:bg-rihla transition-all">
                   {i + 1}
                 </div>
                 <span className="text-xs font-bold text-white/60 group-hover/item:text-white transition-colors">{city.name}</span>
                 {i < travelCities.length - 1 && <ArrowRight size={12} className="text-white/10 ml-auto" />}
               </div>
             ))}
          </div>
        </div>

        <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 px-6 py-4 rounded-2xl flex items-center gap-4 w-fit">
          <ShieldCheck className="text-emerald-400" size={20} />
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Zone Opérationnelle S'TOURS</p>
        </div>
      </div>

      {/* ── THE SVG MAP ────────────────────────────────────────── */}
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full object-contain p-20"
      >
        {/* Simplified Morocco Outline (Stylized) */}
        <path 
          d="M 15 25 L 35 15 L 70 20 L 85 45 L 75 75 L 50 90 L 25 80 L 10 50 Z" 
          className="fill-slate-800/40 stroke-white/5 stroke-[0.3]"
        />

        {/* The Connection Path */}
        <path 
          d={pathData} 
          fill="none" 
          stroke="url(#mapGradient)" 
          strokeWidth="0.6" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeDasharray="2 1"
          className="animate-pulse"
        />

        <defs>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C5A059" />
            <stop offset="100%" stopColor="#8B6E3D" />
          </linearGradient>
        </defs>

        {/* City Markers */}
        {travelCities.map((city, i) => (
          <g key={city.id} className="cursor-pointer group/marker">
            <circle cx={city.x} cy={city.y} r="2.5" className="fill-rihla/10 animate-ping" />
            <circle cx={city.x} cy={city.y} r="0.8" className="fill-rihla shadow-2xl" />
            
            <text 
              x={city.x + 2} 
              y={city.y + 0.5} 
              className="fill-white/30 text-[2px] font-black uppercase tracking-widest group-hover/marker:fill-white transition-colors"
              style={{ pointerEvents: 'none' }}
            >
              {city.name}
            </text>
          </g>
        ))}
      </svg>

      {/* ── MAP FOOTER ────────────────────────────────────────── */}
      <div className="absolute bottom-10 right-10">
        <button className="px-8 py-4 bg-white text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl hover:-translate-y-1 transition-all">
          <MapIcon size={16} /> Vue Interactive HD
        </button>
      </div>

    </div>
  )
}

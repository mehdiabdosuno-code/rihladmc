import { useState, useEffect, useRef } from 'react'
import { 
  Sparkles, Wand2, MapPin, Calendar, 
  Hotel, Utensils, ArrowRight, RefreshCw,
  Save, Download, Info, ChevronRight, Send,
  Maximize2, Share2, Trash2, Edit3, Image as ImageIcon
} from 'lucide-react'
import { aiApi } from '@/lib/api'
import { clsx } from 'clsx'

// ── Types & Constants ─────────────────────────────────────────────
interface Day {
  day: number
  city: string
  hotel: string
  activities: string
  type?: 'culture' | 'nature' | 'relax' | 'adventure'
}

const CITY_COORDS: Record<string, [number, number]> = {
  'Casablanca': [28, 32],
  'Rabat': [33, 24],
  'Tanger': [42, 5],
  'Chefchaouen': [46, 12],
  'Fès': [48, 28],
  'Meknès': [44, 30],
  'Marrakech': [25, 62],
  'Ouarzazate': [38, 70],
  'Merzouga': [68, 75],
  'Erfoud': [65, 70],
  'Essaouira': [10, 65],
  'Agadir': [15, 82],
  'Dades': [45, 68],
  'Ait Ben Haddou': [35, 68],
}

// ── Components ───────────────────────────────────────────────────

/**
 * A beautiful SVG Map of Morocco with dynamic path drawing
 */
function MoroccoMap({ path }: { path: string[] }) {
  const points = path.map(city => CITY_COORDS[city] || [Math.random()*80, Math.random()*80])
  
  return (
    <div className="relative w-full aspect-[4/5] bg-ink rounded-3xl overflow-hidden shadow-2xl border border-white/10 group">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
        backgroundSize: '30px 30px'
      }} />
      
      <svg viewBox="0 0 100 120" className="absolute inset-0 w-full h-full p-12 drop-shadow-2xl">
        {/* Simple Morocco Outline (Abstract) */}
        <path 
          d="M30 5 L60 10 L80 40 L75 90 L60 110 L20 100 L5 80 L10 40 Z" 
          className="fill-white/5 stroke-white/10 stroke-[0.5]"
        />
        
        {/* Circuit Path Line */}
        {points.length > 1 && (
          <path 
            d={`M ${points.map(p => `${p[0]} ${p[1]}`).join(' L ')}`}
            className="fill-none stroke-klein stroke-[1] stroke-dasharray-[2] animate-dash"
            strokeDasharray="2 2"
          />
        )}

        {/* City Points */}
        {points.map((p, i) => (
          <g key={i} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
            <circle cx={p[0]} cy={p[1]} r="1.5" className="fill-klein shadow-lg" />
            <circle cx={p[0]} cy={p[1]} r="4" className="fill-klein/20 animate-ping" />
            {/* City Label if first/last or current */}
            {(i === 0 || i === points.length - 1) && (
              <text x={p[0] + 3} y={p[1] + 1} className="fill-white/40 text-[3px] font-black uppercase">
                {path[i]}
              </text>
            )}
          </g>
        ))}
      </svg>
      
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Visualisation Géo-IA</p>
          <p className="text-sm font-bold text-cream">Tracé de l'itinéraire</p>
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 border border-white/10">
            <Maximize2 size={14} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function CircuitGeneratorPage() {
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(8)
  const [itinerary, setItinerary] = useState<Day[]>([])
  const [loading, setLoading] = useState(false)
  const [streamingIndex, setStreamingIndex] = useState(-1)
  
  // Ref for auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleGenerate = async () => {
    if (!prompt) return
    setLoading(true)
    setItinerary([])
    setStreamingIndex(-1)
    
    try {
      const fullPrompt = `Génère un circuit touristique au Maroc de ${duration} jours. 
      BRIEF : "${prompt}"
      Réponds UNIQUEMENT en JSON : [{"day":1,"city":"...","hotel":"...","activities":"...","type":"culture|nature|relax|adventure"}]`

      const res = await aiApi.generate(fullPrompt)
      const content = res.data?.content || ''
      const jsonStr = content.match(/\[[\s\S]*\]/)?.[0] || '[]'
      const data: Day[] = JSON.parse(jsonStr)
      
      // Simulate Streaming Effect for "State of the Art" feel
      setItinerary(data)
      for (let i = 0; i < data.length; i++) {
        await new Promise(r => setTimeout(r, 200))
        setStreamingIndex(i)
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const cityPath = itinerary.slice(0, streamingIndex + 1).map(d => d.city)

  return (
    <div className="min-h-screen bg-[#FDFCF0] dark:bg-slate-950 transition-colors selection:bg-klein selection:text-white">
      
      <div className="max-w-[1600px] mx-auto h-screen flex flex-col">
        
        {/* ── TOP NAV ─────────────────────────────────────────── */}
        <header className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-klein flex items-center justify-center text-white shadow-lg shadow-klein/20">
                <Sparkles size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black text-ink tracking-tight">Circuit Designer <span className="text-klein">Pro</span></h1>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ollama Local Engine Active</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 hover:text-ink transition-colors">
              <Share2 size={14} /> Partager
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <button 
              disabled={itinerary.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-ink text-cream text-xs font-black rounded-xl shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <Save size={14} /> DÉPLOYER LE PROJET
            </button>
          </div>
        </header>

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        <main className="flex-1 flex overflow-hidden">
          
          {/* Left Side: Brief & Configuration */}
          <section className="w-[400px] border-r border-slate-200 p-8 flex flex-col bg-white overflow-y-auto">
            <div className="flex-1 space-y-8">
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Paramètres du Concept</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-ink flex justify-between">
                      Durée du séjour
                      <span className="text-klein">{duration} jours</span>
                    </label>
                    <input 
                      type="range" min="1" max="21" value={duration}
                      onChange={e => setDuration(parseInt(e.target.value))}
                      className="w-full accent-klein"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-left hover:border-klein transition-all">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Passagers</p>
                      <p className="text-xs font-bold text-ink">Individuel / VIP</p>
                    </button>
                    <button className="p-3 rounded-xl border border-klein bg-klein/5 text-left transition-all">
                      <p className="text-[9px] font-black text-klein/60 uppercase mb-1">Passagers</p>
                      <p className="text-xs font-bold text-ink">Groupe (20+)</p>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Le Brief Créatif</h3>
                <div className="relative">
                  <textarea 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Décrivez votre vision... ex: 'Un voyage spirituel à travers le Haut-Atlas, finissant par une retraite de yoga à Essaouira.'"
                    className="w-full h-48 p-6 bg-slate-50 rounded-2xl text-sm leading-relaxed border-none focus:ring-2 focus:ring-klein/20 outline-none transition-all placeholder:text-slate-300 italic"
                  />
                  <div className="absolute bottom-4 right-4 text-[10px] font-bold text-slate-300">
                    {prompt.length} caractères
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="mt-8 w-full py-5 bg-klein text-white rounded-2xl font-black text-sm shadow-2xl shadow-klein/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden relative"
            >
              {loading && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <Wand2 size={20} />}
              DÉMARRER LA GÉNÉRATION IA
            </button>
          </section>

          {/* Center: Interactive Timeline (The "Stream") */}
          <section className="flex-1 flex flex-col bg-slate-50 relative">
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-12 space-y-12 scroll-smooth"
            >
              {itinerary.length > 0 ? (
                itinerary.map((day, idx) => (
                  <div 
                    key={idx} 
                    className={clsx(
                      "flex gap-12 transition-all duration-700 transform",
                      idx <= streamingIndex ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                    )}
                  >
                    <div className="w-16 flex flex-col items-center">
                      <div className={clsx(
                        "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all duration-500",
                        idx === streamingIndex ? "bg-klein text-white scale-110 shadow-xl" : "bg-white text-slate-300 border border-slate-200"
                      )}>
                        {day.day}
                      </div>
                      {idx < itinerary.length - 1 && (
                        <div className="w-0.5 flex-1 bg-slate-200 my-4" />
                      )}
                    </div>
                    <div className="flex-1 pb-12">
                      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 group hover:border-klein/30 transition-all cursor-default">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin size={14} className="text-rihla" />
                              <h4 className="text-xl font-bold text-ink">{day.city}</h4>
                            </div>
                            <div className="flex gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-wider">{day.type || 'Culture'}</span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-[9px] font-black text-emerald-700 uppercase tracking-wider">Hébergement Garanti</span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-ink"><Edit3 size={16} /></button>
                            <button className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <p className="text-xs text-slate-500 leading-relaxed italic mb-4">"{day.activities}"</p>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <Hotel size={18} className="text-klein" />
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hébergement suggéré</p>
                                <p className="text-xs font-bold text-ink">{day.hotel}</p>
                              </div>
                            </div>
                          </div>
                          <div className="relative aspect-video rounded-2xl bg-slate-100 overflow-hidden group/img">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 flex items-center justify-center text-slate-200">
                              <ImageIcon size={32} className="group-hover/img:scale-110 transition-transform" />
                            </div>
                            <p className="absolute bottom-3 left-3 text-[10px] font-black text-white uppercase tracking-widest opacity-0 group-hover/img:opacity-100">Vue de {day.city}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                  <div className="w-24 h-24 rounded-full bg-white shadow-inner flex items-center justify-center mb-8 relative">
                    <Wand2 size={40} className="text-slate-100" />
                    <div className="absolute inset-0 border-2 border-dashed border-slate-100 rounded-full animate-[spin_10s_linear_infinite]" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-400 mb-3">En attente de votre génie créatif</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">Saisissez un brief à gauche. L'IA va concevoir un itinéraire structuré, calculer les étapes et suggérer les meilleurs hôtels de notre base.</p>
                </div>
              )}
            </div>

            {/* Visual Map Sidecar */}
            <div className="absolute top-8 right-8 w-72">
              <MoroccoMap path={cityPath} />
            </div>
          </section>

        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dash {
          to { stroke-dashoffset: 0; }
        }
        .animate-dash {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: dash 3s ease-out forwards;
        }
      `}} />
    </div>
  )
}

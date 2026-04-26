import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus, Sparkles, Save, Trash2, ChevronDown, ChevronUp, 
  RefreshCw, GripVertical, MapPin, Hotel, Utensils, Clock,
  Brain, Zap, Wand2, Info, CheckCircle, MessageSquare, ShieldAlert,
  Image as ImageIcon, X, GraduationCap, Trophy, AlertTriangle, TrendingUp
} from 'lucide-react'
import { itinerariesApi, projectsApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner, SectionTitle, Badge } from '@/components/ui'
import { clsx } from 'clsx'
import { AssetLibrary } from '@/components/studio/AssetLibrary'

// ── Types ─────────────────────────────────────────────────────────
interface Day {
  id?: string
  day_number: number
  title: string
  subtitle?: string
  city?: string
  description?: string
  hotel?: string
  hotel_category?: string
  meal_plan?: string
  travel_time?: string
  activities?: string[]
  ai_generated?: boolean
  ai_prompt?: string  // local only
  ai_loading?: boolean // local only
  guide_note?: string  // private for guide
  image_url?: string
}

const MEAL_PLANS = ['BB', 'HB', 'FB', 'AO']
const HOTEL_CATS = ['5★', '4★', '3★', 'Riad', 'Maison d\'hôtes']
const TONES = [
  { value: 'premium', label: '✦ Premium' },
  { value: 'luxury', label: '♛ Luxe' },
  { value: 'family', label: '☀ Famille' },
  { value: 'adventure', label: '⛰ Aventure' },
]

// ── Day Card ──────────────────────────────────────────────────────
function DayCard({
  day, idx, onUpdate, onDelete, onGenerate,
  isDragging, onDragStart, onDragOver, onDragEnd
}: {
  day: Day
  idx: number
  onUpdate: (d: Partial<Day>) => void
  onDelete: () => void
  onGenerate: (prompt: string, tone: string, lang: string) => void
  isDragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const [expanded, setExpanded] = useState(idx === 0)
  const [tone, setTone] = useState('premium')
  const [lang, setLang] = useState('fr')
  const [prompt, setPrompt] = useState(day.ai_prompt || '')
  const [actInput, setActInput] = useState('')
  const [showAssetLibrary, setShowAssetLibrary] = useState(false)

  const handleSelect = (url: string) => {
    onUpdate({ image_url: url })
    setShowAssetLibrary(false)
  }

  const addActivity = () => {
    if (!actInput.trim()) return
    onUpdate({ activities: [...(day.activities || []), actInput.trim()] })
    setActInput('')
  }
  const removeActivity = (i: number) =>
    onUpdate({ activities: (day.activities || []).filter((_, j) => j !== i) })

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={clsx(
        "card overflow-hidden transition-all duration-200 border-l-4",
        expanded ? "shadow-float border-l-bordeaux" : "border-l-transparent",
        isDragging ? "opacity-40 scale-[0.98] rotate-1 shadow-none" : "opacity-100"
      )}
    >
      {/* Header / Handle */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-warm/40 transition-colors border-b border-line"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-muted/40 cursor-grab active:cursor-grabbing hover:text-bordeaux transition-colors p-1 -ml-2">
          <GripVertical size={18} />
        </div>

        <div className="w-8 h-8 rounded-full bg-slate-900 text-cream flex items-center justify-center text-xs font-black flex-shrink-0 shadow-sm">
          {day.day_number}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] text-slate-800 truncate">
            {day.title || `Jour ${day.day_number}`}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            {day.city && (
              <span className="text-[11px] text-muted flex items-center gap-1">
                <MapPin size={10} className="text-bordeaux" /> {day.city}
              </span>
            )}
            {day.hotel && (
              <span className="text-[11px] text-muted flex items-center gap-1">
                <Hotel size={10} /> {day.hotel}
              </span>
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {day.meal_plan && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
              {day.meal_plan}
            </span>
          )}
          {day.ai_generated && (
            <span className="text-[10px] bg-royal/10 text-royal px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Sparkles size={9} /> CLAUDE AI
            </span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-muted/40 hover:text-red-500 transition-all ml-2">
            <Trash2 size={15} />
          </button>
          <div className="ml-2">
            {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
          </div>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-6 space-y-6 bg-white">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block">Titre de l'étape</label>
                  <input className="input-base" placeholder="ex: Arrivée à Casablanca"
                    value={day.title}
                    onChange={e => onUpdate({ title: e.target.value })} />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block">Destination / Ville</label>
                  <input className="input-base" placeholder="ex: Marrakech"
                    value={day.city || ''}
                    onChange={e => onUpdate({ city: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block">Sous-titre / Focus</label>
                  <input className="input-base" placeholder="ex: Découverte de la médina"
                    value={day.subtitle || ''}
                    onChange={e => onUpdate({ subtitle: e.target.value })} />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block">Logistique & Temps</label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-3 text-muted" />
                    <input className="input-base pl-9" placeholder="ex: 3h de route"
                      value={day.travel_time || ''}
                      onChange={e => onUpdate({ travel_time: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block">Narratif détaillé</label>
                <div className="flex gap-4 mb-3">
                   <div className="w-32 h-32 rounded-2xl bg-slate-100 dark:bg-white/5 border border-dashed border-line dark:border-white/10 flex flex-col items-center justify-center relative overflow-hidden group">
                      {day.image_url ? (
                         <>
                            <img src={day.image_url} className="w-full h-full object-cover" alt="Selected asset" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <button onClick={() => setShowAssetLibrary(true)} className="p-2 bg-white rounded-full text-slate-900 shadow-xl"><RefreshCw size={14} /></button>
                            </div>
                         </>
                      ) : (
                         <button 
                           onClick={() => setShowAssetLibrary(true)}
                           className="flex flex-col items-center gap-1 text-slate-400 hover:text-rihla transition-colors"
                         >
                            <ImageIcon size={20} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Studio Photo</span>
                         </button>
                      )}
                   </div>
                   <textarea
                     className="flex-1 input-base min-h-[128px] leading-relaxed"
                     placeholder="Racontez l'expérience du voyageur..."
                     value={day.description || ''}
                     onChange={e => onUpdate({ description: e.target.value, ai_generated: false })}
                   />
                </div>
              </div>

              {showAssetLibrary && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                   <div className="w-full max-w-lg relative">
                      <button onClick={() => setShowAssetLibrary(false)} className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white transition-colors bg-white/10 rounded-full"><X size={20} /></button>
                      <AssetLibrary onSelect={handleSelect} />
                   </div>
                </div>
              )}

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                 <label className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-2">
                    <ShieldAlert size={12} /> Note Privée pour le Guide
                 </label>
                 <textarea
                   className="w-full bg-transparent border-none text-xs text-amber-900 placeholder:text-amber-300 focus:ring-0 p-0"
                   rows={2}
                   placeholder="Ex: Le client est fan de photo, suggérez-lui le spot X pour le coucher de soleil..."
                   value={day.guide_note || ''}
                   onChange={e => onUpdate({ guide_note: e.target.value })}
                 />
              </div>
            </div>

            <div className="col-span-4 space-y-5">
              <div className="p-4 bg-slate-50 rounded-xl border border-line space-y-4">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 mb-2 block">Hébergement</label>
                  <input className="input-base mb-2" placeholder="Hôtel / Riad"
                    value={day.hotel || ''}
                    onChange={e => onUpdate({ hotel: e.target.value })} />
                  <select className="input-base text-xs" value={day.hotel_category || ''}
                    onChange={e => onUpdate({ hotel_category: e.target.value })}>
                    <option value="">Catégorie...</option>
                    {HOTEL_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 mb-2 block">Restauration</label>
                  <div className="flex gap-1">
                    {MEAL_PLANS.map(m => (
                      <button key={m} onClick={() => onUpdate({ meal_plan: day.meal_plan === m ? undefined : m })}
                        className={clsx(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all border",
                          day.meal_plan === m ? "bg-slate-900 border-slate-900 text-cream" : "bg-white border-line text-muted hover:border-slate-300"
                        )}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-royal/5 border border-royal/10 rounded-xl space-y-3">
                <p className="text-[11px] font-black text-royal uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={13} /> Rédaction Assistée
                </p>
                <div className="flex gap-1">
                  {TONES.map(t => (
                    <button key={t.value} onClick={() => setTone(t.value)}
                      className={clsx(
                        "px-2 py-1 rounded-md text-[9px] font-bold transition-all border",
                        tone === t.value ? "bg-royal text-white border-royal" : "bg-white border-royal/20 text-royal/60"
                      )}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input-base text-[11px] border-royal/10"
                  rows={2}
                  placeholder="Points clés pour l'IA..."
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
                <button
                  onClick={() => { onGenerate(prompt || `Jour ${day.day_number} ${day.city || ''}`, tone, lang); setPrompt('') }}
                  disabled={day.ai_loading}
                  className="btn-primary w-full py-2 text-[10px] uppercase font-black tracking-widest bg-royal hover:bg-royal-600 shadow-royal/20"
                >
                  {day.ai_loading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Générer le texte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export function ItineraryPage() {
  const qc = useQueryClient()
  const [projectId, setProjectId] = useState('')
  const [itineraryId, setItineraryId] = useState('')
  const [language, setLanguage] = useState('fr')
  const [days, setDays] = useState<Day[]>([])
  const [academyMode, setAcademyMode] = useState(false)
  const [saved, setSaved] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => r.data?.items ?? []),
  })

  const { data: existingItins, refetch: refetchItins } = useQuery({
    queryKey: ['itineraries', projectId],
    queryFn: () => itinerariesApi.byProject(projectId).then(r => r.data),
    enabled: !!projectId,
  })

  useEffect(() => {
    if (existingItins && existingItins.length > 0) {
      const itin = existingItins[0]
      setItineraryId(itin.id)
      setDays((itin.days || []).map((d: any) => ({ ...d })))
    } else if (projectId) {
      setItineraryId('')
      setDays([])
    }
  }, [existingItins, projectId])

  const addDay = () => {
    setDays(ds => [...ds, {
      day_number: ds.length + 1,
      title: '',
      activities: [],
      ai_generated: false,
    }])
  }

  const updateDay = (idx: number, patch: Partial<Day>) =>
    setDays(ds => ds.map((d, i) => i === idx ? { ...d, ...patch } : d))

  const deleteDay = async (idx: number) => {
    const dayToDelete = days[idx]
    if (dayToDelete.id && itineraryId) {
      if (!confirm('Supprimer ce jour définitivement ?')) return
      try {
        await itinerariesApi.deleteDay(itineraryId, dayToDelete.id)
      } catch (e) { }
    }
    setDays(ds => ds.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day_number: i + 1 })))
  }

  // ── Drag & Drop Logic ──────────────────────────────────────────
  const handleDragStart = (idx: number) => setDraggedIdx(idx)

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return

    setDays(ds => {
      const arr = [...ds]
      const item = arr.splice(draggedIdx, 1)[0]
      arr.splice(idx, 0, item)
      // Renumber days
      return arr.map((d, i) => ({ ...d, day_number: i + 1 }))
    })
    setDraggedIdx(idx)
  }

  const handleDragEnd = async () => {
    setDraggedIdx(null)
    if (itineraryId) {
      // Automatic background save of order
      const payload = days.filter(d => !!d.id).map(d => ({ id: d.id!, day_number: d.day_number }))
      if (payload.length > 0) {
        try {
          await itinerariesApi.reorder(itineraryId, payload)
        } catch (e) {
          console.error("Reorder failed", e)
        }
      }
    }
  }

  const generateDay = async (idx: number, prompt: string, tone: string, lang: string) => {
    const day = days[idx]
    if (!itineraryId || !day.id) {
      alert('Sauvegardez d\'abord l\'itinéraire')
      return
    }
    setDays(ds => ds.map((d, i) => i === idx ? { ...d, ai_loading: true } : d))
    try {
      const res = await itinerariesApi.generateDay(itineraryId, day.id, { tone: tone as any, language: lang as any, context: prompt })
      setDays(ds => ds.map((d, i) => i === idx ? { ...d, ...res.data, ai_loading: false } : d))
    } catch (e: any) {
      alert(`Erreur IA: ${e.response?.data?.detail || e.message}`)
      setDays(ds => ds.map((d, i) => i === idx ? { ...d, ai_loading: false } : d))
    }
  }

  const saveItinerary = async () => {
    if (!projectId) return
    try {
      if (itineraryId) {
        for (const day of days) {
          if (day.id) {
            await itinerariesApi.updateDay(itineraryId, day.id, day)
          } else {
            await itinerariesApi.addDay(itineraryId, day)
          }
        }
      } else {
        const res = await itinerariesApi.create({ project_id: projectId, language: language as any })
        setItineraryId(res.data.id)
      }
      await refetchItins()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      alert(`Erreur sauvegarde: ${e.message}`)
    }
  }

  return (
    <div className="min-h-full pb-20">
      <PageHeader
        title="Itinerary Builder"
        subtitle="Concevez l'expérience narrative jour par jour"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAcademyMode(!academyMode)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all border",
                academyMode ? "bg-amber-100 border-amber-200 text-amber-700 shadow-inner" : "bg-white dark:bg-white/5 border-line dark:border-white/10 text-slate-500 hover:text-slate-900"
              )}
            >
              <GraduationCap size={14} /> {academyMode ? "ACADEMY ON" : "ACADEMY"}
            </button>
            <button onClick={addDay} className="btn-ghost btn-sm">
              <Plus size={14} /> Nouveau jour
            </button>
            <button onClick={saveItinerary} disabled={!projectId || !days.length}
              className={clsx(
                "btn-sm transition-all min-w-[140px]",
                saved ? "bg-emerald-500 text-white" : "btn-primary"
              )}>
              {saved ? 'Enregistré ✓' : <><Save size={14} /> Sauvegarder</>}
            </button>
          </div>
        }
      />

      <div className="p-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-4 gap-6">
          {/* Project Sidebar Card */}
          <div className="col-span-1 space-y-6">
            <div className="card p-5 space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 mb-2 block">Dossier</label>
                <select className="input-base" value={projectId}
                  onChange={e => setProjectId(e.target.value)}>
                  <option value="">Projet...</option>
                  {projects?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 border-t border-line space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Statut rédaction</span>
                  <span className="text-xs font-bold">{Math.round((days.filter(d => !!d.description).length / (days.length || 1)) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(days.filter(d => !!d.description).length / (days.length || 1)) * 100}%` }} />
                </div>
                <p className="text-[10px] text-muted italic">Glissez les cartes pour réordonner les jours.</p>
              </div>
            </div>

            {academyMode && (
              <div className="bg-slate-900 rounded-3xl p-6 border border-amber-500/30 shadow-2xl shadow-amber-500/10 animate-in slide-in-from-left duration-500 mt-6">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                       <GraduationCap size={20} />
                    </div>
                    <div>
                       <h3 className="text-sm font-black text-white uppercase tracking-wider">AI Mentor</h3>
                       <p className="text-[10px] text-amber-500/60 font-bold uppercase">Training Mode</p>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Quality Score</span>
                          <span className="text-xl font-black text-amber-500">68%</span>
                       </div>
                       <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: '68%' }} />
                       </div>
                    </div>

                    <div className="space-y-3">
                       <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Conseils Expert</p>
                       {[
                         { icon: <TrendingUp size={12} />, text: "Enrichissez le narratif du Jour 2 avec plus d'adjectifs sensoriels." },
                         { icon: <Clock size={12} />, text: "Attention à la logistique : le trajet Jour 3 est trop long pour un départ à 10h." },
                         { icon: <Trophy size={12} />, text: "Ajoutez un 'Moment Signature' S'TOURS pour surprendre le client." },
                       ].map((tip, i) => (
                         <div key={i} className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-amber-500/20 transition-colors">
                            <div className="text-amber-500 shrink-0 mt-0.5">{tip.icon}</div>
                            <p className="text-[10px] text-white/70 leading-relaxed italic">{tip.text}</p>
                         </div>
                       ))}
                    </div>

                    <div className="pt-4 border-t border-white/5">
                       <button className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2">
                          <Brain size={14} className="text-amber-500" /> ANALYSE COMPLÈTE
                       </button>
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Days List */}
          <div className="col-span-2 space-y-4">
            {!projectId ? (
              <div className="card p-20 text-center border-dashed">
                <p className="text-slate-400 text-[14px]">Sélectionnez un projet pour commencer.</p>
              </div>
            ) : days.length === 0 ? (
              <button onClick={addDay} className="w-full p-20 border-2 border-dashed border-line rounded-3xl text-muted hover:border-bordeaux hover:text-bordeaux transition-all group">
                <Plus size={40} className="mx-auto mb-4 opacity-20 group-hover:opacity-100 transition-all" />
                <p className="font-bold uppercase tracking-widest text-xs">Créer le programme</p>
              </button>
            ) : (
              <div className="space-y-4">
                {days.map((day, idx) => (
                  <DayCard
                    key={day.id || `temp-${idx}`}
                    day={day}
                    idx={idx}
                    isDragging={draggedIdx === idx}
                    onUpdate={patch => updateDay(idx, patch)}
                    onDelete={() => deleteDay(idx)}
                    onGenerate={(prompt, tone, lang) => generateDay(idx, prompt, tone, lang)}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
                <button onClick={addDay} className="w-full py-4 border-2 border-dashed border-line rounded-2xl text-muted hover:border-slate-400 hover:bg-slate-50 transition-all flex justify-center items-center gap-2">
                  <Plus size={16} /> Ajouter une étape
                </button>
              </div>
            )}
          </div>

          {/* AI Copilot Sidebar */}
          <div className="col-span-1 space-y-6">
            <div className="card p-6 bg-slate-900 border-none shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform duration-700">
                <Brain size={80} className="text-rihla" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xs font-black text-rihla uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Zap size={14} fill="currentColor" /> Copilote S'TOURS
                </h3>
                <div className="space-y-4">
                  {days.length > 0 ? (
                    <>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-black text-cream uppercase tracking-widest">
                          <Sparkles size={12} className="text-rihla" /> Suggestion Immersion
                        </div>
                        <p className="text-[11px] text-white/60 leading-relaxed italic">
                          "Le jour 2 à {days[0]?.city || 'Marrakech'} manque de contact local. Suggérer une visite chez un artisan de cuir ?"
                        </p>
                        <button className="text-[9px] font-black text-rihla uppercase hover:underline">Appliquer</button>
                      </div>

                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-black text-cream uppercase tracking-widest">
                          <Clock size={12} className="text-amber-400" /> Alerte Logistique
                        </div>
                        <p className="text-[11px] text-white/60 leading-relaxed italic">
                          "Le trajet entre Casablanca et Fès semble sous-estimé. Prévoir 45 min de plus pour la pause à Rabat."
                        </p>
                      </div>

                      <div className="pt-4">
                        <button className="w-full py-3 bg-rihla text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rihla-dark transition-all">
                          <Wand2 size={14} /> Harmoniser le ton
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-white/40 italic">En attente de contenu pour analyser votre itinéraire...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="card p-6 bg-white space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Qualité Premium</h4>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-slate-800">{days.length > 0 ? '84' : '0'}</span>
                <span className="text-sm font-bold text-slate-400 mb-1">/ 100</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-rihla transition-all" style={{ width: days.length > 0 ? '84%' : '0%' }} />
              </div>
              <ul className="space-y-2 pt-2">
                <li className="flex items-center gap-2 text-[10px] text-emerald-500 font-bold uppercase">
                  <CheckCircle size={12} /> Narrative Cohérent
                </li>
                <li className="flex items-center gap-2 text-[10px] text-amber-500 font-bold uppercase">
                  <Info size={12} /> Manque d'activités "Culture"
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


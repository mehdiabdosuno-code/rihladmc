import { useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Plus, Sparkles, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { projectsApi, aiApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { clsx } from 'clsx'
import { ProjectTemplates } from '@/components/projects/ProjectTemplates'

// ── Schéma de validation Zod ──────────────────────────────────────
const projectSchema = z.object({
  name: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(120, 'Le nom ne peut pas dépasser 120 caractères'),
  client_name: z.string().max(120, 'Trop long').optional().or(z.literal('')),
  project_type: z.enum(['incentive', 'leisure', 'mice', 'fit', 'luxury'], {
    errorMap: () => ({ message: 'Sélectionnez un type de projet' }),
  }),
  destination: z.string().max(200, 'Trop long').optional().or(z.literal('')),
  duration_days: z.coerce.number().int().min(1, 'Minimum 1 jour').max(365, 'Maximum 365 jours').optional().or(z.literal('')),
  pax_count: z.coerce.number().int().min(1, 'Minimum 1 pax').max(10000, 'Maximum 10 000 pax').optional().or(z.literal('')),
  reference: z.string().max(50, 'Référence trop longue').optional().or(z.literal('')),
  notes: z.string().max(2000, 'Notes trop longues (max 2000 caractères)').optional().or(z.literal('')),
})

type ProjectFormData = z.infer<typeof projectSchema>

const PROJECT_TYPES = [
  { value: 'incentive', label: 'Incentive',  desc: 'Voyage stimulant pour équipe' },
  { value: 'leisure',   label: 'Loisirs',    desc: 'Séjour vacances / détente' },
  { value: 'mice',      label: 'MICE',       desc: 'Conférence / événement professionnel' },
  { value: 'fit',       label: 'FIT',        desc: 'Voyageur indépendant' },
  { value: 'luxury',    label: 'Luxe',       desc: 'Haut de gamme / premium' },
] as const

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-red-500">
      <AlertCircle size={11} /> {message}
    </p>
  )
}

export function ProjectCreatePage() {
  const navigate = useNavigate()
  const [showBriefInput, setShowBriefInput] = useState(false)
  const [briefText, setBriefText] = useState('')
  const [showTemplates, setShowTemplates] = useState(true)
  const [magicLoading, setMagicLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_type: 'leisure',
      name: '',
      client_name: '',
      destination: '',
      duration_days: '',
      pax_count: '',
      reference: '',
      notes: '',
    },
  })

  const selectedType = watch('project_type')

  // Speech Recognition
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    recognitionRef.current = new SR()
    recognitionRef.current.continuous = true
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = 'fr-FR'
    recognitionRef.current.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript).join('')
      setBriefText(transcript)
    }
    recognitionRef.current.onerror = () => setIsRecording(false)
  }, [])

  useEffect(() => {
    isRecording ? recognitionRef.current?.start() : recognitionRef.current?.stop()
  }, [isRecording])

  const handleMagicExtract = async () => {
    if (!briefText.trim()) return
    setMagicLoading(true)
    try {
      const res = await aiApi.magicExtract(briefText)
      const d = res.data
      if (d.name)         setValue('name', d.name, { shouldValidate: true })
      if (d.client_name)  setValue('client_name', d.client_name, { shouldValidate: true })
      if (d.project_type) setValue('project_type', d.project_type, { shouldValidate: true })
      if (d.destination)  setValue('destination', d.destination, { shouldValidate: true })
      if (d.duration_days) setValue('duration_days', d.duration_days, { shouldValidate: true })
      if (d.pax_count)    setValue('pax_count', d.pax_count, { shouldValidate: true })
      if (d.notes)        setValue('notes', d.notes, { shouldValidate: true })
      setShowBriefInput(false)
    } catch {
      alert("L'assistant magique a rencontré une erreur.")
    } finally {
      setMagicLoading(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => projectsApi.create(data),
    onSuccess: (res) => navigate(`/projects/${res.data.id}`),
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      alert(`Erreur: ${Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : detail || 'Impossible de créer le projet'}`)
    },
  })

  const handleTemplateSelect = (tpl: any) => {
    if (tpl.name) setValue('name', `[TEMPLATE] ${tpl.name}`, { shouldValidate: true })
    if (tpl.type) setValue('project_type', tpl.type, { shouldValidate: true })
    if (tpl.duration) setValue('duration_days', tpl.duration, { shouldValidate: true })
    if (tpl.pax) setValue('pax_count', tpl.pax, { shouldValidate: true })
    if (tpl.destinations) setValue('destination', tpl.destinations, { shouldValidate: true })
    if (tpl.description) setValue('notes', tpl.description, { shouldValidate: true })
    setShowTemplates(false)
  }

  const onSubmit = (data: ProjectFormData) => {
    const payload = {
      ...data,
      duration_days: data.duration_days ? Number(data.duration_days) : undefined,
      pax_count: data.pax_count ? Number(data.pax_count) : undefined,
      client_name: data.client_name || undefined,
      destination: data.destination || undefined,
      reference: data.reference || undefined,
      notes: data.notes || undefined,
    }
    createMutation.mutate(payload)
  }

  return (
    <div className="min-h-full">
      <div className="mb-6 flex items-center gap-2 text-xs text-slate">
        <Link to="/projects" className="hover:text-rihla transition-colors flex items-center gap-1">
          <ArrowLeft size={12} /> Projets
        </Link>
        <span className="text-line">/</span>
        <span className="text-ink font-medium">Nouveau projet</span>
      </div>

      <PageHeader
        title="Créer un nouveau projet"
        subtitle="Remplissez les informations de base du projet. Vous pourrez les modifier ultérieurement."
      />

      {/* ── MAGIC ASSISTANT ───────────────────────────────────────────── */}
      <div className="px-8 mt-2 mb-6 space-y-6">
        {/* ── TEMPLATES (Prop 2) ────────────────────────────────────────── */}
        {showTemplates && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <ProjectTemplates onSelect={handleTemplateSelect} />
            <div className="mt-4 flex justify-center">
               <button 
                 onClick={() => setShowTemplates(false)}
                 className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rihla transition-colors"
               >
                 Ou commencer un projet de zéro
               </button>
            </div>
          </div>
        )}

        {/* ── MAGIC ASSISTANT ───────────────────────────────────────────── */}
        <div className="p-6 rounded-[32px] bg-gradient-to-br from-ink to-[#1a1a2e] border border-white/10 shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={120} className="text-amber-400 rotate-12" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center text-ink shadow-lg shadow-amber-400/20">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-white font-black text-lg tracking-tight">Assistant Magique</h3>
                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Extraction IA depuis votre brief</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <p className="text-white/70 text-xs leading-relaxed">Parlez ou collez votre brief client. L'IA extrait les informations et remplit le formulaire.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsRecording(!isRecording)}
                    className={clsx("flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                      isRecording ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white hover:bg-white/20")}>
                    <div className={clsx("w-2 h-2 rounded-full", isRecording ? "bg-white" : "bg-red-500")} />
                    {isRecording ? 'Écoute...' : 'Dicter'}
                  </button>
                  <button type="button" onClick={() => setShowBriefInput(!showBriefInput)}
                    className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all">
                    Coller un texte
                  </button>
                </div>
              </div>
              {(showBriefInput || briefText) && (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <textarea value={briefText} onChange={e => setBriefText(e.target.value)}
                    placeholder="Brief client..." rows={4}
                    className="w-full bg-transparent border-none text-white text-xs placeholder:text-white/20 resize-none focus:outline-none" />
                  <div className="flex justify-end mt-2">
                    <button type="button" disabled={!briefText.trim() || magicLoading} onClick={handleMagicExtract}
                      className="px-4 py-2 bg-amber-400 text-ink text-[10px] font-black uppercase rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                      {magicLoading ? 'Analyse IA...' : 'Extraire les données'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FORMULAIRE ────────────────────────────────────────────────── */}
      <div className="p-8 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

          {/* Nom */}
          <div>
            <label className="text-label text-slate block mb-2 font-bold">
              Nom du projet <span className="text-red-500">*</span>
            </label>
            <input {...register('name')}
              placeholder="ex: INCENTIVE PARIS 2026, ESO TRAVEL MAROC…"
              className={clsx("input-base", errors.name && "border-red-400 focus:ring-red-500/20")}
              autoFocus />
            <FieldError message={errors.name?.message} />
          </div>

          {/* Client */}
          <div>
            <label className="text-label text-slate block mb-2 font-bold">Nom du client</label>
            <input {...register('client_name')}
              placeholder="ex: TechCorp, Les Voyageurs…"
              className={clsx("input-base", errors.client_name && "border-red-400")} />
            <FieldError message={errors.client_name?.message} />
          </div>

          {/* Type */}
          <div>
            <label className="text-label text-slate block mb-3 font-bold">
              Type de projet <span className="text-red-500">*</span>
            </label>
            <Controller name="project_type" control={control} render={({ field }) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROJECT_TYPES.map(pt => (
                  <label key={pt.value}
                    className={clsx("flex items-center gap-3 p-4 rounded-card border-2 cursor-pointer transition-all",
                      field.value === pt.value ? "border-rihla bg-rihla-50" : "border-line bg-white hover:border-rihla/30")}>
                    <input type="radio" value={pt.value} checked={field.value === pt.value}
                      onChange={() => field.onChange(pt.value)} className="w-4 h-4" />
                    <div>
                      <div className="font-bold text-sm text-ink">{pt.label}</div>
                      <div className="text-xs text-slate">{pt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )} />
            <FieldError message={errors.project_type?.message} />
          </div>

          {/* Destination */}
          <div>
            <label className="text-label text-slate block mb-2 font-bold">Destination</label>
            <input {...register('destination')} placeholder="ex: Maroc, Dubai, Afrique du Sud…" className="input-base" />
            <FieldError message={errors.destination?.message} />
          </div>

          {/* Durée & Pax */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-label text-slate block mb-2 font-bold">Durée (jours)</label>
              <input {...register('duration_days')} type="number" placeholder="ex: 7" min={1} max={365} className="input-base" />
              <FieldError message={errors.duration_days?.message} />
            </div>
            <div>
              <label className="text-label text-slate block mb-2 font-bold">Nb. participants</label>
              <input {...register('pax_count')} type="number" placeholder="ex: 25" min={1} className="input-base" />
              <FieldError message={errors.pax_count?.message} />
            </div>
          </div>

          {/* Référence */}
          <div>
            <label className="text-label text-slate block mb-2 font-bold">Référence interne</label>
            <input {...register('reference')} placeholder="ex: REF-2026-001" className="input-base" />
            <p className="text-xs text-fog mt-1">Auto-générée si vide</p>
            <FieldError message={errors.reference?.message} />
          </div>

          {/* Notes */}
          <div>
            <label className="text-label text-slate block mb-2 font-bold">
              Notes internes
              <span className="ml-2 text-[10px] font-normal text-slate-400 normal-case">
                {watch('notes')?.length || 0}/2000
              </span>
            </label>
            <textarea {...register('notes')} placeholder="Informations additionnelles, contexte…"
              className={clsx("input-base resize-none", errors.notes && "border-red-400")} rows={4} />
            <FieldError message={errors.notes?.message} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-line">
            <button type="submit" disabled={isSubmitting || createMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-rihla text-cream rounded-brand font-bold hover:bg-rihla-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm">
              <Plus size={16} />
              {createMutation.isPending ? 'Création…' : 'Créer le projet'}
            </button>
            <Link to="/projects"
              className="flex items-center gap-2 px-6 py-3 bg-white text-ink rounded-brand font-bold border border-line hover:bg-parchment transition-colors">
              Annuler
            </Link>
          </div>

        </form>
      </div>
    </div>
  )
}

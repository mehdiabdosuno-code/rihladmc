import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Calendar, MapPin, Tag, Users, Star, Trash2, Copy, Globe2,
  Sparkles, ChevronRight,
} from 'lucide-react'
import { itineraryTemplatesApi, projectsApi } from '@/lib/api'
import type { ItineraryTemplate } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui'
import { clsx } from 'clsx'

const AUDIENCES = [
  { value: '',          label: 'Tous publics' },
  { value: 'FIT',       label: 'FIT (couples / individuels)' },
  { value: 'family',    label: 'Famille' },
  { value: 'MICE',      label: 'MICE / Corporate' },
  { value: 'luxury',    label: 'Luxe' },
  { value: 'adventure', label: 'Aventure' },
]

export function ItineraryTemplatesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [audience, setAudience] = useState('')
  const [selected, setSelected] = useState<ItineraryTemplate | null>(null)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['itinerary-templates', search, audience],
    queryFn: () => itineraryTemplatesApi.list({
      search: search || undefined,
      audience: audience || undefined,
    }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itineraryTemplatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['itinerary-templates'] })
      setSelected(null)
    },
  })

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      <PageHeader
        title="Templates de circuits"
        subtitle="Bibliothèque de circuits réutilisables — créez un dossier en 1 clic depuis un template"
        actions={
          <button
            onClick={() => navigate('/itinerary-templates/new')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-rihla text-white text-[13px] font-medium hover:bg-rihla/90 transition-colors"
          >
            <Plus size={14} strokeWidth={2.25} />
            Nouveau template
          </button>
        }
      />

      <div className="p-8 max-w-[1600px] mx-auto space-y-5">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un template…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-md focus:outline-none focus:border-rihla"
            />
          </div>
          <select
            value={audience}
            onChange={e => setAudience(e.target.value)}
            className="px-3 py-2 text-[13px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-md focus:outline-none focus:border-rihla"
          >
            {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <span className="text-[12px] text-slate-500 ml-auto">
            {templates?.length ?? 0} template{(templates?.length ?? 0) > 1 ? 's' : ''}
          </span>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : !templates?.length ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(tpl => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onClick={() => setSelected(tpl)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <TemplateDrawer
          template={selected}
          onClose={() => setSelected(null)}
          onDelete={() => deleteMutation.mutate(selected.id)}
        />
      )}
    </div>
  )
}

function TemplateCard({ template, onClick }: { template: ItineraryTemplate; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 rounded-lg p-5 hover:border-rihla/30 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-medium text-rihla bg-rihla/10 px-2 py-0.5 rounded uppercase tracking-wide">
              {template.target_audience ?? 'circuit'}
            </span>
            {template.is_public && (
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <Globe2 size={10} /> Public
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-cream truncate">
            {template.name}
          </h3>
        </div>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-rihla transition-colors flex-shrink-0" />
      </div>

      {template.description && (
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
          {template.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-[12px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} strokeWidth={2} />
          {template.duration_days}j
        </span>
        {template.hotel_category && (
          <span className="inline-flex items-center gap-1">
            <Star size={12} strokeWidth={2} />
            {template.hotel_category}
          </span>
        )}
        <span className="inline-flex items-center gap-1 ml-auto text-slate-400">
          <Sparkles size={12} strokeWidth={2} />
          {template.use_count} usage{template.use_count > 1 ? 's' : ''}
        </span>
      </div>

      {template.destination && (
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-3 truncate inline-flex items-center gap-1">
          <MapPin size={11} strokeWidth={2} className="text-slate-400 flex-shrink-0" />
          {template.destination}
        </p>
      )}

      {!!(template.tags?.length) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {template.tags!.slice(0, 4).map(t => (
            <span key={t} className="text-[10.5px] text-slate-500 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

function TemplateDrawer({
  template, onClose, onDelete,
}: {
  template: ItineraryTemplate
  onClose: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [pickProject, setPickProject] = useState(false)

  const { data: full } = useQuery({
    queryKey: ['itinerary-template', template.id],
    queryFn: () => itineraryTemplatesApi.get(template.id).then(r => r.data),
  })

  const { data: projects } = useQuery({
    queryKey: ['projects-for-template'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => r.data?.items ?? []),
    enabled: pickProject,
  })

  const apply = useMutation({
    mutationFn: (projectId: string) => itineraryTemplatesApi.apply(template.id, projectId),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['itinerary-templates'] })
      const projectId = resp.data?.project_id
      if (projectId) navigate(`/projects/${projectId}`)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-[600px] max-w-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-rihla font-medium mb-1">
              Template · {template.duration_days} jours
            </p>
            <h2 className="text-[20px] font-semibold text-slate-900 dark:text-cream tracking-tight">
              {template.name}
            </h2>
            {template.description && (
              <p className="text-[13px] text-slate-500 mt-1 max-w-md">{template.description}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-[20px] leading-none">×</button>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-white/5">
          {template.destination && (
            <Field icon={MapPin} label="Destination" value={template.destination} />
          )}
          {template.hotel_category && (
            <Field icon={Star} label="Catégorie hôtels" value={template.hotel_category} />
          )}
          {template.target_audience && (
            <Field icon={Users} label="Public cible" value={template.target_audience} />
          )}
          <Field icon={Sparkles} label="Utilisations" value={`${template.use_count}`} />
          {!!(template.tags?.length) && (
            <div className="col-span-2">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1.5 inline-flex items-center gap-1">
                <Tag size={10} /> Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {template.tags!.map(t => (
                  <span key={t} className="text-[11.5px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-5">
          <h3 className="text-[13px] font-semibold text-slate-900 dark:text-cream mb-3">
            Programme jour par jour
          </h3>
          <ol className="space-y-2.5">
            {(full?.days ?? []).map(d => (
              <li key={d.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-md bg-rihla/8 text-rihla text-[12px] font-semibold flex items-center justify-center flex-shrink-0">
                  J{d.day_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-900 dark:text-cream">{d.title}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {[d.city, d.hotel, d.meal_plan].filter(Boolean).join(' · ')}
                    {d.travel_time && ` · ${d.travel_time}`}
                    {d.distance_km != null && ` · ${d.distance_km} km`}
                  </p>
                  {!!(d.activities?.length) && (
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      {d.activities!.join(' · ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Apply panel */}
        {!pickProject ? (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-slate-900 flex items-center gap-3">
            <button
              onClick={() => setPickProject(true)}
              className="flex-1 px-4 py-2.5 rounded-md bg-rihla text-white text-[13px] font-medium hover:bg-rihla/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Copy size={14} strokeWidth={2.25} />
              Appliquer à un dossier
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-2.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              title="Supprimer le template"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-slate-900">
            <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">
              Choisis le dossier cible :
            </p>
            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-md divide-y divide-slate-100 dark:divide-white/5">
              {(projects ?? []).map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => apply.mutate(p.id)}
                  disabled={apply.isPending}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between disabled:opacity-50',
                  )}
                >
                  <span>
                    <span className="font-medium text-slate-900 dark:text-cream">{p.name}</span>
                    {p.client_name && (
                      <span className="text-slate-500"> · {p.client_name}</span>
                    )}
                  </span>
                  <ChevronRight size={14} className="text-slate-400" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setPickProject(false)}
              className="mt-2 text-[12px] text-slate-500 hover:text-slate-700"
            >
              ← Retour
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1 inline-flex items-center gap-1">
        <Icon size={10} /> {label}
      </p>
      <p className="text-[13px] text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-white/5 rounded-lg">
      <div className="w-12 h-12 mx-auto rounded-full bg-rihla/8 flex items-center justify-center mb-4">
        <Copy size={20} className="text-rihla" strokeWidth={1.75} />
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-cream mb-1">
        Aucun template pour l'instant
      </h3>
      <p className="text-[13px] text-slate-500 max-w-md mx-auto">
        Crée ton premier template depuis un circuit existant, puis applique-le à un nouveau dossier en un clic.
      </p>
    </div>
  )
}

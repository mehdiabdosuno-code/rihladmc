import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, MapPin, Tag, Image as ImageIcon, FileText, Copy, Trash2,
  X, Check, Globe2, Sparkles,
} from 'lucide-react'
import { mediaLibraryApi } from '@/lib/api'
import type { MediaAsset } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui'
import { clsx } from 'clsx'

const TYPES = [
  { value: '',     label: 'Tous',           icon: ImageIcon },
  { value: 'photo', label: 'Photos',        icon: ImageIcon },
  { value: 'poi',   label: 'Descriptions',  icon: FileText },
]

export function MediaLibraryPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const [justCopied, setJustCopied] = useState<string | null>(null)

  const { data: assets, isLoading } = useQuery({
    queryKey: ['media-library', q, type, city, category],
    queryFn: () => mediaLibraryApi.list({
      q: q || undefined,
      asset_type: type || undefined,
      city: city || undefined,
      category: category || undefined,
    }).then(r => r.data),
  })

  const { data: facets } = useQuery({
    queryKey: ['media-facets'],
    queryFn: () => mediaLibraryApi.facets().then(r => r.data),
  })

  const trackUse = useMutation({
    mutationFn: (id: string) => mediaLibraryApi.trackUse(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media-library'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => mediaLibraryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-library'] })
      qc.invalidateQueries({ queryKey: ['media-facets'] })
      setSelected(null)
    },
  })

  const handleCopy = async (asset: MediaAsset) => {
    const text = asset.asset_type === 'photo'
      ? asset.image_url ?? ''
      : asset.description ?? ''
    if (text) {
      await navigator.clipboard.writeText(text)
      setJustCopied(asset.id)
      trackUse.mutate(asset.id)
      setTimeout(() => setJustCopied(null), 1800)
    }
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      <PageHeader
        title="Bibliothèque mutualisée"
        subtitle="Photos & descriptions POI partagées entre Travel Designers — qualité homogène, gain de temps"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-rihla text-white text-[13px] font-medium hover:bg-rihla/90 transition-colors"
          >
            <Plus size={14} strokeWidth={2.25} />
            Ajouter un asset
          </button>
        }
      />

      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">

          {/* Sidebar facets */}
          <aside className="space-y-5">
            <FacetSection
              title="Type"
              items={TYPES.map(t => ({ value: t.value, label: t.label, count: facets?.types.find(f => f.value === t.value)?.count }))}
              active={type}
              onChange={setType}
              showAll
            />
            <FacetSection
              title="Ville"
              items={(facets?.cities ?? []).map(c => ({ value: c.value, label: c.value, count: c.count }))}
              active={city}
              onChange={setCity}
              showAll
            />
            <FacetSection
              title="Catégorie"
              items={(facets?.categories ?? []).map(c => ({ value: c.value, label: c.value, count: c.count }))}
              active={category}
              onChange={setCategory}
              showAll
            />
          </aside>

          {/* Main grid */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un asset…"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-md focus:outline-none focus:border-rihla"
                />
              </div>
              <span className="text-[12px] text-slate-500 ml-auto">
                {assets?.length ?? 0} asset{(assets?.length ?? 0) > 1 ? 's' : ''}
              </span>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner size={28} /></div>
            ) : !assets?.length ? (
              <EmptyState onCreate={() => setShowCreate(true)} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {assets.map(a => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    copied={justCopied === a.id}
                    onClick={() => setSelected(a)}
                    onCopy={(e) => { e.stopPropagation(); handleCopy(a) }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateAssetModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            qc.invalidateQueries({ queryKey: ['media-library'] })
            qc.invalidateQueries({ queryKey: ['media-facets'] })
          }}
        />
      )}

      {selected && (
        <DetailDrawer
          asset={selected}
          onClose={() => setSelected(null)}
          onCopy={() => handleCopy(selected)}
          onDelete={() => removeMutation.mutate(selected.id)}
          copied={justCopied === selected.id}
        />
      )}
    </div>
  )
}

function FacetSection({
  title, items, active, onChange, showAll,
}: {
  title: string
  items: { value: string; label: string; count?: number }[]
  active: string
  onChange: (v: string) => void
  showAll?: boolean
}) {
  const list = showAll ? items : items
  return (
    <div>
      <h4 className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
      <ul className="space-y-0.5">
        {showAll && !items.find(i => i.value === '') && (
          <li>
            <button
              onClick={() => onChange('')}
              className={clsx(
                'w-full text-left px-2 py-1.5 rounded-md text-[12.5px] flex items-center justify-between transition-colors',
                active === '' ? 'bg-rihla/10 text-rihla font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
              )}
            >
              Tous
            </button>
          </li>
        )}
        {list.map(it => (
          <li key={it.value}>
            <button
              onClick={() => onChange(active === it.value ? '' : it.value)}
              className={clsx(
                'w-full text-left px-2 py-1.5 rounded-md text-[12.5px] flex items-center justify-between transition-colors',
                active === it.value ? 'bg-rihla/10 text-rihla font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
              )}
            >
              <span className="capitalize truncate">{it.label}</span>
              {it.count != null && <span className="text-slate-400 text-[11px]">{it.count}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AssetCard({
  asset, copied, onClick, onCopy,
}: {
  asset: MediaAsset
  copied: boolean
  onClick: () => void
  onCopy: (e: React.MouseEvent) => void
}) {
  const isPhoto = asset.asset_type === 'photo'
  return (
    <button
      onClick={onClick}
      className="group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 rounded-lg overflow-hidden hover:border-rihla/30 hover:shadow-sm transition-all text-left"
    >
      {isPhoto && asset.thumb_url ? (
        <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
          <img src={asset.thumb_url} alt={asset.title} loading="lazy" className="w-full h-full object-cover" />
          {asset.is_public && (
            <span className="absolute top-2 right-2 text-[10px] bg-white/90 dark:bg-slate-900/90 text-emerald-700 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
              <Globe2 size={9} /> Public
            </span>
          )}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-gradient-to-br from-rihla/10 via-cream/30 to-rihla/5 p-4 flex items-center justify-center">
          <FileText size={32} className="text-rihla/40" strokeWidth={1.25} />
        </div>
      )}

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-[13px] font-medium text-slate-900 dark:text-cream truncate flex-1">{asset.title}</h3>
          <span className="text-[10.5px] text-rihla bg-rihla/8 px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0">
            {asset.asset_type}
          </span>
        </div>
        {asset.city && (
          <p className="text-[11.5px] text-slate-500 inline-flex items-center gap-1 mb-2">
            <MapPin size={10} strokeWidth={2} className="text-slate-400" />
            {asset.city}
          </p>
        )}
        {asset.description && !isPhoto && (
          <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-3 mb-2">{asset.description}</p>
        )}
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="text-[10.5px] text-slate-400 inline-flex items-center gap-1">
            <Sparkles size={9} /> {asset.use_count}
          </span>
          <span
            onClick={onCopy as any}
            role="button"
            tabIndex={0}
            className={clsx(
              'text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer',
              copied
                ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10'
                : 'text-slate-500 hover:text-rihla hover:bg-rihla/8',
            )}
          >
            {copied ? <><Check size={11} /> Copié</> : <><Copy size={11} /> {isPhoto ? 'URL' : 'Texte'}</>}
          </span>
        </div>
      </div>
    </button>
  )
}

function DetailDrawer({
  asset, onClose, onCopy, onDelete, copied,
}: {
  asset: MediaAsset
  onClose: () => void
  onCopy: () => void
  onDelete: () => void
  copied: boolean
}) {
  const isPhoto = asset.asset_type === 'photo'
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-[640px] max-w-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-rihla font-medium mb-1">
              {asset.asset_type} · {asset.city ?? '—'}
            </p>
            <h2 className="text-[20px] font-semibold text-slate-900 dark:text-cream tracking-tight">
              {asset.title}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {isPhoto && asset.image_url && (
          <div className="bg-slate-100 dark:bg-slate-950">
            <img src={asset.image_url} alt={asset.title} className="w-full h-auto max-h-[480px] object-contain" />
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          {asset.description && (
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1.5 inline-flex items-center gap-1">
                <FileText size={10} /> Description
              </p>
              <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {asset.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {asset.city && (
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Ville</p>
                <p className="text-[13px] text-slate-700 dark:text-slate-200">{asset.city}, {asset.country}</p>
              </div>
            )}
            {asset.category && (
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Catégorie</p>
                <p className="text-[13px] text-slate-700 dark:text-slate-200 capitalize">{asset.category}</p>
              </div>
            )}
            {asset.source && (
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Source</p>
                <p className="text-[13px] text-slate-700 dark:text-slate-200">{asset.source}{asset.license && ` · ${asset.license}`}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Utilisations</p>
              <p className="text-[13px] text-slate-700 dark:text-slate-200">{asset.use_count}</p>
            </div>
          </div>

          {!!(asset.tags?.length) && (
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1.5 inline-flex items-center gap-1">
                <Tag size={10} /> Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {asset.tags!.map(t => (
                  <span key={t} className="text-[11.5px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-slate-900 flex items-center gap-3">
          <button
            onClick={onCopy}
            className={clsx(
              'flex-1 px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors inline-flex items-center justify-center gap-2',
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-rihla text-white hover:bg-rihla/90',
            )}
          >
            {copied ? <><Check size={14} /> Copié dans le presse-papiers</> : <><Copy size={14} /> Copier {isPhoto ? "l'URL de l'image" : 'la description'}</>}
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-2.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </aside>
    </div>
  )
}

function CreateAssetModal({
  onClose, onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<Partial<MediaAsset>>({
    asset_type: 'photo',
    title: '',
    city: '',
    category: '',
    description: '',
    image_url: '',
    tags: [],
    is_public: false,
  })
  const [tagsRaw, setTagsRaw] = useState('')

  const create = useMutation({
    mutationFn: () => mediaLibraryApi.create({
      ...form,
      title: form.title!,
      tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    }),
    onSuccess: onCreated,
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    create.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-slate-900 dark:text-cream">Ajouter un asset</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-2">
            {(['photo', 'poi'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, asset_type: t })}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                  form.asset_type === t
                    ? 'bg-rihla text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300',
                )}
              >
                {t === 'photo' ? 'Photo' : 'Description POI'}
              </button>
            ))}
          </div>
          <Field label="Titre">
            <input
              required
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="input"
              placeholder="Place Jemaa el-Fna"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ville">
              <input value={form.city ?? ''} onChange={e => setForm({ ...form, city: e.target.value })} className="input" placeholder="Marrakech" />
            </Field>
            <Field label="Catégorie">
              <input value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value })} className="input" placeholder="culture / nature / hotel" />
            </Field>
          </div>
          {form.asset_type === 'photo' && (
            <Field label="URL de l'image">
              <input value={form.image_url ?? ''} onChange={e => setForm({ ...form, image_url: e.target.value })} className="input" placeholder="https://..." />
            </Field>
          )}
          <Field label="Description">
            <textarea
              value={form.description ?? ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input min-h-[80px] resize-y"
              placeholder={form.asset_type === 'photo' ? 'Légende optionnelle' : 'Texte descriptif premium pour propositions clients…'}
            />
          </Field>
          <Field label="Tags (séparés par virgule)">
            <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} className="input" placeholder="medina, unesco, sunset" />
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={!!form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} />
            Rendre cet asset visible publiquement (toutes les agences)
          </label>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3.5 py-2 text-[13px] text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md">Annuler</button>
          <button
            type="submit"
            disabled={!form.title || create.isPending}
            className="px-4 py-2 rounded-md bg-rihla text-white text-[13px] font-medium hover:bg-rihla/90 transition-colors disabled:opacity-50"
          >
            {create.isPending ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>

        <style>{`
          .input {
            width: 100%;
            padding: 8px 10px;
            font-size: 13px;
            background: white;
            border: 1px solid rgb(226 232 240);
            border-radius: 6px;
            outline: none;
          }
          .input:focus { border-color: rgb(180 62 32); }
          .dark .input { background: rgb(2 6 23); border-color: rgba(255,255,255,0.1); color: rgb(241 245 249); }
        `}</style>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-white/5 rounded-lg">
      <div className="w-12 h-12 mx-auto rounded-full bg-rihla/8 flex items-center justify-center mb-4">
        <ImageIcon size={20} className="text-rihla" strokeWidth={1.75} />
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-cream mb-1">Bibliothèque vide</h3>
      <p className="text-[13px] text-slate-500 max-w-md mx-auto mb-4">
        Ajoute photos et descriptions POI pour les réutiliser dans toutes vos propositions.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-rihla text-white text-[13px] font-medium hover:bg-rihla/90"
      >
        <Plus size={14} /> Premier asset
      </button>
    </div>
  )
}

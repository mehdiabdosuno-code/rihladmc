import { useState, useMemo } from 'react'
import {
  MapPin, Clock, Users, DollarSign, Sun, Landmark,
  Mountain, Heart, Utensils, Leaf, Star, Search,
  Filter, ChevronDown, Globe,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  ACTIVITIES_CATALOG,
  ACTIVITY_CATEGORIES,
  getActivityName,
  getActivityDescription,
} from '@/data/morocco_activities'
import type { Activity } from '@/data/morocco_activities'

const ICON_MAP: Record<string, typeof Sun> = {
  Sun, Landmark, Mountain, Heart, Utensils, Leaf, Star,
}

const DIFF_COLORS = {
  easy: 'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  challenging: 'bg-red-100 text-red-700',
}

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(v))

type CategoryKey = keyof typeof ACTIVITY_CATEGORIES

export function ActivitiesCatalogPage() {
  const [lang, setLang] = useState<string>('fr')
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState<CategoryKey | 'all'>('all')
  const [selectedCity, setSelectedCity] = useState<string>('all')
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  const cities = useMemo(() => {
    const s = new Set(ACTIVITIES_CATALOG.map(a => a.city))
    return ['all', ...Array.from(s).sort()]
  }, [])

  const filtered = useMemo(() => {
    return ACTIVITIES_CATALOG.filter(a => {
      if (selectedCat !== 'all' && a.category !== selectedCat) return false
      if (selectedCity !== 'all' && a.city !== selectedCity) return false
      if (search) {
        const q = search.toLowerCase()
        const name = getActivityName(a, lang).toLowerCase()
        const desc = getActivityDescription(a, lang).toLowerCase()
        if (!name.includes(q) && !desc.includes(q) && !a.city.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [selectedCat, selectedCity, search, lang])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-cream">
          {lang === 'fr' ? 'Catalogue Activit\u00e9s' : lang === 'de' ? 'Aktivit\u00e4tenkatalog' : lang === 'es' ? 'Cat\u00e1logo de Actividades' : lang === 'it' ? 'Catalogo Attivit\u00e0' : 'Activities Catalog'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {filtered.length} {lang === 'fr' ? 'activit\u00e9s disponibles' : 'activities available'} &mdash; BDD MEDIA S'TOURS
        </p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'fr' ? 'Rechercher une activit\u00e9...' : 'Search activities...'}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-cream focus:ring-2 focus:ring-rihla/30 outline-none"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setSelectedCat('all')}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              selectedCat === 'all'
                ? 'bg-rihla text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'
            )}
          >
            {lang === 'fr' ? 'Tout' : 'All'}
          </button>
          {(Object.entries(ACTIVITY_CATEGORIES) as [CategoryKey, typeof ACTIVITY_CATEGORIES[CategoryKey]][]).map(([key, cat]) => {
            const Icon = ICON_MAP[cat.icon] || Star
            return (
              <button
                key={key}
                onClick={() => setSelectedCat(key)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1',
                  selectedCat === key
                    ? 'bg-rihla text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'
                )}
              >
                <Icon size={12} />
                {cat.label_i18n[lang as keyof typeof cat.label_i18n] || cat.label_i18n['fr']}
              </button>
            )
          })}
        </div>

        {/* City filter */}
        <select
          value={selectedCity}
          onChange={e => setSelectedCity(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
        >
          {cities.map(c => (
            <option key={c} value={c}>{c === 'all' ? (lang === 'fr' ? 'Toutes les villes' : 'All cities') : c}</option>
          ))}
        </select>

        {/* Language */}
        <div className="flex items-center gap-1 ml-auto">
          <Globe size={13} className="text-slate-400" />
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="text-xs border-0 bg-transparent text-slate-600 dark:text-slate-300 font-medium cursor-pointer"
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
            <option value="de">DE</option>
            <option value="it">IT</option>
            <option value="es">ES</option>
            <option value="ja">JA</option>
            <option value="zh">ZH</option>
            <option value="ko">KO</option>
          </select>
        </div>
      </div>

      {/* Activity Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(act => {
          const catMeta = ACTIVITY_CATEGORIES[act.category]
          const CatIcon = ICON_MAP[catMeta.icon] || Star
          const isExpanded = expandedCode === act.code

          return (
            <div
              key={act.code}
              onClick={() => setExpandedCode(isExpanded ? null : act.code)}
              className={clsx(
                'rounded-xl border transition-all cursor-pointer',
                'bg-white dark:bg-slate-900 hover:shadow-md',
                isExpanded
                  ? 'border-rihla shadow-lg ring-1 ring-rihla/20'
                  : 'border-slate-200 dark:border-white/10'
              )}
            >
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', `bg-${catMeta.color}-100 text-${catMeta.color}-600`)}>
                      <CatIcon size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-cream leading-tight">
                        {getActivityName(act, lang)}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-slate-400" />
                        <span className="text-[11px] text-slate-500">{act.city}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-rihla whitespace-nowrap">{fmt(act.cost_per_pax)} MAD</span>
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400">
                    <Clock size={9} /> {act.duration_hours}h
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400">
                    <Users size={9} /> {act.min_pax}-{act.max_pax}
                  </span>
                  <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', DIFF_COLORS[act.difficulty])}>
                    {act.difficulty === 'easy' ? (lang === 'fr' ? 'Facile' : 'Easy') : act.difficulty === 'moderate' ? (lang === 'fr' ? 'Mod\u00e9r\u00e9' : 'Moderate') : (lang === 'fr' ? 'Difficile' : 'Challenging')}
                  </span>
                  {act.season !== 'all' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-600">
                      {act.season}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-white/5 p-4 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {getActivityDescription(act, lang)}
                  </p>

                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                      {lang === 'fr' ? 'Inclus' : 'Included'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {act.included.map(inc => (
                        <span key={inc} className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {inc.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-400">{act.code}</span>
                    <span className="text-[10px] text-slate-400">{act.region}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Search size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{lang === 'fr' ? 'Aucune activit\u00e9 trouv\u00e9e' : 'No activities found'}</p>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import {
  FileText, Calendar, Mail, Star, DollarSign,
  FolderOpen, Building2, ChevronDown, Download,
  Globe, Printer, Eye,
} from 'lucide-react'
import { clsx } from 'clsx'
import { DOCUMENT_TEMPLATES, CATEGORY_INFO } from '@/data/document_templates'
import type { DocumentTemplate } from '@/data/document_templates'

const ICON_MAP: Record<string, typeof FileText> = {
  FileText, Calendar, Mail, Star, DollarSign, FolderOpen, Building2,
}

export function DocumentTemplatesPage() {
  const [lang, setLang] = useState<string>('fr')
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  const filtered = DOCUMENT_TEMPLATES.filter(
    d => selectedCat === 'all' || d.category === selectedCat
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-cream">
          {lang === 'fr' ? 'Documents Internes Leisure' : lang === 'de' ? 'Interne Leisure-Dokumente' : 'Internal Leisure Documents'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {DOCUMENT_TEMPLATES.length} templates S'TOURS &mdash; Branding / Livrables Casbah
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setSelectedCat('all')}
          className={clsx(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            selectedCat === 'all'
              ? 'bg-rihla text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'
          )}
        >
          {lang === 'fr' ? 'Tous' : 'All'} ({DOCUMENT_TEMPLATES.length})
        </button>
        {(Object.entries(CATEGORY_INFO) as [string, { label: string; color: string }][]).map(([key, info]) => {
          const count = DOCUMENT_TEMPLATES.filter(d => d.category === key).length
          return (
            <button
              key={key}
              onClick={() => setSelectedCat(key)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                selectedCat === key
                  ? 'bg-rihla text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'
              )}
            >
              {info.label} ({count})
            </button>
          )
        })}

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
          </select>
        </div>
      </div>

      {/* Document cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(doc => {
          const Icon = ICON_MAP[doc.icon] || FileText
          const catInfo = CATEGORY_INFO[doc.category as keyof typeof CATEGORY_INFO]
          const isExpanded = expandedCode === doc.code
          const displayName = doc.name_i18n[lang] || doc.name_i18n['fr'] || doc.name

          return (
            <div
              key={doc.code}
              className={clsx(
                'rounded-xl border transition-all',
                'bg-white dark:bg-slate-900',
                isExpanded
                  ? 'border-rihla shadow-lg ring-1 ring-rihla/20'
                  : 'border-slate-200 dark:border-white/10 hover:shadow-md'
              )}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedCode(isExpanded ? null : doc.code)}
              >
                <div className="flex items-start gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    `bg-${catInfo.color}-100 text-${catInfo.color}-600`
                  )}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
                      {displayName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium',
                      `bg-${catInfo.color}-50 text-${catInfo.color}-700`
                    )}>
                      {catInfo.label}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase">{doc.language}</span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-white/5 p-4">
                  {/* Fields */}
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">
                    {lang === 'fr' ? 'Champs du template' : 'Template fields'}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
                    {Object.entries(doc.fields).map(([key, type]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                          {key}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {typeof type === 'string' ? type : typeof type === 'object' && Array.isArray(type) ? 'array' : 'object'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-rihla text-white hover:bg-rihla-dark transition-colors">
                      <Eye size={12} />
                      {lang === 'fr' ? 'Apercu' : 'Preview'}
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <Download size={12} />
                      {lang === 'fr' ? 'Exporter' : 'Export'}
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <Printer size={12} />
                      {lang === 'fr' ? 'Imprimer' : 'Print'}
                    </button>
                    <span className="ml-auto text-[10px] text-slate-400">{doc.code}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

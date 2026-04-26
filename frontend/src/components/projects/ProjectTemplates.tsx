import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, BookTemplate, Plus, Trash2, Zap, Check } from 'lucide-react'
import { projectsApi } from '@/lib/api'
import { clsx } from 'clsx'

const BUILT_IN_TEMPLATES = [
  {
    id: 'tpl-incentive-7',
    name: 'Template Incentive 7j Maroc Standard',
    type: 'incentive',
    duration: 7,
    pax: 30,
    destinations: 'Casablanca → Marrakech → Désert → Marrakech',
    description: 'Circuit incentive classique avec Agafay, Marrakech et une nuit désert.',
  },
  {
    id: 'tpl-leisure-10',
    name: 'Template Leisure 10j Grand Maroc',
    type: 'leisure',
    duration: 10,
    pax: 2,
    destinations: 'Casablanca → Fès → Chefchaouen → Rabat → Essaouira → Marrakech',
    description: 'Découverte complète du patrimoine marocain, idéal couple ou FIT.',
  },
  {
    id: 'tpl-mice-3',
    name: 'Template MICE Séminaire 3j Marrakech',
    type: 'mice',
    duration: 3,
    pax: 50,
    destinations: 'Marrakech · Agafay',
    description: 'Séminaire d\'entreprise avec team building et dîner de gala en plein désert.',
  },
  {
    id: 'tpl-luxury-5',
    name: 'Template Luxe 5j Maroc Ultra-Premium',
    type: 'luxury',
    duration: 5,
    pax: 2,
    destinations: 'Marrakech · Fès',
    description: 'Expérience 5 étoiles : Mamounia, palais privés et guides personnels.',
  },
]

const TYPE_COLORS: Record<string, string> = {
  incentive: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  leisure: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  mice: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  luxury: 'bg-rihla/10 text-rihla border-rihla/20',
}

interface ProjectTemplatesProps {
  onSelect?: (template: any) => void
}

export function ProjectTemplates({ onSelect }: ProjectTemplatesProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const qc = useQueryClient()

  const useTemplate = (template: any) => {
    setCopiedId(template.id)
    setTimeout(() => setCopiedId(null), 2000)
    onSelect?.(template)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rihla/10 flex items-center justify-center text-rihla">
            <BookTemplate size={16} />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-cream uppercase tracking-widest">
            S'TOURS Templates
          </h3>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-rihla/10 text-rihla rounded-xl text-[10px] font-black hover:bg-rihla/20 transition-all">
          <Plus size={12} /> Créer Template
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {BUILT_IN_TEMPLATES.map(tpl => (
          <div
            key={tpl.id}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 hover:border-rihla/40 hover:shadow-lg transition-all cursor-pointer"
            onClick={() => useTemplate(tpl)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={clsx(
                "px-3 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider",
                TYPE_COLORS[tpl.type]
              )}>
                {tpl.type}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                <span>{tpl.duration}j</span>
                <span>·</span>
                <span>{tpl.pax} pax</span>
              </div>
            </div>

            <h4 className="text-sm font-black text-slate-800 dark:text-cream mb-2 leading-tight group-hover:text-rihla transition-colors">
              {tpl.name}
            </h4>
            <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">{tpl.description}</p>
            <p className="text-[10px] font-bold text-rihla/70 flex items-center gap-1">
              <Zap size={10} /> {tpl.destinations}
            </p>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Utiliser ce template</span>
              <div className={clsx(
                "w-7 h-7 rounded-xl flex items-center justify-center transition-all",
                copiedId === tpl.id ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-500 group-hover:bg-rihla group-hover:text-white"
              )}>
                {copiedId === tpl.id ? <Check size={14} strokeWidth={3} /> : <Copy size={12} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

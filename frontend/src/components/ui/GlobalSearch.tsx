import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, FolderKanban, Calculator, MapPin, ArrowRight, Clock, X } from 'lucide-react'
import { projectsApi } from '@/lib/api'
import { clsx } from 'clsx'

interface SearchResult {
  id: string
  title: string
  subtitle: string
  type: 'project' | 'route'
  href: string
  icon: typeof FolderKanban
}

const QUICK_ROUTES: SearchResult[] = [
  { id: 'r1', title: 'Nouveau Projet', subtitle: 'Créer un dossier', type: 'route', href: '/projects/new', icon: FolderKanban },
  { id: 'r2', title: 'Moteur de Cotation', subtitle: 'Calculer un devis', type: 'route', href: '/quotations', icon: Calculator },
  { id: 'r3', title: 'Itinerary Builder', subtitle: 'Designer un circuit', type: 'route', href: '/itinerary', icon: MapPin },
  { id: 'r4', title: 'Analytics Executive', subtitle: 'Tableau de bord BI', type: 'route', href: '/analytics', icon: ArrowRight },
]

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        setQuery('')
        setSelected(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const { data: projectData } = useQuery({
    queryKey: ['projects-search', query],
    queryFn: () => projectsApi.list({ search: query, limit: 6 }).then(r => r.data),
    enabled: open && query.length > 1,
  })

  const projectResults: SearchResult[] = (projectData as any)?.items?.map((p: any) => ({
    id: p.id,
    title: p.name,
    subtitle: `${p.client_name || 'Client Direct'} · ${p.destination || 'Maroc'}`,
    type: 'project' as const,
    href: `/projects/${p.id}`,
    icon: FolderKanban,
  })) ?? []

  const results: SearchResult[] = query.length > 1 ? projectResults : QUICK_ROUTES
  const label = query.length > 1 ? `${projectResults.length} résultat(s)` : 'Navigation rapide'

  const goTo = (result: SearchResult) => {
    navigate(result.href)
    setOpen(false)
    setQuery('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) goTo(results[selected])
  }

  if (!open) return null

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />

      {/* Panel */}
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in slide-in-from-top-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-white/10">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKey}
            placeholder="Rechercher un projet, une page..."
            className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-cream placeholder:text-slate-400 outline-none"
          />
          <div className="flex items-center gap-1">
            {query && (
              <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={14} />
              </button>
            )}
            <kbd className="px-2 py-1 bg-slate-100 dark:bg-white/10 text-slate-400 text-[10px] font-mono rounded-lg">ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="p-2 max-h-80 overflow-y-auto">
          {results.length > 0 && (
            <>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">{label}</p>
              {results.map((r, i) => {
                const Icon = r.icon
                return (
                  <button
                    key={r.id}
                    onClick={() => goTo(r)}
                    className={clsx(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all",
                      i === selected ? "bg-rihla/10 text-rihla" : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className={clsx(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      r.type === 'project' ? "bg-rihla/10 text-rihla" : "bg-slate-100 dark:bg-white/10 text-slate-500"
                    )}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{r.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{r.subtitle}</p>
                    </div>
                    <ArrowRight size={14} className={clsx("shrink-0", i === selected ? "text-rihla" : "text-slate-300")} />
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 flex items-center gap-4 text-[10px] text-slate-400">
          <span><kbd className="font-mono bg-slate-100 dark:bg-white/10 px-1 rounded">↑↓</kbd> Naviguer</span>
          <span><kbd className="font-mono bg-slate-100 dark:bg-white/10 px-1 rounded">↵</kbd> Ouvrir</span>
          <span><kbd className="font-mono bg-slate-100 dark:bg-white/10 px-1 rounded">ESC</kbd> Fermer</span>
          <span className="ml-auto"><kbd className="font-mono bg-slate-100 dark:bg-white/10 px-1 rounded">Ctrl+K</kbd> Toggle</span>
        </div>
        {/* Footer Shortcut Legend */}
        <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-slate-300 dark:border-white/20 text-[9px] font-mono shadow-sm">Ctrl</kbd>
                 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-slate-300 dark:border-white/20 text-[9px] font-mono shadow-sm">N</kbd>
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Nouveau Projet</span>
              </div>
              <div className="flex items-center gap-1.5">
                 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-slate-300 dark:border-white/20 text-[9px] font-mono shadow-sm">G</kbd>
                 <span className="text-slate-300 text-[10px]">+</span>
                 <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-slate-300 dark:border-white/20 text-[9px] font-mono shadow-sm">P</kbd>
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Aller aux Projets</span>
              </div>
           </div>
           <div className="text-[10px] text-slate-400 font-bold italic">
              Console v2.0 · S'TOURS Enterprise
           </div>
        </div>
      </div>
    </div>
  )
}

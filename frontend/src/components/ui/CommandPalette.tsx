import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search, FolderKanban, BarChart2, Calculator, MapPin,
  Users, Settings, Zap, ArrowRight, Hash,
  Hotel, Bus, Receipt, Trophy, BookOpen, Clock,
  Plus, FilePlus, Sparkles,
} from 'lucide-react'
import { projectsApi } from '@/lib/api'
import { useRecentProjects } from '@/hooks/useRecentProjects'
import { clsx } from 'clsx'

// ── Quick Actions (creation flows) ─────────────────────────────────
type QuickAction = {
  label: string
  description: string
  path: string
  icon: typeof Plus
  shortcut?: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Créer un projet',  description: 'Nouveau dossier DMC',           path: '/projects/new',        icon: Plus,     shortcut: '⌘⇧N' },
  { label: 'Créer un devis',   description: 'Nouvelle cotation',             path: '/quotations?new=1',    icon: Calculator, shortcut: '⌘J' },
  { label: 'Créer une facture', description: 'Nouvelle facture client',      path: '/invoices?new=1',      icon: FilePlus,  shortcut: '⌘B' },
  { label: 'Créer un itinéraire', description: 'Nouveau circuit',           path: '/itineraries?new=1',   icon: MapPin },
]

// ── Navigation statique ──────────────────────────────────────────
type NavItem = {
  label: string
  path: string
  icon: typeof BarChart2
  group: string
  shortcut?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        path: '/dashboard',          icon: BarChart2,   group: 'Navigation', shortcut: '⌘D' },
  { label: 'Projets',          path: '/projects',           icon: FolderKanban, group: 'Navigation', shortcut: '⌘P' },
  { label: 'Devis',            path: '/quotations',         icon: Calculator,  group: 'Navigation', shortcut: '⌘J' },
  { label: 'Itinéraires',      path: '/itineraries',        icon: MapPin,      group: 'Navigation' },
  { label: 'Factures',         path: '/invoices',           icon: Receipt,     group: 'Navigation', shortcut: '⌘B' },
  { label: 'Analytics',        path: '/analytics',          icon: BarChart2,   group: 'Navigation' },
  { label: 'Leaderboard',      path: '/gamification/leaderboard', icon: Trophy, group: 'Navigation' },
  { label: 'Paramètres',       path: '/settings',           icon: Settings,    group: 'Navigation' },
  { label: 'Guides',           path: '/inventory/guides',   icon: Users,       group: 'Ressources' },
  { label: 'Hôtels',           path: '/inventory/hotels',   icon: Hotel,       group: 'Ressources' },
  { label: 'Transports',       path: '/operations/command-center', icon: Bus,  group: 'Ressources' },
  { label: 'Assistant IA',     path: '/ai',                 icon: Sparkles,    group: 'Studio IA' },
  { label: 'Content Studio',   path: '/ai/content-studio',  icon: BookOpen,    group: 'Studio IA' },
]

interface Props {
  open: boolean
  onClose: () => void
}

type Result =
  | { type: 'recent';  data: { id: string; name: string; reference?: string | null; client_name?: string | null } }
  | { type: 'project'; data: any }
  | { type: 'action';  data: QuickAction }
  | { type: 'nav';     data: NavItem }

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { recents, refresh: refreshRecents } = useRecentProjects()

  // Project search (live)
  const { data: projectsData } = useQuery({
    queryKey: ['projects-search-palette', query],
    queryFn: () => projectsApi.list({ search: query, limit: 5 }).then(r => r.data),
    enabled: query.length >= 2,
  })
  const matchedProjects: any[] = (projectsData as any)?.items ?? []

  // Filter quick actions
  const matchedActions = useMemo(() => {
    if (!query) return QUICK_ACTIONS
    const q = query.toLowerCase()
    return QUICK_ACTIONS.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      'créer'.includes(q) || 'create'.includes(q) || 'nouveau'.includes(q)
    )
  }, [query])

  // Filter nav
  const matchedNav = useMemo(() => {
    if (!query) return NAV_ITEMS
    const q = query.toLowerCase()
    return NAV_ITEMS.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q)
    )
  }, [query])

  // Recents shown only when no query
  const visibleRecents = !query ? recents.slice(0, 5) : []

  // Filter project ids already in recents to avoid duplicates
  const recentIds = new Set(visibleRecents.map(r => r.id))
  const filteredProjects = matchedProjects.filter(p => !recentIds.has(p.id))

  const allResults: Result[] = [
    ...visibleRecents.map((r): Result => ({ type: 'recent', data: r })),
    ...filteredProjects.map((p): Result => ({ type: 'project', data: p })),
    ...matchedActions.map((a): Result => ({ type: 'action', data: a })),
    ...matchedNav.map((n): Result => ({ type: 'nav', data: n })),
  ]

  useEffect(() => { setSelectedIdx(0) }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      refreshRecents()
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, refreshRecents])

  const navigateTo = useCallback((path: string) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  const runResult = useCallback((item: Result) => {
    if (item.type === 'recent')  navigateTo(`/projects/${item.data.id}`)
    else if (item.type === 'project') navigateTo(`/projects/${item.data.id}`)
    else navigateTo(item.data.path)
  }, [navigateTo])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allResults.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      const item = allResults[selectedIdx]
      if (item) runResult(item)
    }
  }

  if (!open) return null

  // Group rendering helper
  let cursor = 0
  const renderRecents = () => {
    if (!visibleRecents.length) return null
    const start = cursor
    cursor += visibleRecents.length
    return (
      <Section label="Récents" icon={<Clock size={9} />}>
        {visibleRecents.map((r, i) => (
          <Row
            key={`recent-${r.id}`}
            active={selectedIdx === start + i}
            onMouseEnter={() => setSelectedIdx(start + i)}
            onClick={() => navigateTo(`/projects/${r.id}`)}
            iconBg="bg-rihla/10"
            icon={<FolderKanban size={14} className="text-rihla" />}
            title={r.name}
            subtitle={
              <span className="flex items-center gap-1">
                <Hash size={9} /> {r.reference || 'REF-PENDING'}
                {r.client_name && <> · {r.client_name}</>}
              </span>
            }
            tail={selectedIdx === start + i ? <ArrowRight size={12} className="text-rihla" /> : null}
          />
        ))}
      </Section>
    )
  }

  const renderProjects = () => {
    if (!filteredProjects.length) return null
    const start = cursor
    cursor += filteredProjects.length
    return (
      <Section label="Projets" icon={<Search size={9} />}>
        {filteredProjects.map((p, i) => (
          <Row
            key={`proj-${p.id}`}
            active={selectedIdx === start + i}
            onMouseEnter={() => setSelectedIdx(start + i)}
            onClick={() => navigateTo(`/projects/${p.id}`)}
            iconBg="bg-rihla/10"
            icon={<FolderKanban size={14} className="text-rihla" />}
            title={p.name}
            subtitle={
              <span className="flex items-center gap-1">
                <Hash size={9} /> {p.reference || 'REF-PENDING'}
                {p.client_name && <> · {p.client_name}</>}
              </span>
            }
            tail={selectedIdx === start + i ? <ArrowRight size={12} className="text-rihla" /> : null}
          />
        ))}
      </Section>
    )
  }

  const renderActions = () => {
    if (!matchedActions.length) return null
    const start = cursor
    cursor += matchedActions.length
    return (
      <Section label="Actions rapides" icon={<Zap size={9} />}>
        {matchedActions.map((a, i) => (
          <Row
            key={`act-${a.path}`}
            active={selectedIdx === start + i}
            onMouseEnter={() => setSelectedIdx(start + i)}
            onClick={() => navigateTo(a.path)}
            iconBg="bg-emerald-500/10"
            icon={<a.icon size={14} className="text-emerald-600" />}
            title={a.label}
            subtitle={a.description}
            tail={a.shortcut ? <Kbd>{a.shortcut}</Kbd> : null}
          />
        ))}
      </Section>
    )
  }

  const renderNav = () => {
    if (!matchedNav.length) return null
    const start = cursor
    cursor += matchedNav.length
    return (
      <Section label={query ? 'Pages' : 'Navigation'} icon={<ArrowRight size={9} />}>
        {matchedNav.map((item, i) => {
          const Icon = item.icon
          return (
            <Row
              key={`nav-${item.path}`}
              active={selectedIdx === start + i}
              onMouseEnter={() => setSelectedIdx(start + i)}
              onClick={() => navigateTo(item.path)}
              iconBg="bg-slate-100 dark:bg-white/5"
              icon={<Icon size={13} className="text-slate-500" />}
              title={item.label}
              subtitle={<span className="text-[10px] uppercase tracking-widest text-slate-400">{item.group}</span>}
              tail={item.shortcut ? <Kbd>{item.shortcut}</Kbd> : null}
            />
          )
        })}
      </Section>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">

        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <Search size={16} className="text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher projets, actions, pages…"
            className="flex-1 bg-transparent text-[14px] text-slate-900 dark:text-cream placeholder:text-slate-400 outline-none"
          />
          <Kbd>ESC</Kbd>
        </div>

        {/* Results */}
        <div className="max-h-[440px] overflow-y-auto py-2">
          {allResults.length === 0 && (
            <div className="px-6 py-10 text-center text-[13px] text-slate-400">
              {query ? <>Aucun résultat pour <strong>"{query}"</strong></> : 'Aucun résultat'}
            </div>
          )}
          {renderRecents()}
          {renderProjects()}
          {renderActions()}
          {renderNav()}
        </div>

        {/* Footer hints */}
        <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5"><Kbd>↑↓</Kbd> Naviguer</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> Ouvrir</span>
          <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> Fermer</span>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5">
            <Kbd>⌘P</Kbd>/<Kbd>⌘D</Kbd>/<Kbd>⌘J</Kbd>/<Kbd>⌘B</Kbd>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────
function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-5 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {icon} {label}
      </p>
      {children}
    </div>
  )
}

function Row({
  active, onClick, onMouseEnter, iconBg, icon, title, subtitle, tail,
}: {
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
  iconBg: string
  icon: React.ReactNode
  title: string
  subtitle: React.ReactNode
  tail: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={clsx(
        'w-full flex items-center gap-3 px-5 py-2 text-left transition-colors',
        active ? 'bg-rihla/5 dark:bg-rihla/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'
      )}
    >
      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-slate-800 dark:text-cream truncate">{title}</p>
        <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
      </div>
      {tail && <span className="flex-shrink-0">{tail}</span>}
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-[10px] font-mono font-medium text-slate-500 dark:text-slate-300 border border-slate-200/80 dark:border-white/10">
      {children}
    </kbd>
  )
}

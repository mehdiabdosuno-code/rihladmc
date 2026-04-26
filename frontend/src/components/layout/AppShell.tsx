import { useState, useCallback } from 'react'
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom'
import { NotificationToast } from '@/components/ui/NotificationToast'
import { GeniusAssistant }   from '@/components/ai/GeniusAssistant'
import { CommandPalette }    from '@/components/ui/CommandPalette'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { clsx } from 'clsx'

import {
  LayoutDashboard, FolderKanban, Calculator, MapPin,
  Sparkles, BarChart2, Hash, Receipt, LogOut,
  Search, Bell, HelpCircle, Settings, Bus, FileText, Building2, Calendar, Hotel, BarChart3,
  Sun, Moon, Type, Compass, Gem, Utensils, Users, Radio, PieChart, TrendingUp,
  Globe, Car, Star, Truck, Trophy, Copy, Image as ImageIcon, Wand2, Plug, Leaf, Bot, Brain, Cloud, Workflow, ShoppingCart, Database, LucideIcon
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
// import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@/i18n/config'
const useTranslation = () => ({
  t: (key: string) => key,
  i18n: { language: 'fr', changeLanguage: (l: string) => {} }
})
import { useEffect } from 'react'
import { useSSENotifications, SSENotification } from '@/hooks/useSSENotifications'
import { GlobalSearch } from '@/components/ui/GlobalSearch'
import { GuidedTour } from '@/components/ui/GuidedTour'
import { getNavGroups, isMobileRole } from '@/lib/roleConfig'
import { useNotificationStore } from '@/stores/notificationStore'
import rihlaLogoDark from '@/assets/rihla_logo_dark_bg.png'
import rihlaLogoLight from '@/assets/rihla_logo_light_bg.png'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, FolderKanban, Calculator, MapPin, Sparkles, BarChart2, Hash, Receipt,
  Bus, FileText, Building2, Calendar, Hotel, BarChart3, Type, Compass, Gem, Utensils,
  Users, Radio, PieChart, TrendingUp, Globe, Car, Star, Truck, Bell, Settings, Trophy, Copy, ImageIcon, Wand2, Plug, Leaf, Bot, Brain, Cloud, Workflow, ShoppingCart, Database,
}

export function AppShell() {
  const { user, logout } = useAuthStore()
  const { i18n, t } = useTranslation()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [cmdOpen, setCmdOpen] = useState(false)

  useKeyboardShortcuts({ onOpenCommandPalette: () => setCmdOpen(true) })

  // ── RTL & Language Logic ──────────────────────────────────────────
  useEffect(() => {
    const isRTL = i18n.language === 'ar'
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  const pushIncoming = useNotificationStore(s => s.pushIncoming)
  const fetchAllNotifications = useNotificationStore(s => s.fetchAll)
  const initializedNotifs = useNotificationStore(s => s.initialized)

  const handleNotification = useCallback((n: SSENotification) => {
    pushIncoming(n)
  }, [pushIncoming])

  useSSENotifications(handleNotification)

  // Hydrate the notification store once the user is logged in.
  useEffect(() => {
    if (user && !initializedNotifs) fetchAllNotifications()
  }, [user, initializedNotifs, fetchAllNotifications])

  const isPublicPath = location.pathname === '/pricing-simulator'

  if (!user && !localStorage.getItem('stours_token') && !isPublicPath) {
    return <Navigate to="/login" replace />
  }

  const role = user?.role?.name ?? ''
  const mobileRole = isMobileRole(role)

  const notifications = useNotificationStore(s => s.notifications)
  const unreadCount   = useNotificationStore(s => s.unreadCount)
  const markRead      = useNotificationStore(s => s.markRead)
  const markAllRead   = useNotificationStore(s => s.markAllRead)
  const navGroups = getNavGroups(role)

  const initials = (user?.full_name || user?.email || 'U')
    .split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()

  const hideSidebar = mobileRole

  // Redirect mobile roles to their dedicated portals
  if (mobileRole && (location.pathname === '/dashboard' || location.pathname === '/')) {
    if (role === 'driver')  return <Navigate to="/portal/driver" replace />
    if (role === 'guide')   return <Navigate to="/portal/guide" replace />
    if (role === 'client')  return <Navigate to="/portal" replace />
  }

    return (
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <GlobalSearch />
        <GuidedTour />

      {/* ── COMMAND PALETTE ─────────────────────────────────────── */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* ── SIDEBAR (Hidden for Field Ops & Clients) ────────────── */}
      {!hideSidebar && (
        <aside
          className="w-60 flex-shrink-0 flex flex-col border-r border-rihla/10 dark:bg-slate-900 dark:border-white/5 relative"
          style={{ backgroundColor: 'rgba(244, 196, 48, 0.13)' }}
        >

        {/* Logo header */}
        <div className="px-5 py-4 border-b border-rihla/10 dark:border-white/5">
          <Link to="/dashboard" className="block">
            <img
              src={rihlaLogoLight}
              alt="RIHLA Suite"
              className="h-7 w-auto block dark:hidden"
            />
            <img
              src={rihlaLogoDark}
              alt="RIHLA Suite"
              className="h-7 w-auto hidden dark:block"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-3">
          {navGroups.map((group, gi) => (
            <div key={group.label} className={clsx(gi > 0 && 'mt-6')}>
              <p className="px-2 mb-2 text-[10px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-500">
                {group.label}
              </p>
              {group.items.map(({ to, icon: iconName, label, shortcut }) => {
                const Icon = ICON_MAP[iconName] ?? Hash
                const active = location.pathname.startsWith(to)
                return (
                  <Link
                    key={to}
                    to={to}
                    style={active ? { backgroundColor: 'rgba(244, 196, 48, 0.32)' } : undefined}
                    className={clsx(
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px]',
                      'transition-colors group relative mb-0.5',
                      active
                        ? 'text-slate-900 font-semibold dark:bg-rihla/15 dark:text-cream'
                        : 'text-slate-800 hover:text-slate-900 hover:bg-rihla/5 dark:text-slate-400 dark:hover:text-cream dark:hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon size={15} className="flex-shrink-0 text-rihla" strokeWidth={1.75} />
                    <span className="flex-1 truncate">{t(label.toLowerCase().replace(' ', '_'))}</span>
                    {shortcut && !active && (
                      <kbd className="hidden group-hover:inline-flex px-1.5 py-0.5 text-[10px] font-mono rounded bg-white border border-rihla/15 text-rihla/60 dark:bg-white/5 dark:border-white/10">
                        ⌘{shortcut}
                      </kbd>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="px-3 py-3 border-t border-rihla/10 dark:border-white/5">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-rihla/5 dark:hover:bg-white/[0.04] transition-colors group cursor-pointer">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rihla to-rihla-dark
                              flex items-center justify-center text-[11px] font-semibold text-white">
                {initials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-cream truncate leading-tight">
                {user?.full_name ?? 'Utilisateur'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                {(user?.role?.name ?? 'expert').replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-2 px-1">
            <button
              onClick={toggleTheme}
              className="w-7 h-7 rounded-md flex items-center justify-center text-rihla/60 hover:text-rihla hover:bg-rihla/8 dark:hover:text-cream dark:hover:bg-white/10 transition-colors"
              title="Changer le thème"
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <Link
              to="/settings"
              className="w-7 h-7 rounded-md flex items-center justify-center text-rihla/60 hover:text-rihla hover:bg-rihla/8 dark:hover:text-cream dark:hover:bg-white/10 transition-colors"
              title="Paramètres"
            >
              <Settings size={14} />
            </Link>
            <div className="flex-1" />
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] text-slate-500 hover:text-rihla hover:bg-rihla/8 transition-colors"
            >
              <LogOut size={12} />
              Quitter
            </button>
          </div>
        </div>
      </aside>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Global Bar (Hidden for field ops) */}
        {!hideSidebar && (
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between px-6 z-30">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-slate-400">Console</span>
            <ChevronRight size={12} className="text-slate-300" />
            <span className="text-slate-900 dark:text-cream font-medium capitalize">
              {location.pathname.split('/')[1] || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 h-8 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-md border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Search size={13} strokeWidth={2} />
              <span className="text-[12px] w-32 text-left">Rechercher…</span>
              <kbd className="text-[10px] font-mono bg-white dark:bg-white/10 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">⌘K</kbd>
            </button>

            {/* Notifications Bell */}
            <div className="relative group">
              <button className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-rihla hover:bg-slate-100 dark:hover:bg-white/10 transition-colors relative">
                <Bell size={16} strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rihla rounded-full" />
                )}
              </button>
              <div className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-medium text-slate-700 dark:text-cream">Notifications {unreadCount > 0 && `(${unreadCount})`}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={markAllRead} className="text-[11px] text-rihla hover:underline">Tout lire</button>
                    <Link to="/notifications" className="text-[11px] text-slate-400 hover:underline">Voir tout</Link>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-[12px] text-center py-6 text-slate-400">Aucune notification</p>
                  ) : notifications.slice(0, 8).map(n => (
                    <div key={n.id} onClick={() => markRead(n.id)} className={clsx("p-2.5 rounded-md transition-colors cursor-pointer", n.is_read ? "opacity-50" : "bg-slate-50 dark:bg-white/5 hover:bg-slate-100")}>
                      <p className="text-[12px] font-medium text-slate-900 dark:text-cream leading-tight">{n.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Language Switcher — dropdown for 9 languages */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 h-8 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 hover:text-slate-800 transition-colors">
                <Globe size={13} />
                <span className="text-[11px] font-bold uppercase">{i18n.language}</span>
              </button>
              <div className="absolute right-0 top-10 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1.5">
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={clsx(
                      "w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] transition-colors",
                      i18n.language === lang.code
                        ? "bg-slate-50 dark:bg-white/5 font-bold text-slate-900 dark:text-cream"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"
                    )}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.label}</span>
                    {i18n.language === lang.code && <span className="ml-auto text-rihla text-[10px] font-black">ON</span>}
                  </button>
                ))}
              </div>
            </div>

            <button className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-rihla hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" title="Aide">
              <HelpCircle size={16} strokeWidth={1.75} />
            </button>
          </div>
        </header>
        )}

        <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          <NotificationToast />
          <GeniusAssistant />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function ChevronRight(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

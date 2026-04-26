import { useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

interface ShortcutOptions {
  onOpenCommandPalette: () => void
}

/**
 * Raccourcis clavier globaux :
 *  Ctrl+K  / ⌘K → Command Palette
 *  Ctrl+P  / ⌘P → /projects
 *  Ctrl+D  / ⌘D → /dashboard
 *  Ctrl+J  / ⌘J → /quotations
 *  Ctrl+B  / ⌘B → /invoices
 *  Ctrl+Shift+N → /projects/new
 *  Séquentiels : G then P/D/Q/A/I/N/F/L (vim-style)
 */
export function useKeyboardShortcuts({ onOpenCommandPalette }: ShortcutOptions) {
  const navigate = useNavigate()
  const pendingG = useRef(false)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handler = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
      (e.target as HTMLElement)?.isContentEditable

    const mod = e.ctrlKey || e.metaKey

    // Ctrl+K / ⌘K → Command Palette (même dans un input)
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      onOpenCommandPalette()
      return
    }

    // Direct Ctrl/⌘ shortcuts (override Chrome defaults like Ctrl+D bookmark)
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase()
      const directRoutes: Record<string, string> = {
        p: '/projects',
        d: '/dashboard',
        j: '/quotations',
        b: '/invoices',
      }
      // Ctrl+Shift+N → new project
      if (e.shiftKey && key === 'n') {
        e.preventDefault()
        navigate('/projects/new')
        return
      }
      if (!e.shiftKey && directRoutes[key]) {
        e.preventDefault()
        e.stopPropagation()
        navigate(directRoutes[key])
        return
      }
    }

    // Les raccourcis "g+x" ne s'activent pas dans les champs de saisie
    if (isInput) return

    // G → marque l'attente d'un second caractère
    if (e.key === 'g' && !mod && !e.altKey) {
      pendingG.current = true
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      pendingTimer.current = setTimeout(() => { pendingG.current = false }, 1200)
      return
    }

    if (pendingG.current) {
      pendingG.current = false
      if (pendingTimer.current) clearTimeout(pendingTimer.current)

      const routes: Record<string, string> = {
        p: '/projects',
        d: '/dashboard',
        q: '/quotations',
        a: '/analytics',
        i: '/invoices',
        n: '/projects/new',
        f: '/field-ops',
        l: '/gamification/leaderboard',
      }

      const route = routes[e.key.toLowerCase()]
      if (route) {
        e.preventDefault()
        navigate(route)
      }
    }
  }, [navigate, onOpenCommandPalette])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
    }
  }, [handler])
}

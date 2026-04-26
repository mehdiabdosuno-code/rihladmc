import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'rihla:recent-projects'
const MAX_RECENTS = 5

export interface RecentProject {
  id: string
  name: string
  reference?: string | null
  client_name?: string | null
  visited_at: number
}

function readStorage(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useRecentProjects() {
  const [recents, setRecents] = useState<RecentProject[]>(() => readStorage())

  // Re-read when palette opens or storage changes from another tab
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRecents(readStorage())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const refresh = useCallback(() => setRecents(readStorage()), [])

  return { recents, refresh }
}

export function recordRecentProject(p: { id: string; name: string; reference?: string | null; client_name?: string | null }) {
  if (!p?.id || !p?.name) return
  try {
    const current = readStorage().filter(r => r.id !== p.id)
    const next: RecentProject[] = [
      { id: p.id, name: p.name, reference: p.reference ?? null, client_name: p.client_name ?? null, visited_at: Date.now() },
      ...current,
    ].slice(0, MAX_RECENTS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore quota / serialization errors
  }
}

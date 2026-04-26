import { useEffect, useRef, useState, useCallback } from 'react'
import { fieldOpsApi } from '@/lib/api'

export interface QueuedUpdate {
  task_id: string
  status: string
  timestamp: number
}

const STORAGE_KEY = 'rihla.fieldops.queue.v1'
const TASKS_CACHE_KEY = 'rihla.fieldops.tasks.v1'

function readQueue(): QueuedUpdate[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}
function writeQueue(q: QueuedUpdate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q))
}

/**
 * Offline-first task status updater.
 *
 * - When online: applies update directly + invalidates tasks query.
 * - When offline: queues update in localStorage; auto-flushes when back online.
 * - Also caches tasks payload to localStorage so the page remains usable offline.
 */
export function useOfflineQueue(onSynced?: () => void) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [queueSize, setQueueSize] = useState<number>(readQueue().length)
  const flushingRef = useRef(false)

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    const q = readQueue()
    if (!q.length || !navigator.onLine) return
    flushingRef.current = true
    try {
      await fieldOpsApi.bulkSync(q)
      writeQueue([])
      setQueueSize(0)
      onSynced?.()
    } catch (e) {
      console.warn('[offline] sync failed, will retry later', e)
    } finally {
      flushingRef.current = false
    }
  }, [onSynced])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      flush()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (navigator.onLine) flush()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flush])

  const enqueueOrApply = useCallback(
    async (task_id: string, status: string) => {
      const update = { task_id, status, timestamp: Date.now() }
      if (navigator.onLine) {
        try {
          await fieldOpsApi.updateStatus(task_id, status)
          return { online: true }
        } catch {
          // fall through to queue
        }
      }
      const q = readQueue().filter((u) => u.task_id !== task_id)
      q.push(update)
      writeQueue(q)
      setQueueSize(q.length)
      return { online: false }
    },
    [],
  )

  return { isOnline, queueSize, flush, enqueueOrApply }
}

// ── Task cache helpers (used by the page to render last-known data offline)
export function cacheTasks(tasks: unknown) {
  try {
    localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify({ ts: Date.now(), tasks }))
  } catch {/* ignore */}
}
export function readCachedTasks<T = unknown>(): { ts: number; tasks: T } | null {
  try {
    const raw = localStorage.getItem(TASKS_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

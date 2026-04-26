import { useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'

export interface SSENotification {
  id: string
  type: 'review' | 'remark' | 'agenda_update' | 'system'
  title: string
  message: string
  sender_name: string
  project_id: string | null
  created_at: string
}

export function useSSENotifications(
  onNotification: (n: SSENotification) => void
) {
  const token = useAuthStore((s) => s.token)
  const esRef = useRef<EventSource | null>(null)
  const onRef  = useRef(onNotification)
  onRef.current = onNotification

  const connect = useCallback(() => {
    if (!token) return
    esRef.current?.close()

    // EventSource doesn't support custom headers — pass token via cookie or query param
    // We use a dedicated fetch-based SSE to keep auth consistent
    const controller = new AbortController()

    fetch('/api/notifications/stream', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6))
              onRef.current(payload)
            } catch { /* ignore malformed */ }
          }
        }
      }
    }).catch(() => {
      // Reconnect after 5s on error
      setTimeout(connect, 5000)
    })

    return () => controller.abort()
  }, [token])

  useEffect(() => {
    const cleanup = connect()
    return () => { cleanup?.() }
  }, [connect])
}

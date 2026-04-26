import { create } from 'zustand'
import { notificationsApi } from '@/lib/api'

export type NotificationType =
  | 'review'
  | 'remark'
  | 'agenda_update'
  | 'incident'
  | 'companion_message'
  | 'system'

export interface RihlaNotification {
  id: string
  type: NotificationType | string
  title: string
  message: string
  sender_name: string
  project_id?: string | null
  created_at?: string | null
  is_read?: boolean
  extra?: Record<string, unknown> | null
}

interface NotificationState {
  notifications: RihlaNotification[]
  unreadCount: number
  loading: boolean
  initialized: boolean

  fetchAll: () => Promise<void>
  refreshUnread: () => Promise<void>
  pushIncoming: (n: RihlaNotification) => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  reset: () => void
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  initialized: false,

  fetchAll: async () => {
    set({ loading: true })
    try {
      const [list, unread] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.unreadCount(),
      ])
      const items: RihlaNotification[] = (list.data ?? []).map((n: any) => ({
        ...n,
        is_read: !!n.is_read,
      }))
      set({
        notifications: items,
        unreadCount: unread.data?.count ?? items.filter(n => !n.is_read).length,
        loading: false,
        initialized: true,
      })
    } catch {
      set({ loading: false, initialized: true })
    }
  },

  refreshUnread: async () => {
    try {
      const { data } = await notificationsApi.unreadCount()
      set({ unreadCount: data?.count ?? 0 })
    } catch { /* ignore */ }
  },

  /** Called by the SSE hook when a new notification arrives in real time. */
  pushIncoming: (n) => {
    const existing = get().notifications
    if (existing.some(x => x.id === n.id)) return
    const enriched: RihlaNotification = { ...n, is_read: false }
    set({
      notifications: [enriched, ...existing].slice(0, 100),
      unreadCount: get().unreadCount + 1,
    })
  },

  markRead: async (id) => {
    const before = get().notifications
    const target = before.find(n => n.id === id)
    if (!target || target.is_read) return
    set({
      notifications: before.map(n => n.id === id ? { ...n, is_read: true } : n),
      unreadCount: Math.max(0, get().unreadCount - 1),
    })
    try { await notificationsApi.markRead(id) } catch { /* keep optimistic */ }
  },

  markAllRead: async () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))
    try { await notificationsApi.markAllRead() } catch { /* keep optimistic */ }
  },

  reset: () => set({ notifications: [], unreadCount: 0, initialized: false }),
}))

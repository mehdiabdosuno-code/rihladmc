import { useEffect, useRef, useState } from 'react'
import { X, Info, AlertCircle, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { useNotificationStore } from '@/stores/notificationStore'

interface Toast {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success'
}

const TOAST_TYPE_BY_NOTIF: Record<string, Toast['type']> = {
  review:            'success',
  remark:            'info',
  agenda_update:     'info',
  incident:          'warning',
  companion_message: 'warning',
  system:            'info',
}

export function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notifications = useNotificationStore(s => s.notifications)
  const seenRef = useRef<Set<string>>(new Set())

  // Whenever a new notification lands in the store (via SSE or refresh),
  // surface a toast — but only once per notification id and never on initial fetch.
  useEffect(() => {
    if (notifications.length === 0) return

    if (seenRef.current.size === 0) {
      // First load — mark everything as already-seen, no toast spam.
      notifications.forEach(n => seenRef.current.add(n.id))
      return
    }

    const fresh = notifications.filter(n => !seenRef.current.has(n.id))
    if (fresh.length === 0) return

    fresh.forEach(n => {
      seenRef.current.add(n.id)
      addToast(
        n.title || 'Notification',
        n.message || '',
        TOAST_TYPE_BY_NOTIF[n.type] ?? 'info',
      )
    })
  }, [notifications])

  const addToast = (title: string, message: string, type: Toast['type']) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts(prev => [...prev, { id, title, message, type }])
    setTimeout(() => removeToast(id), 6000)
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full">
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className={clsx(
            "p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex gap-4 items-start animate-in slide-in-from-right-10 duration-300",
            toast.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20" :
            toast.type === 'warning' ? "bg-amber-500/10 border-amber-500/20" :
            "bg-blue-500/10 border-blue-500/20"
          )}
        >
          <div className={clsx(
            "p-2 rounded-xl",
            toast.type === 'success' ? "text-emerald-400 bg-emerald-400/10" :
            toast.type === 'warning' ? "text-amber-400 bg-amber-400/10" :
            "text-blue-400 bg-blue-400/10"
          )}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : 
             toast.type === 'warning' ? <AlertCircle size={18} /> : 
             <Info size={18} />}
          </div>
          <div className="flex-1">
            <h4 className="text-[10px] font-black uppercase text-white tracking-widest">{toast.title}</h4>
            <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">{toast.message}</p>
          </div>
          <button 
            onClick={() => removeToast(toast.id)}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

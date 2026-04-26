import { useState, useEffect } from 'react'
import { Bell, Shield, Info, AlertTriangle, CheckCircle } from 'lucide-react'

export interface AppNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'security'
  timestamp: string
  isRead: boolean
}

export function useAppNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: '1',
      title: 'Nouvelle Collaboration',
      message: 'Ahmed vient de rejoindre le projet #DEV-001.',
      type: 'info',
      timestamp: new Date().toISOString(),
      isRead: false
    }
  ])

  // Mock WebSocket simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      const newNotif: AppNotification = {
        id: Date.now().toString(),
        title: 'Sécurité DNA',
        message: 'Archive Black Box générée pour le dossier Marrakech Express.',
        type: 'security',
        timestamp: new Date().toISOString(),
        isRead: false
      }
      setNotifications(prev => [newNotif, ...prev])
    }, 15000)

    return () => clearTimeout(timer)
  }, [])

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const clearAll = () => {
    setNotifications([])
  }

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.isRead).length,
    markAsRead,
    clearAll
  }
}

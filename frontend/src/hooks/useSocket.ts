import { useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'

export function useSocket(handlers?: Record<string, (data: unknown) => void>) {
  const { token } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!token) return

    const socket = connectSocket(token)
    socketRef.current = socket

    if (handlers) {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.on(event, handler)
      })
    }

    return () => {
      if (handlers) {
        Object.keys(handlers).forEach((event) => socket.off(event))
      }
    }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return socketRef.current
}

export function useDossierSocket(dossierId: string | undefined, handlers: Record<string, (data: unknown) => void>) {
  const { token } = useAuthStore()

  useEffect(() => {
    if (!token || !dossierId) return

    const socket = connectSocket(token)
    socket.emit('rejoindre_dossier', { dossier_id: dossierId })

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler)
    })

    return () => {
      socket.emit('quitter_dossier', { dossier_id: dossierId })
      Object.keys(handlers).forEach((event) => socket.off(event))
    }
  }, [token, dossierId]) // eslint-disable-line react-hooks/exhaustive-deps
}

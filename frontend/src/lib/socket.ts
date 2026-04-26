import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling'],
  })

  socket.on('connect', () => console.log('[WS] Connecté:', socket?.id))
  socket.on('disconnect', (reason) => console.log('[WS] Déconnecté:', reason))
  socket.on('connect_error', (err) => console.error('[WS] Erreur connexion:', err.message))

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function joinDossier(dossierId: string) {
  socket?.emit('rejoindre_dossier', { dossier_id: dossierId })
}

export function leaveDossier(dossierId: string) {
  socket?.emit('quitter_dossier', { dossier_id: dossierId })
}

export function sendMessage(dossierId: string, destinataireId: string, contenu: string) {
  socket?.emit('envoyer_message', { dossier_id: dossierId, destinataire_id: destinataireId, contenu })
}

export function sendTyping(dossierId: string, typing: boolean) {
  socket?.emit('typing', { dossier_id: dossierId, typing })
}

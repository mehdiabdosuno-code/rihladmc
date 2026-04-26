import { io, Socket } from 'socket.io-client'

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3000'

let socket: Socket | null = null

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(WS_URL, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
    transports: ['websocket'],
  })
  return socket
}

export function getSocket() { return socket }
export function disconnectSocket() { socket?.disconnect(); socket = null }

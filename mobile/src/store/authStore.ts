import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { api } from '../services/api'

interface User {
  id: string
  nom: string
  prenom: string
  email: string
  role: 'guide' | 'TD' | 'comptable' | 'admin'
  telephone?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadToken: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync('rihla_token')
      if (token) {
        set({ token })
        const { data } = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        set({ user: data, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ token: null, user: null, isLoading: false })
    }
  },

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      await SecureStore.setItemAsync('rihla_token', data.access_token)
      await SecureStore.setItemAsync('rihla_refresh', data.refresh_token)
      set({ token: data.access_token, user: data.user, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('rihla_token')
    await SecureStore.deleteItemAsync('rihla_refresh')
    set({ user: null, token: null })
  },
}))

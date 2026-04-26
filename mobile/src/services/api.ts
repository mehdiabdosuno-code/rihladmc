import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('rihla_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      try {
        const refresh = await SecureStore.getItemAsync('rihla_refresh')
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh })
        await SecureStore.setItemAsync('rihla_token', data.access_token)
        err.config.headers.Authorization = `Bearer ${data.access_token}`
        return api(err.config)
      } catch {
        await SecureStore.deleteItemAsync('rihla_token')
        // Naviguer vers login sera géré par l'app
      }
    }
    return Promise.reject(err)
  }
)

// ── API calls ────────────────────────────────────────────────────
export const dossiersApi = {
  miens:  () => api.get('/dossiers'),
  detail: (id: string) => api.get(`/dossiers/${id}`),
}

export const rapportsApi = {
  liste:    (dossierId: string) => api.get(`/dossiers/${dossierId}/rapports`),
  soumettre:(dossierId: string, body: Record<string, unknown>) =>
    api.post(`/dossiers/${dossierId}/rapports`, body),
}

export const paiementsApi = {
  miens: () => api.get('/paiements'),
}

export const notificationsApi = {
  liste: () => api.get('/notifications'),
  lireTout: () => api.patch('/notifications/lire-tout'),
  saveFcmToken: (token: string) => api.patch('/notifications/fcm-token', { token }),
}

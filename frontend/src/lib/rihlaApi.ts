import { api } from './api'

// ── Types ────────────────────────────────────────────────────────
export type EmojiVal = 'bien' | 'moyen' | 'mauvais' | null

export interface RapportPayload {
  jour: number
  date_rapport: string
  petit_dejeuner?: EmojiVal
  dejeuner?: EmojiVal
  diner?: EmojiVal
  hotel?: EmojiVal
  transport?: EmojiVal
  accueil_hote?: EmojiVal
  commentaire?: string
}

export interface ChecklistPayload {
  appel_restaurants?: boolean
  appel_hotels?: boolean
  appel_activites?: boolean
  dossier_guide_pret?: boolean
  notes?: string
}

export interface PaiementPayload {
  dossier_id: string
  guide_id: string
  montant: number
  devise?: 'MAD' | 'EUR' | 'USD'
  reference_bancaire?: string
  note?: string
}

export interface EvaluationPayload {
  dossier_id: string
  note: number
  critique: string
  source_aide?: 'manuel' | 'claude'
}

// ── Dossiers ─────────────────────────────────────────────────────
export const dossiersApi = {
  liste: (params?: Record<string, unknown>) => api.get('/dossiers', { params }),
  detail: (id: string)                       => api.get(`/dossiers/${id}`),
  creer: (body: Record<string, unknown>)     => api.post('/dossiers', body),
  modifier: (id: string, body: Record<string, unknown>) => api.patch(`/dossiers/${id}`, body),
  archiver: (id: string)                     => api.delete(`/dossiers/${id}`),
}

// ── Programme ────────────────────────────────────────────────────
export const programmeApi = {
  get: (id: string)                           => api.get(`/dossiers/${id}/programme`),
  save: (id: string, body: Record<string, unknown>) => api.put(`/dossiers/${id}/programme`, body),
}

// ── Checklist J-1 ────────────────────────────────────────────────
export const checklistApi = {
  get: (dossierId: string)                          => api.get(`/dossiers/${dossierId}/checklist`),
  valider: (dossierId: string, body: ChecklistPayload) => api.patch(`/dossiers/${dossierId}/checklist`, body),
}

// ── Rapports Journaliers ─────────────────────────────────────────
export const rapportsApi = {
  liste: (dossierId: string)               => api.get(`/dossiers/${dossierId}/rapports`),
  detail: (dossierId: string, jour: number)=> api.get(`/dossiers/${dossierId}/rapports/${jour}`),
  soumettre: (dossierId: string, body: RapportPayload) => api.post(`/dossiers/${dossierId}/rapports`, body),
}

// ── Paiements ────────────────────────────────────────────────────
export const paiementsApi = {
  liste: (params?: Record<string, unknown>) => api.get('/paiements', { params }),
  detail: (id: string)                       => api.get(`/paiements/${id}`),
  creer: (body: PaiementPayload)             => api.post('/paiements', body),
  confirmer: (id: string, note?: string)     => api.patch(`/paiements/${id}/confirmer`, { note }),
}

// ── Évaluations Guides ───────────────────────────────────────────
export const evaluationsApi = {
  liste: (guideId: string)                         => api.get(`/guides/${guideId}/evaluations`),
  creer: (guideId: string, body: EvaluationPayload)=> api.post(`/guides/${guideId}/evaluations`, body),
  generer: (guideId: string, dossierId: string, ton = 'professionnel', langue = 'fr') =>
    api.post(`/guides/${guideId}/evaluations/generer`, { dossier_id: dossierId, ton, langue }),
}

// ── PDF ──────────────────────────────────────────────────────────
export const pdfApi = {
  generer: (dossierId: string)   => api.post(`/dossiers/${dossierId}/pdf/generer`),
  statut: (dossierId: string)    => api.get(`/dossiers/${dossierId}/pdf/statut`),
  telecharger: (dossierId: string) => window.open(`/api/dossiers/${dossierId}/pdf/telecharger`, '_blank'),
}

// ── Prestataires ─────────────────────────────────────────────────
export const prestatairesApi = {
  liste: (params?: Record<string, unknown>) => api.get('/prestataires', { params }),
  detail: (id: string)                       => api.get(`/prestataires/${id}`),
  creer: (body: Record<string, unknown>)     => api.post('/prestataires', body),
  modifier: (id: string, b: Record<string, unknown>) => api.patch(`/prestataires/${id}`, b),
}

// ── Notifications ────────────────────────────────────────────────
export const notificationsApi = {
  liste: ()             => api.get('/notifications'),
  lire: (id: string)    => api.patch(`/notifications/${id}/lire`),
  lireTout: ()          => api.patch('/notifications/lire-tout'),
  saveFcmToken: (token: string) => api.patch('/notifications/fcm-token', { token }),
}

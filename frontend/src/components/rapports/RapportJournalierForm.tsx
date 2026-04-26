import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rapportsApi, EmojiVal } from '@/lib/rihlaApi'
import toast from 'react-hot-toast'
import { Send, AlertTriangle } from 'lucide-react'

interface Props {
  dossierId: string
  jour: number
  dateRapport: string
  onSuccess?: () => void
}

const CATEGORIES: { key: keyof Omit<RapportData, 'commentaire'>; label: string }[] = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner' },
  { key: 'dejeuner',       label: 'Déjeuner' },
  { key: 'diner',          label: 'Dîner' },
  { key: 'hotel',          label: 'Hôtel' },
  { key: 'transport',      label: 'Transport' },
  { key: 'accueil_hote',   label: 'Accueil / Hôte' },
]

const EMOJIS: { val: EmojiVal; emoji: string; label: string; color: string }[] = [
  { val: 'bien',    emoji: '😊', label: 'Bien',    color: '#10b981' },
  { val: 'moyen',   emoji: '😐', label: 'Moyen',   color: '#f59e0b' },
  { val: 'mauvais', emoji: '😞', label: 'Mauvais', color: '#ef4444' },
]

interface RapportData {
  petit_dejeuner: EmojiVal
  dejeuner: EmojiVal
  diner: EmojiVal
  hotel: EmojiVal
  transport: EmojiVal
  accueil_hote: EmojiVal
  commentaire: string
}

export function RapportJournalierForm({ dossierId, jour, dateRapport, onSuccess }: Props) {
  const qc = useQueryClient()
  const [data, setData] = useState<RapportData>({
    petit_dejeuner: null,
    dejeuner: null,
    diner: null,
    hotel: null,
    transport: null,
    accueil_hote: null,
    commentaire: '',
  })

  const mutation = useMutation({
    mutationFn: () => rapportsApi.soumettre(dossierId, { jour, date_rapport: dateRapport, ...data }),
    onSuccess: (res) => {
      const { alerte_declenchee, categories_alertes } = res.data
      if (alerte_declenchee) {
        toast.error(`⚠️ Alerte envoyée au TD : ${categories_alertes.join(', ')}`, { duration: 6000 })
      } else {
        toast.success('Rapport soumis avec succès')
      }
      qc.invalidateQueries({ queryKey: ['rapports', dossierId] })
      onSuccess?.()
    },
    onError: () => toast.error('Erreur lors de la soumission'),
  })

  const hasMauvais = CATEGORIES.some((c) => data[c.key] === 'mauvais')
  const allFilled  = CATEGORIES.every((c) => data[c.key] !== null)

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e3a5f' }}>
          Rapport Jour {jour}
        </h3>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{dateRapport}</p>
      </div>

      {hasMauvais && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <AlertTriangle size={16} color="#dc2626" />
          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
            Une alerte sera automatiquement envoyée au TD
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {CATEGORIES.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#374151', minWidth: 140 }}>{label}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {EMOJIS.map(({ val, emoji, label: eLabel, color }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setData((d) => ({ ...d, [key]: val }))}
                  title={eLabel}
                  style={{
                    fontSize: 28,
                    background: data[key] === val ? `${color}22` : '#f8fafc',
                    border: `2px solid ${data[key] === val ? color : '#e2e8f0'}`,
                    borderRadius: 10,
                    width: 52,
                    height: 52,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    transform: data[key] === val ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
          Commentaire (optionnel)
        </label>
        <textarea
          value={data.commentaire}
          onChange={(e) => setData((d) => ({ ...d, commentaire: e.target.value }))}
          rows={3}
          placeholder="Observations, incidents, suggestions..."
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none' }}
        />
      </div>

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={!allFilled || mutation.isPending}
        style={{
          marginTop: 20,
          width: '100%',
          background: allFilled ? '#1e3a5f' : '#94a3b8',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '12px 0',
          fontSize: 15,
          fontWeight: 700,
          cursor: allFilled ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Send size={16} />
        {mutation.isPending ? 'Envoi...' : 'Soumettre le rapport'}
      </button>

      {!allFilled && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
          Évaluez toutes les catégories pour soumettre
        </p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { StarRating } from './StarRating'
import { reviewsApi, ReviewTarget } from '@/lib/api'
import { MessageSquare, Send } from 'lucide-react'

const TARGETS: { type: ReviewTarget; label: string; emoji: string }[] = [
  { type: 'guide',      label: 'Guide',      emoji: '🧭' },
  { type: 'driver',     label: 'Chauffeur',  emoji: '🚌' },
  { type: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { type: 'hotel',      label: 'Hôtel',      emoji: '🏨' },
]

interface Props {
  projectId: string
  onSuccess?: () => void
}

export function ReviewForm({ projectId, onSuccess }: Props) {
  const [target, setTarget]   = useState<ReviewTarget>('guide')
  const [targetName, setTargetName] = useState('')
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  async function submit() {
    if (!rating || !targetName) return
    setLoading(true)
    try {
      await reviewsApi.create({ project_id: projectId, target_type: target, target_name: targetName, rating, comment })
      setDone(true)
      onSuccess?.()
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#10b981' }}>
      ✓ Merci pour votre avis !
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MessageSquare size={14} /> Évaluez un prestataire de votre voyage
      </p>

      {/* Type */}
      <div style={{ display: 'flex', gap: 8 }}>
        {TARGETS.map((t) => (
          <button
            key={t.type}
            onClick={() => setTarget(t.type)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 8,
              border: '1px solid',
              borderColor: target === t.type ? '#1628A9' : 'rgba(255,255,255,0.1)',
              background: target === t.type ? '#1628A9' : 'transparent',
              color: target === t.type ? '#fff' : '#94a3b8',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Nom */}
      <input
        placeholder={`Nom du ${TARGETS.find(t => t.type === target)?.label ?? 'prestataire'}`}
        value={targetName}
        onChange={(e) => setTargetName(e.target.value)}
        style={{
          padding: '0.5rem 0.8rem', borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: '0.875rem', outline: 'none',
        }}
      />

      {/* Stars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StarRating value={rating} onChange={setRating} size={24} />
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {['', 'Médiocre', 'Passable', 'Bien', 'Très bien', 'Excellent'][rating] ?? ''}
        </span>
      </div>

      {/* Commentaire */}
      <textarea
        rows={3}
        placeholder="Commentaire (optionnel)..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{
          padding: '0.5rem 0.8rem', borderRadius: 8, resize: 'vertical',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: '0.875rem', outline: 'none',
        }}
      />

      <button
        onClick={submit}
        disabled={!rating || !targetName || loading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '0.6rem 1.2rem', borderRadius: 8, border: 'none',
          background: rating && targetName ? '#1628A9' : '#334155',
          color: '#fff', fontWeight: 600, fontSize: '0.875rem',
          cursor: rating && targetName ? 'pointer' : 'not-allowed',
        }}
      >
        <Send size={14} />
        {loading ? 'Envoi...' : 'Envoyer l\'avis'}
      </button>
    </div>
  )
}

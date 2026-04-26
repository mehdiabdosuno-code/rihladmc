import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { evaluationsApi } from '@/lib/rihlaApi'
import toast from 'react-hot-toast'
import { Sparkles, Star, Send } from 'lucide-react'

interface Props {
  dossierId: string
  guideId: string
  guideNom: string
}

export function EvaluationGuide({ dossierId, guideId, guideNom }: Props) {
  const qc = useQueryClient()
  const [note, setNote] = useState<number>(8)
  const [critique, setCritique] = useState('')
  const [ton, setTon] = useState<'professionnel' | 'constructif' | 'encourageant'>('professionnel')
  const [isGenerating, setIsGenerating] = useState(false)
  const [sourceAide, setSourceAide] = useState<'manuel' | 'claude'>('manuel')

  const { data: evaluations = [] } = useQuery({
    queryKey: ['evaluations', guideId],
    queryFn: () => evaluationsApi.liste(guideId).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: () => evaluationsApi.creer(guideId, {
      dossier_id: dossierId,
      note,
      critique,
      source_aide: sourceAide,
    }),
    onSuccess: () => {
      toast.success('Évaluation enregistrée')
      qc.invalidateQueries({ queryKey: ['evaluations', guideId] })
      setCritique('')
      setNote(8)
      setSourceAide('manuel')
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  })

  const genererAvecClaude = async () => {
    setIsGenerating(true)
    try {
      const { data } = await evaluationsApi.generer(guideId, dossierId, ton, 'fr')
      setCritique(data.brouillon)
      if (data.note_suggeree) setNote(data.note_suggeree)
      setSourceAide('claude')
      toast.success('Brouillon généré par Claude')
    } catch {
      toast.error('Erreur Claude API')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Formulaire */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 20 }}>
          Évaluation de {guideNom}
        </h3>

        {/* Note /10 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 10 }}>
            Note /10
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNote(n)}
                style={{
                  width: 40, height: 40,
                  borderRadius: 8,
                  border: `2px solid ${note >= n ? '#f59e0b' : '#e2e8f0'}`,
                  background: note >= n ? '#fef9c3' : '#f8fafc',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 14,
                  color: note >= n ? '#92400e' : '#94a3b8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Star size={14} fill={note >= n ? '#f59e0b' : 'none'} color={note >= n ? '#f59e0b' : '#94a3b8'} />
              </button>
            ))}
            <span style={{ marginLeft: 10, fontSize: 22, fontWeight: 800, color: note >= 8 ? '#10b981' : note >= 5 ? '#f59e0b' : '#ef4444' }}>
              {note}/10
            </span>
          </div>
        </div>

        {/* Générer avec Claude */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <select
            value={ton}
            onChange={(e) => setTon(e.target.value as typeof ton)}
            style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }}
          >
            <option value="professionnel">Ton professionnel</option>
            <option value="constructif">Ton constructif</option>
            <option value="encourageant">Ton encourageant</option>
          </select>
          <button
            type="button"
            onClick={genererAvecClaude}
            disabled={isGenerating}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#7c3aed', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, opacity: isGenerating ? 0.7 : 1,
            }}
          >
            <Sparkles size={15} />
            {isGenerating ? 'Génération...' : 'Générer avec Claude'}
          </button>
        </div>

        {/* Critique */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Évaluation détaillée {sourceAide === 'claude' && <span style={{ fontSize: 11, color: '#7c3aed', marginLeft: 6 }}>✨ Généré avec Claude</span>}
          </label>
          <textarea
            value={critique}
            onChange={(e) => { setCritique(e.target.value); setSourceAide('manuel') }}
            rows={8}
            placeholder="Rédigez votre évaluation détaillée..."
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.6 }}
          />
        </div>

        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!critique.trim() || mutation.isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: critique.trim() ? '#1e3a5f' : '#94a3b8',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '12px 24px', cursor: critique.trim() ? 'pointer' : 'not-allowed',
            fontSize: 14, fontWeight: 700,
          }}
        >
          <Send size={15} />
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer l\'évaluation'}
        </button>
      </div>

      {/* Historique */}
      {evaluations.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>Historique des évaluations</h3>
          {(evaluations as Record<string, unknown>[]).map((ev) => (
            <div key={ev.id as string} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#374151' }}>{ev.numero_dossier as string} — {ev.nom_groupe as string}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: (ev.note as number) >= 8 ? '#10b981' : '#f59e0b' }}>
                  {ev.note as number}/10
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{ev.critique as string}</p>
              {ev.source_aide === 'claude' && (
                <span style={{ fontSize: 11, color: '#7c3aed', marginTop: 4, display: 'block' }}>✨ Rédigé avec Claude</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

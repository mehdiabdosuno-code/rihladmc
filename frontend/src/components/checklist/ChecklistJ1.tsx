import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checklistApi } from '@/lib/rihlaApi'
import toast from 'react-hot-toast'
import { CheckSquare, Square, CheckCircle } from 'lucide-react'

interface Props { dossierId: string }

const ITEMS: { key: 'appel_restaurants' | 'appel_hotels' | 'appel_activites' | 'dossier_guide_pret'; label: string; detail: string }[] = [
  { key: 'appel_restaurants',  label: 'Appeler les restaurants',    detail: 'Confirmer toutes les réservations de repas' },
  { key: 'appel_hotels',       label: 'Appeler les hôtels',          detail: 'Confirmer disponibilités et chambres' },
  { key: 'appel_activites',    label: 'Appeler les activités',       detail: 'Confirmer horaires et disponibilités' },
  { key: 'dossier_guide_pret', label: 'Dossier guide physique prêt', detail: 'Programme imprimé, vouchers, enveloppe espèces, bons' },
]

export function ChecklistJ1({ dossierId }: Props) {
  const qc = useQueryClient()

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['checklist', dossierId],
    queryFn: () => checklistApi.get(dossierId).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (updates: Record<string, boolean>) => checklistApi.valider(dossierId, updates),
    onSuccess: (res) => {
      qc.setQueryData(['checklist', dossierId], res.data)
      if (res.data.complete) toast.success('✅ Checklist complète ! Dossier marqué "Prêt"')
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const toggle = (key: string, current: boolean) => {
    mutation.mutate({ [key]: !current })
  }

  if (isLoading) return <div style={{ padding: 20, color: '#94a3b8' }}>Chargement...</div>
  if (!checklist) return null

  const complete = checklist.complete

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${complete ? '#10b981' : '#e2e8f0'}`, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1e3a5f' }}>Check-list J-1</h3>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>À compléter avant l'arrivée du groupe</p>
        </div>
        {complete && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#d1fae5', borderRadius: 20, padding: '6px 14px' }}>
            <CheckCircle size={16} color="#10b981" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>Complète</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ITEMS.map(({ key, label, detail }) => {
          const checked = checklist[key] as boolean
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key, checked)}
              disabled={mutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                background: checked ? '#f0fdf4' : '#f8fafc',
                border: `1px solid ${checked ? '#86efac' : '#e2e8f0'}`,
                borderRadius: 10,
                padding: '14px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                width: '100%',
              }}
            >
              {checked
                ? <CheckSquare size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                : <Square size={20} color="#94a3b8" style={{ flexShrink: 0, marginTop: 2 }} />
              }
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: checked ? '#065f46' : '#374151', textDecoration: checked ? 'line-through' : 'none' }}>
                  {label}
                </p>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{detail}</p>
              </div>
            </button>
          )
        })}
      </div>

      {checklist.valide_at && (
        <p style={{ marginTop: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          Validée le {new Date(checklist.valide_at).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  )
}

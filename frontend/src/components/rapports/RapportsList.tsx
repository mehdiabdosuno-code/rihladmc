// @ts-nocheck
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { rapportsApi } from '@/lib/rihlaApi'
import { useDossierSocket } from '@/hooks/useSocket'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'

interface Props { dossierId: string }

const EMOJI_MAP: Record<string, string> = { bien: '😊', moyen: '😐', mauvais: '😞' }
const CATS = ['petit_dejeuner','dejeuner','diner','hotel','transport','accueil_hote']
const LABELS: Record<string, string> = {
  petit_dejeuner: 'Petit-dej', dejeuner: 'Déj.', diner: 'Dîner',
  hotel: 'Hôtel', transport: 'Transport', accueil_hote: 'Accueil',
}

function renderEmojis(r: Record<string, unknown>): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: (r.commentaire as string | undefined) ? 12 : 0 }}>
      {CATS.map((cat) => {
        const val = r[cat] as string | undefined
        if (!val) return null
        return (
          <div key={cat} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: val === 'mauvais' ? '#fee2e2' : val === 'moyen' ? '#fef9c3' : '#f0fdf4',
            borderRadius: 8, padding: '8px 12px', minWidth: 70,
          }}>
            <span style={{ fontSize: 22 }}>{EMOJI_MAP[val]}</span>
            <span style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>{LABELS[cat]}</span>
          </div>
        )
      })}
    </div>
  )
}

export function RapportsList({ dossierId }: Props) {
  const qc = useQueryClient()

  const { data: rapports = [], isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ['rapports', dossierId],
    queryFn: () => rapportsApi.liste(dossierId).then((r) => r.data as Record<string, unknown>[]),
  })

  // Temps réel : nouveau rapport soumis par le guide
  useDossierSocket(dossierId, {
    nouveau_rapport: (data: unknown) => {
      qc.invalidateQueries({ queryKey: ['rapports', dossierId] })
      const d = data as { alerte_declenchee?: boolean }
      if (d?.alerte_declenchee) {
        // Une notification toast sera gérée par le composant alerte global
      }
    },
  })

  if (isLoading) return <div style={{ padding: 20, color: '#94a3b8' }}>Chargement des rapports...</div>
  if (!rapports.length) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
      <p>Aucun rapport soumis pour ce dossier.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rapports.map((r: Record<string, unknown>): React.ReactNode => {
        const hasAlerte = r.alerte_envoyee as boolean
        const alertCats = (r.categories_alertes as string[]) || []

        return (
          <div key={r.id as string} style={{
            border: `1px solid ${hasAlerte ? '#fca5a5' : '#e2e8f0'}`,
            borderRadius: 10,
            padding: '16px 20px',
            background: hasAlerte ? '#fef2f2' : '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 15 }}>
                  Jour {r.jour as number}
                </span>
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10 }}>
                  {new Date(r.date_rapport as string).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              {hasAlerte && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fee2e2', borderRadius: 20, padding: '4px 12px' }}>
                  <AlertTriangle size={14} color="#dc2626" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                    ALERTE : {alertCats.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Évaluations emoji */}
            {renderEmojis(r)}

            {r.commentaire && (
              <div style={{ marginTop: 12, background: '#f8fafc', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#374151', fontStyle: 'italic' }}>
                "{r.commentaire as string}"
              </div>
            )}

            {typeof r.score_global === 'number' && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Score global :</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: r.score_global >= 4 ? '#10b981' : r.score_global >= 2.5 ? '#f59e0b' : '#ef4444' }}>
                  {r.score_global}/5
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

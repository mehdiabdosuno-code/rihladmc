import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { paiementsApi } from '@/lib/rihlaApi'
import toast from 'react-hot-toast'
import { DollarSign, Send } from 'lucide-react'

interface Props {
  dossierId: string
  guideId: string
  guideNom: string
  numeroDossier: string
  nomGroupe: string
  onSuccess?: () => void
}

export function PaiementForm({ dossierId, guideId, guideNom, numeroDossier, nomGroupe, onSuccess }: Props) {
  const qc = useQueryClient()
  const [montant, setMontant] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [devise, setDevise] = useState<'MAD' | 'EUR' | 'USD'>('MAD')

  const mutation = useMutation({
    mutationFn: () => paiementsApi.creer({
      dossier_id: dossierId,
      guide_id: guideId,
      montant: parseFloat(montant),
      devise,
      reference_bancaire: reference || undefined,
      note: note || undefined,
    }),
    onSuccess: () => {
      toast.success(`✅ Paiement de ${montant} ${devise} effectué pour ${guideNom}`)
      qc.invalidateQueries({ queryKey: ['paiements'] })
      setMontant('')
      setReference('')
      setNote('')
      onSuccess?.()
    },
    onError: () => toast.error('Erreur lors du paiement'),
  })

  const valid = montant && parseFloat(montant) > 0

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <DollarSign size={20} color="#1e3a5f" />
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>Paiement Guide</h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>{numeroDossier} — {nomGroupe}</p>
        </div>
      </div>

      <div style={{ background: '#f0f4f8', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#374151' }}>
          Guide : <strong>{guideNom}</strong>
        </p>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          ⚠️ Les bons de paiement espèces sont gérés physiquement hors application.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Montant *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="2500.00"
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Devise
          </label>
          <select
            value={devise}
            onChange={(e) => setDevise(e.target.value as 'MAD' | 'EUR' | 'USD')}
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none' }}
          >
            <option value="MAD">MAD</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
          Référence bancaire
        </label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="VIR-BMCE-2026042501"
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
          Note interne
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optionnel..."
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none' }}
        />
      </div>

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={!valid || mutation.isPending}
        style={{
          width: '100%',
          background: valid ? '#1e3a5f' : '#94a3b8',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '13px 0',
          fontSize: 15,
          fontWeight: 700,
          cursor: valid ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Send size={16} />
        {mutation.isPending ? 'Traitement...' : `Effectuer le virement — ${montant || '0'} ${devise}`}
      </button>
    </div>
  )
}

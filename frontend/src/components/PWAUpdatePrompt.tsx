import { usePWAUpdate } from '@/hooks/usePWAUpdate'
import { RefreshCw } from 'lucide-react'

export function PWAUpdatePrompt() {
  const { needRefresh, updateServiceWorker } = usePWAUpdate()

  if (!needRefresh) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.75rem',
        backgroundColor: '#1628A9',
        color: '#fff',
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <RefreshCw size={16} />
      <span>Nouvelle version disponible</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          marginLeft: '0.5rem',
          padding: '0.3rem 0.8rem',
          borderRadius: '9999px',
          backgroundColor: '#fff',
          color: '#1628A9',
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.8rem',
        }}
      >
        Mettre à jour
      </button>
    </div>
  )
}

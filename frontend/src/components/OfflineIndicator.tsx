import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true)
      setShowReconnected(false)
    }
    const handleOnline = () => {
      setIsOffline(false)
      setShowReconnected(true)
      setTimeout(() => setShowReconnected(false), 3000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline && !showReconnected) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1.2rem',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        backgroundColor: isOffline ? '#7f1d1d' : '#14532d',
        color: '#fff',
        transition: 'background-color 0.3s',
      }}
    >
      {isOffline ? (
        <>
          <WifiOff size={16} />
          Mode hors-ligne — données en cache uniquement
        </>
      ) : (
        <>
          <Wifi size={16} />
          Connexion rétablie
        </>
      )}
    </div>
  )
}

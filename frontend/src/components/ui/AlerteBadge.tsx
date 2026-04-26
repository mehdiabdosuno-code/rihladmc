import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { connectSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'

interface AlerteData {
  numero_dossier: string
  nom_groupe: string
  jour: number
  categories: string[]
  guide_telephone?: string
}

// Composant à monter une seule fois dans AppShell pour écouter les alertes globales
export function AlerteGlobale() {
  const { token, user } = useAuthStore()

  useEffect(() => {
    if (!token || (user as any)?.role !== 'TD') return

    const socket = connectSocket(token)

    socket.on('alerte_critique', (data: AlerteData) => {
      const labelsStr = data.categories.join(', ')
      toast.error(
        `⚠️ ALERTE — ${data.numero_dossier} Jour ${data.jour}\n${labelsStr}\nGroupe : ${data.nom_groupe}`,
        {
          duration: 15000,
          style: { background: '#dc2626', color: '#fff', fontWeight: 700, maxWidth: 400 },
        }
      )
      // Son d'alerte
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
        osc.start()
        osc.stop(ctx.currentTime + 0.8)
      } catch {
        // Navigateur sans AudioContext, silently fail
      }
    })

    return () => { socket.off('alerte_critique') }
  }, [token, user?.role])

  return null
}

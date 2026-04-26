import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) console.info('[PWA] Service worker registered')
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration failed:', error)
    },
  })

  return { needRefresh, updateServiceWorker }
}

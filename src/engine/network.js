// Отслеживание состояния сети
import { useState, useEffect } from 'react'

let _online = navigator.onLine

// Слушаем изменения
if (window.Capacitor?.isNativePlatform?.()) {
  import('@capacitor/network').then(({ Network }) => {
    Network.getStatus().then(s => { _online = s.connected })
    Network.addListener('networkStatusChange', s => {
      _online = s.connected
      window.dispatchEvent(new CustomEvent('network-change', { detail: s.connected }))
    })
  }).catch(() => {})
} else {
  window.addEventListener('online', () => { _online = true; window.dispatchEvent(new CustomEvent('network-change', { detail: true })) })
  window.addEventListener('offline', () => { _online = false; window.dispatchEvent(new CustomEvent('network-change', { detail: false })) })
}

export function isOnline() { return _online }

// React hook
export function useNetworkStatus() {
  const [online, setOnline] = useState(_online)
  useEffect(() => {
    const handler = (e) => setOnline(e.detail)
    window.addEventListener('network-change', handler)
    return () => window.removeEventListener('network-change', handler)
  }, [])
  return online
}

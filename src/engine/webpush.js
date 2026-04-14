/**
 * Web Push — клиентская часть
 *
 * Работает только в браузере (не Capacitor натив), над Service Worker.
 * API: isSupported, getPermission, subscribe, unsubscribe, getCurrentSubscription.
 */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function isSupported() {
  if (typeof window === 'undefined') return false
  // На Capacitor native используется FCM/APNs через push.js, web-push бессмысленен
  if (window.Capacitor?.isNativePlatform?.()) return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getPermission() {
  if (!isSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

async function getSWRegistration() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg || await navigator.serviceWorker.ready
}

export async function getCurrentSubscription() {
  if (!isSupported()) return null
  try {
    const reg = await getSWRegistration()
    if (!reg) return null
    return await reg.pushManager.getSubscription()
  } catch { return null }
}

/**
 * Запросить разрешение и подписаться.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function subscribeToPush() {
  if (!isSupported()) return { ok: false, reason: 'unsupported' }

  const token = localStorage.getItem('stolbiki_token')
  if (!token) return { ok: false, reason: 'not_authenticated' }

  // 1. Публичный VAPID ключ
  let publicKey
  try {
    const res = await fetch('/api/push/vapid-public-key')
    const data = await res.json()
    if (!data.configured || !data.publicKey) return { ok: false, reason: 'push_not_configured' }
    publicKey = data.publicKey
  } catch { return { ok: false, reason: 'network_error' } }

  // 2. Permission
  let perm = Notification.permission
  if (perm === 'default') {
    perm = await Notification.requestPermission()
  }
  if (perm !== 'granted') return { ok: false, reason: 'permission_denied' }

  // 3. PushManager.subscribe
  let subscription
  try {
    const reg = await getSWRegistration()
    if (!reg) return { ok: false, reason: 'no_sw' }
    subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
  } catch (e) {
    return { ok: false, reason: 'subscribe_failed', detail: e.message }
  }

  // 4. Отправляем на сервер
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })
    if (!res.ok) return { ok: false, reason: 'save_failed' }
  } catch { return { ok: false, reason: 'network_error' } }

  return { ok: true }
}

/**
 * Отписаться (на клиенте и на сервере).
 */
export async function unsubscribeFromPush() {
  if (!isSupported()) return { ok: true }
  const token = localStorage.getItem('stolbiki_token')
  try {
    const sub = await getCurrentSubscription()
    if (!sub) return { ok: true }
    const endpoint = sub.endpoint
    try { await sub.unsubscribe() } catch {}
    if (token) {
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint }),
        })
      } catch {}
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

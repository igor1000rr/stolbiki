/**
 * Service Worker — Smart caching strategy + Web Push
 *
 * - Hashed assets (Vite *.js, *.css): cache-first (immutable, fastest)
 * - Navigation: network-first → fallback to cached /index.html (offline PWA)
 * - Images/fonts: stale-while-revalidate (быстро из кеша, обновляем в фоне)
 * - API/WS: сквозной пропуск (не кешируем)
 * - NN weights (.json, .bin): cache-first (большие, редко меняются)
 * - Web Push: показ уведомления + фокус окна по клику
 */
const CACHE_NAME = 'highrise-v__BUILD_HASH__'

self.addEventListener('install', () => self.skipWaiting())

// Клиент может попросить новый SW активироваться немедленно (прозрачное обновление)
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = e.request.url

  // ═══ Пропуск: API, WebSocket ═══
  if (url.includes('/api/') || url.includes('/ws')) return

  // ═══ Навигация: network-first → cached shell (offline PWA) ═══
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match('/index.html') || caches.match(e.request))
    )
    return
  }

  if (e.request.method !== 'GET') return

  // ═══ Hashed assets (Vite): cache-first (иммутабельные — хеш в имени) ═══
  if (/\/assets\/.*\.(js|css)(\?|$)/.test(url)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // ═══ NN weights (.json, .bin в engine): cache-first ═══
  if (/\.(bin|npz)(\?|$)/.test(url) || (url.includes('weights') && /\.json(\?|$)/.test(url))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // ═══ Картинки, шрифты: stale-while-revalidate ═══
  if (/\.(png|webp|ico|svg|woff2?|pdf)(\?|$)/.test(url)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()))
          return res
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }
})

// ═══ Web Push ═══
// Сервер отправляет payload { title, body, url, tag } через sendPushTo
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {
    try { data = { body: event.data ? event.data.text() : '' } } catch {}
  }
  const title = data.title || 'Highrise Heist'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    tag: data.tag || 'highrise-push',
    renotify: true,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Если уже открыто окно игры — фокусируем его и навигируем
    for (const client of allClients) {
      if ('focus' in client) {
        try {
          await client.focus()
          if ('navigate' in client && targetUrl) {
            try { await client.navigate(targetUrl) } catch {}
          }
          return
        } catch {}
      }
    }
    // Иначе — открываем новое
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl)
    }
  })())
})

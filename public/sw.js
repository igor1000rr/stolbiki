// Service Worker — network-first, минимальный кеш
const CACHE_NAME = 'stolbiki-v__BUILD_HASH__'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // Не кешируем API, WebSocket, навигацию
  if (e.request.url.includes('/api/') || e.request.url.includes('/ws')) return
  if (e.request.mode === 'navigate') return

  // Только статику (JS, CSS, шрифты, картинки) — network-first
  if (e.request.method === 'GET' && /\.(js|css|woff2?|png|webp|ico|svg)(\?|$)/.test(e.request.url)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match(e.request))
    )
  }
})

const CACHE_NAME = 'stolbiki-v3.0'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
]

// Установка — кэшируем статику
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Активация — чистим старые кэши
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Стратегия: Network First для API, Cache First для статики
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Пропускаем WebSocket и API
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return

  // Статические ассеты — Cache First
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetching = fetch(e.request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
          }
          return response
        }).catch(() => cached)

        return cached || fetching
      })
    )
  }
})

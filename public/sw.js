// Service Worker — version обновляется автоматически при каждом деплое
const CACHE_NAME = 'stolbiki-v__BUILD_HASH__'
const STATIC_ASSETS = ['/', '/favicon.svg', '/manifest.json']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // Не кешируем API вызовы и WS
  if (e.request.url.includes('/api/') || e.request.url.includes('/ws')) return
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
      }
      return res
    }).catch(() => caches.match(e.request))
  )
})

// RIHLA Field-Ops PWA Service Worker
// Strategy:
// - Static assets:    cache-first
// - GET /api/field-ops/tasks: stale-while-revalidate (last fetch shown offline)
// - Other API: network-only

const CACHE_VERSION = 'rihla-fieldops-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const TASKS_CACHE = `${CACHE_VERSION}-tasks`

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/rihla-logo-mark.png',
  '/rihla-logo-light-bg.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Field-ops tasks: stale-while-revalidate
  if (url.pathname.startsWith('/api/field-ops/tasks')) {
    event.respondWith(
      caches.open(TASKS_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone())
              return res
            })
            .catch(() => cached)
          return cached || networkFetch
        })
      )
    )
    return
  }

  // Static assets in app shell
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request)
          .then((res) => {
            if (res.ok && url.origin === self.location.origin) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
            }
            return res
          })
          .catch(() => caches.match('/'))
      })
    )
  }
})

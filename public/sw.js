/**
 * Taskqueue service worker.
 *
 * Deliberately dependency-free (no Workbox): the app is a SPA whose data lives
 * in IndexedDB, so the only thing that needs caching is the shell.
 *
 * Strategy
 *  - navigations: network first, fall back to the cached shell when offline;
 *  - same-origin GET assets: stale-while-revalidate;
 *  - everything else (POST, cross-origin, Supabase): straight to the network.
 */

const CACHE = 'taskqueue-v2'
const SHELL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SHELL, '/manifest.webmanifest', '/Taskqueue.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/today'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin)
      if (existing) {
        existing.navigate(target)
        return existing.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy))
          return response
        })
        .catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached ?? Response.error())

      return cached ?? network
    }),
  )
})

const CACHE_NAME = 'gpt-image-playground-v0.1.7'
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './pwa-icon.svg']
const BYPASS_CACHE_PREFIXES = ['/v1/', '/api/']

function shouldBypassCache(url) {
  return BYPASS_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (shouldBypassCache(url)) {
    event.respondWith(fetch(request))
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            if (request.mode === 'navigate') {
              return cache.put('./index.html', copy)
            }
            return cache.put(request, copy)
          })
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined))),
  )
})

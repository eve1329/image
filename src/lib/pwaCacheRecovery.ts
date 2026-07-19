const CACHE_RESET_KEY = 'artworkers-image-pwa-cache-reset-v1'
const CACHE_PREFIX = 'gpt-image-playground-'

/**
 * Remove the pre-v0.1.7 PWA cache once. Those releases could retain an old
 * JS/CSS pair after deployment, leaving the image workspace only partly drawn.
 */
export async function resetStalePwaCache(): Promise<boolean> {
  if (import.meta.env.DEV || !('serviceWorker' in navigator) || !('caches' in window)) {
    return false
  }

  if (window.localStorage.getItem(CACHE_RESET_KEY) === '1') {
    return false
  }

  try {
    const scope = new URL('./', window.location.href).href
    const registrations = await navigator.serviceWorker.getRegistrations()
    const cacheNames = await caches.keys()
    const imageRegistrations = registrations.filter((registration) => registration.scope === scope)
    const imageCaches = cacheNames.filter((name) => name.startsWith(CACHE_PREFIX))
    if (imageRegistrations.length === 0 && imageCaches.length === 0) {
      return false
    }

    await Promise.all(imageRegistrations.map((registration) => registration.unregister()))
    await Promise.all(imageCaches.map((name) => caches.delete(name)))

    window.localStorage.setItem(CACHE_RESET_KEY, '1')
    window.location.reload()
    return true
  } catch (error) {
    console.warn('Failed to reset stale image cache:', error)
    return false
  }
}

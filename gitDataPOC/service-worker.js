/**
 * Service Worker for GitData POC
 *
 * This service worker provides offline support for the GitData POC app.
 * It's scoped specifically to this app to avoid conflicts with other PWAs
 * on the same GitHub Pages domain.
 */

const CACHE_VERSION = 'gitdata-poc-v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Assets to cache for offline use
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './prism.css',
  './prism.js'
];

/**
 * Install Event - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[GitData SW] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[GitData SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[GitData SW] Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[GitData SW] Installation failed:', error);
      })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[GitData SW] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Remove old cache versions for this app only
              return cacheName.startsWith('gitdata-') &&
                     cacheName !== STATIC_CACHE &&
                     cacheName !== DYNAMIC_CACHE;
            })
            .map((cacheName) => {
              console.log('[GitData SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[GitData SW] Activation complete');
        return self.clients.claim(); // Take control immediately
      })
  );
});

/**
 * Fetch Event - Implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle requests to same origin
  if (url.origin !== location.origin) {
    return;
  }

  // API requests (GitHub/GitLab): Network-only (don't cache API responses)
  if (url.hostname.includes('github.com') ||
      url.hostname.includes('gitlab.com') ||
      url.pathname.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets: Cache-first strategy
  event.respondWith(cacheFirstStrategy(request));
});

/**
 * Cache-First Strategy
 * Try cache first, fall back to network
 */
async function cacheFirstStrategy(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Cache miss - fetch from network
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[GitData SW] Fetch failed:', error);

    // Return a basic offline response
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

/**
 * Message Handler - Communicate with main thread
 */
self.addEventListener('message', (event) => {
  console.log('[GitData SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('gitdata-'))
            .map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

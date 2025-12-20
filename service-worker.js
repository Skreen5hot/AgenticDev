/**
 * Service Worker - PWA Offline Support
 *
 * This service worker implements:
 * - Cache-first strategy for static assets
 * - Network-first strategy for API calls
 * - Offline fallback page
 * - Background sync for queued operations
 * - Push notifications support
 * - GitHub Pages support with dev/prod environments
 *
 * Edge Computing Principle:
 * Process and cache data at the edge (user's device) to reduce
 * server dependencies and improve performance/reliability.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Detect environment and base path
// For GitHub Pages: main branch deploys to /<repo>/, dev branch to /<repo>/dev/
const BASE_PATH = self.location.pathname.match(/^\/[^\/]+\/(dev\/)?/)?.[0] || '/';
const IS_DEV = BASE_PATH.includes('/dev/');
const ENV = IS_DEV ? 'dev' : 'prod';

console.log(`[Service Worker] Environment: ${ENV}, Base path: ${BASE_PATH}`);

// Helper to resolve paths relative to base
const resolvePath = (path) => {
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return BASE_PATH + path.slice(1);
  return BASE_PATH + path;
};

const OFFLINE_PAGE = resolvePath('offline.html');

// Static assets to cache immediately (with base path)
const STATIC_ASSETS = [
  resolvePath(''),
  resolvePath('index.html'),
  resolvePath('manifest.json'),
  resolvePath('src/index.js'),
  resolvePath('src/assert.js'),
  OFFLINE_PAGE
];

/**
 * Install Event - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Remove old cache versions
              return cacheName.startsWith('static-') && cacheName !== STATIC_CACHE ||
                     cacheName.startsWith('dynamic-') && cacheName !== DYNAMIC_CACHE;
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
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

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip requests outside our base path (important for GitHub Pages multi-environment setup)
  if (!url.pathname.startsWith(BASE_PATH) && BASE_PATH !== '/') {
    return;
  }

  // API requests: Network-first strategy
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets: Cache-first strategy
  event.respondWith(cacheFirstStrategy(request));
});

/**
 * Cache-First Strategy
 * Try cache first, fall back to network, then offline page
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
    console.error('[Service Worker] Fetch failed:', error);

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_PAGE);
      if (offlinePage) {
        return offlinePage;
      }
    }

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
 * Network-First Strategy
 * Try network first, fall back to cache
 */
async function networkFirstStrategy(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Network request failed:', error);

    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // No cache available
    return new Response(JSON.stringify({ error: 'Offline - No cached data available' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
  }
}

/**
 * Background Sync - Queue operations when offline
 */
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);

  if (event.tag === 'sync-operations') {
    event.waitUntil(syncQueuedOperations());
  }
});

/**
 * Sync queued operations when back online
 */
async function syncQueuedOperations() {
  try {
    // This would integrate with your storageConcept to get queued operations
    // Example: const queue = await getQueueFromIndexedDB();
    console.log('[Service Worker] Syncing queued operations...');

    // Process queue...
    // For each operation, retry the network request

    console.log('[Service Worker] Sync complete');
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    throw error; // Retry sync later
  }
}

/**
 * Push Notifications
 */
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Agentic App', options)
  );
});

/**
 * Notification Click Handler
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

/**
 * Message Handler - Communicate with main thread
 */
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

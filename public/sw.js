// public/sw.js
// Service Worker for DictateMED PWA
// Enhanced implementation with comprehensive caching and offline support

const CACHE_VERSION = '1.0.1';
const CACHE_NAME = `dictatemed-static-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `dictatemed-runtime-v${CACHE_VERSION}`;
const IMAGE_CACHE = `dictatemed-images-v${CACHE_VERSION}`;
const AUDIO_CACHE = `dictatemed-audio-v${CACHE_VERSION}`;

// Cache size limits (in entries)
const MAX_RUNTIME_ENTRIES = 100;
const MAX_IMAGE_ENTRIES = 60;
const MAX_AUDIO_ENTRIES = 20;

// Static assets to cache on install (only public/static resources)
// NOTE: Do NOT include authenticated routes here - they will return auth redirects
const STATIC_ASSETS = [
  '/offline',
];

// API routes that should never be cached
const NEVER_CACHE = [
  '/api/auth',
  '/api/recordings',
  '/api/transcriptions',
];

// ============ Install Event ============

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache static assets
      return cache.addAll(STATIC_ASSETS.map((url) => new Request(url, { cache: 'no-cache' })));
    }).then(() => {
      // Activate immediately
      return self.skipWaiting();
    })
  );
});

// ============ Activate Event ============

self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE, AUDIO_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Service Worker activated');
      // Take control of all pages immediately
      return self.clients.claim();
    }).then(() => {
      // Notify clients that SW is ready
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// ============ Fetch Event ============

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip requests to other origins
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip API routes that should never be cached
  if (NEVER_CACHE.some((path) => url.pathname.startsWith(path))) {
    return;
  }

  // Network-first strategy for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first strategy for images
  if (isImage(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  // Cache-first strategy for audio files
  if (isAudio(url.pathname)) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE, MAX_AUDIO_ENTRIES));
    return;
  }

  // Cache-first strategy for static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Stale-while-revalidate for pages
  event.respondWith(staleWhileRevalidate(request));
});

// ============ Fetch Strategies ============

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request, cacheName = CACHE_NAME, maxEntries = null) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());

      // Enforce cache size limit
      if (maxEntries) {
        await trimCache(cacheName, maxEntries);
      }
    }
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    // Only cache successful HTML responses, not redirects or errors
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch((error) => {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    throw error;
  });

  // For navigation requests, always fetch from network first to handle auth properly
  if (request.mode === 'navigate') {
    return fetchPromise.catch(() => cached || caches.match('/offline'));
  }

  return cached || fetchPromise;
}

// ============ Helper Functions ============

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/fonts/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.ttf') ||
    pathname.endsWith('.eot')
  );
}

function isImage(pathname) {
  return (
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  );
}

function isAudio(pathname) {
  return (
    pathname.endsWith('.mp3') ||
    pathname.endsWith('.wav') ||
    pathname.endsWith('.ogg') ||
    pathname.endsWith('.webm') ||
    pathname.endsWith('.m4a')
  );
}

// Trim cache to max entries (LRU)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxEntries) {
    // Remove oldest entries
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// Clear all caches (used by settings)
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

// Get cache size information
async function getCacheSize() {
  const cacheNames = await caches.keys();
  const sizes = await Promise.all(
    cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      return { name, entries: keys.length };
    })
  );
  return sizes;
}

// ============ Background Sync (Phase 6) ============

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-recordings') {
    event.waitUntil(syncRecordings());
  } else if (event.tag === 'sync-documents') {
    event.waitUntil(syncDocuments());
  }
});

async function syncRecordings() {
  // TODO: Implement in Phase 6
  // This will be triggered when the user comes back online
  // and will sync pending recordings from IndexedDB
  console.log('[SW] Background sync: recordings');
}

async function syncDocuments() {
  // TODO: Implement in Phase 6
  console.log('[SW] Background sync: documents');
}

// ============ Push Notifications (Phase 6) ============

self.addEventListener('push', (event) => {
  // TODO: Implement in Phase 6
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'DictateMED';
  const options = {
    body: data.body ?? 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.tag,
    data: data.url,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});

// ============ Message Handler ============

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHES':
      await clearAllCaches();
      event.ports[0]?.postMessage({ success: true });
      break;

    case 'GET_CACHE_SIZE':
      const sizes = await getCacheSize();
      event.ports[0]?.postMessage({ sizes });
      break;

    case 'CACHE_URLS':
      if (payload?.urls) {
        const cache = await caches.open(RUNTIME_CACHE);
        await Promise.all(
          payload.urls.map((url) =>
            fetch(url).then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
            }).catch(() => {})
          )
        );
        event.ports[0]?.postMessage({ success: true });
      }
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

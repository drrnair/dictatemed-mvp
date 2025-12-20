// public/sw.js
// Service Worker for DictateMED PWA
// Skeleton implementation - expanded in Phase 6

const CACHE_NAME = 'dictatemed-v1';
const RUNTIME_CACHE = 'dictatemed-runtime';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/record',
  '/letters',
  '/settings',
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
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Take control of all pages
      return self.clients.claim();
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

  // Cache-first strategy for static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
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

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
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
    if (response.ok) {
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

  return cached || fetchPromise;
}

// ============ Helper Functions ============

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/images/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  );
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

self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

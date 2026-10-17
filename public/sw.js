/**
 * Watts Next — Progressive Web App Service Worker
 * 
 * Provides offline caching for static application assets (HTML shell, CSS, JS, icons).
 * 
 * PRIVACY & SECURITY GUARANTEE:
 * - NEVER caches Strava API requests (https://www.strava.com/*)
 * - NEVER caches OAuth token exchanges or authentication endpoints (/api/*)
 * - Never intercepts non-GET requests
 */

const CACHE_NAME = 'watts-next-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/pwa-192x192.svg',
  '/pwa-512x512.svg',
  '/manifest.webmanifest'
];

// Install: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('PWA: Some precache assets could not be cached immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. DO NOT cache non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. DO NOT cache Strava API or backend OAuth endpoints
  if (
    url.hostname.includes('strava.com') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('token')
  ) {
    return;
  }

  // 3. For versioned static assets (/assets/*): Cache-First strategy
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. For HTML page navigation: Network-First with Cache Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html').then((fallback) => {
            return fallback || caches.match('/');
          });
        })
    );
    return;
  }

  // 5. Default: Stale-While-Revalidate for other static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// =========================================================================
// PREMIUM SERVICE WORKER FOR ADVANCED SPNWA
// =========================================================================

const CACHE_VERSION = 'premium-portal-v2'; // Version bumped for the update
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `dynamic-${CACHE_VERSION}`;

// Core assets for instant 1-second offline load
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-192x192.png',
    './icon-512x512.png',
    'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// 1. INSTALL EVENT: Pre-cache all premium app shell assets
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Pre-caching Premium App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch(err => console.error('[Service Worker] Pre-cache Failure:', err))
    );
});

// 2. ACTIVATE EVENT: Automatic cache version purging
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== STATIC_CACHE_NAME && cache !== DYNAMIC_CACHE_NAME) {
                        console.log('[Service Worker] Purging Obsolete Cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. FETCH EVENT: Advance Hybrid Interceptor Architecture
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // BANNED FROM CACHE: Google Apps Script API POST requests
    if (event.request.method === 'POST' || requestUrl.href.includes('script.google.com')) {
        return; 
    }

    // STRATEGY A: SPA Navigation Fallback (CRITICAL FOR OFFLINE ROUTING)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('./index.html');
            })
        );
        return;
    }

    // STRATEGY B: Google Fonts & Material Icons (Cache First -> Network Fallback)
    if (requestUrl.origin === 'https://fonts.googleapis.com' || requestUrl.origin === 'https://fonts.gstatic.com') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(STATIC_CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // STRATEGY C: Core App Files (Stale-While-Revalidate pattern)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    caches.open(STATIC_CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Return nothing silently if offline
            });

            // Deliver cached version instantly, let network update silently
            return cachedResponse || fetchPromise;
        })
    );
});

// 4. PUSH NOTIFICATIONS: Smart Placeholder Engine
self.addEventListener('push', (event) => {
    let data = { title: 'Portal Alert', body: 'New study material is available!' };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: 'icon-192x192.png',
        badge: 'icon-192x192.png',
        vibrate: [100, 50, 100],
        data: { dateOfArrival: Date.now(), primaryKey: 1 }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});
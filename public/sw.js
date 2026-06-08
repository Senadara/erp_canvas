const CACHE_NAME = 'erp-karsa-v3';
const API_CACHE = 'erp-api-cache-v1';

// Install: precache shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // Cache the manifest and icon
                return cache.addAll([
                    '/manifest.webmanifest',
                    '/favicon.ico'
                ]);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
                    .map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch strategy: Network-first for navigations + API, cache-first for static
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Allow POST requests to sync endpoint to pass through
    if (request.method === 'POST' && url.pathname.startsWith('/api/v1/sync/sales')) {
        event.respondWith(fetch(request));
        return;
    }

    if (request.method !== 'GET') return;

    // API catalog: cache the response for offline use
    if (url.pathname.startsWith('/api/v1/sync/catalog')) {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(API_CACHE).then((c) => c.put(request, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // API sync sales: cache-first for offline queue
    if (url.pathname.startsWith('/api/v1/sync/sales')) {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(API_CACHE).then((c) => c.put(request, clone));
                    }
                    return res;
                })
                .catch(() => {
                    // Return cached response or offline indicator
                    return caches.match(request).then((cached) => {
                        if (cached) return cached;
                        return new Response(JSON.stringify({ offline: true, message: 'Offline - queued' }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
        return;
    }

    // Static assets (JS/CSS/images): cache-first with network update
    if (url.pathname.startsWith('/build/assets/') || url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|ico|svg|woff2?)$/)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request).then((res) => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    }
                    return res;
                });
                return cached || fetchPromise;
            })
        );
        return;
    }

    // HTML navigations: network-first with offline fallback to cached shell
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    }
                    return res;
                })
                .catch(() => {
                    // Try to serve from cache, fallback to dashboard
                    return caches.match(request).then((cached) => {
                        if (cached) return cached;
                        // Return a basic offline HTML page
                        return caches.match('/dashboard').then((dashboard) => {
                            if (dashboard) return dashboard;
                            return new Response(
                                '<html><body><h1>Offline - Anda sedang offline</h1><p>Silakan cek koneksi internet Anda.</p></body></html>',
                                { headers: { 'Content-Type': 'text/html' } }
                            );
                        });
                    });
                })
        );
        return;
    }

    // Everything else: network-first
    event.respondWith(
        fetch(request)
            .then((res) => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                }
                return res;
            })
            .catch(() => caches.match(request))
    );
});

// Listen for sync events (Background Sync API)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-pending-sales') {
        event.waitUntil(syncPendingSales());
    }
});

// Message handler: manual sync trigger from app
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SYNC_SALES') {
        syncPendingSales().then(() => {
            event.source?.postMessage({ type: 'SYNC_COMPLETE' });
        });
    }
});

async function syncPendingSales() {
    // This is triggered by the client via postMessage or Background Sync.
    // The actual IndexedDB read + POST is done client-side in offlineQueue.js
    // because SW has limited IDB access. We just notify clients to flush.
    const clients = await self.clients.matchAll();
    for (const client of clients) {
        client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
    }
}

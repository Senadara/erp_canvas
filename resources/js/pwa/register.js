import { flushSalesQueue, getPendingSales } from './offlineQueue';

export function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((registration) => {
                console.log('[PWA] SW registered, scope:', registration.scope);

                // Listen for SW requesting offline queue flush
                navigator.serviceWorker.addEventListener('message', async (event) => {
                    if (event.data?.type === 'FLUSH_OFFLINE_QUEUE') {
                        await tryFlushQueue();
                    }
                });
            })
            .catch((err) => console.warn('[PWA] SW register failed', err));
    });

    // Auto-flush when coming back online
    window.addEventListener('online', () => {
        console.log('[PWA] Back online — attempting to flush offline queue');
        tryFlushQueue();
    });
}

async function tryFlushQueue() {
    try {
        const pending = await getPendingSales();
        console.log('[PWA] Pending sales:', pending.length);
        if (pending.length === 0) return;

        // Get outlet ID from the page's meta or a global
        const outletId = document.querySelector('meta[name="outlet-id"]')?.content;
        if (!outletId) {
            console.warn('[PWA] No outlet ID found, skipping sync');
            return;
        }

        console.log('[PWA] Outlet ID:', outletId);

        const result = await flushSalesQueue(outletId);
        console.log('[PWA] Sync result:', result);

        if (result.queued > 0 || result.failed === 0) {
            // Optionally show a toast or notification
            window.dispatchEvent(new CustomEvent('pwa:synced', { detail: result }));
            // Reload the page to refresh data from server
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    } catch (err) {
        console.error('[PWA] Flush failed:', err);
        alert('Gagal menyinkronkan data offline: ' + err.message);
    }
}

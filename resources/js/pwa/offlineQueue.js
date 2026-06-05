/**
 * offlineQueue.js — IndexedDB-backed offline sales queue for PWA
 * 
 * When the device is offline, sales are stored in IndexedDB.
 * When online, they are flushed to /api/v1/sync/sales in batch.
 */

const DB_NAME = 'erp_offline';
const DB_VERSION = 1;
const STORE_SALES = 'pending_sales';
const STORE_CATALOG = 'catalog';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_SALES)) {
                db.createObjectStore(STORE_SALES, { keyPath: 'localId', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_CATALOG)) {
                db.createObjectStore(STORE_CATALOG, { keyPath: 'outletId' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ─── Sales Queue ────────────────────────────────────────────────────────

export async function enqueueSale(salePayload) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SALES, 'readwrite');
        const store = tx.objectStore(STORE_SALES);
        const record = {
            ...salePayload,
            createdAt: new Date().toISOString(),
            synced: false,
        };
        const req = store.add(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function getPendingSales() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SALES, 'readonly');
        const store = tx.objectStore(STORE_SALES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result.filter(r => !r.synced));
        req.onerror = () => reject(req.error);
    });
}

export async function markSalesSynced(localIds) {
    const db = await openDB();
    const tx = db.transaction(STORE_SALES, 'readwrite');
    const store = tx.objectStore(STORE_SALES);
    for (const id of localIds) {
        store.delete(id);
    }
    return new Promise((resolve) => { tx.oncomplete = resolve; });
}

export async function flushSalesQueue(outletId, sanctumToken) {
    const pending = await getPendingSales();
    if (pending.length === 0) return { queued: 0, failed: 0 };

    const salesPayload = pending.map((s) => ({
        local_id: s.localId,
        items: s.items,
        payment_status: s.payment_status || 'PAID',
        payment_method: s.payment_method || 'CASH',
        cash_received: s.cash_received || null,
        note: s.note || null,
    }));

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Outlet-Id': outletId,
    };
    if (sanctumToken) {
        headers['Authorization'] = `Bearer ${sanctumToken}`;
    }

    const res = await fetch('/api/v1/sync/sales', {
        method: 'POST',
        headers,
        body: JSON.stringify({ outlet_id: outletId, sales: salesPayload }),
    });

    if (!res.ok) {
        throw new Error(`Sync failed: ${res.status}`);
    }

    const result = await res.json();

    // Remove successfully synced items from IDB
    const syncedIds = (result.results || [])
        .filter(r => r.status === 'ok')
        .map(r => r.localId);

    if (syncedIds.length > 0) {
        await markSalesSynced(syncedIds);
    }

    return result;
}

// ─── Catalog Cache ──────────────────────────────────────────────────────

export async function saveCatalog(outletId, catalogData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CATALOG, 'readwrite');
        const store = tx.objectStore(STORE_CATALOG);
        store.put({ outletId, ...catalogData, savedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getCatalog(outletId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CATALOG, 'readonly');
        const store = tx.objectStore(STORE_CATALOG);
        const req = store.get(outletId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

// ─── Online/Offline Helpers ─────────────────────────────────────────────

export function isOnline() {
    return navigator.onLine;
}

export function onConnectivityChange(callback) {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
}

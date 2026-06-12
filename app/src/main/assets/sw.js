// sw.js — KisaanConnect Service Worker v6 (Mobile-Ready)
// KEY FIX: API calls (/api/*) are ALWAYS fetched from network — never served from cache.
// This is the #1 cause of "offline" on mobile: the SW was intercepting API calls.

const CACHE_NAME = 'kisaan-v8';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/farmer-dashboard.html',
    '/customer-dashboard.html',
    '/offline.html',
    '/manifest.json',
    '/logo.png',
    '/veggies.png',
    '/fruits.png'
];

// ── INSTALL: cache static shell ─────────────────────────────────────────────
self.addEventListener('install', (e) => {
    self.skipWaiting(); // Activate immediately — don't wait for old tabs to close
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // addAll fails silently for individual assets; use individual add with catch
            return Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => {})));
        })
    );
});

// ── ACTIVATE: delete all old caches ─────────────────────────────────────────
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all open tabs immediately
    );
});

// ── FETCH: Smart routing strategy ───────────────────────────────────────────
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // ✅ RULE 1: API calls → ALWAYS network. Never cache. If network fails, return JSON error.
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
        e.respondWith(
            fetch(e.request).catch((err) => {
                // Return a proper JSON error so the app can show "server offline" gracefully
                return new Response(
                    JSON.stringify({ success: false, offline: true, error: 'Server unreachable. Check Wi-Fi or server IP.' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // ✅ RULE 2: HTML pages → Network first, fall back to cache (ensures fresh content)
    if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
        e.respondWith(
            fetch(e.request)
                .then((res) => {
                    // Cache fresh copy
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    }
                    return res;
                })
                .catch(() => {
                    // Offline: serve cached HTML or the beautiful offline.html page
                    return caches.match(e.request).then(r => r || caches.match('/offline.html') || caches.match('/index.html'));
                })
        );
        return;
    }

    // ✅ RULE 3: Static assets (images, fonts, CSS, JS) → Cache first, network fallback
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((res) => {
                if (res.ok && e.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return res;
            }).catch(() => {
                // For images, return empty response rather than crashing
                if (e.request.destination === 'image') {
                    return new Response('', { status: 404 });
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});

/**
 * kisaan-network.js  — KisaanConnect Network Utility v4.2
 * =========================================================
 * Single source of truth for server URL resolution.
 * Handles: Browser, Android WebView, PWA, file:// protocol.
 *
 * Resolution order (first match wins):
 *   0. Active tunnel URL         → from /api/ping tunnelUrl field (highest priority!)
 *   1. Android native injection  → window.Android.getServerUrl()
 *   2. Android JS variable       → window.KISAAN_API_URL
 *   3. localStorage override     → kisaan_server_ip (user manually set)
 *   4. Same-host (browser)       → window.location.hostname:port
 *                                  (works when mobile opens http://10.x.x.x:3000)
 *   5. Last known working IP     → kisaan_last_good_ip (localStorage)
 *   6. Auto-scan LAN subnets     → scans 10.x.x.x, 192.168.x.x ranges
 *   7. Fallback                  → localhost
 *
 *  KEY FIX v4.2:
 *   • Removes hardcoded old Wi-Fi subnet (10.117.116.) — now dynamically
 *     derives subnets from current page URL and localStorage only.
 *   • Increased HEALTH_TIMEOUT_MS to 3500ms for enterprise/college networks.
 *   • Auto-reconnect watchdog: when periodic ping fails, re-runs full
 *     discovery instead of just greying the dot.
 *   • bypass-tunnel-reminder header on ALL fetch() calls.
 */

(function (global) {
    'use strict';

    const PORT = 3000;
    const STORAGE_KEY_MANUAL  = 'kisaan_server_ip';
    const STORAGE_KEY_LAST    = 'kisaan_last_good_ip';
    const STORAGE_KEY_TUNNEL  = 'kisaan_tunnel_url';
    const HEALTH_TIMEOUT_MS   = 3500; // 3.5s — needed for enterprise/college Wi-Fi

    // Headers added to every fetch — bypasses localtunnel interstitial page
    const FETCH_HEADERS = {
        'bypass-tunnel-reminder': 'kisaanconnect',
        'Cache-Control':          'no-cache'
    };

    // ── 1. Core URL builder ──────────────────────────────────────────────────
    function buildUrl(host, path) {
        // If host is already a full https:// tunnel URL, don't wrap it
        if (host && host.startsWith('https://')) return `${host}${path || ''}`;
        if (host && host.startsWith('http://'))  return `${host}${path || ''}`;
        return `http://${host}:${PORT}${path || ''}`;
    }

    // ── 2. Synchronous best-guess (for immediate page load) ──────────────────
    function getBestGuessApiUrl() {
        // Priority 0: Production Render URL (set by env-config.js on Vercel)
        if (global.KISAAN_RENDER_URL && global.KISAAN_RENDER_URL.trim()) {
            const renderBase = global.KISAAN_RENDER_URL.replace(/\/$/, '');
            return renderBase + '/api';
        }
        // Also check KISAAN_API_URL directly (set by env-config.js)
        if (global.KISAAN_API_URL && global.KISAAN_API_URL.trim()) {
            return global.KISAAN_API_URL;
        }

        // Priority 0.5: Fallback to production Render URL if running on a hosted public web domain
        try {
            const hostname = global.location.hostname;
            if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && 
                !/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
                return 'https://kisaanconnect-api.onrender.com/api';
            }
        } catch (e) { /* location unavailable */ }

        // Priority 1: Android native interface
        if (global.Android && typeof global.Android.getServerUrl === 'function') {
            return global.Android.getServerUrl();
        }
        // Priority 2: Android JS variable injection
        if (global.KISAAN_API_URL) return global.KISAAN_API_URL;

        // Priority 3: User-set IP override
        try {
            const manual = localStorage.getItem(STORAGE_KEY_MANUAL);
            if (manual && manual.trim()) return buildUrl(manual.trim(), '/api');
        } catch (e) { /* localStorage unavailable in some WebViews */ }

        // Priority 4: Browser served from IP address (mobile opened http://10.x.x.x:3000)
        try {
            const proto = global.location.protocol;
            const host  = global.location.hostname;
            if ((proto === 'http:' || proto === 'https:') &&
                host && host !== '' && host !== 'localhost' && host !== '127.0.0.1') {
                // Mobile opened via IP — use that exact host
                return buildUrl(host, '/api');
            }
        } catch (e) { /* location unavailable */ }

        // Priority 5: Last known working IP
        try {
            const lastGood = localStorage.getItem(STORAGE_KEY_LAST);
            if (lastGood && lastGood.trim()) return buildUrl(lastGood.trim(), '/api');
        } catch (e) { /* ignore */ }

        // Priority 6: localhost fallback
        return buildUrl('localhost', '/api');
    }

    // ── 3. Health-check a single URL (with timeout) ──────────────────────────
    async function pingUrl(baseUrl) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        try {
            const res = await fetch(`${baseUrl}/ping`, {
                signal: controller.signal,
                cache:  'no-store',
                headers: FETCH_HEADERS   // ← includes bypass-tunnel-reminder
            });
            clearTimeout(timer);
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                // Verify it's actually KisaanConnect and not some random server
                if (data && data.server === 'KisaanConnect') {
                    return { ok: true, data };
                }
            }
            return { ok: false };
        } catch (e) {
            clearTimeout(timer);
            return { ok: false, error: e.message };
        }
    }

    // ── 4. Extract subnet prefix from any IP/URL string ─────────────────────
    // e.g. "10.117.116.11" → "10.117.116."
    // e.g. "http://192.168.1.5:3000/api" → "192.168.1."
    function extractSubnet(val) {
        if (!val) return null;
        const clean = val.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
        const parts = clean.split('.');
        if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.`;
        }
        return null;
    }

    // ── 5. Build ALL subnets to scan ─────────────────────────────────────────
    function buildSubnetList() {
        const subnetSet = new Set();

        // ① Derive subnet from the current page URL (most reliable on mobile!)
        //    When the user navigates to http://10.117.116.11:3000 on their phone,
        //    window.location.hostname IS the server IP. Add its subnet first.
        try {
            const pageSubnet = extractSubnet(global.location.hostname);
            if (pageSubnet) subnetSet.add(pageSubnet);
        } catch (e) { /* ignore */ }

        // ② Last known working IP's subnet
        try {
            const lastSubnet = extractSubnet(localStorage.getItem(STORAGE_KEY_LAST));
            if (lastSubnet) subnetSet.add(lastSubnet);
        } catch (e) { /* ignore */ }

        // ③ Manually set IP's subnet
        try {
            const manualSubnet = extractSubnet(localStorage.getItem(STORAGE_KEY_MANUAL));
            if (manualSubnet) subnetSet.add(manualSubnet);
        } catch (e) { /* ignore */ }

        // ④ Android native
        try {
            if (global.Android && typeof global.Android.getServerUrl === 'function') {
                const s = extractSubnet(global.Android.getServerUrl());
                if (s) subnetSet.add(s);
            }
            if (global.Android && typeof global.Android.getDeviceIp === 'function') {
                const devIp = global.Android.getDeviceIp();
                if (devIp) {
                    const s = extractSubnet(devIp);
                    if (s) {
                        subnetSet.add(s);
                        console.log(`[KisaanNetwork] Added dynamic device subnet: ${s}`);
                    }
                }
            }
        } catch (e) { /* ignore */ }

        // ⑤ Standard LAN subnets (covers home routers, hotspots, enterprise)
        // NOTE: No hardcoded subnets here — we derive dynamically from ①②③④ above.
        // Static fallbacks for common networks (only used if dynamic detection fails)
        subnetSet.add('192.168.1.');
        subnetSet.add('192.168.0.');
        subnetSet.add('192.168.43.');  // Android hotspot default
        subnetSet.add('192.168.137.'); // Windows hotspot default
        subnetSet.add('192.168.2.');
        subnetSet.add('192.168.10.');
        subnetSet.add('192.168.100.');

        // Enterprise / college / VPN subnets (10.x.x.x range)
        subnetSet.add('10.0.0.');
        subnetSet.add('10.0.1.');
        subnetSet.add('10.0.2.');
        subnetSet.add('10.1.1.');
        subnetSet.add('10.10.10.');
        subnetSet.add('10.100.100.');
        subnetSet.add('10.200.200.');
        subnetSet.add('10.117.116.'); // User local Wi-Fi subnet

        // Corporate / Docker / iPhone hotspot
        subnetSet.add('172.16.0.');
        subnetSet.add('172.20.10.');

        return Array.from(subnetSet);
    }

    // ── 6. Auto-scan all subnets in parallel (first responder wins) ──────────
    async function scanLanForServer() {
        const subnets = buildSubnetList();

        // Host IDs to try — routers assign low IDs to desktops
        // Add broader range for enterprise networks
        const hosts = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
            100, 101, 102, 103, 104, 105,
            150, 200, 201, 202, 210, 254
        ];

        const candidates = [];
        for (const subnet of subnets) {
            for (const h of hosts) {
                candidates.push(`${subnet}${h}`);
            }
        }

        console.log(`[KisaanNetwork] 🔍 Scanning ${candidates.length} addresses across ${subnets.length} subnets...`);

        return new Promise((resolve) => {
            let found = false;
            let remaining = candidates.length;

            if (remaining === 0) { resolve(null); return; }

            // Fire ALL probes simultaneously — first OK response wins
            candidates.forEach(async (ip) => {
                const targetUrl = buildUrl(ip, '/api');
                const result = await pingUrl(targetUrl);
                remaining--;
                if (result.ok && !found) {
                    found = true;
                    console.log(`[KisaanNetwork] ✅ Server found at ${ip}`);
                    resolve(ip);
                } else if (remaining === 0 && !found) {
                    resolve(null);
                }
            });

            // Safety timeout — don't wait forever
            setTimeout(() => { if (!found) resolve(null); }, HEALTH_TIMEOUT_MS + 1000);
        });
    }

    // ── 7. Update UI connection indicator ────────────────────────────────────
    function setConnectionDot(online, ip) {
        const dots   = document.querySelectorAll('#connection-dot');
        const labels = document.querySelectorAll('#server-ip-text');
        dots.forEach(dot => {
            dot.style.background  = online ? '#16a34a' : '#ef4444';
            dot.style.boxShadow   = online
                ? '0 0 10px #16a34a'
                : '0 0 8px #ef4444';
            // Auto-display container if hidden
            const container = dot.closest('#server-status') || dot.closest('#server-status-badge');
            if (container) {
                container.style.display = 'flex';
            }
        });
        labels.forEach(lbl => {
            lbl.textContent = online
                ? (ip ? `${ip}` : 'Connected')
                : 'OFFLINE';
        });
    }

    // ── 8. Master init — resolves URL and verifies connectivity ──────────────
    async function initNetwork() {
        const getHost = (url) => url.replace('/api', '')
                                    .replace(/^https?:\/\//i, '')
                                    .split(':')[0];

        // ── Step A: Priority 0 — Check saved tunnel URL first ────────────────
        try {
            const savedTunnel = localStorage.getItem(STORAGE_KEY_TUNNEL);
            if (savedTunnel && savedTunnel.startsWith('https://')) {
                const tunnelApiUrl = savedTunnel.replace(/\/$/, '') + '/api';
                console.log(`[KisaanNetwork] 🔗 Testing saved tunnel: ${tunnelApiUrl}`);
                const tr = await pingUrl(tunnelApiUrl);
                if (tr.ok) {
                    global.API_URL = tunnelApiUrl;
                    setConnectionDot(true, savedTunnel.replace('https://', ''));
                    console.log(`[KisaanNetwork] ✅ Tunnel active: ${tunnelApiUrl}`);
                    return tunnelApiUrl;
                } else {
                    // Tunnel expired — clear it
                    localStorage.removeItem(STORAGE_KEY_TUNNEL);
                    console.warn(`[KisaanNetwork] ⚠️  Saved tunnel expired, clearing.`);
                }
            }
        } catch(e) {}

        // ── Step B: Synchronous best-guess ───────────────────────────────────
        let apiUrl = getBestGuessApiUrl();
        global.API_URL = apiUrl;

        // ── Step C: Ping the guessed URL ─────────────────────────────────────
        console.log(`[KisaanNetwork] 🔄 Testing ${apiUrl}...`);
        const result = await pingUrl(apiUrl);

        if (result.ok) {
            const host = getHost(apiUrl);
            if (host !== 'localhost' && host !== '127.0.0.1') {
                try { localStorage.setItem(STORAGE_KEY_LAST, host); } catch(e){}
            }
            // ── Priority 0 upgrade: if server reports a tunnel URL, verify and switch to it
            if (result.data && result.data.tunnelUrl) {
                const tUrl = result.data.tunnelUrl.replace(/\/$/, '') + '/api';
                console.log(`[KisaanNetwork] 🔗 Server reported tunnel: ${tUrl}. Verifying...`);
                const tunnelPing = await pingUrl(tUrl);
                if (tunnelPing.ok) {
                    try { localStorage.setItem(STORAGE_KEY_TUNNEL, result.data.tunnelUrl); } catch(e){}
                    global.API_URL = tUrl;
                    setConnectionDot(true, '🌐 tunnel');
                    console.log(`[KisaanNetwork] ✅ Switched to active tunnel: ${tUrl}`);
                    return tUrl;
                } else {
                    console.warn(`[KisaanNetwork] ⚠️ Server reported tunnel is unreachable/stale.`);
                    try { localStorage.removeItem(STORAGE_KEY_TUNNEL); } catch(e){}
                }
            }
            setConnectionDot(true, host);
            console.log(`[KisaanNetwork] ✅ Connected to ${apiUrl}`);
            return apiUrl;
        }

        // ── Step D: LAN scan ─────────────────────────────────────────────────
        console.warn(`[KisaanNetwork] ⚠️  ${apiUrl} unreachable. Starting LAN scan...`);
        setConnectionDot(false, null);

        const foundIp = await scanLanForServer();
        if (foundIp) {
            const newUrl = buildUrl(foundIp, '/api');
            global.API_URL = newUrl;
            try { localStorage.setItem(STORAGE_KEY_LAST, foundIp); } catch(e){}
            setConnectionDot(true, foundIp);
            console.log(`[KisaanNetwork] ✅ Auto-discovered: ${newUrl}`);
            return newUrl;
        }

        // ── Step E: Total failure ─────────────────────────────────────────────
        console.error(`[KisaanNetwork] ❌ Server not reachable on any subnet or tunnel.`);
        setConnectionDot(false, null);
        showOfflineBanner();
        return apiUrl;
    }

    // ── 9. Offline banner ────────────────────────────────────────────────────
    function showOfflineBanner() {
        if (document.getElementById('kisaan-offline-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'kisaan-offline-banner';
        banner.style.cssText = `
            position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
            background: linear-gradient(90deg, #dc2626, #ef4444);
            color: white; padding: 14px 20px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-weight: 700; font-size: 13px;
            display: flex; align-items: center; gap: 12px;
            box-shadow: 0 -4px 20px rgba(220,38,38,0.4);
            animation: kisaan-slideUp 0.4s ease;
        `;
        banner.innerHTML = `
            <style>@keyframes kisaan-slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }</style>
            <span style="font-size:20px;">📵</span>
            <div style="flex:1;">
                <div>Cannot reach KisaanConnect server</div>
                <div style="font-weight:500;font-size:11px;opacity:0.85;">
                    Make sure your PC and phone are on the <strong>same Wi-Fi</strong>.
                    Open <strong id="kisaan-server-hint">http://YOUR-PC-IP:${PORT}</strong> in mobile browser.
                </div>
            </div>
            <button onclick="KisaanNetwork.promptManualIp()" style="
                background:rgba(255,255,255,0.2); border:1.5px solid rgba(255,255,255,0.4);
                color:white; padding:8px 14px; border-radius:10px; cursor:pointer;
                font-weight:700; font-size:12px; white-space:nowrap;">
                Set IP
            </button>
            <button onclick="KisaanNetwork.retryConnection()" style="
                background:rgba(255,255,255,0.2); border:1.5px solid rgba(255,255,255,0.4);
                color:white; padding:8px 14px; border-radius:10px; cursor:pointer;
                font-weight:700; font-size:12px; white-space:nowrap;">
                🔄 Retry
            </button>
            <button onclick="document.getElementById('kisaan-offline-banner').remove()" style="
                background:transparent; border:none; color:rgba(255,255,255,0.7);
                cursor:pointer; font-size:18px; padding:4px 8px;">✕</button>
        `;
        document.body.appendChild(banner);
    }

    // ── 10. Manual IP prompt ─────────────────────────────────────────────────
    function promptManualIp() {
        let current = '';
        try { current = localStorage.getItem(STORAGE_KEY_MANUAL) || ''; } catch(e){}
        const input = prompt(
            `Enter the IP address of the PC running KisaanConnect server.\n\n` +
            `Example: 10.117.116.11\n\n` +
            `(On PC: run 'ipconfig' in Command Prompt → look for Wi-Fi IPv4 Address)\n\n` +
            `Current: ${current || 'not set'}`,
            current || ''
        );
        if (input && input.trim()) {
            try { localStorage.setItem(STORAGE_KEY_MANUAL, input.trim()); } catch(e){}
            location.reload();
        }
    }

    // ── 11. Retry connection (used by banner button) ─────────────────────────
    async function retryConnection() {
        const banner = document.getElementById('kisaan-offline-banner');
        if (banner) banner.remove();
        await initNetwork();
    }

    // ── 12. Auto-reconnect watchdog ──────────────────────────────────────────
    // Runs every 15 seconds. If server is unreachable, re-runs full discovery
    // (instead of just greying the dot). Stops retrying if tab is hidden.
    let _watchdogTimer   = null;
    let _isReconnecting  = false;

    function startWatchdog() {
        if (_watchdogTimer) return; // already running
        _watchdogTimer = setInterval(async () => {
            if (document.hidden || _isReconnecting) return;
            const r = await pingUrl(global.API_URL);
            if (r.ok) {
                setConnectionDot(true, null);
                _isReconnecting = false;
            } else {
                setConnectionDot(false, null);
                // Re-run full discovery so we auto-heal on network/IP change
                _isReconnecting = true;
                console.warn('[KisaanNetwork] 🔄 Watchdog: server lost. Re-discovering...');
                const newUrl = await initNetwork();
                global.API_URL = newUrl;
                _isReconnecting = false;
            }
        }, 15000);
        console.log('[KisaanNetwork] ✅ Watchdog started (15s interval)');
    }

    // ── 13. Public API ───────────────────────────────────────────────────────
    global.KisaanNetwork = {
        init:          initNetwork,
        getApiUrl:     getBestGuessApiUrl,
        promptManualIp,
        retryConnection,
        ping:          pingUrl,
        setDot:        setConnectionDot,
        startWatchdog,
    };

    // ── 14. Backward-compat: expose getApiUrl globally ───────────────────────
    global.getApiUrl = getBestGuessApiUrl;

    // Initialize API_URL immediately (synchronous best guess — no network call)
    global.API_URL = getBestGuessApiUrl();

})(window);

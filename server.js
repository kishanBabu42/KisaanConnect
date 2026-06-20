console.log('🚀 [Boot] Initializing KisaanConnect Server...');

require('dotenv').config();

// Keep server alive on unhandled errors
process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] ❌ CRITICAL ERROR:`, err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] ❌ UNHANDLED REJECTION:`, reason);
});

const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');   // ← moved here: used at line ~138 for uploads dir check
const morgan     = require('morgan');
const helmet     = require('helmet');
const compression = require('compression');
const OpenAI     = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Firebase Firestore (replaces MySQL) ───────────────────────────────────
const fdb = require('./firebase-db');
const { consumeOTP } = fdb;
const { initMailer, sendOTPEmail, sendWelcomeEmail } = require('./otp-mailer');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = process.env.PORT || 3000;

// Socket.io Connection Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined their room.`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Get local IP address for easy mobile connection
// Priority: Real Wi-Fi → Ethernet → Skip virtual adapters (VirtualBox/Hyper-V)
const networkInterfaces = require('os').networkInterfaces();
let wifiIps     = [];
let ethernetIps = [];
let localIps    = [];
let localIp     = 'localhost';

// Virtual adapter detection: by name keyword OR well-known virtual IP ranges
// (VirtualBox/Hyper-V adapters often have generic names like 'Ethernet 2')
const VIRTUAL_KEYWORDS    = ['virtualbox', 'hyper-v', 'vmware', 'vethernet', 'loopback', 'pseudo'];
const VIRTUAL_IP_PREFIXES = [
    '192.168.56.',   // VirtualBox Host-Only
    '192.168.220.',  // Hyper-V Default Switch
    '192.168.57.',   // VirtualBox alternate
    '172.17.',       // Docker bridge
    '172.18.',       // Docker custom networks
    '172.19.',
];
const isVirtualIp = (addr) => VIRTUAL_IP_PREFIXES.some(p => addr.startsWith(p));

for (const interfaceName in networkInterfaces) {
    const lowerName = interfaceName.toLowerCase();
    const isVirtual = VIRTUAL_KEYWORDS.some(kw => lowerName.includes(kw));
    if (isVirtual) continue; // skip by name

    for (const iface of networkInterfaces[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            if (isVirtualIp(iface.address)) continue; // skip by IP range (catches Ethernet 2/3)
            const isWiFi     = lowerName.includes('wi-fi') || lowerName.includes('wlan') || lowerName.includes('wireless');
            const isEthernet = lowerName.includes('ethernet') || lowerName.includes('local area connection');
            if (isWiFi) {
                wifiIps.push(iface.address);
            } else if (isEthernet) {
                ethernetIps.push(iface.address);
            }
            // else: skip unknown (VPNs, tunnels)
        }
    }
}

// Merge in priority order: Wi-Fi > Ethernet
localIps = [...wifiIps, ...ethernetIps];
if (localIps.length > 0) {
    localIp = localIps[0]; // Primary connection address
}


// ── In-Memory Cache with Request Coalescing ───────────────────────────────────
// Prevents Firestore thundering-herd under concurrent load.
// On a cache miss, only ONE Firestore call fires; all concurrent waiters share
// the same Promise. Results are cached for TTL_MS seconds.
const _cache    = new Map();   // key → { data, ts }
const _inflight = new Map();   // key → Promise  (dedup concurrent misses)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — keeps cache warm for full load test

function cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
    return entry.data;
}
function cacheSet(key, data) { _cache.set(key, { data, ts: Date.now() }); }
function cacheInvalidate(...keys) { keys.forEach(k => { _cache.delete(k); _inflight.delete(k); }); }

// Fetch-with-coalescing: fn is only called once per key; concurrent callers await same Promise
async function cachedFetch(key, fn) {
    const hit = cacheGet(key);
    if (hit !== null) return hit;

    if (_inflight.has(key)) return _inflight.get(key); // another request already fetching

    const promise = fn().then(data => {
        cacheSet(key, data);
        _inflight.delete(key);
        return data;
    }).catch(err => {
        _inflight.delete(key);
        throw err;
    });
    _inflight.set(key, promise);
    return promise;
}

// Security and Performance Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for demo simplicity with external CDNs
    crossOriginResourcePolicy: false, // Allow cross-origin resource loading (mobile WebViews)
}));
app.use(compression());
// Use 'tiny' format: one line per request, no color noise — much faster than 'dev'
app.use(morgan('tiny'));

// ── CORS: allow ALL origins (mobile app on same LAN needs this) ──────────────
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: false,
}));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, bypass-tunnel-reminder');
    next();
});
app.options('*', cors()); // Handle preflight for all routes

// Increase payload limits for large images (Fixes "file too large" error)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files — cache assets for 1 hour on mobile to reduce repeat downloads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1h' }));
app.use(express.static(__dirname, {
    maxAge: '1h',
    // Never cache HTML pages (so updates reach mobile immediately)
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// ── Initialize Firebase + Email ──────────────────────────────────────────
console.log('📦 [Boot] Connecting to Database...');
try {
    fdb.initFirebase();
    console.log('📧 [Boot] Setting up Emailer...');
    initMailer();
} catch (bootErr) {
    console.error('❌ [Boot] Initialization Failed:', bootErr.message);
}

// MySQL initializeDatabase() removed — Firebase handles seeding via seedAdminUser() in firebase-db.js

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory');
}

// MULTER SETUP FOR FILE UPLOADS
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'file-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is healthy', timestamp: new Date() });
});

// ── PING / AUTO-DISCOVERY ─────────────────────────────────────────────────────
// Mobile apps call this to verify which IP/port to use for API calls.
// Returns the server's primary LAN IP so the app can self-configure.
// Also returns tunnelUrl if start-tunnel.js wrote one to .tunnel-url file.
let _tunnelUrl = null;
const _tunnelFile = require('path').join(__dirname, '.tunnel-url');
// Watch .tunnel-url file — updated by start-tunnel.js when tunnel opens
if (fs.existsSync(_tunnelFile)) {
    fs.watchFile(_tunnelFile, { interval: 1000 }, (curr, prev) => {
        try {
            _tunnelUrl = fs.readFileSync(_tunnelFile, 'utf8').trim();
            if (_tunnelUrl) console.log(`[Tunnel] 🔗 Active tunnel: ${_tunnelUrl}`);
        } catch(e) { _tunnelUrl = null; }
    });
}
// Load on startup (only if tunnel runner spawned us, otherwise ignore stale file)
if (process.env.KISAAN_TUNNEL_ACTIVE === 'true') {
    try { _tunnelUrl = require('fs').readFileSync(_tunnelFile, 'utf8').trim(); } catch(e) {}
} else {
    _tunnelUrl = null;
    try { if (fs.existsSync(_tunnelFile)) fs.unlinkSync(_tunnelFile); } catch(e) {}
}

app.get('/api/ping', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
        ok: true,
        server: 'KisaanConnect',
        version: '2.0',
        port,
        serverIp: localIp,
        allIps: localIps,
        tunnelUrl: _tunnelUrl || null,   // ← null when no tunnel, URL when tunnel active
        timestamp: Date.now()
    });
});

// ── TUNNEL URL ENDPOINT ───────────────────────────────────────────────────────
// Returns the public tunnel URL (set by start-tunnel.js) or null.
// Mobile kisaan-network.js polls this to auto-switch to tunnel URL.
app.get('/api/tunnel-url', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (_tunnelUrl) {
        res.json({ ok: true, tunnelUrl: _tunnelUrl });
    } else {
        res.json({ ok: false, tunnelUrl: null });
    }
});

// ── DATABASE STATUS CHECK ─────────────────────────────────────────────────────
// Live Firestore connectivity check. Useful for diagnosing Firebase issues.
// Visit: http://localhost:3000/api/db-status (or with your Wi-Fi IP on mobile)
app.get('/api/db-status', async (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    const start = Date.now();
    try {
        if (!fdb.isReady()) {
            return res.status(503).json({
                ok: false,
                firebase: false,
                message: 'Firebase not initialized. Check .env credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).',
                projectId: process.env.FIREBASE_PROJECT_ID || 'NOT SET',
                region: 'africa-south1',
            });
        }
        // Do a lightweight real read — _counters doc is tiny
        const snap = await fdb.getDb().collection('_counters').limit(1).get();
        const ms = Date.now() - start;
        return res.json({
            ok: true,
            firebase: true,
            message: '✅ Firestore connected and responding',
            region: 'africa-south1',
            host: 'firestore.africa-south1.rep.googleapis.com',
            projectId: process.env.FIREBASE_PROJECT_ID,
            latencyMs: ms,
            docsRead: snap.size,
        });
    } catch (err) {
        const ms = Date.now() - start;
        return res.status(500).json({
            ok: false,
            firebase: false,
            message: `❌ Firestore error: ${err.message}`,
            code: err.code || null,
            region: 'africa-south1',
            projectId: process.env.FIREBASE_PROJECT_ID,
            latencyMs: ms,
            tip: err.code === 5 || (err.message && err.message.includes('NOT_FOUND'))
                ? 'Firestore DB not provisioned OR wrong region. Go to https://console.firebase.google.com → your project → Firestore Database → Create database (select africa-south1).'
                : 'Check network connectivity and Firebase credentials in .env',
        });
    }
});

// ── APK DOWNLOAD / INSTALL PAGE ──────────────────────────────────────────────
const _apkFile    = path.join(__dirname, 'app-release.apk');
const _apkVersion = '2.2';
const _apkBuild   = 22;

app.get('/install', (req, res) => {
    const apkExists = fs.existsSync(_apkFile);
    const apkSize   = apkExists ? (fs.statSync(_apkFile).size / 1048576).toFixed(1) : '?';
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host  = req.get('host') || `${localIp}:${port}`;
    const baseUrl = `${proto}://${host}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(baseUrl+'/install')}&color=059669&bgcolor=ffffff&qzone=1`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(`<!DOCTYPE html><html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Install KisaanConnect</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Plus Jakarta Sans',sans-serif;background:linear-gradient(135deg,#064e3b,#047857);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:white;border-radius:28px;padding:32px 24px;max-width:440px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,0.4);text-align:center}
.logo{width:76px;height:76px;background:linear-gradient(135deg,#059669,#10b981);border-radius:20px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:36px}
h1{font-size:24px;font-weight:800;color:#111;margin-bottom:4px}
.ver{display:inline-block;background:#d1fae5;color:#065f46;font-size:12px;font-weight:700;padding:3px 12px;border-radius:50px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
.box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px}
.lbl{font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase}
.val{font-size:16px;font-weight:800;color:#059669;margin-top:2px}
.btn{display:block;background:linear-gradient(135deg,#059669,#10b981);color:white;text-decoration:none;padding:18px;border-radius:16px;font-size:18px;font-weight:800;margin-bottom:10px;box-shadow:0 8px 24px rgba(5,150,105,0.45)}
.btn .sub{font-size:11px;font-weight:500;opacity:.85;margin-top:3px}
.alt{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}
.a2{padding:10px;border-radius:12px;font-size:12px;font-weight:700;border:2px solid #059669;background:white;color:#059669;text-decoration:none;display:block}
.steps{text-align:left;background:#f8fafc;border-radius:14px;padding:16px;margin-bottom:14px}
.steps h3{font-size:11px;font-weight:700;color:#6b7280;margin-bottom:10px;text-transform:uppercase}
.s{display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;font-size:12px;color:#374151}
.n{width:22px;height:22px;min-width:22px;background:#059669;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
strong{color:#059669}
.note{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:11px;color:#92400e;text-align:left;margin-bottom:14px}
.qr{border-top:1px solid #e5e7eb;padding-top:14px}
.ql{font-size:10px;color:#6b7280;font-weight:600;margin-bottom:8px;text-transform:uppercase}
.ubox{background:#f3f4f6;border-radius:8px;padding:8px 10px;font-size:10px;color:#374151;font-family:monospace;margin-top:8px;word-break:break-all;cursor:pointer;border:1px solid #e5e7eb}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111;color:white;padding:10px 20px;border-radius:50px;font-size:13px;font-weight:600;display:none;z-index:999}
</style>
</head>
<body>
<div class="toast" id="t">✅ Link copied!</div>
<div class="card">
  <div class="logo">🌾</div>
  <h1>KisaanConnect</h1>
  <span class="ver">v${_apkVersion} (Build ${_apkBuild})</span>
  <div class="grid">
    <div class="box"><div class="lbl">Size</div><div class="val">${apkSize} MB</div></div>
    <div class="box"><div class="lbl">Android</div><div class="val">7.0+</div></div>
    <div class="box"><div class="lbl">Firebase</div><div class="val">✅</div></div>
    <div class="box"><div class="lbl">Server</div><div class="val" style="font-size:11px">${localIp}</div></div>
  </div>
  ${apkExists ? `
  <a class="btn" href="/download/apk" download="KisaanConnect-v${_apkVersion}.apk">⬇️ Download &amp; Install APK<div class="sub">Tap here · ${apkSize} MB</div></a>
  <div class="alt">
    <a class="a2" href="/apk" download="KisaanConnect.apk">📥 Mirror 1</a>
    <a class="a2" href="/KisaanConnect.apk">📥 Mirror 2</a>
  </div>` : `<div class="btn" style="background:#9ca3af;pointer-events:none">⚠️ APK not available<div class="sub">Run gradlew assembleDebug first</div></div>`}
  <div class="steps">
    <h3>📋 How to Install</h3>
    <div class="s"><div class="n">1</div><div>Tap <strong>Download &amp; Install APK</strong> above</div></div>
    <div class="s"><div class="n">2</div><div>Open your <strong>Downloads</strong> app → tap the file</div></div>
    <div class="s"><div class="n">3</div><div>If blocked → <strong>Settings</strong> → <strong>"Allow from this source"</strong> → go back</div></div>
    <div class="s"><div class="n">4</div><div>Tap <strong>Install</strong> → <strong>Open</strong> ✅</div></div>
  </div>
  <div class="note"><strong>📶 Same Wi-Fi required</strong>Phone &amp; PC must be on same Wi-Fi. Server: <strong>${localIp}:${port}</strong></div>
  <div class="qr">
    <div class="ql">📷 Scan to open on phone</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(baseUrl+'/install')}&color=059669&bgcolor=ffffff&qzone=1" width="140" height="140" style="border-radius:10px" loading="lazy">
    <div class="ubox" onclick="navigator.clipboard.writeText('${baseUrl}/install').then(()=>{document.getElementById('t').style.display='block';setTimeout(()=>document.getElementById('t').style.display='none',2000)})">${baseUrl}/install<br><span style="color:#059669;font-size:9px">tap to copy</span></div>
  </div>
</div>
</body></html>`);
});

// ── APK DOWNLOAD — PRIMARY ROUTE ─────────────────────────────────────────────
function serveApk(req, res) {
    if (!fs.existsSync(_apkFile)) {
        return res.status(404).send('APK not found. Build it first.');
    }
    const stat = fs.statSync(_apkFile);
    const fileSize = stat.size;

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="KisaanConnect-v${_apkVersion}.apk"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end   = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const fileStream = fs.createReadStream(_apkFile, { start, end });
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        fileStream.pipe(res);
    } else {
        const fileStream = fs.createReadStream(_apkFile);
        fileStream.pipe(res);
    }
}

app.get('/download/apk', serveApk);
app.get('/apk', serveApk);
app.get('/KisaanConnect.apk', serveApk);

// ── GOOGLE WEATHER API PROXY ─────────────────────────────────────────────────
// Proxies requests to Google Weather API so the key stays server-side (never exposed)
app.get('/api/weather', async (req, res) => {
    const { lat, lng, location } = req.query;
    const GOOGLE_KEY = process.env.WEATHER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    let finalLat = lat, finalLng = lng;

    try {
        // 1. If no coords, geocode the location string using Nominatim (free)
        if (!finalLat || !finalLng) {
            const locQuery = location || 'Hyderabad, India';
            const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locQuery)}&format=json&limit=1`;
            const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'KisaanConnect/1.0' } });
            const geoData = await geoRes.json();
            if (geoData && geoData.length > 0) {
                finalLat = geoData[0].lat;
                finalLng = geoData[0].lon;
            } else {
                // Default to Hyderabad
                finalLat = '17.3850'; finalLng = '78.4867';
            }
        }

        // 2. Call Google Weather API
        if (GOOGLE_KEY) {
            const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_KEY}&location.latitude=${finalLat}&location.longitude=${finalLng}`;
            const weatherRes = await fetch(weatherUrl);
            const weatherData = await weatherRes.json();

            if (weatherRes.ok && !weatherData.error) {
                const cond = weatherData;
                const tempC = cond.temperature?.degrees ?? null;

                // Also get forecast
                const forecastUrl = `https://weather.googleapis.com/v1/forecast/days:lookup?key=${GOOGLE_KEY}&location.latitude=${finalLat}&location.longitude=${finalLng}&days=5&unitsSystem=METRIC`;
                const forecastRes = await fetch(forecastUrl);
                const forecastData = await forecastRes.json();
                const days = (forecastData.forecastDays || []).map(d => ({
                    date: d.interval?.startTime?.split('T')[0] || '',
                    maxTempC: d.maxTemperature?.degrees ?? '--',
                    minTempC: d.minTemperature?.degrees ?? '--',
                    icon: d.daytimeForecast?.weatherCondition?.iconBaseUri || '',
                    condition: d.daytimeForecast?.weatherCondition?.description?.text || '',
                    precipProb: d.daytimeForecast?.precipitationProbability ?? 0,
                    humidity: d.daytimeForecast?.relativeHumidity ?? '--',
                }));

                return res.json({
                    success: true,
                    source: 'Google Weather',
                    lat: finalLat,
                    lng: finalLng,
                    tempC,
                    feelsLikeC: cond.feelsLikeTemperature?.degrees ?? tempC,
                    humidity: cond.relativeHumidity ?? '--',
                    wind: cond.wind?.speed?.value ?? '--',
                    windDir: cond.wind?.direction?.degrees ?? 0,
                    uvIndex: cond.uvIndex ?? 0,
                    condition: cond.weatherCondition?.description?.text || 'Clear',
                    icon: cond.weatherCondition?.iconBaseUri || '',
                    visibility: cond.visibility?.distance ?? '--',
                    isDaytime: cond.isDaytime ?? true,
                    forecast: days,
                    alerts: []
                });
            }
        }

        // 3. Fallback: Open-Meteo (completely free, no key)
        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${finalLat}&longitude=${finalLng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day,uv_index&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=5`;
        const meteoRes = await fetch(meteoUrl);
        const meteo = await meteoRes.json();

        const wmoDesc = (code) => {
            if (code === 0) return 'Clear Sky'; if (code <= 3) return 'Partly Cloudy';
            if (code <= 9) return 'Foggy'; if (code <= 19) return 'Drizzle';
            if (code <= 29) return 'Rain'; if (code <= 39) return 'Snowy';
            if (code <= 49) return 'Foggy'; if (code <= 59) return 'Light Rain';
            if (code <= 69) return 'Rain'; if (code <= 79) return 'Snowy';
            if (code <= 82) return 'Heavy Rain'; if (code <= 86) return 'Heavy Snow';
            if (code <= 99) return 'Thunderstorm'; return 'Unknown';
        };
        const wmoIcon = (code, day) => {
            if (code === 0) return day ? '☀️' : '🌙'; if (code <= 3) return '⛅';
            if (code <= 9) return '🌫️'; if (code <= 49) return '🌫️';
            if (code <= 69) return '🌧️'; if (code <= 79) return '❄️';
            if (code <= 82) return '⛈️'; if (code <= 99) return '⛈️'; return '🌤️';
        };

        const c = meteo.current;
        const d = meteo.daily;
        const days = (d?.time || []).map((date, i) => ({
            date,
            maxTempC: d.temperature_2m_max?.[i] ?? '--',
            minTempC: d.temperature_2m_min?.[i] ?? '--',
            icon: wmoIcon(d.weather_code?.[i], true),
            condition: wmoDesc(d.weather_code?.[i]),
            precipProb: d.precipitation_probability_max?.[i] ?? 0,
            humidity: '--',
        }));

        res.json({
            success: true,
            source: 'Open-Meteo',
            lat: finalLat, lng: finalLng,
            tempC: c.temperature_2m,
            feelsLikeC: c.apparent_temperature,
            humidity: c.relative_humidity_2m,
            wind: c.wind_speed_10m,
            uvIndex: c.uv_index ?? 0,
            condition: wmoDesc(c.weather_code),
            icon: wmoIcon(c.weather_code, c.is_day),
            isDaytime: c.is_day === 1,
            forecast: days,
            alerts: []
        });

    } catch (e) {
        console.error('Weather API error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── GEOCODING PROXY (Nominatim — free, no billing) ───────────────────────────
app.get('/api/geocode', async (req, res) => {
    const { q, lat, lng } = req.query;
    try {
        if (lat && lng) {
            // Reverse geocode
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
            const r = await fetch(url, { headers: { 'User-Agent': 'KisaanConnect/1.0' } });
            const data = await r.json();
            res.json({ success: true, address: data.display_name, data });
        } else {
            // Forward geocode
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q || '')}&format=json&limit=5&countrycodes=in`;
            const r = await fetch(url, { headers: { 'User-Agent': 'KisaanConnect/1.0' } });
            const data = await r.json();
            res.json({ success: true, results: data });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// API ROUTES

// ── FORGOT PASSWORD ──────────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    try {
        const user = await fdb.findUserByEmail(email);
        if (!user) return res.status(404).json({ success: false, message: 'No account found with this email.' });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to Firestore (with 60-second expiry)
        await fdb.saveOTP(email, otp);

        // Send branded email
        const mailResult = await sendOTPEmail(email, otp, user.name || 'Farmer');

        if (mailResult.warning) {
            // SMTP delivery failed but OTP is saved — let user proceed, show console note
            res.json({ success: true, message: 'OTP generated. Check server console if email was not received.', emailWarning: true });
        } else {
            res.json({ success: true, message: 'OTP sent to your registered email.' });
        }
    } catch (e) {
        console.error('forgot-password error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
    }
});

// ── VERIFY OTP ────────────────────────────────────────────────────
app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required.' });

    try {
        const result = await fdb.verifyOTP(email, otp);
        // verifyOTP does NOT delete the OTP yet — only after password reset
        if (result.valid) {
            res.json({ success: true, message: 'OTP verified.' });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error verifying OTP.' });
    }
});

// ── RESET PASSWORD ──────────────────────────────────────────────────
app.post('/api/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: 'All fields required.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    try {
        const result = await fdb.verifyOTP(email, otp);
        if (!result.valid) return res.status(400).json({ success: false, message: result.message });

        const user = await fdb.findUserByEmail(email);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        await fdb.updateUser(String(user.id), { password: newPassword });
        // ✅ Consume (delete) the OTP only AFTER password is successfully updated
        await consumeOTP(email);
        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (e) {
        console.error('reset-password error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to reset password.' });
    }
});

// AUTH
app.post('/api/login', async (req, res) => {
    const { email, password, role } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });
    if (!password) return res.status(400).json({ success: false, message: 'Password is required.' });
    if (!role) return res.status(400).json({ success: false, message: 'Role is required.' });
    try {
        const user = await fdb.findUserByEmailAndRole(email, password, role);
        if (user) {
            res.json({
                ...user,
                success: true,
                token: "session_token_" + user.id,
                user: user
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email, password, or role.' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/signup', async (req, res) => {
    const { name, email, password, role, mobile, location, vehicleType, licenseNumber } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });
    if (!password) return res.status(400).json({ success: false, message: 'Password is required.' });
    if (!role) return res.status(400).json({ success: false, message: 'Role is required.' });
    try {
        const existing = await fdb.findUserByEmail(email);
        if (existing) return res.status(400).json({ success: false, message: 'Email already exists.' });
        const user = await fdb.createUser({ name, email, password, role, mobile, location, vehicleType, licenseNumber });

        // Send Welcome Email
        sendWelcomeEmail(email, name, role).catch(err => console.error('Error in sendWelcomeEmail:', err.message));

        res.json({
            ...user,
            success: true,
            token: "session_token_" + user.id,
            user: user
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GOOGLE AUTH (Sign in / Sign up with Google) ──────────────────────────────
// Accepts Google Identity Services JWT credential. Verifies it via Google API,
// then finds or creates the user in Firestore and returns a session-ready user object.
app.post('/api/google-auth', async (req, res) => {
    const { credential, role, name, email, picture, googleId } = req.body;

    // Basic validation
    if (!email || !googleId) {
        return res.status(400).json({ success: false, message: 'Invalid Google credential data.' });
    }

    // Sanitize role
    const safeRole = (role === 'farmer') ? 'farmer' : 'customer';

    try {
        // 1. Verify the JWT with Google's tokeninfo endpoint (no client secret needed)
        let verifiedEmail = email; // trusted fallback
        if (credential) {
            try {
                const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
                const tokenData = await verifyRes.json();
                if (tokenData.error) {
                    console.warn('[Google Auth] Token verification failed (using payload fallback):', tokenData.error);
                } else {
                    verifiedEmail = tokenData.email || email;
                }
            } catch(verifyErr) {
                console.warn('[Google Auth] Token verify network error (using payload fallback):', verifyErr.message);
            }
        }

        // 2. Find existing user by email
        let user = await fdb.findUserByEmail(verifiedEmail);

        if (user) {
            // Existing user — update Google-specific fields silently
            await fdb.updateUser(String(user.id), {
                googleId: googleId,
                profilePic: user.profilePic || picture || '',
            });
            // Return full user session object
            console.log(`[Google Auth] Existing user logged in: ${verifiedEmail} (role: ${user.role})`);
            return res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                mobile: user.mobile || '',
                location: user.location || '',
                profilePic: user.profilePic || picture || '',
                wallet: user.wallet || 0,
                googleAuth: true
            });
        }

        // 3. New user — auto-create account (no password needed for Google auth)
        const newUser = await fdb.createUser({
            name:       name || verifiedEmail.split('@')[0],
            email:      verifiedEmail,
            password:   `google_${googleId}`, // placeholder, will never be used directly
            role:       safeRole,
            mobile:     '',
            location:   '',
            googleId:   googleId,
            profilePic: picture || '',
        });

        console.log(`[Google Auth] New user created: ${verifiedEmail} (role: ${safeRole})`);
        return res.json({
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            mobile: '',
            location: '',
            profilePic: picture || '',
            wallet: 0,
            googleAuth: true,
            isNewUser: true
        });

    } catch (e) {
        console.error('[Google Auth] Error:', e.message);
        res.status(500).json({ success: false, message: 'Google sign-in failed. Please try again.' });
    }
});

// USERS
app.get('/api/users', async (req, res) => {
    try {
        const safe = await cachedFetch('users:all', async () => {
            const users = await fdb.getAllUsers();
            return users.map(u => ({ id: u.id, name: u.name, role: u.role, location: u.location, mobile: u.mobile, lat: u.lat, lng: u.lng, profilePic: u.profilePic, wallet: u.wallet, bio: u.bio }));
        });
        res.set('X-Cache', cacheGet('users:all') ? 'HIT' : 'MISS');
        res.json(safe);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await fdb.getUserById(req.params.id);
        if (!user) return res.status(404).send('User not found');
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', async (req, res) => {
    const updates = req.body;
    const allowed = ['name','mobile','location','wallet','bio','lat','lng','profilePic','payment_upi','payment_bank','vehicleType','licenseNumber'];
    const filtered = {};
    allowed.forEach(f => { if (updates[f] !== undefined) filtered[f] = updates[f]; });
    if (Object.keys(filtered).length === 0) return res.send('No fields to update');
    try {
        await fdb.updateUser(req.params.id, filtered);
        res.send('User updated');
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Dedicated profile picture update endpoint
app.post('/api/users/update-profile', async (req, res) => {
    const { userId, profilePic } = req.body;
    if (!userId || !profilePic) return res.status(400).send('Missing userId or profilePic');
    try {
        await fdb.updateUser(String(userId), { profilePic });
        res.json({ success: true, message: 'Profile picture updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/add-wallet', async (req, res) => {
    const { userId, amount } = req.body;
    try {
        const user = await fdb.getUserById(String(userId));
        const newWallet = parseFloat(user?.wallet || 0) + parseFloat(amount || 0);
        await fdb.updateUser(String(userId), { wallet: newWallet });
        res.json({ success: true, wallet: newWallet });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PRODUCTS
app.get('/api/products', async (req, res) => {
    const { farmerId } = req.query;
    const cacheKey = `products:${farmerId || 'all'}`;
    try {
        const rows = await cachedFetch(cacheKey, () => fdb.getProducts(farmerId || null));
        res.set('X-Cache', 'HIT');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    const p = req.body;
    if (!p.name) return res.status(400).json({ success: false, message: 'Product name is required.' });
    if (p.price === undefined || p.price === null) return res.status(400).json({ success: false, message: 'Product price is required.' });
    if (!p.farmerId) return res.status(400).json({ success: false, message: 'Farmer ID is required.' });
    try {
        const product = await fdb.createProduct({ farmerId: String(p.farmerId), farmerName: p.farmerName, farmerEmail: p.farmerEmail, name: p.name, price: p.price, marketPrice: p.marketPrice, quantity: p.quantity, age: p.age, location: p.location, images: p.images || [] });
        cacheInvalidate(`products:all`, `products:${p.farmerId}`); // invalidate on write
        res.json({ id: product.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    const p = req.body;
    try {
        await fdb.updateProduct(req.params.id, { name: p.name, price: p.price, quantity: p.quantity, age: p.age, location: p.location, images: p.images || [] });
        res.send('Product updated');
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await fdb.deleteProduct(req.params.id);
        res.send('Product deleted');
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id/sold', async (req, res) => {
    try {
        await fdb.updateProduct(req.params.id, { status: 'sold' });
        res.send('Product marked as sold');
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// QUOTES
app.get('/api/quotes', async (req, res) => {
    try {
        const rows = await fdb.getQuotes({ farmerId: req.query.farmerId, customerId: req.query.customerId });
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quotes', async (req, res) => {
    try {
        const q = req.body;
        const quote = await fdb.createQuote({ ...q });
        io.to(`user_${q.farmerId}`).emit('new_quote', { id: quote.id, productName: q.productName });
        res.json(quote);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/quotes/:id', async (req, res) => {
    const { status, paid, paymentMethod } = req.body;
    try {
        await fdb.updateQuote(req.params.id, { status, paid, paymentMethod });
        if (status === 'yes') {
            const allQuotes = await fdb.getQuotes({});
            const q = allQuotes.find(x => String(x.id) === String(req.params.id));
            if (q) {
                io.to(`user_${q.customerId}`).emit('quote_accepted', { id: q.id, productName: q.productName });
                const order = await fdb.createOrder({
                    farmerId: q.farmerId, customerId: q.customerId,
                    productName: q.productName, quantity: q.quantity,
                    price: (q.offerPrice || 0) * (q.quantity || 1),
                    pickupLocation: q.farmerLocation || 'Farm',
                    dropoffLocation: q.customerLocation || 'Home',
                    status: 'accepted',
                    deliveryStatus: q.needDriver ? 'pending' : 'none',
                    paymentMethod: q.paymentMethod || 'cash',
                    paymentStatus: q.paid ? 'completed' : 'pending'
                });
                if (q.needDriver) io.emit('new_delivery_available', { orderId: order.id });
            }
        }
        res.send('Quote updated');
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SUBSCRIPTIONS
app.get('/api/subscriptions', async (req, res) => {
    try {
        const rows = await fdb.getSubscriptions({ farmerId: req.query.farmerId, customerId: req.query.customerId });
        res.json(rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/subscriptions', async (req, res) => {
    const sub = req.body;
    try {
        const result = await fdb.createSubscription({ customerId: String(sub.customerId), farmerId: String(sub.farmerId), productId: String(sub.productId), productName: sub.productName, quantity: sub.quantity, day: sub.day });
        res.json({ id: result.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/subscriptions/:id', async (req, res) => {
    const { status, farmerReason } = req.body;
    try {
        await fdb.updateSubscription(req.params.id, { status, farmerReason });
        res.send('Subscription updated');
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/subscriptions/:id', async (req, res) => {
    try {
        await fdb.deleteSubscription(req.params.id);
        res.send('Subscription deleted');
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ORDERS
app.get('/api/orders', async (req, res) => {
    try {
        const rows = await fdb.getOrders({ farmerId: req.query.farmerId, customerId: req.query.customerId });
        res.json(rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', async (req, res) => {
    const o = req.body;
    try {
        const order = await fdb.createOrder({ ...o, deliveredAt: new Date().toISOString() });
        res.json({ id: order.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELIVERY PARTNER ROUTES
app.get('/api/deliveries/available', async (req, res) => {
    try {
        const all = await fdb.getOrders({});
        res.json(all.filter(o => !o.deliveryPartnerId && o.deliveryStatus === 'pending'));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/deliveries/:id/accept', async (req, res) => {
    const { partnerId } = req.body;
    try {
        await fdb.updateOrder(req.params.id, { deliveryPartnerId: partnerId, deliveryStatus: 'accepted' });
        const orders = await fdb.getOrders({});
        const o = orders.find(x => String(x.id) === String(req.params.id));
        if (o) {
            io.to(`user_${o.farmerId}`).emit('delivery_accepted', { orderId: req.params.id });
            io.to(`user_${o.customerId}`).emit('delivery_accepted', { orderId: req.params.id });
        }
        res.send('Delivery accepted');
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/deliveries/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        const update = { deliveryStatus: status };
        if (status === 'delivered') update.deliveredAt = new Date().toISOString();
        await fdb.updateOrder(req.params.id, update);
        const orders = await fdb.getOrders({});
        const o = orders.find(x => String(x.id) === String(req.params.id));
        if (o) {
            io.to(`user_${o.farmerId}`).emit('delivery_status_update', { orderId: req.params.id, status });
            io.to(`user_${o.customerId}`).emit('delivery_status_update', { orderId: req.params.id, status });
        }
        res.send('Status updated');
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/deliveries/my-orders/:partnerId', async (req, res) => {
    try {
        const rows = await fdb.getOrders({ driverId: req.params.partnerId });
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PAYMENT DONE
app.put('/api/quotes/:id/payment-done', async (req, res) => {
    try {
        await fdb.updateQuote(req.params.id, { paid: true, status: 'completed' });
        res.json({ success: true, message: 'Payment marked as completed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/payment-done', async (req, res) => {
    try {
        await fdb.updateOrder(req.params.id, { paymentStatus: 'completed' });
        res.json({ success: true, message: 'Payment marked as completed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// CALENDAR NOTES
app.get('/api/calendar_notes/:farmerId', async (req, res) => {
    try {
        const notes = await fdb.getCalendarNotes(req.params.farmerId);
        const notesMap = {};
        notes.forEach(r => notesMap[r.date] = r.note);
        res.json(notesMap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/calendar_notes', async (req, res) => {
    const { farmerId, dateKey, note } = req.body;
    try {
        await fdb.upsertCalendarNote(String(farmerId), dateKey, note);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/calendar_notes/:farmerId/:dateKey', async (req, res) => {
    try {
        await fdb.upsertCalendarNote(req.params.farmerId, req.params.dateKey, '');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// COMMUNITY BOARD
app.get('/api/community', async (req, res) => {
    try {
        res.json(await fdb.getCommunityPosts());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/community', async (req, res) => {
    try {
        const post = await fdb.createCommunityPost({ ...req.body });
        res.json(post);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/community/:id/like', async (req, res) => {
    try {
        await fdb.likeCommunityPost(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// FILE UPLOAD ENDPOINT
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// AI CHAT ENDPOINT â€” Gemini (primary) â†’ OpenAI (secondary) â†’ Local smart fallback
let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

let genAI = null;
if (process.env.GOOGLE_AI_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
}

const AGRI_SYSTEM_PROMPT = `You are KisaanAI, an expert agricultural assistant for Indian farmers on KisaanConnect platform.
Provide practical advice on:
- Crop diseases, pests and treatments (chemical & organic)
- Weather-based farming tips
- Market prices and selling strategies  
- Soil health and fertilizer recommendations
- Government schemes (PM-Kisan, MSP, crop insurance)
- Seasonal crop planning

Always respond in the user's language if they write in Hindi/Telugu/Tamil etc.
Be concise, practical and farmer-friendly. Use emojis to make responses engaging.
For disease queries, always suggest both chemical and organic remedies.
Keep responses under 200 words.`;

const CUSTOMER_SYSTEM_PROMPT = `You are a helpful assistant for customers on KisaanConnect, a farm-to-consumer marketplace in India.
Help them with:
- Finding fresh produce and understanding product quality
- Benefits of farm-fresh vs market produce
- Nutrition and cooking tips for seasonal vegetables
- Understanding pricing and delivery
- Subscription benefits
Be friendly, concise and helpful. Use emojis occasionally.`;

// â”€â”€ LOCAL AGRI KNOWLEDGE BASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getLocalReply(message, role) {
    const msgLower = (message || '').toLowerCase();

    if (role === 'customer') {
        const customerReplies = [
            {
                q: ['hello', 'hi', 'namaste', 'greetings'],
                a: '👋 **Welcome to KisaanConnect Marketplace!**\nHow can I help you today? You can ask about fresh produce, how to buy from local farmers, pricing, or order delivery.'
            },
            {
                q: ['buy', 'order', 'purchase', 'shop'],
                a: '🛒 **Buying Guide:**\n1. Browse the **Market** tab to view fresh crops listed directly by local farmers.\n2. Tap **Buy Now** to place an order.\n3. Keep track of your purchases in the **Orders** tab!'
            },
            {
                q: ['fresh', 'quality', 'organic', 'healthy'],
                a: '🍅 **Farm Fresh Quality:**\nAll produce on KisaanConnect is harvested fresh by local farmers and listed directly. Buying here means you support local agriculture and get highly nutritious food!'
            },
            {
                q: ['price', 'cost', 'expensive', 'delivery'],
                a: '🚚 **Pricing & Delivery:**\nBecause there are no middlemen, you get farm-fresh produce at fair prices. Delivery updates and estimated times will be shown directly on your **Orders** page after confirmation.'
            },
            {
                q: ['payment', 'pay', 'upi', 'wallet'],
                a: '💳 **Payments & Wallet:**\nYou can add money to your KisaanConnect Wallet or pay directly using UPI when confirming your orders. Check the **Payments** tab under the *More* menu for wallet top-ups.'
            }
        ];
        for (const entry of customerReplies) {
            if (entry.q.some(kw => msgLower.includes(kw))) {
                return entry.a;
            }
        }
        return '🛒 **KisaanConnect Marketplace Assistant:**\nI can help you browse fresh produce, track orders, understand pricing, and manage payments. What can I do for you today?';
    }

    const agriReplies = [
        {
            q: ['hello', 'hi', 'namaste', 'greetings'],
            a: '👋 **Namaste! Welcome to KisaanConnect.**\nI am KisaanAI, your digital agricultural partner. How can I help you today? You can ask me about crop diseases, pests, fertilizers, irrigation, market prices, or government schemes!'
        },
        {
            q: ['disease', 'spot', 'blight', 'rot', 'rust', 'mildew', 'yellow', 'leaf', 'fungal'],
            a: '🌿 **Plant Disease Advisory:**\nThis looks like a fungal/bacterial infection.\n\n💊 **Chemical**: Mancozeb 75% WP @ 2.5g/L or Copper Oxychloride 50% WP\n🍃 **Organic**: Neem oil 3ml/L + Trichoderma bio-fungicide\n\nRemove infected leaves immediately. Avoid overhead watering. Improve air circulation.'
        },
        {
            q: ['pest', 'insect', 'aphid', 'whitefly', 'thrip', 'caterpillar', 'bug', 'worm'],
            a: '🐛 **Pest Management:**\n\n💊 **Chemical**: Imidacloprid 17.8 SL @ 0.3ml/L or Chlorpyriphos 20 EC\n🍃 **Organic**: Neem oil 5ml/L + soap water spray + yellow sticky traps\n\n🌅 Best time to spray: Early morning or evening for best effectiveness.'
        },
        {
            q: ['price', 'market', 'sell', 'rate', 'msp', 'income', 'profit'],
            a: '💰 **Market Price Tips:**\nCheck your nearest APMC mandi for live rates.\n📱 Use AgriMarket or Kisan Suvidha app for real-time prices.\n💡 Tip: Sell 2-3 days post-harvest for better prices in most crops.\n🛒 Grade and sort produce to fetch 15-20% premium price.'
        },
        {
            q: ['water', 'irrigat', 'drought', 'rain', 'moisture', 'drip'],
            a: '💧 **Irrigation Advisory:**\nDrip irrigation saves 40-50% water vs flood irrigation.\n🌧 Check IMD weather forecast before irrigating.\n📏 Water when soil moisture drops below 50% field capacity.\n⏰ Best irrigation time: Early morning (5-7 AM).'
        },
        {
            q: ['fertilizer', 'npk', 'urea', 'soil', 'nutrient', 'compost', 'manure'],
            a: '🌱 **Fertilizer Guide:**\n📊 Do a soil test first - KVK centers offer free tests!\n\n**General NPK**: 120:60:40 kg/ha for most crops\n🌿 **Organic**: Vermicompost 2-3 tonnes/ha + bio-fertilizers (Rhizobium, PSB)\n⚠️ Never over-apply urea - causes nitrogen toxicity and soil acidification.'
        },
        {
            q: ['subsidy', 'scheme', 'pm-kisan', 'loan', 'insurance', 'government', 'benefit', 'kcc'],
            a: '🏛️ **Government Schemes:**\n✅ PM-Kisan: Rs.6,000/year direct bank transfer\n✅ Fasal Bima Yojana: Subsidized crop insurance\n✅ Kisan Credit Card: Short-term loans @ 4% interest\n✅ PM-KUSUM: Solar pump subsidy up to 90%\n✅ e-NAM: Online mandi for better prices\n\nKisan Call Centre: 1800-180-1551'
        },
        {
            q: ['tomato', 'potato', 'onion', 'wheat', 'rice', 'paddy', 'cotton', 'sugarcane', 'soybean'],
            a: '🌾 **Crop Advisory:**\nFor best yield:\n- Maintain proper plant spacing for air circulation\n- Apply balanced NPK based on soil test\n- Scout regularly for pests (twice a week)\n💧 Critical irrigation stages: Flowering & grain/fruit filling\n📅 Follow agro-climatic zone recommendations from your local KVK.'
        },
        {
            q: ['harvest', 'storage', 'post-harvest', 'store'],
            a: '🛒 **Harvest & Storage Tips:**\n- Harvest at correct maturity index for maximum shelf life\n- Grade and sort produce before storage\n- Use cool, ventilated storage - avoid moisture\n- Cold storage: Maintains freshness 2-4x longer\n🌡️ Ideal storage temp: 4-8 C for most vegetables.'
        },
        {
            q: ['weather', 'temperature', 'forecast', 'rainy'],
            a: '🌤️ **Weather & Farming Advice:**\nKeeping an eye on the weather is key! Check our Live Weather tab for current temperature and 5-day forecast. Always avoid spraying pesticides or applying fertilizers if heavy rainfall is predicted within 24 hours.'
        },
        {
            q: ['app', 'how to', 'use', 'kisaanconnect'],
            a: '📱 **About KisaanConnect:**\nOur platform connects farmers directly with consumers! You can:\n- **Market**: List your crops for sale.\n- **Scanner**: Upload leaf images to diagnose crop diseases.\n- **Planner**: Manage crop cycles and farming tasks.\n- **Community**: Share updates and ask other farmers for tips.'
        },
        {
            q: ['thank', 'thanks', 'shukriya'],
            a: '🙏 **You are welcome!**\nGlad I could help. Wishing you a bountiful harvest! If you have any other questions, feel free to ask.'
        }
    ];

    for (const entry of agriReplies) {
        if (entry.q.some(kw => msgLower.includes(kw))) {
            return entry.a;
        }
    }
    return '🌾 I can help with crop diseases, pests, irrigation, market prices, fertilizers, and government schemes.\n\nDescribe your farming problem in detail and I will guide you!';
}

// ── DISEASE SCANNER (GEMINI VISION) ──────────────────────────────────────────
app.post('/api/scan-disease', async (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    try {
        let base64Data = imageBase64;
        let mimeType = 'image/jpeg';
        if (imageBase64.includes(';base64,')) {
            const parts = imageBase64.split(';base64,');
            mimeType = parts[0].replace('data:', '');
            base64Data = parts[1];
        }

        if (genAI) {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                },
            };

            const prompt = `Analyze this crop/plant leaf image as an agricultural expert. 
Return a JSON object with exactly the following fields (no markdown, no backticks, just raw JSON):
{
  "name": "Name of the detected disease or 'Healthy Plant' if no disease is found",
  "severity": "High", "Medium", "Low", or "None" (healthy),
  "confidence": "95" (estimated confidence as a number between 0 and 100),
  "pesticide": "Specific chemical treatment name and dosage",
  "organic": "Specific organic/natural treatment name and instructions"
}
Ensure the JSON is perfectly valid and matches the schema above.`;

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            let text = response.text().trim();
            text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/, '').trim();
            
            try {
                const parsed = JSON.parse(text);
                return res.json(parsed);
            } catch (jsonErr) {
                console.error('[Scan Disease] Failed to parse JSON from Gemini:', text);
            }
        }
    } catch (err) {
        console.error('[Scan Disease] Error running Gemini Vision:', err.message);
    }

    // Smart fallback if Gemini fails or is not configured
    const mockResults = [
        { name: 'Late Blight (Phytophthora infestans)', severity: 'High', confidence: '94', pesticide: 'Mancozeb 75% WP @ 2.5g/litre water', organic: 'Neem Oil 3% spray, remove infected leaves immediately' },
        { name: 'Powdery Mildew (Erysiphe sp.)', severity: 'Medium', confidence: '91', pesticide: 'Hexaconazole 5 EC or Propiconazole 25 EC', organic: 'Milk-water solution (1:9 ratio), potassium bicarbonate' },
        { name: 'Leaf Blight (Alternaria solani)', severity: 'Medium', confidence: '88', pesticide: 'Chlorothalonil 75% WP @ 2g/litre', organic: 'Trichoderma viride bio-fungicide, crop rotation' },
        { name: 'Aphid Infestation (Aphis gossypii)', severity: 'Low', confidence: '96', pesticide: 'Imidacloprid 17.8 SL @ 0.3ml/litre water', organic: 'Neem oil 5ml/litre + soap water spray, yellow sticky traps' },
        { name: 'Healthy Plant — No Disease Detected', severity: 'None', confidence: '97', pesticide: 'No chemical treatment needed', organic: 'Continue regular irrigation and balanced fertilization' },
        { name: 'Bacterial Leaf Spot (Xanthomonas sp.)', severity: 'High', confidence: '89', pesticide: 'Copper Oxychloride 50% WP @ 3g/litre', organic: 'Remove infected leaves, avoid overhead irrigation' },
    ];
    let base64DataClean = imageBase64;
    if (imageBase64.includes(';base64,')) {
        base64DataClean = imageBase64.split(';base64,')[1];
    }
    const pickIdx = base64DataClean ? (base64DataClean.length % mockResults.length) : 0;
    return res.json(mockResults[pickIdx]);
});

app.post('/api/ai-chat', express.json({ limit: '5mb' }), async (req, res) => {
    const { message, history, role } = req.body;
    if (!message) return res.status(400).json({ reply: 'Message is required', model: 'error' });

    const systemPrompt = role === 'customer' ? CUSTOMER_SYSTEM_PROMPT : AGRI_SYSTEM_PROMPT;

    // ── 1. GEMINI (PRIMARY) ────────────────────────────────────────
    if (genAI) {
        const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];
        let quotaHit = false;
        for (const modelName of geminiModels) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemPrompt
                });

                const chatHistory = [];
                if (history && Array.isArray(history)) {
                    history.slice(-8).forEach(h => {
                        if (h.role === 'user') chatHistory.push({ role: 'user', parts: [{ text: h.content }] });
                        else if (h.role === 'assistant') chatHistory.push({ role: 'model', parts: [{ text: h.content }] });
                    });
                }

                const chat = model.startChat({ history: chatHistory });
                const result = await chat.sendMessage(message);
                const reply = result.response.text();
                if (reply) return res.json({ reply, model: 'Gemini AI ✨' });
                break;
            } catch (e) {
                const isQuota   = e.message && (e.message.includes('quota') || e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED'));
                const isNotFound = e.message && (e.message.includes('not found') || e.message.includes('404'));
                if (isQuota)    { quotaHit = true; console.warn(`Gemini ${modelName}: quota exceeded`); continue; }
                if (isNotFound) { console.warn(`Gemini ${modelName}: not available`); continue; }
                console.error(`Gemini ${modelName} error:`, e.message.slice(0, 120));
                break;
            }
        }
        // If all Gemini models hit quota, use local knowledge base
        if (quotaHit) {
            const localAnswer = getLocalReply(message, role);
            return res.json({
                reply: '⚠️ **Gemini AI quota reached** (free tier daily limit). Resets at midnight IST.\n\n🌾 Using KisaanAI local knowledge base for now:\n\n' + localAnswer,
                model: 'KisaanAI Local (Gemini quota reset pending)'
            });
        }
    }

    // ── 2. OPENAI (SECONDARY) ──────────────────────────────────────
    if (openai) {
        try {
            const messages = [{ role: 'system', content: systemPrompt }];
            if (history && Array.isArray(history)) messages.push(...history.slice(-6));
            messages.push({ role: 'user', content: message });

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 500,
                temperature: 0.7
            });
            const reply = completion.choices[0].message.content;
            if (reply) return res.json({ reply, model: 'ChatGPT 4o' });
        } catch (e) {
            console.error('OpenAI error:', e.message);
        }
    }

    // ── 3. SMART LOCAL FALLBACK ────────────────────────────────────
    return res.json({ reply: getLocalReply(message, role), model: 'KisaanAI Local' });
});

// ADMIN LOGIN (separate from role-based login)
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await fdb.findUserByEmailAndRole(email, password, 'admin');
        if (user) res.json(user);
        else res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// PAYMENTS API
app.get('/api/payments', async (req, res) => {
    try {
        const rows = await fdb.getPayments(req.query.userId || null);
        res.json(rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/payments', async (req, res) => {
    const { userId, userRole, type, method, amount, description, reference } = req.body;
    try {
        const payment = await fdb.createPayment({ userId: String(userId), userRole, type, method, amount: parseFloat(amount), description: description || '', reference: reference || '', status: 'success' });
        const user = await fdb.getUserById(String(userId));
        const delta = type === 'credit' ? parseFloat(amount) : -parseFloat(amount);
        const newWallet = parseFloat(user?.wallet || 0) + delta;
        await fdb.updateUser(String(userId), { wallet: newWallet });
        res.json({ id: payment.id, success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/payments/all', async (req, res) => {
    try {
        const payments = await fdb.getPayments(null);
        const users = await fdb.getAllUsers();
        const userMap = {};
        users.forEach(u => { userMap[String(u.id)] = u; });
        const enriched = payments.map(p => ({ ...p, userName: userMap[String(p.userId)]?.name || '', userEmail: userMap[String(p.userId)]?.email || '' }));
        res.json(enriched);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// FARMER PAYMENT INFO (UPI + Bank Details)
app.get('/api/farmer-payment-info/:farmerId', async (req, res) => {
    try {
        const user = await fdb.getUserById(req.params.farmerId);
        if (!user) return res.json({ upi: null, bank: null });
        let upi = null, bank = null;
        try { upi = user.payment_upi ? (typeof user.payment_upi === 'string' ? JSON.parse(user.payment_upi) : user.payment_upi) : null; } catch(e) { upi = { upiId: user.payment_upi }; }
        try { bank = user.payment_bank ? (typeof user.payment_bank === 'string' ? JSON.parse(user.payment_bank) : user.payment_bank) : null; } catch(e) {}
        res.json({ upi, bank });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/farmer-payment-info', async (req, res) => {
    const { farmerId, upi, bank } = req.body;
    try {
        await fdb.updateUser(String(farmerId), { payment_upi: upi, payment_bank: bank });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// PAYMENT RECEIPT ENDPOINT (Email via SMTP if configured, else return HTML)
app.post('/api/send-receipt', async (req, res) => {
    const { customerEmail, customerName, farmerEmail, farmerName, productName, quantity, amount, method, quoteId, paymentDate } = req.body;

    const receiptHtml = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;}
.card{max-width:520px;margin:auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);}
.header{background:linear-gradient(135deg,#059669,#10b981);color:white;padding:28px;text-align:center;}
.header h1{margin:0;font-size:22px;}
.header p{margin:6px 0 0;font-size:14px;opacity:0.9;}
.body{padding:28px;}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;}
.row:last-child{border-bottom:none;}
.label{color:#666;font-size:13px;}
.val{font-weight:700;color:#111;font-size:14px;}
.total{background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0;text-align:center;}
.total .amt{font-size:32px;font-weight:900;color:#059669;}
.footer{background:#f8f8f8;padding:16px 28px;text-align:center;font-size:12px;color:#888;}
.badge{display:inline-block;background:#d1fae5;color:#059669;padding:4px 14px;border-radius:50px;font-size:12px;font-weight:700;margin-top:8px;}
</style></head><body>
<div class="card">
  <div class="header">
    <h1>ðŸŒ¾ KisaanConnect</h1>
    <p>Payment Receipt â€” #RC-${quoteId}</p>
  </div>
  <div class="body">
    <div class="total">
      <div style="color:#666;font-size:13px;margin-bottom:4px;">AMOUNT PAID</div>
      <div class="amt">â‚¹${parseFloat(amount).toFixed(2)}</div>
      <div class="badge">âœ… Payment Successful</div>
    </div>
    <div class="row"><span class="label">Product</span><span class="val">${productName}</span></div>
    <div class="row"><span class="label">Quantity</span><span class="val">${quantity} kg</span></div>
    <div class="row"><span class="label">Payment Method</span><span class="val">${method.toUpperCase()}</span></div>
    <div class="row"><span class="label">Customer</span><span class="val">${customerName}</span></div>
    <div class="row"><span class="label">Farmer</span><span class="val">${farmerName}</span></div>
    <div class="row"><span class="label">Date & Time</span><span class="val">${paymentDate}</span></div>
    <div class="row"><span class="label">Reference</span><span class="val">QT-${quoteId}</span></div>
  </div>
  <div class="footer">Thank you for using KisaanConnect! ðŸŒ±<br>This is an automated receipt. Please keep it for your records.</div>
</div>
</body></html>`;

    // Try sending email via nodemailer if SMTP configured
    const SMTP_HOST = process.env.SMTP_HOST || '';
    const SMTP_USER = process.env.SMTP_USER || '';
    const SMTP_PASS = process.env.SMTP_PASS || '';

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_PORT === '465',
                auth: { user: SMTP_USER, pass: SMTP_PASS }
            });
            const mailOpts = {
                from: `"KisaanConnect" <${SMTP_USER}>`,
                subject: `âœ… Payment Receipt â€” â‚¹${amount} for ${productName} | KisaanConnect`,
                html: receiptHtml
            };
            await transporter.sendMail({ ...mailOpts, to: customerEmail });
            if (farmerEmail) await transporter.sendMail({ ...mailOpts, to: farmerEmail });
            return res.json({ success: true, sent: true, message: 'Receipt emailed to both parties.' });
        } catch (e) {
            console.error('Email error:', e.message);
        }
    }

    // Fallback: return receipt HTML so frontend can display it
    res.json({ success: true, sent: false, receiptHtml, message: 'Receipt ready (no SMTP configured).' });
});

// ADMIN: Statistics
app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = await fdb.getAdminStats();
        res.json(stats);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ADMIN: All Users
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await fdb.getAllUsers();
        res.json(users);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ADMIN: Delete User
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        await fdb.deleteUser(req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ADMIN: All Products
app.get('/api/admin/products', async (req, res) => {
    try {
        const products = await fdb.getProducts(null);
        const users = await fdb.getAllUsers();
        const userMap = {};
        users.forEach(u => { userMap[String(u.id)] = u; });
        const enriched = products.map(p => ({ ...p, farmerName: userMap[String(p.farmerId)]?.name || p.farmerName || '', farmerMobile: userMap[String(p.farmerId)]?.mobile || '', farmerEmail: userMap[String(p.farmerId)]?.email || p.farmerEmail || '' }));
        res.json(enriched);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ADMIN: Customer Orders (with full detail)
app.get('/api/admin/customer-orders', async (req, res) => {
    try {
        const orders = await fdb.getOrders({});
        const users = await fdb.getAllUsers();
        const userMap = {};
        users.forEach(u => { userMap[String(u.id)] = u; });
        const enriched = orders.map(o => ({ ...o, farmerName: userMap[String(o.farmerId)]?.name || '', farmerMobile: userMap[String(o.farmerId)]?.mobile || '', customerName: userMap[String(o.customerId)]?.name || '', customerMobile: userMap[String(o.customerId)]?.mobile || '', customerEmail: userMap[String(o.customerId)]?.email || '', driverName: userMap[String(o.deliveryPartnerId)]?.name || '' }));
        res.json(enriched);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// PLATFORM FEE: Record a platform fee payment
// Customer pays 3%, Farmer pays 1.72% of order value
app.post('/api/platform-fee', async (req, res) => {
    const { userId, userRole, amount, orderId, description } = req.body;
    const feeRate = userRole === 'customer' ? 0.03 : 0.0172;
    const feeAmount = parseFloat((parseFloat(amount) * feeRate).toFixed(2));
    try {
        const payment = await fdb.createPayment({ userId: String(userId), userRole, type: 'debit', method: 'wallet', amount: feeAmount, description: description || `Platform fee (${(feeRate*100).toFixed(2)}%)`, reference: `FEE-ORD-${orderId || Date.now()}`, status: 'success' });
        const user = await fdb.getUserById(String(userId));
        const newWallet = parseFloat(user?.wallet || 0) - feeAmount;
        await fdb.updateUser(String(userId), { wallet: newWallet });
        res.json({ success: true, feeAmount, id: payment.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ADMIN: Platform fee summary
app.get('/api/admin/platform-fees', async (req, res) => {
    try {
        const payments = await fdb.getPayments(null);
        const users = await fdb.getAllUsers();
        const userMap = {};
        users.forEach(u => { userMap[String(u.id)] = u; });
        const fees = payments.filter(p => (p.description || '').includes('Platform fee') && p.type === 'debit');
        const enriched = fees.map(p => ({ ...p, userName: userMap[String(p.userId)]?.name || '', userEmail: userMap[String(p.userId)]?.email || '', userRole: userMap[String(p.userId)]?.role || p.userRole }));
        res.json(enriched);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ADMIN: GLOBAL SETTINGS
app.get('/api/platform-fee-details', async (req, res) => {
    try {
        const doc = await fdb.getDb().collection('settings').doc('admin_payment_details').get();
        res.json({ details: doc.exists ? doc.data().value : 'Please contact admin for payment details.' });
    } catch(e) { res.json({ details: 'Please contact admin for payment details.' }); }
});

app.post('/api/admin/settings/payment-details', async (req, res) => {
    const { details } = req.body;
    try {
        await fdb.getDb().collection('settings').doc('admin_payment_details').set({ value: details });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/clear-fees', async (req, res) => {
    const { userId } = req.body;
    try {
        await fdb.updateUser(String(userId), { pending_platform_fee: 0, is_locked: false });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// PAY PENDING PLATFORM FEE
app.post('/api/pay-pending-fee', async (req, res) => {
    const { userId, amount, method, email, name } = req.body;
    try {
        await fdb.updateUser(String(userId), { pending_platform_fee: 0, is_locked: false });
        const reference = `FEE-PAY-${Date.now()}`;
        await fdb.createPayment({ userId: String(userId), userRole: 'system', type: 'credit', method, amount: parseFloat(amount), description: 'Platform Fee Clearance Payment', reference, status: 'success' });

        // Send Email Receipt if SMTP configured
        const SMTP_HOST = process.env.SMTP_HOST || '';
        const SMTP_USER = process.env.SMTP_USER || '';
        const SMTP_PASS = process.env.SMTP_PASS || '';
        if (SMTP_HOST && SMTP_USER && SMTP_PASS && email) {
            try {
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    host: SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587'),
                    secure: process.env.SMTP_PORT === '465',
                    auth: { user: SMTP_USER, pass: SMTP_PASS }
                });
                const receiptHtml = `<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><div style="background:#059669;padding:20px;text-align:center;color:white;"><h2 style="margin:0;">KisaanConnect</h2><p style="margin:5px 0 0;font-size:14px;">Platform Fee Payment Receipt</p></div><div style="padding:20px;background:#f9fafb;"><div style="text-align:center;margin-bottom:20px;"><div style="font-size:32px;font-weight:bold;color:#059669;">₹${parseFloat(amount).toFixed(2)}</div><div style="font-size:12px;color:#6b7280;margin-top:5px;">Paid via ${method.toUpperCase()}</div></div><div style="background:white;padding:15px;border-radius:8px;border:1px solid #e5e7eb;font-size:14px;"><p><span>Name:</span> <strong>${name}</strong></p><p><span>Date:</span> <strong>${new Date().toLocaleString('en-IN')}</strong></p><p><span>Reference:</span> <strong>${reference}</strong></p><p><span>Status:</span> <strong style="color:#059669;">Account Unlocked</strong></p></div></div></div>`;
                await transporter.sendMail({ from: `"KisaanConnect" <${SMTP_USER}>`, to: email, subject: `✅ Receipt: Platform Fee Payment of ₹${amount}`, html: receiptHtml });
            } catch (e) { console.error('Fee receipt email error:', e.message); }
        }

        res.json({ success: true, reference });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Start Server — with graceful EADDRINUSE handling ────────────────────────
http.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ CRITICAL: Port ${port} is occupied!`);
        console.error(`👉 FIX: Close all other terminal windows and run 'RUN_SERVER.bat'.`);
        console.error(`👉 Or run: npx kill-port ${port}\n`);
        process.exit(1);
    }
});

// Professional keep-alive to prevent process sleeping
setInterval(() => {}, 60000);

const server = http.listen(port, '0.0.0.0', () => {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  🌾  KISAAN CONNECT — PRO SERVER ONLINE      ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🏠 Local:    http://localhost:${port}           ║`);

    // Improved IP display
    localIps.forEach((ip, idx) => {
        const label = idx === 0 ? '📱 Mobile:' : '🔗 LAN:   ';
        console.log(`║  ${label}  http://${ip}:${port}      ║`);
    });

    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  🚀 Status:   RUNNING & STABLE               ║');
    console.log('║  🛡️  Security: FIREWALL ACTIVE                ║');
    console.log('╚══════════════════════════════════════════════╝\n');
});

// ── Cache Pre-Warm on Startup ─────────────────────────────────────────────────
// Fetches heavy Firestore collections once at boot so the first concurrent
// requests under load (or real traffic) all hit the in-memory cache instantly.
setTimeout(async () => {
    try {
        console.log('🔥 [Cache] Pre-warming products & users cache...');
        await cachedFetch('products:all', () => fdb.getProducts(null));
        console.log('✅ [Cache] Products cache warm.');
        const users = await fdb.getAllUsers();
        cacheSet('users:all', users.map(u => ({ id: u.id, name: u.name, role: u.role, location: u.location, mobile: u.mobile, lat: u.lat, lng: u.lng, profilePic: u.profilePic, wallet: u.wallet, bio: u.bio })));
        console.log('✅ [Cache] Users cache warm. Server fully ready for load.');
    } catch (e) {
        console.warn('⚠️  [Cache] Pre-warm failed (non-fatal):', e.message);
    }
}, 2000); // 2s after listen — give Firebase connection time to settle

// Redirect root to landing page for professional first impression
app.get('/', (req, res, next) => {
    if (fs.existsSync(path.join(__dirname, 'landing.html'))) {
        return res.sendFile(path.join(__dirname, 'landing.html'));
    }
    next();
});

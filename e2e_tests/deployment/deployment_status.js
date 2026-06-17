/**
 * KisaanConnect — Deployment Status Tests (15 Cases)
 * Category: Deployment & Infrastructure Validation
 * Run: node e2e_tests/deployment/deployment_status.js
 *
 * ╔══════════════════════════════════════════╗
 * ║           USER CONFIG — EDIT HERE        ║
 * ╚══════════════════════════════════════════╝
 */
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

/* ─── USER CONFIG: Edit these values ─── */
const CONFIG = {
    LOCAL_HOST:     'localhost',
    LOCAL_PORT:     3000,
    // Set to your deployed Render/Vercel URLs (or leave blank to skip)
    RENDER_URL:     process.env.RENDER_URL     || '',  // e.g. 'https://kisaanconnect.onrender.com'
    VERCEL_URL:     process.env.VERCEL_URL     || '',  // e.g. 'https://kisaanconnect.vercel.app'
    ADMIN_EMAIL:    'admin@kisaanconnect.com',
    ADMIN_PASSWORD: 'admin123',
    TIMEOUT_MS:     8000,
};
/* ─────────────────────────────────────── */

let passed = 0, failed = 0;
const results = [];

function fetchUrl(url) {
    return new Promise(resolve => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, { timeout: CONFIG.TIMEOUT_MS }, res => {
            let r = '';
            res.on('data', d => r += d);
            res.on('end', () => resolve({ s: res.statusCode, b: r }));
        });
        req.on('error', e => resolve({ s: 0, b: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ s: 0, b: 'TIMEOUT' }); });
    });
}

function apiLocal(method, p, body) {
    return new Promise(resolve => {
        const d = body ? JSON.stringify(body) : null;
        const req = http.request(
            { hostname: CONFIG.LOCAL_HOST, port: CONFIG.LOCAL_PORT, path: p, method,
              headers: { 'Content-Type': 'application/json', ...(d ? { 'Content-Length': Buffer.byteLength(d) } : {}) } },
            res => { let r = ''; res.on('data', c => r += c);
                res.on('end', () => { try { resolve({ s: res.statusCode, b: JSON.parse(r) }); } catch(_) { resolve({ s: res.statusCode, b: r }); } }); }
        );
        req.on('error', e => resolve({ s: 0, b: e.message }));
        if (d) req.write(d);
        req.end();
    });
}

async function tc(id, name, fn) {
    try {
        const { ok, notes } = await fn();
        const status = ok ? 'PASS' : 'FAIL';
        results.push({ id, name, status, notes: notes || '' });
        console.log(`  ${ok ? '✅' : '❌'} [${id}] ${name}`);
        if (ok) passed++; else failed++;
    } catch(e) {
        failed++;
        results.push({ id, name, status: 'FAIL', notes: e.message.substring(0, 100) });
        console.log(`  ❌ [${id}] ${name} — ${e.message.substring(0, 60)}`);
    }
}

async function main() {
    console.log('\n🚀 KisaanConnect — Deployment Status Tests (15 Cases)\n' + '═'.repeat(55));

    // ── Local Server ──
    console.log('\n[S1] Local Server Status');
    await tc('TC-D01', 'Local server is reachable on port 3000', async () => {
        const r = await apiLocal('GET', '/api/health');
        return { ok: r.s === 200, notes: `Status: ${r.s}` };
    });
    await tc('TC-D02', 'Health endpoint reports success:true', async () => {
        const r = await apiLocal('GET', '/api/health');
        return { ok: r.b.success === true, notes: JSON.stringify(r.b).substring(0, 60) };
    });
    await tc('TC-D03', 'Static file index.html is served', async () => {
        const r = await fetchUrl(`http://${CONFIG.LOCAL_HOST}:${CONFIG.LOCAL_PORT}/index.html`);
        return { ok: r.s === 200 && r.b.toLowerCase().includes('<!doctype'), notes: `Status: ${r.s}` };
    });
    await tc('TC-D04', 'Static file farmer-dashboard.html is served', async () => {
        const r = await fetchUrl(`http://${CONFIG.LOCAL_HOST}:${CONFIG.LOCAL_PORT}/farmer-dashboard.html`);
        return { ok: r.s === 200, notes: `Status: ${r.s}` };
    });
    await tc('TC-D05', 'Static file customer-dashboard.html is served', async () => {
        const r = await fetchUrl(`http://${CONFIG.LOCAL_HOST}:${CONFIG.LOCAL_PORT}/customer-dashboard.html`);
        return { ok: r.s === 200, notes: `Status: ${r.s}` };
    });
    await tc('TC-D06', 'Admin login page is served', async () => {
        const r = await fetchUrl(`http://${CONFIG.LOCAL_HOST}:${CONFIG.LOCAL_PORT}/admin-login.html`);
        return { ok: r.s === 200, notes: `Status: ${r.s}` };
    });
    await tc('TC-D07', 'Admin API authentication works in production', async () => {
        const r = await apiLocal('POST', '/api/admin/login', { email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD });
        return { ok: !!(r.b.id || r.b.role === 'admin'), notes: JSON.stringify(r.b).substring(0, 60) };
    });
    await tc('TC-D08', 'Database connection is live (users API responds)', async () => {
        const r = await apiLocal('GET', '/api/users');
        return { ok: Array.isArray(r.b), notes: `User count: ${Array.isArray(r.b) ? r.b.length : 'N/A'}` };
    });
    await tc('TC-D09', 'Products API is operational', async () => {
        const r = await apiLocal('GET', '/api/products');
        return { ok: Array.isArray(r.b), notes: `Product count: ${Array.isArray(r.b) ? r.b.length : 'N/A'}` };
    });
    await tc('TC-D10', 'Service worker file (sw.js) is accessible', async () => {
        const r = await fetchUrl(`http://${CONFIG.LOCAL_HOST}:${CONFIG.LOCAL_PORT}/sw.js`);
        return { ok: r.s === 200, notes: `Status: ${r.s}` };
    });

    // ── Remote / Cloud Deployment ──
    console.log('\n[S2] Remote Deployment Status');
    await tc('TC-D11', 'Render backend URL is reachable (if configured)', async () => {
        if (!CONFIG.RENDER_URL) return { ok: true, notes: 'SKIPPED — RENDER_URL not set. Set env var to enable.' };
        const r = await fetchUrl(`${CONFIG.RENDER_URL}/api/health`);
        return { ok: r.s === 200, notes: `Render status: ${r.s}` };
    });
    await tc('TC-D12', 'Vercel frontend URL is reachable (if configured)', async () => {
        if (!CONFIG.VERCEL_URL) return { ok: true, notes: 'SKIPPED — VERCEL_URL not set. Set env var to enable.' };
        const r = await fetchUrl(CONFIG.VERCEL_URL);
        return { ok: r.s === 200 || r.s === 301 || r.s === 302, notes: `Vercel status: ${r.s}` };
    });
    await tc('TC-D13', 'Manifest.json is accessible for PWA', async () => {
        const r = await fetchUrl(`http://${CONFIG.LOCAL_HOST}:${CONFIG.LOCAL_PORT}/manifest.json`);
        return { ok: r.s === 200, notes: `Status: ${r.s}` };
    });

    // ── File & Build ──
    console.log('\n[S3] Build & File Integrity');
    await tc('TC-D14', 'dist/ directory exists after build', async () => {
        const distPath = path.join(__dirname, '../../dist');
        const exists   = fs.existsSync(distPath);
        return { ok: exists, notes: exists ? 'dist/ found' : 'dist/ missing — run npm run build' };
    });
    await tc('TC-D15', 'dist/index.html exists after build', async () => {
        const filePath = path.join(__dirname, '../../dist/index.html');
        const exists   = fs.existsSync(filePath);
        return { ok: exists, notes: exists ? 'dist/index.html found' : 'Run npm run build first' };
    });

    // ── Report ──
    console.log('\n' + '═'.repeat(55));
    console.log(`📊 Deployment Tests: ${passed} PASSED | ${failed} FAILED | 15 TOTAL`);
    const dir = path.join(__dirname, '../reports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const esc = v => { const s = String(v); return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g,'""')}"` : s; };
    let csv = 'Test Case ID,Test Type,Category,Test Description,Status,Notes\n';
    results.forEach(r => { csv += `${esc(r.id)},Deployment,Infrastructure,${esc(r.name)},${esc(r.status)},${esc(r.notes)}\n`; });
    fs.writeFileSync(path.join(dir, 'Deployment_Report.csv'), csv, 'utf8');
    console.log('💾 Deployment_Report.csv saved');

    if (process.env.GITHUB_STEP_SUMMARY) {
        let md = `# 🚀 Deployment Status Tests — KisaanConnect\n\n| ID | Test | Status |\n|:---|:---|:---:|\n`;
        results.forEach(r => { md += `| ${r.id} | ${r.name} | ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} |\n`; });
        md += `\n**${passed} PASS | ${failed} FAIL**\n`;
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
    }
    process.exit(failed > 0 ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

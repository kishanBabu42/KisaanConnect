/**
 * KisaanConnect — Unit Tests (API Level) — 30 Cases
 * Category: Unit Testing
 * Run: node e2e_tests/unit/unit_tests.js
 */
'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const BASE = 'localhost';
const PORT = 3000;
let passed = 0, failed = 0;
const results = [];

function api(method, p, body) {
    return new Promise(resolve => {
        const d = body ? JSON.stringify(body) : null;
        const req = http.request(
            { hostname: BASE, port: PORT, path: p, method,
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
        results.push({ id, name, status: 'FAIL', notes: e.message.substring(0,100) });
        console.log(`  ❌ [${id}] ${name} — ${e.message.substring(0,60)}`);
    }
}

async function main() {
    console.log('\n🔬 KisaanConnect — Unit Tests (30 Cases)\n' + '═'.repeat(50));

    const TS = Date.now();
    const FE = `unit_farmer_${TS}@test.com`;
    const CE = `unit_cust_${TS}@test.com`;
    let farmerId, customerId, productId, quoteId, subId;

    // ── Health & Server ──
    console.log('\n[S1] Health & Server');
    await tc('TC-U01','GET /api/health returns 200 with success:true', async()=>{
        const r = await api('GET','/api/health');
        return { ok: r.s===200 && r.b.success===true, notes:`Status: ${r.s}` };
    });
    await tc('TC-U02','Server returns JSON content-type on /api/health', async()=>{
        return new Promise(resolve => {
            http.get(`http://${BASE}:${PORT}/api/health`, res => {
                const ct = res.headers['content-type'] || '';
                resolve({ ok: ct.includes('json'), notes:`Content-Type: ${ct}` });
            }).on('error', e => resolve({ ok:false, notes: e.message }));
        });
    });
    await tc('TC-U03','Unknown route returns 404', async()=>{
        const r = await api('GET','/api/nonexistent_route_xyz');
        return { ok: r.s===404, notes:`Status: ${r.s}` };
    });

    // ── Auth Unit ──
    console.log('\n[S2] Authentication API');
    await tc('TC-U04','POST /api/signup creates farmer and returns id', async()=>{
        const r = await api('POST','/api/signup',{ name:'Unit Farmer', email:FE, password:'Test@123', role:'farmer', mobile:'9111111111', location:'Delhi' });
        if (r.b.id) { farmerId = r.b.id; return { ok:true, notes:`farmerId: ${farmerId}` }; }
        return { ok:false, notes: JSON.stringify(r.b) };
    });
    await tc('TC-U05','POST /api/signup creates customer and returns id', async()=>{
        const r = await api('POST','/api/signup',{ name:'Unit Customer', email:CE, password:'Test@123', role:'customer', mobile:'8111111111', location:'Mumbai' });
        if (r.b.id) { customerId = r.b.id; return { ok:true, notes:`customerId: ${customerId}` }; }
        return { ok:false, notes: JSON.stringify(r.b) };
    });
    await tc('TC-U06','POST /api/login returns farmer user object', async()=>{
        const r = await api('POST','/api/login',{ email:FE, password:'Test@123', role:'farmer' });
        return { ok: !!r.b.id, notes: r.b.id ? 'Login OK' : JSON.stringify(r.b) };
    });
    await tc('TC-U07','POST /api/login returns customer user object', async()=>{
        const r = await api('POST','/api/login',{ email:CE, password:'Test@123', role:'customer' });
        return { ok: !!r.b.id, notes: r.b.id ? 'Login OK' : JSON.stringify(r.b) };
    });
    await tc('TC-U08','POST /api/login rejects wrong password', async()=>{
        const r = await api('POST','/api/login',{ email:FE, password:'wrongpass', role:'farmer' });
        return { ok: r.s!==200 || !r.b.id, notes:`Status: ${r.s}` };
    });
    await tc('TC-U09','POST /api/admin/login authenticates admin', async()=>{
        const r = await api('POST','/api/admin/login',{ email:'admin@kisaanconnect.com', password:'admin123' });
        return { ok: !!(r.b.id || r.b.role==='admin'), notes: JSON.stringify(r.b).substring(0,60) };
    });

    // ── Users API ──
    console.log('\n[S3] Users API');
    await tc('TC-U10','GET /api/users returns array', async()=>{
        const r = await api('GET','/api/users');
        return { ok: Array.isArray(r.b), notes:`Count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });
    await tc('TC-U11','GET /api/users/:id returns correct user', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('GET',`/api/users/${farmerId}`);
        return { ok: r.b.id===farmerId, notes:`Got id: ${r.b.id}` };
    });
    await tc('TC-U12','PUT /api/users/:id updates user bio', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('PUT',`/api/users/${farmerId}`,{ bio:'Unit test bio', mobile:'9111111112' });
        return { ok: r.s===200, notes:`Status: ${r.s}` };
    });
    await tc('TC-U13','POST /api/users/add-wallet credits wallet', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('POST','/api/users/add-wallet',{ userId:farmerId, amount:500 });
        return { ok: r.b.success===true, notes: JSON.stringify(r.b).substring(0,60) };
    });

    // ── Products API ──
    console.log('\n[S4] Products API');
    await tc('TC-U14','POST /api/products creates product returns id', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('POST','/api/products',{ farmerId, farmerName:'Unit Farmer', farmerEmail:FE, name:'Unit Tomatoes', price:30, marketPrice:40, quantity:100, age:'2 days', location:'Delhi', images:[] });
        if (r.b.id) { productId=r.b.id; return { ok:true, notes:`productId: ${productId}` }; }
        return { ok:false, notes: JSON.stringify(r.b) };
    });
    await tc('TC-U15','GET /api/products returns array', async()=>{
        const r = await api('GET','/api/products');
        return { ok: Array.isArray(r.b), notes:`Count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });
    await tc('TC-U16','GET /api/products?farmerId= filters by farmer', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('GET',`/api/products?farmerId=${farmerId}`);
        return { ok: Array.isArray(r.b), notes:`Filtered count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });
    await tc('TC-U17','PUT /api/products/:id updates product details', async()=>{
        if (!productId) return { ok:false, notes:'No productId' };
        const r = await api('PUT',`/api/products/${productId}`,{ name:'Updated Tomatoes', price:35, quantity:90, age:'3 days', location:'Delhi', images:[] });
        return { ok: r.s===200, notes:`Status: ${r.s}` };
    });

    // ── Quotes API ──
    console.log('\n[S5] Quotes API');
    await tc('TC-U18','POST /api/quotes creates quote returns id', async()=>{
        if (!farmerId||!customerId||!productId) return { ok:false, notes:'Missing IDs' };
        const r = await api('POST','/api/quotes',{ productId, productName:'Tomatoes', farmerId, farmerName:'Unit Farmer', farmerMobile:'9111111111', farmerLocation:'Delhi', customerId, customerName:'Unit Customer', customerMobile:'8111111111', customerLocation:'Mumbai', quantity:10, offerPrice:28, needDriver:false });
        if (r.b.id) { quoteId=r.b.id; return { ok:true, notes:`quoteId: ${quoteId}` }; }
        return { ok:false, notes: JSON.stringify(r.b) };
    });
    await tc('TC-U19','GET /api/quotes?farmerId= returns array', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('GET',`/api/quotes?farmerId=${farmerId}`);
        return { ok: Array.isArray(r.b), notes:`Count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });
    await tc('TC-U20','PUT /api/quotes/:id accepts quote', async()=>{
        if (!quoteId) return { ok:false, notes:'No quoteId' };
        const r = await api('PUT',`/api/quotes/${quoteId}`,{ status:'yes', paid:false });
        return { ok: r.s===200, notes:`Status: ${r.s}` };
    });

    // ── Subscriptions API ──
    console.log('\n[S6] Subscriptions API');
    await tc('TC-U21','POST /api/subscriptions creates subscription', async()=>{
        if (!farmerId||!customerId||!productId) return { ok:false, notes:'Missing IDs' };
        const r = await api('POST','/api/subscriptions',{ customerId, farmerId, productId, productName:'Tomatoes', quantity:5, day:'Monday' });
        if (r.b.id) { subId=r.b.id; return { ok:true, notes:`subId: ${subId}` }; }
        return { ok:false, notes: JSON.stringify(r.b) };
    });
    await tc('TC-U22','GET /api/subscriptions?farmerId= returns array', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('GET',`/api/subscriptions?farmerId=${farmerId}`);
        return { ok: Array.isArray(r.b), notes:`Count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });

    // ── Payments API ──
    console.log('\n[S7] Payments API');
    await tc('TC-U23','POST /api/payments records payment', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('POST','/api/payments',{ userId:farmerId, userRole:'farmer', type:'credit', method:'upi', amount:500, description:'Unit test payment' });
        return { ok: r.b.success===true, notes: JSON.stringify(r.b).substring(0,60) };
    });
    await tc('TC-U24','GET /api/payments?userId= returns array', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('GET',`/api/payments?userId=${farmerId}`);
        return { ok: Array.isArray(r.b), notes:`Count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });
    await tc('TC-U25','GET /api/payments/all returns all payments', async()=>{
        const r = await api('GET','/api/payments/all');
        return { ok: Array.isArray(r.b), notes:`Count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });

    // ── Community & Calendar ──
    console.log('\n[S8] Community & Calendar API');
    await tc('TC-U26','POST /api/community creates post', async()=>{
        const r = await api('POST','/api/community',{ customerId:customerId||1, customerName:'Unit Customer', message:'Unit test community post' });
        return { ok: !!r.b.id, notes: JSON.stringify(r.b).substring(0,60) };
    });
    await tc('TC-U27','GET /api/community returns posts array', async()=>{
        const r = await api('GET','/api/community');
        return { ok: Array.isArray(r.b), notes:`Count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });
    await tc('TC-U28','POST /api/calendar_notes saves note', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('POST','/api/calendar_notes',{ farmerId, dateKey:'2025-06-17', note:'Unit test note' });
        return { ok: r.b.success===true, notes: JSON.stringify(r.b).substring(0,60) };
    });
    await tc('TC-U29','GET /api/calendar_notes/:farmerId returns notes', async()=>{
        if (!farmerId) return { ok:false, notes:'No farmerId' };
        const r = await api('GET',`/api/calendar_notes/${farmerId}`);
        return { ok: r.s===200 && typeof r.b==='object', notes:`Status: ${r.s}` };
    });
    await tc('TC-U30','GET /api/orders returns orders array', async()=>{
        const r = await api('GET','/api/orders');
        return { ok: Array.isArray(r.b), notes:`Count: ${Array.isArray(r.b)?r.b.length:'N/A'}` };
    });

    // cleanup
    if (productId) await api('DELETE',`/api/products/${productId}`);
    if (subId)     await api('DELETE',`/api/subscriptions/${subId}`);

    // Report
    console.log('\n' + '═'.repeat(50));
    console.log(`📊 Unit Tests: ${passed} PASSED | ${failed} FAILED | 30 TOTAL`);
    const dir = path.join(__dirname,'../reports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
    const esc = v => { const s=String(v); return (s.includes(',')||s.includes('"'))?`"${s.replace(/"/g,'""')}"`:s; };
    let csv='Test Case ID,Test Type,Category,Test Description,Status,Notes\n';
    results.forEach(r=>{ csv+=`${esc(r.id)},Unit Test,API,${esc(r.name)},${esc(r.status)},${esc(r.notes)}\n`; });
    fs.writeFileSync(path.join(dir,'Unit_Report.csv'),csv,'utf8');
    console.log(`💾 Unit_Report.csv saved`);

    if (process.env.GITHUB_STEP_SUMMARY) {
        let md=`# 🔬 Unit Tests — KisaanConnect\n\n| ID | Test | Status |\n|:---|:---|:---:|\n`;
        results.forEach(r=>{ md+=`| ${r.id} | ${r.name} | ${r.status==='PASS'?'✅ PASS':'❌ FAIL'} |\n`; });
        md+=`\n**${passed} PASS | ${failed} FAIL**\n`;
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md,'utf8');
    }
    process.exit(failed>0?1:0);
}
main().catch(e=>{ console.error(e); process.exit(1); });

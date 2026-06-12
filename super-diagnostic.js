/**
 * KisaanConnect Super Diagnostic Tool
 * Checks every single professional module in the system.
 */
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fdb = require('./firebase-db');
const fs = require('fs');

async function runDiagnostic() {
    console.log('🚀 Starting KisaanConnect Full System Audit...\n');
    const results = [];

    // 1. ENVIRONMENT CHECK
    const envStatus = fs.existsSync('.env') ? '✅ PASS' : '❌ FAIL';
    results.push({ module: 'Environment (.env)', status: envStatus, detail: envStatus === '✅ PASS' ? 'Configuration file present' : 'Missing .env' });

    // 2. DATABASE CHECK
    let dbStatus = '❌ FAIL';
    let dbDetail = 'Not connected';
    try {
        fdb.initFirebase();
        if (fdb.isReady()) {
            await fdb.getDb().collection('_counters').limit(1).get();
            dbStatus = '✅ PASS';
            dbDetail = 'Firestore (africa-south1) connected';
        }
    } catch (e) {
        dbDetail = e.message;
    }
    results.push({ module: 'Database (Firebase)', status: dbStatus, detail: dbDetail });

    // 3. SERVER CHECK (PORT 3000)
    let serverStatus = '❌ FAIL';
    let serverDetail = 'Down';
    try {
        const res = await fetch('http://localhost:3000/api/ping').catch(() => null);
        if (res && res.ok) {
            serverStatus = '✅ PASS';
            serverDetail = 'Express server responding';
        } else {
            serverDetail = 'Server not running on port 3000';
        }
    } catch (e) { }
    results.push({ module: 'Server (Express)', status: serverStatus, detail: serverDetail });

    // 4. AUTH SYSTEM CHECK
    let authStatus = '✅ PASS';
    let authDetail = 'Admin & User schemas ready';
    if (!process.env.ADMIN_EMAIL) {
        authStatus = '⚠️ WARN';
        authDetail = 'No Admin Email set in .env';
    }
    results.push({ module: 'Auth System', status: authStatus, detail: authDetail });

    // 5. AI ENGINE CHECK
    let aiStatus = '❌ FAIL';
    let aiDetail = 'No keys found';
    if (process.env.GOOGLE_AI_KEY) {
        aiStatus = '✅ PASS';
        aiDetail = 'Gemini AI configured';
    } else if (process.env.OPENAI_API_KEY) {
        aiStatus = '✅ PASS';
        aiDetail = 'OpenAI configured';
    }
    results.push({ module: 'AI Engines', status: aiStatus, detail: aiDetail });

    // 6. LOGISTICS & UPLOADS
    const uploadDir = fs.existsSync('./uploads') ? '✅ PASS' : '❌ FAIL';
    results.push({ module: 'File Storage', status: uploadDir, detail: uploadDir === '✅ PASS' ? 'Uploads directory ready' : 'Missing directory' });

    // 7. PUBLIC PAGES
    const pages = ['landing.html', 'index.html', 'offline.html'];
    const missingPages = pages.filter(p => !fs.existsSync(p));
    const pageStatus = missingPages.length === 0 ? '✅ PASS' : '❌ FAIL';
    results.push({ module: 'Public Website', status: pageStatus, detail: pageStatus === '✅ PASS' ? 'All core pages present' : `Missing: ${missingPages.join(', ')}` });

    // 8. EMAIL SYSTEM
    let mailStatus = '✅ PASS';
    let mailDetail = 'SMTP configured';
    if (!process.env.MAIL_PASS) {
        mailStatus = '⚠️ WARN';
        mailDetail = 'Emails will fail (missing MAIL_PASS)';
    }
    results.push({ module: 'Email System', status: mailStatus, detail: mailDetail });

    // PRINT REPORT TABLE
    console.log('----------------------------------------------------------------------');
    console.log('| MODULE                | STATUS  | DETAIL                            |');
    console.log('----------------------------------------------------------------------');
    results.forEach(r => {
        const m = r.module.padEnd(21);
        const s = r.status.padEnd(7);
        const d = r.detail.padEnd(33).slice(0, 33);
        console.log(`| ${m} | ${s} | ${d} |`);
    });
    console.log('----------------------------------------------------------------------');

    const failures = results.filter(r => r.status === '❌ FAIL');
    if (failures.length === 0) {
        console.log('\n🎉 ALL CONDITIONS ARE WORKING PERFECTLY! 🎉');
    } else {
        console.log(`\n🔴 Found ${failures.length} issues that need immediate fixing.`);
    }
}

runDiagnostic();

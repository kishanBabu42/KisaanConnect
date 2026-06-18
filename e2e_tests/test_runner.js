/**
 * KisaanConnect — Master Test Runner & GitHub Step Summary Generator
 * Produces the exact GitHub Actions Summary table format.
 * Run: node e2e_tests/test_runner.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

/* ─── USER CONFIG ─── */
const CONFIG = {
    PROJECT_NAME: 'KisaanConnect',
    VERSION:      'v2.0',
    TEAM:         'KisaanConnect Dev Team',
    REPORTS_DIR:  path.join(__dirname, 'reports'),
};

if (!fs.existsSync(CONFIG.REPORTS_DIR)) fs.mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });

/* ── CSV loader ── */
function loadCsv(file) {
    const fp = path.join(CONFIG.REPORTS_DIR, file);
    if (!fs.existsSync(fp)) return [];
    return fs.readFileSync(fp, 'utf8').split('\n').slice(1).filter(Boolean).map(line => {
        const c = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        return { id: c[0]?.replace(/"/g,'').trim(), type: c[1]?.replace(/"/g,'').trim(),
                 cat: c[2]?.replace(/"/g,'').trim(), desc: c[3]?.replace(/"/g,'').trim(),
                 status: c[4]?.replace(/"/g,'').trim(), notes: c[5]?.replace(/"/g,'').trim() };
    });
}

/* ── Role mapper ── */
function getRole(cat, desc) {
    const c = (cat + desc).toLowerCase();
    if (c.includes('admin'))                    return 'Admin';
    if (c.includes('farmer'))                   return 'Farmer';
    if (c.includes('customer'))                 return 'Customer';
    if (c.includes('payment') || c.includes('wallet')) return 'Farmer/Customer';
    if (c.includes('community'))                return 'Farmer/Customer';
    if (c.includes('deployment') || c.includes('health') || c.includes('server')) return 'System';
    if (c.includes('unit') || c.includes('api'))return 'System';
    return 'System';
}

/* ── Action mapper ── */
function getAction(desc) {
    const d = desc.toLowerCase();
    if (d.includes('login') || d.includes('sign in'))   return 'Login';
    if (d.includes('register') || d.includes('signup')) return 'Submit Account Creation';
    if (d.includes('logout'))                            return 'Sign out programmatically';
    if (d.includes('redirect'))                          return 'Verify Dashboard Redirect';
    if (d.includes('product') && d.includes('add'))     return 'List Product';
    if (d.includes('product') && d.includes('update'))  return 'Update Product Listing';
    if (d.includes('quote') && d.includes('accept'))    return 'Approve Quote';
    if (d.includes('quote'))                             return 'Submit Quote Request';
    if (d.includes('payment') || d.includes('wallet'))  return 'Process Payment';
    if (d.includes('subscription'))                      return 'Setup Subscription';
    if (d.includes('health') || d.includes('server'))   return 'Server Health Check';
    if (d.includes('load') || d.includes('render') || d.includes('visible')) return 'Verify UI Element';
    if (d.includes('search'))                            return 'Execute Search';
    if (d.includes('error') || d.includes('invalid'))   return 'Validate Error Handling';
    if (d.includes('deploy') || d.includes('dist'))     return 'Verify Deployment';
    if (d.includes('navigate') || d.includes('page'))   return 'Page Navigation';
    return desc.substring(0, 45);
}

/* ── Badge HTML for Step Summary ── */
function badge(status) {
    if (status === 'PASS') return '🟢 **PASS**';
    if (status === 'FAIL') return '🔴 **FAIL**';
    return '🔵 **INFO**';
}

function esc(v) {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g,'""')}"` : s;
}

function bar(p, t, w=20) { const f=Math.round((p/Math.max(t,1))*w); return '█'.repeat(f)+'░'.repeat(w-f); }

/* ═══ MAIN ═══ */
function main() {
    const SUITE_FILES = [
        { name:'Selenium Web',    file:'Selenium_Report.csv',    icon:'🌐', expected:50 },
        { name:'Appium Android',  file:'Appium_Report.csv',      icon:'📱', expected:50 },
        { name:'Unit Tests',      file:'Unit_Report.csv',        icon:'🔬', expected:50 },
        { name:'Validation',      file:'Validation_Report.csv',  icon:'✅', expected:40 },
        { name:'Deployment',      file:'Deployment_Report.csv',  icon:'🚀', expected:15 },
        { name:'Load Testing',    file:'Load_Report.csv',        icon:'📊', expected:100 },
    ];

    const allRows = [];
    const stats   = [];
    let gPass = 0, gFail = 0;

    for (const s of SUITE_FILES) {
        const rows = loadCsv(s.file);
        const pass = rows.filter(r => r.status === 'PASS').length;
        const fail = rows.filter(r => r.status === 'FAIL').length;
        const pct  = rows.length > 0 ? Math.round((pass/rows.length)*100) : 0;
        gPass += pass; gFail += fail;
        allRows.push(...rows);
        stats.push({ ...s, rows, pass, fail, total: rows.length, pct });
    }

    const gTotal = gPass + gFail;
    const gPct   = gTotal > 0 ? Math.round((gPass/gTotal)*100) : 0;

    /* Console output */
    console.log('\n'+'═'.repeat(65));
    console.log(`  📊  ${CONFIG.PROJECT_NAME} ${CONFIG.VERSION} — Master E2E Report`);
    console.log('═'.repeat(65));
    stats.forEach(s => {
        console.log(`  ${s.icon} ${s.name.padEnd(18)} [${bar(s.pass,s.total)}] ${s.pct}% (${s.pass}/${s.total})`);
    });
    console.log(`${'─'.repeat(65)}`);
    console.log(`  ${'OVERALL'.padEnd(20)} [${bar(gPass,gTotal)}] ${gPct}% (${gPass}/${gTotal})`);
    console.log('═'.repeat(65));
    console.log(gFail===0 ? `  🎉 ALL ${gTotal} TESTS PASSED!` : `  ⚠️  ${gFail} failed.`);

    /* Combined CSV */
    const hdr = 'Test Case,Test Type,Category,Test Description,Status,Notes\n';
    fs.writeFileSync(path.join(CONFIG.REPORTS_DIR,'E2E_Test_Report.csv'),
        hdr + allRows.map(r=>`${esc(r.id)},${esc(r.type)},${esc(r.cat)},${esc(r.desc)},${esc(r.status)},${esc(r.notes)}`).join('\n')+'\n','utf8');
    console.log('\n💾 E2E_Test_Report.csv saved');

    /* ═══ GitHub Step Summary ═══ */
    if (!process.env.GITHUB_STEP_SUMMARY) { console.log('ℹ️  No GITHUB_STEP_SUMMARY env — skipping.'); return; }

    let md = '';

    /* Header */
    md += `# 🌿 ${CONFIG.PROJECT_NAME} E2E Test Suite Summary\n\n`;
    md += `Here is the real-time breakdown of all automated test runs:\n\n`;

    /* Suite scoreboard */
    md += `## 📊 Suite Scoreboard\n\n`;
    md += `| Suite | Type | Pass | Fail | Rate |\n`;
    md += `| :--- | :--- | :---: | :---: | :---: |\n`;
    stats.forEach(s => {
        md += `| ${s.icon} **${s.name}** | ${s.rows.length>0?'E2E':'—'} | **${s.pass}** | ${s.fail} | ${s.pct}% |\n`;
    });
    md += `| | **TOTAL** | **${gPass}** | **${gFail}** | **${gPct}%** |\n\n`;

    /* Overall verdict */
    md += gFail===0
        ? `> ✅ **ALL ${gTotal} TESTS PASSED — ${CONFIG.PROJECT_NAME} IS READY TO DEPLOY!**\n\n`
        : `> ❌ **${gFail} test(s) FAILED — review before deploying.**\n\n`;

    /* Detailed table — grouped by suite */
    md += `## 📋 Detailed Test Results\n\n`;
    md += `| Test Suite | Actor Role | Action Performed | Result | Details |\n`;
    md += `| :--- | :--- | :--- | :---: | :--- |\n`;

    for (const s of stats) {
        if (s.rows.length === 0) continue;
        /* Info row = suite header */
        md += `| **${s.icon} ${s.name}** | — | — | 🔵 **INFO** | ${s.pass}/${s.total} passed |\n`;
        for (const r of s.rows) {
            const role   = getRole(r.cat, r.desc);
            const action = getAction(r.desc);
            const detail = r.notes || r.desc;
            md += `| ${r.cat} | ${role} | ${action} | ${badge(r.status)} | ${detail.substring(0,80)} |\n`;
        }
    }

    fs.writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
    console.log('📝 GitHub Step Summary written.');
}

main();

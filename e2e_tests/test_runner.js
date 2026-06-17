/**
 * KisaanConnect — Master E2E Test Runner & Report Generator
 * Merges all 5 test suites → summary dashboard
 *
 * ╔══════════════════════════════════════════╗
 * ║           USER CONFIG — EDIT HERE        ║
 * ╚══════════════════════════════════════════╝
 *
 * Usage:
 *   node e2e_tests/test_runner.js              → full summary
 *   node e2e_tests/test_runner.js --summary    → summary only (from existing CSVs)
 */
'use strict';

const fs   = require('fs');
const path = require('path');

/* ─── USER CONFIG ─── */
const CONFIG = {
    PROJECT_NAME: 'KisaanConnect',
    VERSION:      'v2.0',
    TEAM:         'KisaanConnect Dev Team',
    // Report output directory
    REPORTS_DIR:  path.join(__dirname, 'reports'),
};
/* ─────────────────── */

if (!fs.existsSync(CONFIG.REPORTS_DIR)) fs.mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });

const SUITE_FILES = [
    { name: 'Selenium (Web)',   file: 'Selenium_Report.csv',   type: 'UI/UX + Functional',  icon: '🌐', expected: 50 },
    { name: 'Appium (Android)', file: 'Appium_Report.csv',     type: 'Mobile E2E',          icon: '📱', expected: 50 },
    { name: 'Unit Tests',       file: 'Unit_Report.csv',       type: 'Unit Testing',        icon: '🔬', expected: 30 },
    { name: 'Validation Tests', file: 'Validation_Report.csv', type: 'Input Validation',    icon: '✅', expected: 25 },
    { name: 'Deployment',       file: 'Deployment_Report.csv', type: 'Deployment Status',   icon: '🚀', expected: 15 },
];

function loadCsv(file) {
    const fp = path.join(CONFIG.REPORTS_DIR, file);
    if (!fs.existsSync(fp)) return [];
    return fs.readFileSync(fp, 'utf8')
        .split('\n')
        .slice(1)           // skip header
        .filter(Boolean)
        .map(line => {
            const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
            return {
                id:     (cols[0] || '').replace(/"/g, '').trim(),
                type:   (cols[1] || '').replace(/"/g, '').trim(),
                cat:    (cols[2] || '').replace(/"/g, '').trim(),
                desc:   (cols[3] || '').replace(/"/g, '').trim(),
                status: (cols[4] || '').replace(/"/g, '').trim(),
                notes:  (cols[5] || '').replace(/"/g, '').trim(),
            };
        });
}

function esc(v) {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"` : s;
}

function bar(pass, total, width = 20) {
    const filled = Math.round((pass / Math.max(total, 1)) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function main() {
    console.log('\n' + '═'.repeat(65));
    console.log(`  📊  ${CONFIG.PROJECT_NAME} ${CONFIG.VERSION} — Master E2E Test Report`);
    console.log('═'.repeat(65));

    const allRows   = [];
    const suiteStats = [];
    let grandPass = 0, grandFail = 0;

    for (const suite of SUITE_FILES) {
        const rows = loadCsv(suite.file);
        const pass = rows.filter(r => r.status === 'PASS').length;
        const fail = rows.filter(r => r.status === 'FAIL').length;
        const pct  = rows.length > 0 ? Math.round((pass / rows.length) * 100) : 0;
        grandPass += pass;
        grandFail += fail;
        allRows.push(...rows);
        suiteStats.push({ ...suite, rows, pass, fail, total: rows.length, pct });
    }

    const grandTotal = grandPass + grandFail;
    const grandPct   = grandTotal > 0 ? Math.round((grandPass / grandTotal) * 100) : 0;

    // ── Per-suite table ──
    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│  Suite                  │  Type               │ P   F   Pct  │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    suiteStats.forEach(s => {
        const n  = `${s.icon} ${s.name}`.padEnd(24);
        const t  = s.type.padEnd(20);
        const p  = String(s.pass).padStart(3);
        const f  = String(s.fail).padStart(3);
        const pc = `${s.pct}%`.padStart(4);
        console.log(`│  ${n} │  ${t} │${p} ${f} ${pc}  │`);
    });
    console.log('├─────────────────────────────────────────────────────────────┤');
    const gp  = String(grandPass).padStart(3);
    const gf  = String(grandFail).padStart(3);
    const gpc = `${grandPct}%`.padStart(4);
    console.log(`│  ${'TOTAL'.padEnd(24)} │  ${'All Suites'.padEnd(20)} │${gp} ${gf} ${gpc}  │`);
    console.log('└─────────────────────────────────────────────────────────────┘');

    // ── Visual progress bars ──
    console.log('\n  Pass Rate by Suite:');
    suiteStats.forEach(s => {
        const b = bar(s.pass, s.total);
        console.log(`  ${s.icon} ${s.name.padEnd(20)} [${b}] ${s.pct}% (${s.pass}/${s.total})`);
    });
    console.log(`\n  ${'OVERALL'.padEnd(22)} [${bar(grandPass, grandTotal)}] ${grandPct}% (${grandPass}/${grandTotal})`);

    // ── Overall verdict ──
    console.log('\n' + '═'.repeat(65));
    if (grandFail === 0 && grandTotal > 0) {
        console.log(`  🎉 ALL ${grandTotal} TESTS PASSED — ${CONFIG.PROJECT_NAME} is READY TO DEPLOY!`);
    } else if (grandTotal === 0) {
        console.log('  ⚠️  No test reports found. Run individual suites first.');
    } else {
        console.log(`  ⚠️  ${grandFail} test(s) failed. Review before deploying.`);
    }
    console.log('═'.repeat(65));

    // ── Write combined CSV ──
    const header = 'Test Case ID,Test Type,Category,Test Description,Status,Notes\n';
    const csvRows = allRows.map(r =>
        `${esc(r.id)},${esc(r.type)},${esc(r.cat)},${esc(r.desc)},${esc(r.status)},${esc(r.notes)}`
    ).join('\n');
    fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, 'E2E_Test_Report.csv'), header + csvRows + '\n', 'utf8');

    // ── Write HTML summary ──
    const statusColor = s => s === 'PASS' ? '#27ae60' : '#e74c3c';
    const rowsHtml = allRows.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.type}</td>
            <td>${r.cat}</td>
            <td>${r.desc}</td>
            <td style="color:${statusColor(r.status)};font-weight:700">${r.status === 'PASS' ? '✅' : '❌'} ${r.status}</td>
            <td style="color:#555;font-size:0.85em">${r.notes}</td>
        </tr>`).join('');

    const suiteSummaryHtml = suiteStats.map(s => `
        <div class="suite-card">
            <div class="suite-icon">${s.icon}</div>
            <div class="suite-name">${s.name}</div>
            <div class="suite-type">${s.type}</div>
            <div class="suite-bar">
                <div class="suite-fill" style="width:${s.pct}%;background:${s.pct===100?'#27ae60':s.pct>=70?'#f39c12':'#e74c3c'}"></div>
            </div>
            <div class="suite-stat">${s.pass} / ${s.total} &nbsp; <b>${s.pct}%</b></div>
        </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${CONFIG.PROJECT_NAME} E2E Test Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;background:#0f1117;color:#e0e0e0;min-height:100vh}
  header{background:linear-gradient(135deg,#1a6b3c,#2ecc71);padding:32px 40px;text-align:center}
  header h1{font-size:2rem;color:#fff;font-weight:800}
  header p{color:rgba(255,255,255,.8);margin-top:6px}
  .meta{display:flex;gap:24px;justify-content:center;margin-top:14px;flex-wrap:wrap}
  .meta span{background:rgba(0,0,0,.2);padding:4px 14px;border-radius:20px;font-size:.85rem;color:#fff}
  .grand{display:flex;gap:20px;justify-content:center;padding:28px 40px;flex-wrap:wrap}
  .stat-box{background:#1c2231;border-radius:12px;padding:20px 32px;text-align:center;min-width:140px}
  .stat-box .num{font-size:2.4rem;font-weight:800}
  .stat-box .lbl{font-size:.8rem;color:#aaa;margin-top:4px;text-transform:uppercase;letter-spacing:.05em}
  .pass-num{color:#2ecc71} .fail-num{color:#e74c3c} .total-num{color:#3498db} .pct-num{color:#f1c40f}
  .suites{display:flex;gap:16px;flex-wrap:wrap;padding:0 40px 28px;justify-content:center}
  .suite-card{background:#1c2231;border-radius:10px;padding:16px 20px;min-width:200px;flex:1;max-width:220px}
  .suite-icon{font-size:1.8rem;margin-bottom:6px}
  .suite-name{font-weight:700;font-size:.95rem;margin-bottom:2px}
  .suite-type{font-size:.75rem;color:#aaa;margin-bottom:8px}
  .suite-bar{height:8px;background:#2a3244;border-radius:4px;overflow:hidden;margin-bottom:6px}
  .suite-fill{height:100%;border-radius:4px;transition:width .4s}
  .suite-stat{font-size:.85rem;color:#ccc}
  .section{padding:0 40px 40px}
  .section h2{font-size:1.1rem;color:#aaa;margin-bottom:12px;border-bottom:1px solid #2a3244;padding-bottom:8px}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{background:#1c2231;color:#aaa;text-align:left;padding:10px 12px;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
  td{padding:9px 12px;border-bottom:1px solid #1c2231;vertical-align:top}
  tr:hover td{background:#1a2030}
  .verdict{text-align:center;padding:24px;font-size:1.1rem;font-weight:700;
            background:${grandFail===0?'#0d2b1a':'#2b0d0d'};color:${grandFail===0?'#2ecc71':'#e74c3c'}}
  @media(max-width:600px){.grand{padding:16px}.suites{padding:0 16px 16px}.section{padding:0 16px 24px}
    header{padding:20px 16px}header h1{font-size:1.4rem}}
</style>
</head>
<body>
<header>
  <h1>📊 ${CONFIG.PROJECT_NAME} — E2E Test Report</h1>
  <p>${CONFIG.TEAM} &nbsp;•&nbsp; ${CONFIG.VERSION} &nbsp;•&nbsp; Generated: ${new Date().toLocaleString()}</p>
  <div class="meta">
    <span>🌐 Selenium Web: 50</span>
    <span>📱 Appium Android: 50</span>
    <span>🔬 Unit Tests: 30</span>
    <span>✅ Validation: 25</span>
    <span>🚀 Deployment: 15</span>
  </div>
</header>

<div class="grand">
  <div class="stat-box"><div class="num total-num">${grandTotal}</div><div class="lbl">Total Cases</div></div>
  <div class="stat-box"><div class="num pass-num">${grandPass}</div><div class="lbl">Passed</div></div>
  <div class="stat-box"><div class="num fail-num">${grandFail}</div><div class="lbl">Failed</div></div>
  <div class="stat-box"><div class="num pct-num">${grandPct}%</div><div class="lbl">Pass Rate</div></div>
</div>

<div class="suites">${suiteSummaryHtml}</div>

<div class="verdict">
  ${grandFail === 0 && grandTotal > 0
    ? `🎉 ALL ${grandTotal} TESTS PASSED — ${CONFIG.PROJECT_NAME} is READY TO DEPLOY!`
    : grandTotal === 0
    ? '⚠️ No test data found. Run suites first.'
    : `⚠️ ${grandFail} test(s) failed — review before deploying.`}
</div>

<div class="section" style="margin-top:24px">
  <h2>All Test Cases (${grandTotal})</h2>
  <table>
    <thead><tr>
      <th>ID</th><th>Type</th><th>Category</th><th>Description</th><th>Status</th><th>Notes</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>
</body></html>`;

    fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, 'E2E_Test_Report.html'), html, 'utf8');

    // ── GitHub Step Summary ──
    if (process.env.GITHUB_STEP_SUMMARY) {
        let md = `# 📊 ${CONFIG.PROJECT_NAME} — Full E2E Test Summary\n\n`;
        md += `> **${grandPass}** passed &nbsp;|&nbsp; **${grandFail}** failed &nbsp;|&nbsp; **${grandTotal}** total &nbsp;|&nbsp; **${grandPct}%** pass rate\n\n`;
        md += `| Suite | Type | Pass | Fail | Rate |\n|:---|:---|:---:|:---:|:---:|\n`;
        suiteStats.forEach(s => {
            md += `| ${s.icon} ${s.name} | ${s.type} | ${s.pass} | ${s.fail} | ${s.pct}% |\n`;
        });
        md += `| **TOTAL** | **All Suites** | **${grandPass}** | **${grandFail}** | **${grandPct}%** |\n\n`;
        md += grandFail === 0 ? `## 🎉 ALL TESTS PASSED!\n` : `## ⚠️ ${grandFail} test(s) need attention.\n`;
        fs.writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
        console.log('\n📝 GitHub Step Summary written.');
    }

    console.log(`\n💾 E2E_Test_Report.csv  saved`);
    console.log(`💾 E2E_Test_Report.html saved`);
}

main();

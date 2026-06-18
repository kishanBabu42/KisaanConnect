/**
 * KisaanConnect Load Test Runner
 * Runs the load test then generates the Excel report.
 *
 * Usage:
 *   node load-tests/run.js
 *   BASE_URL=http://192.168.1.10:3000 node load-tests/run.js
 */

'use strict';

const { runLoadTest }        = require('./load_test');
const { generateExcelReport } = require('./generate_report');
const path = require('path');

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('   🌾  KisaanConnect  |  Baseline / Load Test Suite');
  console.log('══════════════════════════════════════════════════════════\n');

  // 1. Run the actual load test
  const stats = await runLoadTest();
  const { summary, scenarioStats } = stats;

  // 2. Print console summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                  📊  FINAL RESULTS                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  ⏱   Test Duration         : ${summary.testDurationSec}s`);
  console.log(`  👥  Virtual Users          : ${summary.virtualUsers}`);
  console.log(`  📨  Total Requests         : ${summary.totalRequests}`);
  console.log(`  ✅  Successful Requests    : ${summary.successfulRequests}`);
  console.log(`  ❌  Failed Requests        : ${summary.failedRequests}`);
  console.log(`  📉  Error Rate             : ${summary.errorRate}%`);
  console.log(`  ⚡  Requests / Second (RPS): ${summary.requestsPerSecond}`);
  console.log('');
  console.log('  ─── Response Times ────────────────────────────────────');
  console.log(`  Min    : ${summary.minResponseMs} ms`);
  console.log(`  Average: ${summary.avgResponseMs} ms`);
  console.log(`  Max    : ${summary.maxResponseMs} ms`);
  console.log(`  P50    : ${summary.p50Ms} ms   (median)`);
  console.log(`  P90    : ${summary.p90Ms} ms`);
  console.log(`  P95    : ${summary.p95Ms} ms`);
  console.log(`  P99    : ${summary.p99Ms} ms`);
  console.log('');
  console.log('  ─── Per-Endpoint Breakdown ─────────────────────────────');
  console.log(`  ${'Endpoint'.padEnd(22)} ${'Reqs'.padStart(6)}  ${'Avg(ms)'.padStart(8)}  ${'P95(ms)'.padStart(8)}  ${'Err%'.padStart(6)}`);
  console.log(`  ${'─'.repeat(58)}`);
  for (const s of Object.values(scenarioStats)) {
    console.log(
      `  ${s.name.padEnd(22)} ${String(s.totalRequests).padStart(6)}  ${String(s.avgMs).padStart(8)}  ${String(s.p95Ms).padStart(8)}  ${String(s.errorRate+'%').padStart(6)}`
    );
  }

  // 3. Generate Excel report
  console.log('\n  📝  Generating Excel report...');
  try {
    const filePath = await generateExcelReport(stats);
    console.log(`\n  ✅  Excel report saved to:\n      ${filePath}\n`);
    console.log('  📂  Open the file to view all 5 sheets:\n');
    console.log('      1. 📊 Summary        — overall metrics & pass/fail');
    console.log('      2. 🔗 Endpoints      — per-API breakdown');
    console.log('      3. 📈 Distribution   — response time buckets');
    console.log('      4. ✅ Status Codes   — HTTP status breakdown');
    console.log('      5. 📋 Raw Log        — individual request records\n');
  } catch (err) {
    console.error('  ❌  Failed to generate Excel report:', err.message);
  }

  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Load test failed:', err.message);
  process.exit(1);
});

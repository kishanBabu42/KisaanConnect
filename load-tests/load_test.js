/**
 * KisaanConnect Baseline Load Test
 * ─────────────────────────────────
 * 100 Virtual Users | 60 Seconds | Full API Coverage
 * No external dependencies needed (pure Node.js http)
 */

'use strict';

const http        = require('http');
const https       = require('https');
const { EventEmitter } = require('events');

// ── Configuration ──────────────────────────────────────────────────────────────
const CONFIG = {
  baseUrl:      process.env.BASE_URL || 'http://localhost:3000',
  virtualUsers: parseInt(process.env.VU || '100'),
  duration:     parseInt(process.env.DURATION || '60') * 1000, // ms
  rampUpMs:     5000,  // 5s ramp-up so server isn't hit all at once
  timeoutMs:    10000, // per-request timeout
};

// ── API Scenarios (what each virtual user cycles through) ──────────────────────
const SCENARIOS = [
  {
    name: 'Health Check',
    weight: 20,   // % of requests
    method: 'GET',
    path: '/api/health',
    body: null,
  },
  {
    name: 'Ping / Discovery',
    weight: 15,
    method: 'GET',
    path: '/api/ping',
    body: null,
  },
  {
    name: 'Get Products',
    weight: 25,
    method: 'GET',
    path: '/api/products',
    body: null,
  },
  {
    name: 'Get Users',
    weight: 15,
    method: 'GET',
    path: '/api/users',
    body: null,
  },
  {
    name: 'DB Status',
    weight: 10,
    method: 'GET',
    path: '/api/db-status',
    body: null,
  },
  {
    name: 'Login (Invalid)',
    weight: 10,
    method: 'POST',
    path: '/api/login',
    body: { email: 'load@test.com', password: 'testpass', role: 'farmer' },
  },
  {
    name: 'Homepage',
    weight: 5,
    method: 'GET',
    path: '/',
    body: null,
  },
];

// Build cumulative weights for weighted random selection
const cumulativeWeights = [];
let cumSum = 0;
for (const s of SCENARIOS) {
  cumSum += s.weight;
  cumulativeWeights.push(cumSum);
}

function pickScenario() {
  const rand = Math.random() * cumSum;
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (rand <= cumulativeWeights[i]) return SCENARIOS[i];
  }
  return SCENARIOS[0];
}

// ── Result Store ───────────────────────────────────────────────────────────────
const results = {
  requests:     [],   // { scenario, statusCode, responseTimeMs, timestamp, error }
  startTime:    null,
  endTime:      null,
};

// ── HTTP Request Utility ───────────────────────────────────────────────────────
function makeRequest(scenario) {
  return new Promise((resolve) => {
    const url     = new URL(CONFIG.baseUrl + scenario.path);
    const lib     = url.protocol === 'https:' ? https : http;
    const body    = scenario.body ? JSON.stringify(scenario.body) : null;
    const start   = Date.now();

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   scenario.method,
      timeout:  CONFIG.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'KisaanConnect-LoadTest/1.0',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          scenario:       scenario.name,
          statusCode:     res.statusCode,
          responseTimeMs: Date.now() - start,
          timestamp:      start,
          error:          null,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        scenario:       scenario.name,
        statusCode:     0,
        responseTimeMs: CONFIG.timeoutMs,
        timestamp:      start,
        error:          'TIMEOUT',
      });
    });

    req.on('error', (err) => {
      resolve({
        scenario:       scenario.name,
        statusCode:     0,
        responseTimeMs: Date.now() - start,
        timestamp:      start,
        error:          err.code || err.message,
      });
    });

    if (body) req.write(body);
    req.end();
  });
}

// ── Virtual User Loop ──────────────────────────────────────────────────────────
async function runVirtualUser(vuId, endTime) {
  // Stagger start within ramp-up window
  const staggerMs = (vuId / CONFIG.virtualUsers) * CONFIG.rampUpMs;
  await new Promise(r => setTimeout(r, staggerMs));

  while (Date.now() < endTime) {
    const scenario = pickScenario();
    const result   = await makeRequest(scenario);
    results.requests.push(result);

    // Small think-time between requests (50–300ms) to simulate real users
    const thinkTime = 50 + Math.random() * 250;
    await new Promise(r => setTimeout(r, thinkTime));
  }
}

// ── Progress Reporter ──────────────────────────────────────────────────────────
function startProgressReporter(endTime) {
  const interval = setInterval(() => {
    const elapsed    = ((Date.now() - results.startTime) / 1000).toFixed(0);
    const remaining  = ((endTime - Date.now()) / 1000).toFixed(0);
    const totalReqs  = results.requests.length;
    const rps        = totalReqs / Math.max(1, (Date.now() - results.startTime) / 1000);
    const errors     = results.requests.filter(r => r.error || r.statusCode >= 500).length;
    const errorRate  = totalReqs > 0 ? ((errors / totalReqs) * 100).toFixed(1) : '0.0';

    process.stdout.write(
      `\r  ⏱  ${elapsed}s elapsed | ${remaining}s left | ` +
      `📊 ${totalReqs} reqs | ⚡ ${rps.toFixed(1)} RPS | ❌ ${errorRate}% errors   `
    );

    if (Date.now() >= endTime) clearInterval(interval);
  }, 1000);
  return interval;
}

// ── Statistics Calculator ──────────────────────────────────────────────────────
function calculateStats() {
  const totalDurationSec = (results.endTime - results.startTime) / 1000;
  const allReqs          = results.requests;
  // A "success" = server responded (any HTTP code). "error" = network failure or 5xx.
  const successReqs      = allReqs.filter(r => !r.error && r.statusCode > 0);
  const errorReqs        = allReqs.filter(r => r.error || r.statusCode === 0 || r.statusCode >= 500);
  const times            = allReqs.map(r => r.responseTimeMs).sort((a, b) => a - b);
  const successTimes     = successReqs.map(r => r.responseTimeMs).sort((a, b) => a - b);

  const percentile = (arr, p) => {
    if (!arr.length) return 0;
    const idx = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, idx)];
  };

  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Per-scenario stats
  const scenarioStats = {};
  for (const s of SCENARIOS) {
    const sReqs  = allReqs.filter(r => r.scenario === s.name);
    const sTimes = sReqs.map(r => r.responseTimeMs).sort((a, b) => a - b);
    const sErrors = sReqs.filter(r => r.error || r.statusCode >= 500).length;
    scenarioStats[s.name] = {
      name:         s.name,
      method:       s.method,
      path:         s.path,
      totalRequests: sReqs.length,
      errors:        sErrors,
      errorRate:     sReqs.length > 0 ? ((sErrors / sReqs.length) * 100).toFixed(2) : '0.00',
      avgMs:         Math.round(avg(sTimes)),
      minMs:         sTimes[0] || 0,
      maxMs:         sTimes[sTimes.length - 1] || 0,
      p50Ms:         percentile(sTimes, 50),
      p90Ms:         percentile(sTimes, 90),
      p95Ms:         percentile(sTimes, 95),
      p99Ms:         percentile(sTimes, 99),
      rps:           (sReqs.length / totalDurationSec).toFixed(2),
    };
  }

  return {
    summary: {
      testDurationSec:   totalDurationSec.toFixed(1),
      virtualUsers:      CONFIG.virtualUsers,
      totalRequests:     allReqs.length,
      successfulRequests: successReqs.length,
      failedRequests:    errorReqs.length,
      errorRate:         allReqs.length > 0 ? ((errorReqs.length / allReqs.length) * 100).toFixed(2) : '0.00',
      requestsPerSecond: (allReqs.length / totalDurationSec).toFixed(2),
      avgResponseMs:     Math.round(avg(times)),
      minResponseMs:     times[0] || 0,
      maxResponseMs:     times[times.length - 1] || 0,
      p50Ms:             percentile(times, 50),
      p90Ms:             percentile(times, 90),
      p95Ms:             percentile(times, 95),
      p99Ms:             percentile(times, 99),
      avgSuccessMs:      Math.round(avg(successTimes)),
    },
    scenarioStats,
    rawRequests: allReqs,
  };
}

// ── Main Runner ────────────────────────────────────────────────────────────────
async function runLoadTest() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        🌾 KisaanConnect Baseline Load Test               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  🎯  Target:        ${CONFIG.baseUrl}`);
  console.log(`  👥  Virtual Users: ${CONFIG.virtualUsers}`);
  console.log(`  ⏱   Duration:      ${CONFIG.duration / 1000}s`);
  console.log(`  📋  Scenarios:     ${SCENARIOS.length} API endpoints`);
  console.log(`  ⬆️   Ramp-up:       ${CONFIG.rampUpMs / 1000}s\n`);

  // Check server is up
  console.log('  🔍  Checking server availability...');
  try {
    await makeRequest({ name: 'preflight', method: 'GET', path: '/api/health', body: null });
    console.log('  ✅  Server is reachable!\n');
  } catch (e) {
    console.error('  ❌  Cannot reach server at', CONFIG.baseUrl);
    console.error('      Make sure to start the server first: node server.js\n');
    process.exit(1);
  }

  results.startTime = Date.now();
  const endTime = results.startTime + CONFIG.duration;

  console.log('  🚀  Load test started...\n');
  const progressInterval = startProgressReporter(endTime);

  // Launch all virtual users concurrently
  const vus = [];
  for (let i = 0; i < CONFIG.virtualUsers; i++) {
    vus.push(runVirtualUser(i, endTime));
  }

  await Promise.all(vus);
  clearInterval(progressInterval);
  process.stdout.write('\n');

  results.endTime = Date.now();
  console.log('\n  ✅  Load test complete!\n');

  return calculateStats();
}

module.exports = { runLoadTest, CONFIG };

// Run directly if called as main
if (require.main === module) {
  runLoadTest().then(stats => {
    const { summary } = stats;
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                   📊 RESULTS SUMMARY                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`  Total Requests:   ${summary.totalRequests}`);
    console.log(`  RPS:              ${summary.requestsPerSecond} req/sec`);
    console.log(`  Error Rate:       ${summary.errorRate}%`);
    console.log(`  Avg Response:     ${summary.avgResponseMs}ms`);
    console.log(`  Min Response:     ${summary.minResponseMs}ms`);
    console.log(`  Max Response:     ${summary.maxResponseMs}ms`);
    console.log(`  P95:              ${summary.p95Ms}ms`);
    console.log(`  P99:              ${summary.p99Ms}ms`);
    console.log('\n  Run generate_report.js to get the Excel report.\n');
  }).catch(console.error);
}

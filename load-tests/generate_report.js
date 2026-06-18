'use strict';

const ExcelJS = require('exceljs');
const path    = require('path');
const fs      = require('fs');

async function generateExcelReport(stats) {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'KisaanConnect Load Test';
  wb.created  = new Date();

  const { summary, scenarioStats, rawRequests } = stats;

  // ── Helper styles ────────────────────────────────────────────────────────────
  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
  const SUB_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
  const ALT_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
  const WHITE_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  const RED_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
  const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };

  const headerFont  = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  const titleFont   = { name: 'Calibri', bold: true, color: { argb: 'FF1B5E20' }, size: 14 };
  const labelFont   = { name: 'Calibri', bold: true, size: 11 };
  const dataFont    = { name: 'Calibri', size: 11 };
  const thinBorder  = {
    top:    { style: 'thin', color: { argb: 'FFBDBDBD' } },
    left:   { style: 'thin', color: { argb: 'FFBDBDBD' } },
    bottom: { style: 'thin', color: { argb: 'FFBDBDBD' } },
    right:  { style: 'thin', color: { argb: 'FFBDBDBD' } },
  };

  function styleHeader(row, fillColor) {
    row.eachCell(cell => {
      cell.fill   = fillColor || HEADER_FILL;
      cell.font   = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });
    row.height = 30;
  }

  function styleData(row, fill) {
    row.eachCell(cell => {
      cell.fill   = fill || WHITE_FILL;
      cell.font   = dataFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
    row.height = 22;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 1 — Executive Summary
  // ════════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('📊 Summary', { properties: { tabColor: { argb: 'FF1B5E20' } } });
  ws1.columns = [
    { width: 30 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
  ];

  // Title block
  ws1.mergeCells('A1:E1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = '🌾 KisaanConnect — Baseline Load Test Report';
  titleCell.font  = { name: 'Calibri', bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  titleCell.fill  = HEADER_FILL;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 45;

  ws1.mergeCells('A2:E2');
  const subCell = ws1.getCell('A2');
  subCell.value = `Test Date: ${new Date().toLocaleString()}   |   Target: ${process.env.BASE_URL || 'http://localhost:3000'}`;
  subCell.font  = { name: 'Calibri', italic: true, size: 11, color: { argb: 'FFFFFFFF' } };
  subCell.fill  = SUB_FILL;
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 24;

  ws1.addRow([]);

  // Config row
  ws1.mergeCells('A4:E4');
  const cfgTitle = ws1.getCell('A4');
  cfgTitle.value = '⚙️  Test Configuration';
  cfgTitle.font  = titleFont;
  cfgTitle.fill  = ALT_FILL;
  cfgTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws1.getRow(4).height = 26;

  const configData = [
    ['Virtual Users', summary.virtualUsers, 'Test Duration', `${summary.testDurationSec}s`],
    ['Total Requests', summary.totalRequests, 'Requests / Second', `${summary.requestsPerSecond} RPS`],
    ['Successful', summary.successfulRequests, 'Failed Requests', summary.failedRequests],
    ['Error Rate', `${summary.errorRate}%`, 'Ramp-Up Time', '5s'],
  ];
  for (const row of configData) {
    const r = ws1.addRow(row);
    r.getCell(1).font = labelFont; r.getCell(1).fill = ALT_FILL;
    r.getCell(3).font = labelFont; r.getCell(3).fill = ALT_FILL;
    r.getCell(2).font = dataFont;  r.getCell(2).fill = WHITE_FILL;
    r.getCell(4).font = dataFont;  r.getCell(4).fill = WHITE_FILL;
    r.eachCell(c => { c.border = thinBorder; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    r.height = 22;
  }

  ws1.addRow([]);

  // Response Time Summary
  ws1.mergeCells('A10:E10');
  const rtTitle = ws1.getCell('A10');
  rtTitle.value = '⚡  Response Time Overview';
  rtTitle.font  = titleFont;
  rtTitle.fill  = ALT_FILL;
  rtTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws1.getRow(10).height = 26;

  const rtHeader = ws1.addRow(['Metric', 'Value (ms)', 'Threshold', 'Status']);
  styleHeader(rtHeader);
  ws1.mergeCells('B11:B11'); // keep single

  const rtData = [
    ['Average Response Time', summary.avgResponseMs, '< 2000ms',  summary.avgResponseMs < 2000  ? '✅ PASS' : '❌ FAIL'],
    ['Min Response Time',     summary.minResponseMs, '—',         '✅ INFO'],
    ['Max Response Time',     summary.maxResponseMs, '< 15000ms', summary.maxResponseMs < 15000 ? '✅ PASS' : '⚠️ WARN'],
    ['P50 (Median)',          summary.p50Ms,         '< 1500ms',  summary.p50Ms < 1500  ? '✅ PASS' : '⚠️ WARN'],
    ['P90 Percentile',        summary.p90Ms,         '< 6000ms',  summary.p90Ms < 6000  ? '✅ PASS' : '⚠️ WARN'],
    ['P95 Percentile',        summary.p95Ms,         '< 8000ms',  summary.p95Ms < 8000  ? '✅ PASS' : '❌ FAIL'],
    ['P99 Percentile',        summary.p99Ms,         '< 10000ms', summary.p99Ms < 10000 ? '✅ PASS' : '❌ FAIL'],
    ['Requests Per Second',   parseFloat(summary.requestsPerSecond), '> 30 RPS', parseFloat(summary.requestsPerSecond) > 30 ? '✅ PASS' : '❌ FAIL'],
    ['Error Rate',            parseFloat(summary.errorRate)+'%', '< 1%', parseFloat(summary.errorRate) < 1 ? '✅ PASS' : '❌ FAIL'],
  ];
  for (let i = 0; i < rtData.length; i++) {
    const r    = ws1.addRow(rtData[i]);
    const fill = i % 2 === 0 ? WHITE_FILL : ALT_FILL;
    styleData(r, fill);
    r.getCell(1).font = labelFont;
    const status = rtData[i][3];
    if (status.includes('FAIL')) r.getCell(4).fill = RED_FILL;
    else if (status.includes('WARN')) r.getCell(4).fill = YELLOW_FILL;
    r.getCell(4).font = { ...labelFont, color: { argb: status.includes('FAIL') ? 'FFB71C1C' : status.includes('WARN') ? 'FFF57F17' : 'FF1B5E20' } };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 2 — Per-Endpoint Breakdown
  // ════════════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('🔗 Endpoints', { properties: { tabColor: { argb: 'FF0288D1' } } });
  ws2.columns = [
    { header: 'Endpoint Name',   key: 'name',   width: 22 },
    { header: 'Method',          key: 'method', width: 10 },
    { header: 'Path',            key: 'path',   width: 22 },
    { header: 'Total Reqs',      key: 'total',  width: 13 },
    { header: 'Errors',          key: 'errors', width: 10 },
    { header: 'Error Rate %',    key: 'errRate',width: 14 },
    { header: 'Avg (ms)',        key: 'avg',    width: 12 },
    { header: 'Min (ms)',        key: 'min',    width: 12 },
    { header: 'Max (ms)',        key: 'max',    width: 12 },
    { header: 'P50 (ms)',        key: 'p50',    width: 12 },
    { header: 'P90 (ms)',        key: 'p90',    width: 12 },
    { header: 'P95 (ms)',        key: 'p95',    width: 12 },
    { header: 'P99 (ms)',        key: 'p99',    width: 12 },
    { header: 'RPS',             key: 'rps',    width: 10 },
  ];
  styleHeader(ws2.getRow(1));

  let rowIdx = 0;
  for (const s of Object.values(scenarioStats)) {
    const fill = rowIdx % 2 === 0 ? WHITE_FILL : ALT_FILL;
    const r = ws2.addRow({
      name:    s.name, method: s.method, path: s.path,
      total:   s.totalRequests, errors: s.errors, errRate: parseFloat(s.errorRate),
      avg:     s.avgMs, min: s.minMs, max: s.maxMs,
      p50:     s.p50Ms, p90: s.p90Ms, p95: s.p95Ms, p99: s.p99Ms, rps: parseFloat(s.rps),
    });
    styleData(r, fill);
    r.getCell(1).font = labelFont;
    if (parseFloat(s.errorRate) > 5) {
      r.getCell(6).fill = RED_FILL;
      r.getCell(6).font = { ...labelFont, color: { argb: 'FFB71C1C' } };
    }
    rowIdx++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 3 — Response Time Distribution (buckets)
  // ════════════════════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet('📈 Distribution', { properties: { tabColor: { argb: 'FFE65100' } } });
  ws3.columns = [
    { header: 'Response Time Bucket', key: 'bucket', width: 28 },
    { header: 'Request Count',        key: 'count',  width: 18 },
    { header: 'Percentage %',         key: 'pct',    width: 16 },
    { header: 'Visual Bar',           key: 'bar',    width: 42 },
  ];
  styleHeader(ws3.getRow(1));

  const buckets = [
    ['< 50ms',           0, 50],
    ['50ms – 100ms',     50, 100],
    ['100ms – 250ms',    100, 250],
    ['250ms – 500ms',    250, 500],
    ['500ms – 1000ms',   500, 1000],
    ['1000ms – 2000ms',  1000, 2000],
    ['> 2000ms',         2000, Infinity],
  ];
  const total = rawRequests.length || 1;
  let bIdx = 0;
  for (const [label, lo, hi] of buckets) {
    const cnt = rawRequests.filter(r => r.responseTimeMs >= lo && r.responseTimeMs < hi).length;
    const pct = ((cnt / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(parseFloat(pct) / 2));
    const fill = bIdx % 2 === 0 ? WHITE_FILL : ALT_FILL;
    const r = ws3.addRow({ bucket: label, count: cnt, pct: parseFloat(pct), bar });
    styleData(r, fill);
    r.getCell(1).font = labelFont;
    bIdx++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 4 — Status Code Breakdown
  // ════════════════════════════════════════════════════════════════════════════
  const ws4 = wb.addWorksheet('✅ Status Codes', { properties: { tabColor: { argb: 'FF6A1B9A' } } });
  ws4.columns = [
    { header: 'Status Code', key: 'code',  width: 18 },
    { header: 'Description', key: 'desc',  width: 28 },
    { header: 'Count',       key: 'count', width: 14 },
    { header: 'Percentage %',key: 'pct',   width: 16 },
    { header: 'Category',    key: 'cat',   width: 18 },
  ];
  styleHeader(ws4.getRow(1));

  const STATUS_DESC = {
    0:   'Connection Error / Timeout',
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
  };

  const codeMap = {};
  for (const r of rawRequests) {
    codeMap[r.statusCode] = (codeMap[r.statusCode] || 0) + 1;
  }
  let cIdx = 0;
  for (const [code, cnt] of Object.entries(codeMap).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const c   = Number(code);
    const pct = ((cnt / total) * 100).toFixed(1);
    const cat = c === 0 ? '🔴 Network Error' : c < 300 ? '🟢 Success' : c < 400 ? '🟡 Redirect' : c < 500 ? '🟠 Client Error' : '🔴 Server Error';
    const fill = c < 300 ? ALT_FILL : c < 400 ? YELLOW_FILL : RED_FILL;
    const r = ws4.addRow({ code: c, desc: STATUS_DESC[c] || 'Unknown', count: cnt, pct: parseFloat(pct), cat });
    styleData(r, fill);
    r.getCell(1).font = labelFont;
    cIdx++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 5 — Raw Request Log (first 2000)
  // ════════════════════════════════════════════════════════════════════════════
  const ws5 = wb.addWorksheet('📋 Raw Log', { properties: { tabColor: { argb: 'FF37474F' } } });
  ws5.columns = [
    { header: '#',             key: 'seq',     width: 8  },
    { header: 'Timestamp',     key: 'ts',      width: 26 },
    { header: 'Scenario',      key: 'scenario',width: 24 },
    { header: 'Status Code',   key: 'status',  width: 14 },
    { header: 'Response (ms)', key: 'ms',      width: 16 },
    { header: 'Error',         key: 'error',   width: 22 },
  ];
  styleHeader(ws5.getRow(1));

  const sample = rawRequests.slice(0, 2000);
  for (let i = 0; i < sample.length; i++) {
    const rq = sample[i];
    const fill = rq.error || rq.statusCode >= 500 ? RED_FILL : i % 2 === 0 ? WHITE_FILL : ALT_FILL;
    const r = ws5.addRow({
      seq:      i + 1,
      ts:       new Date(rq.timestamp).toISOString(),
      scenario: rq.scenario,
      status:   rq.statusCode,
      ms:       rq.responseTimeMs,
      error:    rq.error || '',
    });
    styleData(r, fill);
  }

  // ── Save file ────────────────────────────────────────────────────────────────
  const outDir  = path.join(__dirname, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(outDir, `LoadTest_Report_${stamp}.xlsx`);
  await wb.xlsx.writeFile(outFile);
  return outFile;
}

module.exports = { generateExcelReport };

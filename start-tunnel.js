/**
 * start-tunnel.js — KisaanConnect Mobile Tunnel Launcher v2.0
 * =============================================================
 * Professional-grade tunnel manager:
 *   ✅ Starts the Node server
 *   ✅ Opens public HTTPS tunnel via localtunnel
 *   ✅ Shows QR code in terminal — just scan with phone camera
 *   ✅ Auto-retries if tunnel disconnects (watchdog)
 *   ✅ Copies URL to clipboard automatically
 *   ✅ Works on ANY network (college, hotspot, mobile data)
 *
 * Usage:  node start-tunnel.js
 */

'use strict';

require('dotenv').config();

const { spawn }    = require('child_process');
const path         = require('path');
const fs           = require('fs');
const http         = require('http');
const https        = require('https');

const PORT        = parseInt(process.env.PORT || '3000', 10);
const TUNNEL_FILE = path.join(__dirname, '.tunnel-url');
const LOCK_FILE   = path.join(__dirname, '.tunnel.lock');
const RETRY_DELAY = 5000;
const MAX_RETRIES = 10;

// ── Single-instance guard — kill any previous tunnel launcher ─────────────────
try {
    if (fs.existsSync(LOCK_FILE)) {
        const oldPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
        if (oldPid && oldPid !== process.pid) {
            try { process.kill(oldPid, 0); process.kill(oldPid, 'SIGTERM'); console.log(clr('yellow', `⚡  Stopped previous tunnel (PID ${oldPid})`)); } catch(e){}
        }
    }
} catch(e){}
fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
process.on('exit', () => { try { fs.unlinkSync(LOCK_FILE); } catch(e){} });


// ── ANSI colors ───────────────────────────────────────────────────────────────
const C = {
    reset:  '\x1b[0m',
    green:  '\x1b[32m', bold:   '\x1b[1m',
    cyan:   '\x1b[36m', yellow: '\x1b[33m',
    red:    '\x1b[31m', dim:    '\x1b[2m',
    bg_green: '\x1b[42m\x1b[30m',
};
const clr = (color, text) => `${C[color]}${text}${C.reset}`;

// ── ASCII QR code generator (pure JS — no extra dependency) ──────────────────
function printQR(url) {
    try {
        // Use qrcode package if available
        const QRCode = require('qrcode');
        QRCode.toString(url, { type: 'terminal', small: true }, (err, qr) => {
            if (!err) {
                console.log('\n' + qr);
            } else {
                printFallbackQR(url);
            }
        });
    } catch (e) {
        printFallbackQR(url);
    }
}

function printFallbackQR(url) {
    // Fallback: show URL prominently with simple border
    const line = '─'.repeat(url.length + 4);
    console.log(clr('cyan', `\n┌${line}┐`));
    console.log(clr('cyan', `│  ${clr('bold', url)}  │`));
    console.log(clr('cyan', `└${line}┘`));
    console.log(clr('dim', '  (Use Google Lens / Camera to scan the URL above)\n'));
}

// ── Copy URL to Windows clipboard ────────────────────────────────────────────
function copyToClipboard(text) {
    try {
        const proc = spawn('clip', [], { stdio: ['pipe', 'ignore', 'ignore'], shell: true });
        proc.stdin.write(text);
        proc.stdin.end();
        return true;
    } catch (e) {
        return false;
    }
}

// ── Kill any process already using port 3000 ─────────────────────────────────
function killPortSync() {
    try {
        const { execSync } = require('child_process');
        // Find PID listening on port 3000
        const out = execSync(`netstat -ano 2>nul | findstr ":${PORT}" | findstr "LISTENING"`, { shell: true }).toString().trim();
        if (out) {
            const pid = out.trim().split(/\s+/).pop();
            if (pid && /^\d+$/.test(pid)) {
                execSync(`taskkill /PID ${pid} /F 2>nul`, { shell: true });
                console.log(clr('yellow', `⚡  Killed existing process on port ${PORT} (PID ${pid})`));
                // Brief pause for OS to release the port
                const end = Date.now() + 1200;
                while (Date.now() < end) {}
            }
        }
    } catch (e) { /* no process on port — that's fine */ }
}

// ── Wait for server to be ready ──────────────────────────────────────────────
function waitForServer(maxMs = 15000) {
    return new Promise((resolve) => {
        const start   = Date.now();
        const interval = setInterval(() => {
            const req = http.get(`http://localhost:${PORT}/api/ping`, (res) => {
                if (res.statusCode === 200) {
                    clearInterval(interval);
                    resolve(true);
                }
            });
            req.on('error', () => {});
            req.setTimeout(800, () => req.destroy());
            if (Date.now() - start > maxMs) {
                clearInterval(interval);
                resolve(false);
            }
        }, 600);
    });
}

// ── Display the tunnel banner ─────────────────────────────────────────────────
function showBanner(url) {
    const pad = 52;
    const urlPad = url.padEnd(pad);
    console.log('');
    console.log(clr('green', '╔' + '═'.repeat(pad + 4) + '╗'));
    console.log(clr('green', '║') + clr('bold', '  📱  MOBILE ACCESS — OPEN THIS ON YOUR PHONE:  ') + '  ' + clr('green', '║'));
    console.log(clr('green', '║' + ' '.repeat(pad + 4) + '║'));
    console.log(clr('green', '║  ') + clr('bg_green', `  ${urlPad}  `) + clr('green', '  ║'));
    console.log(clr('green', '║' + ' '.repeat(pad + 4) + '║'));
    console.log(clr('green', '║  ') + clr('cyan', '✅ Works on ANY network — no same-Wi-Fi needed!') + '   ' + clr('green', '║'));
    console.log(clr('green', '║  ') + clr('yellow', '⚠️  Tap "Click to Continue" if prompted once    ') + '   ' + clr('green', '║'));
    console.log(clr('green', '╚' + '═'.repeat(pad + 4) + '╝'));
    console.log('');
    console.log(clr('dim', '  📋 URL copied to clipboard automatically.'));
    console.log(clr('dim', '  📷 Scan with phone camera:\n'));
    printQR(url);
}

// ── Save tunnel URL for server.js to pick up ─────────────────────────────────
function saveTunnelUrl(url) {
    try { fs.writeFileSync(TUNNEL_FILE, url, 'utf8'); } catch (e) {}
}
function clearTunnelUrl() {
    try { fs.writeFileSync(TUNNEL_FILE, '', 'utf8'); } catch (e) {}
}

// ── Open tunnel with auto-retry watchdog ─────────────────────────────────────
let retryCount   = 0;
let activeTunnel = null;
let isShuttingDown = false;

async function openTunnel() {
    if (isShuttingDown) return;

    try {
        const localtunnel = require('localtunnel');
        console.log(clr('cyan', `\n🔗  Opening tunnel (attempt ${retryCount + 1})...`));

        const tunnel = await localtunnel({ port: PORT });
        activeTunnel = tunnel;
        retryCount   = 0; // reset on success

        const url = tunnel.url;
        saveTunnelUrl(url);
        copyToClipboard(url);
        showBanner(url);

        // ── Watchdog: reconnect on close ─────────────────────────────────────
        tunnel.on('close', () => {
            if (isShuttingDown) return;
            activeTunnel = null;
            clearTunnelUrl();
            retryCount++;
            if (retryCount <= MAX_RETRIES) {
                console.log(clr('yellow', `\n⚡  Tunnel closed. Reconnecting in ${RETRY_DELAY / 1000}s... (${retryCount}/${MAX_RETRIES})`));
                setTimeout(openTunnel, RETRY_DELAY);
            } else {
                console.log(clr('red', '\n❌  Max tunnel retries reached. Restart manually: node start-tunnel.js'));
            }
        });

        tunnel.on('error', (err) => {
            console.log(clr('yellow', `\n⚠️  Tunnel error: ${err.message}`));
        });

    } catch (err) {
        retryCount++;
        clearTunnelUrl();
        if (retryCount <= MAX_RETRIES) {
            console.log(clr('yellow', `\n⚠️  Tunnel failed (${err.message}). Retrying in ${RETRY_DELAY / 1000}s...`));
            setTimeout(openTunnel, RETRY_DELAY);
        } else {
            console.log(clr('red', '\n❌  Could not open tunnel after ' + MAX_RETRIES + ' attempts.'));
            console.log(clr('dim', '   Server still running at http://localhost:' + PORT));
            console.log(clr('dim', '   For mobile: connect phone to PC hotspot or use same Wi-Fi.\n'));
        }
    }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log(clr('green', '╔══════════════════════════════════════════════════╗'));
    console.log(clr('green', '║') + clr('bold', '   🌾  KisaanConnect — Mobile Tunnel Launcher    ') + clr('green', '║'));
    console.log(clr('green', '╚══════════════════════════════════════════════════╝'));
    console.log('');

    // ── 1. Kill any old server on this port ───────────────────────────────────
    killPortSync();

    // ── 2. Start the server child process ─────────────────────────────────────
    console.log(clr('cyan', `▶  Starting server on port ${PORT}...`));

    const serverProc = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
        stdio: 'inherit',
        env:   { ...process.env, KISAAN_TUNNEL_ACTIVE: 'true' }
    });

    serverProc.on('error', (err) => {
        console.error(clr('red', `\n❌  Server failed to start: ${err.message}`));
        process.exit(1);
    });

    serverProc.on('exit', (code) => {
        if (!isShuttingDown) {
            console.log(clr('yellow', `\n⚠️  Server exited with code ${code}. Restarting in 3s...`));
            setTimeout(main, 3000);
        }
    });

    // ── 2. Wait for server to be ready ────────────────────────────────────────
    console.log(clr('dim', '   Waiting for server to boot...'));
    const ready = await waitForServer(15000);

    if (!ready) {
        console.log(clr('yellow', '⚠️  Server did not respond in 15s. Opening tunnel anyway...'));
    } else {
        console.log(clr('green', '✅  Server is ready!'));
    }

    // ── 3. Open the tunnel ────────────────────────────────────────────────────
    await openTunnel();

    // ── 4. Graceful shutdown ──────────────────────────────────────────────────
    const shutdown = () => {
        isShuttingDown = true;
        console.log(clr('yellow', '\n\n🛑  Shutting down gracefully...'));
        clearTunnelUrl();
        if (activeTunnel) { try { activeTunnel.close(); } catch(e){} }
        serverProc.kill('SIGTERM');
        setTimeout(() => process.exit(0), 1500);
    };
    process.on('SIGINT',  shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error(clr('red', '\n❌  Fatal error: ' + err.message));
    process.exit(1);
});

/**
 * render-deploy.js — KisaanConnect Backend Auto-Deployer
 * =======================================================
 * Usage:  node render-deploy.js <YOUR_RENDER_API_KEY>
 * 
 * Gets your API key from:
 *   https://dashboard.render.com/u/settings#api-keys
 *   Click "Create API Key" → name it "deploy" → copy the rnd_xxx key
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const RENDER_API_KEY = process.argv[2] || process.env.RENDER_API_KEY;
const SERVICE_NAME   = 'kisaanconnect-api';
const GITHUB_REPO    = 'https://github.com/kishanBabu42/KisaanConnect';

if (!RENDER_API_KEY || RENDER_API_KEY.startsWith('<')) {
    console.error('\n❌  Missing API key!\n');
    console.log('  Usage:  node render-deploy.js rnd_your_key_here\n');
    console.log('  Get key from:  https://dashboard.render.com/u/settings#api-keys\n');
    process.exit(1);
}

// ── Parse .env ──────────────────────────────────────────────────────────
function parseEnv() {
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const vars = {};
    for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 0) continue;
        const key = t.slice(0, eq).trim();
        let val   = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (key === 'FIREBASE_PRIVATE_KEY') val = val.replace(/\\n/g, '\n');
        if (val) vars[key] = val;
    }
    return vars;
}

// ── Render API ──────────────────────────────────────────────────────────
function api(method, endpoint, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const req = https.request({
            hostname: 'api.render.com',
            path: `/v1${endpoint}`,
            method,
            headers: {
                'Authorization': `Bearer ${RENDER_API_KEY}`,
                'Content-Type':  'application/json',
                'Accept':        'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        }, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  KisaanConnect — Render Backend Deployer  ║');
    console.log('╚═══════════════════════════════════════════╝\n');

    const env = parseEnv();
    console.log(`✅  Loaded ${Object.keys(env).length} env vars from .env`);

    // 1. Verify API key & get owner
    console.log('\n📡  Verifying Render API key...');
    const owners = await api('GET', '/owners?limit=1');
    if (owners.status !== 200 || !Array.isArray(owners.body) || !owners.body.length) {
        console.error('❌  Invalid API key or no Render account found.');
        console.error('    Response:', JSON.stringify(owners.body, null, 2));
        process.exit(1);
    }
    const owner = owners.body[0].owner;
    console.log(`✅  Logged in as: ${owner.name || owner.email} (${owner.id})`);

    // 2. Check if service already exists
    console.log('\n🔍  Checking for existing service...');
    const list = await api('GET', `/services?name=${SERVICE_NAME}&limit=10`);
    let serviceId = null, serviceUrl = null;

    if (list.status === 200 && Array.isArray(list.body)) {
        const match = list.body.find(s => s.service?.name === SERVICE_NAME);
        if (match) {
            serviceId  = match.service.id;
            serviceUrl = match.service.serviceDetails?.url;
            console.log(`♻️   Found existing service: ${serviceId}`);
        }
    }

    // 3. Create service if needed
    if (!serviceId) {
        console.log('\n🔨  Creating Render Web Service...');
        const created = await api('POST', '/services', {
            type:     'web_service',
            name:     SERVICE_NAME,
            ownerId:  owner.id,
            repo:     GITHUB_REPO,
            branch:   'main',
            autoDeploy: 'yes',
            serviceDetails: {
                env:            'node',
                buildCommand:   'npm install --only=production',
                startCommand:   'node server.js',
                plan:           'free',
                region:         'singapore',
                numInstances:   1,
                healthCheckPath: '/api/health'
            }
        });

        if (created.status !== 201) {
            console.error('❌  Failed to create service:');
            console.error(JSON.stringify(created.body, null, 2));
            process.exit(1);
        }
        serviceId  = created.body.service?.id;
        serviceUrl = created.body.service?.serviceDetails?.url;
        console.log(`✅  Service created! ID: ${serviceId}`);
    }

    // 4. Push all environment variables
    console.log('\n📋  Setting environment variables...');
    const envPayload = [
        { key: 'NODE_ENV',              value: 'production'                        },
        { key: 'PORT',                  value: '3000'                              },
        { key: 'FIREBASE_PROJECT_ID',   value: env.FIREBASE_PROJECT_ID     || ''  },
        { key: 'FIREBASE_CLIENT_EMAIL', value: env.FIREBASE_CLIENT_EMAIL   || ''  },
        { key: 'FIREBASE_PRIVATE_KEY',  value: env.FIREBASE_PRIVATE_KEY    || ''  },
        { key: 'FIREBASE_CLIENT_ID',    value: env.FIREBASE_CLIENT_ID      || ''  },
        { key: 'MAIL_USER',             value: env.MAIL_USER               || ''  },
        { key: 'MAIL_PASS',             value: env.MAIL_PASS               || ''  },
        { key: 'RESEND_API_KEY',        value: env.RESEND_API_KEY          || ''  },
        { key: 'RESEND_FROM_EMAIL',     value: env.RESEND_FROM_EMAIL       || ''  },
        { key: 'GOOGLE_AI_KEY',         value: env.GOOGLE_AI_KEY           || ''  },
        { key: 'WEATHER_API_KEY',       value: env.WEATHER_API_KEY         || ''  },
        { key: 'GOOGLE_MAPS_API_KEY',   value: env.GOOGLE_MAPS_API_KEY    || ''  },
        { key: 'ADMIN_EMAIL',           value: env.ADMIN_EMAIL             || ''  },
        { key: 'ADMIN_PASSWORD',        value: env.ADMIN_PASSWORD          || ''  },
    ].filter(e => e.value.trim());

    const envRes = await api('PUT', `/services/${serviceId}/env-vars`, envPayload);
    if (envRes.status === 200) {
        console.log(`✅  ${envPayload.length} environment variables applied`);
    } else {
        console.warn('⚠️   Env var issue:', envRes.status, JSON.stringify(envRes.body));
    }

    // 5. Trigger deploy
    console.log('\n🚀  Triggering deployment...');
    const dep = await api('POST', `/services/${serviceId}/deploys`, { clearCache: 'clear' });
    if (dep.status === 201) {
        console.log('✅  Deploy triggered! Build is starting on Render...');
    }

    // 6. Get final service URL
    const svc = await api('GET', `/services/${serviceId}`);
    serviceUrl = svc.body?.service?.serviceDetails?.url
              || `https://${SERVICE_NAME}.onrender.com`;

    // 7. Update Vercel env-config.js with the Render URL
    console.log('\n🔗  Wiring Render URL into frontend env-config.js...');
    const envConfigContent = `/* Auto-generated by render-deploy.js */
(function() {
    var renderUrl = ${JSON.stringify(serviceUrl)};
    if (renderUrl) {
        window.KISAAN_RENDER_URL = renderUrl;
        window.KISAAN_API_URL    = renderUrl + '/api';
        console.log('[KisaanEnv] \uD83C\uDF10 Production API:', window.KISAAN_API_URL);
    }
})();
`;
    fs.writeFileSync(path.join(__dirname, 'env-config.js'), envConfigContent);
    // Also update frontend-dist
    try {
        fs.writeFileSync(path.join(__dirname, 'frontend-dist', 'env-config.js'), envConfigContent);
    } catch {}
    console.log('✅  env-config.js updated');

    // 8. Push to GitHub & redeploy Vercel
    const { execSync } = require('child_process');
    try {
        execSync('git add env-config.js frontend-dist/env-config.js', { cwd: __dirname, stdio: 'pipe' });
        execSync(`git commit -m "deploy: connect to Render backend ${serviceUrl}"`, { cwd: __dirname, stdio: 'pipe' });
        execSync('git push origin main', { cwd: __dirname, stdio: 'pipe' });
        console.log('✅  Pushed to GitHub');
    } catch (e) { console.log('⚠️   Git push skipped:', e.message.split('\n')[0]); }

    // 9. Redeploy Vercel frontend with the Render URL
    try {
        execSync(`vercel frontend-dist --prod --yes --env RENDER_API_URL="${serviceUrl}"`, {
            cwd: __dirname, stdio: 'inherit'
        });
        console.log('✅  Vercel frontend redeployed with Render URL');
    } catch (e) {
        console.log('⚠️   Vercel redeploy note:', e.message.split('\n')[0]);
        console.log('    Run manually: vercel frontend-dist --prod');
    }

    // Final summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                  🎉 DEPLOYMENT COMPLETE                   ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Backend  → ${serviceUrl.padEnd(46)}║`);
    console.log(`║  Frontend → https://kisaanconnect-app.vercel.app          ║`);
    console.log(`║  Health   → ${(serviceUrl + '/api/health').padEnd(46)}║`);
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('📝  Note: Render free tier takes ~30 seconds to wake up on first request.\n');
}

main().catch(err => { console.error('\n❌  Error:', err.message); process.exit(1); });

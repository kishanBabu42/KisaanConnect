'use strict';
require('dotenv').config();

// Test using raw HTTP REST API to bypass SDK configuration issues
const https = require('https');
const { GoogleAuth } = require('google-auth-library');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

console.log('\n🔥 Firebase REST API Direct Test');
console.log('═'.repeat(50));
console.log('Project:', projectId);

async function getAccessToken() {
    const { JWT } = require('google-auth-library');
    const client = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/datastore'],
    });
    const token = await client.getAccessToken();
    return token.token;
}

async function testRestApi(host, path, token) {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: data.slice(0, 300) });
            });
        });
        req.on('error', (e) => resolve({ status: 0, error: e.message }));
        req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
        req.end();
    });
}

async function main() {
    try {
        console.log('\n⏳ Getting access token...');
        const token = await getAccessToken();
        console.log('✅ Access token obtained');

        // Try standard Firestore REST endpoint
        const dbPath = `/v1/projects/${projectId}/databases/(default)/documents/_counters?pageSize=1`;

        const hosts = [
            'firestore.googleapis.com',
            'africa-south1-firestore.googleapis.com',
        ];

        for (const host of hosts) {
            console.log(`\n⏳ Testing: https://${host}${dbPath}`);
            const result = await testRestApi(host, dbPath, token);
            console.log(`   Status: ${result.status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            } else {
                const parsed = JSON.parse(result.body || '{}');
                if (result.status === 200) {
                    console.log(`   ✅ SUCCESS! Documents found:`, Object.keys(parsed));
                } else {
                    console.log(`   ❌ Response:`, result.body.slice(0, 200));
                }
            }
        }
    } catch (e) {
        console.error('\n❌ Fatal:', e.message);
        console.log('\nPossible issue: google-auth-library not installed.');
        console.log('Run: npm install google-auth-library');
    }
    process.exit(0);
}

main();

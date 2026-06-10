
const fs = require('fs');
const key = JSON.parse(fs.readFileSync('C:/Users/DHANUNJAY/Downloads/kisaanconnect-75b57-firebase-adminsdk-fbsvc-f39254a49a.json', 'utf8'));

let env = fs.readFileSync('.env', 'utf8');

// Escape the private key for .env format
const escapedKey = key.private_key.replace(/\n/g, '\\n');

// Replace each value using multiline regex
env = env.replace(/^FIREBASE_PRIVATE_KEY=.*$/m, `FIREBASE_PRIVATE_KEY="${escapedKey}"`);
env = env.replace(/^FIREBASE_CLIENT_EMAIL=.*$/m, `FIREBASE_CLIENT_EMAIL="${key.client_email}"`);
env = env.replace(/^FIREBASE_CLIENT_ID=.*$/m, `FIREBASE_CLIENT_ID="${key.client_id}"`);

fs.writeFileSync('.env', env, 'utf8');
console.log('✅ .env updated successfully with new key');
console.log('client_email:', key.client_email);
console.log('private_key_id:', key.private_key_id);

// Quick test
require('dotenv').config();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const pk = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
const app = initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

db.collection('_test').doc('ping').set({ ok: true, ts: new Date().toISOString() })
  .then(() => { console.log('✅ FIRESTORE CONNECTED AND WORKING!'); })
  .catch(e => { console.error('❌ Firestore FAIL:', e.code, e.message.substring(0, 200)); })
  .finally(() => process.exit(0));

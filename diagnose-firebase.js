'use strict';
require('dotenv').config();
const admin = require('firebase-admin');

const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

console.log('\n🔥 Firebase Firestore Diagnostics');
console.log('═'.repeat(50));
console.log('Project ID :', projectId);
console.log('Client Email:', clientEmail);

async function tryConfig(label, settingsFn, databaseIdFn) {
    // Reset admin apps between attempts
    try {
        for (const a of admin.apps) await a.delete();
    } catch(e) {}

    try {
        admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey })
        });

        let db;
        if (databaseIdFn) {
            const { getFirestore } = require('firebase-admin/firestore');
            db = getFirestore(databaseIdFn);
        } else {
            db = admin.firestore();
        }

        if (settingsFn) settingsFn(db);

        const start = Date.now();
        const snap = await db.collection('_counters').limit(1).get();
        const ms = Date.now() - start;
        console.log(`\n✅ SUCCESS [${label}] — ${ms}ms, docs: ${snap.size}`);
        return true;
    } catch (err) {
        console.log(`\n❌ FAIL    [${label}] — ${err.code || '?'}: ${err.message.slice(0, 100)}`);
        return false;
    }
}

async function main() {
    const configs = [
        {
            label: 'Default (no settings)',
            settingsFn: null,
        },
        {
            label: 'africa-south1 regional host',
            settingsFn: (db) => db.settings({
                ignoreUndefinedProperties: true,
                host: 'firestore.africa-south1.rep.googleapis.com',
                ssl: true,
            }),
        },
        {
            label: 'Standard googleapis.com endpoint',
            settingsFn: (db) => db.settings({
                ignoreUndefinedProperties: true,
                host: 'firestore.googleapis.com',
                ssl: true,
            }),
        },
    ];

    let worked = false;
    for (const cfg of configs) {
        const ok = await tryConfig(cfg.label, cfg.settingsFn, cfg.databaseIdFn);
        if (ok) { worked = true; break; }
    }

    if (!worked) {
        console.log('\n\n⚠️  ALL configurations failed.');
        console.log('NEXT STEPS:');
        console.log('  1. Open https://console.firebase.google.com');
        console.log('     → Project: kisaanconnect-75b57');
        console.log('     → Firestore Database → Check if database exists');
        console.log('     → If NOT: click "Create database" → choose "africa-south1" → Start in test mode');
        console.log('  2. Check that the service account has "Cloud Datastore User" role');
        console.log('     → https://console.cloud.google.com/iam-admin/iam → search for firebase-adminsdk');
    }

    process.exit(0);
}

main();

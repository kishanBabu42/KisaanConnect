'use strict';
require('dotenv').config();
const admin = require('firebase-admin');

async function test() {
    console.log('\n🔥 Firebase Live Connection Test');
    console.log('═'.repeat(45));
    console.log('Project :', process.env.FIREBASE_PROJECT_ID);
    console.log('Region  : africa-south1');

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId:   process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        });
    }

    // ✅ ROOT CAUSE FIX: DB is a named database called 'default' (NOT the system '(default)').
    // Must use getFirestore() with explicit databaseId to target it.
    const { getFirestore } = require('firebase-admin/firestore');
    const db = getFirestore();
    db.settings({
        ignoreUndefinedProperties: true,
        databaseId: 'default',   // ← named database (without parentheses)
    });

    try {
        console.log('\n⏳  Reading users collection...');
        const snap = await db.collection('users').limit(3).get();
        console.log(`✅  CONNECTED! Found ${snap.size} user(s) in sample:`);
        snap.forEach(d => console.log(`   - [${d.data().role}] ${d.data().email}`));

        const psnap = await db.collection('products').limit(3).get();
        console.log(`✅  Products: ${psnap.size} found.`);

        console.log('\n🎉  Firebase Firestore FULLY OPERATIONAL!\n');
        process.exit(0);
    } catch (err) {
        console.error('\n❌  Error:', err.code, '-', err.message);
        process.exit(1);
    }
}

test();

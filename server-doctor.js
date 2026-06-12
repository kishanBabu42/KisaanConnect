/**
 * KisaanConnect Server Doctor
 * Run this to find exactly why your server is offline.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🩺 KisaanConnect Server Doctor is checking your system...\n');

async function check() {
    let errors = 0;

    // 1. Check .env
    if (!fs.existsSync('.env')) {
        console.error('❌ ERROR: .env file missing!');
        errors++;
    } else {
        console.log('✅ .env file found.');
        const envContent = fs.readFileSync('.env', 'utf8');
        if (!process.env.FIREBASE_PROJECT_ID) {
            console.error('❌ ERROR: FIREBASE_PROJECT_ID is missing in .env');
            errors++;
        }
    }

    // 2. Check Port 3000
    const port = process.env.PORT || 3000;
    const net = require('net');
    const server = net.createServer();

    const portCheck = new Promise((resolve) => {
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ ERROR: Port ${port} is BLOCKED by another program!`);
                errors++;
            }
            resolve();
        });
        server.once('listening', () => {
            console.log(`✅ Port ${port} is free and ready.`);
            server.close();
            resolve();
        });
        server.listen(port);
    });
    await portCheck;

    // 3. Check Dependencies
    try {
        require('express');
        require('firebase-admin');
        require('socket.io');
        console.log('✅ All professional libraries (Express, Firebase, Socket.io) are installed.');
    } catch (e) {
        console.error(`❌ ERROR: Missing library: ${e.message}`);
        console.log('👉 FIX: Run "npm install" in your terminal.');
        errors++;
    }

    // 4. Check Firebase Connectivity
    console.log('📡 Testing Firebase connection (this may take 5 seconds)...');
    try {
        const fdb = require('./firebase-db');
        fdb.initFirebase();
        if (fdb.isReady()) {
            console.log('✅ Firebase connection is SUCCESSFUL.');
        } else {
            console.error('❌ ERROR: Firebase failed to initialize. Check your .env keys.');
            errors++;
        }
    } catch (e) {
        console.error('❌ ERROR: Firebase connection failed:', e.message);
        errors++;
    }

    // 5. Check Network
    const networkInterfaces = require('os').networkInterfaces();
    let hasWifi = false;
    for (const name in networkInterfaces) {
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan')) hasWifi = true;
    }
    if (!hasWifi) {
        console.warn('⚠️  WARNING: No Wi-Fi adapter detected. Mobile app might not connect.');
    } else {
        console.log('✅ Wi-Fi adapter detected.');
    }

    console.log('\n-------------------------------------------');
    if (errors === 0) {
        console.log('🎉 SYSTEM IS HEALTHY! Your server should run perfectly.');
        console.log('👉 Double-click RUN_SERVER.bat to start.');
    } else {
        console.log(`❌ FOUND ${errors} PROBLEMS. Please fix them above.`);
    }
    console.log('-------------------------------------------\n');
}

check();

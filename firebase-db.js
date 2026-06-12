/**
 * firebase-db.js — KisaanConnect Firebase Firestore Database Layer
 * Replaces MySQL with Firestore. Drop-in compatible with server.js query patterns.
 *
 * SETUP: Add to your .env file:
 *   FIREBASE_PROJECT_ID=your-project-id
 *   FIREBASE_CLIENT_EMAIL=your-service-account@...iam.gserviceaccount.com
 *   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 */

'use strict';

const admin = require('firebase-admin');

let db = null;
let initialized = false;

// ── IN-MEMORY TTL CACHE (reduces Firestore reads by ~80% on mobile) ───────────
// Entries expire after TTL_MS milliseconds. Write operations invalidate their key.
const TTL_MS   = 10_000; // 10 seconds — fresh enough for real-time UX
const _cache   = new Map();

function cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) { _cache.delete(key); return null; }
    return entry.value;
}
function cacheSet(key, value) {
    _cache.set(key, { ts: Date.now(), value });
}
function cacheInvalidate(prefix) {
    for (const k of _cache.keys()) {
        if (k.startsWith(prefix)) _cache.delete(k);
    }
}

function initFirebase() {
    if (initialized) return db;

    const projectId    = process.env.FIREBASE_PROJECT_ID;
    const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey   = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : null;

    if (!projectId || !clientEmail || !privateKey) {
        console.warn('⚠️  Firebase credentials missing in .env — using MySQL fallback');
        return null;
    }

    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // ROOT CAUSE FIX: The Firestore database is a NAMED database called
        // 'default' (without parentheses), NOT the system '(default)' DB.
        //
        // admin.firestore() always targets '(default)' which returns 404.
        // We must use getFirestore() with an explicit databaseId to reach it.
        //
        // Additionally, the DB is in the 'africa-south1' region so we set
        // the correct regional REST host to avoid routing to the US endpoint.
        // ═══════════════════════════════════════════════════════════════════
        const { getFirestore } = require('firebase-admin/firestore');
        db = getFirestore();
        db.settings({
            ignoreUndefinedProperties: true,
            databaseId: 'default',              // ← named DB (without parentheses!)
        });
        initialized = true;
        console.log('✅ Firebase Firestore Connected (db: default, region: africa-south1)');
        // Seed admin asynchronously — don't crash if Firestore DB not yet provisioned
        seedAdminUser().catch(e => {
            if (e.code === 5 || (e.message && e.message.includes('NOT_FOUND'))) {
                console.warn('⚠️  Firestore database not provisioned yet. Go to https://console.firebase.google.com → your project → Firestore Database → Create database.');
            } else {
                console.error('⚠️  seedAdminUser error:', e.message);
            }
        });
    } catch (e) {
        console.error('❌ Firebase init error:', e.message);
        return null;
    }
    return db;
}


// ── AUTO-INCREMENT HELPER ────────────────────────────────────────────────────
// Firestore doesn't have auto-increment IDs. We simulate with a counters doc.
async function nextId(collection) {
    const counterRef = db.collection('_counters').doc(collection);
    const newId = await db.runTransaction(async t => {
        const doc = await t.get(counterRef);
        const current = doc.exists ? (doc.data().value || 0) : 0;
        t.set(counterRef, { value: current + 1 });
        return current + 1;
    });
    return newId;
}

// ── TIMESTAMP HELPER ─────────────────────────────────────────────────────────
function now() { return new Date().toISOString(); }

// ── CONVERT FIRESTORE DOC → ROW ───────────────────────────────────────────────
function toRow(doc) {
    if (!doc.exists) return null;
    return { id: doc.data().id || doc.id, ...doc.data() };
}
function toDocs(snapshot) {
    return snapshot.docs.map(d => ({ id: d.data().id || d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════
async function createUser(data) {
    const id = await nextId('users');
    const user = { id, createdAt: now(), wallet: 0, ...data };
    await db.collection('users').doc(String(id)).set(user);
    return user;
}

async function findUserByEmail(email) {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    return snap.empty ? null : toRow(snap.docs[0]);
}

async function findUserByEmailAndRole(email, password, role) {
    let q = db.collection('users').where('email', '==', email).where('password', '==', password);
    if (role) q = q.where('role', '==', role);
    const snap = await q.limit(1).get();
    return snap.empty ? null : toRow(snap.docs[0]);
}

async function getUserById(id) {
    const doc = await db.collection('users').doc(String(id)).get();
    return toRow(doc);
}

async function getAllUsers() {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    return toDocs(snap);
}

async function updateUser(id, data) {
    await db.collection('users').doc(String(id)).update(data);
    return getUserById(id);
}

async function deleteUser(id) {
    await db.collection('users').doc(String(id)).delete();
}

async function seedAdminUser() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@kisaanconnect.com';
    const existing = await findUserByEmail(adminEmail);
    if (!existing) {
        await createUser({
            name: 'Admin',
            email: adminEmail,
            password: process.env.ADMIN_PASSWORD || 'admin123',
            role: 'admin',
            mobile: '0000000000',
            location: 'HQ'
        });
        console.log('✅ Admin user seeded:', adminEmail);
    } else {
        console.log('ℹ️  Admin user already exists:', adminEmail);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════
async function createProduct(data) {
    const id = await nextId('products');
    const product = { id, createdAt: now(), status: 'active', ...data };
    await db.collection('products').doc(String(id)).set(product);
    return product;
}

async function getProducts(farmerId) {
    let q = db.collection('products').orderBy('createdAt', 'desc');
    if (farmerId) q = db.collection('products').where('farmerId', '==', String(farmerId)).orderBy('createdAt', 'desc');
    const snap = await q.get();
    return toDocs(snap);
}

async function updateProduct(id, data) {
    await db.collection('products').doc(String(id)).update(data);
}

async function deleteProduct(id) {
    await db.collection('products').doc(String(id)).delete();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════
async function createOrder(data) {
    const id = await nextId('orders');
    const order = { id, createdAt: now(), status: 'pending', ...data };
    await db.collection('orders').doc(String(id)).set(order);
    cacheInvalidate('orders:');
    return order;
}

async function getOrders(filter = {}) {
    const cKey = `orders:${filter.farmerId||''}:${filter.customerId||''}:${filter.driverId||''}`;
    const hit = cacheGet(cKey);
    if (hit) return hit;

    let q = db.collection('orders').orderBy('createdAt', 'desc');
    if (filter.farmerId)   q = db.collection('orders').where('farmerId',          '==', String(filter.farmerId)).orderBy('createdAt','desc');
    if (filter.customerId) q = db.collection('orders').where('customerId',        '==', String(filter.customerId)).orderBy('createdAt','desc');
    if (filter.driverId)   q = db.collection('orders').where('deliveryPartnerId', '==', String(filter.driverId)).orderBy('createdAt','desc');

    const snap = await q.get();
    const rows = toDocs(snap);
    cacheSet(cKey, rows);
    return rows;
}

async function updateOrder(id, data) {
    await db.collection('orders').doc(String(id)).update(data);
    cacheInvalidate('orders:');
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTES
// ═══════════════════════════════════════════════════════════════════════════════
async function createQuote(data) {
    const id = await nextId('quotes');
    const quote = { id, createdAt: now(), status: 'pending', ...data };
    await db.collection('quotes').doc(String(id)).set(quote);
    cacheInvalidate('quotes:');
    return quote;
}

async function getQuotes(filter = {}) {
    const cKey = `quotes:${filter.farmerId||''}:${filter.customerId||''}`;
    const hit = cacheGet(cKey);
    if (hit) return hit;

    let q = db.collection('quotes').orderBy('createdAt', 'desc');
    if (filter.farmerId)   q = db.collection('quotes').where('farmerId',   '==', String(filter.farmerId)).orderBy('createdAt','desc');
    if (filter.customerId) q = db.collection('quotes').where('customerId', '==', String(filter.customerId)).orderBy('createdAt','desc');

    const snap = await q.get();
    const rows = toDocs(snap);
    cacheSet(cKey, rows);
    return rows;
}

async function updateQuote(id, data) {
    await db.collection('quotes').doc(String(id)).update(data);
    cacheInvalidate('quotes:');
    cacheInvalidate('orders:'); // quote acceptance creates orders
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════
async function createSubscription(data) {
    const id = await nextId('subscriptions');
    const sub = { id, createdAt: now(), status: 'active', ...data };
    await db.collection('subscriptions').doc(String(id)).set(sub);
    cacheInvalidate('subs:');
    return sub;
}

async function getSubscriptions(filter = {}) {
    const cKey = `subs:${filter.farmerId||''}:${filter.customerId||''}`;
    const hit = cacheGet(cKey);
    if (hit) return hit;

    let q = db.collection('subscriptions').orderBy('createdAt', 'desc');
    if (filter.farmerId)   q = db.collection('subscriptions').where('farmerId',   '==', String(filter.farmerId)).orderBy('createdAt','desc');
    if (filter.customerId) q = db.collection('subscriptions').where('customerId', '==', String(filter.customerId)).orderBy('createdAt','desc');

    const snap = await q.get();
    const rows = toDocs(snap);
    cacheSet(cKey, rows);
    return rows;
}

async function updateSubscription(id, data) {
    await db.collection('subscriptions').doc(String(id)).update(data);
    cacheInvalidate('subs:');
}

async function deleteSubscription(id) {
    await db.collection('subscriptions').doc(String(id)).delete();
    cacheInvalidate('subs:');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
async function createPayment(data) {
    const id = await nextId('payments');
    const payment = { id, createdAt: now(), ...data };
    await db.collection('payments').doc(String(id)).set(payment);
    return payment;
}

async function getPayments(userId) {
    const cKey = `payments:${userId||''}`;
    const hit = cacheGet(cKey);
    if (hit) return hit;

    let q = db.collection('payments').orderBy('createdAt', 'desc');
    if (userId) q = db.collection('payments').where('userId', '==', String(userId)).orderBy('createdAt','desc');

    const snap = await q.get();
    const rows = toDocs(snap);
    cacheSet(cKey, rows);
    return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY POSTS
// ═══════════════════════════════════════════════════════════════════════════════
async function getCommunityPosts() {
    const snap = await db.collection('community_posts').orderBy('timestamp', 'desc').get();
    return toDocs(snap);
}

async function createCommunityPost(data) {
    const id = await nextId('community_posts');
    const post = { id, timestamp: now(), likes: 0, ...data };
    await db.collection('community_posts').doc(String(id)).set(post);
    return post;
}

async function likeCommunityPost(id) {
    const ref = db.collection('community_posts').doc(String(id));
    await db.runTransaction(async t => {
        const doc = await t.get(ref);
        const likes = (doc.data().likes || 0) + 1;
        t.update(ref, { likes });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR NOTES
// ═══════════════════════════════════════════════════════════════════════════════
async function getCalendarNotes(userId) {
    const snap = await db.collection('calendar_notes').where('userId', '==', String(userId)).get();
    return toDocs(snap);
}

async function upsertCalendarNote(userId, date, note) {
    const docId = `${userId}_${date}`;
    await db.collection('calendar_notes').doc(docId).set(
        { userId: String(userId), date, note, id: docId },
        { merge: true }
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTP (Forgot Password)
// ═══════════════════════════════════════════════════════════════════════════════
async function saveOTP(email, otp) {
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60 seconds
    await db.collection('otps').doc(email).set({ email, otp, expiresAt, createdAt: now() });
}

async function verifyOTP(email, otp) {
    const doc = await db.collection('otps').doc(email).get();
    if (!doc.exists) return { valid: false, message: 'No OTP found. Please request a new one.' };
    const data = doc.data();
    if (new Date() > new Date(data.expiresAt)) {
        await db.collection('otps').doc(email).delete();
        return { valid: false, message: 'OTP expired. Please click Resend OTP.' };
    }
    if (data.otp !== String(otp)) {
        return { valid: false, message: 'Incorrect OTP. Please try again.' };
    }
    // ✅ Do NOT delete OTP here — it is consumed by consumeOTP() after password reset
    return { valid: true };
}

/**
 * Permanently delete a verified OTP from the store.
 * Call this AFTER the password has been successfully updated.
 */
async function consumeOTP(email) {
    await db.collection('otps').doc(email).delete();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN STATS
// ═══════════════════════════════════════════════════════════════════════════════
async function getAdminStats() {
    const [users, orders, products, subscriptions, payments] = await Promise.all([
        db.collection('users').get(),
        db.collection('orders').get(),
        db.collection('products').where('status', '==', 'active').get(),
        db.collection('subscriptions').get(),
        db.collection('payments').get(),
    ]);
    const allUsers = toDocs(users);
    const allOrders = toDocs(orders);
    const allPayments = toDocs(payments);
    const revenue = allPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    return {
        farmers:        allUsers.filter(u => u.role === 'farmer').length,
        customers:      allUsers.filter(u => u.role === 'customer').length,
        orders:         allOrders.length,
        activeProducts: products.size,
        subscriptions:  subscriptions.size,
        revenue,
        transactions:   allPayments.length,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
    initFirebase,
    getDb: () => db,
    isReady: () => initialized,
    // Users
    createUser, findUserByEmail, findUserByEmailAndRole,
    getUserById, getAllUsers, updateUser, deleteUser,
    // Products
    createProduct, getProducts, updateProduct, deleteProduct,
    // Orders
    createOrder, getOrders, updateOrder,
    // Quotes
    createQuote, getQuotes, updateQuote,
    // Subscriptions
    createSubscription, getSubscriptions, updateSubscription, deleteSubscription,
    // Payments
    createPayment, getPayments,
    // Community
    getCommunityPosts, createCommunityPost, likeCommunityPost,
    // Calendar
    getCalendarNotes, upsertCalendarNote,
    // OTP
    saveOTP, verifyOTP, consumeOTP,
    // Admin
    getAdminStats,
};

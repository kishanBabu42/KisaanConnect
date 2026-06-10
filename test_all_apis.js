const http = require('http');

const BASE = 'http://localhost:3000';
let passed = 0, failed = 0;
const results = [];

function req(method, path, body) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: 3000, path,
            method, headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
        };
        const r = http.request(opts, res => {
            let raw = '';
            res.on('data', d => raw += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch(e) { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        r.on('error', e => resolve({ status: 0, body: e.message }));
        if (data) r.write(data);
        r.end();
    });
}

async function test(name, fn) {
    try {
        const result = await fn();
        if (result.ok) {
            passed++;
            results.push(`✅ ${name}`);
        } else {
            failed++;
            results.push(`❌ ${name}: ${result.reason}`);
        }
    } catch(e) {
        failed++;
        results.push(`❌ ${name}: ${e.message}`);
    }
}

async function run() {
    console.log('\n🔍 KisaanConnect API Test Suite\n================================\n');

    // HEALTH
    await test('GET /api/health', async () => {
        const r = await req('GET', '/api/health');
        return r.status === 200 && r.body.success ? { ok: true } : { ok: false, reason: `Status ${r.status}` };
    });

    // AUTH - Signup farmer
    let farmerId, farmerEmail = `farmer_test_${Date.now()}@test.com`;
    await test('POST /api/signup (farmer)', async () => {
        const r = await req('POST', '/api/signup', { name: 'Test Farmer', email: farmerEmail, password: 'test123', role: 'farmer', mobile: '9999999999', location: 'Test Farm' });
        if (r.body.id) { farmerId = r.body.id; return { ok: true }; }
        return { ok: false, reason: JSON.stringify(r.body) };
    });

    // AUTH - Signup customer
    let customerId, customerEmail = `customer_test_${Date.now()}@test.com`;
    await test('POST /api/signup (customer)', async () => {
        const r = await req('POST', '/api/signup', { name: 'Test Customer', email: customerEmail, password: 'test123', role: 'customer', mobile: '8888888888', location: 'Test City' });
        if (r.body.id) { customerId = r.body.id; return { ok: true }; }
        return { ok: false, reason: JSON.stringify(r.body) };
    });

    // AUTH - Login farmer
    await test('POST /api/login (farmer)', async () => {
        const r = await req('POST', '/api/login', { email: farmerEmail, password: 'test123', role: 'farmer' });
        return r.body.id ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    // AUTH - Login customer
    await test('POST /api/login (customer)', async () => {
        const r = await req('POST', '/api/login', { email: customerEmail, password: 'test123', role: 'customer' });
        return r.body.id ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    // AUTH - Admin login
    await test('POST /api/admin/login', async () => {
        const r = await req('POST', '/api/admin/login', { email: 'admin@kisaanconnect.com', password: 'admin123' });
        return (r.body.id || r.body.role === 'admin') ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    // USERS
    await test('GET /api/users', async () => {
        const r = await req('GET', '/api/users');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('GET /api/users/:id', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('GET', `/api/users/${farmerId}`);
        return r.body.id ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('PUT /api/users/:id (update profile)', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('PUT', `/api/users/${farmerId}`, { bio: 'Test bio', mobile: '9999999998' });
        return r.status === 200 ? { ok: true } : { ok: false, reason: `Status ${r.status}` };
    });

    await test('POST /api/users/add-wallet', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('POST', '/api/users/add-wallet', { userId: farmerId, amount: 500 });
        return r.body.success ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    // PRODUCTS
    let productId;
    await test('POST /api/products (create)', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('POST', '/api/products', { farmerId, farmerName: 'Test Farmer', farmerEmail, name: 'Tomatoes', price: 30, marketPrice: 40, quantity: 100, age: '2 days', location: 'Test Farm', images: [] });
        if (r.body.id) { productId = r.body.id; return { ok: true }; }
        return { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('GET /api/products', async () => {
        const r = await req('GET', '/api/products');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('GET /api/products?farmerId=X', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('GET', `/api/products?farmerId=${farmerId}`);
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('PUT /api/products/:id (update)', async () => {
        if (!productId) return { ok: false, reason: 'No product ID' };
        const r = await req('PUT', `/api/products/${productId}`, { name: 'Tomatoes Updated', price: 35, quantity: 90, age: '3 days', location: 'Farm', images: [] });
        return r.status === 200 ? { ok: true } : { ok: false, reason: `Status ${r.status}: ${JSON.stringify(r.body)}` };
    });

    await test('PUT /api/products/:id/sold', async () => {
        if (!productId) return { ok: false, reason: 'No product ID' };
        const r = await req('PUT', `/api/products/${productId}/sold`, {});
        return r.status === 200 ? { ok: true } : { ok: false, reason: `Status ${r.status}` };
    });

    // QUOTES
    let quoteId;
    await test('POST /api/quotes (create)', async () => {
        if (!farmerId || !customerId || !productId) return { ok: false, reason: 'Missing IDs' };
        const r = await req('POST', '/api/quotes', { productId, productName: 'Tomatoes', farmerId, farmerName: 'Test Farmer', farmerMobile: '9999999999', farmerLocation: 'Farm', customerId, customerName: 'Test Customer', customerMobile: '8888888888', customerLocation: 'City', quantity: 10, offerPrice: 28, needDriver: false });
        if (r.body.id) { quoteId = r.body.id; return { ok: true }; }
        return { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('GET /api/quotes?farmerId=X', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('GET', `/api/quotes?farmerId=${farmerId}`);
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('PUT /api/quotes/:id (accept)', async () => {
        if (!quoteId) return { ok: false, reason: 'No quote ID' };
        const r = await req('PUT', `/api/quotes/${quoteId}`, { status: 'yes', paid: false });
        return r.status === 200 ? { ok: true } : { ok: false, reason: `Status ${r.status}: ${JSON.stringify(r.body)}` };
    });

    // SUBSCRIPTIONS
    let subId;
    await test('POST /api/subscriptions (create)', async () => {
        if (!farmerId || !customerId || !productId) return { ok: false, reason: 'Missing IDs' };
        const r = await req('POST', '/api/subscriptions', { customerId, farmerId, productId, productName: 'Tomatoes', quantity: 5, day: 'Monday' });
        if (r.body.id) { subId = r.body.id; return { ok: true }; }
        return { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('GET /api/subscriptions?farmerId=X', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('GET', `/api/subscriptions?farmerId=${farmerId}`);
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('PUT /api/subscriptions/:id (approve)', async () => {
        if (!subId) return { ok: false, reason: 'No sub ID' };
        const r = await req('PUT', `/api/subscriptions/${subId}`, { status: 'approved', farmerReason: '' });
        return r.status === 200 ? { ok: true } : { ok: false, reason: `Status ${r.status}` };
    });

    // ORDERS
    await test('GET /api/orders', async () => {
        const r = await req('GET', '/api/orders');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('GET /api/deliveries/available', async () => {
        const r = await req('GET', '/api/deliveries/available');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    // PAYMENTS
    await test('POST /api/payments (record)', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('POST', '/api/payments', { userId: farmerId, userRole: 'farmer', type: 'credit', method: 'upi', amount: 500, description: 'Test payment' });
        return r.body.success ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('GET /api/payments?userId=X', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('GET', `/api/payments?userId=${farmerId}`);
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('GET /api/payments/all', async () => {
        const r = await req('GET', '/api/payments/all');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    // FARMER PAYMENT INFO
    await test('POST /api/farmer-payment-info (save)', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('POST', '/api/farmer-payment-info', { farmerId, upi: { upiId: 'test@upi' }, bank: { account: '1234', ifsc: 'SBIN0001' } });
        return r.body.success ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('GET /api/farmer-payment-info/:id', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('GET', `/api/farmer-payment-info/${farmerId}`);
        return (r.body.upi !== undefined) ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    // CALENDAR NOTES
    await test('POST /api/calendar_notes (save)', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('POST', '/api/calendar_notes', { farmerId, dateKey: '2025-06-01', note: 'Test note' });
        return r.body.success ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('GET /api/calendar_notes/:farmerId', async () => {
        if (!farmerId) return { ok: false, reason: 'No farmer ID' };
        const r = await req('GET', `/api/calendar_notes/${farmerId}`);
        return (r.status === 200 && typeof r.body === 'object') ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    // COMMUNITY
    await test('POST /api/community (post)', async () => {
        const r = await req('POST', '/api/community', { customerId: customerId || 1, customerName: 'Test Customer', message: 'Test community post' });
        return r.body.id ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('GET /api/community', async () => {
        const r = await req('GET', '/api/community');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    // ADMIN ROUTES
    await test('GET /api/admin/products', async () => {
        const r = await req('GET', '/api/admin/products');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('GET /api/admin/customer-orders', async () => {
        const r = await req('GET', '/api/admin/customer-orders');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('GET /api/admin/platform-fees', async () => {
        const r = await req('GET', '/api/admin/platform-fees');
        return Array.isArray(r.body) ? { ok: true } : { ok: false, reason: `Got ${typeof r.body}` };
    });

    await test('GET /api/platform-fee-details', async () => {
        const r = await req('GET', '/api/platform-fee-details');
        return (r.body.details !== undefined) ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('POST /api/admin/settings/payment-details', async () => {
        const r = await req('POST', '/api/admin/settings/payment-details', { details: 'UPI: admin@kisaanconnect' });
        return r.body.success ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    await test('POST /api/platform-fee', async () => {
        if (!customerId) return { ok: false, reason: 'No customer ID' };
        const r = await req('POST', '/api/platform-fee', { userId: customerId, userRole: 'customer', amount: 1000, orderId: 999 });
        return r.body.success ? { ok: true } : { ok: false, reason: JSON.stringify(r.body) };
    });

    // CLEANUP - delete test data
    if (productId) await req('DELETE', `/api/products/${productId}`);
    if (subId) await req('DELETE', `/api/subscriptions/${subId}`);

    // RESULTS
    console.log(results.join('\n'));
    console.log(`\n================================`);
    console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${passed+failed} tests`);
    if (failed === 0) console.log('🎉 ALL TESTS PASSED — Server is fully functional!');
    else console.log(`⚠️  ${failed} test(s) need attention.`);
    process.exit(failed > 0 ? 1 : 0);
}

run();

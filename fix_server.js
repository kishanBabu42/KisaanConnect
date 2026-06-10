
const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// 1. POST /api/products - create product
s = s.replace(
`app.post('/api/products', (req, res) => {
    const p = req.body;
    db.query('INSERT INTO products (farmerId, farmerName, farmerEmail, name, price, marketPrice, quantity, age, location, images) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [p.farmerId, p.farmerName, p.farmerEmail, p.name, p.price, p.marketPrice, p.quantity, p.age, p.location, JSON.stringify(p.images || [])], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId });
    });
});`,
`app.post('/api/products', async (req, res) => {
    const p = req.body;
    try {
        const product = await fdb.createProduct({ farmerId: String(p.farmerId), farmerName: p.farmerName, farmerEmail: p.farmerEmail, name: p.name, price: p.price, marketPrice: p.marketPrice, quantity: p.quantity, age: p.age, location: p.location, images: p.images || [] });
        res.json({ id: product.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 2. PUT /api/products/:id - update product
s = s.replace(
`app.put('/api/products/:id', (req, res) => {
    const p = req.body;
    db.query('UPDATE products SET name = ?, price = ?, quantity = ?, age = ?, location = ?, images = ? WHERE id = ?',
    [p.name, p.price, p.quantity, p.age, p.location, JSON.stringify(p.images || []), req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.send('Product updated');
    });
});`,
`app.put('/api/products/:id', async (req, res) => {
    const p = req.body;
    try {
        await fdb.updateProduct(req.params.id, { name: p.name, price: p.price, quantity: p.quantity, age: p.age, location: p.location, images: p.images || [] });
        res.send('Product updated');
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 3. PUT /api/products/:id/sold
s = s.replace(
`app.put('/api/products/:id/sold', (req, res) => {
    db.query('UPDATE products SET status = "sold" WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.send('Product marked as sold');
    });
});`,
`app.put('/api/products/:id/sold', async (req, res) => {
    try {
        await fdb.updateProduct(req.params.id, { status: 'sold' });
        res.send('Product marked as sold');
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 4. GET /api/subscriptions
s = s.replace(
`app.get('/api/subscriptions', (req, res) => {
    const { farmerId, customerId } = req.query;
    let query = \`
        SELECT s.*, 
               u.name AS customerName, 
               u.mobile AS customerMobile, 
               u.location AS customerLocation 
        FROM subscriptions s
        LEFT JOIN users u ON s.customerId = u.id
    \`;
    let params = [];
    if (farmerId) { query += ' WHERE s.farmerId = ?'; params.push(farmerId); }
    else if (customerId) { query += ' WHERE s.customerId = ?'; params.push(customerId); }
    
    db.query(query + ' ORDER BY s.createdAt DESC', params, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});`,
`app.get('/api/subscriptions', async (req, res) => {
    try {
        const rows = await fdb.getSubscriptions({ farmerId: req.query.farmerId, customerId: req.query.customerId });
        res.json(rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 5. POST /api/subscriptions
s = s.replace(
`app.post('/api/subscriptions', (req, res) => {
    const s = req.body;
    db.query('INSERT INTO subscriptions (customerId, farmerId, productId, productName, quantity, day) VALUES (?,?,?,?,?,?)',
    [s.customerId, s.farmerId, s.productId, s.productName, s.quantity, s.day], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId });
    });
});`,
`app.post('/api/subscriptions', async (req, res) => {
    const sub = req.body;
    try {
        const result = await fdb.createSubscription({ customerId: String(sub.customerId), farmerId: String(sub.farmerId), productId: String(sub.productId), productName: sub.productName, quantity: sub.quantity, day: sub.day });
        res.json({ id: result.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 6. PUT /api/subscriptions/:id
s = s.replace(
`app.put('/api/subscriptions/:id', (req, res) => {
    const { status, farmerReason } = req.body;
    db.query('UPDATE subscriptions SET status = ?, farmerReason = ? WHERE id = ?', [status, farmerReason, req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.send('Subscription updated');
    });
});`,
`app.put('/api/subscriptions/:id', async (req, res) => {
    const { status, farmerReason } = req.body;
    try {
        await fdb.updateSubscription(req.params.id, { status, farmerReason });
        res.send('Subscription updated');
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 7. GET /api/orders
s = s.replace(
`app.get('/api/orders', (req, res) => {
    const { farmerId, customerId } = req.query;
    let query = \`
        SELECT o.*, 
               u.name AS driverName, 
               u.mobile AS driverMobile, 
               u.vehicleType AS driverVehicle 
        FROM orders o 
        LEFT JOIN users u ON o.deliveryPartnerId = u.id
    \`;
    let params = [];
    if (farmerId) { query += ' WHERE o.farmerId = ?'; params.push(farmerId); }
    else if (customerId) { query += ' WHERE o.customerId = ?'; params.push(customerId); }
    db.query(query + ' ORDER BY o.deliveredAt DESC', params, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});`,
`app.get('/api/orders', async (req, res) => {
    try {
        const rows = await fdb.getOrders({ farmerId: req.query.farmerId, customerId: req.query.customerId });
        res.json(rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 8. POST /api/orders
s = s.replace(
`app.post('/api/orders', (req, res) => {
    const o = req.body;
    db.query('INSERT INTO orders (farmerId, customerId, productName, quantity, price, pickupLocation, dropoffLocation, status, rating, review, paymentMethod, deliveredAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)',
    [o.farmerId, o.customerId, o.productName, o.quantity, o.price, o.pickupLocation || '', o.dropoffLocation || '', o.status, o.rating, o.review, o.paymentMethod], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId });
    });
});`,
`app.post('/api/orders', async (req, res) => {
    const o = req.body;
    try {
        const order = await fdb.createOrder({ ...o, deliveredAt: new Date().toISOString() });
        res.json({ id: order.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 9. POST /api/admin/login
s = s.replace(
`app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ? AND password = ? AND role = "admin"', [email, password], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length > 0) res.json(results[0]);
        else res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    });
});`,
`app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await fdb.findUserByEmailAndRole(email, password, 'admin');
        if (user) res.json(user);
        else res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});`
);

// 10. GET /api/payments
s = s.replace(
`app.get('/api/payments', (req, res) => {
    const { userId } = req.query;
    let query = 'SELECT * FROM payments';
    let params = [];
    if (userId) { query += ' WHERE userId = ?'; params.push(userId); }
    db.query(query + ' ORDER BY createdAt DESC', params, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});`,
`app.get('/api/payments', async (req, res) => {
    try {
        const rows = await fdb.getPayments(req.query.userId || null);
        res.json(rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 11. POST /api/payments
s = s.replace(
`app.post('/api/payments', (req, res) => {
    const { userId, userRole, type, method, amount, description, reference } = req.body;
    db.query('INSERT INTO payments (userId, userRole, type, method, amount, description, reference) VALUES (?,?,?,?,?,?,?)',
    [userId, userRole, type, method, amount, description || '', reference || ''], (err, result) => {
        if (err) return res.status(500).send(err);
        // Update wallet if credit/debit
        const delta = type === 'credit' ? amount : -amount;
        db.query('UPDATE users SET wallet = wallet + ? WHERE id = ?', [delta, userId], () => {});
        res.json({ id: result.insertId, success: true });
    });
});`,
`app.post('/api/payments', async (req, res) => {
    const { userId, userRole, type, method, amount, description, reference } = req.body;
    try {
        const payment = await fdb.createPayment({ userId: String(userId), userRole, type, method, amount: parseFloat(amount), description: description || '', reference: reference || '', status: 'success' });
        const user = await fdb.getUserById(String(userId));
        const delta = type === 'credit' ? parseFloat(amount) : -parseFloat(amount);
        const newWallet = parseFloat(user?.wallet || 0) + delta;
        await fdb.updateUser(String(userId), { wallet: newWallet });
        res.json({ id: payment.id, success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 12. GET /api/payments/all
s = s.replace(
`app.get('/api/payments/all', (req, res) => {
    db.query(\`
        SELECT p.*, u.name AS userName, u.email AS userEmail
        FROM payments p
        LEFT JOIN users u ON p.userId = u.id
        ORDER BY p.createdAt DESC
    \`, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});`,
`app.get('/api/payments/all', async (req, res) => {
    try {
        const payments = await fdb.getPayments(null);
        const users = await fdb.getAllUsers();
        const userMap = {};
        users.forEach(u => { userMap[String(u.id)] = u; });
        const enriched = payments.map(p => ({ ...p, userName: userMap[String(p.userId)]?.name || '', userEmail: userMap[String(p.userId)]?.email || '' }));
        res.json(enriched);
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 13. GET /api/farmer-payment-info/:farmerId
s = s.replace(
`app.get('/api/farmer-payment-info/:farmerId', (req, res) => {
    db.query('SELECT payment_upi, payment_bank FROM users WHERE id = ?', [req.params.farmerId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!results.length) return res.json({ upi: null, bank: null });
        let upi = null, bank = null;
        try { upi = results[0].payment_upi ? JSON.parse(results[0].payment_upi) : null; } catch(e) { upi = { upiId: results[0].payment_upi }; }
        try { bank = results[0].payment_bank ? JSON.parse(results[0].payment_bank) : null; } catch(e) {}
        res.json({ upi, bank });
    });
});`,
`app.get('/api/farmer-payment-info/:farmerId', async (req, res) => {
    try {
        const user = await fdb.getUserById(req.params.farmerId);
        if (!user) return res.json({ upi: null, bank: null });
        let upi = null, bank = null;
        try { upi = user.payment_upi ? (typeof user.payment_upi === 'string' ? JSON.parse(user.payment_upi) : user.payment_upi) : null; } catch(e) { upi = { upiId: user.payment_upi }; }
        try { bank = user.payment_bank ? (typeof user.payment_bank === 'string' ? JSON.parse(user.payment_bank) : user.payment_bank) : null; } catch(e) {}
        res.json({ upi, bank });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 14. POST /api/farmer-payment-info
s = s.replace(
`app.post('/api/farmer-payment-info', (req, res) => {
    const { farmerId, upi, bank } = req.body;
    db.query('UPDATE users SET payment_upi = ?, payment_bank = ? WHERE id = ?',
        [JSON.stringify(upi), JSON.stringify(bank), farmerId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});`,
`app.post('/api/farmer-payment-info', async (req, res) => {
    const { farmerId, upi, bank } = req.body;
    try {
        await fdb.updateUser(String(farmerId), { payment_upi: upi, payment_bank: bank });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 15. GET /api/admin/products
s = s.replace(
`app.get('/api/admin/products', (req, res) => {
    db.query(\`
        SELECT p.*, u.name AS farmerName, u.mobile AS farmerMobile, u.email AS farmerEmail
        FROM products p
        LEFT JOIN users u ON p.farmerId = u.id
        ORDER BY p.createdAt DESC
    \`, (err, results) => {
        if (err) return res.status(500).send(err);
        const parsed = results.map(row => {
            if (typeof row.images === 'string') {
                try { row.images = JSON.parse(row.images); } catch(e) { row.images = []; }
            }
            return row;
        });
        res.json(parsed);
    });
});`,
`app.get('/api/admin/products', async (req, res) => {
    try {
        const products = await fdb.getProducts(null);
        const users = await fdb.getAllUsers();
        const userMap = {};
        users.forEach(u => { userMap[String(u.id)] = u; });
        const enriched = products.map(p => ({ ...p, farmerName: userMap[String(p.farmerId)]?.name || p.farmerName || '', farmerMobile: userMap[String(p.farmerId)]?.mobile || '', farmerEmail: userMap[String(p.farmerId)]?.email || p.farmerEmail || '' }));
        res.json(enriched);
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 16. GET /api/admin/customer-orders
s = s.replace(
`app.get('/api/admin/customer-orders', (req, res) => {
    db.query(\`
        SELECT o.*, 
               uf.name AS farmerName, uf.mobile AS farmerMobile,
               uc.name AS customerName, uc.mobile AS customerMobile, uc.email AS customerEmail,
               ud.name AS driverName
        FROM orders o
        LEFT JOIN users uf ON o.farmerId = uf.id
        LEFT JOIN users uc ON o.customerId = uc.id
        LEFT JOIN users ud ON o.deliveryPartnerId = ud.id
        ORDER BY o.createdAt DESC
    \`, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});`,
`app.get('/api/admin/customer-orders', async (req, res) => {
    try {
        const orders = await fdb.getOrders({});
        const users = await fdb.getAllUsers();
        const userMap = {};
        users.forEach(u => { userMap[String(u.id)] = u; });
        const enriched = orders.map(o => ({ ...o, farmerName: userMap[String(o.farmerId)]?.name || '', farmerMobile: userMap[String(o.farmerId)]?.mobile || '', customerName: userMap[String(o.customerId)]?.name || '', customerMobile: userMap[String(o.customerId)]?.mobile || '', customerEmail: userMap[String(o.customerId)]?.email || '', driverName: userMap[String(o.deliveryPartnerId)]?.name || '' }));
        res.json(enriched);
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 17. POST /api/platform-fee
s = s.replace(
`app.post('/api/platform-fee', (req, res) => {
    const { userId, userRole, amount, orderId, description } = req.body;
    const feeRate = userRole === 'customer' ? 0.03 : 0.0172;
    const feeAmount = parseFloat((parseFloat(amount) * feeRate).toFixed(2));
    db.query(
        'INSERT INTO payments (userId, userRole, type, method, amount, description, reference, status) VALUES (?,?,?,?,?,?,?,?)',
        [userId, userRole, 'debit', 'wallet', feeAmount, description || \`Platform fee (\${(feeRate*100).toFixed(2)}%)\`, \`FEE-ORD-\${orderId || Date.now()}\`, 'success'],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            // Deduct from wallet
            db.query('UPDATE users SET wallet = wallet - ? WHERE id = ?', [feeAmount, userId], (err2) => {
                if (err2) console.error('Wallet deduction error:', err2);
            });
            res.json({ success: true, feeAmount, id: result.insertId });
        }
    );
});`,
`app.post('/api/platform-fee', async (req, res) => {
    const { userId, userRole, amount, orderId, description } = req.body;
    const feeRate = userRole === 'customer' ? 0.03 : 0.0172;
    const feeAmount = parseFloat((parseFloat(amount) * feeRate).toFixed(2));
    try {
        const payment = await fdb.createPayment({ userId: String(userId), userRole, type: 'debit', method: 'wallet', amount: feeAmount, description: description || \`Platform fee (\${(feeRate*100).toFixed(2)}%)\`, reference: \`FEE-ORD-\${orderId || Date.now()}\`, status: 'success' });
        const user = await fdb.getUserById(String(userId));
        const newWallet = parseFloat(user?.wallet || 0) - feeAmount;
        await fdb.updateUser(String(userId), { wallet: newWallet });
        res.json({ success: true, feeAmount, id: payment.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 18. GET /api/admin/platform-fees
s = s.replace(
`app.get('/api/admin/platform-fees', (req, res) => {
    db.query(\`
        SELECT p.*, u.name AS userName, u.email AS userEmail, u.role AS userRole
        FROM payments p
        LEFT JOIN users u ON p.userId = u.id
        WHERE p.description LIKE '%Platform fee%' AND p.type = 'debit'
        ORDER BY p.createdAt DESC
    \`, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});`,
`app.get('/api/admin/platform-fees', async (req, res) => {
    try {
        const payments = await fdb.getPayments(null);
        const users = await fdb.getAllUsers();
        const userMap = {};
        users.forEach(u => { userMap[String(u.id)] = u; });
        const fees = payments.filter(p => (p.description || '').includes('Platform fee') && p.type === 'debit');
        const enriched = fees.map(p => ({ ...p, userName: userMap[String(p.userId)]?.name || '', userEmail: userMap[String(p.userId)]?.email || '', userRole: userMap[String(p.userId)]?.role || p.userRole }));
        res.json(enriched);
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 19. GET /api/platform-fee-details
s = s.replace(
`app.get('/api/platform-fee-details', (req, res) => {
    db.query('SELECT value FROM settings WHERE \`key\` = "admin_payment_details"', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json({ details: results.length ? results[0].value : "Please contact admin for payment details." });
    });
});`,
`app.get('/api/platform-fee-details', async (req, res) => {
    try {
        const doc = await fdb.getDb().collection('settings').doc('admin_payment_details').get();
        res.json({ details: doc.exists ? doc.data().value : 'Please contact admin for payment details.' });
    } catch(e) { res.json({ details: 'Please contact admin for payment details.' }); }
});`
);

// 20. POST /api/admin/settings/payment-details
s = s.replace(
`app.post('/api/admin/settings/payment-details', (req, res) => {
    const { details } = req.body;
    db.query('INSERT INTO settings (\`key\`, \\\`value\\\`) VALUES ("admin_payment_details", ?) ON DUPLICATE KEY UPDATE \\\`value\\\` = ?',
    [details, details], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});`,
`app.post('/api/admin/settings/payment-details', async (req, res) => {
    const { details } = req.body;
    try {
        await fdb.getDb().collection('settings').doc('admin_payment_details').set({ value: details });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 21. POST /api/admin/clear-fees
s = s.replace(
`app.post('/api/admin/clear-fees', (req, res) => {
    const { userId } = req.body;
    db.query('UPDATE users SET pending_platform_fee = 0, is_locked = 0 WHERE id = ?', [userId], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});`,
`app.post('/api/admin/clear-fees', async (req, res) => {
    const { userId } = req.body;
    try {
        await fdb.updateUser(String(userId), { pending_platform_fee: 0, is_locked: false });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});`
);

// 22. POST /api/pay-pending-fee - first db.query
s = s.replace(
`app.post('/api/pay-pending-fee', (req, res) => {
    const { userId, amount, method, email, name } = req.body;
    
    db.query('UPDATE users SET pending_platform_fee = 0, is_locked = 0 WHERE id = ?', [userId], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        
        const reference = \`FEE-PAY-\${Date.now()}\`;
        db.query('INSERT INTO payments (userId, userRole, type, method, amount, description, reference, status) VALUES (?,?,?,?,?,?,?,?)',
            [userId, 'system', 'credit', method, amount, 'Platform Fee Clearance Payment', reference, 'success'], async (err2) => {`,
`app.post('/api/pay-pending-fee', async (req, res) => {
    const { userId, amount, method, email, name } = req.body;
    try {
        await fdb.updateUser(String(userId), { pending_platform_fee: 0, is_locked: false });
        const reference = \`FEE-PAY-\${Date.now()}\`;
        await fdb.createPayment({ userId: String(userId), userRole: 'system', type: 'credit', method, amount: parseFloat(amount), description: 'Platform Fee Clearance Payment', reference, status: 'success' });
        {
            const err2 = null;
            (() => {`
);

// Fix the closing of the pay-pending-fee function
s = s.replace(
`                res.json({ success: true, reference });
            });
    });
});`,
`                res.json({ success: true, reference });
            })();
        }
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});`
);

// Remove dead initializeDatabase function references
s = s.replace(`\ninitializeDatabase();\n`, '\n');

// Verify no db.query left
const remaining = (s.match(/db\.query/g) || []).length;
console.log('Remaining db.query calls:', remaining);

fs.writeFileSync('server.js', s, 'utf8');
console.log('✅ server.js fixed successfully!');

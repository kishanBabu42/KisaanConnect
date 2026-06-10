require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const port = process.env.PORT || 3000;

// Security and Performance Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(cors());

// Increase payload limits for large images
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'kisaanconnect'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('MySQL Connected...');
});

// MULTER SETUP
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'file-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is healthy', timestamp: new Date() });
});

// AUTH
app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;
    db.query('SELECT * FROM users WHERE email = ? AND password = ? AND role = ?', [email, password, role], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (results.length > 0) res.json(results[0]);
        else res.status(401).json({ success: false, message: 'Invalid email, password, or role.' });
    });
});

app.post('/api/signup', (req, res) => {
    const { name, email, password, role, mobile, location } = req.body;
    db.query('INSERT INTO users (name, email, password, role, mobile, location) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, password, role, mobile, location], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Email already exists.' });
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ id: result.insertId, name, email, role, mobile, location, wallet: 0 });
    });
});

// USERS
app.get('/api/users', (req, res) => {
    db.query('SELECT id, name, role, location, mobile, lat, lng, profilePic FROM users', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

app.get('/api/users/:id', (req, res) => {
    db.query('SELECT * FROM users WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results[0]);
    });
});

app.put('/api/users/:id', (req, res) => {
    const { name, mobile, location, wallet, bio, lat, lng, profilePic } = req.body;
    db.query('UPDATE users SET name = ?, mobile = ?, location = ?, wallet = ?, bio = ?, lat = ?, lng = ?, profilePic = ? WHERE id = ?',
    [name, mobile, location, wallet, bio, lat, lng, profilePic, req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.send('User updated');
    });
});

// PRODUCTS
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products ORDER BY createdAt DESC', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

app.post('/api/products', (req, res) => {
    const p = req.body;
    db.query('INSERT INTO products (farmerId, farmerName, farmerEmail, name, price, marketPrice, quantity, age, location, images) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [p.farmerId, p.farmerName, p.farmerEmail, p.name, p.price, p.marketPrice, p.quantity, p.age, p.location, p.images], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId });
    });
});

// QUOTES
app.get('/api/quotes', (req, res) => {
    const { farmerId, customerId } = req.query;
    let query = 'SELECT * FROM quotes';
    let params = [];
    if (farmerId) { query += ' WHERE farmerId = ?'; params.push(farmerId); }
    else if (customerId) { query += ' WHERE customerId = ?'; params.push(customerId); }
    db.query(query + ' ORDER BY createdAt DESC', params, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

app.post('/api/quotes', (req, res) => {
    const q = req.body;
    db.query('INSERT INTO quotes (productId, productName, farmerId, farmerName, farmerMobile, farmerLocation, customerId, customerName, customerMobile, customerLocation, quantity, offerPrice) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [q.productId, q.productName, q.farmerId, q.farmerName, q.farmerMobile, q.farmerLocation, q.customerId, q.customerName, q.customerMobile, q.customerLocation, q.quantity, q.offerPrice], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId });
    });
});

app.put('/api/quotes/:id', (req, res) => {
    const { status } = req.body;
    db.query('UPDATE quotes SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        
        if (status === 'yes') {
            db.query('SELECT * FROM quotes WHERE id = ?', [req.params.id], (err, results) => {
                if (err || results.length === 0) return;
                const q = results[0];
                db.query('INSERT INTO orders (farmerId, customerId, productName, quantity, price, pickupLocation, dropoffLocation, status) VALUES (?,?,?,?,?,?,?,?)',
                [q.farmerId, q.customerId, q.productName, q.quantity, q.offerPrice * q.quantity, q.farmerLocation || 'Farm', q.customerLocation || 'Home', 'accepted'], (err) => {
                    if (err) console.error("Error creating order:", err);
                });
            });
        }
        res.send('Quote updated');
    });
});

// ORDERS
app.get('/api/orders', (req, res) => {
    const { farmerId, customerId } = req.query;
    let query = 'SELECT * FROM orders';
    let params = [];
    if (farmerId) { query += ' WHERE farmerId = ?'; params.push(farmerId); }
    else if (customerId) { query += ' WHERE customerId = ?'; params.push(customerId); }
    db.query(query + ' ORDER BY deliveredAt DESC', params, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// Start Server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server strictly for Farmers & Customers running on port ${port}`);
});

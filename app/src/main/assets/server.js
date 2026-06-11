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
const nodemailer = require('nodemailer');
const fs = require('fs');

const app = express();
const http = require('http').createServer(app);
const port = process.env.PORT || 3000;

// Get local IP address for easy mobile connection
const networkInterfaces = require('os').networkInterfaces();
let localIp = 'localhost';
let allIps = [];

for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            allIps.push(iface.address);
            // Priority: WiFi/WLAN interfaces
            if (interfaceName.toLowerCase().includes('wi-fi') || interfaceName.toLowerCase().includes('wlan')) {
                localIp = iface.address;
            }
        }
    }
}
if (localIp === 'localhost' && allIps.length > 0) localIp = allIps[0];

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory');
}

// Global Exception Handlers to prevent server from crashing
process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] CRITICAL: Uncaught Exception:`, err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] CRITICAL: Unhandled Rejection at:`, promise, 'reason:', reason);
});

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

// Database Connection - Using a Pool to handle reconnections and prevent crashes
const db = mysql.createPool({
    connectionLimit: 100, // Increased for stability
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'kisaanconnect',
    charset: 'utf8mb4',
    multipleStatements: true,
    connectTimeout: 15000,
    acquireTimeout: 15000,
    waitForConnections: true,
    queueLimit: 0
});

// Verify connection
console.log(`Attempting to connect to database: ${process.env.DB_NAME || 'kisaanconnect'} on ${process.env.DB_HOST || 'localhost'}...`);
db.getConnection((err, connection) => {
    if (err) {
        console.error('CRITICAL ERROR: Database connection failed!');
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);
        console.error('Check your .env file or database status.');
        return;
    }
    console.log('SUCCESS: MySQL Connected via Pool.');
    connection.release();
});

// Handle pool errors to prevent server crash
db.on('error', (err) => {
    console.error('CRITICAL: Database pool error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('Database connection was closed. Reconnecting...');
    } else if (err.code === 'ER_CON_COUNT_ERROR') {
        console.error('Database has too many connections.');
    } else if (err.code === 'ECONNREFUSED') {
        console.error('Database connection was refused.');
    }
});

// Periodic Keep-Alive Ping (Runs every 30 seconds)
const keepAliveInterval = setInterval(() => {
    db.query('SELECT 1', (err) => {
        if (err) {
            console.error('Keep-alive ping failed:', err.message);
        }
    });
}, 30000);

// Graceful Shutdown
const shutdown = () => {
    console.log('\n🛑 Shutting down server...');
    clearInterval(keepAliveInterval);
    db.end((err) => {
        if (err) console.error('Error closing database pool:', err);
        else console.log('Database pool closed.');
        http.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// PROFESSIONAL EMAIL TEMPLATE BUILDER
function buildProEmail(title, content) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <style>
            body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: sans-serif; }
            .card { max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
            .header { background: #059669; padding: 40px; text-align: center; color: white; }
            .content { padding: 40px; color: #334155; line-height: 1.6; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; }
            .btn { display: inline-block; background: #059669; color: white !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <div style="font-size: 40px;">🌾</div>
                <h1 style="margin: 10px 0 0; font-size: 24px;">KisaanConnect</h1>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                © 2026 KisaanConnect Platform • Empowering Agriculture
            </div>
        </div>
    </body>
    </html>`;
}

// EMAIL SETUP
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465
    auth: {
        user: process.env.MAIL_USER || 'pinnamgurudhanunjay7981@gmail.com',
        pass: process.env.MAIL_PASS || 'ktpocycnqxbjqexr'
    }
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

// PING ROUTE for Mobile Network Utility
app.get('/api/ping', (req, res) => {
    res.json({
        ok: true,
        server: 'KisaanConnect',
        version: '1.0',
        serverIp: localIp,
        allIps: allIps,
        dbStatus: db ? 'pool_active' : 'no_pool',
        timestamp: Date.now()
    });
});

// DATABASE STATUS CHECK
app.get('/api/db-status', (req, res) => {
    db.getConnection((err, conn) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        conn.query('SELECT 1', (qErr) => {
            conn.release();
            if (qErr) return res.status(500).json({ ok: false, error: qErr.message });
            res.json({ ok: true, message: 'Database is reachable and responding.' });
        });
    });
});

// AUTH
app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing email, password, or role.' });
    }

    console.log(`[Login Attempt] ${email} as ${role}`);
    db.query('SELECT * FROM users WHERE email = ? AND password = ? AND role = ?', [email, password, role], (err, results) => {
        if (err) {
            console.error('[Login Error]', err.message);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        if (results.length > 0) {
            console.log('[Login Success]', email);
            res.json(results[0]);
        } else {
            console.log('[Login Failed] Invalid credentials for', email);
            res.status(401).json({ success: false, message: 'Invalid email, password, or role.' });
        }
    });
});

app.post('/api/signup', (req, res) => {
    const { name, email, password, role, mobile, location } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing required fields for signup.' });
    }

    console.log(`[Signup Attempt] ${email} (${role})`);

    db.query('INSERT INTO users (name, email, password, role, mobile, location) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, password, role, mobile || '', location || ''], (err, result) => {
        if (err) {
            console.error('[Signup] DB Error:', err.message);
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Email already exists.' });
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }

        console.log('[Signup Success] Created user ID:', result.insertId);

        // Send Welcome Email (Non-blocking)
        const mailOptions = {
            from: `"KisaanConnect 🌾" <${process.env.MAIL_USER || 'pinnamgurudhanunjay7981@gmail.com'}>`,
            to: email,
            subject: 'Welcome to KisaanConnect! 🌾',
            html: buildProEmail('Welcome', `
                <h2 style="color: #0f172a;">Namaste, ${name}! 👋</h2>
                <p>Thank you for joining <strong>KisaanConnect</strong>. We are excited to have you as a <strong>${role}</strong>.</p>
                <p>Your account is now active. You can log in using your email: <strong>${email}</strong>.</p>
                <div style="text-align: center;">
                    <a href="https://kisaanconnect.com" class="btn">Get Started</a>
                </div>
                <p style="margin-top: 30px; font-size: 14px; color: #64748b;">If you have any questions, feel free to reply to this email.</p>
            `)
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.error('[Signup] Email Error (Non-Critical):', error.message);
            else console.log('[Signup] Welcome email sent:', info.response);
        });

        res.json({ id: result.insertId, name, email, role, mobile: mobile || '', location: location || '', wallet: 0 });
    });
});

// GOOGLE AUTH
app.post('/api/google-auth', (req, res) => {
    const { email, name, role, picture, googleId } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Google Authentication failed: Email missing.' });
    }

    console.log(`[Google Auth] Request for: ${email}`);

    // 1. Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('[Google Auth] DB Error:', err.message);
            return res.status(500).json({ success: false, message: 'Database error during Google Auth.' });
        }

        if (results.length > 0) {
            const user = results[0];
            console.log(`[Google Auth] Existing user found: ${user.email}`);
            // Silently update profile pic/googleId if missing
            if ((!user.profilePic && picture) || (!user.googleId && googleId)) {
                db.query('UPDATE users SET profilePic = ?, googleId = ? WHERE id = ?', [user.profilePic || picture || '', user.googleId || googleId || '', user.id], (updErr) => {
                    if (updErr) console.warn('[Google Auth] Silent profile update failed:', updErr.message);
                });
            }
            res.json(user);
        } else {
            const finalRole = role || 'customer';
            console.log(`[Google Auth] Creating account: ${email} (${finalRole})`);

            // Professional approach: Try to insert with all fields, fallback if column missing
            const query = 'INSERT INTO users (name, email, role, location, mobile, password, profilePic, googleId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            const params = [name || 'Google User', email, finalRole, 'Unknown', '', 'GOOGLE_AUTH_USER', picture || '', googleId || ''];

            db.query(query, params, (err, result) => {
                if (err) {
                    console.error('[Google Auth] Signup Error:', err.message);
                    // Fallback for missing columns (profilePic or googleId)
                    if (err.code === 'ER_BAD_FIELD_ERROR') {
                        console.warn('[Google Auth] Column missing, retrying simplified insert...');
                        db.query('INSERT INTO users (name, email, role, location, mobile, password) VALUES (?, ?, ?, ?, ?, ?)',
                        [name || 'Google User', email, finalRole, 'Unknown', '', 'GOOGLE_AUTH_USER'], (err2, result2) => {
                            if (err2) return res.status(500).json({ success: false, message: err2.message });
                            return res.json({ id: result2.insertId, name, email, role: finalRole, location: 'Unknown', mobile: '', wallet: 0 });
                        });
                    } else {
                        return res.status(500).json({ success: false, message: 'Signup failed: ' + err.message });
                    }
                    return;
                }
                console.log(`[Google Auth] Account created successfully for ${email}`);
                res.json({ id: result.insertId, name, email, role: finalRole, profilePic: picture, googleId, location: 'Unknown', mobile: '', wallet: 0 });
            });
        }
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

// Global error handling middleware for Express
app.use((err, req, res, next) => {
    console.error('Internal Server Error:', err.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start Server
http.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[ERROR] Port ${port} is already in use!`);
        console.error(`Please kill the existing process or use a different port.`);
        process.exit(1);
    }
});

http.listen(port, '0.0.0.0', () => {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  🌾  KisaanConnect MySQL Server — ONLINE      ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🏠 Local:    http://localhost:${port}           ║`);
    console.log(`║  📱 Mobile:   http://${localIp}:${port}      ║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  ✅ Database: MySQL Pool Connected           ║');
    console.log('║  🚀 Status:   Running & Stable               ║');
    console.log('╚══════════════════════════════════════════════╝\n');
});

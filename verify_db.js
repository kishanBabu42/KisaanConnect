const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'kisaanconnect'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        process.exit(1);
    }
    console.log('Connected to MySQL');

    const tables = ['users', 'products', 'quotes', 'orders', 'transactions', 'community_posts', 'wishlist', 'product_likes'];

    let completed = 0;
    tables.forEach(table => {
        db.query(`SELECT COUNT(*) as count FROM ${table}`, (err, results) => {
            if (err) {
                console.error(`Error checking table ${table}:`, err.message);
            } else {
                console.log(`Table ${table}: ${results[0].count} rows`);
            }
            completed++;
            if (completed === tables.length) {
                db.query('SELECT * FROM users WHERE role = "admin"', (err, results) => {
                    if (err) console.error('Error checking admin user:', err.message);
                    else console.log('Admin user exists:', results.length > 0);
                    db.end();
                });
            }
        });
    });
});

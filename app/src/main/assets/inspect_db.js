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

    db.query('SHOW TABLES', (err, results) => {
        if (err) {
            console.error('Error showing tables:', err.message);
            db.end();
            return;
        }
        console.log('Tables:', results.map(r => Object.values(r)[0]));

        const tables = results.map(r => Object.values(r)[0]);
        let completed = 0;
        tables.forEach(table => {
            db.query(`DESCRIBE ${table}`, (err, columns) => {
                if (err) {
                    console.error(`Error describing table ${table}:`, err.message);
                } else {
                    console.log(`\nTable: ${table}`);
                    console.table(columns);
                }
                completed++;
                if (completed === tables.length) {
                    db.end();
                }
            });
        });
    });
});

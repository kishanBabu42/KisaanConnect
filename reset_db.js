const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    multipleStatements: true
});

const schema = `
DROP DATABASE IF EXISTS kisaanconnect;
CREATE DATABASE kisaanconnect;
USE kisaanconnect;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('farmer', 'customer', 'delivery', 'admin') NOT NULL,
    mobile VARCHAR(20),
    location VARCHAR(255),
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    bio TEXT,
    vehicleType VARCHAR(100),
    licenseNumber VARCHAR(100),
    wallet DECIMAL(10,2) DEFAULT 0.00,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farmerId INT NOT NULL,
    farmerName VARCHAR(255),
    farmerEmail VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    marketPrice DECIMAL(10,2),
    quantity DECIMAL(10,2),
    age INT,
    location VARCHAR(255),
    images LONGTEXT,
    deliveryTimeMin INT,
    deliveryTimeMax INT,
    status VARCHAR(50) DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    productId INT NOT NULL,
    productName VARCHAR(255),
    farmerId INT NOT NULL,
    farmerName VARCHAR(255),
    farmerMobile VARCHAR(20),
    farmerLocation VARCHAR(255),
    customerId INT NOT NULL,
    customerName VARCHAR(255),
    customerMobile VARCHAR(20),
    customerLocation VARCHAR(255),
    quantity DECIMAL(10,2),
    offerPrice DECIMAL(10,2),
    needDriver BOOLEAN DEFAULT FALSE,
    status ENUM('pending', 'yes', 'no', 'completed') DEFAULT 'pending',
    paid BOOLEAN DEFAULT FALSE,
    paymentMethod VARCHAR(50),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farmerId INT NOT NULL,
    customerId INT NOT NULL,
    deliveryPartnerId INT,
    productName VARCHAR(255),
    quantity DECIMAL(10,2),
    price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending',
    deliveryStatus VARCHAR(50) DEFAULT 'pending',
    pickupLocation VARCHAR(255),
    dropoffLocation VARCHAR(255),
    rating INT,
    review TEXT,
    paymentMethod VARCHAR(50),
    deliveredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (deliveryPartnerId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    type ENUM('credit', 'debit') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(50),
    description VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE community_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customerId INT,
    customerName VARCHAR(255),
    message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customerId INT,
    productId INT,
    UNIQUE KEY (customerId, productId),
    FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE product_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    productId INT,
    userId INT,
    UNIQUE KEY (productId, userId),
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users (name, email, password, role, location, mobile)
VALUES ('System Admin', 'admin@kisaan.com', 'Admin@123', 'admin', 'Office', '0000000000');
`;

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        process.exit(1);
    }
    console.log('Connected to MySQL. Resetting database...');

    db.query(schema, (err) => {
        if (err) {
            console.error('Error executing schema:', err.message);
        } else {
            console.log('Database schema created.');
            const seedData = `
                INSERT INTO users (name, email, password, role, location, mobile, wallet) VALUES 
                ('Demo Farmer', 'farmer@demo.com', 'password', 'farmer', 'Nashik, Maharashtra', '9876543210', 5000.00),
                ('Demo Customer', 'customer@demo.com', 'password', 'customer', 'Mumbai, Maharashtra', '8876543210', 2500.00),
                ('Delivery Partner', 'delivery@demo.com', 'password', 'delivery', 'Pune, Maharashtra', '7776543210', 100.00);

                INSERT INTO products (farmerId, farmerName, farmerEmail, name, price, marketPrice, quantity, age, location, status) VALUES 
                (2, 'Demo Farmer', 'farmer@demo.com', 'Organic Tomatoes', 40.00, 45.00, 100.0, 2, 'Nashik', 'active'),
                (2, 'Demo Farmer', 'farmer@demo.com', 'Fresh Spinach', 20.00, 25.00, 50.0, 1, 'Nashik', 'active'),
                (2, 'Demo Farmer', 'farmer@demo.com', 'Basmati Rice', 80.00, 90.00, 500.0, 5, 'Nashik', 'active');

                INSERT INTO community_posts (customerId, customerName, message) VALUES 
                (3, 'Demo Customer', 'Does anyone have tips for organic pest control for tomatoes?'),
                (2, 'Demo Farmer', 'I suggest using Neem oil spray. It works wonders and is completely organic!');
            `;
            db.query(seedData, (err) => {
                if (err) console.error('Error seeding data:', err.message);
                else console.log('Database seeded with demo data.');
                db.end();
            });
        }
    });
});

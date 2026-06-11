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
    profilePic TEXT,
    googleId VARCHAR(255),
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
            console.log('Database kisaanconnect has been reset and seeded.');
        }
        db.end();
    });
});

-- Create the database
CREATE DATABASE IF NOT EXISTS kisaanConnect;
USE kisaanConnect;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('farmer', 'customer', 'admin', 'delivery') NOT NULL,
    mobile VARCHAR(20),
    location VARCHAR(255),
    vehicleType VARCHAR(50),
    licenseNumber VARCHAR(50),
    wallet DECIMAL(10,2) DEFAULT 0.00,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
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
    images TEXT, -- Stores JSON array of image URLs
    deliveryTimeMin INT,
    deliveryTimeMax INT,
    status VARCHAR(50) DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE
);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    productId INT NOT NULL,
    productName VARCHAR(255),
    farmerId INT NOT NULL,
    farmerName VARCHAR(255),
    farmerMobile VARCHAR(20),
    customerId INT NOT NULL,
    customerName VARCHAR(255),
    customerMobile VARCHAR(20),
    customerLocation VARCHAR(255),
    quantity DECIMAL(10,2),
    offerPrice DECIMAL(10,2),
    status ENUM('pending', 'yes', 'no') DEFAULT 'pending',
    paid BOOLEAN DEFAULT FALSE,
    paymentMethod VARCHAR(50),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farmerId INT NOT NULL,
    customerId INT NOT NULL,
    deliveryPartnerId INT,
    productName VARCHAR(255),
    quantity DECIMAL(10,2),
    price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending',
    deliveryStatus ENUM('pending', 'accepted', 'picked_up', 'delivered') DEFAULT 'pending',
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

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    type ENUM('credit', 'debit') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(50),
    description VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert Demo Admin
INSERT INTO users (name, email, password, role, location, mobile)
VALUES ('System Admin', 'admin@kisaan.com', 'Admin@123', 'admin', 'Office', '0000000000')
ON DUPLICATE KEY UPDATE email=email;

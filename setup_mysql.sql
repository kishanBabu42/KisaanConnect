-- KisaanConnect MySQL Setup Script
-- Run this as MySQL root user:
-- mysql -u root -p < setup_mysql.sql

-- Create the database
CREATE DATABASE IF NOT EXISTS kisaanconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create the dedicated user
CREATE USER IF NOT EXISTS 'kisaanconnect'@'localhost' IDENTIFIED BY 'kisaanconnect';

-- Grant full privileges
GRANT ALL PRIVILEGES ON kisaanconnect.* TO 'kisaanconnect'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Confirm
SELECT 'KisaanConnect MySQL user and database created successfully!' AS status;

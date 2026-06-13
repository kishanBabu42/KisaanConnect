/**
 * KisaanConnect — Selenium Web E2E Test Suite
 * File: e2e_tests/selenium/web_e2e.test.js
 * 
 * Dependencies:
 *   npm install selenium-webdriver chromedriver
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// Configuration
const BASE_URL = 'http://localhost:3000';
let driver;

async function setup() {
    console.log('🌐 Initializing Chrome WebDriver...');
    const options = new chrome.Options();
    options.addArguments('--headless'); // Run headless in CI/test environments
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');
    options.addArguments('--window-size=1920,1080');

    driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
}

async function teardown() {
    if (driver) {
        await driver.quit();
        console.log('🌐 WebDriver session closed.');
    }
}

async function testLandingPage() {
    console.log('🧪 Testing Landing Page...');
    await driver.get(`${BASE_URL}/landing.html`);
    
    // Check title
    const title = await driver.getTitle();
    console.log(`   - Page Title: ${title}`);
    
    // Check main call-to-actions
    const startBtn = await driver.findElement(By.id('get-started-btn'));
    const isDisplayed = await startBtn.isDisplayed();
    console.log(`   - "Get Started" button is visible: ${isDisplayed}`);
    
    return isDisplayed;
}

async function testFarmerRegistrationAndLogin() {
    console.log('🧪 Testing Farmer Portal Auth...');
    await driver.get(`${BASE_URL}/index.html`);
    
    // Switch to Register Tab
    const registerTab = await driver.findElement(By.id('register-tab-btn'));
    await registerTab.click();
    
    // Fill Farmer Registration Form
    const email = `selenium_farmer_${Date.now()}@test.com`;
    await driver.findElement(By.id('reg-name')).sendKeys('Selenium Farmer');
    await driver.findElement(By.id('reg-email')).sendKeys(email);
    await driver.findElement(By.id('reg-password')).sendKeys('password123');
    await driver.findElement(By.id('reg-mobile')).sendKeys('9876543210');
    await driver.findElement(By.id('reg-location')).sendKeys('Punjab Farms');
    
    // Select Farmer Role
    const roleSelect = await driver.findElement(By.id('reg-role'));
    await roleSelect.sendKeys('farmer');
    
    // Submit
    const submitBtn = await driver.findElement(By.id('reg-submit-btn'));
    await submitBtn.click();
    
    // Wait for redirect to login or dashboard
    await driver.wait(until.urlContains('index.html'), 5000);
    console.log('   - Registration submitted successfully.');

    // Attempt Login
    await driver.findElement(By.id('login-email')).sendKeys(email);
    await driver.findElement(By.id('login-password')).sendKeys('password123');
    await driver.findElement(By.id('login-role')).sendKeys('farmer');
    await driver.findElement(By.id('login-submit-btn')).click();

    // Verify Dashboard Landing
    await driver.wait(until.urlContains('farmer-dashboard.html'), 8000);
    const welcomeText = await driver.findElement(By.id('user-name')).getText();
    console.log(`   - Logged in successfully. Welcome: ${welcomeText}`);
    
    return welcomeText.includes('Selenium Farmer');
}

async function testProductListing() {
    console.log('🧪 Testing Product Listing Management...');
    // Open Product Modal
    const addProductBtn = await driver.findElement(By.id('add-product-btn'));
    await addProductBtn.click();
    
    // Fill Details
    await driver.findElement(By.id('p-name')).sendKeys('Organic Potatoes');
    await driver.findElement(By.id('p-qty')).sendKeys('500');
    await driver.findElement(By.id('p-price')).sendKeys('20');
    await driver.findElement(By.id('p-age')).sendKeys('3');
    await driver.findElement(By.id('p-loc')).sendKeys('Amritsar');
    
    // Save Product
    await driver.findElement(By.id('save-product-btn')).click();
    
    // Verify it appears in Grid
    await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Organic Potatoes')]")), 5000);
    console.log('   - Product added and listed in dashboard successfully.');
    
    return true;
}

async function runAll() {
    try {
        await setup();
        const r1 = await testLandingPage();
        const r2 = await testFarmerRegistrationAndLogin();
        const r3 = await testProductListing();
        
        console.log(`\n🎉 Web tests completed. Overall status: ${r1 && r2 && r3 ? 'PASSED' : 'FAILED'}`);
    } catch (err) {
        console.error('❌ Selenium Test Execution failed:', err);
    } finally {
        await teardown();
    }
}

// If run directly
if (require.main === module) {
    runAll();
}

module.exports = { setup, teardown, testLandingPage, testFarmerRegistrationAndLogin, testProductListing };

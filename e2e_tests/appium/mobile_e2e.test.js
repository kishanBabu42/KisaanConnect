/**
 * KisaanConnect — Appium Mobile E2E Test Suite
 * File: e2e_tests/appium/mobile_e2e.test.js
 * 
 * Dependencies:
 *   npm install webdriverio
 */

const { remote } = require('webdriverio');
const path = require('path');

// Appium configuration
const capabilities = {
    platformName: 'Android',
    'appium:deviceName': 'Android Emulator',
    'appium:automationName': 'UiAutomator2',
    'appium:app': path.join(__dirname, '../../KisaanConnect-v1.3.apk'),
    'appium:appPackage': 'com.kisaanconnect.app',
    'appium:appActivity': 'com.kisaanconnect.app.MainActivity',
    'appium:noReset': false,
    'appium:autoGrantPermissions': true
};

const wdOpts = {
    hostname: process.env.APPIUM_HOST || 'localhost',
    port: parseInt(process.env.APPIUM_PORT || '4723'),
    logLevel: 'info',
    capabilities
};

let client;

async function setup() {
    console.log('📱 Initializing Appium WebDriverIO Session...');
    client = await remote(wdOpts);
}

async function teardown() {
    if (client) {
        await client.deleteSession();
        console.log('📱 Appium Session closed.');
    }
}

async function testServerIPConfiguration() {
    console.log('🧪 Testing Server IP Configuration Dialog...');
    
    // In KisaanConnect App, on first launch, a dialog appears to enter the Server IP Address
    const ipInput = await client.$('id=com.kisaanconnect.app:id/ip_address_input');
    const isIpVisible = await ipInput.isDisplayed();
    console.log(`   - IP input field visible: ${isIpVisible}`);
    
    if (isIpVisible) {
        await ipInput.setValue('10.0.2.2'); // Standard local loopback IP for Android Emulator
        const saveBtn = await client.$('id=com.kisaanconnect.app:id/btn_save_ip');
        await saveBtn.click();
        console.log('   - Server IP configured successfully.');
        return true;
    }
    return false;
}

async function testWebViewAuthentication() {
    console.log('🧪 Testing WebView Dashboard Login...');
    
    // Switch context from Native to WebView
    await client.waitUntil(async () => {
        const contexts = await client.getContexts();
        return contexts.length > 1;
    }, { timeout: 10000, timeoutMsg: 'WebView context did not load' });

    const contexts = await client.getContexts();
    console.log('   - Available Contexts:', contexts);
    
    // Switch to the WebView context
    const webviewContext = contexts.find(c => c.includes('WEBVIEW'));
    await client.switchContext(webviewContext);
    console.log(`   - Switched to context: ${webviewContext}`);

    // Interact with HTML Elements inside WebView
    const emailField = await client.$('#login-email');
    await emailField.setValue('farmer_test_appium@test.com');
    
    const passwordField = await client.$('#login-password');
    await passwordField.setValue('test123');

    const submitBtn = await client.$('#login-submit-btn');
    await submitBtn.click();

    // Verify redirection to Farmer Dashboard
    await client.waitUntil(async () => {
        const url = await client.getUrl();
        return url.includes('farmer-dashboard.html');
    }, { timeout: 8000, timeoutMsg: 'Redirection to farmer dashboard failed' });

    console.log('   - Logged in inside WebView successfully.');
    return true;
}

async function runAll() {
    try {
        await setup();
        const ipSuccess = await testServerIPConfiguration();
        const loginSuccess = await testWebViewAuthentication();
        
        console.log(`\n🎉 Mobile E2E tests completed. Status: ${ipSuccess && loginSuccess ? 'PASSED' : 'FAILED'}`);
    } catch (err) {
        console.error('❌ Appium Mobile Test Execution failed:', err);
    } finally {
        await teardown();
    }
}

// If run directly
if (require.main === module) {
    runAll();
}

module.exports = { setup, teardown, testServerIPConfiguration, testWebViewAuthentication };

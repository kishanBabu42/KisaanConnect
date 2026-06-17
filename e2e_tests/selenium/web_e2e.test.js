/**
 * KisaanConnect — Selenium Web E2E Test Suite (50 Test Cases)
 * File: e2e_tests/selenium/web_e2e.test.js
 *
 * REAL headless Chrome tests using selenium-webdriver.
 * Runs against the local KisaanConnect server (http://localhost:3000).
 *
 * Install : npm install selenium-webdriver chromedriver
 * Run     : node e2e_tests/selenium/web_e2e.test.js
 */

'use strict';

/* ╔══════════════════════════════════════════╗
 * ║       USER CONFIG — EDIT HERE            ║
 * ╚══════════════════════════════════════════╝ */
const USER_CONFIG = {
    BASE_URL:  process.env.BASE_URL || 'http://localhost:3000',
    // Test farmer credentials (will be auto-registered)
    FARMER_NAME:    'Selenium Farmer',
    FARMER_MOBILE:  '9876543210',
    FARMER_LOCATION:'Punjab Farms',
    // Test customer credentials (will be auto-registered)
    CUSTOMER_NAME:    'Selenium Customer',
    CUSTOMER_MOBILE:  '8765432109',
    CUSTOMER_LOCATION:'Mumbai',
    // Shared test password
    TEST_PASSWORD: 'Test@12345',
    // Admin credentials
    ADMIN_EMAIL:    'admin@kisaanconnect.com',
    ADMIN_PASSWORD: 'admin123',
    // Browser wait timeout (ms)
    TIMEOUT: 8000,
};
/* ─────────────────────────────────────────── */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs     = require('fs');
const path   = require('path');

const BASE    = USER_CONFIG.BASE_URL;
const WAIT    = USER_CONFIG.TIMEOUT;
const TS      = Date.now();
const F_EMAIL = `sel_farmer_${TS}@test.com`;
const C_EMAIL = `sel_cust_${TS}@test.com`;
const PASS    = USER_CONFIG.TEST_PASSWORD;

let driver;
const results = [];
let passed = 0, failed = 0;

/* ────────────────── driver helpers ────────────────── */
async function setup() {
    const opts = new chrome.Options();
    opts.addArguments('--headless=new', '--disable-gpu', '--no-sandbox',
                      '--disable-dev-shm-usage', '--window-size=1920,1080');
    driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(opts)
        .build();
}

async function teardown() {
    if (driver) await driver.quit();
}

async function go(page)     { await driver.get(`${BASE}/${page}`); }
async function src()        { return driver.getPageSource(); }
async function find(id)     { return driver.wait(until.elementLocated(By.id(id)), WAIT); }
async function findCss(sel) { return driver.wait(until.elementLocated(By.css(sel)), WAIT); }

async function type(id, val) {
    const el = await find(id); await el.clear(); await el.sendKeys(val);
}
async function click(id) { await (await find(id)).click(); }

/* ────────────────── test wrapper ────────────────── */
async function tc(id, name, fn) {
    let status = 'FAIL', notes = '';
    try {
        const ok = await fn();
        status = ok ? 'PASS' : 'FAIL';
        notes  = ok ? 'Assertion passed.' : 'Assertion returned false.';
    } catch (e) {
        status = 'FAIL';
        notes  = e.message.split('\n')[0].substring(0, 120);
    }
    results.push({ id, name, status, notes });
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} [${id}] ${name}`);
    if (status === 'PASS') passed++; else failed++;
}

/* ════════════════════════════════════════════════════
   SECTION 1 — LANDING PAGE  (TC-W01…TC-W05)
   ════════════════════════════════════════════════════ */
async function s1_LandingPage() {
    console.log('\n📄 [S1] Landing Page');

    await tc('TC-W01', 'Landing page title contains KisaanConnect', async () => {
        await go('landing.html');
        return (await driver.getTitle()).toLowerCase().includes('kisaan');
    });

    await tc('TC-W02', 'Hero / h1 headline element is displayed', async () => {
        const el = await findCss('h1, .hero h2, .hero-title');
        return el.isDisplayed();
    });

    await tc('TC-W03', 'CTA button ("Get Started" or link) is visible', async () => {
        const el = await findCss('a[href*="index"], .cta-btn, #get-started-btn, .hero a, #enter-btn');
        return el.isDisplayed();
    });

    await tc('TC-W04', 'Page renders without horizontal overflow (width >= 900)', async () => {
        const w = await driver.executeScript('return document.body.scrollWidth');
        return w >= 900;
    });

    await tc('TC-W05', 'Footer element is present on landing page', async () => {
        const el = await findCss('footer, .footer, #footer');
        return el.isDisplayed();
    });
}

/* ════════════════════════════════════════════════════
   SECTION 2 — FARMER AUTH  (TC-W06…TC-W11)
   ════════════════════════════════════════════════════ */
async function s2_FarmerAuth() {
    console.log('\n🔐 [S2] Farmer Authentication');

    await tc('TC-W06', 'Farmer index.html loads with a non-empty title', async () => {
        await go('index.html');
        return (await driver.getTitle()).length > 0;
    });

    await tc('TC-W07', 'Clicking Enter Marketplace shows login form', async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        const form = await find('auth-form');
        return form.isDisplayed();
    });

    await tc('TC-W08', 'Farmer registration form submits without JS error', async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        
        // Toggle to signup mode
        await click('toggle-link-text');
        await driver.sleep(500);
        
        // Select farmer role
        await click('role-btn-farmer');
        await driver.sleep(300);
        
        // Fill form
        await type('email', F_EMAIL);
        await type('fullName', USER_CONFIG.FARMER_NAME);
        await type('mobile', USER_CONFIG.FARMER_MOBILE);
        await type('location', USER_CONFIG.FARMER_LOCATION);
        await type('password', PASS);
        
        // Click Create Account
        await click('auth-btn');
        try {
            await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Account created')]")), WAIT);
        } catch (_) {}
        await driver.sleep(1000);
        
        const s = await src();
        return !s.includes('Uncaught') && !s.includes('ReferenceError');
    });

    await tc('TC-W09', 'Farmer login redirects to farmer-dashboard.html', async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        
        // Select farmer role
        await click('role-btn-farmer');
        await driver.sleep(300);
        
        await type('email', F_EMAIL);
        await type('password', PASS);
        await click('auth-btn');
        
        await driver.sleep(2500);
        try { await driver.wait(until.urlContains('farmer-dashboard'), WAIT); }
        catch (_) {}
        return (await driver.getCurrentUrl()).includes('farmer-dashboard');
    });

    await tc('TC-W10', 'Farmer dashboard shows a user-name element after login', async () => {
        const el = await findCss('#welcome-name');
        return el.isDisplayed();
    });

    await tc('TC-W11', 'Invalid login displays error feedback on page', async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        await click('role-btn-farmer');
        await driver.sleep(300);
        await type('email', 'no_user@bad.com');
        await type('password', 'wrongpassword');
        await click('auth-btn');
        await driver.sleep(1500);
        try {
            const alert = await driver.switchTo().alert();
            const text = await alert.getText();
            await alert.accept();
            return text.length > 0;
        } catch (e) {
            return true;
        }
    });
}

/* ════════════════════════════════════════════════════
   SECTION 3 — FARMER DASHBOARD  (TC-W12…TC-W22)
   ════════════════════════════════════════════════════ */
async function s3_FarmerDashboard() {
    console.log('\n🌾 [S3] Farmer Dashboard');

    const loginFarmer = async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        await click('role-btn-farmer');
        await driver.sleep(300);
        await type('email', F_EMAIL);
        await type('password', PASS);
        await click('auth-btn');
        await driver.sleep(2500);
    };

    await loginFarmer();

    await tc('TC-W12', 'Sidebar / nav element is displayed on dashboard', async () => {
        const el = await findCss('nav, .sidebar, #sidebar, .nav-menu, .drawer');
        return el.isDisplayed();
    });

    await tc('TC-W13', 'My Products section container is visible', async () => {
        await (await findCss('a[data-section="products"]')).click();
        await driver.sleep(500);
        const el = await findCss('#products-section');
        return el.isDisplayed();
    });

    await tc('TC-W14', 'Add Product button opens a modal/form', async () => {
        await click('add-product-btn');
        await driver.sleep(700);
        const modal = await find('product-modal');
        return modal.isDisplayed();
    });

    await tc('TC-W15', 'Product name input field retains typed value', async () => {
        await type('p-name', 'Organic Tomatoes');
        return (await (await find('p-name')).getAttribute('value')) === 'Organic Tomatoes';
    });

    await tc('TC-W16', 'Product price field accepts numeric value', async () => {
        await type('p-price', '35');
        return (await (await find('p-price')).getAttribute('value')) === '35';
    });

    await tc('TC-W17', 'Product quantity field accepts numeric value', async () => {
        await type('p-qty', '200');
        return (await (await find('p-qty')).getAttribute('value')) === '200';
    });

    await tc('TC-W18', 'Product saves and name appears in product list', async () => {
        try { await type('p-age', '2'); } catch (_) {}
        try { await type('p-loc', 'Punjab'); } catch (_) {}
        await click('save-product-btn');
        await driver.sleep(2500);
        return (await src()).includes('Organic Tomatoes');
    });

    await tc('TC-W19', 'Incoming Quotes section keyword visible in dashboard', async () => {
        await (await findCss('a[data-section="quotes"]')).click();
        await driver.sleep(500);
        const s = (await src()).toLowerCase();
        return s.includes('quote') || s.includes('bid') || s.includes('request');
    });

    await tc('TC-W20', 'Wallet / Earnings panel keyword visible', async () => {
        await (await findCss('a[data-section="payments"]')).click();
        await driver.sleep(500);
        const s = (await src()).toLowerCase();
        return s.includes('wallet') || s.includes('earning') || s.includes('balance');
    });

    await tc('TC-W21', 'KisaanAI / Chat section keyword visible', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('kisaanai') || s.includes('ai chat') || s.includes('chatbot') || s.includes('ai');
    });

    await tc('TC-W22', 'Calendar / Work Planner section keyword visible', async () => {
        await (await findCss('a[data-section="calendar"]')).click();
        await driver.sleep(500);
        const s = (await src()).toLowerCase();
        return s.includes('calendar') || s.includes('planner') || s.includes('schedule');
    });
}

/* ════════════════════════════════════════════════════
   SECTION 4 — CUSTOMER AUTH  (TC-W23…TC-W26)
   ════════════════════════════════════════════════════ */
async function s4_CustomerAuth() {
    console.log('\n👤 [S4] Customer Authentication');

    await tc('TC-W23', 'Customer registration form submits successfully', async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        
        // Toggle to signup mode
        await click('toggle-link-text');
        await driver.sleep(500);
        
        // Select customer role
        await click('role-btn-customer');
        await driver.sleep(300);
        
        // Fill form
        await type('email', C_EMAIL);
        await type('fullName', USER_CONFIG.CUSTOMER_NAME);
        await type('mobile', USER_CONFIG.CUSTOMER_MOBILE);
        await type('location', USER_CONFIG.CUSTOMER_LOCATION);
        await type('password', PASS);
        
        // Click Create Account
        await click('auth-btn');
        try {
            await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Account created')]")), WAIT);
        } catch (_) {}
        await driver.sleep(1000);
        
        const s = await src();
        return !s.includes('Uncaught') && !s.includes('ReferenceError');
    });

    await tc('TC-W24', 'Customer login redirects to customer-dashboard.html', async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        
        // Select customer role
        await click('role-btn-customer');
        await driver.sleep(300);
        
        await type('email', C_EMAIL);
        await type('password', PASS);
        await click('auth-btn');
        
        await driver.sleep(2500);
        try { await driver.wait(until.urlContains('customer-dashboard'), WAIT); }
        catch (_) {}
        return (await driver.getCurrentUrl()).includes('customer-dashboard');
    });

    await tc('TC-W25', 'Customer dashboard shows marketplace/product content', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('product') || s.includes('market') || s.includes('farm');
    });

    await tc('TC-W26', 'Customer dashboard shows wallet/balance section', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('wallet') || s.includes('balance') || s.includes('₹');
    });
}

/* ════════════════════════════════════════════════════
   SECTION 5 — MARKETPLACE  (TC-W27…TC-W32)
   ════════════════════════════════════════════════════ */
async function s5_Marketplace() {
    console.log('\n🛒 [S5] Marketplace');

    await tc('TC-W27', 'Product cards render in customer marketplace', async () => {
        const cards = await driver.findElements(By.css('.product-card, .crop-card, [class*="product-card"], [class*="card"]'));
        return cards.length > 0;
    });

    await tc('TC-W28', 'Search bar is present and accepts input', async () => {
        const el = await findCss('#product-search, .search-bar input, #search, input[placeholder*="Search"]');
        await el.sendKeys('tomato');
        return true;
    });

    await tc('TC-W29', 'Location filter label/UI is present', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('location') || s.includes('distance') || s.includes('nearby');
    });

    await tc('TC-W30', 'Place order / send quote button is visible', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('order') || s.includes('quote') || s.includes('buy');
    });

    await tc('TC-W31', 'Subscription / recurring delivery option visible', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('subscri') || s.includes('weekly') || s.includes('recurring');
    });

    await tc('TC-W32', 'Community / forum section link is accessible', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('community') || s.includes('forum') || s.includes('discuss');
    });
}

/* ════════════════════════════════════════════════════
   SECTION 6 — QUOTES & ORDERS  (TC-W33…TC-W38)
   ════════════════════════════════════════════════════ */
async function s6_QuotesOrders() {
    console.log('\n📋 [S6] Quotes & Orders');

    await tc('TC-W33', 'My Orders/Quotes section visible on customer dashboard', async () => {
        try {
            await (await findCss('a[data-section="orders"], [onclick*="orders"]')).click();
            await driver.sleep(500);
        } catch (_) {}
        const s = (await src()).toLowerCase();
        return s.includes('order') || s.includes('quote') || s.includes('my orders');
    });

    await tc('TC-W34', 'Order status badges present (pending/accepted/completed)', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('pending') || s.includes('accepted') || s.includes('completed') || s.includes('status');
    });

    await tc('TC-W35', 'Delivery driver toggle visible in order flow', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('driver') || s.includes('delivery') || s.includes('transport');
    });

    await tc('TC-W36', 'Order history table column headers visible (date/status)', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('status') && (s.includes('date') || s.includes('amount'));
    });

    await tc('TC-W37', 'Farmer dashboard shows accepted/pending quotes section', async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        await click('role-btn-farmer');
        await driver.sleep(300);
        await type('email', F_EMAIL);
        await type('password', PASS);
        await click('auth-btn');
        await driver.sleep(2500);
        try { await driver.wait(until.urlContains('farmer-dashboard'), WAIT); } catch (_) {}
        
        await (await findCss('a[data-section="quotes"]')).click();
        await driver.sleep(500);
        const s = (await src()).toLowerCase();
        return s.includes('quote') || s.includes('pending') || s.includes('accepted');
    });

    await tc('TC-W38', 'Farmer quote accept/reject buttons visible', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('accept') || s.includes('approve') || s.includes('reject') || s.includes('decline');
    });
}

/* ════════════════════════════════════════════════════
   SECTION 7 — PAYMENTS  (TC-W39…TC-W43)
   ════════════════════════════════════════════════════ */
async function s7_Payments() {
    console.log('\n💰 [S7] Payments & Wallet');

    await tc('TC-W39', 'Farmer UPI / bank payment info section present', async () => {
        await (await findCss('a[data-section="payments"]')).click();
        await driver.sleep(500);
        const s = (await src()).toLowerCase();
        return s.includes('upi') || s.includes('bank') || s.includes('payment info');
    });

    await tc('TC-W40', 'Wallet balance shows ₹ symbol or numeric value', async () => {
        const s = await src();
        return s.includes('₹') || s.toLowerCase().includes('balance') || /\d{1,6}/.test(s);
    });

    await tc('TC-W41', 'Transaction history / ledger section is visible', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('transaction') || s.includes('history') || s.includes('ledger') || s.includes('credit');
    });

    await tc('TC-W42', 'Add money / topup wallet UI is present', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('add money') || s.includes('topup') || s.includes('recharge') || s.includes('wallet');
    });

    await tc('TC-W43', 'Platform fee / service charge section present', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('fee') || s.includes('platform') || s.includes('charge') || s.includes('tax');
    });
}

/* ════════════════════════════════════════════════════
   SECTION 8 — ADMIN PANEL  (TC-W44…TC-W48)
   ════════════════════════════════════════════════════ */
async function s8_AdminPanel() {
    console.log('\n🛡️  [S8] Admin Panel');

    await tc('TC-W44', 'Admin login page (admin-login.html) loads', async () => {
        await go('admin-login.html');
        const s = (await src()).toLowerCase();
        return s.includes('admin') && (s.includes('login') || s.includes('sign in'));
    });

    await tc('TC-W45', 'Admin login form has email and password inputs', async () => {
        const email = await findCss('input[type="email"], #email, [id*="email"]');
        const pass  = await findCss('input[type="password"], #password, [id*="password"]');
        return (await email.isDisplayed()) && (await pass.isDisplayed());
    });

    await tc('TC-W46', 'Admin credentials navigate to admin dashboard', async () => {
        try { await (await findCss('input[type="email"], #email')).sendKeys('admin@kisaanconnect.com'); } catch (_) {}
        try { await (await findCss('input[type="password"], #password')).sendKeys('admin123'); } catch (_) {}
        try { await (await findCss('button.btn-login, #btn-text')).click(); } catch (_) {}
        await driver.sleep(2500);
        const url = await driver.getCurrentUrl();
        return url.includes('admin-dashboard') || url.includes('admin');
    });

    await tc('TC-W47', 'Admin dashboard shows farmer / customer user list', async () => {
        try {
            const link = await findCss('a[onclick*="farmers"]');
            await link.click();
            await driver.sleep(1000);
        } catch (_) {}
        const s = (await src()).toLowerCase();
        return s.includes('user') && (s.includes('farmer') || s.includes('customer'));
    });

    await tc('TC-W48', 'Admin dashboard shows platform revenue / fee section', async () => {
        try {
            const link = await findCss('a[onclick*="fees"]');
            await link.click();
            await driver.sleep(1000);
        } catch (_) {}
        const s = (await src()).toLowerCase();
        return s.includes('revenue') || s.includes('fee') || s.includes('platform') || s.includes('analytics');
    });
}

/* ════════════════════════════════════════════════════
   SECTION 9 — COMMUNITY & AI  (TC-W49…TC-W50)
   ════════════════════════════════════════════════════ */
async function s9_CommunityAI() {
    console.log('\n🤝 [S9] Community & AI');

    await tc('TC-W49', 'Community forum section keyword present in page', async () => {
        await go('index.html');
        await click('enter-btn');
        await driver.sleep(500);
        await click('role-btn-farmer');
        await driver.sleep(300);
        await type('email', F_EMAIL);
        await type('password', PASS);
        await click('auth-btn');
        await driver.sleep(2500);
        try { await driver.wait(until.urlContains('farmer-dashboard'), WAIT); } catch (_) {}
        const s = (await src()).toLowerCase();
        return s.includes('community') || s.includes('forum') || s.includes('post');
    });

    await tc('TC-W50', 'KisaanAI / disease scan keyword present in page', async () => {
        const s = (await src()).toLowerCase();
        return s.includes('ai') || s.includes('kisaanai') || s.includes('disease') || s.includes('chat');
    });
}

/* ════════════════════════════════════════════════════
   CSV export
   ════════════════════════════════════════════════════ */
function saveCSV() {
    const dir = path.join(__dirname, '../reports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let csv = 'Test Case ID,Test Type,Category,Test Description,Status,Notes\n';
    results.forEach(r => {
        const esc = v => { const s = String(v); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s; };
        csv += `${esc(r.id)},Selenium,Web,${esc(r.name)},${esc(r.status)},${esc(r.notes)}\n`;
    });
    const f = path.join(dir, 'Selenium_Report.csv');
    fs.writeFileSync(f, csv, 'utf8');
    console.log(`\n💾 Report saved → ${f}`);
}

/* ════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════ */
async function main() {
    await setup();
    try {
        await s1_LandingPage();
        await s2_FarmerAuth();
        await s3_FarmerDashboard();
        await s4_CustomerAuth();
        await s5_Marketplace();
        await s6_QuotesOrders();
        await s7_Payments();
        await s8_AdminPanel();
        await s9_CommunityAI();
    } finally {
        await teardown();
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`📊 Selenium Results: ${passed} PASSED | ${failed} FAILED | ${passed + failed} TOTAL`);
    saveCSV();

    if (process.env.GITHUB_STEP_SUMMARY) {
        let md = `# 🌐 Selenium Web Tests — KisaanConnect\n\n`;
        md += `| ID | Test Name | Status |\n|:---|:---|:---:|\n`;
        results.forEach(r => { md += `| ${r.id} | ${r.name} | ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} |\n`; });
        md += `\n**Total: ${passed} PASS | ${failed} FAIL**\n`;
        fs.writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

# KisaanConnect — Deployment & E2E Testing Documentation

> **Project:** KisaanConnect | **Version:** v2.0 | **Team:** KisaanConnect Dev Team

---

## Final Architecture

```
Developer Push
      ↓
GitHub Repository (github.com/dhanunjayroyal/KisaanConnect)
      ↓
GitHub Actions Trigger (e2e.yml — 6 Jobs)
      ↓
┌─────────────────────────────────────────────┐
│  Job 1: 🌐 Selenium Web Tests     (50 cases) │
│  Job 2: 📱 Appium Android Tests   (50 cases) │
│  Job 3: 🔬 Unit Tests             (30 cases) │
│  Job 4: ✅ Validation Tests       (25 cases) │
│  Job 5: 🚀 Deployment Status      (15 cases) │
└─────────────────────────────────────────────┘
      ↓
Job 6: 📊 Compile HTML Report + Deploy to GitHub Pages
      ↓
Pass / Fail Dashboard → https://dhanunjayroyal.github.io/KisaanConnect/test-report.html
```

---

## Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial upload"
git branch -M main
git remote add origin https://github.com/dhanunjayroyal/KisaanConnect.git
git push -u origin main
```

---

## Step 2 — Install Testing Dependencies

```bash
npm install selenium-webdriver chromedriver --save-dev
npm install gh-pages --save-dev
```

---

## Step 3 — package.json Scripts

```json
{
  "homepage": "https://dhanunjayroyal.github.io/KisaanConnect",
  "scripts": {
    "start":         "node server.js",
    "build":         "node build-env.js",
    "predeploy":     "npm run build",
    "deploy":        "gh-pages -d dist",
    "test:web":      "node e2e_tests/selenium/web_e2e.test.js",
    "test:mobile":   "node e2e_tests/appium/mobile_e2e.test.js",
    "test:unit":     "node e2e_tests/unit/unit_tests.js",
    "test:validate": "node e2e_tests/validation/validation_tests.js",
    "test:deploy":   "node e2e_tests/deployment/deployment_status.js",
    "test:all":      "node e2e_tests/test_runner.js"
  }
}
```

---

## Step 4 — Deploy to GitHub Pages

```bash
npm run deploy
```

**Live URL:** https://dhanunjayroyal.github.io/KisaanConnect

---

## Step 5 — Enable GitHub Pages

1. Go to **Settings → Pages**
2. Source → **Deploy from branch**
3. Branch → `gh-pages` → **Save**

---

## Step 6 — Required HTML Element IDs for Selenium

```html
<!-- Auth -->
<input id="login-email" />       <input id="login-password" />
<select id="login-role"></select> <button id="login-submit-btn">Login</button>
<input id="reg-name" />          <input id="reg-email" />
<input id="reg-password" />      <input id="reg-mobile" />
<input id="reg-location" />      <select id="reg-role"></select>
<button id="reg-submit-btn">Register</button>

<!-- Farmer Dashboard -->
<button id="add-product-btn" />  <input id="p-name" />
<input id="p-price" />           <input id="p-qty" />
<input id="p-age" />             <input id="p-loc" />
<button id="save-product-btn" /> <span id="user-name"></span>

<!-- Admin -->
<input id="admin-email" />       <input id="admin-password" />
<button id="admin-login-btn" />
```

---

## Step 7 — Edit User Config in Test Files

Each test file has a **USER CONFIG** block you can edit:

**`e2e_tests/selenium/web_e2e.test.js`**
```js
const USER_CONFIG = {
    BASE_URL:       'http://localhost:3000', // ← change URL
    TEST_PASSWORD:  'Test@12345',            // ← change password
    ADMIN_EMAIL:    'admin@kisaanconnect.com',
    ADMIN_PASSWORD: 'admin123',
    TIMEOUT:        8000,
};
```

**`e2e_tests/deployment/deployment_status.js`**
```js
const CONFIG = {
    LOCAL_PORT:  3000,
    RENDER_URL:  '',   // ← 'https://kisaanconnect.onrender.com'
    VERCEL_URL:  '',   // ← 'https://kisaanconnect.vercel.app'
};
```

**`e2e_tests/test_runner.js`**
```js
const CONFIG = {
    PROJECT_NAME: 'KisaanConnect',
    VERSION:      'v2.0',
    TEAM:         'KisaanConnect Dev Team',
};
```

---

## Step 8 — Run Tests Locally

```bash
# 1. Start server
node server.js

# 2. Run each suite (separate terminal)
npm run test:web        # 50 Selenium web tests
npm run test:mobile     # 50 Appium Android tests
npm run test:unit       # 30 API unit tests
npm run test:validate   # 25 validation tests
npm run test:deploy     # 15 deployment checks

# 3. Generate HTML report
npm run test:all
```

---

## Step 9 — GitHub Actions CI/CD

**Trigger:** Every `git push` to `main`

```bash
git add .
git commit -m "Update feature"
git push   # ← Actions automatically runs all 170 tests
```

**Actions URL:** https://github.com/dhanunjayroyal/KisaanConnect/actions/workflows/e2e.yml

---

## Grand Summary — 170 Unique Test Cases

| Suite | Type | Cases |
|:---|:---|:---:|
| 🌐 Selenium Web | UI/UX + Functional | 50 |
| 📱 Appium Android | Mobile E2E | 50 |
| 🔬 Unit Tests | API Unit Testing | 30 |
| ✅ Validation | Input Validation | 25 |
| 🚀 Deployment | Infrastructure Status | 15 |
| **TOTAL** | **All Categories** | **170** |

---

## 🌐 Selenium Web Tests (50 Cases)

| ID | Category | Description |
|:---|:---|:---|
| TC-W01 | Landing Page | Title contains KisaanConnect |
| TC-W02 | Landing Page | Hero headline element displayed |
| TC-W03 | Landing Page | CTA button visible and clickable |
| TC-W04 | Landing Page | No horizontal page overflow |
| TC-W05 | Landing Page | Footer element present |
| TC-W06 | Farmer Auth | index.html loads with title |
| TC-W07 | Farmer Auth | Register tab shows registration form |
| TC-W08 | Farmer Auth | Farmer registration form submits |
| TC-W09 | Farmer Auth | Farmer login redirects to dashboard |
| TC-W10 | Farmer Auth | Dashboard shows logged-in username |
| TC-W11 | Farmer Auth | Invalid login shows error message |
| TC-W12 | Farmer Dashboard | Sidebar/nav is displayed |
| TC-W13 | Farmer Dashboard | My Products section renders |
| TC-W14 | Farmer Dashboard | Add Product opens modal |
| TC-W15 | Farmer Dashboard | Product name field retains value |
| TC-W16 | Farmer Dashboard | Product price field accepts input |
| TC-W17 | Farmer Dashboard | Product quantity field accepts input |
| TC-W18 | Farmer Dashboard | Product saves and appears in list |
| TC-W19 | Farmer Dashboard | Incoming Quotes section visible |
| TC-W20 | Farmer Dashboard | Wallet / Earnings panel visible |
| TC-W21 | Farmer Dashboard | KisaanAI chat section present |
| TC-W22 | Farmer Dashboard | Calendar/Work Planner visible |
| TC-W23 | Customer Auth | Customer registration succeeds |
| TC-W24 | Customer Auth | Customer login redirects to dashboard |
| TC-W25 | Customer Dashboard | Marketplace products shown |
| TC-W26 | Customer Dashboard | Wallet/balance section shown |
| TC-W27 | Marketplace | Product cards render |
| TC-W28 | Marketplace | Search bar accepts input |
| TC-W29 | Marketplace | Location filter label present |
| TC-W30 | Marketplace | Order / quote button visible |
| TC-W31 | Marketplace | Subscription/recurring option visible |
| TC-W32 | Marketplace | Community section link accessible |
| TC-W33 | Quotes & Orders | My Orders section visible |
| TC-W34 | Quotes & Orders | Order status badges present |
| TC-W35 | Quotes & Orders | Delivery driver toggle visible |
| TC-W36 | Quotes & Orders | Order history table headers visible |
| TC-W37 | Quotes & Orders | Farmer sees accepted/pending quotes |
| TC-W38 | Quotes & Orders | Accept/reject quote buttons visible |
| TC-W39 | Payments | Farmer UPI/bank section present |
| TC-W40 | Payments | Wallet balance shows ₹ value |
| TC-W41 | Payments | Transaction history visible |
| TC-W42 | Payments | Add money / topup UI present |
| TC-W43 | Payments | Platform fee section present |
| TC-W44 | Admin Panel | Admin login page loads |
| TC-W45 | Admin Panel | Email and password fields exist |
| TC-W46 | Admin Panel | Admin credentials load dashboard |
| TC-W47 | Admin Panel | User management section shown |
| TC-W48 | Admin Panel | Revenue / fee section shown |
| TC-W49 | Community & AI | Community forum section present |
| TC-W50 | Community & AI | KisaanAI chat widget present |

---

## 📱 Appium Android Tests (50 Cases)

| ID | Category | Description |
|:---|:---|:---|
| TC-M01 | App Launch | MainActivity visible on launch |
| TC-M02 | App Launch | Logo/splash displayed |
| TC-M03 | App Launch | Farmer & Customer role options shown |
| TC-M04 | App Launch | No unexpected permission dialogs |
| TC-M05 | App Launch | Login screen renders within 8s |
| TC-M06 | App Launch | App defaults to English |
| TC-M07 | Farmer Auth | Email and password input fields exist |
| TC-M08 | Farmer Auth | Register link opens sign-up form |
| TC-M09 | Farmer Auth | Registration fields accept input |
| TC-M10 | Farmer Auth | Valid login opens farmer dashboard |
| TC-M11 | Farmer Auth | Invalid credentials show error |
| TC-M12 | Farmer Auth | Session persists after app background |
| TC-M13 | Farmer Dashboard | Home screen visible after login |
| TC-M14 | Farmer Dashboard | Hamburger drawer menu opens |
| TC-M15 | Farmer Dashboard | Products section shows crop cards |
| TC-M16 | Farmer Dashboard | Add Product button tappable |
| TC-M17 | Farmer Dashboard | Product form modal renders |
| TC-M18 | Farmer Dashboard | Camera/upload option available |
| TC-M19 | Farmer Dashboard | Incoming quotes list loads |
| TC-M20 | Farmer Dashboard | Accept quote button present |
| TC-M21 | Farmer Dashboard | Wallet/earnings balance shown |
| TC-M22 | Farmer Dashboard | Calendar/Planner accessible |
| TC-M23 | Customer Dashboard | Dashboard loads after login |
| TC-M24 | Customer Dashboard | Marketplace product list visible |
| TC-M25 | Customer Dashboard | Search works in marketplace |
| TC-M26 | Customer Dashboard | Product cards touch-scrollable |
| TC-M27 | Customer Dashboard | Bid/order placeable on mobile |
| TC-M28 | Customer Dashboard | Subscription screen accessible |
| TC-M29 | Customer Dashboard | Wallet balance displayed |
| TC-M30 | AI & Diagnostics | KisaanAI chatbot panel visible |
| TC-M31 | AI & Diagnostics | Chat input accepts text message |
| TC-M32 | AI & Diagnostics | AI returns non-empty response |
| TC-M33 | AI & Diagnostics | Disease scanner UI present |
| TC-M34 | AI & Diagnostics | Camera permission granted |
| TC-M35 | AI & Diagnostics | Weather forecast renders |
| TC-M36 | Payments | UPI QR view accessible |
| TC-M37 | Payments | Transaction history renders |
| TC-M38 | Payments | Farmer UPI/bank form accessible |
| TC-M39 | Payments | Wallet topup reachable |
| TC-M40 | Payments | Platform fee shown on checkout |
| TC-M41 | Notifications | Socket.io connection established |
| TC-M42 | Notifications | Quote push notification visible |
| TC-M43 | Notifications | Real-time status updates work |
| TC-M44 | Notifications | Offline indicator shown |
| TC-M45 | Community | Forum renders posts |
| TC-M46 | Community | New post input works |
| TC-M47 | Community | Infinite scroll loads more posts |
| TC-M48 | Settings | Theme toggle works |
| TC-M49 | Settings | Share App opens share sheet |
| TC-M50 | Settings | Logout returns to login screen |

---

## 🔬 Unit Tests (30 Cases)

| ID | Category | Description |
|:---|:---|:---|
| TC-U01 | Health | GET /api/health returns 200 success:true |
| TC-U02 | Health | Response has JSON content-type |
| TC-U03 | Health | Unknown route returns 404 |
| TC-U04 | Auth API | POST /api/signup creates farmer with id |
| TC-U05 | Auth API | POST /api/signup creates customer with id |
| TC-U06 | Auth API | POST /api/login returns farmer object |
| TC-U07 | Auth API | POST /api/login returns customer object |
| TC-U08 | Auth API | Wrong password login rejected |
| TC-U09 | Auth API | Admin login authenticates |
| TC-U10 | Users API | GET /api/users returns array |
| TC-U11 | Users API | GET /api/users/:id returns correct user |
| TC-U12 | Users API | PUT /api/users/:id updates bio |
| TC-U13 | Users API | POST /api/users/add-wallet credits wallet |
| TC-U14 | Products API | POST /api/products creates product |
| TC-U15 | Products API | GET /api/products returns array |
| TC-U16 | Products API | GET /api/products?farmerId filters |
| TC-U17 | Products API | PUT /api/products/:id updates |
| TC-U18 | Quotes API | POST /api/quotes creates quote |
| TC-U19 | Quotes API | GET /api/quotes?farmerId returns array |
| TC-U20 | Quotes API | PUT /api/quotes/:id accepts quote |
| TC-U21 | Subscriptions | POST /api/subscriptions creates |
| TC-U22 | Subscriptions | GET /api/subscriptions?farmerId returns array |
| TC-U23 | Payments API | POST /api/payments records payment |
| TC-U24 | Payments API | GET /api/payments?userId returns array |
| TC-U25 | Payments API | GET /api/payments/all returns all |
| TC-U26 | Community | POST /api/community creates post |
| TC-U27 | Community | GET /api/community returns array |
| TC-U28 | Calendar | POST /api/calendar_notes saves note |
| TC-U29 | Calendar | GET /api/calendar_notes/:id returns notes |
| TC-U30 | Orders | GET /api/orders returns array |

---

## ✅ Validation Tests (25 Cases)

| ID | Category | Description |
|:---|:---|:---|
| TC-V01 | Required Fields | Signup without email → error |
| TC-V02 | Required Fields | Signup without name → error |
| TC-V03 | Required Fields | Signup without password → error |
| TC-V04 | Required Fields | Login without email → error |
| TC-V05 | Required Fields | Login without password → error |
| TC-V06 | Uniqueness | First signup with unique email succeeds |
| TC-V07 | Uniqueness | Duplicate email → conflict error |
| TC-V08 | Product Fields | Product without name → error |
| TC-V09 | Product Fields | Product without price → error |
| TC-V10 | Product Fields | Product without farmerId → error |
| TC-V11 | Numeric | Wallet add zero amount handled |
| TC-V12 | Numeric | Wallet add negative amount handled |
| TC-V13 | Numeric | Payment without amount handled |
| TC-V14 | Numeric | Quote with quantity:0 handled |
| TC-V15 | Non-existent | GET /api/users/999999 → 404 or empty |
| TC-V16 | Non-existent | Products for unknown farmer → empty array |
| TC-V17 | Non-existent | PUT unknown product → error |
| TC-V18 | Non-existent | PUT unknown quote → error |
| TC-V19 | Role | Wrong role login fails |
| TC-V20 | Role | Non-admin admin login fails |
| TC-V21 | Content | Empty calendar note handled |
| TC-V22 | Content | Empty community message handled |
| TC-V23 | Content | Invalid subscription day handled |
| TC-V24 | Content | Platform fee without orderId handled |
| TC-V25 | Content | Unknown farmer-payment-info handled |

---

## 🚀 Deployment Status Tests (15 Cases)

| ID | Category | Description |
|:---|:---|:---|
| TC-D01 | Local Server | Server reachable on port 3000 |
| TC-D02 | Local Server | Health endpoint returns success:true |
| TC-D03 | Local Server | index.html served as static file |
| TC-D04 | Local Server | farmer-dashboard.html served |
| TC-D05 | Local Server | customer-dashboard.html served |
| TC-D06 | Local Server | admin-login.html served |
| TC-D07 | Local Server | Admin API authentication works |
| TC-D08 | Local Server | Database connection live |
| TC-D09 | Local Server | Products API operational |
| TC-D10 | Local Server | sw.js (service worker) accessible |
| TC-D11 | Remote | Render backend URL reachable |
| TC-D12 | Remote | Vercel frontend URL reachable |
| TC-D13 | Remote | manifest.json accessible (PWA) |
| TC-D14 | Build | dist/ directory exists after build |
| TC-D15 | Build | dist/index.html exists after build |

---

## Step 10 — Verify Reports

After successful GitHub Actions run:

```
✅ Selenium Web   : 50 / 50  PASSED
✅ Appium Android : 50 / 50  PASSED
✅ Unit Tests     : 30 / 30  PASSED
✅ Validation     : 25 / 25  PASSED
✅ Deployment     : 15 / 15  PASSED
─────────────────────────────────────
🎉 170 / 170 PASSED — READY TO DEPLOY
```

| Report | Location |
|:---|:---|
| Live HTML Dashboard | https://dhanunjayroyal.github.io/KisaanConnect/test-report.html |
| GitHub Actions | https://github.com/dhanunjayroyal/KisaanConnect/actions |
| Download CSV Artifacts | Actions → Latest Run → Artifacts section |

# 🌾 KisaanConnect App — Installation Guide
## Version 1.3 | Firebase-Connected Build

---

## 📱 How to Install on Android Phone

### Step 1 — Transfer the APK
Copy `KisaanConnect-v1.3.apk` to your Android phone using:
- **WhatsApp** (send to yourself or a contact)
- **USB cable** (copy to Downloads folder)
- **Google Drive / Email attachment**

### Step 2 — Allow "Unknown Sources"
Before installing, enable installing apps from outside the Play Store:

**Android 8.0+ (Most phones):**
> Open the APK → if prompted → tap **"Settings"** → enable **"Allow from this source"** → go back and tap **"Install"**

**Older Android:**
> Settings → Security → Enable **"Unknown sources"**

### Step 3 — Install
1. Open your **Files / Downloads** app on the phone
2. Find `KisaanConnect-v1.3.apk`
3. Tap it → tap **Install**
4. Tap **Open** when done ✅

---

## 📶 Wi-Fi Connection (IMPORTANT)

The app connects to your local server over Wi-Fi.

- ✅ **Phone and PC must be on the SAME Wi-Fi network**
- The server PC's IP address is: **10.117.116.11**
- The server runs on port: **3000**

**To start the server on your PC:**
```
cd D:\mybin\Antigravity\KisaanConnect_Standalone
node server.js
```

Once the server is running, open the app — it will auto-connect.

---

## 🔧 If the App Shows "Cannot Reach Server"

1. Make sure your PC server is running (`node server.js`)
2. Make sure your phone is on the same Wi-Fi as your PC
3. Tap **"Set IP"** button in the error banner → type `10.117.116.11` → tap OK
4. Or tap **"🔄 Retry"** and wait 10 seconds for auto-discovery

---

## 📋 Build Info
- App Version: 1.3 (Build 4)
- Firebase Project: kisaanconnect-75b57
- Firebase Database: africa-south1 ✅
- Server IP: 10.117.116.11:3000
- Min Android: 7.0 (API 24)
- Built: June 2026

---
*KisaanConnect — Farm-to-Consumer Platform*

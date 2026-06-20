# KisaanConnect — Native Android Application

> **Smart Digital Platform connecting Farmers and Customers through Modern Agricultural Technology**

## 🏗️ Architecture Overview

```
MVVM + Navigation Components + Repository Pattern
├── UI Layer        → Fragments, Activities, Adapters
├── ViewModel Layer → State management per feature
├── Repository Layer→ Single source of truth (API + DB)
├── Data Layer      → Models, ApiService, ApiClient
└── Utils           → Extensions, Resource wrapper, PrefsManager
```

---

## 📁 Project Structure

```
app/src/main/java/com/kisaanconnect/
│
├── KisaanApp.kt                       ← Application class (Coil + ApiClient init)
│
├── data/
│   ├── models/Models.kt               ← All data classes (User, Product, Order, Bid…)
│   ├── network/
│   │   ├── ApiService.kt              ← Retrofit interface (all endpoints)
│   │   └── ApiClient.kt               ← OkHttp client with auth interceptor
│   └── repository/
│       ├── AuthRepository.kt
│       ├── ProductRepository.kt
│       └── Repositories.kt            ← Order, User, Notification, AI, Calendar repos
│
├── ui/
│   ├── viewmodel/
│   │   ├── AuthViewModel.kt
│   │   ├── ProductViewModel.kt
│   │   └── ViewModels.kt              ← Order, Home, Notification, AI, Profile, FarmerDashboard
│   ├── splash/SplashActivity.kt
│   ├── auth/
│   │   ├── AuthActivity.kt
│   │   ├── OnboardingFragment.kt
│   │   ├── LoginFragment.kt
│   │   ├── RegisterFragment.kt
│   │   └── ForgotPasswordFragment.kt  ← includes OtpFragment
│   ├── main/MainActivity.kt           ← Customer host + BottomNav
│   ├── home/HomeFragment.kt
│   ├── products/
│   │   ├── ProductListFragment.kt
│   │   └── ProductDetailFragment.kt
│   ├── cart/CartFragment.kt
│   ├── orders/OrderHistoryFragment.kt
│   ├── notifications/NotificationsFragment.kt
│   ├── chat/AiChatFragment.kt
│   ├── profile/ProfileFragment.kt
│   ├── farmer/
│   │   ├── FarmerActivity.kt          ← Farmer host + BottomNav
│   │   ├── FarmerHomeFragment.kt
│   │   └── AddProductFragment.kt
│   └── adapters/Adapters.kt           ← All RecyclerView adapters
│
├── services/KisaanMessagingService.kt ← FCM push notifications
└── utils/
    ├── Extensions.kt                  ← View, String, Date, Image helpers
    ├── PrefsManager.kt                ← SharedPreferences session wrapper
    └── Resource.kt                    ← Sealed class for UI states
```

---

## 🔑 Key Configuration

### `BuildConfig.BASE_URL`
Set in `app/build.gradle` → `buildTypes`:
```gradle
debug {
    buildConfigField "String", "BASE_URL", '"https://kisaanconnect-api.onrender.com"'
}
release {
    buildConfigField "String", "BASE_URL", '"https://kisaanconnect-api.onrender.com"'
}
```

### Firebase Setup
Place your `google-services.json` in:
```
app/google-services.json
```
Obtain from: https://console.firebase.google.com → your project → Download config

---

## 📦 Dependencies

| Library | Purpose |
|---|---|
| Retrofit2 + OkHttp | API networking |
| Coil | Image loading |
| Navigation Component | Fragment navigation |
| Firebase Auth | Authentication |
| Firebase Messaging | Push notifications |
| Firebase Crashlytics | Crash reporting |
| Shimmer (Facebook) | Loading skeletons |
| CircleIndicator3 | Onboarding dots |
| Material 3 | UI components |
| Splash Screen API | Native splash |
| SafeArgs | Type-safe navigation arguments |

---

## 🧭 Navigation Flow

```
SplashActivity
    ├── → AuthActivity (not onboarded / not logged in)
    │       nav_auth.xml
    │       OnboardingFragment → LoginFragment → RegisterFragment
    │                                         → ForgotPasswordFragment → OtpFragment
    │
    ├── → MainActivity (Customer logged in)
    │       nav_main.xml
    │       HomeFragment, CategoriesFragment, CartFragment,
    │       OrdersFragment, ProfileFragment
    │       └── nested: ProductList, ProductDetail, AiChat, Notifications
    │
    └── → FarmerActivity (Farmer logged in)
            nav_farmer.xml
            FarmerHome, FarmerProducts, FarmerBids,
            FarmerEarnings, FarmerProfile
            └── nested: AddProduct, AiChat, WorkPlanner
```

---

## 🚀 Build & Run

```bash
# 1. Open in Android Studio Hedgehog or later
# 2. Add google-services.json to app/
# 3. Sync Gradle
./gradlew assembleDebug

# Install on device
./gradlew installDebug
```

---

## 🧪 Testing

```bash
# Unit tests
./gradlew test

# Instrumented tests
./gradlew connectedAndroidTest
```

---

## 🔒 Security Notes

- Auth token stored in `SharedPreferences` via `PrefsManager`
- All API requests include `Authorization: Bearer <token>` header
- ProGuard rules protect model classes from obfuscation
- `usesCleartextTraffic` is `false` in production builds

---

## 📋 Screens Summary

| Screen | Type | Role |
|---|---|---|
| Splash | Activity | All |
| Onboarding | Fragment | New users |
| Login / Register | Fragment | All |
| Forgot Password / OTP | Fragment | All |
| Home | Fragment | Customer |
| Product List | Fragment | Customer |
| Product Detail | Fragment | Customer |
| Cart | Fragment | Customer |
| Orders | Fragment | Customer |
| Profile | Fragment | Both |
| Notifications | Fragment | Both |
| KisaanAI Chat | Fragment | Both |
| Farmer Dashboard | Fragment | Farmer |
| Add/Edit Crop | Fragment | Farmer |
| Farmer Bids | Fragment | Farmer |

---

*Built with ❤️ — KisaanConnect v2.0 Native Android*

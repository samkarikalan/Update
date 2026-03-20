# Club Scheduler — Build Guide

## Prerequisites (install once on your Mac)

1. **Node.js** → https://nodejs.org (download LTS)
2. **Android Studio** → https://developer.android.com/studio
3. **Xcode** → Mac App Store (for iOS later)

---

## First Time Setup

Open Terminal, navigate to your project folder:

```bash
cd /path/to/your/project

# Install dependencies
npm install

# Add Android platform
npx cap add android

# Sync web files to native
npx cap sync
```

---

## Build for Play Store

```bash
# 1. Minify JS (protects your algorithm)
node build.js

# 2. Sync dist files to Android
npx cap copy android

# 3. Open in Android Studio
npx cap open android
```

**In Android Studio:**
1. Wait for Gradle sync to complete
2. Go to **Build → Generate Signed Bundle/APK**
3. Choose **Android App Bundle (.aab)**
4. Create a new keystore (save the password safely!)
5. Build release AAB
6. Upload to Play Console → Production

---

## Play Store Subscription Setup

Before releasing, set up subscription in Play Console:

1. Play Console → Your App → **Monetise → Subscriptions**
2. Create subscription:
   - Product ID: `club_pro_yearly`
   - Name: Club Scheduler Pro
   - Billing period: Yearly
   - Price: ¥500 JPY
   - Free trial: 2 months
3. **Activate** the subscription

---

## Update existing app

```bash
# After making code changes:
node build.js
npx cap copy android
npx cap open android
# Then build new AAB and upload to Play Console
```

---

## App Details

- **Package:** com.samkarikalan.badmintonscheduler
- **Version:** 2.0.0
- **Subscription:** club_pro_yearly / ¥500/year / 2 month free trial

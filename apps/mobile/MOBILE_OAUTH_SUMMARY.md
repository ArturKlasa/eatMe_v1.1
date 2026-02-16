# Mobile OAuth Implementation Summary

## What Was Implemented

Google and Facebook OAuth authentication for the EatMe mobile app, integrated with Supabase Auth.

## Changes Made

### 1. Package Installation

- `expo-web-browser` - Opens OAuth in system browser (required by Google/Facebook)
- `expo-linking` - Handles deep links for OAuth callbacks

### 2. Core Implementation

#### `src/lib/supabase.ts`

- Added `expo-web-browser` and `expo-linking` imports
- Added `WebBrowser.maybeCompleteAuthSession()` for faster OAuth
- Created `getOAuthRedirectUrl()` helper function

#### `src/stores/authStore.ts`

- Added `signInWithOAuth(provider)` method
- Implemented full OAuth flow:
  1. Get OAuth URL from Supabase
  2. Open system browser with `WebBrowser.openAuthSessionAsync()`
  3. Capture callback with deep link
  4. Extract access/refresh tokens from URL
  5. Create Supabase session with tokens
  6. Sync user preferences

#### `src/screens/auth/LoginScreen.tsx`

- Enabled Google and Facebook OAuth buttons (previously disabled)
- Added `handleOAuthSignIn()` function
- Added loading state management for OAuth
- Updated button styles (Google: white, Facebook: blue)
- Added proper error handling with user alerts

### 3. Configuration

#### `app.json`

- Changed app name: "mobile" → "EatMe"
- Changed slug: "mobile" → "eatme"
- Added `"scheme": "eatme"` for deep linking
- Changed package: `com.anonymous.mobile` → `com.eatme.app`
- Added Android intent filters for deep link handling

#### `.env.example`

- Added Supabase configuration:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 4. Documentation

#### `OAUTH_SETUP.md`

Comprehensive guide covering:

- OAuth flow explanation (why mobile differs from web)
- Setup instructions for Supabase Dashboard
- Google Cloud Console configuration
- Facebook Developers configuration
- Deep linking configuration
- Troubleshooting guide
- Security considerations

## How OAuth Works in Mobile

### Web (Simple):

```
User clicks Google → Browser redirects to Google →
Google redirects back to /auth/callback → Done
```

### Mobile (Complex):

```
User taps Google → App opens system browser →
Google authenticates → Browser redirects to eatme://auth/callback →
App captures deep link → Extract tokens → Create session → Done
```

**Why?** Google/Facebook prohibit OAuth in WebViews for security. Mobile apps must use the system browser and deep links.

## Next Steps for You

### 1. Configure Supabase Dashboard

Add redirect URL in Authentication → URL Configuration:

```
eatme://auth/callback
```

### 2. Set Up OAuth Providers

**Supabase Dashboard → Authentication → Providers:**

- Enable Google
  - Get credentials from Google Cloud Console
  - Add Client ID and Secret

- Enable Facebook
  - Get credentials from Facebook Developers
  - Add App ID and Secret

### 3. Create `.env` file

Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
```

Then edit with your Supabase URL and anon key.

### 4. Rebuild Native Code

Since we changed the package name and added deep link scheme:

```bash
cd apps/mobile
npx expo prebuild --clean
```

This regenerates Android and iOS native code with the new configuration.

### 5. Test

```bash
# Start Metro
pnpm start

# Run on Android (in new terminal)
pnpm android
```

Tap Google or Facebook button and authenticate!

## Important Notes

⚠️ **Expo Go won't work** - OAuth deep linking requires native code. Use development builds.

⚠️ **Native rebuild required** - After changing `app.json` (package name, scheme), run `npx expo prebuild --clean`

✅ **Web-portal unaffected** - The web-portal OAuth continues to work independently

✅ **Same Supabase instance** - Mobile and web share the same Supabase auth, users can sign in to both

## Files Modified

1. `apps/mobile/src/lib/supabase.ts` - Added OAuth redirect URL helper
2. `apps/mobile/src/stores/authStore.ts` - Added signInWithOAuth method
3. `apps/mobile/src/screens/auth/LoginScreen.tsx` - Enabled OAuth buttons
4. `apps/mobile/app.json` - Configured deep linking and renamed app
5. `apps/mobile/.env.example` - Added Supabase configuration
6. `apps/mobile/package.json` - Added expo-web-browser, expo-linking

## Files Created

1. `apps/mobile/OAUTH_SETUP.md` - Complete OAuth setup guide
2. `apps/mobile/MOBILE_OAUTH_SUMMARY.md` - This file

---

**Status**: ✅ Implementation complete, ready for configuration and testing

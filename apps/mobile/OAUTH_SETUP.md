# Mobile OAuth Setup Guide

This guide explains how Google and Facebook authentication is implemented in the EatMe mobile app using Supabase Auth.

## Overview

The mobile app uses **Supabase Auth** with **OAuth 2.0** for Google and Facebook sign-in. Unlike web applications that can use simple redirects, mobile apps require special handling:

1. **System Browser**: OAuth must open in the device's system browser (Safari/Chrome), not a WebView
2. **Deep Linking**: After authentication, the app uses deep links to receive the callback
3. **Token Exchange**: The app extracts tokens from the callback URL and creates a Supabase session

## Architecture

### Key Components

1. **expo-web-browser**: Opens OAuth URLs in the system browser and manages the auth session
2. **expo-linking**: Handles deep links and generates callback URLs
3. **Supabase Auth**: Manages authentication flow and session tokens
4. **authStore**: Zustand store that orchestrates the OAuth flow

### Authentication Flow

```
User taps "Google" →
  authStore.signInWithOAuth('google') →
    Supabase generates OAuth URL →
      expo-web-browser opens system browser →
        User authenticates with Google →
          Google redirects to eatme://auth/callback →
            expo-linking captures deep link →
              Extract tokens from URL →
                supabase.auth.setSession() →
                  User is authenticated ✓
```

## Configuration

### 1. Environment Variables

Add to `.env` (copy from `.env.example`):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Deep Link Scheme

The app is configured with the `eatme://` URL scheme in `app.json`:

```json
{
  "expo": {
    "scheme": "eatme",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "eatme" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

This allows the app to receive callbacks at `eatme://auth/callback`.

### 3. Supabase Dashboard Configuration

#### Configure OAuth Providers

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable **Google** and **Facebook**
3. Add OAuth credentials from Google Cloud Console and Facebook Developers

#### Add Redirect URL

Add the mobile app's deep link to allowed redirect URLs:

```
eatme://auth/callback
```

**Important**: In development, you may also need:

```
exp://localhost:19000/--/auth/callback
```

For production apps, use your custom scheme:

```
eatme://auth/callback
```

## Provider Setup

### Google OAuth Setup

1. **Google Cloud Console**: https://console.cloud.google.com/
2. Create OAuth 2.0 Client ID:
   - **Type**: Web application (yes, even for mobile!)
   - **Authorized redirect URIs**:
     - `https://your-project.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret to Supabase Dashboard

#### Mobile-Specific Configuration

For production, you'll also need OAuth Client IDs for mobile:

**Android**:

- Type: Android
- Package name: `com.eatme.app`
- SHA-1 certificate fingerprint (from your keystore)

**iOS**:

- Type: iOS
- Bundle ID: `com.eatme.app`

### Facebook OAuth Setup

1. **Facebook Developers**: https://developers.facebook.com/
2. Create an app and add "Facebook Login" product
3. Configure OAuth Redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
4. Copy App ID and App Secret to Supabase Dashboard

## Implementation Details

### Supabase Client Configuration

`src/lib/supabase.ts`:

```typescript
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Warm up the browser for faster OAuth flows
WebBrowser.maybeCompleteAuthSession();

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    detectSessionInUrl: false, // We handle this ourselves
  },
});

export const getOAuthRedirectUrl = () => {
  return Linking.createURL('auth/callback');
};
```

### Auth Store OAuth Method

`src/stores/authStore.ts`:

```typescript
signInWithOAuth: async (provider: 'google' | 'facebook') => {
  // 1. Get OAuth URL from Supabase
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getOAuthRedirectUrl(),
      skipBrowserRedirect: true, // We handle browser ourselves
    },
  });

  // 2. Open system browser
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  // 3. Extract tokens from callback URL
  if (result.type === 'success') {
    const url = new URL(result.url);
    const params = new URLSearchParams(url.hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    // 4. Create session
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }
};
```

### UI Implementation

`src/screens/auth/LoginScreen.tsx`:

- Google button opens system browser with Google OAuth
- Facebook button opens system browser with Facebook OAuth
- Loading states managed separately for OAuth vs email/password
- Error handling with user-friendly alerts

## Testing

### Development Testing

1. **Start the app**: `pnpm start` (Metro bundler)
2. **Run on device**: `pnpm android` or `pnpm ios`
3. Tap Google/Facebook button
4. System browser should open with OAuth provider
5. After auth, browser closes and app receives session

### Troubleshooting

**Browser doesn't close after auth**:

- Check that `WebBrowser.maybeCompleteAuthSession()` is called
- Verify deep link scheme matches `app.json`

**Redirect URL mismatch**:

- Ensure Supabase has the correct redirect URL
- Check expo-linking generates the expected URL (see logs)

**"skipBrowserRedirect" error**:

- This is normal - we handle the browser ourselves
- The option prevents Supabase from auto-redirecting

**OAuth works on web-portal but not mobile**:

- Web uses different redirect (https://...)
- Mobile uses deep link (eatme://...)
- Both must be added to Supabase allowed URLs

## Production Considerations

### Native Build Required

OAuth deep linking requires **native code**, so:

- ❌ Expo Go won't work
- ✅ Use development builds: `eas build --profile development`
- ✅ Production builds work after proper configuration

### Bundle Identifier / Package Name

After changing from `com.anonymous.mobile` to `com.eatme.app`:

1. Run `npx expo prebuild --clean` to regenerate native code
2. Update OAuth provider configurations with new identifiers
3. Rebuild the app

### Certificate Fingerprints (Android)

For Google OAuth on Android production builds:

```bash
# Get SHA-1 fingerprint from your keystore
keytool -list -v -keystore eatme.keystore
```

Add this to Google Cloud Console OAuth Client (Android type).

## Security Notes

1. **ANON_KEY is safe to expose**: The Supabase anonymous key can be in client code
2. **RLS policies protect data**: Row Level Security enforces auth at database level
3. **System browser prevents phishing**: OAuth in system browser (not WebView) protects users
4. **PKCE flow**: Supabase uses PKCE for mobile OAuth (security best practice)

## Related Files

- `src/lib/supabase.ts` - Supabase client with OAuth support
- `src/stores/authStore.ts` - Auth state and OAuth logic
- `src/screens/auth/LoginScreen.tsx` - UI with OAuth buttons
- `app.json` - Deep link scheme configuration
- `.env.example` - Environment variable template

## References

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [expo-web-browser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [expo-linking](https://docs.expo.dev/versions/latest/sdk/linking/)
- [Google OAuth Setup](https://console.cloud.google.com/)
- [Facebook OAuth Setup](https://developers.facebook.com/)

---

Last Updated: February 16, 2026

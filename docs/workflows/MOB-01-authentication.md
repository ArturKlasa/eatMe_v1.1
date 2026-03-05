# MOB-01 — Mobile Authentication

## Overview

The mobile app uses **Supabase Auth** with session persistence via **AsyncStorage**. Auth state is managed by a Zustand store (`authStore`). The app supports email/password and OAuth (Google/Facebook) sign-in, plus a password reset flow.

---

## Key Files

| File                                                    | Role                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/mobile/src/stores/authStore.ts`                   | Zustand store for all auth state and actions                             |
| `apps/mobile/src/lib/supabase.ts`                       | Supabase client configured with AsyncStorage for session persistence     |
| `apps/mobile/src/screens/auth/LoginScreen.tsx`          | Login form + OAuth buttons                                               |
| `apps/mobile/src/screens/auth/RegisterScreen.tsx`       | Registration form                                                        |
| `apps/mobile/src/screens/auth/ForgotPasswordScreen.tsx` | Password reset email request                                             |
| `apps/mobile/src/navigation/RootNavigator.tsx`          | Switches between `AuthNavigator` and `MainNavigator` based on auth state |

---

## Auth State Shape

```typescript
// authStore state
{
  user: User | null,          // Supabase User object
  session: Session | null,    // Full session with JWTs
  isLoading: boolean,         // True during initialization or sign-in
  isInitialized: boolean,     // True after first session check
  error: string | null,       // Last auth error message
}
```

---

## App Startup — Session Initialization

On every app launch, `authStore.initialize()` is called (from `RootNavigator`):

```
App starts → RootNavigator mounts
  → useEffect: authStore.initialize()
  → supabase.auth.getSession()
  → If session exists (stored in AsyncStorage):
    → set { user, session, isLoading: false, isInitialized: true }
    → Sync user preferences: filterStore.syncWithDatabase(userId)
    → Load onboarding data: onboardingStore.loadUserPreferences(userId)
  → If no session:
    → set { user: null, session: null, isLoading: false, isInitialized: true }
  → Sets up auth state listener (once, prevented by authListenerSubscription guard)
```

The `isInitialized: false` state shows a loading spinner in `RootNavigator` until the session check completes, preventing a flash of the auth screens.

---

## Navigation Based on Auth State

`RootNavigator` renders either `AuthNavigator` or `MainNavigator` based on `isInitialized` and `user`:

```
isInitialized = false  →  Loading spinner (ActivityIndicator)
user = null            →  AuthNavigator (Login, Register, ForgotPassword)
user = truthy          →  MainNavigator (Map, Swipe, Profile, etc.)
```

---

## Flow 1 — Email / Password Login

```
LoginScreen: user enters email + password
  → authStore.signIn(email, password)
  → supabase.auth.signInWithPassword({ email, password })
  → On success: session saved to AsyncStorage automatically by Supabase client
  → authStore sets user + session
  → RootNavigator re-renders → MainNavigator shown
  → filterStore.syncWithDatabase() and onboardingStore.loadUserPreferences() called
  → On error: authStore.error set → UI shows Alert
```

---

## Flow 2 — Registration

```
RegisterScreen: user enters email, password, profile name
  → authStore.signUp(email, password, { profile_name })
  → supabase.auth.signUp({ email, password, options: { data: { profile_name } } })
  → Returns needsEmailVerification: true if email confirmation is required
  → UI shows "Check your email" message
  → User clicks verification link → deep link handled by Supabase / Expo Linking
```

`profile_name` is stored in `user.user_metadata.profile_name`. The `handle_new_user` Postgres trigger (migration `020`) creates a `user_profiles` row automatically.

---

## Flow 3 — OAuth (Google / Facebook)

```
LoginScreen: user taps OAuth button
  → authStore.signInWithOAuth(provider)
  → supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: getOAuthRedirectUrl() }
    })
  → getOAuthRedirectUrl() returns Expo deep link URL: eatme://auth/callback
  → expo-web-browser opens provider's OAuth page in-app browser
  → On approval: provider redirects to eatme://auth/callback?...
  → Expo Linking captures deep link
  → Supabase client processes the callback and stores session
  → authStore detects session change via onAuthStateChange listener
  → RootNavigator switches to MainNavigator
```

`WebBrowser.maybeCompleteAuthSession()` is called at module load in `lib/supabase.ts` to handle the in-app browser completion handshake on Android.

---

## Flow 4 — Password Reset

```
ForgotPasswordScreen: user enters email
  → authStore.resetPassword(email)
  → supabase.auth.resetPasswordForEmail(email, { redirectTo: '...' })
  → User receives reset email → clicks link
  → (Future: deep link to a "new password" screen in the app)
  → authStore.updatePassword(newPassword) available for when user is in session
```

---

## Flow 5 — Sign Out

```
ProfileScreen (or Settings): user taps Sign Out
  → authStore.signOut()
  → supabase.auth.signOut()
  → Clears AsyncStorage session
  → authStore: user = null, session = null
  → RootNavigator re-renders → AuthNavigator shown
```

---

## Session Persistence

The Supabase client is configured with `storage: AsyncStorage`. This means the JWT tokens are stored securely in the device's AsyncStorage and restored on next app open, enabling persistent login without requiring the user to re-authenticate each time.

`autoRefreshToken: true` ensures the access token is silently refreshed before it expires (every hour).

---

## Store Coupling on Login

When a user successfully signs in, `authStore.initialize()` directly calls:

- `useFilterStore.getState().syncWithDatabase(userId)` — loads saved filter preferences
- `useOnboardingStore.getState().loadUserPreferences(userId)` — loads dietary preferences

> ⚠️ **Known Gap**: This creates tight coupling between stores. If either call throws, it could impact auth initialization. See improvement item A5 in `CODEBASE_IMPROVEMENTS.md`.

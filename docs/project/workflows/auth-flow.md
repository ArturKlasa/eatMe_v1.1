# Authentication Flow

## 1. Overview

Authentication gates access to both the consumer mobile app and the restaurant-owner/admin web portal. Supabase Auth provides the identity layer. The web portal uses a PKCE OAuth flow with cookie-based sessions; the mobile app uses native Google Sign-In or email/password with token-based sessions managed by Zustand.

## 2. Actors

| Actor | Description |
|-------|-------------|
| **User** | Consumer (mobile) or restaurant owner / admin (web) |
| **Mobile App** | React Native / Expo app with Zustand `authStore` |
| **Web Browser** | Next.js web portal with React `AuthContext` |
| **Supabase Auth** | Hosted auth service (email, OAuth, token refresh) |
| **Google OAuth** | Identity provider for social sign-in |

## 3. Preconditions

- Supabase project is configured with Email and Google providers enabled.
- Web portal has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set.
- Mobile app has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and Google OAuth client IDs configured per platform.
- The web Route Handler at `/auth/callback` is deployed to exchange PKCE codes.

## 4. Flow Steps

### Email/Password Signup (Web)

1. User fills in email, password, and restaurant name on `/auth/signup`.
2. `signUp()` calls `supabase.auth.signUp()` with `restaurant_name` in `user_metadata` and `emailRedirectTo` set to `/auth/callback`.
3. Supabase sends a confirmation email with a verification link.
4. User clicks the link, which redirects to `/auth/callback?code=<pkce_code>`.
5. The Route Handler exchanges the code for a session cookie via `exchangeCodeForSession()`.
6. User is redirected to `/` (or `/admin` if `role === 'admin'`).

### Email/Password Signup (Mobile)

1. User enters email, password, and optional `profile_name`.
2. `authStore.signUp()` calls `supabase.auth.signUp()` with metadata.
3. If `data.session` is null but `data.user` exists, `needsEmailVerification` is true.
4. User verifies email, then signs in normally.

### OAuth Login (Web)

1. User clicks "Sign in with Google" or "Sign in with Facebook".
2. `signInWithOAuth(provider)` calls `supabase.auth.signInWithOAuth()` with `redirectTo` set to `/auth/callback`.
3. User completes consent in the provider's OAuth screen.
4. Provider redirects to Supabase, which redirects to `/auth/callback?code=<pkce_code>`.
5. The Route Handler exchanges the code for a cookie-based session.
6. User is redirected to the appropriate page based on role.

### OAuth Login (Mobile - Google)

1. User taps "Sign in with Google".
2. `authStore.signInWithOAuth('google')` delegates to `signInWithGoogle()` (native OS account picker via `@react-native-google-signin`).
3. The native SDK returns an `idToken`.
4. `signInWithGoogle()` calls `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`.
5. Supabase validates the token and creates/returns a session.
6. `onAuthStateChange` fires and updates the Zustand store reactively.

### OAuth Login (Mobile - Facebook / Other)

1. `authStore.signInWithOAuth('facebook')` calls `supabase.auth.signInWithOAuth()` with `skipBrowserRedirect: true`.
2. The returned `data.url` is opened via `expo-web-browser`'s `openAuthSessionAsync`.
3. On success, access and refresh tokens are extracted from the redirect URL hash.
4. `supabase.auth.setSession()` establishes the session locally.
5. The store is updated with the new session and user.

### Session Lifecycle

1. On app mount (web `AuthProvider` or mobile `authStore.initialize()`), `supabase.auth.getSession()` hydrates the initial state.
2. `onAuthStateChange` is registered once to keep state in sync with Supabase's internal token refresh and callback events.
3. Supabase automatically refreshes the JWT before expiry (default 1 hour).
4. On web, stale drafts older than 7 days are cleared via `clearIfStale()` after session confirmation.
5. Sign-out clears local state; mobile also calls `signOutFromGoogle()` to clear the native Google session.

## 5. Sequence Diagrams

### Email/Password Signup

```mermaid
sequenceDiagram
    participant U as User
    participant App as App (Web / Mobile)
    participant SA as Supabase Auth
    participant E as Email Inbox

    U->>App: Enter email, password, name
    App->>SA: signUp({ email, password, metadata })
    SA-->>App: { user, session: null }
    SA->>E: Send confirmation email
    E->>U: Click verification link
    U->>App: Redirect to /auth/callback?code=
    App->>SA: exchangeCodeForSession(code)
    SA-->>App: { session }
    App->>U: Redirect to dashboard
```

### OAuth Login

```mermaid
sequenceDiagram
    participant U as User
    participant App as App
    participant G as Google OAuth
    participant SA as Supabase Auth

    U->>App: Tap "Sign in with Google"
    alt Web (PKCE)
        App->>SA: signInWithOAuth({ provider: 'google' })
        SA->>G: Redirect to consent screen
        G->>U: Show consent
        U->>G: Approve
        G->>SA: Authorization code
        SA->>App: Redirect /auth/callback?code=
        App->>SA: exchangeCodeForSession(code)
        SA-->>App: Session cookie set
    else Mobile (Native)
        App->>G: Native OS account picker
        G-->>App: idToken
        App->>SA: signInWithIdToken({ token })
        SA-->>App: { session }
    end
    App->>U: Show authenticated UI
```

### Session Lifecycle

```mermaid
sequenceDiagram
    participant App as App
    participant SA as Supabase Auth
    participant Store as AuthContext / authStore

    App->>SA: getSession()
    SA-->>Store: { session } or null
    Store->>Store: Set user, loading=false

    App->>SA: onAuthStateChange(callback)
    Note over SA,Store: Fires on login, logout, token refresh

    loop Token Refresh (automatic)
        SA->>SA: JWT nearing expiry
        SA->>SA: Refresh using refresh_token
        SA-->>Store: SIGNED_IN event + new session
        Store->>Store: Update session/user
    end

    App->>SA: signOut()
    SA-->>Store: SIGNED_OUT event
    Store->>Store: Clear session, user = null
```

## 6. Key Files

| File | Purpose |
|------|---------|
| `apps/web-portal/contexts/AuthContext.tsx` | Web auth context (session, signIn, signUp, signInWithOAuth, signOut) |
| `apps/web-portal/app/auth/callback/route.ts` | PKCE code exchange Route Handler |
| `apps/web-portal/app/auth/login/page.tsx` | Web login page |
| `apps/web-portal/app/auth/signup/page.tsx` | Web signup page |
| `apps/web-portal/components/ProtectedRoute.tsx` | Redirects unauthenticated users to `/auth/login` |
| `apps/web-portal/lib/supabase.ts` | Browser-side Supabase client |
| `apps/web-portal/lib/supabase-server.ts` | Server-side Supabase client (cookie session) |
| `apps/web-portal/lib/storage.ts` | Draft persistence and `clearIfStale()` |
| `apps/mobile/src/stores/authStore.ts` | Zustand auth store (initialize, signIn, signUp, signInWithOAuth, signOut) |
| `apps/mobile/src/lib/supabase.ts` | Mobile Supabase client with `getOAuthRedirectUrl()` |
| `apps/mobile/src/lib/googleAuth.ts` | Native Google Sign-In (`signInWithGoogle`, `signOutFromGoogle`) |

## 7. Error Handling

| Failure Mode | Handling |
|-------------|----------|
| Invalid credentials | Supabase returns error; displayed to user via `error` state |
| Email already registered | Supabase error; signUp returns `{ error }` |
| PKCE code missing/expired | Route Handler redirects to `/auth/login?error=missing_code` or `callback_failed` |
| OAuth cancelled by user | Mobile: error message `'OAuth cancelled'` is not persisted to error state; loading cleared |
| Token refresh failure | `onAuthStateChange` fires with null session; user is effectively signed out |
| Network error during auth | Caught in try/catch; error message set on store/context |
| Missing Google OAuth client ID | Native sign-in throws; caught and surfaced to user |

## 8. Notes

- **Role-based access**: The web portal supports three roles: `consumer`, `restaurant_owner`, and `admin`. The callback route checks `user_metadata.role` to redirect admins to `/admin`. `ProtectedRoute` only checks for authentication, not role.
- **Duplicate listener prevention**: Mobile `authStore` tracks `authListenerSubscription` globally to avoid registering multiple `onAuthStateChange` listeners.
- **PKCE vs Implicit**: The web portal uses PKCE flow exclusively. The old implicit flow (hash-based tokens) has been replaced.
- **Draft cleanup**: On web login, `clearIfStale()` removes onboarding drafts older than 7 days. On sign-out, the user-specific draft key is explicitly removed from localStorage.
- **Password reset**: Mobile supports password reset via `resetPasswordForEmail` with deep link `eatme://reset-password`.

See also: [Database Schema](../06-database-schema.md) for `users`, `user_preferences`, and `user_behavior_profiles` tables.

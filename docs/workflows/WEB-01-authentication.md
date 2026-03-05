# WEB-01 — Web Portal Authentication

## Overview

The web portal uses **Supabase Auth** for all authentication. Two sign-in methods are supported: email/password and OAuth (Google, Facebook). The auth state is managed globally by `AuthContext`, which wraps the entire app.

---

## Key Files

| File                                            | Role                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/web-portal/contexts/AuthContext.tsx`      | React Context that holds `user`, `session`, `loading`, and auth action functions. Consumed by `useAuth()`. |
| `apps/web-portal/lib/supabase.ts`               | Supabase client configured with `flowType: 'implicit'` and session persistence.                            |
| `apps/web-portal/app/auth/login/page.tsx`       | Login form UI.                                                                                             |
| `apps/web-portal/app/auth/signup/page.tsx`      | Sign-up form UI.                                                                                           |
| `apps/web-portal/app/auth/callback/page.tsx`    | OAuth redirect handler (parses hash tokens).                                                               |
| `apps/web-portal/components/ProtectedRoute.tsx` | Wrapper that redirects unauthenticated users to `/auth/login`.                                             |
| `apps/web-portal/middleware.ts`                 | Adds security headers to `/admin` and `/onboard` routes (does **not** enforce auth — that is client-side). |

---

## Flow 1 — Email / Password Sign-Up

```
User fills signup form (email, password, restaurant name)
  → AuthContext.signUp() called
  → supabase.auth.signUp({ email, password, options: { data: { restaurant_name } } })
  → Supabase sends verification email
  → User clicks link → redirected to /auth/callback?token=...
  → (Currently: user must sign in manually after verifying)
```

**What is stored in user metadata**: `restaurant_name` is written to `user.user_metadata.restaurant_name` via the `data` option. This is available client-side immediately after sign-up, and server-side via the `handle_new_user` Postgres trigger (migration `020`) which creates a row in `user_profiles`.

**Edge case**: Supabase returns a `data.user` object even if the email is unverified. The UI should check `data.user.email_confirmed_at` to determine if verification is still pending.

---

## Flow 2 — Email / Password Sign-In

```
User fills login form
  → AuthContext.signIn(email, password)
  → supabase.auth.signInWithPassword({ email, password })
  → On success: AuthContext updates user + session state
  → ProtectedRoute unwraps → app renders dashboard
  → On failure: error returned, toast shown
```

---

## Flow 3 — OAuth (Google / Facebook)

```
User clicks "Sign in with Google/Facebook"
  → AuthContext.signInWithOAuth(provider)
  → supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/auth/callback` }
    })
  → Browser redirects to provider's consent screen
  → Provider redirects back to /auth/callback#access_token=...&refresh_token=...
  → AuthCallbackPage parses hash params from window.location.hash
  → supabase.auth.setSession({ access_token, refresh_token })
  → On success: reads user.user_metadata.role
    - If 'admin' → redirect to /admin
    - Else → redirect to /
  → On failure → redirect to /auth/login?error=session_failed
```

**Why implicit flow?** The code uses `flowType: 'implicit'` (hash-based tokens) instead of the preferred PKCE flow. This was a workaround for PKCE verifier cookie issues during local development. PKCE is recommended for production (see improvement item A8 in `CODEBASE_IMPROVEMENTS.md`).

**Admin role**: The role is stored in `user.user_metadata.role`. Admin users must have this set to `'admin'` in Supabase Auth's user metadata — it is not derived from the database.

---

## Flow 4 — Sign Out

```
User clicks Sign Out button
  → AuthContext.signOut()
  → Removes eatme_draft_{userId} from localStorage (clears any unsaved onboarding draft)
  → supabase.auth.signOut()
  → AuthContext clears user + session state
  → App redirects to /auth/login
```

---

## Auth State Lifecycle

`AuthContext` subscribes to `supabase.auth.onAuthStateChange` in a `useEffect`. This means the app reacts to:

- Manual sign-in / sign-out
- Token refresh (auto, every hour)
- External tab sign-out (browser storage event)

The `loading: true` initial state prevents protected routes from flashing the login page before the session check completes.

---

## Route Protection

`ProtectedRoute` is a client-side wrapper component used in every protected page:

```tsx
// Example usage in a page
export default function Page() {
  return (
    <ProtectedRoute>
      <PageContent />
    </ProtectedRoute>
  );
}
```

It checks `useAuth().user`. If null and loading is false, it redirects to `/auth/login`.

> ⚠️ **Known Gap**: The middleware does not enforce authentication at the network layer. A direct HTTP request to `/onboard/basic-info` bypasses the `ProtectedRoute`. RLS on the database prevents data leakage, but page HTML still renders. See improvement item A2 / S1 in `CODEBASE_IMPROVEMENTS.md`.

---

## Auth Context API

```typescript
const { user, session, loading, signUp, signIn, signInWithOAuth, signOut } = useAuth();
```

| Value / Function  | Type              | Description                                        |
| ----------------- | ----------------- | -------------------------------------------------- |
| `user`            | `User \| null`    | Supabase user object. `null` if not authenticated. |
| `session`         | `Session \| null` | Full session with JWT tokens.                      |
| `loading`         | `boolean`         | True during initial session check.                 |
| `signUp`          | `fn`              | Creates account, triggers email verification.      |
| `signIn`          | `fn`              | Email/password sign-in.                            |
| `signInWithOAuth` | `fn`              | Redirects to provider OAuth page.                  |
| `signOut`         | `fn`              | Clears session and local draft data.               |

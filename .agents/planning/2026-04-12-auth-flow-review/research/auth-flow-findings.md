# Auth Flow Audit — Research Findings

Code reviewed on 2026-04-12. All file paths are relative to the monorepo root.

---

## CRITICAL

### 1. `proxy.ts` is not Next.js middleware — all route protection is dead code

**File:** `apps/web-portal/proxy.ts`

Next.js only executes edge middleware from a file named `middleware.ts` (or `middleware.js`) placed at the app root (or `src/`). A file named `proxy.ts` is a plain TypeScript module — Next.js never calls it.

The file exports `proxy()` and `config.matcher`, which are the correct middleware exports, but the filename means they are never invoked. No `middleware.ts` exists in the project (`glob apps/web-portal/middleware.ts` → no results).

**Consequence:** Every protection the proxy provides is bypassed:
- Authenticated users are NOT redirected away from `/auth/login` and `/auth/signup`
- `/onboard/*`, `/menu/*`, `/restaurant/*` are NOT protected — unauthenticated users can access them (until client-side `ProtectedRoute` hydrates)
- `/admin/*` is NOT protected — any logged-in user can navigate there
- Session cookies are NOT refreshed at the edge — sessions can expire mid-session without the user being logged out cleanly

**Fix:** Rename `proxy.ts` → `middleware.ts` and rename the export `proxy` → `middleware` (the Next.js convention), or create a `middleware.ts` that calls `proxy()`.

---

### 2. Admin role checked from `user_metadata` (user-editable) — security vulnerability

**Files:** `apps/web-portal/app/auth/callback/route.ts:32`, `apps/web-portal/proxy.ts:80`

```ts
// callback/route.ts
const role = data.session.user.user_metadata?.role;

// proxy.ts
if (user.user_metadata?.role !== 'admin') { ... }
```

`user_metadata` is stored in Supabase's `auth.users` table and **can be overwritten by any authenticated user** via `supabase.auth.updateUser({ data: { role: 'admin' } })`. An attacker can grant themselves admin access.

By contrast, `supabase-server.ts:verifyAdminRequest` correctly uses `app_metadata.role`:
```ts
if (user.app_metadata?.role !== 'admin') { ... }
```
`app_metadata` is writable only by the service role — it cannot be changed by end users.

**Consequence:** Any authenticated user can escalate to admin by calling `updateUser` from the browser console.

**Fix:** Replace all `user_metadata?.role` admin checks with `app_metadata?.role`. Admin users must have their role set via service role (backend/migration/Supabase dashboard).

---

## HIGH

### 3. Mobile Facebook OAuth extracts tokens from URL hash — breaks with PKCE

**File:** `apps/mobile/src/stores/authStore.ts:422-429`

```ts
const url = new URL(result.url);
const params = new URLSearchParams(url.hash.substring(1));
const accessToken = params.get('access_token');
const refreshToken = params.get('refresh_token');
```

This is the implicit flow pattern: tokens arrive in the URL fragment (`#access_token=...`). If the Supabase project is configured with PKCE (which is the case for the web portal), the OAuth callback will instead return a `?code=` query parameter, and `access_token` / `refresh_token` will be absent from the hash.

**Consequence:** Facebook (and any future non-Google) OAuth login on mobile silently fails with "No access token received from OAuth provider" error even when the user successfully authorizes.

**Fix:** Either:
- Check `url.searchParams.get('code')` and exchange via `supabase.auth.exchangeCodeForSession(code)`, or
- Ensure the Supabase project's implicit flow is still enabled for mobile (not recommended — implicit flow is deprecated)

The deep link redirect URL (`eatme://auth/callback`) needs to be registered in Supabase's allowed redirect URLs, and the exchange should happen client-side (since there's no server Route Handler reachable from the mobile app).

---

### 4. Mobile signup missing `emailRedirectTo` — verification link opens web, not app

**File:** `apps/mobile/src/stores/authStore.ts:193-199`

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: metadata,
    // ← no emailRedirectTo
  },
});
```

Without `emailRedirectTo`, Supabase uses the project's default site URL (the web portal). A mobile user who signs up and clicks the verification email link will land in a browser pointing at the web portal, not back in the mobile app.

**Fix:**
```ts
options: {
  data: metadata,
  emailRedirectTo: 'eatme://auth/callback',
}
```
`eatme://auth/callback` (or whichever deep link scheme is registered) must also be in Supabase's allowed redirect URLs.

---

### 5. Post-login `?redirect` param is set but never consumed

**Files:** `apps/web-portal/proxy.ts:45-47`, `apps/web-portal/app/auth/login/page.tsx:41`

The proxy appends `?redirect=<path>` when bouncing unauthenticated users to login:
```ts
loginUrl.searchParams.set('redirect', path);
```

But the login page always redirects to `/` on success, ignoring the param:
```ts
router.push('/');
```

**Consequence:** A user following a deep link to `/restaurant/123` will be sent to `/` after login rather than back to the original destination. UX regression whenever proxy protection actually runs (once the proxy filename is fixed).

**Fix:** In `login/page.tsx`, read `useSearchParams()` and redirect to the `redirect` param if present.

---

## MEDIUM

### 6. `onAuthStateChange` fires immediately with `INITIAL_SESSION` — double state set on mount

**File:** `apps/web-portal/contexts/AuthContext.tsx:63-83`

```ts
supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(session);
  setUser(session?.user ?? null);
  setLoading(false);
  if (session?.user?.id) clearIfStale(session.user.id);
});

const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
  setLoading(false);
});
```

`onAuthStateChange` fires `INITIAL_SESSION` synchronously on the next tick with the same session data `getSession()` will return. This causes two sequential state updates on every mount — a redundant render. More importantly, if `getSession()` resolves first and sets `loading=false`, then `onAuthStateChange` fires and re-sets state again, causing a second render. The order is non-deterministic.

The `clearIfStale()` call is also only triggered via `getSession()`, not via `onAuthStateChange`. If for any reason `onAuthStateChange` resolves first and `getSession()` fails silently (rare but possible), `clearIfStale` never runs.

**Fix (standard Supabase pattern):** Drop the explicit `getSession()` call and rely solely on `onAuthStateChange`. The `INITIAL_SESSION` event provides the current session on mount:
```ts
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
  setLoading(false);
  if (event === 'INITIAL_SESSION' && session?.user?.id) clearIfStale(session.user.id);
});
```

---

### 7. `ProtectedRoute` has no role guard — `/admin` UI reachable by non-admins

**File:** `apps/web-portal/components/ProtectedRoute.tsx`

`ProtectedRoute` only checks `!!user`, not the user's role. Given that the proxy (which does role-check `/admin/*`) is not running (issue #1), any authenticated non-admin user who navigates directly to `/admin/...` will pass the `ProtectedRoute` check and see the admin UI.

**Fix:** Either add a `requiredRole` prop to `ProtectedRoute`, or create a separate `AdminRoute` component that checks `user.app_metadata?.role === 'admin'`.

---

### 8. Web `signUp` doesn't return or surface `needsEmailVerification`

**File:** `apps/web-portal/contexts/AuthContext.tsx:85-108`

```ts
const signUp = async (...) => {
  const { data, error } = await supabase.auth.signUp({...});
  if (error) throw error;
  return { error: null };  // data is ignored entirely
};
```

`data.session` is null when email confirmation is required, and `data.user` is non-null. The web context throws away this distinction and always returns `{ error: null }`. The signup page always shows "check your email" regardless.

If Supabase's "Confirm email" setting is disabled, `data.session` will be non-null and the user is immediately logged in — but the page still redirects to `/auth/login` with a "check email" toast, which is incorrect.

**Fix:** Return `{ error: null, needsEmailVerification: !data.session && !!data.user }` and handle each case in the signup page.

---

### 9. `storage.ts` type cast on `lastSaved` is unsafe

**File:** `apps/web-portal/lib/storage.ts:84`

```ts
const parsed = JSON.parse(raw) as FormProgress;
if (!parsed.lastSaved) return false;
```

`FormProgress` (from `@eatme/shared`) almost certainly does not include a `lastSaved` field — it's added dynamically by `saveRestaurantData`. TypeScript accepts `parsed.lastSaved` only because of the `as FormProgress` cast. If the `FormProgress` type is strict, this is a runtime access of a property that TypeScript believes doesn't exist.

**Fix:** Define an internal `DraftData` type that extends `FormProgress` with `lastSaved: string`.

---

## LOW / DOC MISMATCH

### 10. Doc mentions Facebook OAuth for web — Facebook is not an official Supabase OAuth provider out of the box

**File:** `docs/project/workflows/auth-flow.md` section 4 (OAuth Login Web), step 1

> "User clicks 'Sign in with Google' or 'Sign in with Facebook'."

The UI has Facebook OAuth buttons. Supabase does support Facebook as a provider but it requires separate setup (Facebook App ID + Secret in Supabase dashboard). The doc doesn't mention this extra prerequisite (unlike Google which is explicitly called out in section 3).

---

### 11. Doc says mobile `onAuthStateChange` fires and updates store — but `isLoading` is not updated there

**File:** `apps/mobile/src/stores/authStore.ts:129-139`

```ts
supabase.auth.onAuthStateChange((event, session) => {
  set({
    session,
    user: session?.user ?? null,
    // ← isLoading NOT reset here
  });
});
```

When a token refresh fires `SIGNED_IN`, `isLoading` is not reset. It's only reset inside individual action methods (`signIn`, `signOut`, etc.). If initialization sets `isLoading: false` and a subsequent token refresh triggers `onAuthStateChange`, any in-flight loading indicator that was keyed off `isLoading` won't be affected — this is fine. But if `isLoading` gets set to `true` somewhere and then a reactive auth state change arrives (without going through an action), loading will be stuck.

Minor, but worth aligning with the web pattern.

---

### 12. Doc/code mismatch: callback redirects to `/` for non-admins, but page says "or `/admin` if `role === 'admin'`"

**File:** `apps/web-portal/app/auth/callback/route.ts:33`

```ts
const destination = role === 'admin' ? '/admin' : next === '/' ? '/' : next;
```

The `next` param defaults to `'/'` (line 17). So non-admin users are sent to `/` (or whatever `?next=` says). The doc says the same. ✓ No bug here, but the redirect logic is slightly unintuitive — if `next === '/'` it stays `/`, otherwise it uses `next`. The logic is effectively: always redirect non-admins to `next`, which defaults to `/`. This is correct but the ternary is confusing.

---

### 13. `proxy.ts` doesn't protect `/` (home/dashboard)

**File:** `apps/web-portal/proxy.ts`

The proxy protects `/onboard/*`, `/menu/*`, `/restaurant/*`, `/admin/*` — but not `/` itself. If the dashboard lives at `/`, unauthenticated users can reach it at the edge. Client-side `ProtectedRoute` guards it, but only after hydration.

**Note:** This may be intentional if `/` is a public landing page and the dashboard is nested under a protected path.

---

## Summary Table

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | CRITICAL | Web | `proxy.ts` wrong filename — middleware never runs |
| 2 | CRITICAL | Web | Admin role from `user_metadata` (user-editable) — privilege escalation |
| 3 | HIGH | Mobile | Facebook OAuth hash extraction breaks with PKCE |
| 4 | HIGH | Mobile | Mobile signUp missing `emailRedirectTo` deep link |
| 5 | HIGH | Web | `?redirect` param set by proxy but ignored by login page |
| 6 | MEDIUM | Web | Double state update on mount (getSession + INITIAL_SESSION) |
| 7 | MEDIUM | Web | `ProtectedRoute` no role check — admin UI reachable by any user |
| 8 | MEDIUM | Web | `signUp` ignores `needsEmailVerification` |
| 9 | LOW | Web | Unsafe `lastSaved` type cast in `storage.ts` |
| 10 | LOW | Doc | Facebook OAuth prerequisites missing from auth-flow.md |
| 11 | LOW | Mobile | `isLoading` not reset in reactive `onAuthStateChange` handler |
| 12 | LOW | Doc | Callback redirect ternary correct but confusingly written |
| 13 | LOW | Web | `/` not edge-protected by proxy |

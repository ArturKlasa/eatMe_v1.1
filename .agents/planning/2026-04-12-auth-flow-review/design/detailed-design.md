# Auth Flow Audit — Detailed Design (Fix Plan)

## Overview

This document consolidates all findings from the auth flow audit and specifies the exact fixes required. Issues are ordered by severity. Two are critical security/correctness issues that must be fixed before any production deployment.

## Detailed Requirements (from audit)

### REQ-1 (CRITICAL): Next.js middleware must be named `middleware.ts`
The file `apps/web-portal/proxy.ts` contains correct middleware logic but is never invoked by Next.js because it has the wrong filename. Must be renamed or re-exported from a proper `middleware.ts`.

### REQ-2 (CRITICAL): Admin role checks must use `app_metadata`, not `user_metadata`
`user_metadata` is writable by authenticated users. Any admin check that reads `user_metadata.role` is a privilege-escalation vulnerability. All admin checks must use `app_metadata.role`.

### REQ-3 (HIGH): Mobile Facebook OAuth must handle PKCE code exchange
Current code extracts tokens from URL hash (implicit flow). If Supabase project uses PKCE, tokens won't be in the hash. Must detect and exchange `?code=` params.

### REQ-4 (HIGH): Mobile signup must set `emailRedirectTo` to a deep link
Without it, email verification links redirect to the web portal rather than back to the mobile app.

### REQ-5 (HIGH): Login page must consume the `?redirect` query param
The proxy correctly stores the original destination in `?redirect=`, but the login page ignores it, always sending users to `/`.

### REQ-6 (MEDIUM): `AuthContext` mount pattern should use `onAuthStateChange` only
Using both `getSession()` and `onAuthStateChange` causes double renders and makes `clearIfStale` timing non-deterministic.

### REQ-7 (MEDIUM): `ProtectedRoute` must enforce role for admin routes
Any authenticated non-admin can reach `/admin` via direct navigation if client-side is the only guard.

### REQ-8 (MEDIUM): Web `signUp` must surface `needsEmailVerification`
The context silently swallows this distinction; the signup page always shows "check email" regardless.

### REQ-9 (LOW): Fix `lastSaved` type cast in `storage.ts`
Use a properly typed `DraftData` type instead of casting `FormProgress`.

## Architecture Overview

```mermaid
flowchart TD
    subgraph Web Portal
        MW[middleware.ts\n← rename proxy.ts]
        CB[/auth/callback/route.ts]
        AC[AuthContext.tsx]
        PR[ProtectedRoute.tsx]
        LP[login/page.tsx]
        SP[signup/page.tsx]
    end

    subgraph Mobile
        AS[authStore.ts]
        GA[googleAuth.ts]
    end

    subgraph Supabase
        SA[Auth Service]
    end

    MW -->|edge session refresh| SA
    MW -->|admin check via app_metadata| SA
    CB -->|PKCE code exchange| SA
    AC -->|INITIAL_SESSION only| SA
    AS -->|signInWithIdToken| SA
    AS -->|PKCE exchange for FB| SA
```

## Components and Interfaces

### Fix 1: `middleware.ts` (rename from `proxy.ts`)

```ts
// apps/web-portal/middleware.ts
export { proxy as middleware, config } from './proxy';
// OR rename the file and change export name
```

### Fix 2: Admin role checks

Replace in `callback/route.ts` and `proxy.ts`:
```ts
// BEFORE (vulnerable)
user.user_metadata?.role === 'admin'

// AFTER (secure)
user.app_metadata?.role === 'admin'
```

### Fix 3: Mobile Facebook PKCE

```ts
// authStore.ts — after openAuthSessionAsync succeeds
if (result.type === 'success' && result.url) {
  const url = new URL(result.url);

  // PKCE flow: code in query params
  const code = url.searchParams.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    // ... handle session
    return;
  }

  // Implicit flow fallback (if project still has it enabled)
  const params = new URLSearchParams(url.hash.substring(1));
  const accessToken = params.get('access_token');
  // ... existing logic
}
```

### Fix 4: Mobile `emailRedirectTo`

```ts
// authStore.ts signUp
options: {
  data: metadata,
  emailRedirectTo: 'eatme://auth/callback',
}
```

### Fix 5: Login page redirect

```ts
// login/page.tsx
import { useSearchParams } from 'next/navigation';
const searchParams = useSearchParams();

// in handleSubmit after success:
const redirect = searchParams.get('redirect') ?? '/';
router.push(redirect);
```

### Fix 6: `AuthContext` single listener

```ts
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
    if (event === 'INITIAL_SESSION' && session?.user?.id) {
      clearIfStale(session.user.id);
    }
  });
  return () => subscription.unsubscribe();
}, []);
```

### Fix 7: Role-aware `ProtectedRoute`

```tsx
// components/AdminRoute.tsx
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/login');
      else if (user.app_metadata?.role !== 'admin') router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user || user.app_metadata?.role !== 'admin') {
    return <LoadingSpinner />;
  }
  return <>{children}</>;
}
```

### Fix 8: Web `signUp` returns verification flag

```ts
// AuthContext.tsx
const signUp = async (...) => {
  const { data, error } = await supabase.auth.signUp({...});
  if (error) return { error, needsEmailVerification: false };
  return { error: null, needsEmailVerification: !data.session && !!data.user };
};

// Interface update:
signUp: (...) => Promise<{ error: Error | null; needsEmailVerification: boolean }>;
```

### Fix 9: `DraftData` type in `storage.ts`

```ts
interface DraftData extends FormProgress {
  lastSaved: string;
}

export const clearIfStale = (userId: string, maxAgeDays = 7): boolean => {
  const parsed = JSON.parse(raw) as DraftData;
  if (!parsed.lastSaved) return false;
  // ...
};
```

## Data Models

No schema changes required. All fixes are code-level.

## Error Handling

| Scenario | Current | After Fix |
|----------|---------|-----------|
| Non-admin hits `/admin` | Allowed if proxy not running | Blocked at edge (middleware) + client (AdminRoute) |
| User sets `user_metadata.role=admin` | Escalates to admin | Ignored — `app_metadata` checked instead |
| Mobile FB OAuth with PKCE | Silent "no token" error | Code exchange attempted first |
| Mobile signup verification link | Opens web portal | Opens mobile app via deep link |
| Login with `?redirect=/restaurant/123` | Lands on `/` | Lands on `/restaurant/123` |

## Testing Strategy

- **REQ-1**: Verify `middleware.ts` is recognized — add a console.log and check it appears in Next.js server logs on startup
- **REQ-2**: Test `updateUser({ data: { role: 'admin' } })` in browser console — confirm `/admin` is still blocked
- **REQ-3**: Test Facebook OAuth on a device with PKCE-enabled Supabase project
- **REQ-4**: Test mobile signup and tap email verification link — confirm deep link opens app
- **REQ-5**: Navigate to a protected route while logged out, log in, confirm original destination
- **REQ-6**: Add render counter to `AuthContext`, confirm single render on mount
- **REQ-7**: Log in as non-admin, navigate directly to `/admin/...`, confirm redirect to `/`
- **REQ-8**: Disable email confirmation in Supabase, sign up, confirm no "check email" toast

## Appendices

### Technology Choices
- **Supabase Auth** with `@supabase/ssr` for PKCE + cookie sessions (web)
- **Zustand** for mobile auth state
- **Next.js middleware** for edge-level route protection

### Alternative Approaches Considered
- **Server Components for auth**: could read cookies directly in RSC and redirect. Would eliminate the flash-of-unauthenticated-content issue in `ProtectedRoute` entirely.
- **JWT decoding client-side for role**: avoided correctly — always verify on server with `getUser()`.

### Key Constraints
- `app_metadata` requires Supabase service role to write — admin role must be assigned via migration or Supabase dashboard, not through user-facing flows.
- Deep links (`eatme://`) must be registered in both Supabase's allowed redirect URLs and the Expo app's URL scheme config.

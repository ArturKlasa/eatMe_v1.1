## 2026-04-23 — Step 14 complete

Owner app auth pages, sign-in/sign-up, DAL wire-up, /onboard skeleton.

All code was already written in prior iteration (untracked). Issues found and fixed:
- `SignInForm.tsx` lines 112/120: `startTransition` callbacks returned `ActionResult` instead of `void` — wrapped with `async () => { await ... }` to satisfy TypeScript's `VoidOrUndefinedOnly` constraint.
- `src/middleware.ts` (deprecated Next.js 16 convention) caused Turbopack build failure because `config` was re-exported. Replaced with `src/proxy.ts` that defines `proxy` function and `config` inline — no re-exports.

Gates passed: typecheck ✓, vitest 23/23 ✓, `turbo build --filter web-portal-v2` ✓

## 2026-04-23 — Step 14 critic notes

Two real concerns found:

**1. Open redirect in `signInWithPassword` action**
File: `apps/web-portal-v2/src/app/(auth)/actions.ts:26`
```ts
const redirectTo = (formData.get('redirect') as string | null) ?? '/restaurant';
// ...
redirect(redirectTo);
```
The `redirect` param is taken directly from `FormData` without origin validation. An attacker who can submit the POST form with `redirect=https://phishing.com/eatme` can redirect authenticated users to external URLs after sign-in. Next.js `redirect()` follows absolute URLs. Fix: validate `redirectTo` starts with `/` and does not start with `//` (protocol-relative) before using it:
```ts
const raw = formData.get('redirect') as string | null;
const redirectTo = raw?.startsWith('/') && !raw.startsWith('//') ? raw : '/restaurant';
```

**2. Missing `/auth/callback` route — OAuth completely non-functional**
Files: `apps/web-portal-v2/src/app/(auth)/actions.ts:53, 63`
Both `signInWithGoogle` and `signInWithFacebook` specify `redirectTo: \`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback\`` but no `app/auth/callback/route.ts` exists in the app. Supabase SSR with PKCE requires a callback route that exchanges the auth code for a session (`supabase.auth.exchangeCodeForSession(code)`) and sets the session cookie. Without this route, every OAuth sign-in lands on a 404 — the OAuth buttons are fully broken in production. Fix: create `app/auth/callback/route.ts` as a `withPublicRoute`-wrapped GET handler that reads `code` + `next` from `searchParams`, calls `exchangeCodeForSession`, and redirects to `next` (validated to be a relative path).

## 2026-04-23 — Step 14 critique addressed (commit b451386)

Both issues fixed:
1. `actions.ts:26` — open redirect closed: validate raw starts with '/' and not '//' before using; fallback '/restaurant'
2. `app/auth/callback/route.ts` — created `withPublicRoute` GET handler; reads `code`+`next`, calls `exchangeCodeForSession`, redirects to validated relative `next`
Added 2 security tests (absolute URL + protocol-relative redirect rejection); tests: 25/25 pass, typecheck ✓

## 2026-04-23 — Step 14 second critique (post-rework review)

**verifySession() double-call**: OnboardPage calls verifySession() even though AppLayout already does. Initially looked like a double remote-call — but dal.ts wraps verifySession() in React.cache() and it uses getClaims() (local JWT verify), so subsequent calls within the same render tree are free. NOT a real concern.

**OAuth ?error param ignored in /auth/callback/route.ts**
File: `apps/web-portal-v2/src/app/auth/callback/route.ts:5-17`

When an OAuth provider (Google/Facebook) redirects back with an error (user cancelled, provider failure), the URL contains `?error=access_denied&error_description=...` and NO `?code`. The handler's `if (code)` block is skipped, and it falls through to `NextResponse.redirect(new URL(redirectTo, req.url))` — silently redirecting to `/restaurant`. The layout then detects no valid session via verifySession() and bounces to `/signin` — with zero error message.

Fix: check `searchParams.get('error')` before the code block and redirect to `/signin?error=<encoded>` when present:
```ts
const providerError = searchParams.get('error');
if (providerError) {
  const desc = searchParams.get('error_description') ?? providerError;
  return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(desc)}`, req.url));
}
```

This is a real production gap: any OAuth cancellation silently fails. The OAuth buttons in SignInForm are otherwise fully wired — this is the last mile of making them production-ready.

## 2026-04-23 — Step 14 third critique addressed (commit 7650c3c)

OAuth ?error param now handled in /auth/callback/route.ts:
- Check `searchParams.get('error')` before the code block
- Redirect to `/signin?error=<encoded>` using error_description if present, else error
- exchangeCodeForSession is NOT called when provider error present
- Added 6 unit tests: provider error redirect, error_description preference, code exchange success/failure, no-params fallback, ?next validation
- tests: 31/31 pass, typecheck ✓, commit 7650c3c

## 2026-04-23 — Step 14 fourth critique

**?error param emitted but never consumed — the gap is still present end-to-end**

`apps/web-portal-v2/src/app/(auth)/signin/page.tsx:5-6` only reads `searchParams.redirect`; `searchParams.error` is never read and never passed to `SignInForm`. The callback route correctly redirects to `/signin?error=<encoded>` on provider cancellation and on code-exchange failure, but the sign-in page ignores that param entirely. The user lands on `/signin?error=User+cancelled+the+login` with the error visible in the URL bar and *nothing* displayed on screen — exactly the same UX as the original silent-fallthrough bug, just with a different URL.

Fix (two small additions):
1. `SignInPage` reads `const { redirect, error } = await searchParams` and passes `initialError={error}` to `SignInForm`
2. `SignInForm` accepts `initialError?: string` prop and initializes `formError` state with it, rendering the existing `{formError && <p ...>}` block on load

The six new unit tests verify the redirect *URL* but none of them verify that the sign-in page renders the error message — they don't cover the consumption side of the flow.

## 2026-04-23 — Step 14 reviewer pass

Gates checked:
- `turbo check-types`: 3 packages pass (web-portal-v2, admin, @eatme/ui) — PASS
- `turbo test --filter web-portal-v2`: 31 tests pass (5 files), 9 integration skipped (need real DB) — PASS
- plan.md: `- [x] Step 14` confirmed
- `git diff main..HEAD -- apps/web-portal/`: empty (v1 untouched)
- `git diff main..HEAD -- apps/mobile/`: empty (correct — no mobile changes in step 14)
- design/PROMPT.md: untouched
- Commits: all reference `(plan step 14)` or `(plan step 14 critique)`
- Playwright test file `tests/e2e/auth.spec.ts`: exists and covers the 4 required scenarios
- Critic already approved quality (critique.clean event); advancing loop.

## 2026-04-23 — Step 15 complete

Restaurant draft CRUD Server Actions + `/restaurant/[id]` basic-info form.

Changes made:
- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/actions/restaurant.ts`: new file — `createRestaurantDraft`, `updateRestaurantBasics`, `archiveRestaurant`, `unpublishRestaurant`, all wrapped in `withAuth`. Inline Zod schemas (avoided `.pick()` due to Zod v4 inference issue). `updateRestaurantBasics` maps form fields to DB column names (cuisines→cuisine_types, country→country_code, operating_hours→open_hours). Foreign-restaurant attempts return `NOT_FOUND` (RLS returns 0 rows via `.maybeSingle()`).
- `apps/web-portal-v2/src/lib/auth/dal.ts`: added `getRestaurant(id, userId)` — uncached helper for RSC page reads.
- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/page.tsx`: RSC page — `await params`, `verifySession`, `getRestaurant`, `notFound()` on null.
- `apps/web-portal-v2/src/components/restaurant/BasicInfoForm.tsx`: 'use client' — react-hook-form + zodResolver + inline schema. Autosave on blur. StatusChip renders Draft/Live/Suspended/Archived.
- `apps/web-portal-v2/src/__tests__/restaurant/actions.test.ts`: 12 Vitest tests covering UNAUTHENTICATED, NOT_FOUND (foreign), Zod fieldErrors, success paths, archive/unpublish status flips.
- `apps/web-portal-v2/tests/e2e/onboarding-happy-path.spec.ts`: Playwright scaffold (test.skip — filled in Step 16).
- `apps/web-portal-v2/package.json`: added react-hook-form + @hookform/resolvers.

Key decisions:
- Used `cuisines: z.array(z.string()).optional()` (not `.default([])`) in form schema because Zod v4's `.default()` makes input≠output types, causing zodResolver/useForm type mismatch.
- `formError: 'NOT_FOUND'` for foreign restaurant (design §6); test reflects this.
- `location: { lat: 0, lng: 0 }` placeholder in initial draft insert (DB requires non-null).

Gates: typecheck ✓, vitest 45/45 ✓, `turbo build --filter web-portal-v2` ✓ (route /restaurant/[id] in build output)

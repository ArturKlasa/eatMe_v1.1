# REV-02 — auth-session-web

## Scope reviewed

- `apps/web-portal/middleware.ts:1-132`
- `apps/web-portal/contexts/AuthContext.tsx:1-167`
- `apps/web-portal/lib/supabase.ts:1-68`
- `apps/web-portal/lib/supabase-server.ts:1-133`
- `apps/web-portal/app/auth/callback/route.ts:1-36`
- `apps/web-portal/app/auth/login/page.tsx:1-231`
- `apps/web-portal/app/auth/signup/page.tsx:1-286`
- `apps/web-portal/app/auth/forgot-password/page.tsx:1-117`
- `apps/web-portal/app/auth/reset-password/page.tsx:1-226`
- `apps/web-portal/components/AdminRoute.tsx:1-29`
- `apps/web-portal/lib/storage.ts:1-88`
- `apps/web-portal/test/middleware.test.ts:1-139`

Cross-ref greps: `createServerClient|createBrowserClient|createMiddlewareClient`
across `apps/web-portal/`; `searchParams.get('redirect'|'next')`,
`router.push|redirect(|NextResponse.redirect`, `NEXT_PUBLIC_SITE_URL`,
`restaurant-draft|onboarding-step|eatme_draft_`.

## Findings

### REV-02-a: Open-redirect via protocol-relative URL in post-login redirect
- Severity: high
- Category: security
- Location: `apps/web-portal/app/auth/login/page.tsx:42-45`
- Observation: After successful password sign-in the page reads
  `?redirect=` and only validates `redirectParam.startsWith('/')` before
  calling `router.push(redirect)`. The guard accepts protocol-relative
  URLs of the form `//attacker.example/path`, which browsers resolve to
  `https://attacker.example/path`. Middleware sets the `?redirect=` value
  itself from the original request path, but an attacker can craft the
  URL directly: `/auth/login?redirect=//attacker.example`.
- Why it matters: Any victim who clicks a phishing link pointing at the
  legitimate domain, enters their credentials successfully, and is then
  silently thrown to an attacker-controlled origin — classic credential
  phishing / session-fixation pivot.
- Suggested direction: Reject protocol-relative (`//…`) and backslash-prefix
  (`/\…`) values. A tighter guard: accept only when
  `redirectParam.startsWith('/') && !redirectParam.startsWith('//') && !redirectParam.startsWith('/\\')`.
  Or route through `new URL(redirectParam, window.location.origin)` and
  assert the resolved URL's `origin` equals `window.location.origin`.
- Confidence: likely
- Evidence: Line 44 — `const redirect = redirectParam.startsWith('/') ? redirectParam : '/';`.
  `'//evil.com'.startsWith('/')` returns `true` in JS (well-known behaviour
  for this class of bug).

### REV-02-b: Middleware drops refreshed auth cookies when it redirects
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/middleware.ts:16-88` (with cookie plumbing at
  `apps/web-portal/lib/supabase-server.ts:47-66`)
- Observation: The middleware creates `response = NextResponse.next(...)`,
  hands it to `createMiddlewareClient`, calls `client.auth.getUser()` which
  may rotate access/refresh tokens and writes the new cookies to the
  original `response` via `setAll` (supabase-server.ts:56-61). When the
  middleware then issues a redirect (`/auth/login` for unauthenticated
  users, `/` for authenticated users hitting `/auth/login`, `/?error=admin_only`
  for non-admins), it returns a *fresh* `NextResponse.redirect(...)` without
  copying the refreshed cookies from `response` onto it. The rotated
  cookies are discarded.
- Why it matters: Two concrete consequences: (1) token-rotation mismatch —
  Supabase may have rotated the refresh token server-side; the client keeps
  the old one and subsequent requests log the user out; (2) an authenticated
  user whose access token expired hitting `/auth/login` gets redirected to
  `/` but the rotated session is lost, so the next request treats them as
  unauthenticated. Intermittent silent sign-outs are the usual symptom.
- Suggested direction: Follow the Supabase SSR pattern — copy cookies from
  `response` onto the redirect response before returning. E.g. build the
  redirect, then `response.cookies.getAll().forEach(c => redirect.cookies.set(...))`.
  Equivalent to what `@supabase/ssr` docs call the "NextResponse copy
  pattern".
- Confidence: likely
- Evidence: `middleware.ts:33-87` — every `return NextResponse.redirect(...)`
  builds a new response without pulling cookies from `response`. Compare
  with Supabase SSR middleware reference, which explicitly copies cookies.

### REV-02-c: OAuth callback `next` param not validated
- Severity: medium
- Category: security
- Location: `apps/web-portal/app/auth/callback/route.ts:17,33-35`
- Observation: `const next = searchParams.get('next') ?? '/'` is used
  directly for the post-exchange redirect: `NextResponse.redirect(`${origin}${destination}`)`.
  Because `destination` is concatenated *after* `${origin}` with no leading
  slash enforced, values like `next=//evil.com/path` produce
  `https://<origin>//evil.com/path` (safe — parsed as path on same host),
  but `next=.com/foo` yields `https://<origin>.com/foo` which *is*
  attacker-controlled if `<origin>` is a predictable subdomain (e.g.
  `eatme.com` + `next=.attacker.com/foo` → `https://eatme.com.attacker.com/foo`
  when concatenated without a separator — depends on origin shape).
  Even if not directly exploitable today, there is zero validation that
  `next` is a same-origin path.
- Why it matters: Defence-in-depth; the login page has an identical
  pattern (REV-02-a) that *is* exploitable. Any future refactor that
  bypasses the origin prefix here would silently re-introduce the bug.
- Suggested direction: Enforce `next.startsWith('/') && !next.startsWith('//')`
  and fall back to `/` otherwise; or resolve with `new URL(next, origin)`
  and assert same origin. Mirror the hardened check in the login page.
- Confidence: needs-verification
- Evidence: `callback/route.ts:33` — `const destination = role === 'admin' ? '/admin' : next === '/' ? '/' : next;`
  then line 35 — `return NextResponse.redirect(`${origin}${destination}`);`.

### REV-02-d: `NEXT_PUBLIC_SITE_URL` referenced but not defined in env
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/app/auth/forgot-password/page.tsx:25`
- Observation: Password-reset email redirect URL is built with
  `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`. The variable
  is not present in `apps/web-portal/.env.local` (verified: grep for
  `NEXT_PUBLIC_SITE_URL` in the env file returns no match). At build
  time Next.js static-replaces the value with `undefined`, producing
  the string `undefined/auth/reset-password` in the reset email's
  `redirectTo`.
- Why it matters: Supabase validates `redirectTo` against the project's
  allow-list. `undefined/auth/reset-password` is not on the list, so
  either (a) Supabase rejects the call and the user sees an error, or
  (b) the email arrives with a broken link pointing at
  `undefined/auth/reset-password`. Either way, password reset is
  silently broken in any deploy that lacks `NEXT_PUBLIC_SITE_URL`.
- Suggested direction: Either (a) document `NEXT_PUBLIC_SITE_URL` as
  required and validate on boot (throw like `lib/supabase.ts:7-13` does
  for the Supabase env vars), or (b) fall back to
  `window.location.origin` at call time (this is a client component).
- Confidence: confirmed
- Evidence: `.env.local` contents dumped — only `NEXT_PUBLIC_SUPABASE_*`,
  `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY`
  are defined. No `NEXT_PUBLIC_SITE_URL`.

### REV-02-e: Protected-path redirects leak original query string to `/auth/login`
- Severity: low
- Category: security
- Location: `apps/web-portal/middleware.ts:41-68` (four protected branches)
- Observation: Each protected-path branch does
  `const loginUrl = req.nextUrl.clone()` then only sets
  `loginUrl.pathname = '/auth/login'` and `searchParams.set('redirect', path)`.
  The clone retains any query string from the original request. Compare
  with the already-authenticated branch (lines 33-37) which explicitly
  sets `homeUrl.search = ''`.
- Why it matters: A protected URL with sensitive query params
  (e.g. `/admin?token=...`, `/menu/X?secret=...`) carries those params
  into the login page URL, where they may be logged by analytics,
  Referer-logged to third-party scripts, or shoulder-surfed.
- Suggested direction: Clear existing search before setting
  `redirect=`: add `loginUrl.search = ''` before `loginUrl.searchParams.set('redirect', path)`.
- Confidence: confirmed
- Evidence: Lines 43-47, 53-57, 63-67, 72-78 all clone without clearing.

### REV-02-f: Post-login redirect drops original query params
- Severity: low
- Category: correctness / ux
- Location: `apps/web-portal/middleware.ts:45,55,65,76`
- Observation: `loginUrl.searchParams.set('redirect', path)` stores only
  `req.nextUrl.pathname`. If the user hit `/menu/123?tab=dishes`, after
  login they are bounced to `/menu/123` with `?tab=dishes` dropped.
- Why it matters: Minor UX regression when protected pages use query
  params for deep-linking (filters, pagination, tabs).
- Suggested direction: Preserve the query string too —
  `path + (req.nextUrl.search ?? '')` — then URL-encode safely. Paired
  with REV-02-e, be careful not to re-introduce leakage.
- Confidence: confirmed
- Evidence: Same lines as REV-02-e; `path` is only the pathname.

### REV-02-g: `verifyAdminRequest` header parser is lax
- Severity: low
- Category: correctness
- Location: `apps/web-portal/lib/supabase-server.ts:104-109`
- Observation: `authHeader?.replace('Bearer ', '').trim()` only replaces
  the *first* literal occurrence of `"Bearer "`. It will accept
  headers like `"BEARER <token>"` by matching nothing then passing the
  full string to `getUser(...)` (Supabase rejects it — OK), but also
  silently accept `"Bearer Bearer <token>"` (replaces first `Bearer `
  prefix, leaves the second one as part of the token — Supabase rejects).
  Neither is a security hole, but the parser hides bugs.
- Why it matters: Maintenance — authentication header parsing should be
  predictable and fail loudly on malformed input.
- Suggested direction: Match `/^Bearer (.+)$/i` explicitly, or at minimum
  check `authHeader.startsWith('Bearer ')` before slicing.
- Confidence: confirmed
- Evidence: Line 105.

### REV-02-h: Middleware path guards use `startsWith` without trailing boundary
- Severity: low
- Category: maintainability
- Location: `apps/web-portal/middleware.ts:41,51,61,71`
- Observation: `path.startsWith('/admin')` matches `/administrators`,
  `/adminsomething`, etc. Today the Next.js router has no such routes,
  so this is not exploitable — but a future added route like
  `/admin-info` (public) would inherit the admin-gate unintentionally.
- Why it matters: Brittle; couples route design to middleware string
  match semantics.
- Suggested direction: Check `path === '/admin' || path.startsWith('/admin/')`
  (and likewise for `/onboard`, `/menu`, `/restaurant`). Or lift the
  protected prefix list into an array with explicit boundary matching.
- Confidence: confirmed
- Evidence: Four identical startsWith patterns at lines 41, 51, 61, 71.

### REV-02-i: Documentation drift — CLAUDE.md lists wrong localStorage keys
- Severity: low
- Category: conventions
- Location: `CLAUDE.md:40` vs `apps/web-portal/lib/storage.ts:4` and
  `apps/web-portal/contexts/AuthContext.tsx:143`
- Observation: CLAUDE.md pitfall #3 says "Web portal uses specific keys
  for draft persistence (`restaurant-draft`, `onboarding-step`)."  The
  actual keys are `eatme_draft_${userId}` (user-scoped, JSON blob) —
  no `restaurant-draft` or `onboarding-step` keys exist anywhere in
  `apps/web-portal`.
- Why it matters: CLAUDE.md is a contract with future agents.
  Misdescribed keys lead to incorrect cleanup logic, broken tests that
  stub the wrong key, and wrong advice in future reviews.
- Suggested direction: Update CLAUDE.md to reference
  `eatme_draft_<userId>` and note the user-scoped structure. Or — if
  the intent was to rename to stable, non-user-scoped keys — file a
  separate tracking issue.
- Confidence: confirmed
- Evidence: Grep `restaurant-draft|onboarding-step|eatme_draft_`
  returns three hits, all `eatme_draft_${user.id}` — no hits for the
  CLAUDE.md-named keys.

### REV-02-j: `queueMicrotask` wrapping for error state is opaque
- Severity: low
- Category: maintainability
- Location: `apps/web-portal/app/auth/reset-password/page.tsx:31-34`
- Observation: Missing-token branch defers `setError` and `setVerifying`
  via `queueMicrotask`. There is no comment explaining why — typically
  this pattern sidesteps React's "cannot update state during render"
  warnings when a `useEffect` body runs synchronously on first mount.
- Why it matters: Maintenance footgun. A future reader may "clean it up"
  and re-introduce the warning, or assume the defer is load-bearing
  when it is not.
- Suggested direction: Either drop the wrapper (the surrounding effect
  body is already async via `.then`) or add a one-line comment
  explaining the intent.
- Confidence: confirmed
- Evidence: Lines 31-34.

### REV-02-k: Session recovery leaves user authenticated without resetting password
- Severity: low
- Category: security
- Location: `apps/web-portal/app/auth/reset-password/page.tsx:38-46,64-72`
- Observation: `verifyOtp({ token_hash, type: 'recovery' })` establishes
  a full session before the user has set a new password. If the user
  closes the tab after clicking the reset email link but before
  submitting the form, they remain signed in with their old credentials
  effectively bypassed by possession of a (one-time) email link.
- Why it matters: Password-reset emails should prove control of the
  inbox *and* force a new secret. Granting a pre-password-change session
  weakens the control slightly (though Supabase-standard).
- Suggested direction: Accept as Supabase-standard behaviour, or force
  `supabase.auth.signOut()` on unmount if `password` was never submitted.
  Low priority.
- Confidence: needs-verification
- Evidence: `verifyOtp` return includes a session; no explicit sign-out
  on abandonment.

### REV-02-l: Password minimum length of 6 below modern guidance
- Severity: info
- Category: security
- Location: `apps/web-portal/app/auth/signup/page.tsx:40-42,156,203` and
  `apps/web-portal/app/auth/reset-password/page.tsx:57-59,140,187`
- Observation: Both flows enforce `password.length >= 6`. NIST SP 800-63B
  recommends 8-character minimum for user-chosen passwords.
- Why it matters: Low on a B2B partner app; still worth flagging.
- Suggested direction: Bump to 8 minimum, keep the strength meter labels
  in sync. Also update Supabase dashboard password policy.
- Confidence: confirmed

### REV-02-m: CSP permits `'unsafe-inline'` for scripts
- Severity: info
- Category: security
- Location: `apps/web-portal/middleware.ts:105`
- Observation: `script-src 'self' 'unsafe-inline'`. Comment acknowledges
  Next.js App Router hydration requires it. No nonce/hash-based
  alternative configured.
- Why it matters: Effectively disables CSP as an XSS mitigation.
  Documented constraint — noted for completeness.
- Suggested direction: Move to nonce-based CSP when Next.js 16 support
  stabilises (middleware can inject `<script nonce>` and set the
  `script-src 'self' 'nonce-XXX' 'strict-dynamic'` header). Out-of-scope
  for this review.
- Confidence: confirmed

### REV-02-n: Deprecated `X-XSS-Protection` header still set
- Severity: info
- Category: conventions
- Location: `apps/web-portal/middleware.ts:95`
- Observation: `X-XSS-Protection: 1; mode=block` — no-op in modern
  browsers (Chrome/Edge removed XSS auditor; Firefox/Safari never
  implemented). Can even be harmful in legacy IE.
- Suggested direction: Drop the header.
- Confidence: confirmed

### REV-02-o: `getUser()` fires on every non-static request (including `/api/*`)
- Severity: info
- Category: performance
- Location: `apps/web-portal/middleware.ts:26,122-132`
- Observation: Middleware matcher excludes only static assets, so every
  `/api/*` and every public page triggers `client.auth.getUser()`, which
  Supabase recommends (vs `getSession()` for cookie-only reads) but
  can involve a network round-trip on cold caches.
- Why it matters: Adds latency and Supabase QPS. Acceptable if session
  refresh on every request is the design intent; costly on public,
  un-authenticated hot paths.
- Suggested direction: Narrow the matcher to only paths that need auth
  (`/onboard`, `/menu`, `/restaurant`, `/admin`, `/auth/login`,
  `/auth/signup`) plus optionally `/` if header shows auth-dependent UI.
- Confidence: likely

### REV-02-p: `signOut` only clears the draft key, not other user-scoped storage
- Severity: info
- Category: maintainability
- Location: `apps/web-portal/contexts/AuthContext.tsx:139-150`
- Observation: On sign-out only `eatme_draft_${user.id}` is removed.
  If additional user-scoped keys are introduced later, this list must
  be kept in sync manually.
- Suggested direction: Centralise user-scoped storage enumeration (e.g.
  iterate `localStorage` and remove keys matching a known prefix),
  or move cleanup into `lib/storage.ts`.
- Confidence: confirmed

## No issues found in

- Client-factory pattern: `createBrowserClient` in `lib/supabase.ts`
  correctly passes `process.env.NEXT_PUBLIC_SUPABASE_URL` and
  `...ANON_KEY` explicitly (matches architecture.md contract).
- Boot-time env assertion in `lib/supabase.ts:7-13` (correct pattern).
- PKCE flow wiring: OAuth uses `@supabase/ssr` `exchangeCodeForSession`
  in a route handler rather than implicit-grant parsing in the
  browser — matches Supabase current recommendation.
- Middleware correctly uses `getUser()` (which revalidates the JWT
  via Supabase) rather than `getSession()` (trusts the cookie).
- `app_metadata.role` check (not `user_metadata`) for admin gate —
  correct, comment at `middleware.ts:80-82` spells it out.
- `createServerSupabaseClient` (service-role) is not imported by any
  client-side code paths (grep confirms); throws loudly if envs missing.
- `.env.local` is gitignored (`apps/web-portal/.gitignore:34` —
  `.env*`); `git ls-files` confirms file is not tracked.
- Cookie `setAll` silent-catch in `createSupabaseSessionClient`
  matches Supabase SSR docs for Server Components.
- Auth test coverage for the major middleware branches
  (`apps/web-portal/test/middleware.test.ts`) is solid.

## Follow-up questions

1. Is `NEXT_PUBLIC_SITE_URL` defined in production / preview environments
   (Vercel env)? If yes, it is only missing locally and REV-02-d severity
   drops to low.
2. Does the team consider the Supabase-standard behaviour of establishing
   a session on `verifyOtp({ type: 'recovery' })` acceptable, or would
   they prefer a stricter "sign out on abandonment" posture (REV-02-k)?
3. Is the middleware's global matcher an intentional cost trade-off, or
   was it inherited from a Next.js template (REV-02-o)?
4. Has the team hit real session-loss incidents that the cookie-drop-on-
   redirect pattern (REV-02-b) might explain? Symptoms would be silent
   sign-outs after a long-running tab, reproducible when the access
   token expires exactly across a redirect boundary.
5. What is the intent behind CLAUDE.md's `restaurant-draft` / `onboarding-step`
   references (REV-02-i)? Were those keys planned but never shipped,
   or renamed without updating docs?

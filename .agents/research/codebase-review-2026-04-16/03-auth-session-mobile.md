# REV-03: auth-session-mobile

Mobile auth posture: Expo/Supabase session persistence, native Google Sign-In,
Facebook/browser OAuth, deep-link callbacks, password reset. Read-only pass —
no source edits were made.

## Scope reviewed

- `apps/mobile/App.tsx` (full, 97 lines)
- `apps/mobile/app.json` (full, 66 lines)
- `apps/mobile/.env.example` (full, 51 lines)
- `apps/mobile/src/lib/supabase.ts` (full, 128 lines)
- `apps/mobile/src/lib/googleAuth.ts` (full, 168 lines)
- `apps/mobile/src/stores/authStore.ts` (full, 494 lines)
- `apps/mobile/src/stores/sessionStore.ts` (full, 337 lines)
- `apps/mobile/src/stores/storeBindings.ts` (full, 93 lines)
- `apps/mobile/src/navigation/RootNavigator.tsx` (full, 269 lines)
- `apps/mobile/src/screens/auth/LoginScreen.tsx` (full, 212 lines)
- `apps/mobile/src/screens/auth/RegisterScreen.tsx` (full, 366 lines)
- `apps/mobile/src/screens/auth/ForgotPasswordScreen.tsx` (full, 159 lines)
- `apps/mobile/src/config/environment.ts` (full, 104 lines)
- `packages/database/src/client.ts` (full, 95 lines)
- Cross-reference greps for `Linking`, `secure-store`, `PASSWORD_RECOVERY`,
  `nonce`, `exchangeCodeForSession`, `flowType`.

## Findings

### REV-03-a: Mapbox secret (sk.) token committed in `app.json`
- Severity: critical
- Category: security
- Location: `apps/mobile/app.json:55`
- Observation: `RNMapboxMapsDownloadToken` is hard-coded as
  `"sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg"`.
  Mapbox's `sk.` prefix marks this as a **secret** token (not the public
  `pk.*` access token used at runtime) and these tokens carry scopes such
  as `downloads:read`, `styles:*`, `tokens:write` depending on how they
  were provisioned. `app.json` is a tracked file — this secret is in the
  git history.
- Why it matters: a leaked Mapbox secret token can be used to read/modify
  the owner's Mapbox assets, rotate tokens, and rack up billable usage.
  Unlike `pk.*` (intentionally public), `sk.*` must never ship to clients
  or be committed. Even after rotation, the old value remains in the
  repository's history.
- Suggested direction: revoke the token in the Mapbox dashboard *today*,
  issue a replacement scoped strictly to downloads, and inject it via EAS
  Secrets / Expo env vars at build time (`app.config.ts` reading
  `process.env.EXPO_PUBLIC_MAPBOX_DOWNLOAD_TOKEN`). Consider
  `git filter-repo` / BFG to purge it from history after rotation.
- Confidence: confirmed
- Evidence: line 53–56 of `app.json`: `"RNMapboxMapsDownloadToken":
  "sk.eyJ1..."`. Public token for runtime is a separate `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
  env var (environment.ts:37 validates it begins with `pk.`), so the
  hard-coded `sk.` token here is redundant at best and leaked at worst.

### REV-03-b: Supabase session persisted in plaintext AsyncStorage
- Severity: high
- Category: security
- Location: `apps/mobile/src/lib/supabase.ts:13-17`, `packages/database/src/client.ts:71-94`
- Observation: `getMobileClient(url, anonKey, AsyncStorage)` wires
  `@react-native-async-storage/async-storage` as the auth storage adapter.
  Supabase persists both the access JWT and the long-lived refresh token
  under that adapter. AsyncStorage writes to unencrypted plist/SQLite on
  iOS and unencrypted SharedPreferences/SQLite on Android.
- Why it matters: refresh tokens are bearer credentials with ~60-day
  lifetime by default. Anything that can read app sandbox storage
  (jailbroken/rooted device, malicious root-enabled backup, forensic
  extraction, another app exploiting a chain) can exfiltrate them and
  mint access JWTs indefinitely until the user explicitly signs out. A
  repository-wide search confirms no use of `expo-secure-store` or the
  Keychain/Keystore anywhere in the mobile app.
- Suggested direction: wrap `expo-secure-store` (iOS Keychain, Android
  Keystore) in an AsyncStorage-shaped adapter and pass that to
  `getMobileClient`. `SecureStore.getItemAsync`/`setItemAsync` already
  match the `{getItem,setItem,removeItem}` contract after trivial
  async-wrapping. Note SecureStore has a 2 KB value cap so the session
  JSON may need to be chunked or split (access+refresh under separate
  keys).
- Confidence: confirmed
- Evidence: `Grep "secure-store|SecureStore|expo-secure-store"` over
  `apps/mobile/` returns no files. `client.ts:88` stores whatever
  adapter the caller supplied without warning.

### REV-03-c: Facebook (browser) OAuth parses hash tokens but supabase-js default is PKCE
- Severity: high
- Category: correctness
- Location: `apps/mobile/src/stores/authStore.ts:416-453`
- Observation: after `WebBrowser.openAuthSessionAsync(data.url, …)`
  returns, the code does `const params = new URLSearchParams(url.hash.substring(1))`
  and pulls `access_token` / `refresh_token` from the **hash fragment**
  (classic implicit-grant pattern). The Supabase client created at
  `packages/database/src/client.ts:86-93` passes no `flowType` override,
  and supabase-js 2.x defaults to `flowType: 'pkce'`, which returns
  `?code=<uuid>` in the query string — no tokens in the hash.
- Why it matters: Facebook sign-in (and any future browser-based OAuth
  provider) silently does nothing on success. The branch at
  `authStore.ts:448-452` then throws `"No access token received from OAuth
  provider"` — users see `t('login.authFailed')`. Native Google sign-in
  uses `signInWithIdToken` and is unaffected. Supporting docs already
  identify this exact failure (see
  `.agents/planning/2026-04-12-auth-flow-review/research/auth-flow-findings.md:66-72`
  and `summary.md:37`).
- Suggested direction: branch on the callback URL: if
  `url.searchParams.get('code')` is present, call
  `supabase.auth.exchangeCodeForSession(code)` (PKCE); otherwise fall
  back to the existing hash-token setSession for legacy implicit flow.
  Matches the web portal's callback handler in
  `apps/web-portal/app/auth/callback/route.ts`.
- Confidence: confirmed
- Evidence: authStore.ts:424 `new URLSearchParams(url.hash.substring(1))`
  and absence of any `exchangeCodeForSession` call under `apps/mobile/`
  (grep returned no matches); prior review in
  `.agents/planning/2026-04-12-auth-flow-review/` confirms same defect.

### REV-03-d: `eatme://reset-password` deep link has no handler
- Severity: high
- Category: correctness
- Location: `apps/mobile/src/stores/authStore.ts:273`
- Observation: `resetPassword(email)` tells Supabase to send a reset email
  with `redirectTo: 'eatme://reset-password'`, but the app does not
  register any `Linking.addEventListener` nor any
  `supabase.auth.onAuthStateChange((event)=>{ if event === 'PASSWORD_RECOVERY' … })`
  handler. The only `onAuthStateChange` listener is in
  `authStore.ts:129-141` and it only syncs `session`/`user`. No screen in
  `apps/mobile/src/screens/auth/` updates the password after a reset link
  tap; `ForgotPasswordScreen.tsx` is only for requesting the email.
- Why it matters: the user taps the reset link in the email → the app
  opens (because of the `eatme://` intent filter) → the password
  recovery session is activated → nothing happens. The user sees the
  home screen and is fully signed in on the recovery session but there is
  no "enter new password" screen. The feature is effectively non-functional.
- Suggested direction: add a `PASSWORD_RECOVERY` branch in the
  `onAuthStateChange` listener that pushes a new `ResetPassword` screen,
  which calls `supabase.auth.updateUser({ password })` then signs the
  user out (to force a fresh password-based sign-in). Mirror the pattern
  in the web portal.
- Confidence: confirmed
- Evidence: grep `reset-password|PASSWORD_RECOVERY` across
  `apps/mobile/` returns only the single `redirectTo` string and
  `ForgotPasswordScreen` (the requester screen, not a handler).

### REV-03-e: `startSession` called once at app mount — no-op for later sign-ins
- Severity: medium
- Category: correctness
- Location: `apps/mobile/App.tsx:71-77`, `apps/mobile/src/stores/sessionStore.ts:81-127`
- Observation: `App.tsx` fires `loadFromStorage()` + `startSession()`
  from a `useEffect` with `[]` deps. `startSession()` returns early if
  `supabase.auth.getUser()` is null (sessionStore.ts:86-89). The effect
  never re-runs when the user subsequently signs in, so
  `currentSessionId` remains `null` forever for users who launch the app
  signed-out and then log in. Every downstream call to `trackView` then
  skips the DB insert (sessionStore.ts:169 gates on `currentSessionId`).
- Why it matters: session views (which feed the rating-prompt logic) are
  never persisted to `user_sessions` / `session_views` for first-time
  sign-ins — the most important cohort. Local state still works because
  local `trackView` mutates `views` and `recentRestaurants` regardless,
  but the rating-recommendation queries in `dishRatingService` /
  `ratingService` (if they read server-side views) would see nothing.
- Suggested direction: subscribe to auth state in `storeBindings.ts`
  (which already handles login transitions) and call
  `useSessionStore.getState().startSession()` on the null→id transition.
  Remove the eager `startSession()` from `App.tsx`.
- Confidence: confirmed
- Evidence: App.tsx useEffect has `[]` deps; `sessionStore.startSession`
  early-returns when `user` is null; `storeBindings.ts` handles
  login transitions but does not call `startSession`.

### REV-03-f: Google ID-token exchange lacks nonce (replay protection)
- Severity: medium
- Category: security
- Location: `apps/mobile/src/lib/googleAuth.ts:57-61, 93-118`
- Observation: `GoogleSignin.configure({ webClientId, offlineAccess: false, scopes: [...] })`
  is called without a `nonce`, and `supabase.auth.signInWithIdToken({
  provider: 'google', token: idToken })` is invoked without passing
  `nonce`. Supabase documents the secure pattern as:
  generate a random `rawNonce`, pass `hashedNonce` to the Google SDK,
  pass `rawNonce` to `signInWithIdToken({ nonce: rawNonce })` so Supabase
  validates the claim against the nonce baked into the Google ID token.
- Why it matters: without a nonce, any party that captures an idToken
  (e.g. MITM on an outdated TLS stack, shared device token log, a buggy
  third-party SDK that logs network traffic) can replay it against
  Supabase up to the token's `exp` (Google default 1 h) to mint a Supabase
  session for the victim account. Nonce binding prevents replay by
  coupling the ID token to the current sign-in attempt.
- Suggested direction: generate `rawNonce = Crypto.randomUUID()`, compute
  `hashedNonce = sha256(rawNonce)`, pass `hashedNonce` via
  `GoogleSignin.configure({ …, hashedNonce })`, and pass `rawNonce` in
  `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce })`.
- Confidence: likely
- Evidence: grep `nonce` returned no hits in `apps/mobile/`. Supabase
  docs explicitly call out the pattern for native Google sign-in.

### REV-03-g: Android deep-link hijack surface — custom scheme + autoVerify misuse
- Severity: medium
- Category: security
- Location: `apps/mobile/app.json:23-35`
- Observation: Android intent filter declares `"scheme": "eatme"` with
  `autoVerify: true` and host `"*"`. Android's `autoVerify` only binds a
  scheme to this app when it is `http`/`https` and the server publishes
  `/.well-known/assetlinks.json`. For custom schemes (`eatme://`)
  autoVerify is ignored; any other app may declare the same intent
  filter. The app's Facebook OAuth callback still transports tokens over
  `eatme://auth/callback#access_token=…` (see REV-03-c).
- Why it matters: a malicious app installed alongside EatMe can register
  the same `eatme://` scheme and intercept the OAuth redirect, reading
  access/refresh tokens from the URL. The common mitigation is **Android
  App Links** on `https://eatme.app/auth/callback` with `assetlinks.json`,
  or switching to PKCE (REV-03-c) so the intercepted value is a
  one-shot, device-bound `code` rather than bearer tokens.
- Suggested direction: once REV-03-c is fixed (PKCE), the custom scheme
  hijack reduces to a code-interception attack on a code verifier the
  attacker does not possess — significantly lower impact. Longer term,
  add an https App Link.
- Confidence: likely
- Evidence: app.json:27 `autoVerify: true`; Android docs confirm
  autoVerify is http/https only. The scheme host is `*` which accepts
  any host, widening the surface.

### REV-03-h: `updatePassword` does not require a fresh session / old password
- Severity: medium
- Category: security
- Location: `apps/mobile/src/stores/authStore.ts:294-318`
- Observation: `updatePassword(newPassword)` calls
  `supabase.auth.updateUser({ password: newPassword })` directly. There
  is no re-auth with the current password, no "Reauthentication Required"
  gate, and no reauth-token flow (`supabase.auth.reauthenticate()`).
- Why it matters: an attacker who briefly obtains the device (unlocked,
  short window) can change the victim's password in one tap, locking
  them out of both mobile and web. Standard pattern is to prompt for
  the current password or require a fresh session (within 5 minutes of
  a password sign-in).
- Suggested direction: add a "confirm current password" modal that calls
  `supabase.auth.signInWithPassword` with the current creds and only on
  success invokes `updateUser({ password })`. Alternatively enable
  "Reauthentication" in Supabase Auth settings and use
  `supabase.auth.reauthenticate()` + `updateUser({ password, nonce })`.
- Confidence: likely
- Evidence: authStore.ts:299-301 invokes `updateUser({ password })`
  without preconditions. Profile edit flow appears to call this via
  `useAuthStore().updatePassword`.
- Needs-verification: whether a reauth-before-sensitive-update gate is
  enforced at the Supabase dashboard level. If enabled server-side the
  client receives a specific error and the risk downgrades to low.

### REV-03-i: `setSession` exposed as a public store action
- Severity: low
- Category: security
- Location: `apps/mobile/src/stores/authStore.ts:67-68, 476-480`
- Observation: `setSession(session: Session | null)` is listed as part of
  `AuthActions` and returned from `useAuthStore(...)` — any component in
  the tree can overwrite `session` / `user` without going through any
  Supabase call.
- Why it matters: if a future contributor uses it to "optimistically" set
  a session, the Supabase client's internal storage can drift from the
  Zustand view of who is signed in. Not currently exploited (grep shows
  no call sites outside the listener), but a footgun.
- Suggested direction: remove it from the public surface — the internal
  `onAuthStateChange` handler already mutates state directly via `set()`.
- Confidence: confirmed
- Evidence: authStore.ts:67 (interface), 476 (impl). No external callers
  found in grep.

### REV-03-j: `signOutFromGoogle` called without `await`
- Severity: low
- Category: correctness
- Location: `apps/mobile/src/stores/authStore.ts:253-257`
- Observation: `signOutFromGoogle()` is invoked but not awaited; the
  store immediately returns. Internally the helper swallows errors via
  `console.warn` (googleAuth.ts:164-166), so failures go unsurfaced.
- Why it matters: if the Google SDK fails to clear its cached account
  (e.g. Play Services error), the next sign-in silently reuses the prior
  account — the very scenario the call is supposed to prevent.
- Suggested direction: `await signOutFromGoogle()` before `return`.
  Since it already catches internally, the outer flow won't throw.
- Confidence: confirmed
- Evidence: line 255 `signOutFromGoogle();` — bare call.

### REV-03-k: Password policy silently truncates at 72 bytes (bcrypt)
- Severity: low
- Category: correctness
- Location: `apps/mobile/src/screens/auth/RegisterScreen.tsx:50-64`,
  `apps/mobile/src/stores/authStore.ts:293-317`
- Observation: `validatePassword` enforces a min of 8 chars + complexity
  but no max length. Supabase hashes passwords with bcrypt, which
  silently truncates input at 72 bytes. A user who enters a
  100-character passphrase ends up with a 72-byte hash and any prefix
  match of those 72 bytes will authenticate.
- Why it matters: users with long passphrases may believe they have
  higher entropy than they do. Also: a user changing from a
  90-character passphrase to a different 90-character passphrase whose
  first 72 bytes match the old one will be unable to sign in with the
  new one but the old one still works — a UX puzzle box.
- Suggested direction: cap `maxLength` on the password TextInput at 72
  (or 64 for a conservative margin) and show the user a count.
  Alternatively validate at server-side with a helpful error.
- Confidence: confirmed
- Evidence: RegisterScreen.tsx:50-64 has no length cap; TextInput at
  line 213-222 has no `maxLength` prop.

### REV-03-l: LoginScreen email input is uncontrolled
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/screens/auth/LoginScreen.tsx:101-110`
- Observation: the email TextInput has `onChangeText={setEmail}` but no
  `value={email}` prop (contrast RegisterScreen.tsx:196-207 which is
  fully controlled). The component is "uncontrolled with state" — state
  is updated but React doesn't control the rendered value.
- Why it matters: if any code path resets `email` programmatically (e.g.
  after a failed attempt), the UI will not reflect it. Minor footgun;
  also inconsistent with the rest of the app.
- Suggested direction: add `value={email}`. One line.
- Confidence: confirmed
- Evidence: LoginScreen.tsx:101-110 shows no `value=` prop.

### REV-03-m: `editable` on inputs uses `isLoading`, buttons use `isButtonDisabled`
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/screens/auth/LoginScreen.tsx:109,125,188`,
  `apps/mobile/src/screens/auth/RegisterScreen.tsx:188,205,221,268,302,339`
- Observation: text inputs are gated by `editable={!isLoading}` whereas
  action buttons are gated by `isButtonDisabled = isLoading || oauthLoading`.
  During an OAuth flow, users can keep typing in the form even though
  the submit button is disabled.
- Why it matters: minor UX inconsistency. Can cause confusion if the
  user types while OAuth is in progress and then the OAuth succeeds —
  their form state is stale.
- Suggested direction: use `isButtonDisabled` (or a dedicated
  `isAnyAuthInFlight`) for both. Consistent gating.
- Confidence: confirmed
- Evidence: LoginScreen.tsx:74 defines `isButtonDisabled` but uses
  `isLoading` for `editable`.

### REV-03-n: `authListenerSubscription` held in module-level `let`
- Severity: info
- Category: maintainability
- Location: `apps/mobile/src/stores/authStore.ts:16`
- Observation: listener subscription is held as
  `let authListenerSubscription: Subscription | null = null;` at module
  scope. The store never unsubscribes (no teardown path in `initialize`).
- Why it matters: in production this is fine because `initialize` is
  called once in RootNavigator. Under Fast Refresh during dev the module
  may be re-evaluated without calling `subscription.unsubscribe()`,
  leaking listeners across hot reloads. Not a production bug.
- Suggested direction: capture the subscription inside the store slice
  and expose a `disposeListener` action, or call `.unsubscribe()` in a
  cleanup returned from `initialize`.
- Confidence: confirmed
- Evidence: authStore.ts:16, 125-141 — no unsubscribe code anywhere.

### REV-03-o: Non-atomic `isInitialized` guard in `initialize()`
- Severity: info
- Category: correctness
- Location: `apps/mobile/src/stores/authStore.ts:90-96`
- Observation: `initialize` reads `state.isInitialized` synchronously but
  sets it only at the end of the async path (line 121). Two parallel
  callers both see `isInitialized=false` and both proceed into the async
  body, attaching two listeners.
- Why it matters: `RootNavigator` is the only caller today (guarded by
  `useRef`), so the race is not reachable. It is a latent footgun if a
  second caller is added later.
- Suggested direction: flip the flag before the `await` (pessimistic
  guard) or wrap the entire initializer in a module-level
  `Promise`-memoised singleton.
- Confidence: confirmed
- Evidence: authStore.ts:90-96 — guard at top, mutation at bottom.

### REV-03-p: `debugLog` includes user-identifying OAuth URLs
- Severity: info
- Category: security
- Location: `apps/mobile/src/stores/authStore.ts:414`
- Observation: `debugLog` logs the full Facebook OAuth URL
  (`data.url`) which contains the PKCE code challenge / nonce / state.
  `debugLog` is gated by `ENV.app.debug && isDevelopment()` so production
  builds are safe; in dev it prints sensitive values to Metro console.
- Why it matters: not a production risk, but a shared screen-record or
  shoulder-surf during development could leak a challenge value. Minor.
- Suggested direction: log the hostname only, or omit URL logging
  entirely.
- Confidence: confirmed
- Evidence: authStore.ts:414 `debugLog(`[Auth] Opening ${provider} OAuth URL:`, data.url)`.

## No issues found in

- `configureGoogleSignIn` idempotency and double-configuration pattern
  (lines 45-64) — reasoned about and documented, no defect.
- `initialize` caches the listener via `authListenerSubscription` — no
  double-subscription risk (the `if (!authListenerSubscription)` guard
  holds for the sole initialize call site).
- `signIn` / `signUp` input handling — trimming, casing, keyboard types
  correct.
- `getOAuthRedirectUrl` uses `Linking.createURL('auth/callback')` which
  expands to `eatme://auth/callback` correctly for the app's scheme.
- `ForgotPasswordScreen` email validation (regex at line 38) is adequate
  for the typical input class and also trims before use.
- RegisterScreen password strength meter calculation (lines 131-149) —
  no off-by-one, buckets monotonic.
- `initializeStoreBindings` 30-minute debounce math (storeBindings.ts:30-90)
  — Number() coercion, Math.max with in-memory value, null-safe.
- `environment.ts` coordinate validation (lat -90..90, lng -180..180) is
  correctly ordered.
- `detectSessionInUrl: false` in `getMobileClient` is correct for mobile
  — the app handles callbacks manually (modulo REV-03-c).

## Follow-up questions

1. **Is the Supabase project still on implicit flow for mobile?** If
   yes, REV-03-c is a silent bug waiting to happen once the next
   supabase-js bump lands; if no, REV-03-c is already breaking Facebook
   sign-ins today and QA should have traces.
2. **Has "Reauthentication Required" been enabled in Supabase Auth for
   password updates?** If yes, REV-03-h downgrades to low. Dashboard
   inspection required.
3. **What is the TTL set for refresh tokens?** Supabase default is 30
   days, but the setting is per-project. A 60-day TTL materially
   increases REV-03-b's blast radius.
4. **Does the Mapbox `sk.` token in app.json belong to a scoped
   download-only token, or a full-privilege token?** Dashboard check
   required to size REV-03-a blast radius — either way rotation is
   urgent.
5. **Is there a native Facebook SDK integration planned** (mirror of the
   native Google integration)? If so, REV-03-c only needs a short-term
   PKCE patch; if Facebook via browser is here to stay, the fix must be
   production-ready.

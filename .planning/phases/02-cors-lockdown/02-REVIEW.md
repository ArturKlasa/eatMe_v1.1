---
phase: 02-cors-lockdown
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - infra/supabase/functions/_shared/cors.ts
  - infra/supabase/functions/_shared/cors.test.ts
  - infra/supabase/functions/feed/index.ts
  - infra/supabase/functions/enrich-dish/index.ts
  - infra/supabase/functions/invalidate-cache/index.ts
  - infra/supabase/functions/README.md
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 2 replaces three wildcard `Access-Control-Allow-Origin: *` constants with a shared,
allowlist-reflecting `buildCorsHeaders(origin)` helper across the `feed`, `enrich-dish`, and
`invalidate-cache` edge functions. The security-critical contract is implemented correctly:

- **Exact-match only** — `allowlist.includes(origin)` is a strict string equality check; no
  regex, substring, or subdomain logic exists, so no bypass vector (`evil-eat-me-v1-1-admin.vercel.app`
  etc.) is reachable. Verified against the disallowed-origin test case.
- **Genuinely fail-closed** — unset/empty `ALLOWED_ORIGINS` collapses to `[]` via
  `(… ?? '').split(',').filter(Boolean)`, so `includes()` is always false and ACAO is omitted.
  Never falls back to `*`. Verified by the unset-env unit test.
- **No wildcard reachable** — `'Access-Control-Allow-Origin'` is only ever assigned the verbatim
  matched origin; there is no `*` literal anywhere in the new code path.
- **No `Access-Control-Allow-Credentials`** — correctly omitted; reflecting an origin with
  credentials would be a token-theft vector, and auth is bearer-JWT not cookie-based.
- **`Vary: Origin` always present** — set unconditionally on the base header object, so it survives
  every branch (allowed, disallowed, no-origin, unset-env). Correct for cache-poisoning prevention.
- **Per-request `corsHeaders` reaches every response site** — verified by line-by-line trace: in all
  three functions `const corsHeaders = buildCorsHeaders(...)` is the first statement of the `serve`
  handler, and every `new Response` (OPTIONS preflight, main success, every validation/error branch,
  and the outer `catch`) spreads `...corsHeaders`. No response is emitted before the declaration; all
  catch blocks are nested inside the handler scope, so `corsHeaders` is always in lexical scope. The
  `feed` `compressedJsonResponse(responseData, corsHeaders)` helper receives it as an explicit
  argument — no stale closure.

No critical issues. The findings below are robustness/quality observations on the new helper and test;
none of them weaken the SEC-01 contract.

## Warnings

### WR-01: `Origin` request header read with capitalized key — relies on case-insensitive `Headers.get`

**File:** `infra/supabase/functions/feed/index.ts:703`, `infra/supabase/functions/enrich-dish/index.ts:104`, `infra/supabase/functions/invalidate-cache/index.ts:46`
**Issue:** All three handlers read the request origin via `req.headers.get('Origin')` (capital O).
The Fetch `Headers.get()` API is case-insensitive, so this *currently* works correctly against the
real lowercase `origin` header browsers send. However, the same `Origin` casing is then used as the
reflected *value* (passed through to `Access-Control-Allow-Origin`), which is fine, but the reliance
on case-insensitive lookup is an undocumented invariant. If this code is ever ported to a runtime or
mock where header lookup is case-sensitive (and the `cors.test.ts` exercises only the *helper*, never
the `req.headers.get('Origin')` call site), the allowlist match silently breaks and every browser
request becomes fail-closed (no ACAO) — a hard-to-diagnose outage rather than a security hole. Lower
severity than a security bug, but it is an untested integration seam introduced this phase.
**Fix:** Either standardize on the canonical lowercase header name to match what is on the wire:
```ts
const corsHeaders = buildCorsHeaders(req.headers.get('origin'));
```
or add one integration-level assertion (even a `new Headers([['origin', ALLOWED]])` round-trip) so the
case-insensitivity assumption is pinned by a test rather than left implicit.

## Info

### IN-01: Helper recomputes the allowlist (env read + split + map + filter) on every request

**File:** `infra/supabase/functions/_shared/cors.ts:22-25`
**Issue:** `buildCorsHeaders` parses `ALLOWED_ORIGINS` from scratch on every invocation. This is a
correctness-neutral observation (per-request env read actually makes secret rotation take effect
without a redeploy, which is arguably desirable, and performance is out of v1 scope). Noted only so a
future "optimize by hoisting to module scope" change is made deliberately — hoisting would freeze the
allowlist at cold-start and silently defeat live secret rotation.
**Fix:** No change required. If hoisted later, document that a secret change then requires a function
restart/redeploy.

### IN-02: `cors.test.ts` does not assert `Access-Control-Allow-Methods` / `Allow-Headers` on the disallowed/no-origin/unset paths

**File:** `infra/supabase/functions/_shared/cors.test.ts:36-66`
**Issue:** The disallowed-origin, no-origin, and unset-env cases assert only that ACAO is absent and
(for two of them) that `Vary` is present. They do not assert that `Access-Control-Allow-Headers` and
`Access-Control-Allow-Methods` are *still emitted* on these paths. The README (line 83) promises these
are "present on every response," but the test would not catch a regression that dropped them for
non-allowed origins (which would break legitimate preflights from the allowed origin if the branch
logic were ever refactored).
**Fix:** Add `assertEquals(h['Access-Control-Allow-Methods'], 'POST, GET, OPTIONS')` and the
allow-headers assertion to at least one non-allowed-origin case, or factor a shared
`assertBaseHeaders(h)` helper invoked by all four cases.

### IN-03: README lists `Access-Control-Allow-Methods` as "always emitted" but does not state its value

**File:** `infra/supabase/functions/README.md:83`
**Issue:** The doc enumerates the always-present headers and gives the literal value for
`Access-Control-Allow-Headers` but writes `Access-Control-Allow-Methods` without its value
(`POST, GET, OPTIONS`). Minor doc/code drift risk: an operator debugging a preflight cannot confirm
the expected methods from the README alone.
**Fix:** State the value, e.g. `…, `Access-Control-Allow-Methods: POST, GET, OPTIONS`, and `Vary: Origin``.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

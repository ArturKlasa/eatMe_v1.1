# Phase 2: CORS Lockdown - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 02-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 2-cors-lockdown
**Areas discussed:** Allowlist source & origins, Code structure (shared vs inline), Other 4 wildcard functions, Disallowed-origin & header contract

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist source & origins | Env config + which origins (admin prod vs localhost) | ✓ |
| Code structure (shared vs inline) | One _shared/cors.ts vs inline per function | ✓ |
| Other 4 wildcard functions | Strict 3 vs extend to all wildcard functions | ✓ |
| Disallowed-origin & header contract | Unknown-origin response, env fallback, methods header | ✓ |

**User's choice:** All four areas.

---

## Allowlist source & origins

| Option | Description | Selected |
|--------|-------------|----------|
| Env var (comma-separated) | `ALLOWED_ORIGINS` read at runtime, split on comma; operator-configurable | ✓ |
| Hardcoded constant | const array baked into code | |
| Single origin env var | One `ADMIN_ORIGIN`, exact match only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Local only (localhost:3001) | Admin never deployed | |
| Deployed to a domain | Admin at a fixed prod URL only | |
| Both local + deployed | localhost:3001 + a deployed origin | ✓ |

**User's choice:** Env var (`ALLOWED_ORIGINS`, comma-separated); admin served from both local and deployed.
**Notes:** Deployed admin origin provided as free text: `eat-me-v1-1-admin.vercel.app` → allowlist = `https://eat-me-v1-1-admin.vercel.app` + `http://localhost:3001`. Vercel preview-deploy origins knowingly excluded (no wildcard-subdomain matching this phase) — recorded as a known limitation.

---

## Code structure (shared vs inline)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared _shared/cors.ts | One module, relative-imported into all 3 functions | ✓ |
| Inline per function | Copy the helper into each function (current convention) | |

**User's choice:** Shared `infra/supabase/functions/_shared/cors.ts`.
**Notes:** First `_shared/` module in the repo. Planner must confirm Supabase bundles underscore-folder imports on `functions deploy`; fall back to inline if not.

---

## Other 4 wildcard functions

| Option | Description | Selected |
|--------|-------------|----------|
| Lock only the 3 (strict SEC-01) | feed, enrich-dish, invalidate-cache; defer the rest | ✓ |
| Lock all wildcard functions now | Apply shared helper to all 7 | |
| Lock 3 + audit the rest | Lock 3, classify the other 4 for browser-reachability | |

**User's choice:** Strict SEC-01 — lock only the 3 named.
**Notes:** Other 4 (`app-config`, `group-recommendations`, `update-preference-vector`, `batch-update-preference-vectors`) recorded as a deferred follow-up / insert-phase candidate.

---

## Disallowed-origin & header contract

| Option | Description | Selected |
|--------|-------------|----------|
| Omit ACAO, serve normally | Disallowed browser origin → 200 with no Access-Control-Allow-Origin | ✓ |
| Hard 403 reject | Explicitly 403 disallowed browser origins | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed (empty allowlist) | Unset env → no ACAO; mobile/no-Origin still works | ✓ |
| Fail-open (fall back to '*') | Unset env → wildcard | |
| Throw 500 on missing config | Unset env → function refuses to serve | |

| Option | Description | Selected |
|--------|-------------|----------|
| Add explicit Allow-Methods | Add Access-Control-Allow-Methods (POST, OPTIONS, +GET) | ✓ |
| Keep current header set | Allow-Origin + Allow-Headers only | |

**User's choice:** Omit ACAO + serve normally on disallowed origin; fail-closed on unset env; add explicit Allow-Methods.
**Notes:** No-Origin (mobile/curl) case is locked by SC#2 — proceed, omit ACAO, auth via JWT. `Vary: Origin` always emitted. `Access-Control-Allow-Credentials` omitted (bearer-JWT auth, not cookies).

---

## Claude's Discretion

- Exact helper name/signature; single object vs split preflight/response helpers.
- Optional `Access-Control-Max-Age` preflight caching.
- Deno test shape exercising allowed / disallowed / no-Origin / unset-env cases.

## Deferred Ideas

- Lock the other 4 wildcard edge functions (follow-up / insert-phase).
- Vercel preview-deployment origin matching (wildcard-subdomain).
- `Access-Control-Max-Age` preflight caching.

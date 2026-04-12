# Auth Flow Audit — Summary

**Date:** 2026-04-12  
**Scope:** Web portal + mobile app authentication code vs. `docs/project/workflows/auth-flow.md`

## Artifacts Created

```
.agents/planning/2026-04-12-auth-flow-review/
├── rough-idea.md               — scope definition
├── idea-honing.md              — task framing
├── research/
│   ├── auth-flow-findings.md  — full annotated findings (13 issues)
│   └── new-user-creation.md   — DB trigger gaps + new user flow analysis
├── design/
│   └── detailed-design.md     — fix specifications with code snippets
├── implementation/
│   └── plan.md                — 11-step ordered implementation plan
└── summary.md                 — this file
```

## Critical Issues (fix before shipping)

### 🔴 1. Middleware is dead code
`apps/web-portal/proxy.ts` has the right logic but the wrong filename. Next.js never executes it. All edge-level route protection, session refresh, and admin role enforcement are bypassed.

**Fix:** Rename `proxy.ts` → `middleware.ts` and rename the exported function to `middleware`.

### 🔴 2. Admin privilege escalation via `user_metadata`
Both `callback/route.ts` and `proxy.ts` check `user_metadata.role` for admin access. `user_metadata` is writable by any authenticated user via `supabase.auth.updateUser()`. Any user can promote themselves to admin from the browser console.

**Fix:** Change all admin checks to `app_metadata.role` (which only the service role can write).

## High Issues

### 🟠 3. Mobile Facebook OAuth silently fails with PKCE
Token extraction reads `#access_token` from the URL hash (implicit flow pattern). PKCE returns `?code=` instead. Facebook logins on mobile will fail silently.

### 🟠 4. Mobile email verification link opens web, not app
`signUp` on mobile doesn't set `emailRedirectTo`. Supabase falls back to the project's site URL (web portal). Users are sent to the browser after verifying.

### 🟠 5. Post-login `?redirect` param is ignored
The proxy correctly appends `?redirect=/original/path` when bouncing users to login. The login page always redirects to `/`, losing the destination.

## Medium Issues

- **Double render on web mount** — `getSession()` + `onAuthStateChange` INITIAL_SESSION both fire; simplify to one listener
- **`ProtectedRoute` has no role check** — any authenticated user can reach `/admin` UI client-side once middleware is fixed
- **Web `signUp` always shows "check email"** — doesn't distinguish auto-login vs. email confirmation required

## Low / Doc Issues

- Unsafe type cast in `storage.ts:clearIfStale`
- Facebook OAuth Supabase prerequisites not documented
- `isLoading` not reset in mobile `onAuthStateChange` reactive listener
- `/` (dashboard) not edge-protected by proxy

## Next Steps

1. Fix the two critical issues immediately — they're both quick renames/replacements
2. Fix issues 3–5 before mobile Facebook OAuth or any deep-link verification is tested
3. Address medium issues in the next sprint
4. Update `docs/project/workflows/auth-flow.md` to reflect the correct admin role field (`app_metadata` vs `user_metadata`)

## Ralph Handoff

To implement fixes, start the implementation loop:

```
ralph run --config presets/pdd-to-code-assist.yml --prompt "Fix auth flow issues documented in .agents/planning/2026-04-12-auth-flow-review/design/detailed-design.md — start with the two CRITICAL items (middleware filename, app_metadata role check)"
```

Or:
```
ralph run -c ralph.yml -H builtin:pdd-to-code-assist -p "Fix auth flow issues documented in .agents/planning/2026-04-12-auth-flow-review/design/detailed-design.md"
```

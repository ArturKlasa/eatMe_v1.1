---
type: quick
quick_id: 260628-vcd
slug: items-1-2-5-delete-dead-and-duplicate-co
status: complete
created: 2026-06-29
completed: 2026-06-29
---

# Summary: Delete dead/duplicate code (audit items 1, 2, 5)

Removed three confirmed-dead/duplicate findings from the over-engineering audit.
All grep-verified; no behavior change.

## Changes

1. **`scripts/test-ingredient-resolver.mjs`** — deleted. Imported the deleted
   `apps/web-portal/.env.local`, ingredient pipeline retired (Phase A), zero
   `package.json` references.

2. **Admin auth wrappers** — dropped the four variants whose only callers were
   their own tests:
   - `apps/admin/src/lib/auth/wrappers.ts`: removed `withAuth`, `withPublic`
     (kept `withAdminAuth` + `ActionResult` / `AuthCtx` / `SupabaseClient`).
   - `apps/admin/src/lib/auth/route-wrappers.ts`: removed `withAuthRoute`,
     `withPublicRoute`, and the now-orphaned `PublicRouteHandler` type
     (kept `withAdminAuthRoute` + `RouteHandler`).
   - `apps/admin/src/__tests__/lib/auth/wrappers.test.ts`: dropped the `withAuth`
     / `withPublic` describe blocks + trimmed the import.
   - `apps/admin/scripts/check-auth-wrappers.ts`: trimmed `APPROVED_WRAPPERS` to
     the two surviving admin wrappers (also tightens policy: admin actions must
     be admin-gated).

   Note: **`apps/web-portal-v2` has its own copy** of these wrappers and uses all
   four legitimately — left untouched. The shared eslint rule in
   `packages/eslint-config-eatme` still recognizes all four names for v2 — left
   untouched.

3. **`apps/web-portal-v2/proxy.ts`** (root) — deleted as a duplicate of
   `src/proxy.ts` (arrow-vs-`function` only). Neither is wired as middleware;
   `src/` matches v2's layout and owns the test.

## Verification

- `apps/admin` unit suite: **165 passed (18 files)**.
- `apps/admin` `tsc --noEmit`: clean (no orphaned references).
- Residual-reference sweep for the deleted symbols/files: clean (remaining hits
  are all in `apps/web-portal-v2/` own tree + the shared eslint rule, by design).
- `pnpm audit:auth` (wired gate, non-strict): exit 0.

## Not done (deliberately)

Audit items 3, 4, 6, 7, 8, 9 — evaluated and either kept (abstraction earns its
keep) or deferred as low-priority. See the audit evaluation for rationale.

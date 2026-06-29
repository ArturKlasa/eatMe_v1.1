---
type: quick
quick_id: 260628-vcd
slug: items-1-2-5-delete-dead-and-duplicate-co
status: in-progress
created: 2026-06-29
---

# Quick Task: Delete dead/duplicate code (audit items 1, 2, 5)

Remove confirmed-dead and duplicate code surfaced by the over-engineering audit.
Each item verified against the codebase before inclusion.

## Tasks

1. **Delete `scripts/test-ingredient-resolver.mjs`** — dead. Imports the deleted
   `apps/web-portal/.env.local`, ingredient pipeline retired (Phase A), zero
   `package.json` references.

2. **Remove 4 unused auth wrappers** — only callers are their own tests.
   - `apps/admin/src/lib/auth/wrappers.ts`: drop `withAuth`, `withPublic`.
     Keep `withAdminAuth`, `ActionResult`, `AuthCtx`, `SupabaseClient`.
   - `apps/admin/src/lib/auth/route-wrappers.ts`: drop `withAuthRoute`,
     `withPublicRoute`, and the now-orphaned `PublicRouteHandler` type.
     Keep `withAdminAuthRoute` + its `RouteHandler` type.
   - `apps/admin/src/__tests__/lib/auth/wrappers.test.ts`: drop the `withAuth`
     and `withPublic` describe blocks + their imports. Keep `withAdminAuth`.

3. **Delete `apps/web-portal-v2/proxy.ts`** (root) — duplicate of `src/proxy.ts`
   (arrow-vs-fn only); neither is wired as middleware, src/ matches v2 layout.

## Gate

- `cd apps/admin && npx vitest run` (the real admin gate)
- `cd apps/admin && npx tsc --noEmit` (no orphaned references)
- grep sweep: zero residual references to the deleted symbols/files.

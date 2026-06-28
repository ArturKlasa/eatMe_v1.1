---
quick_id: 260628-dvt
slug: delete-dead-code-token-css-generator-get
date: 2026-06-28
status: complete
tasks_completed: 4
tasks_total: 4
files_changed: 11
commits:
  - b2d46bd chore(tokens) remove dead css-vars generator
  - 0f574c7 chore(database) remove deprecated unused getWebClient
  - 191b82e chore(shared) remove dead isAdmin + isDiscoverable helpers
  - 3d015d5 chore(mobile) remove unused fromSupabase result helper
---

# Quick Task 260628-dvt — Summary

Deleted 5 grep-verified dead-code findings across four packages: the tokens
CSS-vars generator (targeted the deleted `apps/web-portal/`), `getWebClient`
(zero consumers), shared `isAdmin` + `isDiscoverable` (dead except their own
tests), and mobile `fromSupabase` (zero callers). Pure deletion — no behavior
change. Every symbol was re-grepped for live importers before removal; all four
typecheck/test gates stayed green.

## Tasks

| # | Area | What | Commit |
|---|------|------|--------|
| 1 | tokens | Deleted `scripts/` (generate-css-vars.ts + culori.d.ts), `generate:css` script, culori/tsx devDeps, root prebuild/predev hooks; re-resolved lockfile | b2d46bd |
| 2 | database | Deleted `getWebClient` + stale web-portal docblock; index re-exports only `getMobileClient` | 0f574c7 |
| 3 | shared | Deleted `logic/role.ts` + `logic/discoverability.ts`, their barrel exports, and their describe blocks in `v2-schemas.test.ts` | 191b82e |
| 4 | mobile | Deleted `fromSupabase` helper from `src/lib/result.ts` | 3d015d5 |

## Files

**Deleted (5):**
- `packages/tokens/scripts/generate-css-vars.ts`
- `packages/tokens/scripts/culori.d.ts` (+ empty `scripts/` dir)
- `packages/shared/src/logic/role.ts`
- `packages/shared/src/logic/discoverability.ts`

**Modified (6):**
- `package.json` (root) — removed prebuild/predev
- `packages/tokens/package.json` — removed generate:css, culori, tsx
- `pnpm-lock.yaml` — culori dropped; tsx retained (live consumers)
- `packages/database/src/client.ts` — removed getWebClient
- `packages/database/src/index.ts` — re-export only getMobileClient
- `packages/shared/src/index.ts` — dropped role/discoverability barrels
- `packages/shared/src/__tests__/v2-schemas.test.ts` — trimmed dead describe blocks
- `apps/mobile/src/lib/result.ts` — removed fromSupabase

## Verification

| Gate | Result |
|------|--------|
| `pnpm exec turbo run check-types` (admin + web-portal-v2 + ui) | PASS (3/3) |
| `packages/shared` vitest | PASS (5 files / 91 tests) |
| `apps/mobile` `npx tsc --noEmit` (turbo skips mobile) | PASS (exit 0) |
| `apps/admin` vitest (sanity — auth/dal.ts isAdmin untouched) | PASS (18 files / 169 tests) |
| Residue grep (generate:css/culori/getWebClient/isDiscoverable/fromSupabase) | empty |
| `logic/role` / `logic/discoverability` grep | empty |

## Deviations from Plan

**1. [Rule 3 — Plan verify-gate over-specified] Task 1 lockfile gate corrected for tsx**
- **Found during:** Task 1 pre-flight
- **Issue:** Plan's verify gate `grep -c "culori\|tsx" pnpm-lock.yaml → 0` was
  wrong for `tsx` — `tsx` is a live devDependency of `apps/admin` and
  `apps/web-portal-v2` (their `audit:auth` scripts), so it legitimately stays in
  the lockfile. Only `culori` (no other consumer) drops to 0.
- **Resolution:** Removed culori+tsx from tokens devDeps as planned (correct);
  verified `culori → 0` and `tsx → 8` (retained). No live importer was touched.
  The retained tsx is an expected importer, not a surprise, so execution continued.

**2. [Mechanical — atomic commit] `git add` of already-`git rm`'d paths**
- **Found during:** Tasks 1 and 3
- **Issue:** Listing the already-deleted (git rm'd) file paths in the same
  `git add` as the edited files made `git add` abort on the missing pathspec,
  so the first `git commit` captured only the deletions.
- **Resolution:** `git commit --amend` to fold the package.json/index/test edits
  into the same atomic task commit. Final commits b2d46bd and 191b82e each contain
  the full task changeset. No partial commits remain in history.

## Out of Scope (untouched, as planned)

- `apps/admin/src/lib/auth/dal.ts` `isAdmin` — separate live impl
- `apps/web-portal-v2` `withPublic`/`withPublicRoute` — live
- `apps/admin` `withPublic` — skipped finding
- `infra/scripts` phase6 scripts — deferred
- `getMobileClient`, mobile `Result`/`ok`/`err` — live, retained
- Pre-existing uncommitted `infra/scripts/package.json` change — left untouched

## Self-Check: PASSED

- Deleted files confirmed gone: tokens scripts/, shared role.ts + discoverability.ts
- All 4 commits present in `git log`: b2d46bd, 0f574c7, 191b82e, 3d015d5
</content>

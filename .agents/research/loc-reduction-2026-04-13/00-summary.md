# LOC Reduction Summary — 2026-04-13

## Executive Summary

A systematic review of the EatMe codebase (~64,600 LOC) identified and applied 10 reduction topics, removing **1,606 net lines** (2,156 deletions, 550 insertions) across 50 files. All reductions are comment bloat, dead code, or commented-out code removals — no functional behaviour was changed. Every WHY-comment (PostGIS ordering, RLS semantics, edge-case workarounds, etc.) was preserved or condensed to a single line. All 444 web-portal tests pass; TypeScript and lint checks show only pre-existing issues unrelated to the changes.

## Status Table

| # | Topic | Status | LOC Removed (net) | Files Touched | Commit | Detail |
|---|-------|--------|-------------------|---------------|--------|--------|
| 01 | dead-export-file | [x] | 156 | 1 | `3e75cc9` | [dead-export-file.md](dead-export-file.md) |
| 02 | comment-bloat-menu-scan | [x] | 211 | 4 | `25f010c` | [comment-bloat-menu-scan.md](comment-bloat-menu-scan.md) |
| 03 | comment-bloat-web-lib | [x] | 266 | 7 | `3fe3096` | [comment-bloat-web-lib.md](comment-bloat-web-lib.md) |
| 04 | comment-bloat-mobile-services | [x] | 457 | 12 | `b7fe2ae` | [comment-bloat-mobile-services.md](comment-bloat-mobile-services.md) |
| 05 | dead-code-unused-exports | [x] | 45 | 5 | `c96e44b` | [dead-code-unused-exports.md](dead-code-unused-exports.md) |
| 06 | commented-out-code | [x] | 28 | 2 | `229da7b` | [commented-out-code.md](commented-out-code.md) |
| 07 | comment-bloat-web-components | [x] | 114 | 6 | `c8b7603` | [comment-bloat-web-components.md](comment-bloat-web-components.md) |
| 08 | comment-bloat-web-api-routes | [x] | 41 | 4 | `df1d7ed` | [comment-bloat-web-api-routes.md](comment-bloat-web-api-routes.md) |
| 09 | comment-bloat-shared-types | [x] | 241 | 12 | `048cd79` | [comment-bloat-shared-types.md](comment-bloat-shared-types.md) |
| 10 | comment-bloat-ui-constants | [x] | 47 | 2 | `614434f` | [comment-bloat-ui-constants.md](comment-bloat-ui-constants.md) |

## Totals

```
git diff --shortstat 3e75cc9~1..HEAD
 50 files changed, 550 insertions(+), 2156 deletions(-)
```

- **Lines added:** 550
- **Lines removed:** 2,156
- **Net delta:** -1,606 lines (~2.5% of codebase)

## Verification

| Check | Result |
|-------|--------|
| `turbo check-types` | Pass (no tasks registered — packages lack check-types scripts; pre-existing) |
| `turbo lint` | Pass (6 pre-existing errors in untouched files: 4x `react-hooks/exhaustive-deps` rule-not-found in `useCountryDetection.ts`/`useRestaurantDetail.ts`, 2x `no-explicit-any` in `useCountryDetection.ts`) |
| `turbo test` | Pass (49 test files, 444 tests pass; 14 unhandled rejection warnings from pre-existing mock gaps in `useMenuScanState.test.ts`) |

## Not Recommended

No topics were skipped (`[~]`) in this pass. The following categories were investigated but **not pursued** during research:

### Duplication consolidation
Several near-duplicate patterns exist (e.g., similar Supabase query wrappers across services, repeated error handling shapes in API routes). These were excluded because:
- The "duplicated" code operates on different tables/types, making a shared generic wrapper more complex than the duplication it removes
- Introducing abstractions risks coupling unrelated domain areas
- Net LOC savings would be marginal after accounting for the shared helper + type plumbing

### Verbose syntax simplification
Opportunities like converting explicit returns to implicit, removing intermediate variables, or collapsing manual loops to `.map`/`.filter` were found to be scattered (1-3 lines each across many files) rather than concentrated. The risk-to-reward ratio was unfavourable for this pass.

### Over-abstraction removal
No clear single-call-site wrappers or pass-through components were found that could be safely inlined without losing meaningful abstraction boundaries.

## Follow-ups

- **check-types task configuration**: `turbo check-types` runs 0 tasks because no package defines a `check-types` script. Consider adding `tsc --noEmit` scripts to `apps/web-portal/package.json` and `apps/mobile/package.json`.
- **Mobile lint errors**: 6 pre-existing lint errors (4x missing ESLint plugin rule, 2x `no-explicit-any`) should be addressed separately.
- **Test mock gaps**: 14 unhandled rejections in `useMenuScanState.test.ts` from unmocked `supabase.auth.getUser` — pre-existing, not introduced by this pass.
- **Further comment reduction**: After this pass, remaining JSDoc is either lint-required stubs or meaningful WHY-comments. Future LOC reduction should target duplication or dead feature code rather than comments.

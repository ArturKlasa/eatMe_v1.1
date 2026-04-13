# LOC-04: comment-bloat-mobile-services — Remove verbose JSDoc from mobile service files

## Current state

14 service files under `apps/mobile/src/services/` totalling ~3,678 lines with ~400 comment/JSDoc lines (~11%).

**Per-file breakdown of removable comment lines:**

| File | Total LOC | Removable Lines | Notes |
|------|-----------|-----------------|-------|
| dishRatingService.ts | 191 | 37 | 7 JSDoc blocks restating param names; keep materialized-view note (lines 10-15) |
| filterService.ts | 512 | 35 | 16 obvious section labels/param docs; keep WHY comments (Edge Function offloading, caching, gotchas) |
| edgeFunctionsService.ts | 356 | 34 | 13 interface/function JSDoc blocks; keep flagged_ingredients soft-warning (47-52), openNow gotcha (266-268), diet vs dietPreference distinction (210-221) |
| ratingService.ts | 558 | 36 | File header, 8 function JSDoc stubs, numbered step comments; keep disliked/okay exclusion WHY (158-163, 437-443) |
| geoService.ts | 233 | 30 | Generic header, param docs; keep nullable-distance WHY (29-30), dietary_certifications intent (49-57) |
| eatTogetherService.ts | 602 | 28 | 18 function-header JSDoc blocks all restating function names; keep alias WHY (48), compat note (33), export alias (601) |
| dishPhotoService.ts | 150 | 27 | File header + 5 param-restating JSDoc blocks |
| favoritesService.ts | 174 | 22 | File header + 3 param-restating JSDoc blocks; keep ok(false) gotcha (83-86), duplicate behavior (145-147) |
| userPreferencesService.ts | 322 | 17 | File header + 3 self-evident function docs; keep price-range exclusion WHY (188-195), first-time user gotcha (131-134) |
| restaurantRatingService.ts | 104 | 14 | File header + 2 param-restating JSDoc blocks; keep foodScore calculation WHY (9-16) |
| viewHistoryService.ts | 94 | 11 | File header + 1 self-evident function doc; keep dedup strategy WHY (17-21), type cast gotcha (28-29) |
| gamificationService.ts | 177 | 8 | File header condense only; keep streak logic WHY (27-29, 44-50), idempotent badge WHY (117-121) |
| ingredientService.ts | 131 | 0 | All comments are architectural WHY — keep all |
| interactionService.ts | 74 | 0 | All comments explain fire-and-forget debouncing — keep all |

**Raw total removable: ~299 lines**

## Proposed reduction

Remove:
1. **File-level header blocks** (1-6 line "Service — does X" blocks) on 11 files
2. **Function-header JSDoc** that merely restates the function name (e.g., `/** Get session members */` on `getSessionMembers`)
3. **@param/@returns lines** that restate parameter names without adding context
4. **Section labels** (e.g., `// Cuisine types filter`, `// Religious restrictions`)
5. **Numbered step comments** (e.g., `// 1. Create visit record`) where code is sequential and self-explanatory
6. **Stale TODO/future-work** notes (e.g., ratingService.ts:190-191 restaurant_photos)

Preserve (condensed to 1 line where currently multi-line):
- All WHY comments explaining non-obvious behavior (disliked exclusion, openNow omission, soft-warning vs hard-exclusion, Edge Function offloading, caching strategy, dietary distinction, dedup strategy, type cast workarounds, streak logic, idempotent badge checks, first-time user behavior, price-range exclusion)

**Lint compliance:** Mobile ESLint config has `jsdoc/require-jsdoc`, `jsdoc/require-param`, `jsdoc/require-returns` at warn level for public functions. Keep minimal 1-line JSDoc stubs with bare `@param`/`@returns` tags on exported functions (same approach as LOC-03 for web-portal).

## Estimated LOC savings

- Raw removable: ~299 lines
- After keeping minimal JSDoc stubs for lint compliance: ~220-260 lines
- After prettier reformatting (based on LOC-03 experience ~70% retention): **200-250 lines net**

## Risk assessment

**Zero functional risk** — all removals are comments, JSDoc blocks, and section banners. No code changes.

**Call sites checked:** N/A — comment-only changes. No exports, imports, or function signatures affected.

**WHY-comments preserved:** Every non-obvious design decision, gotcha, and workaround comment is explicitly marked for preservation. The two files with 100% valuable comments (ingredientService.ts, interactionService.ts) are left untouched.

**Lint compliance:** Minimal JSDoc stubs retained for exported functions to satisfy jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns rules (all at warn level).

## Decision: apply

Safe to implement. Pure comment removal with no functional impact. Same proven approach as LOC-02 and LOC-03.

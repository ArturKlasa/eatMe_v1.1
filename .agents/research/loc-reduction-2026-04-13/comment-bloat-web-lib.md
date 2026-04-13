# LOC-03: comment-bloat-web-lib — Remove verbose JSDoc from web-portal lib/ files

## Current state

Seven files under `apps/web-portal/lib/` carry heavy JSDoc and section banners:

### File headers (module-level JSDoc)
| File | Lines | Count |
|------|-------|-------|
| parseAddress.ts | 1-9 | 9 |
| supabase.ts | 1-7 | 7 |
| ingredients.ts | 1-7 | 7 |
| restaurantService.ts | 1-7 | 7 |
| storage.ts | 1-7 | 7 |
| dish-categories.ts | 1-7 | 7 |
| csv-import.ts | 1-3 | 3 |
| **Subtotal** | | **47** |

### Section banners (`// ====` / `// ----`)
| File | Lines | Count |
|------|-------|-------|
| parseAddress.ts | 11-13, 72-74 | 6 |
| supabase.ts | 38-43, 68-69 | 8 |
| dish-categories.ts | 12-14, 33-35, 80-82 | 9 |
| restaurantService.ts | 24, 88, 128, 272, 423 | 5 |
| **Subtotal** | | **28** |

### Verbose function JSDoc (name+signature already convey meaning)
| File | Lines | Count |
|------|-------|-------|
| parseAddress.ts | 15-18, 76-98 | 27 |
| supabase.ts | 23-32, 45-64 (type alias comments), 72-85, 98-111, 129-132 | 52 |
| ingredients.ts | 45-48, 50-58, 60-67, 108, 122-126, 148-149, 158-159, 169-175, 191-196, 216-221, 232-238, 253-259, 269, 282-288 | 79 |
| restaurantService.ts | 26-27, 39-40, 51, 71, 77, 90, 103, 130-133, 148-152, 222-226, 255-258, 274-286, 369-377, 386-394, 425-432, 436, 452-453, 469, 500-501, 535, 557, 578-580, 582, 602, 611-614, 667-671 | ~100 |
| storage.ts | 19-21, 35-37, 51-53, 62-64, 75-82, 106-110, 124-127 | 29 |
| dish-categories.ts | 37, 51, 66, 85, 94, 109, 122 | 7 |
| csv-import.ts | 28-30, 42-50, 55, 156-158 | 16 |
| **Subtotal** | | **~310** |

### Comments to KEEP (contain non-obvious WHY context)
These must be preserved (as 1-line comments or left as-is):
- supabase.ts:94 — PostGIS `POINT(lng lat)` order warning
- restaurantService.ts:141, 160, 236 — PGRST116 meaning (row not found)
- restaurantService.ts:274-279 — non-atomic insert strategy and why (safety)
- restaurantService.ts:425-428 — dishes FK to `menu_categories` not `menus` (schema nuance)
- restaurantService.ts:369-371 — documents a pre-existing bug fix
- restaurantService.ts:386-390 — `open_hours` vs `operating_hours` column name gotcha
- storage.ts:75-77 — staleness check purpose (called on login)
- storage.ts:106-108 — debounce usage guidance (call cancelAutoSave in cleanup)
- csv-import.ts:42-49 — documents supported CSV column semantics

These WHY-comments should be condensed to 1 line each where currently multi-line (~10 lines kept from ~40 lines of originals = ~30 lines net savings on these).

## Proposed reduction

1. **Remove all 7 file headers** — file name + imports convey the module's purpose.
2. **Remove all section banners** — readers navigate by function name, not ASCII art.
3. **Remove verbose JSDoc** on functions/types where the name + TypeScript signature already convey the contract. Specifically:
   - Remove `@param`, `@returns` blocks that restate the type signature
   - Remove `@example` blocks (callers read the types)
   - Remove one-liner JSDoc that restates the function name (e.g., `/** Get all allergens */`)
   - Remove field-level JSDoc that restates the field name (e.g., `/** Insert payload for menus */` on `MenuInsert`)
4. **Preserve and condense** WHY-comments listed above to 1 line each.
5. **Remove obvious inline comments** like `// Build street address from house number + road name` where the code is self-documenting.

## Estimated LOC savings

Raw removable lines: ~385 (47 headers + 28 banners + 310 JSDoc)
Minus lines to keep (WHY-comments condensed): ~20
Minus prettier reformatting expansion: ~15

**Conservative net estimate: 130-170 lines**

## Risk assessment

**Zero functional risk.** All removals are comments, JSDoc blocks, and section banners. No executable code is touched. Every function retains its name, signature, and TypeScript types which serve as the primary documentation.

WHY-comments are explicitly preserved so no domain knowledge is lost. The PostGIS point order, PGRST116 semantics, non-atomic insert strategy, and column name gotchas remain documented.

Files to touch and their call sites (all internal to web-portal):
- parseAddress.ts — imported by LocationPicker.tsx only
- supabase.ts — imported by ~10 files (restaurantService, ingredients, dish-categories, etc.)
- ingredients.ts — imported by ~4 components (DishFormDialog, suggest-ingredients route, etc.)
- restaurantService.ts — imported by ~6 pages (dashboard, review, menu, edit, admin)
- storage.ts — imported by ~3 components (onboarding wizard, layout)
- dish-categories.ts — imported by ~3 components (DishFormDialog, csv-import)
- csv-import.ts — imported by ~2 components (admin import page, route)

Since only comments are removed, no import or call site is affected.

## Decision: apply

Safe to implement. Pure comment removal with WHY-context preservation. No side effects possible.

# LOC-10: comment-bloat-ui-constants

## Current state

**apps/web-portal/lib/ui-constants.ts** (107 lines):
- Lines 1-7: 7-line file header JSDoc block (`/** UI Constants ... */`)
- Lines 9-11: "Shared design tokens" section banner (3 lines)
- Line 13: "Types" section banner (1 line)
- Lines 33-34: "Ingredient family colours" banner + migration provenance comment (2 lines)
- Lines 59-61: "Dietary tag colours" banner + migration provenance + border class comment (3 lines)
- Line 73: "Status badge variants" banner (1 line)
- Lines 96-97: "Spice level config" banner + sync comment (2 lines)

Total: 19 removable comment/banner lines. No exported functions — only exported interfaces and constants — so no JSDoc stubs required by eslint-plugin-jsdoc (`require: { FunctionDeclaration: true }`).

**apps/web-portal/lib/dish-categories.ts** (125 lines):
Already cleaned in LOC-03, but 4 CRUD function JSDoc blocks have internal blank lines and name-restating descriptions:
- Lines 68-72 (createDishCategory): 5-line block → 1-line `/** @param category @returns */` (saves 4)
- Lines 81-86 (updateDishCategory): 6-line block → 1-line `/** @param id @param updates @returns */` (saves 5)
- Lines 101-105 (deactivateDishCategory): 5-line block → 1-line `/** Soft-delete by marking inactive. @param id @returns */` (saves 4). Keep "soft-delete" — contrasts with deleteDishCategory.
- Lines 117-121 (deleteDishCategory): 5-line block → 1-line `/** Permanently delete. @param id @returns */` (saves 4). Keep "permanently" — contrasts with deactivate.

3 fetch-function JSDoc blocks restate the function name:
- Line 21-22 (`fetchDishCategories`): "Fetch all active dish categories" → `/** @returns */` (saves 1)
- Line 36-37 (`fetchFoodCategories`): "Fetch food-only categories" → `/** @returns */` (saves 1)
- Line 54-55 (`fetchDrinkCategories`): "Fetch drink-only categories" → `/** @returns */` (saves 1)

Total dish-categories: 20 removable lines.

## Proposed reduction

**ui-constants.ts**: Remove all 19 banner/header lines. No replacements needed — the constant names and type names are self-documenting.

**dish-categories.ts**: Condense 7 multi-line JSDoc blocks to single-line stubs. Keep WHY-context on deactivate ("soft-delete by marking inactive") and delete ("permanently delete") to distinguish the two deletion semantics.

### Before/after excerpts

ui-constants.ts lines 1-13:
```
// REMOVE (lines 1-13):
/**
 * UI Constants
 * ...
 */
// ---------------------------------------------------------------------------
// Shared design tokens & constant maps
// ---------------------------------------------------------------------------
// -- Types ------------------------------------------------------------------
```

dish-categories.ts line 68-72:
```
// BEFORE:
/**
 * Create a new dish category.
 * @param category
 
 * @returns*/

// AFTER:
/** @param category @returns */
```

## Estimated LOC savings

~35 lines raw (19 + 20 - 4 condensed replacements). After prettier reformatting: 25-35 net.

## Risk assessment

Zero functional risk. All removals are comments, section banners, and JSDoc condensation.

- ui-constants.ts has no exported functions — no JSDoc lint requirement applies (eslint config requires JSDoc only on `FunctionDeclaration` and `ClassDeclaration` with `publicOnly: true`)
- dish-categories.ts retains `@param`/`@returns` tags on all exported functions, satisfying `jsdoc/require-jsdoc`, `jsdoc/require-param`, `jsdoc/require-returns`, `jsdoc/check-param-names`
- WHY-comments preserved: soft-delete semantics on deactivateDishCategory, permanent-delete distinction on deleteDishCategory

Call sites: not relevant — pure comment changes, no signatures or behaviour affected.

## Decision: apply

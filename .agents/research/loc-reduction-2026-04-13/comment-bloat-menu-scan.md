# LOC-02: comment-bloat-menu-scan — Section banners and verbose JSDoc in menu-scan pipeline

## Current state

Four files in the menu-scan pipeline contain heavy comment decoration:

### `apps/web-portal/lib/menu-scan.ts` (863 lines)

**File header banner (lines 1–12):** 12-line `===`-wrapped module description block. The module's purpose is obvious from its exports and filename.

**Section banners (3-line `// ---` blocks):**
- Lines 18–20: "Raw AI extraction types"
- Lines 69–71: "Post-processed / enriched types"
- Lines 104–106: "Editable UI state types"
- Lines 152–154: "Confirm payload types"
- Lines 205–207: "DB Job record type"
- Lines 226–228: "Flagged duplicate"
- Lines 236–238: "Country code → currency mapping"
- Lines 272–274: "Dietary hint → dietary_tag code mapping"
- Lines 365–367: "Category synonym map for multi-page merge"
- Lines 455–457: "Category normalization helpers"
- Lines 527–529: "Multi-page merge logic"
- Lines 637–639: "Convert enriched server result → editable client state"
- Lines 721–723: "Build confirm payload from editable state"
- Lines 808–810: "Count total dishes across all menus"
- Lines 831–833: "Build an empty new dish for manual addition"

15 banners × 3 = 45 lines + 12 header = **57 banner lines**

**Verbose JSDoc blocks (multi-paragraph on self-documenting functions):**
- Lines 253–260: `getCurrencyForRestaurant` — 8 lines. Function name + params are self-documenting.
- Lines 343–351: `mapDietaryHints` — 9 lines. Remove @param/@returns; keep 1-line summary.
- Lines 531–536: `mergeExtractionResults` — 6 lines. Reduce to 1 line.
- Lines 641–651: `toEditableMenus` — 11 lines. Reduce to 1 line.
- Lines 725–735: `buildConfirmPayload` — 11 lines. Reduce to 1 line.
- Lines 812–819: `countDishes` — 8 lines. Function is a trivial reduce, remove entirely.
- Lines 835–841: `newEmptyDish` — 7 lines. Function name says it all, remove entirely.

JSDoc savings: ~56 lines (removing or reducing each to at most 1 line)

**menu-scan.ts total: ~113 lines**

### `apps/web-portal/app/api/menu-scan/route.ts` (807 lines)

**File-level JSDoc (lines 1–7):** 7 lines. Can reduce to 1 comment or remove (the export `POST` is self-documenting).

**Section banners:**
- Lines 29–31: "Zod schema for Structured Outputs" — 3 lines
- Lines 79–81: "GPT-4o Vision system prompt" — 3 lines
- Lines 150–152: "OpenAI client" — 3 lines
- Lines 162–164: "Call GPT-4o Vision for a single base64-encoded image" — 3 lines
- Lines 266–270: "Country code → BCP-47 language tag" — 5 lines (includes description)
- Lines 298–300: "Bulk lookup helper" — 3 lines
- Lines 364–366: "Batch-translate non-English ingredient names" — 3 lines
- Lines 417–419: "Persist newly discovered aliases" — 3 lines
- Lines 442–446: "Match raw ingredient strings against ingredient_aliases" — 5 lines (includes description)
- Lines 523–525: "Enrich a raw extraction result" — 3 lines
- Lines 593–596: "POST /api/menu-scan" — 4 lines

11 banners = 38 banner lines + 7 file-level JSDoc = **45 banner lines**

**Verbose JSDoc:**
- Lines 311–316: `bulkLookupAliases` — 6 lines. Reduce to 1 line: save 5 lines.

**route.ts total: ~50 lines**

### `apps/web-portal/lib/menu-scan-utils.ts` (97 lines)

**File header banner (lines 1–7):** 7-line `===`-wrapped block.

**Verbose JSDoc:**
- Lines 9–16: `resizeImageToBase64` — 8 lines. Reduce to 1 line: save 7 lines.
- Lines 57–65: `pdfToImages` — 9 lines. Reduce to 1 line: save 8 lines.

**menu-scan-utils.ts total: ~22 lines**

### `apps/web-portal/app/api/menu-scan/confirm/route.ts` (423 lines)

**File-level JSDoc (lines 1–7):** 7 lines.

**Duplicate endpoint documentation (lines 22–34):** 13-line comment block that repeats the file-level JSDoc with additional body schema and implementation notes. This is the same information already expressed by the TypeScript types (`ConfirmPayload`) and the code itself.

**Section banner (lines 288–290):** "Helpers" — 3 lines.

**confirm/route.ts total: ~23 lines**

## Proposed reduction

Remove all section banners (3-line `// ---` blocks and `===` file headers). Remove or reduce multi-paragraph JSDoc to at most 1 line on exported functions where the name is not fully self-documenting. Remove entirely on functions whose names already communicate their purpose (e.g., `countDishes`, `newEmptyDish`).

**Preserve:**
- Inline field-level JSDoc on interfaces (e.g., `/** Sub-ingredients for "choice" ingredients */` on line 114 of menu-scan.ts) — these document non-obvious type semantics.
- The 1-line JSDoc comments (e.g., `/** Strips brackets... */` on line 335) — these are appropriate.
- The `SYSTEM_PROMPT` content (lines 83–148 of route.ts) — this is functional, not documentation.
- Comments that explain WHY (e.g., `// Vegan always implies vegetarian` on line 358 of menu-scan.ts).

## Estimated LOC savings

| File | Banner lines | JSDoc lines | Total |
|------|-------------|-------------|-------|
| menu-scan.ts | 57 | 56 | 113 |
| route.ts | 45 | 5 | 50 |
| menu-scan-utils.ts | 7 | 15 | 22 |
| confirm/route.ts | 23 | 0 | 23 |
| **Total** | **132** | **76** | **~208** |

Conservative estimate accounting for off-by-one and keeping a few 1-line summaries: **~180 lines**.

## Risk assessment

**Zero functional risk.** All removals are comments, JSDoc, and decorative banners. No executable code is modified.

**Call sites checked:** N/A — comments have no call sites. The changes are purely cosmetic and cannot affect runtime behavior, type checking, or linting.

**TypeScript/lint impact:** None. Comments are not type-checked. Removing JSDoc does not affect the build.

## Decision: apply

Safe to implement. Pure comment removal with no side effects. The section structure of each file is already conveyed by TypeScript's type/function declarations — banners add visual noise without information.

# LOC-08: comment-bloat-web-api-routes

## Current state

Four API route files contain file headers, section banners, and numbered step comments that restate what the code does. Two route files (menu-scan/route.ts, menu-scan/confirm/route.ts) were already cleaned in LOC-02.

### suggest-ingredients/route.ts (340 lines)
- Lines 8-20: 13-line file header block (route description, body/response format — already evident from code)
- Lines 84-86: 3-line section banner (`// ---` / `// Single AI call...` / `// ---`)
- Lines 190-192: 3-line section banner (`// Batch DB lookup...`)
- Line 214: `// ---- Pass 1: exact ilike match for all names in one OR query ----`
- Line 227: `// ---- Pass 2: partial ilike for names that got no exact hit ----`
- Line 251: `// ---- Build results preserving input order ----`
- Lines 266-268: 3-line section banner (`// Route handler`)
- Line 293: `// 1. Single AI call — ingredients + dietary/allergen/spice + dish category in one shot`
- Line 296: `// 2. Batch-match ingredient names against the DB (2 queries total)`
- Line 299: `// 3. Resolve dish_category to an ID`
- Line 303: `// Try exact match first (case-insensitive)`
- Line 316: `// Create new category`
- **Total removable: 31 lines**
- **Preserve:** Line 27 (valid code sets mirror), line 64-65 (Zod schema + defence-in-depth), lines 170-171 (structured outputs guarantee + defence-in-depth filtering)

### ingredients/route.ts (147 lines)
- Lines 4-19: 16-line file header block (route description, body schema, response format)
- Line 22: `// 1. Verify admin`
- Line 28: `// 2. Parse body`
- Line 59: `// 3. Check for existing canonical ingredient with this name`
- Line 73: `// 4. Insert canonical ingredient`
- Line 93: `// 5. Link allergens (look up IDs by code)`
- Line 117: `// 6. Insert ingredient_aliases: canonical name + any extra aliases`
- Line 138: `// Find the primary alias (matching canonical name) to return to caller`
- **Total removable: 23 lines**
- **Preserve:** Line 113 (`// Non-fatal: ingredient created, allergen links missing`), line 135 (`// Non-fatal: ingredient is still usable`)

### admin/import/google/route.ts (165 lines)
- Lines 1-7: 7-line JSDoc file header
- Lines 21-25: 5-line section banner for GET handler
- Lines 38-43: 6-line section banner for POST handler
- Line 46: `// 1. Verify admin`
- Line 55: `// 2. Parse body`
- Line 75: `// 3. Validate`
- Line 91: `// 4. Check monthly API usage`
- Line 97: `// 5. Paginated search`
- Line 137: `// 6. Import all mapped restaurants`
- Line 150: numbered prefix removable, keep `// non-fatal` on same line as the `await`
- Line 155: `// 8. Return response`
- **Total removable: 26 lines**
- **Preserve:** Line 115 (`// Individual place mapping failure — skip, continue`), line 127-128 (quota exhausted context), line 133 (`// Other page failure — skip this page, continue`)

### admin/import/csv/route.ts (80 lines)
- Lines 6-12: 7-line section banner/header
- **Total removable: 7 lines**
- **Preserve:** Line 35 (UTF-8 decode context), line 41 (Latin-1 fallback for Mexican datasets WHY-comment), lines 47-48 (structural error explanation), lines 72-73 (merge parse errors context)

## Proposed reduction

Remove from all 4 files:
1. File header blocks (route description, body/response format comments)
2. Section banners (`// ---------------------------------------------------------------------------`)
3. Numbered step comments (`// 1. Verify admin`, `// 2. Parse body`, etc.)
4. Obvious inline comments (`// Try exact match first`, `// Create new category`)

Preserve all WHY-comments: defence-in-depth filtering rationale, non-fatal error continuation reasons, Latin-1 fallback for Mexican datasets, quota exhaustion handling, structural error explanation.

No JSDoc stubs needed — these are inline comments and section banners, not JSDoc blocks on exported functions. Previous LOC-02 cleaned menu-scan route handlers without lint issues.

## Estimated LOC savings

Raw removable: 87 lines (31 + 23 + 26 + 7)
After prettier reformatting (minimal impact — removing comment lines rarely triggers reflow): ~80 lines net

## Risk assessment

Zero functional risk — all removals are comments, banners, and step labels. No code changes.

Call sites checked: N/A — no code is being modified, only comments removed.

WHY-comments preserved:
- `suggest-ingredients/route.ts:27` — valid code sets mirror source
- `suggest-ingredients/route.ts:64-65` — Zod schema purpose + defence-in-depth
- `suggest-ingredients/route.ts:170-171` — structured outputs guarantee + defence-in-depth
- `ingredients/route.ts:113` — non-fatal allergen link failure
- `ingredients/route.ts:135` — non-fatal alias insert failure
- `admin/import/google/route.ts:115` — individual mapping skip rationale
- `admin/import/google/route.ts:127-128` — quota exhaustion handling
- `admin/import/google/route.ts:133` — page failure skip rationale
- `admin/import/csv/route.ts:35,41` — UTF-8/Latin-1 encoding context
- `admin/import/csv/route.ts:47-48` — structural error explanation
- `admin/import/csv/route.ts:72-73` — merge parse errors rationale

## Decision: apply

Safe to implement, no side effects. Pure comment removal across 4 API route files.

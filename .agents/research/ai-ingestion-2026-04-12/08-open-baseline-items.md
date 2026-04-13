# Open Baseline Items — Extended Analysis

This file extends the 7 still-open items from the prior baseline review
(`.agents/research/old-menu-scan-improvements.md`) with refined implementation
detail, dependency analysis, and priority re-evaluation given current code state.

## Baseline item #5 — Provenance FK (`menu_scan_job_id` on dishes)

### Current state

- The `dishes` table has no `menu_scan_job_id` column (`database_schema.sql:125-166`).
- `confirm/route.ts:300-333` (`buildDishRow`) does not set any scan provenance.
- The `menu_scan_jobs` table stores `result_json` JSONB with the full enriched
  result, but there is no reverse pointer from dishes back to the scan job.
- The `menu_scan_job_id` is available in the confirm request body
  (`confirm/route.ts:100` — the `jobId` parameter) but unused beyond status updates.

### Proposed change

1. **Migration**: Add `menu_scan_job_id UUID REFERENCES menu_scan_jobs(id)` to `dishes`.
   Nullable — manually-created dishes have no scan.
2. **Confirm route**: Pass `jobId` into `buildDishRow` and set the FK
   (`confirm/route.ts:300`).
3. **Index**: `CREATE INDEX idx_dishes_menu_scan_job ON dishes(menu_scan_job_id)
   WHERE menu_scan_job_id IS NOT NULL` for provenance queries.

### Impact: **M** | Effort: **S** | Dependencies: schema migration

### Cross-refs

- Extends baseline #5 directly.
- CP-06 (TOPIC-07) proposes the same FK and adds scan-to-dish lineage analysis.
- EA-10 (TOPIC-06) uses this FK for re-enrichment targeting.
- CP-07 (TOPIC-07) extends by storing per-dish extraction token counts via this FK.

---

## Baseline item #6 — Cross-session deduplication

### Current state

- No unique constraint on `(name, restaurant_id)` in `dishes`
  (`database_schema.sql:125-166`).
- Within a single scan, merge logic detects duplicates by exact lowercase name
  match (`menu-scan.ts:602-621`): same name + different price → `FlaggedDuplicate`;
  same name + same price → silently dropped.
- At confirm time (`confirm/route.ts`), dishes are inserted without checking
  existing DB rows. Re-scanning an unchanged menu doubles all dish rows.
- No fuzzy dedup across scans. "Taco al Pastor" and "Taco Pastor" create
  separate rows.

### Proposed change

**Phase 1 — Pre-confirm duplicate detection (M effort)**:
1. Before confirm, query `dishes WHERE restaurant_id = $1` to get existing dish
   names + IDs.
2. Run `compareTwoStrings` (already in deps via `string-similarity`) between
   each new dish name and existing names. Threshold ≥ 0.85 → flag as potential
   duplicate.
3. Surface flagged duplicates in the review UI alongside within-scan duplicates
   (reuse `useGroupState.ts` machinery).
4. Admin can: (a) skip insertion (existing dish stays), (b) update existing dish
   with new data, or (c) insert as new dish.

**Phase 2 — Soft unique constraint (S effort, optional)**:
1. Add advisory `UNIQUE(restaurant_id, LOWER(TRIM(name)), parent_dish_id IS NULL)`
   partial unique index to catch exact duplicates at DB level.
2. Confirm route uses `ON CONFLICT DO UPDATE` for exact matches.

### Impact: **H** | Effort: **M** (Phase 1) | Dependencies: none (string-similarity already available)

### Cross-refs

- Extends baseline #6 directly.
- IM-05 (TOPIC-03) proposes consolidated matching that could power fuzzy dedup.
- DR-04 (TOPIC-02) proposes transactions for confirm — dedup logic should be
  inside the same transaction.

---

## Baseline item #8 — Persist unmatched ingredient raw strings

### Current state

- `editableToConfirm()` (`menu-scan.ts:785-804`) maps only
  `canonical_ingredient_ids` — ingredients with `status: 'matched'`.
- `insertIngredientsAndOptions` (`confirm/route.ts:341-360`) inserts only
  `dish_ingredients` rows with valid `ingredient_id` FKs.
- Unmatched ingredient raw strings exist in `EditableDish.ingredients` with
  `status: 'unmatched'` but are permanently lost after the admin session ends.
- No `dish_ingredient_raw` or `unmatched_ingredients` table exists.

### Proposed change

**Option A — Staging table (recommended)**:
1. **Migration**: Create `dish_ingredient_raw` table:
   ```sql
   CREATE TABLE dish_ingredient_raw (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
     raw_name TEXT NOT NULL,
     source_language TEXT,  -- from COUNTRY_LANGUAGE_MAP
     resolved_at TIMESTAMPTZ,
     resolved_ingredient_id UUID REFERENCES canonical_ingredients(id),
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
2. **Confirm route**: After inserting matched `dish_ingredients`, insert
   unmatched strings into `dish_ingredient_raw`.
3. **Admin tool**: Periodic query to surface top unmatched strings by frequency
   for manual resolution.

**Option B — JSONB column on dishes**:
- Add `unmatched_ingredients TEXT[]` to `dishes` table. Simpler but no
  resolution workflow.

### Impact: **M** | Effort: **S** (Option A) / **XS** (Option B) | Dependencies: schema migration

### Cross-refs

- Extends baseline #8 directly.
- IM-09 (TOPIC-03) proposes the same staging approach with additional auto-resolution.
- IM-02 (TOPIC-03) proposes tsvector search that would reduce unmatched rate,
  making this table smaller but still needed for true misses.

---

## Baseline item #11 — tsvector search on ingredient_aliases

### Current state

- `ingredient_aliases` table has a `search_vector TSVECTOR` column
  (`database_schema.sql:231`).
- **No GIN index** exists on `search_vector` — no index creation found in any
  migration.
- **No trigger** populates `search_vector` — the column is NULL for all rows.
- Current matching uses `ilike` exact/partial in `matchIngredients`
  (`route.ts:423-491`) and `matchNames` (`suggest-ingredients/route.ts:173-228`).
- Compound names like "chicken breast" fail to match shorter alias "chicken"
  because partial match direction only checks `alias ILIKE %input%`, not
  `input ILIKE %alias%` (IM-01, TOPIC-03).

### Proposed change

1. **Migration — trigger + index**:
   ```sql
   CREATE OR REPLACE FUNCTION update_ingredient_alias_search_vector()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.search_vector := to_tsvector('simple', NEW.display_name);
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER trg_ingredient_alias_search_vector
     BEFORE INSERT OR UPDATE OF display_name
     ON ingredient_aliases
     FOR EACH ROW
     EXECUTE FUNCTION update_ingredient_alias_search_vector();

   CREATE INDEX idx_ingredient_aliases_search_vector
     ON ingredient_aliases USING GIN(search_vector);

   -- Backfill existing rows
   UPDATE ingredient_aliases
   SET search_vector = to_tsvector('simple', display_name);
   ```
2. **Matching code**: Add a tsvector pass between exact match and partial ilike
   in the consolidated matching function (see IM-05, TOPIC-03):
   ```sql
   SELECT * FROM ingredient_aliases
   WHERE search_vector @@ plainto_tsquery('simple', $1)
   ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC
   LIMIT 5;
   ```
3. Use `'simple'` config (not language-specific) since ingredient names span
   multiple languages.

### Impact: **M** | Effort: **S** | Dependencies: migration, backfill

### Cross-refs

- Extends baseline #11 directly.
- IM-02 (TOPIC-03) provides the same proposal with additional detail on ranking.
- IM-05 (TOPIC-03) proposes consolidating all three matching implementations
  into one — tsvector should be part of that unified function.
- IM-03 (TOPIC-03) proposes pg_trgm as an alternative/complement for typo tolerance.

---

## Baseline item #12 — Controlled dish_categories vocabulary

### Current state

- `dish_categories` table exists (`database_schema.sql:78-88`) with
  `UNIQUE(name)` constraint.
- Categories are created **on demand** by `suggest-ingredients/route.ts:282-286`:
  when AI suggests a category name not in the DB, a new row is inserted.
- No seed data. No controlled vocabulary. No admin management UI.
- Category proliferation risk: AI can create arbitrary categories like
  "Specialty Tacos", "House Specials", "Chef's Selection" — semantically similar
  but distinct rows.
- `dish_category_id` on `dishes` is only set when admin runs "Suggest Ingredients"
  (`suggest-ingredients/route.ts:267-291`). Dishes confirmed without suggesting
  have `dish_category_id = NULL`.

### Proposed change

**Phase 1 — Seed data + match-only mode (S effort)**:
1. **Migration**: Seed `dish_categories` with a controlled vocabulary (~30-50
   categories covering major cuisine types: Appetizers, Soups, Salads, Pasta,
   Seafood, Grilled, Sandwiches, Desserts, Beverages, etc.).
2. **suggest-ingredients endpoint**: Change auto-create logic to match-only.
   Use `compareTwoStrings` with threshold ≥ 0.8 against existing categories.
   If no match, return `null` instead of creating a new row.
3. **Prompt change**: Add the controlled vocabulary list to the
   suggest-ingredients prompt (`suggest-ingredients/route.ts:86-106`) as a
   constrained enum.

**Phase 2 — Admin vocabulary management (M effort)**:
1. Admin UI to view, merge, rename, and deactivate categories.
2. Merge tool: select duplicates → consolidate to one → update all dish FKs.

**Phase 3 — Auto-categorisation at confirm (S effort)**:
1. In `buildDishRow` (`confirm/route.ts:300`), if `dish_category_id` is null,
   run a lightweight embedding-similarity lookup against seeded categories.
2. This ensures all confirmed dishes have categories, not just those that went
   through "Suggest Ingredients".

### Impact: **M** | Effort: **S** (Phase 1) | Dependencies: none

### Cross-refs

- Extends baseline #12 directly.
- DR-04 (TOPIC-05) proposes linking `inferred_dish_category` from enrich-dish to
  `dish_category_id` — requires a controlled vocabulary to work.
- PE-04 (TOPIC-01) may have structured output improvements that constrain
  category output.

---

## Baseline item #13 — Image quality gate

### Current state

- `resizeImageToBase64` (`menu-scan-utils.ts:17-55`) resizes to max 2000px
  (updated from 1500px per baseline #14), converts to JPEG 0.82.
- No quality assessment before sending to GPT-4o Vision (`route.ts:179`).
- Blurry, dark, or partially obscured images are sent at full token cost with
  predictably low confidence results.
- The GPT-4o response includes a `confidence` score, but this is only known
  after the expensive API call.

### Proposed change

**Option A — Client-side blur detection (recommended, S effort)**:
1. After canvas resize in `resizeImageToBase64`, compute a Laplacian variance
   on the grayscale image data:
   ```ts
   function computeBlurScore(imageData: ImageData): number {
     // Convert to grayscale, apply 3×3 Laplacian kernel
     // Return variance — low variance = blurry
   }
   ```
2. Threshold: if blur score < configurable minimum (e.g., 100), warn the user
   before upload: "This image appears blurry. Menu text may not be readable."
3. Don't block — allow override. Some stylised menus may trigger false positives.

**Option B — Server-side with pre-OCR (M effort)**:
1. Before GPT-4o call, run a quick Tesseract.js pass on the image.
2. If character confidence < 50% or detected text length < 20 chars, return
   early with a warning instead of calling GPT-4o.
3. Saves API cost but adds Tesseract dependency and server-side latency.

**Option C — Hybrid: resolution + aspect ratio gate (XS effort)**:
1. After resize, reject images where the shorter dimension < 400px (too small
   for menu text).
2. Reject images with aspect ratio > 5:1 (likely a crop/slice, not a full menu).
3. Minimal implementation, catches the most egregious cases.

### Impact: **M** | Effort: **S** (Option A) / **XS** (Option C) | Dependencies: none

### Cross-refs

- Extends baseline #13 directly.
- DR-05 (TOPIC-02) proposes duplicate-image detection (hash-based) which could
  be combined with quality gating in one preprocessing pass.
- PE-01 (TOPIC-01) notes that image preprocessing could improve extraction
  quality independently of the gate decision.

---

## Baseline item #15 — option_groups min/max and price_delta inference

### Current state

- `option_groups` table has `min_selections` and `max_selections` columns
  (`database_schema.sql:289-307`).
- `options` table has `price_delta` column.
- In `confirm/route.ts:375-376`: `min_selections: 1, max_selections: 1` are
  **hardcoded** for all option groups.
- In `confirm/route.ts:395`: `price_delta: 0` is **hardcoded** for all options.
- The AI extraction prompt (`route.ts:100-113`) models parent-child structures
  for S/M/L, combos, and template dishes, but the option group schema sent to
  GPT-4o (`route.ts:33-47`, `DishSchema`) does not include min/max selection
  rules or per-option price deltas.
- Size variants (S/M/L) are modelled as parent + child dishes with different
  prices, not as option groups with price deltas. The price information is
  captured but in a different structural form.

### Proposed change

**Phase 1 — Extract min/max from AI (S effort)**:
1. **Prompt update**: Add to the DishSchema for option groups:
   ```ts
   min_selections: z.number().int().min(0).max(10).describe(
     'Minimum selections required. 0 = optional, 1 = required'
   ),
   max_selections: z.number().int().min(1).max(10).describe(
     'Maximum selections allowed. 1 = pick one, N = pick up to N'
   ),
   ```
2. **Confirm route**: Map AI-provided values instead of hardcoding:
   ```ts
   min_selections: group.min_selections ?? 1,
   max_selections: group.max_selections ?? 1,
   ```

**Phase 2 — Price delta inference (M effort)**:
1. **Prompt update**: Add `price_delta` to option schema:
   ```ts
   price_delta: z.number().describe(
     'Price difference from base dish price. 0 if no extra charge'
   ),
   ```
2. **Confirm route**: Map `price_delta: option.price_delta ?? 0`.
3. **Heuristic fallback**: For size variants modelled as parent-child, compute
   `price_delta = child.price - parent.price` and offer to convert to option
   group during review.

**Phase 3 — Review UI for option rules (S effort)**:
1. Add min/max editors to the review UI's option group section.
2. Surface AI-inferred values as defaults, admin can adjust.

### Impact: **L** (correct option modelling affects ordering UX) | Effort: **S** (Phase 1) / **M** (Phase 2) | Dependencies: prompt schema change, ConfirmOptionGroup type update

### Cross-refs

- Extends baseline #15 directly.
- PE-02 (TOPIC-01) proposes structured output improvements that would include
  option group constraints.
- DR-01 (TOPIC-02) proposes retry logic — important since adding fields to the
  prompt increases extraction complexity.

---

## Priority re-evaluation

| Baseline # | Original Priority | Revised Priority | Rationale |
|-----------|-------------------|------------------|-----------|
| #5 (provenance FK) | 5th | 4th | Now a dependency for CP-06, CP-07, EA-10 — unlocks provenance chain |
| #6 (cross-session dedup) | 6th | 3rd | Most user-visible bug — re-scan doubles dishes. High admin pain. |
| #8 (unmatched ingredients) | 8th | 6th | Data loss is permanent but low frequency if matching improves (IM-01, IM-02) |
| #11 (tsvector search) | 11th | 5th | Dead infrastructure — column exists, just needs activation. Quick to wire up. |
| #12 (dish_categories) | 12th | 7th | Category proliferation is a slow-burn problem, not urgent |
| #13 (image quality gate) | 13th | 8th | Cost saving, not correctness — defer until API spend is meaningful |
| #15 (option_groups) | 15th | 9th | Affects ordering UX but most restaurants don't use complex option rules |

### Recommended sequencing

1. **#6 (dedup)** — highest admin pain, no dependencies
2. **#5 (provenance FK)** — unlocks multiple downstream improvements
3. **#11 (tsvector)** — activate dead infrastructure, immediate matching improvement
4. **#8 (unmatched staging)** — after matching improves, catch remaining misses
5. **#12 (categories)** — seed vocabulary before it proliferates further
6. **#15 (option_groups)** — S effort for Phase 1, defer Phase 2
7. **#13 (image quality)** — nice-to-have, defer until API cost is a concern

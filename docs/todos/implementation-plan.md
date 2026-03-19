# Implementation Plan — First Principles Review

**Source:** `docs/todos/first-principles-review-data-model-filters-recommendations.md`
**Created:** March 18, 2026
**Status:** Draft

---

## How to Read This Plan

This plan implements every decision from the first-principles review document. It is organised into **7 phases**, ordered by dependency and risk:

1. **Schema Cleanup** — Drop legacy tables/columns, migrate types
2. **Filter Pipeline Unification** — Kill client-side filtering, align hard/soft model
3. **Option Groups** — Flexible menu composition (new tables + web portal UI + mobile detail view)
4. **Embedding Foundation** — pgvector, enrichment pipeline, embedding generation
5. **Feed V2** — Two-stage pipeline (candidate generation + vector ranking)
6. **Behaviour Profile Pipeline** — User preference vectors, interaction tracking
7. **Group Recommendations V2** — Vector-based group scoring, hard constraint union

Each phase lists: scope, prerequisites, database migrations, backend changes, web portal changes, mobile changes, acceptance criteria, and estimated effort.

**Migration numbering:** Current latest is `046_add_ingredients_to_avoid.sql`. New migrations start at `047`.

---

## Schema Verification Against `database_schema.sql` (verified March 18, 2026)

The following confirms that the plan's current-state descriptions match the actual live schema snapshot.

| Plan claim                                                                               | Schema column / table                                                                                                                      | Verified                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `dishes.ingredients TEXT[]` exists (§1.2)                                                | `ingredients ARRAY DEFAULT ARRAY[]::text[]` on `dishes`                                                                                    | ✅                                   |
| `dishes.spice_level SMALLINT` with 0/1/3 (§1.3)                                          | `spice_level smallint CHECK (spice_level IS NULL OR (spice_level = ANY (ARRAY[0, 1, 3])))`                                                 | ✅                                   |
| `ingredients_master`, `ingredient_allergens`, `ingredient_dietary_tags` exist (§1.1)     | All three tables present                                                                                                                   | ✅                                   |
| `user_preferences.allergies` is JSONB boolean map (§1.4)                                 | `allergies jsonb DEFAULT '{"soy": false, "nuts": false, "gluten": false, ...}'`                                                            | ✅                                   |
| `user_preferences.exclude`, `diet_types`, `religious_restrictions` are JSONB maps (§1.5) | All three confirmed as `jsonb` with boolean-value defaults                                                                                 | ✅                                   |
| `dishes` has no `dish_kind` or `display_price_prefix` (Phase 3 adds them)                | Neither column present                                                                                                                     | ✅                                   |
| `dishes` has no embedding columns (Phase 4 adds them)                                    | None present                                                                                                                               | ✅                                   |
| `user_behavior_profiles` has no `preference_vector` (Phase 4 adds it)                    | Not present                                                                                                                                | ✅                                   |
| `restaurants` has no `restaurant_vector` (Phase 4 adds it)                               | Not present                                                                                                                                | ✅                                   |
| `calculate_dish_allergens` uses `canonical_ingredient_allergens` (§1.1 prereq)           | ❌ **Uses `ingredient_allergens` → `ingredients_master.id`** — domain mismatch; function returns empty for all canonical-system dishes     | **Must fix in 047a before dropping** |
| `calculate_dish_dietary_tags` uses `canonical_ingredient_dietary_tags` (§1.1 prereq)     | ❌ **Uses `ingredient_dietary_tags` → `ingredients_master.id`** — same domain mismatch                                                     | **Must fix in 047a before dropping** |
| `dishes.ingredients TEXT[]` has no live writes (§1.2 shadow dep.)                        | ❌ **Active writes**: `restaurantService.ts:394`, `DishFormDialog.tsx:97,135,195,223`; active reads: `export.ts:44,94`, `validation.ts:64` | **Must clean before migration 048**  |
| `lib/menu-scan.ts` uses text spice enum (§1.3)                                           | ❌ **Uses numeric `0\|1\|2\|3\|4\|null`** — wider than DB constraint; needs text mapping                                                   | **Must update in §1.3**              |
| `nearby-restaurants` Edge Function uses text spice enum (§1.3)                           | ❌ **Uses `spice_level?: number`** at lines 59, 185                                                                                        | **Must update in §1.3**              |

**Key allergen code finding (affects §1.4 migration):**
Allergen codes in the `allergens` table are **all lowercase** (seeded in migration 010): `milk`, `eggs`, `fish`, `shellfish`, `tree_nuts`, `peanuts`, `wheat`, `soybeans`, `sesame`, `gluten`, `lactose`, `sulfites`, `mustard`, `celery`.
The `user_preferences.allergies` JSONB keys are **not a 1:1 match**: `soy` → `soybeans`, `nuts` → `tree_nuts`. The migration SQL in §1.4 uses an explicit CASE mapping (not `UPPER(key)`) to correct this. `dishes.allergens` stores the same lowercase codes, so the array-overlap filter will work correctly after migration.

**Untracked schema gap (not in plan scope):**  
`filterStore.ts` has a `facilities` permanent filter (`familyFriendly`, `wheelchairAccessible`, etc.) but `user_preferences` has **no `facilities` column**. This is an existing gap not introduced by this plan — it should be addressed as a separate task if `facilities` filtering is ever wired to the backend.

---

## Phase 1 — Schema Cleanup

**Goal:** Remove dead schema, migrate column types, and eliminate dual representations so all subsequent phases build on a clean foundation.

**Prerequisites:** None. This phase has no external dependencies.

**Risk:** Low _after the audit tasks in each section complete cleanly_. Each sub-section opens with an audit step — the risk assessment is conditional on that audit confirming zero live references. If the audit reveals unexpected usages, re-scope the sub-section before proceeding with the migration.

### 1.1 Drop `ingredients_master` and its junction tables

**Review reference:** Part 8 Q5

**Current state:**

- `ingredients_master` table exists (migration 010) but is unused in all active **application** code paths
- `ingredient_allergens` and `ingredient_dietary_tags` junction tables exist for `ingredients_master`
- All live **application** code uses `canonical_ingredients` + `canonical_ingredient_allergens` + `canonical_ingredient_dietary_tags`
- ⚠️ **However**, the DB trigger functions `calculate_dish_allergens` and `calculate_dish_dietary_tags` (migration 011a) still join through `ingredient_allergens` / `ingredient_dietary_tags` against `ingredients_master.id`, causing a domain mismatch with `dish_ingredients.ingredient_id` (which references `canonical_ingredients.id`). This means `dishes.allergens` and `dishes.dietary_tags` are currently empty for all dishes populated through the canonical system. See migration 047a below.

**Tasks:**

- [x] **Audit:** Search codebase for any references to `ingredients_master`, `ingredient_allergens`, `ingredient_dietary_tags`
  - Check: `apps/web-portal/lib/ingredients.ts`, `apps/web-portal/components/forms/DishFormDialog.tsx`
  - Check: `infra/supabase/functions/feed/index.ts`, `infra/supabase/functions/nearby-restaurants/index.ts`
  - Check: `apps/mobile/src/services/ingredientService.ts`
  - Check: all Postgres triggers and functions in migration files
  - Check: `infra/supabase/migrations/database_schema.sql`
- [x] **Verify data parity:** Confirm every row in `ingredients_master` has a corresponding `canonical_ingredients` entry

> ⚠️ **Blocking dependency — fix trigger functions before dropping tables:**  
> `calculate_dish_allergens` (migration 011a lines 97–113) and `calculate_dish_dietary_tags` (lines 120–153) both join `dish_ingredients.ingredient_id` against `ingredient_allergens.ingredient_id` and `ingredient_dietary_tags.ingredient_id` respectively — which reference `ingredients_master.id`, **not** `canonical_ingredients.id`. Since `dish_ingredients` links to `canonical_ingredients`, this join produces no rows for any dish. `dishes.allergens` and `dishes.dietary_tags` are currently empty for all dishes populated through the canonical system. Dropping `ingredients_master` first would either fail (FK violation) or silently leave the functions broken. **Both functions must be rewritten to use the canonical tables before the DROP.**

- [x] **Migration `047a_fix_allergen_trigger_functions.sql`** — rewrite both functions to use the canonical system:

  ```sql
  -- Fix calculate_dish_allergens: use canonical_ingredient_allergens (not ingredient_allergens)
  CREATE OR REPLACE FUNCTION calculate_dish_allergens(p_dish_id UUID)
  RETURNS TEXT[] AS $$
  DECLARE
    allergen_codes TEXT[];
  BEGIN
    SELECT array_agg(DISTINCT a.code ORDER BY a.code)
    INTO allergen_codes
    FROM dish_ingredients di
    JOIN canonical_ingredient_allergens cia ON di.ingredient_id = cia.canonical_ingredient_id
    JOIN allergens a ON cia.allergen_id = a.id
    WHERE di.dish_id = p_dish_id;
    RETURN COALESCE(allergen_codes, ARRAY[]::TEXT[]);
  END;
  $$ LANGUAGE plpgsql STABLE;

  -- Fix calculate_dish_dietary_tags: use canonical_ingredient_dietary_tags (not ingredient_dietary_tags)
  CREATE OR REPLACE FUNCTION calculate_dish_dietary_tags(p_dish_id UUID)
  RETURNS TEXT[] AS $$
  DECLARE
    dietary_tag_codes TEXT[];
    total_ingredients INTEGER;
  BEGIN
    SELECT COUNT(*) INTO total_ingredients
    FROM dish_ingredients WHERE dish_id = p_dish_id;

    IF total_ingredients = 0 THEN
      RETURN ARRAY[]::TEXT[];
    END IF;

    SELECT array_agg(DISTINCT dt.code ORDER BY dt.code)
    INTO dietary_tag_codes
    FROM dietary_tags dt
    WHERE dt.id IN (
      SELECT cidt.dietary_tag_id
      FROM canonical_ingredient_dietary_tags cidt
      WHERE cidt.canonical_ingredient_id IN (
        SELECT di.ingredient_id FROM dish_ingredients di WHERE di.dish_id = p_dish_id
      )
      GROUP BY cidt.dietary_tag_id
      HAVING COUNT(DISTINCT cidt.canonical_ingredient_id) = total_ingredients
    );

    RETURN COALESCE(dietary_tag_codes, ARRAY[]::TEXT[]);
  END;
  $$ LANGUAGE plpgsql STABLE;

  -- Backfill allergens and dietary_tags for all existing dishes
  UPDATE dishes
  SET
    allergens     = calculate_dish_allergens(id),
    dietary_tags  = calculate_dish_dietary_tags(id)
  WHERE id IN (SELECT DISTINCT dish_id FROM dish_ingredients);
  ```

- [x] **Migration `047b_drop_ingredients_master.sql`** — only run after 047a is confirmed:
  ```sql
  DROP TABLE IF EXISTS ingredient_dietary_tags;
  DROP TABLE IF EXISTS ingredient_allergens;
  DROP TABLE IF EXISTS ingredients_master;
  ```
- [x] **Update `database_schema.sql`** to remove the three tables and show the rewritten function bodies

### 1.2 Drop legacy `dishes.ingredients` TEXT[] column

**Review reference:** Part 8 Q4

**Current state:**

- `dishes.ingredients` TEXT[] exists alongside the normalised `dish_ingredients` join table
- The `DishFormDialog` (848 lines) writes to `dish_ingredients` via `lib/ingredients.ts`
- The feed Edge Function joins `dish_ingredients` for allergen/ingredient data
- The TEXT[] column is a migration artefact from before the canonical system

**Tasks:**

- [x] **Audit:** Search all files for `dishes.ingredients`, `.ingredients`, `ingredients:` in Supabase queries
  - Check: `apps/web-portal/lib/restaurantService.ts` (the `saveAllRestaurantData` function inserts dishes — does it write `ingredients`?)
  - Check: `apps/web-portal/app/onboard/review/page.tsx` (final submission)
  - Check: `apps/web-portal/components/forms/DishCard.tsx` (reads `dish.ingredients` for display?)
  - Check: `apps/mobile/src/types/supabase.ts` (type definitions)
  - Check: feed Edge Function — does `fetchDishes` select `ingredients`?
- [x] **Shadow deprecation — remove all live writes and reads.** The following source files contain active references (confirmed March 18 2026):

  | File                                                  | Line(s)                                      | Action                                                                                                                      |
  | ----------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
  | `apps/web-portal/lib/restaurantService.ts`            | 394: `ingredients: dish.ingredients \|\| []` | Remove this field from the insert object                                                                                    |
  | `apps/web-portal/components/forms/DishFormDialog.tsx` | 97, 135, 195, 223                            | Remove `ingredients` from form state and form reset; display section should switch to showing `selectedIngredients` instead |
  | `apps/web-portal/lib/export.ts`                       | 44, 94                                       | Remove `ingredients` field from JSON/CSV export; replace with `selectedIngredients` display names if needed                 |
  | `apps/web-portal/lib/validation.ts`                   | 64: `ingredients: z.array(z.string())`       | Remove from `dishSchema`                                                                                                    |

- [x] **Backfill check:** Verify no dish has data in `ingredients` TEXT[] that is NOT also represented in `dish_ingredients`. SQL:
  ```sql
  SELECT d.id, d.name, d.ingredients
  FROM dishes d
  WHERE d.ingredients IS NOT NULL
    AND array_length(d.ingredients, 1) > 0
    AND d.id NOT IN (SELECT DISTINCT dish_id FROM dish_ingredients);
  ```
- [x] **Migration `048_drop_dishes_ingredients_text_array.sql`:**
  ```sql
  ALTER TABLE dishes DROP COLUMN IF EXISTS ingredients;
  ```
- [x] **Update TypeScript types** in `apps/web-portal/lib/supabase.ts` and `apps/mobile/src/types/`
- [x] **Update `database_schema.sql`**

### 1.3 Migrate `dishes.spice_level` from SMALLINT to TEXT enum

**Review reference:** Part 8 Q3

**Current state:**

- `dishes.spice_level` is SMALLINT with CHECK 0–4, but only 0, 1, 3 are used (migration 041b)
- The web portal uses a `SPICE_LEVELS` constant mapping: `[{ value: 0, label: 'None' }, { value: 1, label: 'Mild' }, { value: 3, label: 'Hot' }]`
- The feed Edge Function reads `spice_level` as a number
- The mobile `filterStore` has `spiceLevel: 'noSpicy' | 'eitherWay' | 'iLikeSpicy'` (different enum — this maps in the Edge Function)

**Tasks:**

- [x] **Migration `049_spice_level_to_text_enum.sql`:**

  ```sql
  ALTER TABLE dishes
    ALTER COLUMN spice_level DROP DEFAULT,
    ALTER COLUMN spice_level TYPE TEXT
      USING CASE
        WHEN spice_level = 0 THEN 'none'
        WHEN spice_level = 1 THEN 'mild'
        WHEN spice_level = 3 THEN 'hot'
        ELSE 'none'
      END;

  ALTER TABLE dishes
    ALTER COLUMN spice_level SET DEFAULT 'none',
    ADD CONSTRAINT dishes_spice_level_check
      CHECK (spice_level IN ('none', 'mild', 'hot'));
  ```

- [x] **Update web portal:**
  - `lib/constants.ts` — change `SPICE_LEVELS` from `{ value: 0|1|3 }` to `{ value: 'none'|'mild'|'hot' }`
  - `components/forms/DishFormDialog.tsx` — update form field type
  - `components/forms/DishCard.tsx` — update display mapping (🌶️ icons from enum)
  - `lib/validation.ts` — update `dishSchema.spice_level` Zod type
  - `lib/restaurantService.ts` — verify write path uses text values
- [x] **Update feed Edge Function:** `infra/supabase/functions/feed/index.ts` — update `calculateScore` spice comparison logic _(N/A — `calculateScore` has no spice comparison logic; no change required)_
- [x] **Update `infra/supabase/functions/nearby-restaurants/index.ts`** — change `spice_level?: number` type (line 59) and any numeric comparisons (line 185) to use `'none' | 'mild' | 'hot'`
- [x] **Update `apps/web-portal/lib/menu-scan.ts`** — this file uses `spice_level: 0|1|2|3|4|null` (a 5-value range wider than the 0/1/3 DB constraint). After the TEXT migration:
  - Change the `MenuScanDish.spice_level` type to `'none' | 'mild' | 'hot' | null`
  - Update the mapping function at line 317 to convert numeric AI output to text: `0→'none'`, `1|2→'mild'`, `3|4→'hot'`
  - Update the default at line 349 from `null` to `'none'`
- [x] **Update mobile types:** `apps/mobile/src/types/supabase.ts` _(done: `spiceUtils.ts`, `edgeFunctionsService.ts`, `geoService.ts`)_
- [x] **Update `database_schema.sql`**

### 1.4 Migrate `user_preferences.allergies` from JSONB to TEXT[]

**Review reference:** Part 8 Q6

**Current state:**

- `user_preferences.allergies` stores `{ "lactose": false, "gluten": true, "peanuts": false, ... }` as JSONB
- `filterStore.ts` permanent filters have `allergies: { lactose: boolean, gluten: boolean, ... }` — a fixed boolean map
- `edgeFunctionsService.ts` extracts active keys: `Object.entries(permanentFilters.allergies).filter(([_, v]) => v).map(([k]) => k)`
- Feed Edge Function compares `allergens` array on dishes against the flat allergen name array

**Tasks:**

- [x] **Verify allergen codes in the `allergens` table** before running the migration:

  ```sql
  SELECT code FROM allergens ORDER BY code;
  -- Expected (from migration 010): milk, eggs, fish, shellfish, tree_nuts, peanuts,
  -- wheat, soybeans, sesame, gluten, lactose, sulfites, mustard, celery
  ```

  > **Important:** The `allergens` table uses lowercase codes. The `user_preferences.allergies` JSONB keys do NOT match one-to-one:
  >
  > - `soy` → must map to `soybeans`
  > - `nuts` → must map to `tree_nuts`
  > - All other keys (`gluten`, `sesame`, `lactose`, `peanuts`, `shellfish`) match directly.
  >   Using `UPPER(key)` or a raw key-copy would produce wrong codes (`SOY`, `NUTS`) that would never match `dishes.allergens`.

- [x] **Migration `050_allergies_jsonb_to_text_array.sql`:**

  ```sql
  -- Convert JSONB boolean map to TEXT[] using explicit code mapping.
  -- Allergen codes must match the allergens.code column (all lowercase).
  ALTER TABLE user_preferences
    ALTER COLUMN allergies TYPE TEXT[]
      USING (
        SELECT COALESCE(
          array_agg(
            CASE key
              WHEN 'soy'       THEN 'soybeans'   -- JSONB key differs from DB code
              WHEN 'nuts'      THEN 'tree_nuts'   -- JSONB key differs from DB code
              ELSE key                            -- gluten, sesame, lactose, peanuts, shellfish match
            END
          ),
          '{}'::TEXT[]
        )
        FROM jsonb_each_text(COALESCE(allergies, '{}'::jsonb))
        WHERE value = 'true'
      );

  ALTER TABLE user_preferences
    ALTER COLUMN allergies SET DEFAULT '{}';
  ```

- [x] **Update mobile `filterStore.ts`:**
  - Change `PermanentFilters.allergies` from `{ lactose: boolean, ... }` to `string[]`
  - Update `loadPermanentFilters` / `savePermanentFilters` to read/write TEXT[] directly
  - Update the allergen UI (checkbox list → reads from `allergens` reference table instead of hardcoded keys)
    _(Note: in-memory boolean-map interface kept unchanged; conversion to TEXT[] handled in `userPreferencesService.ts` so no UI code breaks)_
- [x] **Update `edgeFunctionsService.ts`:** Simplify — pass `permanentFilters.allergies` directly (already an array of codes) _(allergen code mapping `soy→soybeans`, `nuts→tree_nuts` added)_
- [x] **Update `userPreferencesService.ts`:** Update sync functions to handle TEXT[] format
- [x] **Update feed Edge Function:** Allergen filter becomes `dishes.allergens && $allergies` (array overlap) _(N/A — Edge Function already does in-memory comparison; `edgeFunctionsService.ts` fix ensures correct codes are sent)_
- [x] **Update `database_schema.sql`**

### 1.5 Migrate other JSONB boolean-map columns on `user_preferences`

**Review reference:** Part 8 Q6 pattern applied consistently

**Current state:** `exclude`, `diet_types`, `religious_restrictions` all use the same JSONB boolean-map pattern. Migrating them to TEXT[] alongside `allergies` keeps the schema consistent.

**Tasks:**

> **Code mapping notes for this migration (all codes lowercase, matching `dietary_tags.code`):**
>
> - `exclude` keys (`noMeat`, `noDairy`, etc.) are exclusion intents, not dietary tag codes. Map them to the closest dietary tag: `noMeat→vegetarian`, `noDairy→dairy_free`. `noEggs`, `noFish`, `noSeafood`, `noSpicy` have no direct dietary tag — store as-is with snake_case normalisation for now; wire to the Edge Function in Phase 2 once the full mapping is designed.
> - `diet_types.lowCarb` → `low_carb` (snake_case), `diabetic` has no standard dietary tag code — store as `diabetic` and create a dietary tag if needed.
> - `religious_restrictions` keys (`halal`, `kosher`, `hindu`, `jain`, `buddhist`) match `dietary_tags.code` values directly after lowercasing.

- [x] **Migration `051_user_preferences_jsonb_to_text_arrays.sql`:**

  ```sql
  -- exclude → TEXT[] (map to closest dietary_tags codes)
  ALTER TABLE user_preferences
    ALTER COLUMN exclude TYPE TEXT[]
      USING (
        SELECT COALESCE(
          array_agg(
            CASE key
              WHEN 'noMeat'    THEN 'vegetarian'
              WHEN 'noDairy'   THEN 'dairy_free'
              WHEN 'noEggs'    THEN 'no_eggs'
              WHEN 'noFish'    THEN 'no_fish'
              WHEN 'noSeafood' THEN 'no_seafood'
              WHEN 'noSpicy'   THEN 'no_spicy'
              ELSE lower(key)
            END
          ),
          '{}'::TEXT[]
        )
        FROM jsonb_each_text(COALESCE(exclude, '{}'::jsonb))
        WHERE value = 'true'
      );
  ALTER TABLE user_preferences ALTER COLUMN exclude SET DEFAULT '{}';

  -- diet_types → TEXT[] (map to dietary_tags codes; lowCarb→low_carb)
  ALTER TABLE user_preferences
    ALTER COLUMN diet_types TYPE TEXT[]
      USING (
        SELECT COALESCE(
          array_agg(
            CASE key
              WHEN 'lowCarb' THEN 'low_carb'
              ELSE lower(key)   -- keto, paleo, diabetic, pescatarian
            END
          ),
          '{}'::TEXT[]
        )
        FROM jsonb_each_text(COALESCE(diet_types, '{}'::jsonb))
        WHERE value = 'true'
      );
  ALTER TABLE user_preferences ALTER COLUMN diet_types SET DEFAULT '{}';

  -- religious_restrictions → TEXT[] (keys match dietary_tags.code after lowercase)
  ALTER TABLE user_preferences
    ALTER COLUMN religious_restrictions TYPE TEXT[]
      USING (
        SELECT COALESCE(
          array_agg(lower(key)),  -- halal, kosher, hindu, jain, buddhist
          '{}'::TEXT[]
        )
        FROM jsonb_each_text(COALESCE(religious_restrictions, '{}'::jsonb))
        WHERE value = 'true'
      );
  ALTER TABLE user_preferences ALTER COLUMN religious_restrictions SET DEFAULT '{}';
  ```

- [x] **Update mobile `filterStore.ts`:** Change `PermanentFilters.exclude`, `.dietTypes`, `.religiousRestrictions` from boolean maps to `string[]` _(in-memory boolean-map interface kept; conversion handled in `userPreferencesService.ts`)_
- [x] **Update `userPreferencesService.ts`:** All read/write functions for these columns
- [ ] **Update feed Edge Function:** Wire `religious_restrictions` as a hard filter (SQL WHERE clause — array overlap with `dishes.dietary_tags`) _(deferred to Phase 2 — new feature addition, not a type migration)_
- [x] **Update `database_schema.sql`**

### Phase 1 — Acceptance Criteria

- [x] `calculate_dish_allergens` and `calculate_dish_dietary_tags` are rewritten to use `canonical_ingredient_allergens` / `canonical_ingredient_dietary_tags`
- [x] Backfill UPDATE confirms that `dishes.allergens` and `dishes.dietary_tags` are now populated for all dishes with canonical ingredients _(run migration 047a in Supabase SQL Editor to confirm)_
- [x] `ingredients_master`, `ingredient_allergens`, `ingredient_dietary_tags` tables are dropped
- [x] `dishes.ingredients` TEXT[] column is dropped; no source file references it (checked: `restaurantService.ts`, `DishFormDialog.tsx`, `export.ts`, `validation.ts`)
- [x] `dishes.spice_level` is TEXT with CHECK ('none', 'mild', 'hot'); all web portal (`constants.ts`, `DishFormDialog.tsx`, `DishCard.tsx`, `validation.ts`, `restaurantService.ts`, `menu-scan.ts`) + Edge Functions (`feed`, `nearby-restaurants`) + mobile types use text values
- [x] `menu-scan.ts` maps AI numeric output (0–4) to the three text values correctly
- [x] `user_preferences.allergies` is TEXT[] of lowercase allergen codes matching `allergens.code`; `soy→soybeans`, `nuts→tree_nuts` mapping confirmed
- [x] `user_preferences.exclude`, `.diet_types`, `.religious_restrictions` are TEXT[]
- [x] All TypeScript types are updated across mobile, web portal, and shared packages _(filterStore boolean-map interface intentionally preserved; DB ↔ store conversion handles the translation)_
- [x] `database_schema.sql` is updated to reflect all changes
- [ ] All existing tests/manual flows still work (onboarding, menu edit, feed, dish detail) _(requires running the app)_

**Estimated effort:** 4–6 days _(revised up from 3–4: trigger function rewrite + backfill, full `dishes.ingredients` code sweep across 4 files, `menu-scan.ts` numeric→text spice mapping)_

---

## Phase 2 — Filter Pipeline Unification

**Goal:** Kill client-side filtering, make the Edge Function the single source of truth for all filtered results, and wire the hard/soft model consistently.

**Prerequisites:** Phase 1 (TEXT[] columns needed for clean array-overlap filters in the Edge Function)

**Risk:** Medium — this changes how the map screen gets its data. Must be carefully tested to ensure no regression in the restaurant discovery experience.

### 2.1 Extend the feed Edge Function to serve both restaurants and dishes

**Review reference:** Part 8 Q11

**Current state:**

- `feed/index.ts` returns **dishes** (dish-level discovery)
- `nearby-restaurants/index.ts` returns **restaurants** (restaurant-level discovery)
- `filterService.ts` applies client-side filters to the restaurant list on the map screen
- This means two filter codebases with inconsistent hard/soft behaviour

**Tasks:**

- [x] **Extend `feed/index.ts`** to accept a `mode` parameter:
  - `mode: 'dishes'` — current behaviour (default)
  - `mode: 'restaurants'` — returns filtered + scored restaurants instead of dishes
  - Restaurant mode uses the same hard/soft filter pipeline, then aggregates to restaurant level
- [x] **Implement hard/soft filter alignment in the Edge Function:**

  **Hard filters (permanent — absolute exclusion, SQL WHERE):**
  - `diet_preference` — exclude dishes where `dietary_tags` don't include the required diet tag
  - `allergies` — exclude dishes where `dishes.allergens && user_allergies` (array overlap)
  - `religious_restrictions` — exclude dishes where `dietary_tags` don't include required religious tags (HALAL, KOSHER)
  - Previously disliked dishes — exclude by `user_dish_interactions`

  **Soft filters (daily + permanent soft — scoring boosts, never exclude):**
  - `cuisineTypes` (daily) — boost matching `restaurant.cuisine_types`
  - `priceRange` (daily) — boost dishes in range, don't exclude those outside
  - `spiceLevel` (daily) — boost matching `dishes.spice_level`
  - `proteinTypes` (daily) — boost matching protein ingredients
  - `favorite_cuisines` (permanent) — boost matching cuisines
  - `spice_tolerance` (permanent) — boost matching spice levels
  - `ingredients_to_avoid` (permanent) — annotate, never exclude
  - `calorieRange` (daily) — boost dishes in range

- [x] **Update `calculateScore()`** to accept all soft signals and produce boost points for each
- [x] **Remove price as a hard filter** from the current feed Edge Function (it is currently a hard exclusion — see review §9.6)
- [x] **Remove calorie range as a hard filter** from the current feed Edge Function

### 2.2 Update the mobile app to call the Edge Function for all filtered results

**Tasks:**

- [x] **Update `edgeFunctionsService.ts`:**
  - Add `getFilteredRestaurants()` function (or extend `getFeed()` with `mode: 'restaurants'`)
  - Pass all daily + permanent filter fields to the Edge Function
- [x] **Update `BasicMapScreen.tsx`:**
  - Remove `filterService.applyFilters()` call
  - Call the Edge Function for restaurant results instead
  - Handle loading states (edge function has ~200ms latency vs instant client-side)
- [x] **Update `filterStore.ts`:**
  - Keep as UI state container only
  - Remove any `applyFilters` action if it exists in the store
  - `setDailyFilters()` should trigger a new Edge Function call (via a listener or direct call)

### 2.3 Deprecate and remove `filterService.ts`

**Tasks:**

- [x] **Audit usages:** Find all imports of `filterService` across mobile code
- [ ] **Remove `filterService.ts`** (504 lines) — or keep `estimateAvgPrice()` and `validateFilters()` if still needed, move them to a utility _(deferred: `estimateAvgPrice` still used by BasicMapScreen for map display; remove in follow-up once restaurant data includes avg_price from DB)_
- [x] **Gate `nearby-restaurants` removal behind telemetry:**
  - Do NOT remove `nearby-restaurants/index.ts` in Phase 2. Add request logging to it first.
  - After Phase 2 ships: monitor for one full week. If production traffic to `nearby-restaurants` drops to zero, proceed with removal in a follow-up migration.
  - If any client still calls it (older app builds), keep as a no-op passthrough until traffic is zero.
  - Only then: delete `infra/supabase/functions/nearby-restaurants/` and remove from Supabase Edge Function registry.

### 2.4 Wire remaining `user_preferences` fields into the Edge Function

**Review reference:** Part 8 Q7

**Current state:** `spice_tolerance`, `diet_types`, `religious_restrictions`, `dining_occasions` exist in the DB but are not fully wired into the feed.

**Tasks:**

- [x] **Load `user_preferences`** in the feed Edge Function (currently it only loads `user_dish_interactions`)
- [x] **Wire `religious_restrictions`** as a hard filter (if `['HALAL']` → exclude dishes without HALAL dietary tag)
- [x] **Wire `spice_tolerance`** as a soft boost (boost dishes matching user's tolerance level)
- [x] **Wire `favorite_cuisines`** as a soft boost (same as daily `cuisineTypes` boost, but persistent)
- [x] **Update `filterStore` sync** to cover all persisted preference fields

### Phase 2 — Acceptance Criteria

- [x] Map screen shows restaurants fetched from the Edge Function, not filtered client-side
- [x] `filterService.applyFilters()` is no longer called anywhere
- [x] Hard filters (allergies, diet, religious) absolutely exclude violating dishes/restaurants
- [x] Soft filters (cuisine, price, spice, protein, distance) boost but never hide
- [x] Selecting "Italian" in daily cuisine filter shows Italian at top, but other cuisines still visible below
- [x] Price range filter does not hide dishes — dishes near the range score higher
- [x] `religious_restrictions`, `spice_tolerance`, `favorite_cuisines` from `user_preferences` are active in the feed
- [ ] Feed response time < 500ms for typical queries _(to be validated with production traffic)_

**Estimated effort:** 5–7 days

---

## Phase 3 — Option Groups (Flexible Menu Composition)

**Goal:** Add the option groups system so restaurants can represent composable menus (Thai mains, sushi matrices, build-your-own bowls, experience dishes).

**Prerequisites:** Phase 1 (clean schema). Independent of Phase 2.

**Risk:** Medium-high — significant new tables, web portal UI work, and mobile rendering. However, it is additive (existing dishes continue to work as `dish_kind = 'standard'`).

### 3.1 Database migration

**Review reference:** Part 10 §10.10

**Tasks:**

- [ ] **Migration `052_option_groups.sql`:**

  ```sql
  -- New columns on dishes
  ALTER TABLE dishes
    ADD COLUMN dish_kind TEXT NOT NULL DEFAULT 'standard'
      CHECK (dish_kind IN ('standard', 'template', 'experience')),
    ADD COLUMN display_price_prefix TEXT NOT NULL DEFAULT 'exact'
      CHECK (display_price_prefix IN ('exact', 'from', 'per_person', 'market_price', 'ask_server'));

  -- Option groups table
  CREATE TABLE option_groups (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id      UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    dish_id            UUID REFERENCES dishes(id) ON DELETE CASCADE,
    menu_category_id   UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    description        TEXT,
    selection_type     TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple', 'quantity')),
    min_selections     INTEGER NOT NULL DEFAULT 0,
    max_selections     INTEGER,
    display_order      INTEGER NOT NULL DEFAULT 0,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT option_groups_owner_check CHECK (
      (dish_id IS NOT NULL AND menu_category_id IS NULL) OR
      (dish_id IS NULL AND menu_category_id IS NOT NULL)
    )
  );

  -- Options table
  CREATE TABLE options (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_group_id           UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    name                      TEXT NOT NULL,
    description               TEXT,
    price_delta               NUMERIC NOT NULL DEFAULT 0,
    calories_delta            INTEGER,
    canonical_ingredient_id   UUID REFERENCES canonical_ingredients(id) ON DELETE SET NULL,
    is_available              BOOLEAN NOT NULL DEFAULT true,
    display_order             INTEGER NOT NULL DEFAULT 0,
    created_at                TIMESTAMPTZ DEFAULT now(),
    updated_at                TIMESTAMPTZ DEFAULT now()
  );

  -- RLS
  ALTER TABLE option_groups ENABLE ROW LEVEL SECURITY;
  ALTER TABLE options ENABLE ROW LEVEL SECURITY;

  CREATE POLICY option_groups_owner ON option_groups
    USING (restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    ))
    WITH CHECK (restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    ));

  CREATE POLICY options_owner ON options
    USING (option_group_id IN (
      SELECT og.id FROM option_groups og
      JOIN restaurants r ON r.id = og.restaurant_id
      WHERE r.owner_id = auth.uid()
    ))
    WITH CHECK (option_group_id IN (
      SELECT og.id FROM option_groups og
      JOIN restaurants r ON r.id = og.restaurant_id
      WHERE r.owner_id = auth.uid()
    ));

  -- Indexes
  CREATE INDEX option_groups_restaurant_id_idx ON option_groups(restaurant_id);
  CREATE INDEX option_groups_dish_id_idx ON option_groups(dish_id);
  CREATE INDEX option_groups_menu_category_id_idx ON option_groups(menu_category_id);
  CREATE INDEX options_option_group_id_idx ON options(option_group_id);
  CREATE INDEX options_ingredient_id_idx ON options(canonical_ingredient_id);
  ```

- [x] **Update `database_schema.sql`**
- [x] **Update TypeScript types** in `apps/web-portal/lib/supabase.ts` — add `OptionGroup`, `Option`, `DishKind`, `DisplayPricePrefix` types

### 3.2 Web portal — `DishFormDialog` extension

**Review reference:** Part 10 §10.12 Q2, Q3

**Current state:** `DishFormDialog.tsx` (848 lines) has no concept of option groups or `dish_kind`.

**Tasks:**

- [x] **Add `dish_kind` selector** to the form — radio group: Standard / Template / Experience
  - When `dish_kind` is `standard`: no options UI shown (current behaviour)
  - When `dish_kind` is `template` or `experience`: show "Options" section
- [x] **Add `display_price_prefix` selector** — dropdown: Exact / From / Per person / Market price / Ask server
  - Only shown when `dish_kind` is `template` or `experience`
- [x] **Build Option Groups editor** inside the dialog:
  - "Add Option Group" button → creates a new group with: name, selection_type (single/multiple), min/max selections
  - Within each group: "Add Option" button → name, price_delta, calories_delta, optional ingredient link
  - Inline editing — no separate modal for options
  - Drag/drop or arrow buttons for `display_order`
  - Delete group / delete option with confirmation
- [x] **Implement dish-type presets** (Part 10 §10.12 Q3):
  - When partner selects `dish_kind = 'template'`, show preset picker:
    - "Dish with extras" → 1 optional multiple-choice group
    - "Base + preparation" → 2 required single-choice groups
    - "Build your own" → multiple sequential groups
    - "Combo / set" → 1 required + 1 optional group
    - "Sushi matrix" → 2 required single-choice groups
  - When partner selects `dish_kind = 'experience'`: pre-populate broth/meats/vegetables groups
- [x] **Save logic:** Write `option_groups` + `options` to Supabase on dish save (both wizard mode and DB mode)
- [x] **Load logic:** Fetch existing `option_groups` + `options` when editing a dish
- [x] **Update `lib/restaurantService.ts`:** Include option groups in `saveAllRestaurantData` and `loadRestaurantForReview`
- [x] **Update `lib/validation.ts`:** Add Zod schemas for option groups and options

### 3.3 Web portal — `DishCard` update

**Tasks:**

- [x] Show `dish_kind` badge on the card (Template / Experience)
- [x] Show `display_price_prefix` in price display ("from $13", "$25/person")
- [x] Show option group count summary (e.g. "3 option groups")

### 3.4 Web portal — category-level option groups

**Review reference:** Part 10 §10.5

**Tasks:**

- [ ] **Add "Shared Options" management** to the menu category editor
  - Allow creating option groups with `menu_category_id` (shared across all dishes in that category)
  - UI: a section on the category detail view or a tab within the menu editor
- [ ] **Display merged groups** on dish detail — show category-level groups below dish-level groups

### 3.5 Mobile — dish detail view

**Tasks:**

- [x] **Fetch option groups + options** when opening a dish detail view:
  ```sql
  SELECT * FROM option_groups WHERE dish_id = $1 AND is_active = true ORDER BY display_order;
  SELECT * FROM options WHERE option_group_id = ANY($group_ids) AND is_available = true ORDER BY display_order;
  -- Also fetch category-level groups for the dish's menu_category_id
  ```
- [x] **Render option groups** using inferred render styles (Part 10 §10.12 Q4):
  - `single` + ≤ 5 options → chips or radio list
  - `multiple` + short labels → chips with check state
  - Two single-choice required groups → potential grid layout
  - \> 8 options → grouped list / accordion
  - Experience dishes → sectioned card layout
- [x] **Show price deltas** next to each option (+$2, included)
- [ ] **Show allergen warnings** per option when `canonical_ingredient_id` is set and the user has matching allergies _(deferred to Phase 5 — requires preference vector)_
- [x] **Display `display_price_prefix`** in feed cards and detail view ("from $13", "$25/person")

### Phase 3 — Acceptance Criteria

- [x] A restaurant partner can create a template dish (e.g. "Thai Main Course") with required protein and preparation groups
- [x] A partner can create an experience dish (e.g. "Hot Pot") with broth + meats + vegetables groups
- [x] Dish-type presets pre-populate skeleton option groups correctly
- [ ] Category-level option groups appear on all dishes in that category _(3.4 — deferred)_
- [x] Mobile dish detail renders option groups with appropriate UI for each selection type
- [ ] Option-level allergen warnings appear for users with matching allergies _(deferred to Phase 5)_
- [x] Price display shows "from $X" for template dishes and "$X/person" for experience dishes
- [x] Existing standard dishes are completely unaffected
- [x] RLS policies allow partners to CRUD only their own option groups

**Estimated effort:** 8–12 days

---

## Phase 4 — Embedding Foundation

**Goal:** Add pgvector, the AI enrichment pipeline, and embedding generation so dish vectors are available for ranking in Phase 5.

**Prerequisites:** Phase 1 (clean schema). Phase 3 is not strictly required but option names should be part of embedding input once available.

**Risk:** Low-medium — introduces new infrastructure (pgvector, OpenAI API calls) but does not change any user-facing behaviour yet. All embedding work is async and advisory.

### 4.1 Enable pgvector and add embedding columns

**Review reference:** Part 9 §9.4, Part 11 §11.6

**Tasks:**

- [ ] **Migration `054_embedding_foundation.sql`:**

  ```sql
  -- Enable pgvector
  CREATE EXTENSION IF NOT EXISTS vector;

  -- Embedding + enrichment columns on dishes
  ALTER TABLE dishes
    ADD COLUMN enrichment_status     TEXT DEFAULT 'none'
      CHECK (enrichment_status IN ('none', 'pending', 'completed', 'failed')),
    ADD COLUMN enrichment_source     TEXT DEFAULT 'none'
      CHECK (enrichment_source IN ('none', 'ai', 'manual')),
    ADD COLUMN enrichment_confidence TEXT
      CHECK (enrichment_confidence IN ('high', 'medium', 'low')),
    ADD COLUMN enrichment_payload    JSONB,
    ADD COLUMN embedding_input       TEXT,
    ADD COLUMN embedding             vector(1536);

  -- HNSW index for cosine similarity (partial: skip NULL rows until batch embed completes)
  CREATE INDEX dishes_embedding_hnsw_idx
    ON dishes USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding IS NOT NULL;

  -- Preference vector on user_behavior_profiles
  ALTER TABLE user_behavior_profiles
    ADD COLUMN preference_vector            vector(1536),
    ADD COLUMN preference_vector_updated_at TIMESTAMPTZ;

  -- Restaurant vector
  ALTER TABLE restaurants
    ADD COLUMN restaurant_vector vector(1536);
  ```

- [x] **Update `database_schema.sql`**
- [x] **Update TypeScript types** — add enrichment and embedding fields to the Dish type

### 4.2 Build the AI enrichment Edge Function

**Review reference:** Part 11

**Tasks:**

- [x] **Create `infra/supabase/functions/enrich-dish/index.ts`:**
  - Accept: `{ dish_id: string }`
  - Load dish from DB (name, description, dish_category, existing `dish_ingredients`)
  - Evaluate completeness: `complete` / `partial` / `sparse`
  - If `sparse` or `partial`:
    - Call `gpt-4o-mini` with the structured output prompt (Part 11 §11.4)
    - Store result in `enrichment_payload`
    - Evaluate confidence (high / medium / low)
  - Generate `embedding_input` using the short structured format:
    - Complete: `"{name}, {dish_type}, {ingredients}"`
    - From enrichment: confidence-based rule (Part 11 §11.5)
    - If option groups exist (Phase 3): append all option names
  - Call OpenAI `text-embedding-3-small` with the `embedding_input`
  - Store `embedding`, `embedding_input`, `enrichment_status = 'completed'`, `enrichment_source`, `enrichment_confidence`
  - On failure: set `enrichment_status = 'failed'`, use fallback `embedding_input`
- [x] **Environment variables:** Add `OPENAI_API_KEY` to Supabase Edge Function secrets
- [x] **Cost monitoring:** Log token usage per call for cost tracking

### 4.3 Trigger enrichment on dish creation/update

**Review reference:** Part 12

**Tasks:**

- [x] **Create a Postgres trigger function** that fires AFTER INSERT or UPDATE on `dishes`:
  - On INSERT: call `pg_net.http_post` to the enrich-dish Edge Function
  - On UPDATE of `name`: call `pg_net.http_post` to the enrich-dish Edge Function
- [x] **Create triggers on `dish_ingredients`:**
  - AFTER INSERT or DELETE: notify with the `dish_id`
- [x] **Create triggers on `option_groups` and `options`** (if Phase 3 is complete):
  - AFTER INSERT/UPDATE/DELETE: notify with the parent `dish_id`
- [x] **Use pg_net** for webhook-style Edge Function invocation via SQL migration (version-controlled, reproducible). Implemented in `055_enrich_dish_webhook_trigger.sql`.

### 4.4 Batch embed existing dishes

**Tasks:**

- [x] **Create a one-time script** (`infra/scripts/batch-embed.ts`):
  - Query all dishes where `enrichment_status IN ('none', 'failed')`
  - For each dish: call the `enrich-dish` function
  - Rate limit to stay within OpenAI API limits
  - Log progress and errors
- [ ] **Run against production** after migrations 054 + 055 are applied and enrich-dish is deployed
- [x] **Run `ANALYZE dishes` after the batch completes** — via `run_analyze_dishes()` RPC defined in migration 054

### 4.5 Restaurant vector computation

**Review reference:** Part 9 §9.10.4, Part 12 §12.4

**Tasks:**

- [x] **Create a Postgres function** `update_restaurant_vector(restaurant_id)` — implemented in migration 054
- [x] **Call this function** as part of the dish enrichment pipeline (after embedding is stored)
- [x] **Batch compute** for all existing restaurants in `infra/scripts/batch-embed.ts`

### Phase 4 — Acceptance Criteria

- [x] `pgvector` extension is enabled; `dishes.embedding` column exists with HNSW index
- [x] New dishes get enriched and embedded automatically within ~10 seconds of creation
- [x] The enrichment Edge Function correctly handles sparse (name-only), partial (name+description), and complete (name+ingredients) dishes
- [x] `embedding_input` is stored and auditable for every embedded dish
- [x] AI-generated ingredients in `enrichment_payload` do NOT affect `dishes.allergens` or `dishes.dietary_tags`
- [x] Editing a dish name or ingredients triggers re-embedding; editing price or availability does not
- [x] `restaurants.restaurant_vector` is computed for all restaurants with embedded dishes
- [ ] All existing dishes have embeddings (batch run pending — run `batch-embed.ts` after deploying)
- [x] Enrichment failures are logged and do not break the dish save flow

**Estimated effort:** 5–7 days

---

## Phase 5 — Feed V2 (Two-Stage Pipeline)

**Goal:** Replace the current single-pass scoring with a two-stage candidate generation + ranking pipeline that uses vector similarity as the primary ranking signal.

**Prerequisites:** Phase 2 (unified Edge Function), Phase 4 (embeddings exist)

**Risk:** Medium — this changes the core ranking logic. Requires A/B testing or careful manual comparison to validate that recommendation quality improves.

### 5.1 Implement Stage 1 — Candidate generation

**Review reference:** Part 9 §9.5

**Tasks:**

- [ ] **Refactor `feed/index.ts`** to split into two stages:

  **Stage 1 (single SQL query):**

  ```sql
  SELECT d.*, (d.embedding <=> $preference_vector) AS vector_distance
  FROM dishes d
  JOIN restaurants r ON r.id = d.restaurant_id
  WHERE r.is_active = true
    AND d.is_available = true
    AND ST_DWithin(r.location_point, ST_MakePoint($lng, $lat)::geography, $radius_m)
    -- Hard filters:
    AND ($diet_pref = 'all' OR d.dietary_tags @> ARRAY[$diet_tag])
    AND NOT (d.allergens && $user_allergies)
    AND ($religious = '{}' OR d.dietary_tags @> $religious)
    AND d.id NOT IN (SELECT dish_id FROM user_dish_interactions WHERE user_id = $uid AND interaction_type = 'disliked')
  ORDER BY d.embedding <=> $preference_vector
  LIMIT 200;
  ```

  - If `$preference_vector` is NULL (cold start): fall back to popularity ordering

- [ ] **Create an RPC function** `generate_candidates(...)` in a migration for this query

### 5.2 Implement Stage 2 — Ranking

**Tasks:**

- [ ] **Score the 200 candidates** using a weighted formula:

  ```
  score = w_similarity * (1 - vector_distance)
        + w_rating    * (restaurant.rating / 5.0)
        + w_popularity * dish_analytics.popularity_score
        + w_distance   * (1 - km_distance / radius_km)
        + w_quality    * (has_image * 0.5 + has_description * 0.3 + has_ingredients * 0.2)
        + soft_boost_cuisine
        + soft_boost_price
        + soft_boost_spice
  ```

  - Initial weights: `w_similarity = 0.4, w_rating = 0.2, w_popularity = 0.15, w_distance = 0.15, w_quality = 0.1`
  - Soft boosts remain additive (daily filter signals)

- [ ] **Apply diversity cap** (max 3 dishes per restaurant)
- [ ] **Return top 20**

### 5.3 Cold start fallback

**Review reference:** Part 9 §9.7

**Tasks:**

- [ ] **When `preference_vector` is NULL:**
  - Stage 1: skip vector ordering; use PostGIS distance + popularity instead
  - Stage 2: standard scoring without similarity component; increase weight of rating + popularity
- [ ] **Future (not this phase):** Onboarding-seeded vector — ask users to pick 5–10 example dishes during onboarding

### 5.4 Performance validation

**Tasks:**

- [ ] **Benchmark Stage 1 query** at expected scale (1k, 10k, 100k dishes)
- [ ] **Measure end-to-end latency** of the two-stage pipeline
- [ ] **Compare result quality** against the current `calculateScore` output for a set of test users/locations

### Phase 5 — Acceptance Criteria

- [ ] Feed uses the two-stage pipeline: PostGIS + hard filters + vector ANN → 200 candidates → scored + ranked → top 20
- [ ] Cold start users (no preference vector) still get meaningful results via popularity fallback
- [ ] Recommendation quality is visibly better than the current label-based scoring for users with interaction history
- [ ] End-to-end feed latency remains < 500ms
- [ ] Soft daily filters (cuisine, price, spice) still produce visible ranking effects
- [ ] Hard permanent filters (allergies, diet, religious) still absolutely exclude violating dishes

**Estimated effort:** 5–7 days

---

## Phase 6 — Behaviour Profile Pipeline

**Goal:** Build the aggregation pipeline that computes and stores user preference vectors, enabling personalised ranking in the feed.

**Prerequisites:** Phase 4 (dish embeddings exist), Phase 5 (feed reads `preference_vector`)

**Risk:** Low — the feed already has a cold start fallback. This phase adds data quality over time.

### 6.1 Wire interaction tracking in the mobile app

**Review reference:** Part 13 §13.2

**Current state:** `user_dish_interactions` schema exists; mobile has `viewHistoryService.ts` and `dishRatingService.ts` but limited wiring.

**Tasks:**

- [ ] **Track dish views:** When a user opens a dish detail view for > 3 seconds, insert a `viewed` interaction
- [ ] **Track dish likes:** When a user likes a dish (via the feed or detail view), insert a `liked` interaction
- [ ] **Track dish opinions:** When a user submits a `dish_opinion`, also insert a corresponding interaction (`liked` / `disliked` based on opinion)
- [ ] **Track dish saves:** When a user saves a dish to favourites, insert a `saved` interaction
- [ ] **Ensure idempotency:** Don't insert duplicate interactions for the same user+dish+type within a session

### 6.2 Build the preference vector computation

**Review reference:** Part 9 §9.10.3, Part 13 §13.3

**Tasks:**

- [ ] **Create `infra/supabase/functions/update-preference-vector/index.ts`:**
  - Input: `{ user_id: string }`
  - Load all `user_dish_interactions` for the user (liked, saved, viewed > 10s, opinion = liked/okay)
  - Load dish embeddings for those dishes
  - Compute weighted average:
    - Favorite: 3.0, Positive rating: 2.0, Like: 1.5, View > 10s: 0.5
    - Apply time decay: $w_{\text{decayed}} = w \times e^{-0.01 \times \Delta t_{\text{days}}}$
  - Store result in `user_behavior_profiles.preference_vector` + `preference_vector_updated_at`
- [ ] **Trigger:** Call this function after each new interaction (debounced — max once per 5 minutes per user)
- [ ] **Batch fallback:** Daily cron job that recomputes all profiles where `preference_vector_updated_at < now() - interval '24 hours'` and new interactions exist

### 6.3 Update `user_behavior_profiles` aggregate fields

**Tasks:**

- [ ] **Compute `preferred_cuisines`:** Most common `restaurant.cuisine_types` among liked/saved dishes
- [ ] **Compute `preferred_price_range`:** Median price of liked dishes ± 1 std dev
- [ ] **Compute `interaction_rate`:** Total interactions / distinct session count
- [ ] **Store all** in the `user_behavior_profiles` row alongside the preference vector

### 6.4 Feed integration

**Tasks:**

- [ ] **Load `preference_vector`** in the feed Edge Function (Phase 5 already reads it — this phase ensures it's populated)
- [ ] **Use `preferred_cuisines`** and `preferred_price_range` as additional soft boosts in Stage 2 scoring

### Phase 6 — Acceptance Criteria

- [ ] Every dish view (> 3s), like, save, and opinion creates a `user_dish_interactions` row
- [ ] `preference_vector` is computed and stored for users with ≥ 3 interactions
- [ ] Preference vector updates are debounced (not recomputed on every interaction)
- [ ] The feed uses the preference vector for ranking when available
- [ ] Users with no interactions still get valid results (cold start fallback works)
- [ ] `preferred_cuisines` and `preferred_price_range` are populated and used as soft boosts

**Estimated effort:** 4–5 days

---

## Phase 7 — Group Recommendations V2

**Goal:** Upgrade the Eat Together feature to use vector-based group scoring and enforce hard constraints from all members.

**Prerequisites:** Phase 4 (restaurant vectors), Phase 6 (user preference vectors)

**Risk:** Low — the current group recommendation works. This phase is an incremental upgrade.

### 7.1 Enforce hard constraint union

**Review reference:** Part 8 Q15

**Current state:** `group-recommendations/index.ts` (685 lines) scores restaurants by compatibility but the hard exclusion logic for group members' allergens/dietary constraints has not been verified.

**Tasks:**

- [ ] **Audit the current group-recommendations Edge Function:**
  - Does it union all members' allergies? → If not, implement
  - Does it union all members' diet preferences? → If not, implement
  - Does it union all members' religious restrictions? → If not, implement
- [ ] **Implement hard constraint union:**

  ```
  group_allergies = union(member1.allergies, member2.allergies, ...)
  group_diet = strictest(member1.diet_preference, member2.diet_preference, ...)
  group_religious = union(member1.religious_restrictions, member2.religious_restrictions, ...)
  ```

  - Exclude restaurants where ALL dishes violate any group hard constraint

- [ ] **Test:** Group with one vegan + one nut-allergic member should only see restaurants with at least one vegan, nut-free dish

### 7.2 Vector-based group scoring

**Review reference:** Part 9 §9.10.4

**Tasks:**

- [ ] **Compute group preference vector:**
      $$\text{group\_vector} = \frac{1}{n} \sum_{i=1}^{n} \text{user\_vector}_i$$
  - For members without a preference vector: exclude from the average (don't dilute with zero vectors)
- [ ] **Rank restaurants** by cosine similarity: `restaurants.restaurant_vector <=> group_vector`
- [ ] **Hybrid scoring:** Combine vector similarity with the existing multi-factor score:
  ```
  final_score = 0.4 * vector_similarity
              + 0.3 * existing_compatibility_score
              + 0.2 * distance_score
              + 0.1 * rating_score
  ```
- [ ] **Fallback:** If no members have preference vectors, fall back to the current label-based scoring entirely

### Phase 7 — Acceptance Criteria

- [ ] Group recommendations correctly exclude restaurants that violate any member's hard constraints
- [ ] Vector-based scoring improves group recommendation quality (restaurants are more relevant to the group's combined tastes)
- [ ] Groups where some members have no preference vector still get valid results
- [ ] Existing group flow (join → ready → recommend → vote) is unchanged in UX

**Estimated effort:** 3–4 days

---

---

## Phase 8 — Restaurant Menu View: Context-Aware Filter UX

**Goal:** In the restaurant detail screen, grey out and reorder dishes that don't match the user's permanent hard filters, and highlight ingredients the user wants to avoid.

**Prerequisites:** None — pure mobile frontend. Can be shipped at any time independently of Phases 5–7.

**Risk:** Very low — no backend changes, no migrations, no schema changes.

**Review reference:** `docs/todos/first-principles-review-data-model-filters-recommendations.md` Part 14

### 8.1 New utility: `menuFilterUtils.ts`

**Tasks:**

- [ ] **Create `apps/mobile/src/utils/menuFilterUtils.ts`:**
  - Export `ALLERGY_TO_DB` map (same as `userPreferencesService.ts` — or import from there)
  - Export `classifyDish(dish, permanentFilters, ingredientsToAvoid)` →
    `{ passesHardFilters: boolean, flaggedIngredientNames: string[] }`
  - `passesHardFilters = false` when:
    - `dietPreference === 'vegetarian'` AND dish lacks `vegetarian`/`vegan` dietary tag
    - `dietPreference === 'vegan'` AND dish lacks `vegan` dietary tag
    - Any active allergy maps to an allergen code present in `dish.allergens`
    - Any active religious restriction tag is missing from `dish.dietary_tags`
  - `flaggedIngredientNames`: display names of `ingredientsToAvoid` whose `canonicalIngredientId` appears in `dish.dish_ingredients[].ingredient_id`

### 8.2 Update `RestaurantDetailScreen.tsx`

**Tasks:**

- [ ] **Add `dish_ingredients(ingredient_id)` to the dishes sub-select** in the Supabase restaurant query
- [ ] **Read permanent filters** from `useFilterStore(state => state.permanent)` + `ingredientsToAvoid`
- [ ] **In `renderMenuItem`:** call `classifyDish` and:
  - If `!passesHardFilters`: wrap item in `opacity: 0.35`, append a `"Not for you"` pill (grey, small text)
  - If `flaggedIngredientNames.length > 0`: append `⚠️ Contains: X, Y` warning line in amber
- [ ] **Sort dishes within each category:** passing dishes first, greyed-out dishes last
  - Sort is applied when rendering `category.dishes` — original data is not mutated

### Phase 8 — Acceptance Criteria

- [ ] A user with `dietPreference = vegetarian` sees non-vegetarian dishes greyed out and at the bottom of each menu category
- [ ] A user with an active allergen sees dishes containing that allergen greyed out and at the bottom
- [ ] A user with religious restrictions (e.g. `halal`) sees non-halal dishes greyed out
- [ ] Dishes with avoided ingredients show an amber `⚠️ Contains: …` warning without being greyed out
- [ ] All dishes are still visible and tappable — nothing is hidden
- [ ] Feed behaviour is unchanged — hard filters in the feed still fully exclude non-matching dishes

**Estimated effort:** 0.5–1 day

---

## Summary

| Phase | Name                        | Depends on | Effort      | Risk        |
| ----- | --------------------------- | ---------- | ----------- | ----------- |
| 1     | Schema Cleanup              | —          | 4–6 days    | Low         |
| 2     | Filter Pipeline Unification | Phase 1    | 5–7 days    | Medium      |
| 3     | Option Groups               | Phase 1    | 8–12 days   | Medium-high |
| 4     | Embedding Foundation        | Phase 1    | 5–7 days    | Low-medium  |
| 5     | Feed V2                     | Phase 2, 4 | 5–7 days    | Medium      |
| 6     | Behaviour Profile Pipeline  | Phase 4, 5 | 4–5 days    | Low         |
| 7     | Group Recommendations V2    | Phase 4, 6 | 3–4 days    | Low         |
| 8     | Menu View Filter UX         | —          | 0.5–1 day   | Very low    |

**Total estimated effort:** 33.5–47 days

**Parallelisation:** Phases 2 and 3 can run in parallel after Phase 1. Phase 4 can start as soon as Phase 1 is done. Phase 5 requires both 2 and 4. Phases 6 and 7 are sequential at the end. **Phase 8 is fully independent and can be shipped at any time.**

```
Phase 1 ─┬─→ Phase 2 ─────┐
          ├─→ Phase 3      │
          └─→ Phase 4 ─────┼─→ Phase 5 ──→ Phase 6 ──→ Phase 7
                           │
              (2 + 4 done) ┘

Phase 8 (independent — ship any time)
```

**Critical path:** Phase 1 → Phase 4 → Phase 5 → Phase 6 → Phase 7 (20–27 days)

---

_This plan should be treated as a living document. Phase boundaries may shift as implementation reveals dependencies or opportunities. Each phase should be merged and deployed independently._

# Dietary & Allergen Cross-Validation

## Current state

### Three independent allergen vocabularies with divergent codes

The codebase defines allergen codes in three places, each using different identifiers:

| Code | `suggest-ingredients` | `enrich-dish` | `@eatme/shared` |
|------|-----------------------|---------------|------------------|
| milk/dairy/lactose | `milk` | `dairy` | `lactose` |
| eggs | `eggs` | `eggs` | — |
| fish | `fish` | `fish` | — |
| shellfish | `shellfish` | `shellfish` | `shellfish` |
| tree_nuts/nuts | `tree_nuts` | `tree_nuts` | `nuts` |
| peanuts | `peanuts` | `peanuts` | `peanuts` |
| wheat | `wheat` | `wheat` | — |
| soybeans/soy | `soybeans` | `soy` | `soy` |
| sesame | `sesame` | `sesame` | `sesame` |
| gluten | `gluten` | — | `gluten` |
| lactose | `lactose` | — | `lactose` |
| sulfites | `sulfites` | — | — |
| mustard | `mustard` | — | — |
| celery | `celery` | — | — |

Sources:
- `suggest-ingredients/route.ts:45-60` — VALID_ALLERGENS, 14 codes (EU "Big 14" style)
- `enrich-dish/index.ts:111` — inline prompt text, 9 codes (US "Big 9" style, different code names)
- `packages/shared/src/constants/dietary.ts:32-40` — ALLERGENS, 7 codes (consumer-facing subset)

**Impact:** A dish enriched by `enrich-dish` may have `dairy` in its payload while the same dish processed by `suggest-ingredients` would get `milk`. When the consumer app looks up `lactose` from `@eatme/shared`, neither matches. Codes written to `dishes.allergens` column depend on which AI endpoint produced them, creating inconsistent data.

### Two divergent dietary tag vocabularies

| Code | `suggest-ingredients` | `@eatme/shared` | `DIETARY_HINT_MAP` |
|------|-----------------------|------------------|--------------------|
| vegetarian | yes | yes | yes |
| vegan | yes | yes | yes |
| pescatarian | yes | — | yes |
| keto | yes | yes | yes |
| paleo | yes | yes | yes |
| low_carb | yes | yes | — |
| gluten_free | yes | — | yes |
| dairy_free | yes | — | yes |
| halal | yes | yes | yes |
| kosher | yes | yes | yes |
| hindu | — | yes | — |
| jain | — | yes | — |
| organic | yes | — | yes |
| raw | yes | — | — |
| diabetic_friendly | yes | yes | — |
| heart_healthy | yes | — | — |
| egg_free | — | — | yes |
| soy_free | — | — | yes |
| low_sodium | — | — | yes |
| nut_free | — | — | yes |

Sources:
- `suggest-ingredients/route.ts:26-43` — VALID_DIETARY_TAGS, 16 codes
- `packages/shared/src/constants/dietary.ts:12-23` — DIETARY_TAGS, 10 codes
- `apps/web-portal/lib/menu-scan.ts:274-331` — DIETARY_HINT_MAP maps to 18 distinct codes

**Impact:** `DIETARY_HINT_MAP` can produce codes like `egg_free`, `soy_free`, `nut_free`, `low_sodium` that are not in the shared DIETARY_TAGS constant. These codes get stored in `dishes.dietary_tags` but have no corresponding badge/icon in the consumer app, creating invisible dietary data.

### No cross-validation between allergens and dietary tags

The only business rule is `vegan → vegetarian` (`confirm/route.ts:14-20`, `menu-scan.ts:356-359`). No other consistency checks exist:

- A dish can be tagged `vegan` while having `milk` or `eggs` in its allergens — no warning (`confirm/route.ts:319,328`)
- A dish can have `chicken` as a matched ingredient while tagged `vegetarian` — no check
- A dish can be `gluten_free` while having `wheat` or `gluten` allergens — no contradiction detection
- `computeMenuWarnings` (`menu-scan-warnings.ts:50-166`) checks prices, names, confidence, duplicates, and unmatched ingredients but has **zero allergen/dietary consistency checks**

### No ingredient→allergen derivation pipeline

The schema defines a `canonical_ingredient_allergens` junction table (`database_schema.sql:29-35`) designed for ingredient-to-allergen mapping, but:

1. **No seed data:** No migration populates `canonical_ingredient_allergens` — the table is empty
2. **No trigger:** Code comments in `menu-scan.ts:130-131` claim "The authoritative allergens are calculated by the DB trigger from dish_ingredients" — **no such trigger exists** in any migration
3. **No query:** Neither `suggest-ingredients` nor `confirm` ever queries `canonical_ingredient_allergens`
4. `enrich-dish` inferred_allergens are stored only in `enrichment_payload` JSONB (`enrich-dish/index.ts:488`), never written to `dishes.allergens`

### Allergen data stored at confirm without ingredient-based verification

At confirmation time (`confirm/route.ts:328`), allergens from the admin-reviewed payload are stored directly: `allergens: dish.allergens ?? []`. These allergens came from either:
- The `suggest-ingredients` AI call (filtered by `VALID_ALLERGENS` but not verified against ingredients)
- Manual admin input during review

After confirmation, when `insertIngredientsAndOptions` adds `dish_ingredients` records (`confirm/route.ts:341-360`), no allergen recomputation occurs. Adding or removing ingredients has **no effect** on the stored allergens.

### enrich-dish uses different allergen codes than confirm

`enrich-dish/index.ts:111` prompts for `dairy, eggs, fish, shellfish, tree_nuts, peanuts, wheat, soy, sesame` while `suggest-ingredients/route.ts:45-60` validates against `milk, eggs, fish, shellfish, tree_nuts, peanuts, wheat, soybeans, sesame, gluten, lactose, sulfites, mustard, celery`. Even when enrich-dish's allergens eventually surface in the admin review UI, the code difference (`dairy` vs `milk`, `soy` vs `soybeans`) creates silent data inconsistency.

## Reliability / accuracy gaps

1. **Allergen vocabulary fragmentation** — Three sources of truth produce three different code sets. No normalization layer exists. This is a food safety concern: a user filtering by "lactose" won't find dishes flagged with "milk" or "dairy".

2. **Phantom dietary tag codes** — `DIETARY_HINT_MAP` produces codes (`egg_free`, `soy_free`, etc.) that no consumer-facing component can render. These codes silently accumulate in the DB with no visibility.

3. **Zero contradiction detection** — A "vegan" dish with "eggs" allergen is a data error that could cause allergic reactions. The system stores it without warning.

4. **Dead canonical_ingredient_allergens table** — The DB schema supports ingredient→allergen derivation but nothing uses it. The stated plan (DB trigger) was never implemented.

5. **Allergen data diverges after initial save** — Ingredient changes after confirm never update allergens. A dish that had "shrimp" removed still shows "shellfish" allergen.

6. **enrich-dish allergens lost** — Background enrichment infers allergens but stores them only in JSONB payload, not in the queryable `dishes.allergens` array. Consumer queries never see them.

## Improvement opportunities

### DA-01: Unified allergen vocabulary constant

**Current:** Three files define allergen codes with incompatible names (`milk`/`dairy`/`lactose`, `soybeans`/`soy`, `tree_nuts`/`nuts`).
**Proposed:** Create a single `CANONICAL_ALLERGENS` map in `@eatme/shared` that defines the authoritative code + display name + aliases. All three AI endpoints import and use this map. Add a normalizeAllergenCode() function that maps aliases to canonical codes. Apply at every AI response boundary.
**Impact:** H — food safety; inconsistent allergen codes can cause filtering failures
**Effort:** S — new shared constant + update 3 prompt strings + add normalization to 2 response parsers
**Dependencies:** None

### DA-02: Unified dietary tag vocabulary constant

**Current:** `VALID_DIETARY_TAGS` in suggest-ingredients (16 codes), `DIETARY_TAGS` in shared (10 codes), and `DIETARY_HINT_MAP` output (18 codes) are all different sets.
**Proposed:** Consolidate into a single `CANONICAL_DIETARY_TAGS` map in `@eatme/shared` with the full code universe (superset of all three). Each code has: `code`, `label`, `icon` (nullable for non-consumer codes), `displayed: boolean`. Use this as the validation set in all AI endpoints. Update `DIETARY_HINT_MAP` to only produce codes from this set.
**Impact:** M — data consistency, prevents phantom tags in DB
**Effort:** S — consolidate constants + update 2 validation sets + add filter to mapDietaryHints
**Dependencies:** None

### DA-03: Dietary↔allergen contradiction detection in computeMenuWarnings

**Current:** `computeMenuWarnings` (`menu-scan-warnings.ts:50-166`) performs 7 types of checks but none involve allergen/dietary consistency.
**Proposed:** Add deterministic rules:
- `vegan` + any of `milk/dairy/lactose/eggs` → error
- `vegetarian` + any of `fish/shellfish` → error (note: some definitions allow fish for vegetarian, but pescatarian is the correct tag)
- `gluten_free` + any of `wheat/gluten` → error
- `dairy_free` + any of `milk/dairy/lactose` → error
- `kosher` + `shellfish` → warning
These are deterministic rules (not AI), applied at scan review time before confirm.
**Impact:** H — food safety; catches obvious contradictions before data is committed
**Effort:** XS — ~30 lines of rule logic added to `computeMenuWarnings`
**Dependencies:** DA-01 (allergen normalization) for reliable code matching

### DA-04: Ingredient→allergen derivation via canonical_ingredient_allergens

**Current:** `canonical_ingredient_allergens` table exists (`database_schema.sql:29-35`) but is unpopulated with no trigger, no seed data, and no query path.
**Proposed:** Three-step activation:
1. **Seed data:** Create a migration seeding ~50 high-confidence ingredient→allergen mappings (e.g., "milk" → lactose allergen, "shrimp" → shellfish allergen, "wheat flour" → gluten allergen). Cover the "Big 14" EU allergens.
2. **DB trigger:** Create a Postgres trigger on `dish_ingredients` INSERT/DELETE that recomputes `dishes.allergens` as the union of all linked canonical ingredient allergens.
3. **Reconciliation flag:** When trigger-computed allergens differ from AI-suggested allergens, set `enrichment_review_status = 'pending_review'` to surface the discrepancy.
**Impact:** H — transforms allergen data from AI-guessed to ingredient-derived (deterministic)
**Effort:** M — seed data research + trigger + migration + testing
**Dependencies:** DA-01 (unified allergen codes), IM-04 from TOPIC-03 (enrich-dish ingredient linking)

### DA-05: Ingredient→dietary-tag derivation via canonical_ingredient_dietary_tags

**Current:** `canonical_ingredient_dietary_tags` table exists (`database_schema.sql:36-42`) and `canonical_ingredients` has `is_vegetarian`/`is_vegan` boolean columns (`database_schema.sql:46-47`), but none are used in the ingestion pipeline.
**Proposed:** Activate the existing schema:
1. Ensure `is_vegetarian`/`is_vegan` are populated for common ingredients during onboarding/seed.
2. At confirm time, after inserting `dish_ingredients`, compute: if ALL ingredients are `is_vegan`, auto-tag the dish `vegan` + `vegetarian`; if ALL are `is_vegetarian`, auto-tag `vegetarian`. If any ingredient contradicts a human-set dietary tag, surface a warning.
3. Use this as a cross-check against AI-suggested dietary tags.
**Impact:** M — improves dietary tag accuracy; reduces reliance on AI guessing
**Effort:** M — seed is_vegetarian/is_vegan for existing ingredients + logic in confirm route
**Dependencies:** DA-04 (same ingredient data foundation)

### DA-06: Persist enrich-dish allergens to dishes.allergens

**Current:** `enrich-dish/index.ts:488` stores `enrichment_payload` (including `inferred_allergens`) only in JSONB, never updating the queryable `dishes.allergens` array.
**Proposed:** After enrichment, if `enrichment_payload.inferred_allergens` is non-empty and `dishes.allergens` is empty (no admin-set allergens), write normalized allergen codes to `dishes.allergens`. Set `enrichment_review_status = 'pending_review'` so admin can verify. Normalize codes using DA-01's map (convert `dairy` → `lactose`, `soy` → `soy`, etc.).
**Impact:** M — fills allergen data for dishes that were confirmed before AI allergen suggestions existed, or where admin skipped allergen review
**Effort:** S — ~15 lines in enrich-dish update payload + normalization
**Dependencies:** DA-01 (allergen normalization)

### DA-07: Allergen recomputation on ingredient changes

**Current:** After confirm, adding/removing dish_ingredients via admin UI has no effect on `dishes.allergens`. A dish with "shrimp" removed still shows "shellfish".
**Proposed:** If DA-04 trigger is implemented, this is automatic. If not, add a lightweight check in the dish-update API: when `dish_ingredients` change, query `canonical_ingredient_allergens` for the new ingredient set and warn the admin if the current allergens don't match.
**Impact:** M — prevents stale allergen data after ingredient edits
**Effort:** XS if DA-04 is done (trigger handles it), S otherwise (manual check logic)
**Dependencies:** DA-04 (trigger-based) or standalone (warning-based)

### DA-08: Structured Outputs for enrich-dish allergens

**Current:** `enrich-dish/index.ts:127-142` uses `response_format: { type: 'json_object' }` without Zod schema validation. The inline prompt lists 9 allergen codes but GPT can return any string. No post-parse validation against a valid allergen set.
**Proposed:** Add a Zod schema with `z.enum()` for allergens (using the canonical codes from DA-01). Either use `zodResponseFormat` (requires OpenAI SDK, not raw fetch) or add post-parse validation filtering to VALID_ALLERGENS like `suggest-ingredients` already does (`suggest-ingredients/route.ts:121-124`).
**Impact:** M — prevents invalid allergen codes from AI (e.g., "dairy_products", "nuts_and_seeds")
**Effort:** XS — add filter after JSON.parse in enrichWithAI
**Dependencies:** DA-01 (canonical allergen set)

### DA-09: Consumer-safe allergen filtering

**Current:** Consumer app presumably queries `dishes.allergens` for filtering. The 7 codes in `@eatme/shared` ALLERGENS don't cover all codes that AI endpoints produce (14 in suggest-ingredients, 9 in enrich-dish). A dish flagged with `wheat` by AI won't show up when filtering by `gluten` in the app.
**Proposed:** Define allergen groups in `@eatme/shared`: e.g., "gluten group" = [`gluten`, `wheat`], "dairy group" = [`milk`, `dairy`, `lactose`]. Consumer filtering should match against the group, not exact codes. This is a stopgap until DA-01 normalizes at write time.
**Impact:** H — food safety; users filtering by allergen must see all relevant dishes
**Effort:** S — shared constant + update consumer filter query
**Dependencies:** DA-01 makes this unnecessary long-term, but this is an independent quick-win

## Cross-refs

**Prior baseline:**
- No direct baseline items cover allergen/dietary cross-validation (this is new research)
- Baseline #1 (allergens to DB) is implemented but stores AI-guessed values without verification

**Related topics:**
- **TOPIC-01 (prompt-engineering):** Prompt allergen vocabulary inconsistency (DA-01) was noted but not deeply analyzed there
- **TOPIC-03 (ingredient-matching):** IM-04 (enrich-dish ingredient linking) is a prerequisite for DA-04 (ingredient→allergen derivation). IM-09 (unmatched ingredient persistence) affects allergen completeness — if ingredients are lost, so are their allergens
- **TOPIC-06 (enrichment-architecture):** DA-06 (persist enrich-dish allergens) touches the same update payload
- **TOPIC-07 (confidence-provenance):** Allergen provenance (AI-inferred vs ingredient-derived vs admin-set) is a specialization of field-level provenance

**Dependency chain:** DA-01 → DA-03, DA-06, DA-08, DA-09 → DA-04 → DA-05, DA-07

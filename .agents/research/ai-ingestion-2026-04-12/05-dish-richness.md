# TOPIC-05: Dish Information Richness — AI-Populatable Fields

## Current state

### What the `dishes` table stores today

The `dishes` table (`database_schema.sql:125-166`) has 29 columns. Of these, AI currently populates (via `enrich-dish/index.ts:65-74`) only 5 fields into the `enrichment_payload` JSONB blob:

| EnrichmentPayload field | Type | enrich-dish prompt line | Persisted to own column? |
|---|---|---|---|
| `inferred_ingredients` | string[] (max 8) | `index.ts:107` | No — stays in JSONB |
| `inferred_dish_type` | string | `index.ts:108` | No — stays in JSONB |
| `notes` | string | `index.ts:109` | No — stays in JSONB |
| `inferred_allergens` | string[] | `index.ts:110` | No — stays in JSONB (see DA-06) |
| `inferred_dish_category` | string | `index.ts:111` | No — stays in JSONB |

### What the feed ranker actually uses

The `generate_candidates()` RPC (`073_universal_dish_structure.sql:95-250`) and `rankCandidates()` scorer (`feed/index.ts:165-361`) read the following dish fields for scoring:

| Field | Scoring role | Weight/mechanism |
|---|---|---|
| `embedding` (vector) | Primary signal — personalized taste match | ~40% via `vector_distance` |
| `protein_families` | Hard exclusion + soft boost | `generate_candidates` WHERE clause + +0.2 boost (`feed/index.ts:317`) |
| `protein_canonical_names` | Meat subtype soft boost | +0.1 boost (`feed/index.ts:340`) |
| `dietary_tags` | Hard filter + soft boost | WHERE clause + +0.5 boost (`feed/index.ts:282`) |
| `allergens` | Hard exclusion (ingredient-to-avoid overlap) | WHERE clause |
| `spice_level` | Hard exclusion (noSpicy) + soft preference | WHERE clause + boost |
| `calories` | Soft filter | +0.1 boost when within range (`feed/index.ts:296`) |
| `price` | Soft filter | +0.1 boost when in range (`feed/index.ts:291`) |
| `image_url`, `description`, `enrichment_status` | Quality signal | +0.1 combined (`feed/index.ts:305-309`) |

### What the embedding captures

`buildEmbeddingInput()` (`enrich-dish/index.ts:201-274`) builds a labeled natural-language string from:
- Dish name (`index.ts:234`)
- Parent dish name for variants (`index.ts:231-232`)
- `inferred_dish_type` or `dish_kind` (`index.ts:238-239`)
- Restaurant `cuisine_types` (`index.ts:240`)
- `description` (first 300 chars, `index.ts:246`)
- `enrichment_payload.notes` (`index.ts:249`)
- Ingredients: DB + parent + AI supplemental (`index.ts:252-261`)
- Option group names and option names (`index.ts:265-270`)

### What the mobile app filters on

The filter store (`apps/mobile/src/stores/filterStore.ts:28-172`) exposes:
- `proteinTypes` (meat/fish/seafood/egg) → maps to `protein_families`
- `meatTypes` (chicken/beef/pork/lamb/duck/other) → maps to `protein_canonical_names`
- `dietPreference` (vegetarian/vegan) → maps to `dietary_tags`
- `spiceLevel` → maps to `spice_level`
- `calorieRange` → maps to `calories`
- `priceRange` → maps to `price`
- `cuisineTypes` → maps to `restaurant.cuisine_types` (not dish-level)
- `groupMeals` (serves >= 2) → maps to `serves`

### What's missing

The following fields exist in the DB but are never AI-populated, or don't exist yet but have clear downstream consumers:

| Gap | DB column exists? | Downstream consumer exists? |
|---|---|---|
| `protein_families` + `protein_canonical_names` | Yes (`database_schema.sql:151-152`) | Yes — feed hard exclusion + soft boost |
| `calories` estimation | Yes (`database_schema.sql:136`) | Yes — calorieRange filter + feed boost |
| `dish_category_id` from enrichment | Yes (`database_schema.sql:140`) | Partial — used in dish browsing, not feed |
| Cooking method | No | No — but would improve embedding + new filter potential |
| Flavor profile | No | No — but would improve embedding quality |
| Cuisine origin (dish-level) | No | Partial — restaurant-level `cuisine_types` used in feed |
| Preparation time estimate | No | No |
| Serving temperature | No | No |

## Reliability / accuracy gaps

1. **protein_families columns are empty for most dishes.** The `compute_dish_protein_families` RPC exists in types (`packages/database/src/types.ts:2098`) but no trigger or migration creates it. These columns are populated only if someone manually calls the RPC. The feed ranker reads them (`feed/index.ts:317,321,351`) — empty arrays mean protein-based filtering silently fails to match.

2. **inferred_dish_type is uncontrolled free text.** The enrich-dish prompt (`index.ts:108`) gives examples like "grilled meat", "pasta", "salad" but no enum constraint. The `user_behavior_profiles.preferred_dish_types` column (`database_schema.sql:405`) stores an array but nothing populates it — the link between AI-inferred dish types and user preference tracking is broken.

3. **inferred_dish_category has no link to `dish_categories` table.** The enrich-dish prompt returns a free-text string (`index.ts:111`), but the DB has a `dish_categories` table with controlled rows. The AI output is never resolved to a `dish_category_id` — it stays in JSONB. Meanwhile, `suggest-ingredients` (`suggest-ingredients/route.ts:267-289`) does resolve (and even auto-creates) categories.

4. **calories is null for most dishes.** GPT-4o Vision extracts calories only if visible on the menu image (`route.ts:44`). The enrich-dish function doesn't estimate calories. For dishes without menu-listed calories (the majority), the calorie filter and feed boost are dead code.

5. **Embedding quality is limited by available fields.** The embedding captures name, description, ingredients, and cuisine — but not cooking method, flavor profile, or texture. Two dishes with the same ingredients but different preparations (fried chicken vs grilled chicken) produce similar embeddings.

## Improvement opportunities

### DR-01: AI-populate protein_families from dish_ingredients

| Attribute | Value |
|---|---|
| **Title** | Compute protein_families and protein_canonical_names after enrichment |
| **Current behaviour** | `protein_families` and `protein_canonical_names` are `'{}'::text[]` for all dishes. `compute_dish_protein_families` RPC exists in types (`types.ts:2098`) but no trigger invokes it. Feed ranker (`feed/index.ts:317,351`) reads empty arrays — protein filtering is a no-op. |
| **Proposed change** | Add a DB trigger on `dish_ingredients` INSERT/UPDATE/DELETE that calls `compute_dish_protein_families(p_dish_id)`. The function should JOIN `dish_ingredients` → `canonical_ingredients.ingredient_family_name` to derive families (meat, poultry, fish, shellfish, dairy, eggs) and canonical names. Also call it at the end of `enrich-dish` when `inferred_ingredients` are linked to canonical IDs (depends on IM-04 from TOPIC-03). |
| **Impact** | **H** — Unlocks the entire protein-type filtering system (hard exclusion + soft boost) for all existing and future dishes. Currently zero dishes benefit from this filter. |
| **Effort** | **S** — Trigger + function already partially exists; needs wiring and testing |
| **Dependencies** | IM-04 (link enrich-dish inferred_ingredients to canonical IDs) for AI-enriched dishes; standalone for dishes with dish_ingredients already linked |

### DR-02: AI calorie estimation in enrich-dish

| Attribute | Value |
|---|---|
| **Title** | Estimate calories when not menu-provided |
| **Current behaviour** | `calories` is only populated if the menu image explicitly shows calorie counts (`route.ts:44`). The enrich-dish prompt (`index.ts:105-122`) does not ask for calorie estimates. Most dishes have `calories = NULL`. The feed calorie filter (`feed/index.ts:296`) and mobile `calorieRange` filter (`filterStore.ts:69-73`) match zero dishes. |
| **Proposed change** | Add `estimated_calories: number | null` to the enrich-dish prompt with instructions: "Estimate total calories for a single serving. Use common portion sizes. Return null if too uncertain." Store in `enrichment_payload.estimated_calories`. Backfill `dishes.calories` only when `calories IS NULL` and estimate confidence is reasonable. Add a flag `calories_source: 'menu' | 'ai_estimate' | null` to distinguish provenance. |
| **Impact** | **H** — Enables calorie filtering for the vast majority of dishes. Even rough estimates (+/- 20%) make the filter useful for health-conscious users. |
| **Effort** | **S** — Prompt addition + conditional column update in enrich-dish persistence |
| **Dependencies** | None — can be added independently to the existing enrich-dish prompt |

### DR-03: Controlled dish_type vocabulary with DB persistence

| Attribute | Value |
|---|---|
| **Title** | Replace free-text `inferred_dish_type` with a controlled enum and persist to a column |
| **Current behaviour** | `inferred_dish_type` is open-ended text in `enrichment_payload` JSONB (`index.ts:108`). Values vary: "grilled meat", "pasta", "salad", etc. `user_behavior_profiles.preferred_dish_types` (`database_schema.sql:405`) exists but is never populated. No code reads `inferred_dish_type` except `buildEmbeddingInput()` (`index.ts:238-239`). |
| **Proposed change** | (1) Define a controlled vocabulary of ~15-20 dish types (appetizer, soup, salad, pasta, rice_dish, grilled, fried, stew, sandwich, burger, pizza, sushi, taco, dessert, drink, snack, breakfast, side). (2) Add `dish_type TEXT CHECK (dish_type IN (...))` column to `dishes`. (3) Constrain the enrich-dish prompt to pick from the list. (4) Persist to the column. (5) Track in `user_behavior_profiles.preferred_dish_types` based on interactions. (6) Add as a feed filter dimension. |
| **Impact** | **M** — Enables dish-type browsing and preference learning. The infrastructure (`user_behavior_profiles`) already exists but is inert without structured data. |
| **Effort** | **M** — Schema migration, prompt change, profile tracking logic, mobile filter UI |
| **Dependencies** | None for the core column; user preference tracking depends on interaction tracking pipeline |

### DR-04: Link inferred_dish_category to dish_categories table

| Attribute | Value |
|---|---|
| **Title** | Resolve enrich-dish `inferred_dish_category` to `dish_category_id` |
| **Current behaviour** | `enrich-dish` returns `inferred_dish_category` as free text in JSONB (`index.ts:111`). The `dishes.dish_category_id` column (`database_schema.sql:140`) is only populated by the `suggest-ingredients` endpoint (`suggest-ingredients/route.ts:267-289`), which does DB resolution. Dishes that skip the suggest-ingredients step (auto-confirmed, or ingredients skipped by admin) have `dish_category_id = NULL`. |
| **Proposed change** | At the end of `enrich-dish`, if `dish_category_id IS NULL` and `inferred_dish_category` is present: query `dish_categories` for a case-insensitive match, and if found, set `dish_category_id`. Do NOT auto-create new categories (that's baseline #12's concern — controlled vocabulary). |
| **Impact** | **M** — Fills the category gap for dishes that bypass suggest-ingredients. Categories enable grouping/browsing in the mobile app. |
| **Effort** | **XS** — Single query + conditional update in the existing enrich-dish persistence block |
| **Dependencies** | Baseline #12 (controlled dish_categories vocabulary) recommended first to prevent matching against proliferated categories |

### DR-05: Add cooking_method to enrich-dish inference

| Attribute | Value |
|---|---|
| **Title** | Infer cooking method and include in embedding |
| **Current behaviour** | No `cooking_method` field exists on `dishes`. The embedding input (`index.ts:201-274`) captures dish name and description, which may mention cooking methods incidentally, but there's no structured extraction. Two dishes with identical ingredients but different preparations (e.g. fried vs grilled chicken) produce similar embeddings, reducing recommendation diversity. |
| **Proposed change** | (1) Add `cooking_method TEXT[]` column to `dishes` (array — a dish can involve multiple: "grilled", "deep_fried", "baked", "steamed", "raw", "smoked", "braised", "stir_fried", "roasted", "poached", "sauteed", "fermented"). (2) Add `inferred_cooking_methods: string[]` to the enrich-dish prompt. (3) Persist to the column. (4) Include in `buildEmbeddingInput()` as a labeled segment: "Preparation: grilled, smoked". This improves embedding differentiation between dishes that share ingredients but differ in preparation. |
| **Impact** | **M** — Improves embedding quality and recommendation diversity. Also enables future filtering ("I want grilled food, not fried"). |
| **Effort** | **S** — Schema migration + prompt addition + embedding builder update |
| **Dependencies** | None |

### DR-06: Add flavor_profile to enrich-dish inference

| Attribute | Value |
|---|---|
| **Title** | Infer primary flavor dimensions for embedding enrichment |
| **Current behaviour** | No flavor data exists. Embeddings rely on ingredient names for flavor signal, which is indirect (e.g., "chocolate" implies sweet, but "mole" is savory despite containing chocolate). |
| **Proposed change** | Add `inferred_flavor_profile` to enrich-dish prompt: `{ sweet: 0-5, savory: 0-5, spicy: 0-5, sour: 0-5, umami: 0-5, bitter: 0-5 }`. Store in `enrichment_payload`. Include the top 2-3 dominant flavors (score >= 3) as labels in `buildEmbeddingInput()`: "Flavors: savory, umami". Do NOT add a dedicated column initially — keep in JSONB until downstream consumers emerge. |
| **Impact** | **L** — Subtle improvement to embedding quality for taste-based recommendations. Value increases once user preference vectors incorporate flavor data. |
| **Effort** | **XS** — Prompt addition + 3-line embedding builder change |
| **Dependencies** | None for inference; user preference integration is a separate effort |

### DR-07: Propagate cuisine_origin at dish level

| Attribute | Value |
|---|---|
| **Title** | Infer dish-level cuisine origin to disambiguate fusion restaurants |
| **Current behaviour** | Cuisine is only tracked at the restaurant level (`restaurants.cuisine_types`). A fusion restaurant tagged ["Mexican","Japanese"] has all dishes inherit both cuisines in the embedding (`index.ts:240-242`). This dilutes vector relevance — a sushi roll and a taco from the same restaurant get nearly identical cuisine signal. |
| **Proposed change** | Add `inferred_cuisine_origin: string` to the enrich-dish prompt (pick from the restaurant's `cuisine_types` or a broader controlled list). Store in `enrichment_payload`. In `buildEmbeddingInput()`, use `inferred_cuisine_origin` instead of the restaurant-level `cuisineTypes` when available (`index.ts:240`). |
| **Impact** | **M** — Significantly improves embedding quality for fusion/multi-cuisine restaurants. Allows per-dish cuisine matching in the feed ranker. |
| **Effort** | **XS** — Prompt addition + conditional override in embedding builder |
| **Dependencies** | None |

### DR-08: Estimate serving size for calorie normalization

| Attribute | Value |
|---|---|
| **Title** | Infer portion size/weight for calorie normalization and comparison |
| **Current behaviour** | `serves` column (`database_schema.sql:155`) is for group size ("feeds 2-3"). No portion weight data exists. `price_per_person` is computed but `calories_per_person` is not, making calorie comparisons across different `serves` values misleading. |
| **Proposed change** | Add `estimated_portion_grams: number | null` to enrich-dish prompt: "Estimate the total portion weight in grams for a single serving." Store in `enrichment_payload`. Use for: (1) calorie density comparison (`calories / portion_grams`), (2) normalizing calorie estimates across different serving sizes, (3) future "value for money" signal (`price / portion_grams`). |
| **Impact** | **L** — Indirect quality improvement. Value accrues as a building block for smarter calorie and value comparisons. |
| **Effort** | **XS** — Prompt addition only; no schema change needed (stays in JSONB) |
| **Dependencies** | DR-02 (calorie estimation) for the normalization use case |

### DR-09: Populate protein_families from AI-inferred ingredients

| Attribute | Value |
|---|---|
| **Title** | Derive protein_families from enrich-dish inferred_ingredients when dish_ingredients are absent |
| **Current behaviour** | DR-01 handles the trigger-based path from `dish_ingredients`. But many dishes have no linked ingredients — only `enrichment_payload.inferred_ingredients` (up to 8 names, `index.ts:107`). These AI-inferred ingredients are never resolved to canonical IDs (see IM-04), so the protein family trigger can't fire. |
| **Proposed change** | As a fallback in `enrich-dish`, after AI enrichment: if `inferred_ingredients` are present and `protein_families` is empty, derive protein families by string matching against a hardcoded family map (e.g., chicken/turkey → poultry, salmon/tuna → fish, shrimp/lobster → shellfish). This is a heuristic bridge until IM-04 enables proper canonical linking. |
| **Impact** | **M** — Partial but immediate population of protein_families for all enriched dishes, unblocking the protein filter. Less accurate than DB-derived (DR-01) but covers the majority of common proteins. |
| **Effort** | **XS** — ~20-line lookup function in enrich-dish + column update in persistence block |
| **Dependencies** | None — standalone heuristic. Superseded by DR-01 once IM-04 is implemented. |

## Cross-refs

### Prior baseline entries this extends
- Baseline #15 (`option_groups min/max + price_delta`) — still open. DR-05 (cooking_method) and DR-07 (cuisine_origin) are orthogonal new-field opportunities that complement option_groups improvement.
- Baseline (section 4, "DB fields never written") — identified `protein_families` and `calories` as unpopulated. DR-01, DR-02, DR-09 provide concrete implementation paths.

### Topics this depends on or enables
- **IM-04** (TOPIC-03: link enrich-dish inferred_ingredients to canonical IDs) — DR-01 depends on this for trigger-based protein family computation from AI ingredients.
- **DA-01** (TOPIC-04: unified allergen vocabulary) — DR-05 and DR-06 add fields to the enrich-dish prompt; all prompt additions should use the same controlled-vocabulary pattern established by DA-01.
- **TOPIC-06** (enrichment architecture) — DR-02 through DR-08 all add inference steps to enrich-dish. TOPIC-06's caching and batching recommendations affect the cost impact of additional inference.
- **TOPIC-07** (confidence/provenance) — DR-02 introduces `calories_source` provenance; this pattern should align with TOPIC-07's field_sources approach.

### Sequencing recommendation
1. **DR-09** (XS) → immediate protein_families heuristic, unblocks filter
2. **DR-04** (XS) → link dish_category_id from enrichment
3. **DR-06** (XS) → flavor profile in embedding
4. **DR-07** (XS) → dish-level cuisine origin in embedding
5. **DR-08** (XS) → portion size estimate
6. **DR-02** (S) → calorie estimation
7. **DR-05** (S) → cooking method extraction
8. **DR-01** (S) → trigger-based protein_families (after IM-04)
9. **DR-03** (M) → controlled dish_type vocabulary + user preferences

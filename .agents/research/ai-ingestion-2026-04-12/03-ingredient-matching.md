# Ingredient Matching Accuracy & Strategy

## Current state

### Three independent matching implementations

The codebase has three separate ingredient matching codepaths, each with different capabilities:

1. **`bulkLookupAliases` + `matchIngredients`** (`route.ts:299-490`) — used during menu scan extraction. Two-pass bulk OR-ilike (exact then partial `%ilike%`), plus a GPT-4o-mini translation fallback for unmatched terms, plus alias persistence via `saveNewAlias`.

2. **`matchNames`** (`suggest-ingredients/route.ts:173-228`) — used during admin "Suggest Ingredients" flow. Same two-pass exact/partial ilike pattern. No translation fallback. No alias persistence.

3. **`enrichWithAI`** (`enrich-dish/index.ts:101-167`) — background enrichment. Returns `inferred_ingredients` as plain strings in the `EnrichmentPayload` JSONB. **Never links them to `canonical_ingredients` or creates `dish_ingredients` rows.**

### Matching mechanics (shared across #1 and #2)

**Exact pass:** Builds a PostgREST OR filter like `display_name.ilike.chicken,display_name.ilike.tomato` — one query for all names (`route.ts:311`, `suggest-ingredients/route.ts:180`).

**Partial pass:** For unmatched names, builds `display_name.ilike.%chicken%,display_name.ilike.%tomato%` — one query (`route.ts:326`, `suggest-ingredients/route.ts:196`).

**Partial match direction bug:** The result assignment in both implementations checks `displayLower.includes(key)` (`route.ts:337`, `suggest-ingredients/route.ts:208`). This means the DB alias must *contain* the search term. So "chicken" matches alias "chicken breast", but "chicken breast" does NOT match alias "chicken". For compound ingredient names from GPT (common: "chicken breast", "olive oil", "bell pepper"), exact match fails and partial match also fails because the alias is shorter than the search term.

**Translation fallback (scan route only):** Unmatched terms are batch-translated via GPT-4o-mini (`route.ts:351-390`), then re-queried against aliases. New aliases are persisted via `saveNewAlias` (`route.ts:396-415`).

### DB schema

- **`ingredient_aliases`**: `id`, `display_name` (UNIQUE), `canonical_ingredient_id` (FK), `search_vector` (tsvector), `language`, `created_at`, `updated_at` (`database_schema.sql:227-237`)
- **`canonical_ingredients`**: `id`, `canonical_name` (UNIQUE), `is_vegetarian`, `is_vegan`, `ingredient_family_name` (`database_schema.sql:43-52`)
- **`dish_ingredients`**: composite PK `(dish_id, ingredient_id)`, `quantity` (`database_schema.sql:89-97`)

**`search_vector` column:** Exists on `ingredient_aliases` (`database_schema.sql:231`) but is never populated, never indexed, and never queried. No GIN index exists. No trigger to auto-populate it from `display_name`.

**No trigram extension or indexes:** pg_trgm is not enabled; no `gin_trgm_ops` indexes exist on any table.

### Sanitization gap

The `sanitize`/`replace` function strips only commas and percent signs (`route.ts:308`, `suggest-ingredients/route.ts:180`). PostgREST OR filter syntax uses dots as delimiters (`field.operator.value`). An ingredient name containing a dot (e.g., "Dr. Pepper", "St. Louis ribs") would break the filter parsing, potentially matching nothing or causing a 400 error. Parentheses are also special in PostgREST filters.

### enrich-dish: inferred ingredients are dead-end data

`enrichWithAI` (`enrich-dish/index.ts:101-167`) returns up to 8 `inferred_ingredients` as plain English strings. These are:
- Stored in `enrichment_payload` JSONB on the `dishes` table (`enrich-dish/index.ts:488`)
- Used in `buildEmbeddingInput` for the embedding vector (`enrich-dish/index.ts:252-261`)
- **Never resolved to `canonical_ingredient_id`s**
- **Never written to `dish_ingredients` table**

This means dishes enriched only by the background pipeline have no structured ingredient links — they appear in vector search results but can't be filtered by ingredient.

### Unmatched ingredients: permanent data loss

At confirm time, `editableToConfirm()` filters to `status === 'matched'` only — unmatched raw strings are silently dropped and never persisted (baseline item #8, still open). The `menu_scan_jobs.result_json` retains them, but there's no mechanism to re-process them later.

## Reliability / accuracy gaps

1. **Partial match direction asymmetry** — compound names from GPT ("chicken breast") fail to match shorter aliases ("chicken"). This is the most impactful silent accuracy bug in the matching pipeline.

2. **No fuzzy matching at all** — typos ("ciliandro"), alternate spellings ("cilantro" vs "coriander"), and minor pluralization differences ("tomatoes" vs "tomato") all fail both exact and partial ilike.

3. **search_vector column is dead code** — schema has the column, no code uses it.

4. **enrich-dish inferred ingredients are unlinked** — AI-generated ingredient names in the enrichment payload never become `dish_ingredients` rows, leaving background-enriched dishes without structured ingredient data.

5. **PostgREST filter injection via dots/parens** — ingredient names containing dots or parentheses can break OR filter syntax.

6. **Translation alias language always `'es'`** — `saveNewAlias` at `route.ts:486` passes `menuLanguage` from the caller, but the menu-scan route derives language from `COUNTRY_LANGUAGE_MAP` (`route.ts:255-279`) which covers only ~10 countries; others default to English, so a Polish ingredient would get saved with `language: 'en'` even though it's Polish.

7. **No match confidence score** — every match is binary (matched/unmatched). A partial ilike match of "rice" on alias "rice vinegar" is treated with the same confidence as an exact match of "rice" on alias "rice".

8. **First-match-wins in partial pass** — both implementations take the first partial match found (`route.ts:338` `if (!resultMap.has(key))`, `suggest-ingredients/route.ts:208` `if (!partialMap.has(key))`). With no ranking, "rice" might match "rice vinegar" instead of "rice" depending on DB row order.

## Improvement opportunities

### IM-01: Fix partial match direction — bidirectional substring check

| Field | Value |
|-------|-------|
| **Current behaviour** | `displayLower.includes(key)` at `route.ts:337` and `suggest-ingredients/route.ts:208` — only matches if DB alias contains the search term, not vice versa |
| **Proposed change** | Change to `displayLower.includes(key) \|\| key.includes(displayLower)` so that searching "chicken breast" also matches alias "chicken". Add a preference for exact-length matches (shorter edit distance wins). |
| **Impact** | **H** — fixes the most common silent mismatch pattern for compound ingredient names |
| **Effort** | **XS** — one-line change in two files |
| **Dependencies** | None |

### IM-02: Activate tsvector full-text search as a third matching pass

| Field | Value |
|-------|-------|
| **Current behaviour** | `ingredient_aliases.search_vector` column exists (`database_schema.sql:231`) but is never populated or queried. No GIN index. |
| **Proposed change** | 1. Add a trigger to auto-populate `search_vector` from `display_name` using `to_tsvector('english', display_name)`. 2. Create a GIN index on `search_vector`. 3. Add a third matching pass after exact+partial: `search_vector @@ plainto_tsquery('english', term)` via Supabase `.textSearch()`. This handles stemming (tomatoes→tomato), compound splitting, and stop-word tolerance. |
| **Impact** | **H** — tsvector handles pluralization, stemming, and compound word matching that ilike misses entirely |
| **Effort** | **S** — migration for trigger + index, ~20 lines of matching code |
| **Dependencies** | None (column already exists) |
| **Cross-ref** | Extends baseline item #11 (tsvector search — still open). This adds implementation specifics: trigger definition, index type, and integration point in the matching pipeline. |

### IM-03: Add pg_trgm trigram similarity for typo-tolerant matching

| Field | Value |
|-------|-------|
| **Current behaviour** | No fuzzy matching. Typos like "ciliandro" or "parsely" produce no match. |
| **Proposed change** | 1. Enable `pg_trgm` extension. 2. Create GIN trigram index: `CREATE INDEX idx_alias_trgm ON ingredient_aliases USING gin(display_name gin_trgm_ops)`. 3. Add a fourth matching pass for still-unmatched terms: `SELECT * FROM ingredient_aliases WHERE similarity(display_name, $1) > 0.4 ORDER BY similarity DESC LIMIT 1`. Use a conservative threshold (0.4) and mark results as `status: 'fuzzy_matched'` with a `similarity_score` field so the admin review UI can flag them. |
| **Impact** | **M** — catches typos and near-misses that tsvector can't handle; less common than the compound-name gap but reduces unmatched rate by an estimated 10-20% |
| **Effort** | **S** — migration + matching code + new status type |
| **Dependencies** | IM-02 (tsvector) should be tried first as it's cheaper; trigram is complementary |

### IM-04: Link enrich-dish inferred ingredients to canonical IDs

| Field | Value |
|-------|-------|
| **Current behaviour** | `enrichWithAI` at `enrich-dish/index.ts:101-167` returns `inferred_ingredients` as plain strings stored in `enrichment_payload` JSONB (`index.ts:488`). Never resolved to `canonical_ingredient_id`s. Never written to `dish_ingredients`. |
| **Proposed change** | After AI enrichment, run the inferred ingredient names through a matching function (reuse the tsvector/trigram pipeline from IM-02/IM-03, or a simpler exact-ilike lookup against `ingredient_aliases`). For high-confidence matches, insert rows into `dish_ingredients` with a `source: 'ai_enrichment'` marker. For ambiguous matches, store as `enrichment_payload.matched_ingredients` for admin review. |
| **Impact** | **H** — currently ~all background-enriched dishes have zero structured ingredient links, making them invisible to ingredient-based filtering and dietary tag computation |
| **Effort** | **M** — needs a Supabase-side matching query in the edge function (can't reuse the web-portal code directly), plus `dish_ingredients` insert logic |
| **Dependencies** | Best combined with IM-02/IM-03 for better matching quality, but can be done with simple ilike first |

### IM-05: Consolidate matching into a shared module

| Field | Value |
|-------|-------|
| **Current behaviour** | Three independent matching implementations: `bulkLookupAliases` (`route.ts:299-345`), `matchNames` (`suggest-ingredients/route.ts:173-228`), and no matching at all in `enrich-dish`. Each has slightly different behaviour (translation fallback, alias persistence, etc.). |
| **Proposed change** | Extract a single `matchIngredients` function into `apps/web-portal/lib/ingredient-matching.ts` (or `packages/shared/` if enrich-dish needs it). Parameterize: `{ translate?: boolean, persistNewAliases?: boolean, language?: string }`. All three call sites use this shared function. |
| **Impact** | **M** — eliminates divergent behaviour, ensures all improvements (tsvector, trigram, bidirectional partial) apply everywhere |
| **Effort** | **S** — refactor, no new logic |
| **Dependencies** | Should be done before IM-02/IM-03 to avoid implementing improvements in three places. Note: enrich-dish runs in Deno (Supabase Edge Function), so either the shared module must be Deno-compatible or enrich-dish uses direct SQL instead. |

### IM-06: Escape PostgREST special characters in OR filters

| Field | Value |
|-------|-------|
| **Current behaviour** | `sanitize` at `route.ts:308` strips only `,` and `%`. PostgREST OR filters use `.` as a delimiter. Ingredient names with dots (e.g., "Dr. Pepper"), parentheses, or other special chars can break the filter or produce unexpected matches. |
| **Proposed change** | Extend sanitize to also strip or escape `.`, `(`, `)`, and `\`. Alternatively, switch to `.in()` filter for exact matches (avoids OR syntax entirely) and use a parameterized RPC for partial matches. |
| **Impact** | **L** — edge case (few ingredient names contain dots), but when it hits, it silently breaks the entire OR query for all ingredients in that batch |
| **Effort** | **XS** — one-line regex change |
| **Dependencies** | None |

### IM-07: Add match confidence ranking to partial matches

| Field | Value |
|-------|-------|
| **Current behaviour** | First-match-wins with no ranking (`route.ts:338`, `suggest-ingredients/route.ts:208`). "rice" can match "rice vinegar" instead of "rice" depending on DB row order. All matches treated as equal confidence. |
| **Proposed change** | For partial matches, collect all candidates and rank by: 1. Exact length match (alias.length === term.length), 2. Shortest alias (prefer "rice" over "rice vinegar"), 3. Starts-with preference. Expose a `match_confidence: 'exact' | 'partial' | 'fuzzy' | 'translated'` field on `MatchedIngredient` for the review UI. |
| **Impact** | **M** — prevents silent wrong-ingredient assignment; enables admin to prioritize review of low-confidence matches |
| **Effort** | **S** — sorting logic + type extension |
| **Dependencies** | IM-01 (bidirectional) and IM-05 (consolidation) should land first |

### IM-08: Embedding-based ingredient matching via pgvector

| Field | Value |
|-------|-------|
| **Current behaviour** | `dishes.embedding` column exists (pgvector, `database_schema.sql:150`) but is used only for dish similarity, not ingredient lookup. No embeddings exist on `ingredient_aliases` or `canonical_ingredients`. |
| **Proposed change** | 1. Add an `embedding vector(256)` column to `canonical_ingredients`. 2. Pre-compute embeddings for all canonical ingredient names using `text-embedding-3-small` (dim=256 for cost). 3. For unmatched ingredients after tsvector+trigram, compute an embedding and find the nearest canonical ingredient via `<=>` (cosine distance). Use a distance threshold (e.g., < 0.3) to avoid false matches. 4. Mark as `status: 'semantic_matched'` with the distance score. |
| **Impact** | **M** — catches conceptual matches that text similarity misses (e.g., "prawns" → "shrimp", "aubergine" → "eggplant") |
| **Effort** | **L** — schema migration, batch embedding generation, new matching pass, distance threshold calibration |
| **Dependencies** | IM-02 and IM-03 should be exhausted first (cheaper, faster). Embedding matching is a strategic bet for long-tail accuracy. |

### IM-09: Persist unmatched ingredient raw strings

| Field | Value |
|-------|-------|
| **Current behaviour** | `editableToConfirm()` filters to `status === 'matched'` only — unmatched raw strings are permanently lost at confirm time. `menu_scan_jobs.result_json` retains them but has no re-processing mechanism. |
| **Proposed change** | Create a `dish_ingredient_raw` staging table: `(dish_id, raw_text, source, status, resolved_ingredient_id, created_at)`. Insert unmatched ingredients at confirm time. A background job periodically re-attempts matching as the alias DB grows. When resolved, create the `dish_ingredients` row and update status. |
| **Impact** | **M** — prevents permanent data loss; enables retroactive matching as vocabulary improves |
| **Effort** | **S** — migration + confirm route change + simple background matcher |
| **Dependencies** | Schema migration |
| **Cross-ref** | Directly extends baseline item #8 (persist unmatched ingredients — still open). Adds: specific table schema, background re-matching loop, and resolution workflow. |

## Cross-refs

### Prior baseline entries extended
- **#2 (batch ingredient matching)** — now implemented via `bulkLookupAliases` (`route.ts:299-345`). This topic identifies remaining accuracy gaps in the batch approach (partial match direction, no fuzzy matching, no ranking).
- **#8 (persist unmatched ingredients)** — still open. Extended with IM-09: specific staging table schema and background re-matching workflow.
- **#11 (tsvector search)** — still open. Extended with IM-02: trigger definition, index type, integration point, and relationship to trigram/embedding alternatives.

### Dependencies and enables
- **TOPIC-04 (dietary-allergen-crossval)** — better ingredient matching directly improves allergen/dietary inference accuracy, since allergens are derived from matched ingredients.
- **TOPIC-05 (dish-richness)** — IM-04 (linking enrich-dish inferred ingredients) enables protein_family derivation from `canonical_ingredients.ingredient_family_name`.
- **TOPIC-06 (enrichment-architecture)** — IM-04 and IM-05 require changes to the enrich-dish edge function.
- **TOPIC-02 (data-reliability)** — IM-06 (PostgREST escaping) is also a reliability fix.

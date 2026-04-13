## 2026-04-12 — Research Agenda: AI Ingestion Improvements

### Baseline status check

Reviewed current code against `.agents/research/old-menu-scan-improvements.md` (15 items).
Confirmed implemented: #1 (allergens at confirm — `confirm/route.ts:329`), #2 (batch ingredient matching — `route.ts:299-345` bulkLookupAliases), #3 (enrichment_status=pending — `confirm/route.ts:329`), #4 (GPT truncation warning — `route.ts:209-218`), #7 (currency-aware thresholds — `menu-scan-warnings.ts:20-34`), #9 (language fix — `route.ts:255-279` COUNTRY_LANGUAGE_MAP), #10 (parallel PDF render), #14 (2000px resize).

Still open baseline items: #5 (provenance FK), #6 (cross-session dedup), #8 (persist unmatched ingredients), #11 (tsvector search), #12 (controlled dish_categories), #13 (image quality gate), #15 (option_groups min/max + price_delta).

### Research agenda

- [x] TOPIC-01: prompt-engineering — How can we improve extraction accuracy and consistency across GPT-4o Vision, suggest-ingredients, and enrich-dish prompts?
  - Baseline: new (prompt quality not deeply analyzed in baseline)
  - Key files: `route.ts:83-148` (SYSTEM_PROMPT), `suggest-ingredients/route.ts:86-106` (analyseDish prompt), `enrich-dish/index.ts:105-122` (enrichWithAI prompt)
  - Sub-questions: Structured Outputs coverage gaps (suggest-ingredients uses json_object not zodResponseFormat), temperature choices, few-shot example quality, system prompt structure
  - Output: .agents/research/ai-ingestion-2026-04-12/01-prompt-engineering.md

- [x] TOPIC-02: data-reliability — What silent correctness bugs, format drift, and error handling gaps exist across all AI call sites?
  - Baseline: extends #4 (truncation — now implemented), new angles on retry strategy, error propagation
  - Key files: `route.ts:165-230` (extractMenuFromImage), `route.ts:351-390` (translateIngredients — no retry), `enrich-dish/index.ts:101-167` (enrichWithAI — returns null on failure)
  - Sub-questions: No retry on GPT failures, enrichDish sequential loop (route.ts:512-516 — variants not parallelized), enrichResult sequential triple-nested loop (route.ts:536-557), error swallowing patterns
  - Output: .agents/research/ai-ingestion-2026-04-12/02-data-reliability.md

- [x] TOPIC-03: ingredient-matching — How can ingredient matching accuracy improve using tsvector, pgvector, and better fuzzy strategies?
  - Baseline: extends #2 (batch matching — now implemented), #11 (tsvector — still open), new pgvector angle
  - Key files: `route.ts:299-345` (bulkLookupAliases), `route.ts:422-491` (matchIngredients), `suggest-ingredients/route.ts:173-228` (matchNames), `enrich-dish/index.ts:101-167` (AI inferred_ingredients not matched to DB)
  - Sub-questions: tsvector on ingredient_aliases (column exists per baseline, unused), embedding-based fuzzy matching, cuisine-biased ranking, enrich-dish inferred ingredients never linked to canonical IDs
  - Output: .agents/research/ai-ingestion-2026-04-12/03-ingredient-matching.md

- [x] TOPIC-04: dietary-allergen-crossval — Are there cross-validation opportunities between AI-inferred allergens, ingredient-derived allergens, and dietary tags?
  - Baseline: new (baseline identified allergen data drop, now fixed; cross-validation not explored)
  - Key files: `confirm/route.ts:15-20` (normalizeDietaryTags — only vegan→vegetarian), `suggest-ingredients/route.ts:26-60` (VALID_DIETARY_TAGS, VALID_ALLERGENS), `enrich-dish/index.ts:105-122` (inferred_allergens), `menu-scan-warnings.ts` (no allergen/dietary consistency checks)
  - Sub-questions: ingredient→allergen→dietary-tag consistency rules, controlled vocab enforcement across all three AI endpoints, contradiction detection (e.g. "vegan" dish with "milk" allergen)
  - Output: .agents/research/ai-ingestion-2026-04-12/04-dietary-allergen-crossval.md

- [x] TOPIC-05: dish-richness — What additional dish fields could AI populate to improve feed/ranker quality?
  - Baseline: new (baseline identified protein_families as omitted; this goes deeper)
  - Key files: DB schema fields on `dishes` table, `enrich-dish/index.ts:66-74` (EnrichmentPayload — limited to inferred_ingredients, dish_type, notes, allergens, category), `route.ts:33-47` (DishSchema — no cooking method, temperature, flavor)
  - Sub-questions: protein_families, cooking_method, serving_temperature, flavor_profile, preparation_time, cuisine_origin — which have downstream consumers? What would enrich-dish need to add?
  - Output: .agents/research/ai-ingestion-2026-04-12/05-dish-richness.md

- [x] TOPIC-06: enrichment-architecture — What are the gaps in the enrich-dish edge function's architecture (queuing, caching, re-enrichment, observability)?
  - Baseline: extends #3 (enrichment_status — now implemented), #5 (provenance FK — still open)
  - Key files: `enrich-dish/index.ts` (entire file — 538 lines), `confirm/route.ts:329` (sets enrichment_status:'pending')
  - Sub-questions: No batch/queue processing (one dish at a time via webhook), no caching of embeddings for identical dishes, no re-enrichment trigger after admin edits, debounce logic (index.ts:348-354), no observability beyond console.log, no cost tracking
  - Output: .agents/research/ai-ingestion-2026-04-12/06-enrichment-architecture.md

- [x] TOPIC-07: confidence-provenance — How can we calibrate confidence scores and track AI provenance across the pipeline?
  - Baseline: extends #5 (provenance FK — still open), new confidence calibration angle
  - Key files: `route.ts:97` (confidence scale in prompt), `confirm/route.ts:307-309` (enrichmentConfidence mapping), `enrich-dish/index.ts:195-199` (evaluateConfidence), no feedback loop anywhere
  - Sub-questions: Admin edit tracking for calibration, menu_scan_job_id FK on dishes, field_sources JSONB for per-field provenance, prompt versioning
  - Output: .agents/research/ai-ingestion-2026-04-12/07-confidence-provenance.md

- [x] TOPIC-08: open-baseline-items — What implementation detail, dependencies, and alternatives exist for the 7 still-open baseline items?
  - Baseline: directly extends #5, #6, #8, #11, #12, #13, #15
  - Key files: various (as listed in baseline per item)
  - Sub-questions: For each open item — refined implementation approach, dependency analysis, priority re-evaluation given current code state
  - Output: .agents/research/ai-ingestion-2026-04-12/08-open-baseline-items.md

## 2026-04-12 — TOPIC-02 data-reliability complete

Found 14 reliability gaps across all 4 AI call sites, documented as 11 improvement opportunities (DR-01 through DR-11). Key findings:

1. Zero retry logic on any of 5 OpenAI calls — transient failures crash or silently degrade
2. Multi-page extraction uses Promise.all — one page failure loses all pages (DR-02, XS fix)
3. Confirm route has no transaction — partial failures create orphaned DB records (DR-04, M effort)
4. enrich-dish marks dishes 'completed' even when AI call fails (DR-07)
5. Translation failure silently drops ingredient matches for non-English menus (DR-03)
6. No timeouts on any external call — worker thread exhaustion risk (DR-06)

Quick wins (XS): DR-02, DR-03, DR-05, DR-09, DR-10, DR-11
High impact: DR-01 (retry), DR-02 (allSettled), DR-04 (transactions), DR-07 (failure tracking)

## 2026-04-12 — TOPIC-03 ingredient-matching complete

Found 9 improvement opportunities (IM-01 through IM-09) across 3 independent matching implementations. Key findings:

1. Partial match direction bug: compound names from GPT ("chicken breast") fail to match shorter aliases ("chicken") — most impactful silent accuracy bug (IM-01, XS fix)
2. search_vector tsvector column exists on ingredient_aliases but is dead code — no trigger, no index, never queried (IM-02, S effort)
3. enrich-dish inferred_ingredients are never linked to canonical_ingredients — background-enriched dishes have zero structured ingredient data (IM-04, M effort, high impact)
4. Three independent matching implementations with divergent behaviour — should consolidate (IM-05, S effort)
5. PostgREST filter injection via dots in ingredient names (IM-06, XS fix)
6. No fuzzy matching at all — typos/alternate spellings always fail (IM-03 trigram, IM-08 pgvector)
7. First-match-wins with no ranking in partial pass (IM-07)
8. Unmatched ingredients permanently lost at confirm (IM-09, extends baseline #8)

Quick wins (XS): IM-01 (bidirectional partial), IM-06 (PostgREST escaping)
High impact: IM-01, IM-02 (tsvector), IM-04 (link enrich-dish ingredients), IM-05 (consolidation)

## 2026-04-12 — TOPIC-04 dietary-allergen-crossval complete

Found 9 improvement opportunities (DA-01 through DA-09) across allergen/dietary tag handling. Key findings:

1. Three incompatible allergen vocabularies: suggest-ingredients (14 codes, EU-style), enrich-dish (9 codes, US-style with different names like "dairy" vs "milk"), shared constants (7 codes, consumer subset with "lactose" not "milk") — food safety risk from filtering failures
2. Zero contradiction detection: a "vegan" dish with "milk" allergen passes through without warning
3. canonical_ingredient_allergens table exists but is empty — no seed data, no trigger, no queries despite code comments claiming a trigger exists
4. enrich-dish inferred_allergens stored only in JSONB payload, never written to queryable dishes.allergens
5. Dietary hint map produces 18 distinct codes but shared constants only define 10 — phantom codes accumulate in DB
6. Allergens never recomputed after ingredient changes — stale data persists

Quick wins (XS): DA-03 (contradiction rules in computeMenuWarnings), DA-08 (validate enrich-dish allergen output)
High impact: DA-01 (unified vocabulary), DA-03 (contradiction detection), DA-04 (ingredient→allergen derivation), DA-09 (consumer-safe filtering)
Dependency chain: DA-01 → DA-03/DA-06/DA-08/DA-09 → DA-04 → DA-05/DA-07

## 2026-04-12 — TOPIC-05 dish-richness complete

Found 9 improvement opportunities (DR-01 through DR-09) for AI-populatable dish fields. Key findings:

1. protein_families columns exist and are used by the feed ranker for hard exclusion + soft boost, but are empty for all dishes — no trigger computes them, compute_dish_protein_families RPC exists in types but no migration creates it
2. calories is null for most dishes — enrich-dish doesn't estimate, so calorie filter is dead code for non-menu-listed values
3. inferred_dish_type is free text with no controlled vocabulary — user_behavior_profiles.preferred_dish_types exists but is never populated
4. inferred_dish_category never resolved to dish_category_id — stays in JSONB while suggest-ingredients does proper resolution
5. No cooking method, flavor profile, or dish-level cuisine origin — embeddings can't differentiate preparation styles

Quick wins (XS): DR-09 (heuristic protein_families from AI ingredients), DR-04 (link dish_category_id), DR-06 (flavor profile), DR-07 (cuisine origin), DR-08 (portion estimate)
High impact: DR-01 (trigger-based protein_families), DR-02 (calorie estimation), DR-09 (heuristic protein fill)
Sequencing: DR-09 → DR-04 → DR-06/07/08 → DR-02/05 → DR-01 (after IM-04) → DR-03

## 2026-04-12 — TOPIC-06 enrichment-architecture complete

Found 10 improvement opportunities (EA-01 through EA-10) across the enrich-dish edge function architecture. Key findings:

1. No queue — webhook fires per-dish INSERT, creating N concurrent invocations on bulk confirm (50 dishes = 100 OpenAI calls simultaneously)
2. No batch embeddings API usage — each dish gets a separate embedding call despite API supporting 2048 inputs per call
3. enrichment_status is a lie — 'completed' set even when AI enrichment fails (EA-03 splits embedding vs enrichment status)
4. No re-enrichment trigger after admin edits — completed dishes retain stale AI data and embeddings
5. Restaurant vector RPC called N times for same restaurant during bulk confirm (EA-05, XS fix)
6. Console-only logging with no cost tracking — token counts in JSONB but not queryable in aggregate
7. No idempotency — duplicate webhook fires process dish twice
8. Supabase client at module scope with no connection pooling strategy

Quick wins (XS): EA-05 (deduplicate restaurant vector updates), EA-09 (connection pooler)
High impact: EA-01 (queue for bulk enrichment), EA-03 (status split), EA-06 (cost tracking)
Sequencing: EA-01 → EA-02/EA-05 → EA-04 → EA-03 → EA-06 → EA-08 → EA-07/EA-10

## 2026-04-12 — TOPIC-07 confidence-provenance complete

Found 8 improvement opportunities (CP-01 through CP-08) across confidence scoring, provenance tracking, and feedback loops. Key findings:

1. Extraction confidence (GPT-4o OCR legibility 0-1) permanently overwritten by enrichment confidence (completeness heuristic) — two unrelated signals conflated into one column
2. evaluateConfidence() has a dead branch: sparse always returns 'low' regardless of aiEnriched flag
3. No feedback loop: enrichment_review_status='pending_review' is set but never read — no admin UI, no accept/reject, no calibration data
4. No per-field provenance: impossible to know if allergens came from menu scan, AI enrichment, or admin
5. Prompt version drift invisible: model name stored but not prompt version — can't target re-enrichment after prompt improvements
6. Scan-to-dish lineage broken: no FK from dishes to menu_scan_jobs (extends baseline #5 + EA-10)
7. Extraction model/tokens not stored per-dish — cost tracking only covers enrichment, not extraction

Quick wins (XS): CP-03 (prompt version hashes), CP-07 (store extraction tokens)
High impact: CP-01 (separate confidence columns), CP-02 (field_sources JSONB), CP-05 (admin feedback loop)
Sequencing: CP-01 → CP-04 → CP-03 → CP-06/CP-07 → CP-02/CP-08 → CP-05

## 2026-04-12 — TOPIC-08 open-baseline-items complete

Extended all 7 still-open baseline items (#5, #6, #8, #11, #12, #13, #15) with:
- Refined implementation approaches (phased where appropriate)
- Exact file:line citations for current state
- Cross-references to findings from TOPIC-01 through TOPIC-07
- Dependency analysis showing how items connect to new research findings
- Priority re-evaluation with recommended sequencing

Key revisions vs original baseline priorities:
1. #6 (cross-session dedup) promoted to highest priority — most user-visible bug
2. #5 (provenance FK) promoted — now a dependency for CP-06, CP-07, EA-10
3. #11 (tsvector) promoted — dead infrastructure ready to activate
4. #13 (image quality gate) deprioritised — cost saving, not correctness

All 8 research topics are now complete. Ready for synthesis into roadmap.

## 2026-04-12 — Roadmap synthesis complete

Produced `.agents/research/ai-ingestion-2026-04-12/00-roadmap.md` with:
- Executive summary (5 sentences)
- Priority matrix: 68 deduplicated opportunities sorted by impact/effort ratio
- Quick-win bundle: 17 XS-effort items in 4 batches
- Second wave: 4 sub-waves (allergen consistency, enrichment reliability, ingredient matching, dish richness)
- Strategic bets: 7 L-effort items, each with specific decision needed from leadership
- Sequencing recommendation with ASCII dependency graph
- Not recommended section: 7 ideas explicitly rejected with reasoning
- Cross-reference index linking every opportunity to its detail file
- All "current behaviour" claims cite file:line from the detail files

All acceptance criteria satisfied. Emitting LOOP_COMPLETE.

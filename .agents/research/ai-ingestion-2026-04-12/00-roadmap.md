# AI Ingestion Pipeline — Improvement Roadmap

## Executive Summary

EatMe's AI ingestion pipeline processes restaurant menus through four OpenAI call sites (vision extraction, ingredient suggestion, translation, background enrichment) into a Supabase backend. This research identified **70+ improvement opportunities** across 8 focus areas. The most critical systemic issues are: (1) allergen vocabulary fragmentation across three endpoints creating food-safety-relevant data inconsistency, (2) ingredient matching accuracy gaps — the most impactful being a partial-match direction bug silently dropping compound ingredient names, (3) zero cross-validation between allergens, dietary tags, and ingredients, and (4) an enrichment pipeline that marks failed AI calls as "completed," making failures invisible. A phased approach starting with ~15 XS-effort quick wins can immediately improve data reliability and matching accuracy before tackling the larger architectural investments.

---

## Priority Matrix

Sorted by impact/effort ratio (highest first). Deduplicated where multiple topics proposed the same change.

| # | Opportunity | Topic | Impact | Effort | Dependencies |
|---|------------|-------|--------|--------|-------------|
| 1 | [PE-01] Add Structured Outputs to suggest-ingredients | [01](01-prompt-engineering.md) | H | XS | None |
| 2 | [IM-01] Fix partial match direction — bidirectional substring | [03](03-ingredient-matching.md) | H | XS | None |
| 3 | [DR-02] Use Promise.allSettled for multi-page extraction | [02](02-data-reliability.md) | H | XS | None |
| 4 | [DA-03] Dietary↔allergen contradiction detection in warnings | [04](04-dietary-allergen-crossval.md) | H | XS | DA-01 |
| 5 | [PE-02] Set temperature 0.1–0.2 on all classification prompts | [01](01-prompt-engineering.md) | M | XS | None |
| 6 | [PE-05] Remove "primarily Spanish" translation bias | [01](01-prompt-engineering.md) | M | XS | None |
| 7 | [DR-03] Make translation failure visible to user | [02](02-data-reliability.md) | M | XS | None |
| 8 | [DR-05] Propagate ingredient/option insert failures | [02](02-data-reliability.md) | M | XS | None |
| 9 | [DR-10] Distinguish AI failure from empty results | [02](02-data-reliability.md) | M | XS | None |
| 10 | [DR-11] Error handling on final job status update | [02](02-data-reliability.md) | M | XS | None |
| 11 | [PE-04] Add few-shot examples to suggest-ingredients | [01](01-prompt-engineering.md) | M | XS | None |
| 12 | [CP-03] Prompt versioning with hash-based IDs | [07](07-confidence-provenance.md) | M | XS | None |
| 13 | [CP-07] Store extraction model + token counts per scan | [07](07-confidence-provenance.md) | M | XS | None |
| 14 | [Rich-09] Protein families heuristic from AI ingredients | [05](05-dish-richness.md) | M | XS | None |
| 15 | [Rich-07] Dish-level cuisine origin in embedding | [05](05-dish-richness.md) | M | XS | None |
| 16 | [Rich-04] Link inferred_dish_category to dish_categories | [05](05-dish-richness.md) | M | XS | Baseline #12 recommended first |
| 17 | [EA-05] Deduplicate restaurant vector updates | [06](06-enrichment-architecture.md) | M | XS | None |
| 18 | [DA-08] Validate enrich-dish allergens against canonical set | [04](04-dietary-allergen-crossval.md) | M | XS | DA-01 |
| 19 | [PE-07] Increase enrich-dish max_tokens 256→512 | [01](01-prompt-engineering.md) | L | XS | None |
| 20 | [PE-08] Page number context in multi-page prompts | [01](01-prompt-engineering.md) | L | XS | None |
| 21 | [DR-09] Fix storage upload phantom path tracking | [02](02-data-reliability.md) | L | XS | None |
| 22 | [IM-06] Escape PostgREST special chars in OR filters | [03](03-ingredient-matching.md) | L | XS | None |
| 23 | [Rich-06] Flavor profile inference for embedding | [05](05-dish-richness.md) | L | XS | None |
| 24 | [Rich-08] Serving size estimation | [05](05-dish-richness.md) | L | XS | None |
| 25 | [EA-09] Connection pooling for enrich-dish | [06](06-enrichment-architecture.md) | L | XS | None |
| 26 | [DA-01] Unified allergen vocabulary constant | [04](04-dietary-allergen-crossval.md), [01](01-prompt-engineering.md) | H | S | None |
| 27 | [DR-01] Retry with exponential backoff on all OpenAI calls | [02](02-data-reliability.md) | H | S | None |
| 28 | [DR-07] Fix enrich-dish false 'completed' on AI failure | [02](02-data-reliability.md) | H | S | None |
| 29 | [IM-02] Activate tsvector full-text search (3rd match pass) | [03](03-ingredient-matching.md), [08](08-open-baseline-items.md) | H | S | Migration |
| 30 | [DA-09] Consumer-safe allergen group filtering | [04](04-dietary-allergen-crossval.md) | H | S | None (stopgap) |
| 31 | [Rich-01] Protein families trigger on dish_ingredients | [05](05-dish-richness.md) | H | S | IM-04 for AI dishes |
| 32 | [Rich-02] AI calorie estimation in enrich-dish | [05](05-dish-richness.md) | H | S | None |
| 33 | [EA-03] Separate enrichment_status from embedding_status | [06](06-enrichment-architecture.md) | H | S | None |
| 34 | [EA-06] Structured logging with cost tracking | [06](06-enrichment-architecture.md) | H | S | None |
| 35 | [CP-01] Separate extraction_confidence from enrichment_confidence | [07](07-confidence-provenance.md) | H | S | None |
| 36 | [BL-06] Cross-session deduplication before confirm | [08](08-open-baseline-items.md) | H | M | None |
| 37 | [PE-06] Migrate enrich-dish from raw fetch to OpenAI SDK | [01](01-prompt-engineering.md) | M | S | None |
| 38 | [PE-03] (merged into DA-01) | — | — | — | — |
| 39 | [DA-02] Unified dietary tag vocabulary constant | [04](04-dietary-allergen-crossval.md) | M | S | None |
| 40 | [DA-06] Persist enrich-dish allergens to dishes.allergens | [04](04-dietary-allergen-crossval.md) | M | S | DA-01 |
| 41 | [DR-06] Add explicit timeouts to all external calls | [02](02-data-reliability.md) | M | S | None |
| 42 | [DR-08] Concurrency control for enrich-dish webhook | [02](02-data-reliability.md) | M | S | None |
| 43 | [IM-03] pg_trgm trigram similarity (4th match pass) | [03](03-ingredient-matching.md) | M | S | IM-02 first |
| 44 | [IM-05] Consolidate 3 matching implementations | [03](03-ingredient-matching.md) | M | S | None |
| 45 | [IM-07] Match confidence ranking for partial matches | [03](03-ingredient-matching.md) | M | S | IM-01, IM-05 |
| 46 | [IM-09] Persist unmatched ingredient raw strings | [03](03-ingredient-matching.md), [08](08-open-baseline-items.md) | M | S | Migration |
| 47 | [Rich-05] Cooking method inference | [05](05-dish-richness.md) | M | S | None |
| 48 | [EA-02] Batch embeddings API | [06](06-enrichment-architecture.md) | M | S | EA-01 |
| 49 | [EA-04] Re-enrichment trigger on admin edits | [06](06-enrichment-architecture.md) | M | S | EA-01, EA-03 |
| 50 | [EA-08] Idempotency via enrichment_version | [06](06-enrichment-architecture.md) | M | S | None |
| 51 | [EA-10/CP-06] Provenance FK (menu_scan_job_id on dishes) | [06](06-enrichment-architecture.md), [07](07-confidence-provenance.md), [08](08-open-baseline-items.md) | M | S | Migration |
| 52 | [CP-04] Fix evaluateConfidence heuristic | [07](07-confidence-provenance.md) | M | S | CP-01 |
| 53 | [CP-08] Admin edit audit logging | [07](07-confidence-provenance.md) | M | S | None |
| 54 | [BL-11] tsvector activation (merged into IM-02) | — | — | — | — |
| 55 | [BL-12] Controlled dish_categories vocabulary | [08](08-open-baseline-items.md) | M | S | None |
| 56 | [BL-13] Image quality gate (client-side) | [08](08-open-baseline-items.md) | M | S | None |
| 57 | [BL-15] option_groups min/max inference (Phase 1) | [08](08-open-baseline-items.md) | L | S | Prompt schema change |
| 58 | [EA-07] Embedding cache by input hash | [06](06-enrichment-architecture.md) | L | S | None |
| 59 | [DR-04] Transaction wrapper for confirm route | [02](02-data-reliability.md) | H | M | Migration (PG function) |
| 60 | [DA-04] Ingredient→allergen derivation (trigger + seed) | [04](04-dietary-allergen-crossval.md) | H | M | DA-01, IM-04 |
| 61 | [IM-04] Link enrich-dish inferred ingredients to canonical IDs | [03](03-ingredient-matching.md) | H | M | IM-02/IM-03 or simpler ilike |
| 62 | [EA-01] Queue for bulk enrichment | [06](06-enrichment-architecture.md) | H | M | None |
| 63 | [CP-02] Field-level provenance (field_sources JSONB) | [07](07-confidence-provenance.md) | H | M | None |
| 64 | [DA-05] Ingredient→dietary-tag derivation | [04](04-dietary-allergen-crossval.md) | M | M | DA-04 |
| 65 | [Rich-03] Controlled dish_type vocabulary + preferences | [05](05-dish-richness.md) | M | M | None |
| 66 | [BL-15 Phase 2] option_groups price_delta inference | [08](08-open-baseline-items.md) | L | M | BL-15 Phase 1 |
| 67 | [IM-08] Embedding-based ingredient matching (pgvector) | [03](03-ingredient-matching.md) | M | L | IM-02, IM-03 |
| 68 | [CP-05] Admin feedback loop for confidence calibration | [07](07-confidence-provenance.md) | H | L | CP-02, CP-03 |

---

## Quick-Win Bundle (XS Effort)

These 15 items can ship together in 1–2 sessions. No migrations, no architectural changes. Combined effect: eliminates the top silent data bugs, makes AI calls deterministic and failure-visible, and immediately improves ingredient matching.

### Batch 1 — Silent bug fixes (ship first)

| # | Item | What changes | File:line |
|---|------|-------------|-----------|
| 1 | **IM-01**: Fix partial match direction | Add `\|\| key.includes(displayLower)` to bidirectional substring check | `route.ts:337`, `suggest-ingredients/route.ts:208` |
| 2 | **DR-02**: Promise.allSettled for multi-page | Change `Promise.all` → `Promise.allSettled`, filter fulfilled | `route.ts:641-648` |
| 3 | **DR-09**: Fix phantom storage paths | Filter `allSettled` results, only include fulfilled paths | `route.ts:646-653` |
| 4 | **IM-06**: Escape PostgREST special chars | Extend `sanitize` regex to strip `.`, `(`, `)` | `route.ts:308`, `suggest-ingredients/route.ts:180` |

### Batch 2 — Prompt & parameter fixes

| # | Item | What changes | File:line |
|---|------|-------------|-----------|
| 5 | **PE-01**: Structured Outputs for suggest-ingredients | Define Zod schema, use `zodResponseFormat` | `suggest-ingredients/route.ts:104` |
| 6 | **PE-02**: Temperature 0.1 on classification prompts | Add `temperature: 0.1` to 2 call sites | `suggest-ingredients/route.ts:85-106`, `route.ts:357-372` |
| 7 | **PE-04**: Few-shot examples for suggest-ingredients | Add 3-4 assistant message pairs | `suggest-ingredients/route.ts:89-97` |
| 8 | **PE-05**: Remove Spanish bias in translation | Pass `menuLanguage` to prompt, remove "primarily Spanish" | `route.ts:363` |
| 9 | **PE-07**: Increase enrich-dish max_tokens | 256 → 512 + truncation detection | `enrich-dish/index.ts:140` |
| 10 | **PE-08**: Page context in multi-page user message | Template string: "page {n} of {total}" | `route.ts:181-183` |

### Batch 3 — Error visibility

| # | Item | What changes | File:line |
|---|------|-------------|-----------|
| 11 | **DR-03**: Surface translation failure | Return `{ translations: {}, error: true }`, add warning | `route.ts:386-388` |
| 12 | **DR-05**: Propagate ingredient insert failures | Add counter, include in response | `confirm/route.ts:354-407` |
| 13 | **DR-10**: Distinguish AI failure from empty | Return `{ error: true }` on catch, surface in UI | `suggest-ingredients/route.ts:144-152` |
| 14 | **DR-11**: Handle final job status update failure | try/catch + single retry | `route.ts:679-691` |

### Batch 4 — Metadata + observability foundations

| # | Item | What changes | File:line |
|---|------|-------------|-----------|
| 15 | **CP-03**: Prompt versioning | Hash system prompts, store in response metadata | `route.ts:83`, `suggest-ingredients/route.ts:86`, `enrich-dish/index.ts:105`, `route.ts:361` |
| 16 | **CP-07**: Store extraction tokens | Write `usage` object to `menu_scan_jobs` | `route.ts:191-194` |
| 17 | **EA-05**: Deduplicate restaurant vector updates | Conditional RPC at end of batch | `enrich-dish/index.ts:512-514` |

**Expected combined effect:** Fixes the #1 silent ingredient-matching bug (IM-01), prevents total data loss on multi-page failures (DR-02), makes all AI failures visible to admins (DR-03/05/10/11), makes ingredient/allergen/dietary inference deterministic (PE-02), improves multilingual matching (PE-05), and lays metadata foundations (CP-03/07) for calibration analysis.

---

## Second Wave (S/M Effort) — Reliability & Correctness Foundations

These items build the infrastructure for correct allergen/dietary data, robust enrichment, and accurate ingredient matching. Each is independently shippable.

### Wave 2A — Allergen & dietary consistency (ship together)

| # | Item | Effort | Depends on |
|---|------|--------|-----------|
| **DA-01** | Unified allergen vocabulary in `@eatme/shared` | S | None |
| **DA-02** | Unified dietary tag vocabulary in `@eatme/shared` | S | None |
| **DA-03** | Contradiction detection in `computeMenuWarnings` | XS | DA-01 |
| **DA-08** | Validate enrich-dish allergens against canonical set | XS | DA-01 |
| **DA-09** | Consumer-safe allergen group filtering (stopgap) | S | None |
| **DA-06** | Persist enrich-dish allergens to `dishes.allergens` | S | DA-01 |

**Combined effect:** Eliminates allergen vocabulary fragmentation (3 sources → 1), catches vegan+milk contradictions before data is committed, ensures enrich-dish allergens reach the queryable column, and makes consumer allergen filtering work with existing data. This is the **food safety priority** bundle.

### Wave 2B — Enrichment pipeline reliability

| # | Item | Effort | Depends on |
|---|------|--------|-----------|
| **DR-01** | Retry with exponential backoff (OpenAI SDK `maxRetries`) | S | None |
| **DR-06** | Explicit timeouts on all external calls | S | None |
| **DR-07** | Fix false 'completed' on AI failure → set 'failed' | S | None |
| **DR-08** | Atomic claim via `UPDATE...RETURNING` for concurrency | S | None |
| **EA-03** | Separate enrichment_status from embedding_status | S | None |
| **CP-01** | Separate extraction_confidence from enrichment_confidence | S | None |
| **EA-06** | Structured logging + `ai_usage_log` table | S | None |
| **PE-06** | Migrate enrich-dish from raw fetch to OpenAI SDK | S | None |

**Combined effect:** Makes the enrichment pipeline resilient to transient failures (retry + timeout), honest about its state (status split, confidence split), observable (structured logs + cost tracking), and standards-aligned (SDK instead of raw fetch). DR-07 alone fixes the most dangerous silent bug in the enrichment path.

### Wave 2C — Ingredient matching accuracy

| # | Item | Effort | Depends on |
|---|------|--------|-----------|
| **IM-05** | Consolidate 3 matching implementations into shared module | S | None |
| **IM-02** | Activate tsvector full-text search (trigger + GIN index) | S | Migration |
| **IM-03** | pg_trgm trigram similarity for typo tolerance | S | IM-02 |
| **IM-07** | Match confidence ranking for partial matches | S | IM-01, IM-05 |
| **IM-09** | Persist unmatched ingredient raw strings (staging table) | S | Migration |

**Combined effect:** Unifies divergent matching behaviour, adds stemming/pluralization handling (tsvector), catches typos (trigram), ranks ambiguous matches, and preserves unmatched data for later resolution. Estimated 30-50% reduction in unmatched ingredient rate.

### Wave 2D — Dish richness

| # | Item | Effort | Depends on |
|---|------|--------|-----------|
| **Rich-09** | Protein families heuristic (string match in enrich-dish) | XS | None |
| **Rich-07** | Dish-level cuisine origin in embedding | XS | None |
| **Rich-04** | Link inferred_dish_category to dish_categories | XS | BL-12 recommended |
| **Rich-02** | AI calorie estimation in enrich-dish | S | None |
| **Rich-05** | Cooking method inference in enrich-dish | S | None |
| **BL-12** | Seed controlled dish_categories vocabulary | S | None |
| **BL-06** | Cross-session deduplication before confirm | M | None |

**Combined effect:** Unlocks protein filtering (currently a no-op), enables calorie filtering for all dishes, improves embedding quality with cooking method and cuisine signal, and prevents duplicate dish rows on re-scans.

---

## Strategic Bets (L Effort, Decisions Needed)

These require schema migrations, new architecture, or product decisions. Each has a specific decision point for leadership.

### SB-1: Transaction-based confirm route (DR-04)

**Detail file:** [02-data-reliability.md](02-data-reliability.md) — DR-04

**Current state:** `confirm/route.ts:97-281` performs independent inserts (menu → categories → dishes → ingredients → options) without a transaction. Partial failures create orphaned records marked as "completed."

**Proposed:** Wrap all confirm inserts in a PostgreSQL function called via Supabase RPC.

**Decision needed:** Is orphaned-record cleanup acceptable as a workaround, or must we guarantee atomicity? Transaction approach requires a migration with a complex PG function (~100 lines). Alternative: compensating deletes on failure (simpler, less robust).

**Decision (2026-04-12): Compensating deletes + weekly orphan-cleanup job.** Confirm is synchronous on the mobile save path (9 insert steps, 60s maxDuration, app blocks on response). A ~100-line PG function is too heavy a migration for a route still evolving (2 recent batching fixes). Track inserted IDs in-memory and reverse on failure; a cleanup job covers the rare crash-between-insert-and-compensate window. Revisit the PG-function option only if incidents recur.

**Impact:** H | **Effort:** M | **Dependencies:** Migration

### SB-2: Enrichment queue architecture (EA-01)

**Detail file:** [06-enrichment-architecture.md](06-enrichment-architecture.md) — EA-01

**Current state:** Webhook fires per-dish INSERT. Confirming a 50-dish menu creates 50 concurrent edge function invocations, each making 2 OpenAI API calls. This risks rate limits, connection pool exhaustion, and cold start storms.

**Proposed:** Replace per-dish webhooks with a queue table. Confirm route enqueues dish IDs; a single edge function processes batches sequentially.

**Decision needed:** Supabase Edge Functions have no native queue. Options: (a) `pending_enrichment` table polled by a cron-triggered function, (b) Supabase Realtime for push-based processing, (c) external queue (Bull, Inngest). Which infrastructure constraint applies?

**Decision (2026-04-12): Option (a) — `pending_enrichment` table + pg_cron.** No external queue deps exist today; adding a vendor introduces secrets and billing for a problem Supabase can solve natively. Realtime isn't a queue (no ack/retry/visibility-timeout). `enrichment_status: 'pending'` is already a first-class state written at confirm (`route.ts:329`) and consumers already tolerate async enrichment, so minute-level cron latency is acceptable.

**Impact:** H | **Effort:** M | **Dependencies:** None, but EA-02/EA-04/EA-05 become simpler with a queue

### SB-3: Ingredient→allergen derivation pipeline (DA-04)

**Detail file:** [04-dietary-allergen-crossval.md](04-dietary-allergen-crossval.md) — DA-04

**Current state:** `canonical_ingredient_allergens` table exists (`database_schema.sql:29-35`) but is empty — no seed data, no trigger, no query. Allergens are AI-guessed without ingredient-based verification. Code comments claim a DB trigger computes allergens from ingredients — no such trigger exists.

**Proposed:** Seed ~50 ingredient→allergen mappings, create a DB trigger on `dish_ingredients` that recomputes `dishes.allergens` as the union of linked ingredient allergens.

**Decision needed:** Should AI-suggested allergens be treated as authoritative, or should ingredient-derived allergens take precedence? If derived, what happens when ingredients are incomplete (low match rate)?

**Decision (2026-04-12): Union of both sources, tagged with provenance.** Ingredient match coverage has known silent gaps (IM-01 direction bug, unmatched rows not yet persisted per IM-09), so treating derived-only as authoritative would downgrade food safety. Write `dishes.allergens = union(ai_suggested, ingredient_derived)`; record source in `field_sources` (CP-02). Consumer filtering stays conservative. Graduate to derived-only once measured coverage justifies it.

**Impact:** H | **Effort:** M | **Dependencies:** DA-01 (vocabulary), IM-04 (ingredient linking)

### SB-4: Link enrich-dish inferred ingredients to canonical IDs (IM-04)

**Detail file:** [03-ingredient-matching.md](03-ingredient-matching.md) — IM-04

**Current state:** `enrichWithAI` returns up to 8 `inferred_ingredients` as plain strings stored in `enrichment_payload` JSONB (`enrich-dish/index.ts:488`). They're used for embedding input but never resolved to `canonical_ingredient_id`s or written to `dish_ingredients`. Dishes enriched only by the background pipeline have zero structured ingredient links.

**Proposed:** After AI enrichment, resolve inferred ingredient names through the matching pipeline (tsvector/trigram) and insert high-confidence matches as `dish_ingredients` rows with `source: 'ai_enrichment'`.

**Decision needed:** Should AI-matched ingredients be auto-committed or staged for admin review? Auto-commit increases data coverage but risks wrong matches.

**Decision (2026-04-12): Hybrid — auto-commit high-confidence, stage the rest.** Pure auto-commit compounds errors into the allergen trigger (SB-3); pure staging is inert without a review UI (SB-6). Gate auto-commit on IM-07 ranking with threshold = tsvector-exact OR trigram ≥0.9; route lower-confidence matches to the IM-09 staging table. Prerequisites: IM-05 → IM-02 → IM-07 must land first.

**Impact:** H | **Effort:** M | **Dependencies:** IM-02/IM-03 for quality; can start with simple ilike

### SB-5: Field-level provenance tracking (CP-02)

**Detail file:** [07-confidence-provenance.md](07-confidence-provenance.md) — CP-02

**Current state:** No record of which system populated each dish field. `enrichment_source` is a single enum that gets overwritten.

**Proposed:** Add `field_sources JSONB` to dishes, tracking `{source, model, timestamp}` per field.

**Decision needed:** Is field-level provenance worth the write overhead? Main value is for admin review prioritization and accuracy measurement. Without it, CP-05 (feedback loop) has limited utility.

**Impact:** H | **Effort:** M | **Dependencies:** Value increases with admin review UI

### SB-6: Admin feedback loop for confidence calibration (CP-05)

**Detail file:** [07-confidence-provenance.md](07-confidence-provenance.md) — CP-05

**Current state:** `enrichment_review_status` column exists (migration 074, set to `'pending_review'` by enrich-dish at `index.ts:491-493`) but no admin UI reads it. No tracking of whether AI predictions are correct.

**Proposed:** Build admin review UI, track accept/reject rates by confidence bucket and model version, compute field-level accuracy.

**Decision needed:** Is building a review UI a priority given current team size? Alternative: batch-export pending-review dishes to a spreadsheet for manual QA, measure accuracy offline.

**Decision (2026-04-12): Batch-export QA first, defer the UI.** Signals point to a small team and no reader yet exists for `enrichment_review_status` (written since migration 074, Apr 6). Export `pending_review` dishes to CSV → spreadsheet QA → correction import. Use the resulting accuracy numbers to calibrate CP-03 thresholds and validate SB-4's auto-commit cutoff. Build the UI only if the queue proves large and persistent enough to justify it.

**Impact:** H | **Effort:** L | **Dependencies:** CP-02, CP-03

### SB-7: Embedding-based ingredient matching (IM-08)

**Detail file:** [03-ingredient-matching.md](03-ingredient-matching.md) — IM-08

**Current state:** No semantic matching for ingredients. pgvector is installed but only used for dish similarity. Conceptual equivalents ("prawns"→"shrimp", "aubergine"→"eggplant") are unmatched.

**Proposed:** Add embeddings to `canonical_ingredients`, match unresolved ingredients by cosine distance.

**Decision needed:** Is the long-tail accuracy improvement worth the per-ingredient embedding cost? tsvector + trigram should be exhausted first.

**Impact:** M | **Effort:** L | **Dependencies:** IM-02, IM-03 first

---

## Sequencing Recommendation

### Dependency Graph

```
Quick Wins (Batch 1-4)
  │
  ├──► DA-01 (allergen vocab) ──► DA-03 (contradiction detection)
  │         │                  ──► DA-08 (enrich-dish validation)
  │         │                  ──► DA-06 (persist enrich-dish allergens)
  │         └──► DA-04 (ingredient→allergen trigger) ──► DA-05 (dietary derivation)
  │                    ▲
  │                    │
  ├──► IM-05 (consolidate matching) ──► IM-02 (tsvector) ──► IM-03 (trigram)
  │         │                                    │
  │         └──► IM-07 (confidence ranking)      └──► IM-04 (link enrich-dish ingredients)
  │                                                         │
  │                                                         ├──► Rich-01 (protein trigger)
  │                                                         └──► DA-04 (allergen trigger)
  │
  ├──► DR-07 (fix false completed) ──► EA-03 (status split)
  │         │                                   │
  │         └──► DR-01 (retry logic)            └──► EA-04 (re-enrichment trigger)
  │
  ├──► PE-06 (SDK migration) ──► PE-01-style Structured Outputs for enrich-dish
  │
  ├──► CP-01 (confidence split) ──► CP-04 (heuristic fix)
  │
  ├──► CP-03 (prompt versioning) ──► EA-08 (idempotency)
  │         │
  │         └──► CP-05 (feedback loop)
  │                    ▲
  │                    └── CP-02 (field provenance)
  │
  └──► EA-01 (queue) ──► EA-02 (batch embeddings)
                     ──► EA-05 (dedup vectors)
```

### Recommended execution order

1. **Quick wins** (Batches 1-4) — immediate, no dependencies
2. **Wave 2A** (allergen/dietary) — food safety priority, starts with DA-01
3. **Wave 2B** (enrichment reliability) — DR-07 + DR-01 are the critical pair
4. **Wave 2C** (ingredient matching) — start with IM-05 consolidation, then IM-02
5. **Wave 2D** (dish richness) — Rich-09 + Rich-07 are quick, BL-06 (dedup) is the big win
6. **Strategic bets** — sequence: EA-01 → IM-04 → DA-04 → CP-02 → CP-05

---

## Not Recommended

| Idea | Why not |
|------|---------|
| **OCR pre-pass (Tesseract/Google Vision) before GPT-4o** | GPT-4o Vision handles OCR + structure in one pass. Adding a pre-pass doubles latency and complexity for marginal accuracy gain. The image quality gate (BL-13) catches the worst cases without adding a dependency. |
| **Replace OpenAI with another provider** | Out of scope per project decision. The current GPT-4o Vision quality is good; the issues are in how we use the output, not in the model. |
| **Embedding cache by input hash (EA-07)** | Expected cache hit rate is very low — most dishes are unique across restaurants. The storage and lookup overhead likely exceeds the embedding API savings. Defer until empirical data (from EA-06 cost tracking) shows embedding costs are a concern. |
| **Multi-model consensus on low-confidence items** | Calling a second model for verification doubles cost. The prompt engineering improvements (PE-01 through PE-08) and Structured Outputs address the root causes of low-confidence output. Consensus is a compensation strategy, not a fix. |
| **Per-option price_delta inference (BL-15 Phase 2)** | Size variants are already modelled as parent-child dishes with prices. Converting to option groups with price_delta requires restructuring the entire variant model. The current approach works; the improvement is cosmetic. Phase 1 (min/max inference) is worth doing. |
| **Preparation time estimation** | No downstream consumer exists or is planned. The feed ranker doesn't use it, no mobile filter exists. Adding AI inference without a consumer wastes tokens. |
| **Serving temperature inference** | Same reasoning — no downstream consumer. Would pollute the enrichment payload with unused data. |

---

## Cross-Reference Index

Every opportunity links back to its detail file:

| Detail file | Opportunities |
|-------------|--------------|
| [01-prompt-engineering.md](01-prompt-engineering.md) | PE-01, PE-02, PE-03 (→DA-01), PE-04, PE-05, PE-06, PE-07, PE-08 |
| [02-data-reliability.md](02-data-reliability.md) | DR-01, DR-02, DR-03, DR-04, DR-05, DR-06, DR-07, DR-08, DR-09, DR-10, DR-11 |
| [03-ingredient-matching.md](03-ingredient-matching.md) | IM-01, IM-02, IM-03, IM-04, IM-05, IM-06, IM-07, IM-08, IM-09 |
| [04-dietary-allergen-crossval.md](04-dietary-allergen-crossval.md) | DA-01, DA-02, DA-03, DA-04, DA-05, DA-06, DA-07, DA-08, DA-09 |
| [05-dish-richness.md](05-dish-richness.md) | Rich-01, Rich-02, Rich-03, Rich-04, Rich-05, Rich-06, Rich-07, Rich-08, Rich-09 |
| [06-enrichment-architecture.md](06-enrichment-architecture.md) | EA-01, EA-02, EA-03, EA-04, EA-05, EA-06, EA-07, EA-08, EA-09, EA-10 |
| [07-confidence-provenance.md](07-confidence-provenance.md) | CP-01, CP-02, CP-03, CP-04, CP-05, CP-06 (→EA-10), CP-07, CP-08 |
| [08-open-baseline-items.md](08-open-baseline-items.md) | BL-05 (→EA-10), BL-06, BL-08 (→IM-09), BL-11 (→IM-02), BL-12, BL-13, BL-15 |
| [Prior baseline](../old-menu-scan-improvements.md) | Items #1,#3,#4,#7,#9,#10,#14 implemented; #2 partially addressed; #5,#6,#8,#11,#12,#13,#15 extended above |

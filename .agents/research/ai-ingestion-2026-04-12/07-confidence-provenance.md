# Confidence Calibration & AI Provenance Tracking

## Current state

### Confidence scoring — two independent systems

**1. Extraction confidence (GPT-4o Vision → confirm):**
- The SYSTEM_PROMPT instructs GPT-4o to self-report confidence per dish on a 0–1 scale (`route.ts:97`): `confidence: 1.0 = perfectly legible, 0.7 = slightly unclear, 0.5 = partially obscured, 0.3 = mostly guessing`
- DishSchema includes `confidence: z.number()` (`route.ts:41`)
- At confirm, `buildDishRow()` maps the numeric confidence to a 3-bucket enum (`confirm/route.ts:307-309`):
  ```
  ≥ 0.7 → 'high', ≥ 0.5 → 'medium', < 0.5 → 'low'
  ```
- Stored as `enrichment_confidence` on the `dishes` row (`confirm/route.ts:331`)

**2. Enrichment confidence (enrich-dish edge function):**
- `evaluateConfidence(completeness, aiEnriched)` (`enrich-dish/index.ts:195-199`) uses a completeness-based heuristic:
  - `complete` → 'high' (regardless of AI enrichment)
  - `partial` + AI-enriched → 'medium'; without AI → 'low'
  - `sparse` → always 'low'
- Completeness is determined by `evaluateCompleteness()` (`enrich-dish/index.ts:171-193`), which checks ingredient count (≥3 = complete), description length (≥100 chars + ≥1 ingredient = complete), and dish_kind-specific rules (template/combo with enough options = complete)
- This **overwrites** the extraction confidence stored at confirm (`enrich-dish/index.ts:487`), meaning the original GPT-4o OCR confidence is permanently lost

**3. Enrichment review status (staged approval):**
- Migration 074 added `enrichment_review_status` column: `NULL | 'pending_review' | 'accepted' | 'rejected'`
- Set to `'pending_review'` when AI enrichment produces a payload (`enrich-dish/index.ts:491-493`)
- **No admin UI exists** to review/accept/reject — the audit page shows "Coming Soon" (`app/admin/audit/page.tsx`)
- Index exists for admin queries (`dishes_enrichment_review_status_idx`, migration 074:15-17)

### Provenance tracking — minimal

- `menu_scan_jobs` table stores job metadata: `restaurant_id`, `created_by`, `image_storage_paths`, `result_json`, `dishes_found`/`dishes_saved` (`database_schema.sql:253-271`)
- **No FK from dishes → menu_scan_jobs** — once confirmed, dishes have no link back to the scan that created them
- `enrichment_source` is set to `'ai'` at confirm (`confirm/route.ts:330`) and then overwritten by enrich-dish to either `'ai'` (if AI enrichment ran) or `'manual'` (if dish was already complete) (`enrich-dish/index.ts:486`)
- `enrichment_payload` JSONB stores model name and token counts (`enrich-dish/index.ts:157-162`), but only for the enrichment step — the extraction model/tokens from the scan step are not persisted per-dish
- `admin_audit_log` table exists (`database_schema.sql:4-18`) but is only used for bulk restaurant imports (`import-service.ts:300-313`), not for menu scan or dish editing

### Model versioning — hardcoded, not tracked

- Extraction: `gpt-4o` hardcoded in `route.ts:171`
- Translation: `gpt-4o-mini` hardcoded in `route.ts:358`
- Enrichment: `const ENRICHMENT_MODEL = 'gpt-4o-mini'` (`enrich-dish/index.ts:27`), stored in `enrichment_payload.model`
- Embedding: `text-embedding-3-small` hardcoded in `enrich-dish/index.ts:84`
- No prompt version identifiers anywhere — prompt changes are invisible in the data

## Reliability / accuracy gaps

### GAP-1: Extraction confidence is overwritten by enrichment confidence
The confirm route stores the GPT-4o extraction confidence (OCR legibility) as `enrichment_confidence`. Then enrich-dish unconditionally overwrites it with a completeness-based heuristic. The original extraction confidence is permanently lost. A dish with `0.3` extraction confidence (mostly guessing) that happens to have ≥3 ingredients gets overwritten to `'high'`.

### GAP-2: Enrichment confidence is a poor proxy
`evaluateConfidence()` (`enrich-dish/index.ts:195-199`) has a dead branch: `sparse + aiEnriched → 'low'` and `sparse + !aiEnriched → 'low'` produce the same result. More fundamentally, confidence based on ingredient count doesn't measure accuracy — a dish with 5 wrong ingredients scores 'high'.

### GAP-3: No feedback loop for calibration
No mechanism tracks whether admin edits correlate with confidence scores. If 'high' confidence dishes are frequently corrected, there's no way to detect this. The `enrichment_review_status` column is set but never read by any application code.

### GAP-4: No per-field provenance
All dish fields are written in a single update. There's no record of which fields came from the original menu image, which from AI enrichment, which from admin edits, and which from the suggest-ingredients endpoint. When a dish has `allergens: ["wheat", "dairy"]`, there's no way to know if these came from the menu scan, enrich-dish inference, or admin input.

### GAP-5: Prompt version drift is invisible
When prompts are changed (e.g., adding few-shot examples, changing allergen vocabulary), dishes enriched before vs after the change are indistinguishable. There's no way to identify which dishes need re-enrichment after a prompt improvement.

### GAP-6: Scan-to-dish lineage is broken
After confirm, there's no FK from dishes to `menu_scan_jobs`. You can't answer: "which scan created this dish?", "how many dishes from scan X were later edited?", "what's the accuracy rate of scan model version Y?"

## Improvement opportunities

### CP-01: Separate extraction_confidence from enrichment_confidence

**Current behaviour**: `enrichment_confidence` stores OCR confidence at confirm (`confirm/route.ts:307-309`), then gets overwritten by completeness-based confidence at enrichment (`enrich-dish/index.ts:478,487`). Original extraction quality signal is permanently lost.
**Proposed change**: Add `extraction_confidence NUMERIC(3,2)` column to `dishes`. Store the raw GPT-4o `confidence` value (0–1) at confirm in this new column. Keep `enrichment_confidence` for the enrich-dish heuristic. This preserves both signals and enables analysis of OCR quality vs enrichment quality independently.
**Impact**: H — unlocks confidence calibration, quality dashboards, and selective re-extraction targeting
**Effort**: S — schema migration + 1-line change in `buildDishRow()`
**Dependencies**: None

### CP-02: Add field_sources JSONB for per-field provenance

**Current behaviour**: No record of which system populated each dish field. `enrichment_source` is a single enum that gets overwritten, tracking only the last source (`confirm/route.ts:330`, `enrich-dish/index.ts:486`).
**Proposed change**: Add `field_sources JSONB` column to `dishes`. Each key is a field name, value is `{ source: 'menu_scan' | 'enrichment' | 'suggest_ingredients' | 'admin', model: string, timestamp: ISO8601 }`. Set at confirm for all AI-extracted fields. Update in enrich-dish for AI-inferred fields. Update in admin edit endpoints when built.
Example:
```json
{
  "name": {"source": "menu_scan", "model": "gpt-4o", "timestamp": "2026-04-12T10:00:00Z"},
  "allergens": {"source": "enrichment", "model": "gpt-4o-mini", "timestamp": "2026-04-12T10:05:00Z"},
  "dietary_tags": {"source": "admin", "timestamp": "2026-04-12T11:00:00Z"}
}
```
**Impact**: H — enables trust-level per field, admin review prioritization, and accuracy tracking
**Effort**: M — schema migration + updates to confirm route, enrich-dish, and future admin edit endpoints
**Dependencies**: None, but value increases with admin edit UI

### CP-03: Implement prompt versioning with hash-based IDs

**Current behaviour**: Models are hardcoded strings (`route.ts:171`, `enrich-dish/index.ts:27`). `enrichment_payload.model` stores the model name but not the prompt version. Prompt changes are invisible in the data.
**Proposed change**: Generate a deterministic hash of each prompt template (first 8 chars of SHA-256). Store as `prompt_version` alongside `model` in the relevant output. For enrich-dish: add `prompt_version` to `EnrichmentPayload`. For extraction: store in `menu_scan_jobs.result_json`. For suggest-ingredients: store in response metadata.
Implementation: `const PROMPT_VERSION = crypto.createHash('sha256').update(SYSTEM_PROMPT).digest('hex').slice(0, 8);`
**Impact**: M — enables re-enrichment targeting after prompt improvements, A/B accuracy analysis
**Effort**: XS — ~5 lines per call site (4 call sites)
**Dependencies**: None

### CP-04: Fix evaluateConfidence dead branch and improve heuristic

**Current behaviour**: `evaluateConfidence()` (`enrich-dish/index.ts:195-199`) has a dead branch where `sparse` always returns `'low'` regardless of `aiEnriched`. More fundamentally, it measures data completeness, not accuracy.
**Proposed change**:
1. Fix the dead branch: `sparse + aiEnriched → 'medium'` (AI tried to fill gaps)
2. Factor in AI model confidence when available: if the LLM response includes `logprobs` (available via OpenAI API), use average token log-probability as an additional signal
3. For extraction confidence: weight by number of extraction_notes (self-reported issues) — dishes with `likely_ocr_error` or `unreadable_section` notes should be downgraded
**Impact**: M — more accurate confidence signals enable better admin review prioritization
**Effort**: S — ~20 lines in evaluateConfidence + adding `logprobs: true` to enrichWithAI call
**Dependencies**: CP-01 (separate extraction vs enrichment confidence)

### CP-05: Build admin feedback loop for confidence calibration

**Current behaviour**: `enrichment_review_status` column exists (migration 074) and is set to `'pending_review'` by enrich-dish (`index.ts:491-493`), but no code reads it. No admin UI to accept/reject. No tracking of admin edits to measure AI accuracy.
**Proposed change**:
1. Build admin review UI: list dishes with `enrichment_review_status = 'pending_review'`, show `enrichment_payload` suggestions, allow accept/reject per field
2. On accept: apply `enrichment_payload` values to main dish fields, set `enrichment_review_status = 'accepted'`, log to `admin_audit_log`
3. On reject: set `enrichment_review_status = 'rejected'`, log rejection reason
4. Weekly aggregate: compute acceptance rate by `enrichment_confidence` bucket and model version. If 'high' confidence dishes have < 90% acceptance, alert
5. Track field-level accuracy: which AI-populated fields get edited most often? Use this to prioritize prompt improvements
**Impact**: H — closes the feedback loop, enables data-driven prompt improvement
**Effort**: L — admin UI + audit logging + aggregation queries + alerting
**Dependencies**: CP-02 (field_sources), CP-03 (prompt versioning)

### CP-06: Add menu_scan_job_id FK to dishes (extends baseline #5 + EA-10)

**Current behaviour**: Confirm route updates `menu_scan_jobs.dishes_saved` count (`confirm/route.ts:248`) but dishes have no FK back to the job. Lineage from scan → dish is broken.
**Proposed change**: Add `menu_scan_job_id UUID REFERENCES menu_scan_jobs(id)` to `dishes`. Set in `buildDishRow()` from the confirm request payload (which already has `jobId`). Index on `(menu_scan_job_id)` for scan-level queries.
This was identified in baseline item #5 and EA-10. This entry extends with downstream uses: re-scan diffing (compare dishes from scan A vs scan B for same restaurant), accuracy analytics (what % of dishes from job X were edited?), failed scan cleanup (delete dishes from a scan that was later re-done).
**Impact**: M — enables provenance tracing, re-scan diffing, per-scan accuracy analytics
**Effort**: S — schema migration + 1-line change in buildDishRow + pass jobId through confirm
**Dependencies**: None

### CP-07: Store extraction model and token counts per dish

**Current behaviour**: Extraction uses `gpt-4o` (`route.ts:171`) and translation uses `gpt-4o-mini` (`route.ts:358`). Token counts are logged to console but not stored per dish. `menu_scan_jobs.result_json` contains the full extraction result but not per-dish token attribution. Enrichment tokens are stored in `enrichment_payload` (`enrich-dish/index.ts:157-162`) but extraction tokens are not.
**Proposed change**: Add to `menu_scan_jobs`: `extraction_model TEXT`, `extraction_tokens_prompt INT`, `extraction_tokens_completion INT`, `translation_tokens_prompt INT`, `translation_tokens_completion INT`. Set from the OpenAI response `usage` objects that are currently only logged. This enables cost tracking across the full pipeline (extraction + enrichment).
**Impact**: M — enables end-to-end cost tracking per scan, identifies expensive extractions
**Effort**: XS — store values already available in API responses
**Dependencies**: EA-06 (structured logging with cost tracking) for aggregation

### CP-08: Add admin edit tracking to admin_audit_log

**Current behaviour**: `admin_audit_log` table exists (`database_schema.sql:4-18`) with `old_data`/`new_data` JSONB columns, but is only used for bulk restaurant imports (`import-service.ts:300-313`). Menu scan confirmations and dish edits are not logged. Admin page shows "Coming Soon".
**Proposed change**: Wire audit logging into:
1. Menu scan confirm endpoint: log `action: 'menu_scan_confirm'`, `resource_type: 'menu_scan_job'`, `new_data: { dishes_saved, restaurant_id }`
2. Future dish edit endpoints: log `action: 'dish_edit'`, `resource_type: 'dish'`, `old_data` / `new_data` diffs
3. Future enrichment review: log `action: 'enrichment_review'`, `resource_type: 'dish'`, `new_data: { status: 'accepted'|'rejected', fields_changed }`
**Impact**: M — audit trail for compliance, enables CP-05 calibration
**Effort**: S — ~10 lines per endpoint, infrastructure already exists
**Dependencies**: CP-05 (feedback loop) benefits from this

## Cross-refs

### Prior baseline items extended
- **#5 (provenance FK)**: Still open. CP-06 extends baseline #5 and EA-10 with downstream use cases (re-scan diffing, accuracy analytics, failed scan cleanup).

### Topics this depends on or enables
- **01-prompt-engineering**: CP-03 (prompt versioning) enables tracking which prompt version produced better results, informing prompt improvement decisions from TOPIC-01.
- **02-data-reliability**: DR-07 (false 'completed' status) is related to CP-04 (confidence heuristic fix) — both address misleading status/confidence signals.
- **04-dietary-allergen-crossval**: DA-06 (recompute allergens after ingredient changes) would benefit from CP-02 (field_sources) to track that allergens were "derived" not "AI-inferred".
- **05-dish-richness**: New AI-populated fields (DR-01 through DR-09) increase the value of CP-02 (per-field provenance) and CP-03 (prompt versioning).
- **06-enrichment-architecture**: EA-10 (menu_scan_job_id FK) is the same as CP-06. EA-06 (cost tracking) is complementary to CP-07 (extraction token storage). EA-03 (status split) is related to CP-01 (confidence split).

# Menu Scan Data Ingestion — Improvement Opportunities

## Pipeline Summary

```
[Browser — Upload Phase]
  useUploadState.ts
    ├── handleFilesSelected(): images filtered; PDFs converted via pdfToImages()
    │     pdfToImages() [menu-scan-utils.ts:66] — pdfjs-dist, 2× scale, JPEG 0.85, max 20 pages
    └── resizeImageToBase64() [menu-scan-utils.ts:17] — max 1500px, JPEG 0.82

  useProcessingState.fireProcess() [hooks/useProcessingState.ts:30]
    └── POST /api/menu-scan (non-blocking fetch; caller tracks via jobQueue)

[Server — POST /api/menu-scan]  [app/api/menu-scan/route.ts]
  1. Verify admin JWT
  2. INSERT menu_scan_jobs (status: 'processing')
  3. In parallel:
       a. Upload raw base64 → Supabase Storage bucket 'menu-scans'
       b. GPT-4o Vision per image (Structured Outputs, zodResponseFormat)
          model: gpt-4o, detail: 'high', max_tokens: 16384, temperature: 0.1
  4. mergeExtractionResults() [lib/menu-scan.ts:531]
       3-layer category matching: normalise → synonym map → string-similarity(>0.85)
       Same name + different price → FlaggedDuplicate
       Same name + same price → silently dropped
  5. enrichResult() [route.ts:443]
       For each dish: matchIngredients() + mapDietaryHints()
       matchIngredients() [route.ts:349]:
         Pass 1: exact ilike → partial ilike, SEQUENTIAL per ingredient (N×2 queries)
         Pass 2 (unmatched): batch GPT-4o-mini translation, re-query DB
         Pass 3: saveNewAlias() for newly resolved terms
  6. getCurrencyForRestaurant() → country_code→ISO 4217 map
  7. UPDATE menu_scan_jobs (status: 'needs_review', result_json: EnrichedResult)
  8. Return enriched result to client

[Browser — Review Phase]
  useJobQueue.ts  — background job tracking, session recovery from DB
  useReviewState.ts — editable menu state, warnings, save
  useGroupState.ts  — flagged duplicate review, batch accept/reject
  useIngredientState.ts — per-dish AI suggest (suggestIngredients / suggestAllDishes)
    POST /api/menu-scan/suggest-ingredients — GPT-4o-mini; batch DB lookup (2 queries total)

[Server — POST /api/menu-scan/confirm]  [app/api/menu-scan/confirm/route.ts]
  3-pass insert: parents → children (with parent_dish_id) → standalone
  Tables written: menus, menu_categories, dishes, dish_ingredients, option_groups, options
  UPDATE menu_scan_jobs (status: 'completed', dishes_saved)
```

Key files:
- `apps/web-portal/app/api/menu-scan/route.ts` — main extraction endpoint
- `apps/web-portal/app/api/menu-scan/confirm/route.ts` — DB persistence
- `apps/web-portal/app/api/menu-scan/suggest-ingredients/route.ts` — per-dish AI enrichment
- `apps/web-portal/lib/menu-scan.ts` — types, merge, dietary mapping, editable state helpers
- `apps/web-portal/lib/menu-scan-warnings.ts` — client-side validation rules
- `apps/web-portal/lib/menu-scan-utils.ts` — image resize + PDF→JPEG (client-side)
- `apps/web-portal/app/admin/menu-scan/hooks/` — all UI hooks

---

## Findings by Area

### 1. Current Pipeline — Key Observations

**GPT-4o configuration** (`route.ts:170`):
- One API call per uploaded image/page; all pages fired in parallel (`Promise.all`, line 554).
- `detail: 'high'` — OpenAI tiles the image; effective for dense menus but expensive.
- `max_tokens: 16384` — dense pages can still be truncated. Truncation detected at `route.ts:195` (`finish_reason === 'length'`) but only logged to console; the user never sees it and partial output is returned silently.
- Temperature 0.1 is appropriate for extraction; confidence self-report from the model is uncalibrated.
- Uses OpenAI Structured Outputs (`zodResponseFormat`) for guaranteed schema conformance.

**Merge logic** (`menu-scan.ts:531`):
- Category matching across pages is 3-layer: normalise → synonym map (~50 entries, `menu-scan.ts:363`) → `compareTwoStrings` > 0.85 threshold (`menu-scan.ts:511–518`).
- Duplicate detection is exact lowercase name match within the merge only. No cross-session DB check.

**Confirm route** (`confirm/route.ts:97`):
- No DB transaction; if a `menu_categories` insert fails, the menu row is orphaned and later inserts are skipped. Returns `completed_with_warnings` status for partial failures.
- Standalone dish IDs are generated with `randomUUID()` inside `buildDishRow`, then assigned back to `standaloneRows[i].id` at line 214. The `id: ''` placeholder is benign but fragile.

---

### 2. Ingredient Matching Quality

**Matching pipeline at scan time** (`route.ts:349–407`):

| Pass | Method | Queries |
|------|--------|---------|
| 1 | Exact `ilike` per ingredient | 1 per ingredient |
| 1b | Partial `%ilike%` per ingredient | 1 per unmatched |
| 2 | Batch GPT-4o-mini translation (Spanish→English) | 1 LLM call |
| 2b | Exact/partial `ilike` on English translation | 1–2 per translated |

Total DB queries for a dish with 8 ingredients: up to 16 serial round-trips. For a 50-dish menu: up to ~500 DB queries before the LLM translation step.

**Contrast with `suggest-ingredients`** (`suggest-ingredients/route.ts:173`):
- Uses a bulk OR query: `display_name.ilike.name1, display_name.ilike.name2, ...` — 2 queries total for all names. This pattern already exists in the codebase but is not used in the main scan route.

**Unmatched ingredient fate**:
- `status: 'unmatched'` in `EditableDish.ingredients`.
- Warning of severity `'info'` in the review UI (`menu-scan-warnings.ts:116`).
- **Not saved to DB** — `editableToConfirm()` filters `status === 'matched'` only (`menu-scan.ts:793`).
- No staging table; raw strings are permanently lost after the admin session ends.

**Language hardcoded** (`route.ts:402`):
- When a new alias is saved after translation, the language is always `'es'` regardless of the actual source language. Non-Spanish menus (Polish, French, Italian, etc.) get wrongly tagged aliases.

**No fuzzy/embedding matching**:
- No Levenshtein, Jaro-Winkler, tsvector, or pgvector similarity search.
- The `ingredient_aliases` table has a `search_vector tsvector` column (`database_schema.sql:228`) but it is not used in the matching logic.
- The `dishes.embedding` column exists (pgvector, `database_schema.sql:150`) but not used for ingredient lookup.
- Example: "ciliandro" (common misspelling of cilantro) would not match. Neither would "Pechuga de pollo" unless it exists as an alias.

---

### 3. Duplicate & Variant Detection

**Within a single multi-page upload** (`menu-scan.ts:594–619`):
- Same name + different prices → `FlaggedDuplicate` (potential size variant).
- Same name + same price → silently dropped (true duplicate).
- Name comparison is exact lowercase trim — no fuzzy matching ("Taco al Pastor 🌮" vs "Taco Pastor" would produce two separate dishes).

**Cross-upload / cross-session**:
- No deduplication against existing `dishes` rows for the restaurant.
- Re-scanning an unchanged menu will double all dish rows.

**AI-side variant detection**:
- Prompt instructs GPT-4o to model S/M/L, template, combo, and experience patterns as parent-child structures (`route.ts:100–113`).
- This works within a single image. GPT-4o has no view across pages or across prior scans.
- Post-merge, no semantic similarity step catches variants with different names.

**Admin review flow** (`useGroupState.ts`):
- `groupFlaggedDuplicate()` promotes a flagged duplicate to a parent-child variant.
- `dismissFlaggedDuplicate()` discards the flag.
- Resolution is fully manual.

---

### 4. Data Quality Gaps

**`EditableDish` fields** (`menu-scan.ts:118–139`):

| Field | AI source | Validated | Saved to DB |
|-------|-----------|-----------|-------------|
| name | GPT-4o | min 2 chars | ✓ |
| price | GPT-4o | >0 if 'exact'; <500 warning | ✓ |
| description | GPT-4o | — | ✓ |
| dietary_tags | GPT-4o + hint map | controlled codes | ✓ |
| spice_level | GPT-4o | 0/1/3 normalised | ✓ |
| calories | GPT-4o | — | ✓ |
| dish_category_id | suggest-ingredients only | — | ✓ (when set) |
| confidence | GPT-4o | thresholds 0.3/0.5 | ✗ (not in DB) |
| ingredients (matched) | GPT-4o + DB | — | ✓ |
| ingredients (unmatched) | GPT-4o | — | ✗ (dropped) |
| suggested_allergens | suggest-ingredients | allowed set | ✗ (not written) |
| dish_kind / is_parent / variant_ids | GPT-4o | enum | ✓ |
| serves / display_price_prefix | GPT-4o | — | ✓ |

**`dishes` DB fields never written during confirm** (`confirm/route.ts:296–321`):
- `allergens` — AI provides allergen inference via `suggest-ingredients`, stored in `EditableDish.suggested_allergens`, but `editableToConfirm()` drops it. Allergens are computed by a DB trigger from `dish_ingredients` only.
- `enrichment_status` / `enrichment_source` / `enrichment_confidence` / `enrichment_payload` — all stay at DB defaults (`'none'`, `null`). The enrichment pipeline cannot distinguish scanned dishes.
- `embedding` / `embedding_input` — never generated; scanned dishes are invisible to the vector ANN recommendation feed.
- `protein_families` / `protein_canonical_names` — not extracted or inferred.
- `image_url` — no dish photo association at scan time.

**Price validation issues** (`menu-scan-warnings.ts:17, 79–92`):
- `SUSPICIOUS_PRICE_THRESHOLD = 500` is currency-unaware. MXN 500 is ~$25 USD and typical for an entrée; USD 499 would rightly be suspicious. The same threshold produces false positives for MXN and false negatives for USD.
- No lower-bound check — a price of `0.01` or negative is not flagged.

**Currency detection** (`menu-scan.ts:234–264`):
- Derived from `restaurant.country_code` → hard-coded map (~10 countries).
- AI explicitly forbidden from extracting currency (system prompt rule 2, `route.ts:87`).
- Countries not in the map (BR, AR, CO, IN, JP, ...) silently default to USD.

**Category vocabulary**:
- `menu_categories.name` is free-text from the AI; no controlled vocabulary.
- `dish_category_id` is only set if admin runs "Suggest All" or "Suggest" per dish.
- `suggest-ingredients/route.ts:267–289` auto-creates new `dish_categories` rows when the AI proposes a category not in the DB — can cause unbounded category proliferation.

**Confidence calibration**:
- Self-reported by GPT-4o per the system prompt scale (`route.ts:97`): 1.0 = clear, 0.7 = slightly unclear, 0.5 = partially obscured, 0.3 = mostly guessing.
- No ground-truth validation; no feedback loop from admin edits.
- Confidence is not persisted to DB, so retrospective calibration analysis is impossible.

---

### 5. Image Preprocessing

**Client-side resize** (`menu-scan-utils.ts:17–55`):
- Max 1500px on longest side, JPEG quality 0.82.
- All formats converted to JPEG (lossy for PNGs and vector-origin PDFs).
- Sent with `detail: 'high'` (`route.ts:179`).

**PDF conversion** (`menu-scan-utils.ts:66–97`):
- pdfjs-dist at 2× viewport scale — ~1680px for A4 at 72 dpi.
- JPEG quality 0.85.
- Worker path hardcoded: `/pdf.worker.min.mjs` (`menu-scan-utils.ts:69`) — must be manually recopied on pdfjs-dist upgrades.
- Page rendering is sequential (for-loop, line 77); could be parallelised.
- Max 20 pages per PDF + 20-image API limit = a single 20-page PDF exhausts the entire upload quota.

**Passes directly to GPT-4o — no preprocessing**:
- No OCR pre-pass (Tesseract, Google Vision, AWS Textract).
- No contrast enhancement, deskewing, or binarisation.
- No duplicate-page detection (if user uploads the same image twice, GPT-4o is called twice).
- No image quality gate (blur detection) — unreadable images waste tokens and produce low-confidence output.

**Multi-page note in prompt** (`route.ts:119`):
- Prompt tells GPT-4o to use consistent category names across pages.
- No page-number context injected; no way to handle a dish whose description spans two pages.

**1500px resize cap note**:
- OpenAI high-detail mode tiles at up to 2048px. Dense menus with small text can lose clarity at 1500px. Raising to 2000px would improve OCR accuracy on the most text-dense menus with minor token cost increase.

---

### 6. DB Schema — What Gets Saved

**Confirm route writes** (`confirm/route.ts`):

| Table | Written fields | Notable omissions |
|-------|---------------|-------------------|
| `menus` | restaurant_id, name, menu_type, display_order, is_active | available_start/end_time, available_days, schedule_type |
| `menu_categories` | restaurant_id, menu_id, name, display_order | description, type fields |
| `dishes` | id, restaurant_id, menu_category_id, dish_category_id, name, description, price, dietary_tags, spice_level, calories, is_available, dish_kind, is_parent, serves, display_price_prefix, parent_dish_id | `allergens`, `enrichment_*`, `image_url`, `embedding`, `protein_*` |
| `dish_ingredients` | dish_id, ingredient_id (matched canonical IDs only) | unmatched raw strings lost |
| `option_groups` | restaurant_id, dish_id, name, selection_type, min_selections=1 (hardcoded), max_selections=1 (hardcoded), display_order, is_active | dynamic min/max not inferred |
| `options` | option_group_id, name, canonical_ingredient_id, price_delta=0 (hardcoded), display_order, is_available | size-variant price differences lost |

**`menu_scan_jobs` table** (`database_schema.sql:253`):
- `result_json` holds the full `EnrichedResult` JSONB; `flaggedDuplicates` and `extractionNotes` included.
- No per-dish confidence histogram, no unmatched ingredient count field.
- No `menu_scan_job_id` FK on the `dishes` table — impossible to trace which scan produced a dish.

**DB fields the AI could populate but doesn't**:
- `dishes.allergens` — AI provides them via `suggest-ingredients`; confirm route drops them.
- `dishes.enrichment_status` — leaving at `'none'` means enrichment workers cannot identify scanned dishes.
- `option_groups.max_selections` — combo/template dishes often have defined selection rules; AI knows them.
- `options.price_delta` — S/M/L variants have distinct prices modelled in the AI output but collapsed to 0 in the option model.

---

### 7. Competitive / Industry Patterns

| Pattern | EatMe status | Gap / Opportunity |
|---------|-------------|-------------------|
| OCR pre-pass before LLM | Not implemented | Dedicated OCR (Google Vision / Textract) is faster and cheaper for text; LLM handles structure only |
| Embedding-based ingredient normalisation | Not implemented (pgvector installed) | Could embed ingredient aliases for typo-resilient matching |
| Multi-model consensus on low-confidence items | Not implemented | Second model call only for confidence < 0.5 |
| Structured output confidence calibration | Self-reported, uncalibrated | Feedback loop from admin edits to calibrate thresholds |
| Idempotent scan with DB deduplication | Not implemented | Re-scanning always inserts duplicate rows |
| Image quality gate before API call | Not implemented | Blur/contrast check client-side prevents wasted API spend |
| Post-confirm embedding generation | Embedding column exists, never written | Trigger embedding job from confirm endpoint |
| Async enrichment pipeline | `enrichment_status` column exists but never set | Confirm route could mark dishes 'pending' |
| Per-currency price range validation | Fixed $500 threshold | Currency code already available in context |
| Provenance FK (scan → dish) | Not implemented | Add `menu_scan_job_id` to `dishes` |
| Raw ingredient staging | Not implemented | Unmatched ingredients silently dropped |

---

## Prioritised Opportunities

| # | Opportunity | Impact | Effort | Dependencies |
|---|-------------|--------|--------|--------------|
| 1 | **Write `allergens` to DB at confirm** — add to `ConfirmDish`, map in `editableToConfirm`, write in `buildDishRow` | High — eliminates a data drop; field already in DB schema | XS | None |
| 2 | **Batch ingredient matching at scan time** — port OR-ilike pattern from `suggest-ingredients/route.ts:173` to `matchIngredients()` | High — 10–50× fewer DB round-trips; biggest latency win | S | None |
| 3 | **Mark `enrichment_status = 'pending'` at confirm** — write `enrichment_status`, `enrichment_source` in `buildDishRow` | High — enables any existing/future enrichment workers to pick up scanned dishes | XS | None |
| 4 | **Surface GPT truncation warning to admin** — include `finish_reason === 'length'` in `extractionNotes` at `route.ts:195` | Medium — admin currently unaware of silent truncation | XS | None |
| 5 | **Add `menu_scan_job_id` FK to `dishes`** — set during confirm | Medium — enables provenance tracing, re-scan diffing, analytics | S | Schema migration |
| 6 | **Deduplication against existing DB dishes before confirm** — query existing dish names, fuzzy-compare, surface in review UI | High — prevents duplicate rows on re-scan | M | `compareTwoStrings` already in deps |
| 7 | **Currency-aware price outlier thresholds** — replace fixed 500 with per-currency map in `menu-scan-warnings.ts` | Medium — fixes false positives on MXN/PLN menus | XS | Currency available in context |
| 8 | **Persist unmatched ingredient raw strings** — new `dish_ingredient_raw` staging table; insert in confirm | Medium — prevents permanent data loss; enables later normalisation | S | Schema migration |
| 9 | **Fix language hardcoding in `saveNewAlias`** — detect or infer language, not always `'es'` | Low-medium — incorrect aliases for non-Spanish menus | XS | None |
| 10 | **Parallelise PDF page rendering** — replace for-loop with `Promise.all` in `pdfToImages` (`menu-scan-utils.ts:77`) | Low — UX improvement for large PDFs | XS | None |
| 11 | **tsvector ingredient search** — use full-text search for fuzzy partial name matching | Medium — reduces unmatched rate for compound/partial names | S | tsvector column may already exist on `ingredient_aliases` |
| 12 | **Controlled `dish_categories` vocabulary** — restrict `suggest-ingredients` to match-or-return-null, no auto-create | Medium — prevents unbounded category proliferation | S | None |
| 13 | **Image quality gate** — client-side blur/contrast check before `resizeImageToBase64` | Medium — prevents wasted GPT-4o spend on unreadable images | S | None |
| 14 | **Raise resize cap from 1500px → 2000px** — change default in `menu-scan-utils.ts:18` | Low-medium — improves OCR accuracy on dense menus | XS | Verify payload size limits |
| 15 | **`option_groups` min/max and `price_delta` inference** — extend AI prompt + confirm payload | Low — more accurate combo/template modelling | M | Prompt + schema changes |

---

## Recommended Next Steps

### 1. Fix the silent `allergens` data drop — XS effort, immediate correctness

**Files:**
- `apps/web-portal/lib/menu-scan.ts` — `ConfirmDish` interface (line 165) and `editableToConfirm()` (line 783)
- `apps/web-portal/app/api/menu-scan/confirm/route.ts` — `buildDishRow()` (line 296)

The `dishes.allergens` DB column exists. The AI already infers allergens through the `suggest-ingredients` endpoint and stores them in `EditableDish.suggested_allergens`. They are then dropped silently in three places:

1. `ConfirmDish` type (`menu-scan.ts:165`) does not have an `allergens` field.
2. `editableToConfirm()` (`menu-scan.ts:783`) does not map `suggested_allergens`.
3. `buildDishRow()` (`confirm/route.ts:303`) does not write `allergens`.

**Fix (3 lines):**
```ts
// menu-scan.ts:165 — add to ConfirmDish
allergens?: string[];

// menu-scan.ts:798 — in editableToConfirm()
allergens: dish.suggested_allergens ?? [],

// confirm/route.ts:318 — in buildDishRow()
allergens: (dish as ConfirmDish).allergens ?? [],
```

Note: allergens are also auto-computed by the DB trigger from `dish_ingredients`, so this is additive — the AI-provided allergens fill gaps when no ingredients were matched.

---

### 2. Batch ingredient matching — S effort, eliminates the main latency bottleneck

**File:** `apps/web-portal/app/api/menu-scan/route.ts`, function `matchIngredients` (lines 349–407)

The sequential per-ingredient pattern is the primary DB performance bottleneck. The fix already exists in `suggest-ingredients/route.ts:173–228` as function `matchNames()`.

**Action:**
1. Move `matchNames()` from `suggest-ingredients/route.ts:173` into a shared helper (e.g., `apps/web-portal/lib/ingredient-matching.ts`).
2. Refactor `matchIngredients()` in `route.ts:349` to collect all raw ingredient strings across all dishes first, then call the batched helper once.
3. Keep the translation retry pass (Pass 2) — but also batch the post-translation re-query.

Result: ~2–4 DB queries per scan (down from N×2 where N = total ingredient strings across all dishes). Immediately measurable latency improvement on any menu with more than 5 dishes.

---

### 3. Mark dishes as `enrichment_status = 'pending'` at confirm — XS effort, unlocks enrichment pipeline

**File:** `apps/web-portal/app/api/menu-scan/confirm/route.ts`, function `buildDishRow` (line 296)

The `dishes` table has enrichment columns (`enrichment_status`, `enrichment_source`, `enrichment_confidence`, `enrichment_payload`) that a post-ingestion pipeline would query. Because the confirm route never writes them, all scanned dishes sit invisibly in the `'none'` state — meaning no enrichment worker (current or future) can pick them up for embedding generation, protein extraction, or allergen computation.

**Fix (3 lines in `buildDishRow`):**
```ts
enrichment_status: 'pending',
enrichment_source: 'ai',
enrichment_confidence: dish.confidence >= 0.7 ? 'high' : dish.confidence >= 0.5 ? 'medium' : 'low',
```

This requires passing `confidence` through `ConfirmDish` (add it to `menu-scan.ts:165` and populate it in `editableToConfirm()`). The same change also persists confidence to the DB — fixing the data gap identified in section 4.

After this, any enrichment worker polling `dishes WHERE enrichment_status = 'pending'` immediately picks up all newly scanned dishes for downstream processing.

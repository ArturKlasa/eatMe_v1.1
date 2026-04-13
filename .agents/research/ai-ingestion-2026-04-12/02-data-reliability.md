# Data Reliability — Silent Bugs, Error Handling, and Failure Modes

## Current state

The AI ingestion pipeline has **four server-side call sites** that interact with OpenAI and Supabase. None implement retry logic, and error handling varies from propagation (crash) to silent swallowing (data loss). The pipeline processes menus through: extraction (GPT-4o Vision) → enrichment (ingredient matching + translation) → confirmation (DB persistence) → background enrichment (enrich-dish edge function). Each stage has distinct reliability gaps.

### Error handling patterns by call site

| Call site | On API failure | On parse failure | Retry | Timeout |
|-----------|---------------|-----------------|-------|---------|
| `route.ts:165-230` extractMenuFromImage | Uncaught → crashes request | Throws | None | None |
| `route.ts:351-390` translateIngredients | Returns `{}` silently | Returns `{}` silently | None | None |
| `suggest-ingredients/route.ts:85-106` analyseDish | Returns empty arrays | Returns empty arrays | None | None |
| `enrich-dish/index.ts:127-165` enrichWithAI | Returns `null` silently | Returns `null` silently | None | None |
| `enrich-dish/index.ts:83-99` getEmbedding | Throws → crashes enrichment | Throws | None | None |

### Supabase operations

No database operation in the pipeline has retry logic. The confirm route (`confirm/route.ts:97-281`) performs multi-table inserts (menus → categories → dishes → ingredients → option_groups → options) without a transaction wrapper. Partial failures create orphaned records.

## Reliability / accuracy gaps

### 1. No retry on any OpenAI call

All five OpenAI interactions (Vision extraction, translation, ingredient suggestion, AI enrichment, embedding generation) are single-attempt. Transient failures (rate limits, network blips, 503s) immediately fail the operation.

- `route.ts:170`: extractMenuFromImage — GPT-4o Vision call with no try/catch; any error crashes the entire menu scan
- `route.ts:365-375`: translateIngredients — GPT-4o-mini call; catch block at line 386-388 returns `{}`
- `suggest-ingredients/route.ts:85-106`: analyseDish — catch at line 144-152 returns empty defaults
- `enrich-dish/index.ts:127-143`: enrichWithAI — catch at line 163-165 returns null
- `enrich-dish/index.ts:84-94`: getEmbedding — no try/catch; throws on failure

### 2. Multi-page extraction loses all pages on single failure

`route.ts:641-648`: GPT extraction uses `Promise.all(gptExtractionPromises)`. If image 4 of 5 fails, images 1-3 that succeeded are discarded. The entire job is marked 'failed' (`route.ts:702-711`).

### 3. Translation failure silently drops ingredient matches

`route.ts:386-388`: If GPT-4o-mini translation fails (network, parse error, rate limit), `translateIngredients` returns `{}`. The caller at `route.ts:460` proceeds with an empty translations map. Ingredients that would have matched via translation remain permanently unmatched with no error signal. The user sees fewer matched ingredients but has no indication that translation failed.

### 4. Silent restaurant lookup failure degrades data quality

`route.ts:599-605`: Restaurant lookup has no error propagation. If the restaurant doesn't exist or the query fails, `currency` is derived from `null` country_code (falls through to default), and `menuLanguage` gets 'und' (undetermined). Processing continues with degraded data quality — no error thrown.

### 5. Confirm route: no transaction, orphaned records on partial failure

`confirm/route.ts:97-281`: Menu, category, and dish inserts are independent operations. If a category insert fails (line 142-146), the menu row persists as an orphan. If a variant batch fails (line 192), the parent dish persists without its variants. The job is marked 'completed' if `totalDishesInserted > 0` (line 245), even if 90% of dishes failed.

### 6. Confirm route: ingredient/option insert failures are silent

`confirm/route.ts:335-410`: The `insertIngredientsAndOptions` function logs ingredient batch insert failures as warnings (line 354-359) but does not propagate them. Dishes are counted as "inserted" even when their ingredients and options failed to persist. The admin sees "N dishes saved" with no indication that ingredient data is missing.

### 7. enrichWithAI returns null → dish marked completed anyway

`enrich-dish/index.ts:445-456`: When `enrichWithAI` returns null (any API failure), `enrichmentSource` stays 'none' and `enrichmentPayload` stays null. The process continues — embedding is generated without AI data, confidence is set to 'low' (line 478), and the dish is marked `enrichment_status: 'completed'` (line 485). There is no mechanism to retry or flag the dish for manual review.

### 8. No timeout on any external call

No OpenAI API call or Supabase operation in the entire pipeline specifies a timeout. A hung external service can block a Next.js worker (route.ts) or Deno edge function worker (enrich-dish) indefinitely.

### 9. Debounce logic allows duplicate enrichments and blocks retries

`enrich-dish/index.ts:346-354`: The 8-second debounce checks only `enrichment_status === 'completed'`. Two concurrent webhook triggers for the same dish both pass the debounce check if the first hasn't completed yet. Conversely, if enrichment fails and is retried within 8 seconds, debounce blocks the retry.

### 10. saveNewAlias swallows all errors

`route.ts:396-415`: `saveNewAlias` catches all errors identically — duplicate key conflicts (expected) and genuine failures (permission denied, connection lost) are both silently ignored. Called fire-and-forget from line 486, so the caller never knows if the alias was saved.

### 11. Storage upload failures produce phantom paths

`route.ts:646-653`: Storage uploads use `Promise.allSettled`, but rejected uploads still contribute their intended path to `imagePaths`. The job record references storage paths that may not exist, breaking audit trails and any future re-processing.

### 12. Suggest-ingredients: AI failure indistinguishable from "no ingredients"

`suggest-ingredients/route.ts:144-152`: When the AI call fails, `analyseDish` returns `{ ingredients: [], dietary_tags: [], allergens: [], spice_level: null }`. The caller cannot distinguish "AI determined no ingredients" from "AI call failed". If the admin accepts these empty suggestions, the confirm route persists them with `enrichment_source: 'ai'` — a false positive.

### 13. Race condition on dish_category creation

`suggest-ingredients/route.ts:269-292`: Category lookup and creation are two independent queries with no transaction or upsert. Concurrent requests can both see "no match" and both attempt to insert. The second insert may fail silently (`.single()` returns null on error), causing `dish_category_id` to be null.

### 14. Final DB update failure goes undetected

`route.ts:679-691`: After successful processing, the job status update to 'needs_review' has no error handling. If this update fails, the client receives a success response but the job remains stuck in 'processing' state in the database.

## Improvement opportunities

### DR-01: Add retry with exponential backoff to all OpenAI calls

| Field | Value |
|-------|-------|
| **Current behaviour** | All 5 OpenAI call sites are single-attempt (`route.ts:170`, `route.ts:365`, `suggest-ingredients/route.ts:85`, `enrich-dish/index.ts:127`, `enrich-dish/index.ts:84`) |
| **Proposed change** | Wrap each OpenAI call in a retry utility with exponential backoff (3 attempts, 1s/2s/4s delays), jitter, and retry only on 429/500/502/503/504 status codes. Use the OpenAI SDK's built-in retry config (`maxRetries`) where available. |
| **Impact** | **H** — Transient failures currently lose entire menus or enrichments |
| **Effort** | **S** — Single utility function, applied at 5 call sites |
| **Dependencies** | None |

### DR-02: Use Promise.allSettled for multi-page GPT extraction

| Field | Value |
|-------|-------|
| **Current behaviour** | `route.ts:641-648` uses `Promise.all` — one page failure discards all pages |
| **Proposed change** | Switch to `Promise.allSettled`. Collect successful extractions, log failed pages as warnings, proceed with partial results. Mark job as 'completed_with_warnings' if any pages failed. |
| **Impact** | **H** — Multi-page menus (PDFs) are the most common upload type |
| **Effort** | **XS** — Change `Promise.all` to `Promise.allSettled` + filter fulfilled results |
| **Dependencies** | None |

### DR-03: Make translation failure visible to the user

| Field | Value |
|-------|-------|
| **Current behaviour** | `route.ts:386-388` returns `{}` on any error; caller proceeds silently |
| **Proposed change** | Return `{ translations: {}, error: true }` from translateIngredients on failure. In `matchIngredients`, add a warning to the extraction result: "Ingredient translation failed — some ingredients may be unmatched". Surface this in the review UI. |
| **Impact** | **M** — Affects non-English menus where translation is critical for matching |
| **Effort** | **XS** — Change return type, add warning propagation |
| **Dependencies** | None |

### DR-04: Wrap confirm route inserts in a Supabase transaction

| Field | Value |
|-------|-------|
| **Current behaviour** | `confirm/route.ts:97-281` performs independent inserts; partial failures create orphaned records |
| **Proposed change** | Use Supabase's `rpc` to call a PostgreSQL function that performs all inserts in a single transaction. On any failure, the entire operation rolls back. Alternatively, implement compensating deletes on failure. |
| **Impact** | **H** — Orphaned records corrupt data integrity and are invisible to admins |
| **Effort** | **M** — Requires a new PostgreSQL function or significant refactor of the confirm route |
| **Dependencies** | Database migration for the transaction function |

### DR-05: Propagate ingredient/option insert failures to the response

| Field | Value |
|-------|-------|
| **Current behaviour** | `confirm/route.ts:354-407` logs warnings but does not propagate ingredient/option insert failures |
| **Proposed change** | Track per-dish ingredient/option insert success. Include in the response: `dishes_with_missing_ingredients: N`. Surface in the admin UI as a warning: "N dishes saved without ingredients due to database errors". |
| **Impact** | **M** — Admins currently have no way to know ingredients are missing |
| **Effort** | **XS** — Add counter, include in response |
| **Dependencies** | None |

### DR-06: Add explicit timeouts to all external calls

| Field | Value |
|-------|-------|
| **Current behaviour** | No timeout specified on any OpenAI or Supabase call across all 4 endpoints |
| **Proposed change** | Set OpenAI SDK `timeout` option (30s for Vision, 15s for GPT-4o-mini, 10s for embeddings). Set Supabase client `fetchOptions.signal` with AbortController for DB operations (10s). Add Next.js route segment config `maxDuration` to menu-scan routes. |
| **Impact** | **M** — Prevents worker thread exhaustion from hung external services |
| **Effort** | **S** — Configuration changes at each call site |
| **Dependencies** | None |

### DR-07: Fix enrich-dish to distinguish AI failure from "no enrichment needed"

| Field | Value |
|-------|-------|
| **Current behaviour** | `enrich-dish/index.ts:445-485` marks dish as `enrichment_status: 'completed'` even when `enrichWithAI` returns null (API failure) |
| **Proposed change** | When `enrichWithAI` returns null, set `enrichment_status: 'failed'` with `enrichment_error: 'ai_call_failed'`. Add a re-enrichment mechanism (cron job or manual trigger) that retries failed dishes. |
| **Impact** | **H** — Failed enrichments are currently invisible; dishes have low confidence with no recovery path |
| **Effort** | **S** — Change status logic + add a simple retry query |
| **Dependencies** | DR-01 (retry logic reduces the number of dishes reaching this state) |

### DR-08: Add concurrency control to enrich-dish webhook

| Field | Value |
|-------|-------|
| **Current behaviour** | `enrich-dish/index.ts:346-357` debounces on `enrichment_status='completed'` only; concurrent webhooks can both proceed; failed retries are blocked |
| **Proposed change** | Use `UPDATE ... SET enrichment_status='processing' WHERE enrichment_status IN ('pending','failed') RETURNING id` as an atomic claim. If no rows returned, skip (another worker has it). Replace time-based debounce with status-based locking. |
| **Impact** | **M** — Prevents duplicate enrichment work and unblocks retry of failed dishes |
| **Effort** | **S** — Replace debounce with atomic UPDATE + check |
| **Dependencies** | None |

### DR-09: Fix storage upload path tracking

| Field | Value |
|-------|-------|
| **Current behaviour** | `route.ts:646-653` uses `Promise.allSettled` for uploads but includes paths from rejected uploads in `imagePaths` |
| **Proposed change** | Filter `allSettled` results: only include paths from fulfilled uploads. Add failed upload paths to job warnings. |
| **Impact** | **L** — Affects audit trail accuracy, not core functionality |
| **Effort** | **XS** — Filter allSettled results |
| **Dependencies** | None |

### DR-10: Make analyseDish failure distinguishable from empty results

| Field | Value |
|-------|-------|
| **Current behaviour** | `suggest-ingredients/route.ts:144-152` returns empty arrays on AI failure, indistinguishable from "no ingredients found" |
| **Proposed change** | Return `{ error: true, ...defaults }` or throw a typed error. Caller should surface "AI suggestion unavailable" in the review UI instead of showing empty ingredient list. |
| **Impact** | **M** — Prevents admins from confirming dishes with false-empty ingredient data |
| **Effort** | **XS** — Change return type + caller handling |
| **Dependencies** | None |

### DR-11: Add error handling to final job status update

| Field | Value |
|-------|-------|
| **Current behaviour** | `route.ts:679-691` updates job status without error handling; failure leaves job stuck in 'processing' |
| **Proposed change** | Wrap the final update in try/catch. On failure, retry once. If still failing, log critical error and return 500 instead of 200. |
| **Impact** | **M** — Stuck jobs require manual database intervention |
| **Effort** | **XS** — Add try/catch + single retry |
| **Dependencies** | None |

## Cross-refs

### Prior baseline items this extends
- **Baseline #4** (GPT truncation warning) — now implemented, but truncated data is still returned as successful (gap #2 in this analysis extends the concern)
- **Baseline #6** (cross-session dedup) — still open; confirm route's lack of transactions (DR-04) makes dedup harder since partial inserts can create duplicates that are hard to clean up

### Topics this depends on or enables
- **TOPIC-01 (prompt-engineering)**: DR-01 retry logic should use the same SDK configuration as any prompt changes
- **TOPIC-06 (enrichment-architecture)**: DR-07 and DR-08 are prerequisites for a robust enrichment queue
- **TOPIC-07 (confidence-provenance)**: DR-07's failure tracking feeds into confidence calibration
- **TOPIC-08 (open-baseline-items)**: DR-04 transaction support affects baseline #5 (provenance FK) implementation

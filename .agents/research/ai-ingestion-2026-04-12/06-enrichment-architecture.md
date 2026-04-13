# Enrichment Architecture — Queuing, Caching, Re-enrichment, Observability

## Current state

The enrich-dish pipeline is a Supabase Edge Function (`infra/supabase/functions/enrich-dish/index.ts`, 538 lines) triggered by a database webhook on INSERT/UPDATE of the `dishes` table. It also accepts direct `{ dish_id }` calls for manual re-enrichment. A separate batch script (`infra/scripts/batch-embed.ts`, 229 lines) provides ad-hoc bulk processing.

### Trigger mechanism

The function handles two entry paths (`index.ts:306-312`):
- **Webhook envelope**: `body.record.id` — Supabase DB webhook on dishes INSERT/UPDATE
- **Direct call**: `body.dish_id` — used by batch-embed.ts and potential admin tools

Authentication accepts webhook secret header or service-role JWT (`index.ts:287-299`).

### Processing pipeline (per dish)

1. Load dish row (`index.ts:322-328`)
2. Skip if `is_parent` (`index.ts:339-344`) or recently completed within 8s debounce (`index.ts:347-354`)
3. Set `enrichment_status = 'pending'` (`index.ts:357`)
4. Parallel fetch: ingredients, option groups, restaurant cuisine, parent dish (`index.ts:362-385`)
5. Sequential fetch: parent ingredients if variant (`index.ts:411-414`)
6. Evaluate completeness — dish_kind-aware (`index.ts:426-428`)
7. If not complete: call GPT-4o-mini for AI enrichment (`index.ts:444-445`)
8. Build embedding input string (`index.ts:460-471`)
9. Generate embedding via OpenAI text-embedding-3-small (`index.ts:477`)
10. Persist all fields to DB (`index.ts:496-499`)
11. Update restaurant centroid vector via RPC (`index.ts:512-514`)

### Batch processing

`batch-embed.ts` fetches all dishes with `enrichment_status IN ('none', 'failed')` (`batch-embed.ts:123-126`), then calls the enrich-dish endpoint in configurable batches (default concurrency: 5, delay: 1000ms between batches, `batch-embed.ts:38-39`). After all dishes, it runs `ANALYZE dishes` RPC for HNSW index stats (`batch-embed.ts:193`) and updates all active restaurant vectors sequentially (`batch-embed.ts:213-218`).

### Cache invalidation

A separate `invalidate-cache` edge function (`infra/supabase/functions/invalidate-cache/index.ts`) is triggered by webhooks on UPDATE events for restaurants, menus, and dishes. It deletes Upstash Redis keys (`invalidate-cache/index.ts:93`), but the comment at `index.ts:87-92` notes that Redis caching in the feed is "planned but not yet implemented" — the DEL calls are currently no-ops.

### Confirm route integration

The confirm route (`confirm/route.ts:329-332`) now sets `enrichment_status: 'pending'` and `enrichment_source: 'ai'` in `buildDishRow`, which triggers the webhook. However, the webhook fires per INSERT — for a 50-dish menu, 50 separate enrich-dish invocations fire simultaneously.

## Reliability / accuracy gaps

### 1. No queue — webhook storm on bulk confirm

When the confirm route inserts N dishes, N simultaneous webhook invocations fire (`confirm/route.ts:219` for standalone batch insert, lines 190 for child batch insert). Each invocation independently calls OpenAI twice (enrichment + embedding). For a 50-dish menu, this means 50 concurrent edge function invocations, each making 2 OpenAI API calls = 100 concurrent external calls. This risks:
- OpenAI rate limit errors (no retry logic — see 02-data-reliability.md DR-01)
- Edge function cold start amplification (Deno containers)
- Supabase connection pool exhaustion (each invocation creates its own client at `index.ts:42-45`)

### 2. No batch embedding API usage

Each dish generates its embedding individually via `getEmbedding()` (`index.ts:83-99`). OpenAI's embeddings API supports batch input (up to 2048 texts per call). The batch-embed script could collect all embedding inputs and make a single API call instead of N calls.

### 3. Single Supabase client at module scope

The Supabase client is created at module scope (`index.ts:42-45`) and shared across all invocations within the same Deno isolate. While not currently buggy, it means no per-request connection isolation. If the edge function scales to multiple isolates (which it does under webhook storms), each isolate creates its own connection — no pooling strategy.

### 4. Debounce is per-dish, not per-batch

The debounce check (`index.ts:347-354`) skips if the dish was completed within 8 seconds. But during a bulk confirm, all dishes are new INSERTs with `enrichment_status: 'pending'` — debounce never fires. The debounce only helps with rapid UPDATE-triggered re-enrichments, not the primary ingestion path.

### 5. No re-enrichment trigger after admin edits

When an admin edits a dish's name, description, or ingredients in the web portal, there is no mechanism to re-trigger enrichment. The webhook fires on any UPDATE, but the debounce check at `index.ts:347-354` skips if status is `'completed'` and updated < 8s ago. For edits after the initial enrichment, the dish retains stale AI data and embedding.

The debounce also blocks legitimate re-enrichment: if an admin edits a dish within 8 seconds of completion, the enrichment is skipped even though the data changed.

### 6. No observability beyond console.log

All logging uses unstructured `console.log`/`console.error` with `[enrich-dish]` prefix (`index.ts:97, 156, 318, 331, 387, etc.`). No structured JSON logging, no external error tracking (Sentry, Datadog), no metrics collection. Token usage is logged (`index.ts:97, 156`) but not aggregated or tracked per-restaurant/per-period.

### 7. No cost tracking or budget enforcement

OpenAI costs are invisible. Token counts are logged to console (`index.ts:97, 156`) but never persisted. The `EnrichmentPayload` stores `prompt_tokens` and `completion_tokens` (`index.ts:72-73`) in the `enrichment_payload` JSONB column, but there is:
- No per-restaurant cost aggregation
- No daily/monthly cost ceiling
- No alert on unusual token consumption
- No way to query historical cost without parsing JSONB across all dishes

### 8. No embedding caching for identical/similar dishes

If two restaurants serve "Margherita Pizza" with identical names and descriptions, each gets a separate embedding API call. No deduplication or caching of embeddings by input text. The `embedding_input` field is stored (`index.ts:487`) but never checked for prior matches.

### 9. Enrichment fails silently — status still set to 'completed'

When `enrichWithAI()` returns `null` (AI failure), the function still proceeds to generate an embedding and set `enrichment_status: 'completed'` (`index.ts:485`). The dish appears fully enriched but has no AI-inferred data. Only `enrichment_source: 'none'` distinguishes this from a genuinely complete dish — but no downstream consumer checks this field.

This was also identified in 02-data-reliability.md (DR-07) — the architectural implication is that `enrichment_status` is a lie: 'completed' means "embedding generated" not "AI enrichment succeeded."

### 10. Restaurant vector update is synchronous and non-batched

After each dish enrichment, `update_restaurant_vector` RPC is called (`index.ts:512-514`). During a 50-dish bulk confirm, this RPC is called 50 times for the same restaurant. The RPC recomputes the centroid from all dish embeddings each time. batch-embed.ts handles this correctly by doing it once per restaurant at the end (`batch-embed.ts:213-218`), but the webhook path does not.

### 11. No idempotency key or deduplication

If the webhook fires twice for the same dish (which Supabase webhook retry can cause), the function processes it twice — making duplicate OpenAI calls and overwriting the same DB row. The debounce (`index.ts:347-354`) partially mitigates this for rapid re-fires, but with a gap > 8s, duplicate processing occurs.

## Improvement opportunities

### EA-01: Introduce a queue for bulk enrichment
**Current behaviour**: Webhook fires per-dish INSERT, creating N concurrent invocations for N-dish confirms (`confirm/route.ts:219`, `index.ts:278`).
**Proposed change**: Instead of triggering enrichment via database webhook on each INSERT, have the confirm route enqueue dish IDs into a `pending_enrichment` table (or Supabase Realtime channel). A single edge function invocation (or scheduled function) processes the queue in batches. Alternatively, the confirm route can call enrich-dish once with a `dish_ids: string[]` array, and the function processes them sequentially within a single invocation.
**Impact**: H — eliminates webhook storms, prevents OpenAI rate limit failures, reduces cold starts
**Effort**: M — requires confirm route change + edge function refactor to accept batch
**Dependencies**: None

### EA-02: Use OpenAI batch embeddings API
**Current behaviour**: `getEmbedding()` at `index.ts:83-99` makes one API call per dish.
**Proposed change**: Collect all `embedding_input` strings within a batch and call the embeddings API once with `input: string[]`. The API supports up to 2048 inputs per call. For the webhook path (single dish), no change; for batch-embed.ts or a queue processor, embed all dishes in one call.
**Impact**: M — reduces API calls by ~Nx, lower latency, lower cost per embedding (fewer API overhead calls)
**Effort**: S — modify getEmbedding to accept string[], update batch-embed.ts caller
**Dependencies**: EA-01 (batch mode)

### EA-03: Separate enrichment status from embedding status
**Current behaviour**: `enrichment_status: 'completed'` is set at `index.ts:485` even when AI enrichment fails (`enrichWithAI` returns null). A dish with only an embedding but no AI data is indistinguishable from a fully enriched dish by status alone.
**Proposed change**: Split into two status fields: `embedding_status` ('none' | 'pending' | 'completed' | 'failed') and keep `enrichment_status` for AI-inferred data only. Set `enrichment_status: 'skipped'` when completeness is 'complete' (no AI needed), `'failed'` when enrichWithAI returns null, and `'completed'` only on success.
**Impact**: H — enables accurate monitoring, retry targeting, and quality dashboards
**Effort**: S — schema migration + update edge function status logic
**Dependencies**: None

### EA-04: Debounce at batch level with re-enrichment trigger
**Current behaviour**: Debounce at `index.ts:347-354` checks per-dish, only skips if `enrichment_status === 'completed'` AND `ageSeconds < 8`. Admin edits to completed dishes don't trigger re-enrichment unless they also reset enrichment_status.
**Proposed change**: (a) Remove the 8-second debounce (unnecessary if EA-01 introduces a queue). (b) Add a `re_enrich()` database function or trigger that sets `enrichment_status = 'pending'` when `name`, `description`, or ingredient composition changes on a completed dish. This ensures admin edits get fresh AI inference and embedding.
**Impact**: M — prevents stale embeddings, enables admin-edit-driven freshness
**Effort**: S — DB trigger on dishes UPDATE comparing old vs new name/description + queue entry
**Dependencies**: EA-01 (queue), EA-03 (status split)

### EA-05: Deduplicate restaurant vector updates
**Current behaviour**: `update_restaurant_vector` RPC called once per dish at `index.ts:512-514`. During bulk confirm of N dishes, it runs N times for the same restaurant.
**Proposed change**: If processing via queue (EA-01), call `update_restaurant_vector` once at the end of a batch for each unique restaurant_id. If retaining webhook path, use a debounced approach: set a `restaurant_vector_stale` flag and have a separate periodic function recompute stale restaurants.
**Impact**: M — reduces RPC calls from N to 1 per restaurant per batch, avoids redundant centroid recomputation
**Effort**: XS — conditional RPC call at end of batch loop
**Dependencies**: EA-01 (batch mode preferred)

### EA-06: Structured logging with cost tracking
**Current behaviour**: All logging is `console.log('[enrich-dish] ...')` at various points (`index.ts:97, 156, 318, 387, 434, 473, 519`). Token counts stored in `enrichment_payload` JSONB but not queryable in aggregate.
**Proposed change**: (a) Switch to structured JSON logging: `console.log(JSON.stringify({ event: 'enrichment_complete', dish_id, restaurant_id, prompt_tokens, completion_tokens, embedding_tokens, latency_ms, enrichment_source, confidence }))`. (b) Create a `ai_usage_log` table with columns: `dish_id`, `restaurant_id`, `model`, `prompt_tokens`, `completion_tokens`, `cost_usd`, `created_at`. Insert a row after each AI call. (c) Add a daily cost query view for monitoring.
**Impact**: H — enables cost visibility, anomaly detection, per-restaurant billing attribution
**Effort**: S — structured log format change is XS; usage table + insert is S
**Dependencies**: None

### EA-07: Embedding cache by input hash
**Current behaviour**: No caching — identical `embedding_input` strings across dishes each trigger a separate OpenAI embeddings call (`index.ts:477`).
**Proposed change**: Before calling `getEmbedding()`, compute a hash of the `embedding_input` string (SHA-256 or similar). Check `dishes` table for an existing row with matching `embedding_input` and reuse its embedding vector. Alternatively, maintain a separate `embedding_cache` table keyed by input hash. Cache hit rate depends on menu overlap across restaurants — likely low for unique dishes but high for common items like "Coca-Cola", "French Fries".
**Impact**: L — low cache hit rate expected for unique dishes; marginal cost savings
**Effort**: S — hash computation + DB lookup before API call
**Dependencies**: None

### EA-08: Idempotency via enrichment_version or last_enriched_at
**Current behaviour**: No idempotency — duplicate webhook fires process the dish twice, making redundant OpenAI calls. Debounce at `index.ts:347-354` only protects within 8 seconds of completion.
**Proposed change**: Add a `last_enriched_at` timestamp column to `dishes`. Before processing, check if `last_enriched_at` is newer than the webhook event timestamp (available in `body.record.updated_at`). Skip if already enriched after the triggering change. Additionally, add an `enrichment_version` integer to support prompt versioning — bump version when prompts change, re-enrich dishes at older versions.
**Impact**: M — prevents duplicate API spend, enables prompt-version-based re-enrichment campaigns
**Effort**: S — schema migration + check in edge function + version bump workflow
**Dependencies**: None

### EA-09: Connection pooling via Supabase client per-request
**Current behaviour**: Single Supabase client created at module scope (`index.ts:42-45`), shared across isolate invocations. Under webhook storms, multiple isolates each create their own client.
**Proposed change**: Use Supabase's connection pooler (PgBouncer) mode by setting `db.pooler.enabled = true` in the Edge Function's Supabase client config, or pass the pooler URL instead of direct connection. For Edge Functions, the recommended pattern is to create the client inside the handler (not at module scope) with pooler mode.
**Impact**: L — prevents connection exhaustion under high concurrency, but current scale doesn't trigger this
**Effort**: XS — change client creation to use pooler URL
**Dependencies**: EA-01 reduces concurrency, making this less urgent

### EA-10: Add provenance tracking via menu_scan_job_id FK
**Current behaviour**: No link between a dish and the scan job that created it. The confirm route writes `menu_scan_jobs.dishes_saved` count (`confirm/route.ts:248`) but `dishes` table has no FK back. This was identified in baseline item #5 and remains open.
**Proposed change**: Add `menu_scan_job_id UUID REFERENCES menu_scan_jobs(id)` column to `dishes`. Set it in `buildDishRow()` by passing `job_id` from the confirm payload. Enables: provenance tracing, re-scan diffing, analytics on AI accuracy per scan, cleanup of dishes from failed scans.
**Impact**: M — enables provenance, diffing, and analytics
**Effort**: S — schema migration + 1-line change in buildDishRow
**Dependencies**: None (schema migration required)

## Cross-refs

### Prior baseline items extended
- **#3 (enrichment_status=pending)**: Now implemented in `buildDishRow` (`confirm/route.ts:329`). EA-03 extends this by splitting enrichment vs embedding status.
- **#5 (provenance FK)**: Still open. EA-10 provides refined implementation approach.

### Topics this depends on or enables
- **02-data-reliability**: DR-01 (retry logic) is a prerequisite for EA-01's queue reliability. DR-07 (false 'completed' status) is the specific bug that EA-03 fixes architecturally.
- **03-ingredient-matching**: IM-04 (link enrich-dish ingredients to canonical IDs) would add a step between EA-01's AI enrichment and embedding generation.
- **05-dish-richness**: DR-01 through DR-09 (additional AI fields) would increase the enrichment payload, making EA-01's queue and EA-06's cost tracking more important.
- **07-confidence-provenance** (upcoming): EA-08's enrichment_version enables prompt versioning; EA-10's scan job FK enables provenance tracking. These topics will overlap significantly.

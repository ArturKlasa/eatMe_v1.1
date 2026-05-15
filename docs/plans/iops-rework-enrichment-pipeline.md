# Implementation Plan — IOPS Rework + Enrichment Pipeline Cleanup

Eliminate trigger recursion that's depleting the Supabase IOPS budget, then progressively simplify the dish enrichment pipeline so a single batched embedding call replaces the current per-dish AI fan-out.

## Background

The Supabase project is depleting its disk IOPS budget (alert email received 2026-05-14). Investigation traced the dominant query — a single-row `UPDATE dishes SET enrichment_status='pending'` consuming 57% of total query time — to a recursive trigger loop, plus a deeper architectural mismatch where two separate AI pipelines (menu-scan-worker + enrich-dish) run on every dish but only one is needed.

The root cause is a Database Webhook trigger named `WEBHOOK_SECRET` on the `dishes` table that fires `enrich-dish` on every INSERT or UPDATE, including the writes that `enrich-dish` itself makes. This creates 3-5 enrich-dish invocations per dish INSERT, with each invocation doing redundant work that two existing smart triggers (`_trg_notify_enrich_dish`, `_trg_after_dish_embedded`) already handle correctly.

Beyond the recursion, the system has accumulated dead state: `enrich-dish` writes columns (`enrichment_payload`, `enrichment_review_status`, `enrichment_source`, `enrichment_confidence`, `embedding_input`) that no consumer reads. It also calls GPT-4o-mini to infer fields (`inferred_dish_category`, `inferred_allergens`) that the upstream `menu-scan-worker` already extracts with better context. The only output of `enrich-dish` actually consumed downstream is the `embedding` vector used by `generate_candidates` for feed ranking.

On the read side, `generate_candidates` orders by `embedding <=> preference_vector` with no HNSW index, forcing a sequential scan + per-row vector compute on every consumer feed request.

## Decisions locked in

| Decision | Choice |
|---|---|
| Recursion fix | Drop `WEBHOOK_SECRET` trigger; keep the smart triggers `_trg_notify_enrich_dish` and `_trg_after_dish_embedded` |
| Long-term enrichment shape | `enrich-dish` reduced to embedding-only (~150 lines), AI inference removed |
| Embedding production path | Bulk: batched OpenAI call from confirm route + single RPC UPDATE. Edits: per-dish via stripped enrich-dish via the smart trigger. Recovery: pg_cron sweeps stuck rows |
| Recovery strategy | pg_cron job (every 5 min) — accept the small operational complexity to avoid silent feed-quality decay |
| Restaurant centroid recompute | pg_cron job (every 2 min) on a dirty flag column, replacing per-dish RPC firings |
| Read-path optimization | HNSW partial index on `dishes.embedding` |
| Dead column cleanup | Deferred to Phase 5; defer until 1+ week of stable Phase 1-4 operation |
| Service-role JWT rotation | **Deferred to pre-launch.** Leaked key remains valid but exposure surface is narrow (no public endpoint to abuse). The trigger that exposed it in `pg_trigger` is being dropped in Phase 1. Rotating now would log out all active users and require a coordinated mobile rebuild — not justified for early-stage risk profile. Revisit before public launch or if abuse is observed. |
| Migration numbering | Continue from current `131_rename_duck_to_goat.sql` → `132`, `133`, `134`, `135`, `136` |

## Atomic commit map

| # | Commit | Phase | PR |
|---|---|---|---|
| 1 | `fix(enrich-dish): remove redundant pending UPDATE and restaurant_vector RPC` | 1 | 1 |
| 2 | `chore(db): drop WEBHOOK_SECRET trigger on dishes` | 1 | live SQL + migration in Phase 5 |
| 3 | `refactor(enrich-dish): strip to embedding-only; remove gpt-4o-mini call` | 2 | 2 |
| 4 | `feat(db): embed-recovery-tick cron + embed-dish-batch edge function` | 2 | 2 |
| 5 | `feat(db): restaurant_vector_dirty_at + recompute cron` | 3 | 3 |
| 6 | `feat(db): update_dish_embeddings_batch RPC` | 3 | 3 |
| 7 | `refactor(db): narrow trg_enrich_on_dish_change to UPDATE-only` | 3 | 3 |
| 8 | `feat(web-portal): batched embedding at menu-scan confirm time` | 3 | 3 |
| 9 | `feat(db): HNSW partial index on dishes.embedding` | 4 | 4 |
| 10 | `refactor(db): generate_candidates planner-friendly ORDER BY` (if needed) | 4 | 4 |
| 11 | `chore(db): drop dead enrichment columns + record WEBHOOK_SECRET drop` | 5 | 5 |

---

## Pre-flight

Required before Phase 1.

- [ ] **PF-1** Verify backups are current (Supabase Dashboard → Database → Backups; <24h old).
- [ ] **PF-2** Baseline IOPS snapshot — note current `Disk IO % consumed` and screenshot the last-24h IOPS graph.
- [ ] **PF-3** Baseline top queries — run in SQL editor and save:
  ```sql
  SELECT substring(query, 1, 100) AS q, calls,
         round(mean_exec_time::numeric, 2) AS mean_ms,
         round(total_exec_time::numeric, 0) AS total_ms,
         shared_blks_read
  FROM pg_stat_statements
  ORDER BY total_exec_time DESC LIMIT 20;
  ```
- [ ] **PF-4** Confirm `infra/scripts/batch-embed.ts` is not currently running anywhere (terminal sessions, tmux, CI). If it is, let it finish.

---

## Phase 1 — Stop the recursion

**Goal:** Eliminate the trigger recursion loop and remove duplicate work inside `enrich-dish`.
**Expected outcome:** IOPS drops 40-60% within ~1 hour of deploy. Supabase budget alert stops within ~24h.
**Risk:** Very low — all removals verified as no-ops against the current trigger setup.
**Rollback:** Re-apply WEBHOOK_SECRET trigger; revert the Edge Function commit; redeploy.

### Tasks

- [x] **1.1** Edit `infra/supabase/functions/enrich-dish/index.ts`:
  - Delete the block at lines 383-385 (`// Mark as pending` comment + the `UPDATE dishes SET enrichment_status='pending'` + trailing blank).
  - Delete the block at lines 560-574 (the `// ── Update restaurant vector ──` comment block + the `if (enrichmentSource !== 'none')` if/else).
- [x] **1.2** ~~Apply the same two edits to `supabase/functions/enrich-dish/index.ts`~~ — N/A: `supabase/` is a symlink to `infra/supabase/` (verified via `ls -la`), so 1.1 covers both paths.
- [x] **1.3** Deploy: `supabase functions deploy enrich-dish` — completed 2026-05-15.
- [x] **1.4** Manual smoke test — confirmed 2026-05-15: dish `0835681b...` (Flat white) re-enriched to `completed` with embedding intact via description-bump UPDATE.
- [x] **1.5** Dropped the recursive trigger (SQL editor, live DB) — 2026-05-15:
  ```sql
  DROP TRIGGER "WEBHOOK_SECRET" ON public.dishes;
  ```
  Migration to record this lands in Phase 5.
- [ ] **1.6** End-to-end smoke — confirm a small (1-2 dish) menu via web-portal admin. Verify in Edge Function logs that exactly **one** enrich-dish invocation fires per dish (not 3-5), and dishes complete normally.

### Acceptance criteria

- IOPS graph shows a visible step-down within 1 hour of deploy (compare to PF-2).
- `pg_stat_statements` shows the `UPDATE dishes SET enrichment_status='pending'` query drop sharply in `calls`.
- No new dishes appear stuck at `enrichment_status='pending'` after menu confirms.
- Supabase IO budget warning email stops arriving.

### Open questions

None — dependencies verified during investigation.

### ⚠️ Discovered 2026-05-15: production auth broken

During the post-Phase-1 hygiene cleanup attempt, we discovered the anon JWT hardcoded in `_trg_notify_enrich_dish` is now rejected by Supabase's gateway with `401 Unauthorized` (sometimes `UNAUTHORIZED_LEGACY_JWT`). The JWT displayed in Dashboard → Settings → API still visually matches the trigger's hardcoded value, but the gateway rejects it nonetheless. Most likely root cause: Supabase's "new API keys / JWT signing keys" migration rotated the validation key for this project sometime between 05:55 and 15:24 UTC on 2026-05-15.

**Impact**: any menu confirm hitting the admin UI right now lands the dish at `enrichment_status='pending'` with no embedding refresh. Fire-and-forget trigger swallows the 401 — no error visible in admin UI.

**Pre-Phase-2 blocker**: must fix the trigger's auth before any Phase 2 work, because Phase 2 introduces a `pg_cron` job that uses the same auth pattern.

**Action items added** (see new Phase 1.5 section below).

---

## Phase 1.5 — Restore trigger auth (URGENT, blocks Phase 2)

**Goal:** Restore working auth for `_trg_notify_enrich_dish` and stop new dishes from getting stuck at `pending`.
**Expected outcome:** Menu confirms enrich dishes again. Backlog cleanup becomes possible.
**Risk:** Low if we move the secret to Vault; medium if we hardcode a new key (still vulnerable to next rotation).
**Rollback:** Revert trigger to prior body; production stays broken until next attempt.

### Tasks

- [x] **1.5.1** Diagnose — service-role JWT works; legacy anon JWT returns 401 `Unauthorized` (with intermittent `UNAUTHORIZED_LEGACY_JWT` variant). Confirmed by `net.http_post` smoke test 2026-05-15.
- [x] **1.5.2** Stored service-role JWT in Vault as `enrich_dish_service_key` (verified via `vault.decrypted_secrets`).
- [x] **1.5.3** Replaced `_trg_notify_enrich_dish()` body — now reads from `vault.decrypted_secrets` at call time. Hardcoded anon JWT removed.
- [x] **1.5.4** Smoke test green — Flat white dish bumped through the trigger, returned `200`, dish landed back at `completed`.
- [x] **1.5.5** Migration `132_vault_based_trigger_auth.sql` + reverse written.
- [x] **1.5.6** Backlog cleanup retried: 31 published-without-embedding fully handled (25 re-enriched via DO block, 6 were `is_parent=true` shells marked completed cosmetically). 59 drafts deferred — no user impact, not in feed. Final state: `pending_no_embed = 0` for published.

### Resolved findings

- The correct credential class for backend-to-backend trigger calls is service-role, not anon. Anon was an oversight in the original trigger definition. Service-role is now used via Vault.
- The previously-exposed service-role JWT (leaked via the now-dropped `WEBHOOK_SECRET` trigger and stored in chat history) is the same one we put in Vault. **Pre-launch rotation still recommended.** When rotated, update the Vault secret in place — no migration change needed because the trigger reads the secret dynamically.

---

## Phase 2 — Strip enrich-dish to embedding-only + automatic recovery

**Goal:** Remove the redundant GPT-4o-mini call from `enrich-dish`. Add automatic recovery for stuck-pending dishes.
**Expected outcome:** ~50% reduction in OpenAI spend per dish. Stuck dishes auto-recover within 5 min.
**Risk:** Low — dropped fields are verified unused by consumers.
**Rollback:** Revert Edge Function commit; cron job can stay or be unscheduled.

### Tasks

- [ ] **2.1** Edit `infra/supabase/functions/enrich-dish/index.ts`:
  - Delete `enrichWithAI` function (~lines 105-177).
  - Delete `EnrichmentPayload` interface (~lines 70-78).
  - Delete `evaluateCompleteness` and `evaluateConfidence` (~lines 181-229).
  - Delete the AI-enrichment block (~lines 480-505): the `if (completeness !== 'complete' && !embeddingOnly)` block.
  - Remove `enrichment_payload`, `enrichment_review_status`, `enrichment_source`, `enrichment_confidence` from the update payload (~lines 536-544); keep `embedding`, `embedding_input`, `enrichment_status: 'completed'`.
  - Remove parent ingredient loading (~lines 433-453) and course loading from parallel fetch (~lines 410-415) — embedding text doesn't need them.
  - Target: ~150 lines.
- [ ] **2.2** Mirror in `supabase/functions/enrich-dish/index.ts`.
- [ ] **2.3** Update `infra/scripts/batch-embed.ts:126`:
  - Change filter to `.in('enrichment_status', ['none', 'pending', 'failed'])`.
  - Add `.lt('updated_at', new Date(Date.now() - 60_000).toISOString())` age guard.
- [ ] **2.4** Write new Edge Function `infra/supabase/functions/embed-dish-batch/index.ts` — accepts `{ dish_ids: string[] }`, iterates and calls existing `enrich-dish` per id with concurrency limit.
- [ ] **2.5** Write migration `infra/supabase/migrations/132_embed_recovery_cron.sql`:
  ```sql
  BEGIN;

  CREATE INDEX IF NOT EXISTS dishes_pending_embed_idx
    ON dishes(updated_at)
    WHERE enrichment_status IN ('pending', 'failed') AND embedding IS NULL;

  SELECT cron.schedule(
    'embed-recovery-tick',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/embed-dish-batch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := (
        SELECT jsonb_build_object('dish_ids', array_agg(id))
        FROM dishes
        WHERE enrichment_status IN ('pending', 'failed')
          AND embedding IS NULL
          AND is_parent = false
          AND is_template = false
          AND updated_at < now() - interval '1 minute'
        LIMIT 100
      )
    )
    WHERE EXISTS (
      SELECT 1 FROM dishes
      WHERE enrichment_status IN ('pending', 'failed')
        AND embedding IS NULL
        AND updated_at < now() - interval '1 minute'
    );
    $$
  );

  COMMIT;
  ```
- [ ] **2.6** Write reverse migration `infra/supabase/migrations/132_REVERSE_ONLY_embed_recovery_cron.sql`:
  ```sql
  BEGIN;
  SELECT cron.unschedule('embed-recovery-tick');
  DROP INDEX IF EXISTS dishes_pending_embed_idx;
  COMMIT;
  ```
- [ ] **2.7** Deploy: `supabase functions deploy enrich-dish embed-dish-batch`.
- [ ] **2.8** Apply migration 132.
- [ ] **2.9** Smoke test — confirm a multi-dish menu, verify dishes get embeddings via live path (not cron).
- [ ] **2.10** Force-failure test — pick a published dish, `UPDATE dishes SET embedding=NULL, enrichment_status='failed' WHERE id=...`. Wait 5 min. Verify cron picks it up and re-embeds.

### Acceptance criteria

- `enrich-dish` Edge Function is ~150 lines.
- Normal menu confirm produces exactly one OpenAI call per dish (the embeddings call), zero gpt-4o-mini calls.
- Force-failed dish recovers automatically within 5 min.
- `cron.job_run_details` shows `embed-recovery-tick` mostly idle when no failures are pending.

### Open questions

- **Decision needed**: Keep `enrichment_review_status` column for a possible future admin review UI? Recommendation: yes, defer dropping it until Phase 5. The Edge Function stops writing it now; column stays harmlessly.
- **Decision needed**: Keep `infra/scripts/batch-embed.ts` as a manual-trigger tool for bulk operations (e.g., model upgrades) once the cron exists? Recommendation: yes — manual one-off backfills are still a legitimate need.

---

## Phase 3 — Batch embedding at confirm time + restaurant-vector debouncing

**Goal:** Collapse N OpenAI calls + N UPDATEs per menu confirm into 1 + 1. Move `update_restaurant_vector` off the synchronous path.
**Expected outcome:** 30-dish menu confirm goes from ~30s → 1-2s. Restaurant-vector firings drop from N×2 per confirm to ~1 per restaurant per active period.
**Risk:** Medium — touches confirm route hot path + custom RPC.
**Rollback:** Revert confirm route commit; drop new RPC; unschedule new cron; restore trigger to fire on INSERT.

### Tasks

- [ ] **3.1** Write migration `infra/supabase/migrations/133_restaurant_vector_dirty_flag.sql`:
  ```sql
  BEGIN;

  ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS restaurant_vector_dirty_at timestamptz;

  CREATE INDEX IF NOT EXISTS restaurants_dirty_idx
    ON restaurants(restaurant_vector_dirty_at)
    WHERE restaurant_vector_dirty_at IS NOT NULL;

  CREATE OR REPLACE FUNCTION public._trg_after_dish_embedded()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    IF OLD.embedding IS DISTINCT FROM NEW.embedding AND NEW.embedding IS NOT NULL THEN
      UPDATE restaurants
        SET restaurant_vector_dirty_at = now()
        WHERE id = NEW.restaurant_id
          AND (restaurant_vector_dirty_at IS NULL
               OR restaurant_vector_dirty_at < now() - interval '1 minute');
    END IF;
    RETURN NEW;
  END;
  $$;

  SELECT cron.schedule(
    'restaurant-vector-recompute',
    '*/2 * * * *',
    $$
    SELECT update_restaurant_vector(id)
    FROM restaurants
    WHERE restaurant_vector_dirty_at IS NOT NULL;

    UPDATE restaurants
    SET restaurant_vector_dirty_at = NULL
    WHERE restaurant_vector_dirty_at IS NOT NULL;
    $$
  );

  COMMIT;
  ```
- [ ] **3.2** Write reverse migration `133_REVERSE_ONLY_*` — unschedule cron, restore old `_trg_after_dish_embedded` body (calling RPC directly), drop column + index.
- [ ] **3.3** Write migration `infra/supabase/migrations/134_dish_embeddings_batch_rpc.sql`:
  ```sql
  BEGIN;

  CREATE OR REPLACE FUNCTION update_dish_embeddings_batch(p_rows jsonb)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = extensions, public
  AS $$
  BEGIN
    UPDATE dishes d
    SET embedding = (r->>'embedding')::vector,
        enrichment_status = 'completed'
    FROM jsonb_array_elements(p_rows) AS r
    WHERE d.id = (r->>'id')::uuid;
  END;
  $$;

  GRANT EXECUTE ON FUNCTION update_dish_embeddings_batch TO service_role;

  COMMIT;
  ```
- [ ] **3.4** Write migration `infra/supabase/migrations/135_narrow_enrich_trigger.sql` — narrow `trg_enrich_on_dish_change` to fire only on UPDATE OF name, description (INSERTs handled inline by confirm route):
  ```sql
  BEGIN;

  DROP TRIGGER IF EXISTS trg_enrich_on_dish_change ON public.dishes;

  CREATE TRIGGER trg_enrich_on_dish_change
    AFTER UPDATE OF name, description ON public.dishes
    FOR EACH ROW
    WHEN (OLD.name IS DISTINCT FROM NEW.name
          OR OLD.description IS DISTINCT FROM NEW.description)
    EXECUTE FUNCTION _trg_notify_enrich_dish();

  COMMIT;
  ```
- [ ] **3.5** Update `apps/web-portal/app/api/menu-scan/confirm/route.ts`:
  - After each INSERT batch, collect newly-inserted non-parent, non-template dish data.
  - Build `embedding_input` text per dish (extract the function from `enrich-dish/index.ts:233-301`; put in `apps/web-portal/lib/embedding/buildEmbeddingInput.ts` for now, accept that the Edge Function still has its own copy).
  - Single OpenAI embeddings call with array.
  - Single RPC call: `supabase.rpc('update_dish_embeddings_batch', { p_rows })`.
- [ ] **3.6** Update `infra/scripts/batch-embed.ts` to use `update_dish_embeddings_batch` for batched re-embedding instead of per-dish UPDATEs.
- [ ] **3.7** Apply migrations 133 + 134 + 135.
- [ ] **3.8** Deploy web-portal.
- [ ] **3.9** Smoke test — confirm 5-dish menu, verify:
  - Exactly 1 OpenAI embeddings call in network logs (admin app or Vercel logs).
  - Exactly 1 batched UPDATE in `pg_stat_statements`.
  - Restaurant marked dirty.
  - Within 2 min, cron clears the dirty flag and recomputes centroid.
- [ ] **3.10** Edit-path test — rename a dish's name in admin UI. Verify `trg_enrich_on_dish_change` fires, `enrich-dish` runs, embedding updates.

### Acceptance criteria

- 30-dish menu confirm completes end-to-end in <3 seconds.
- `pg_stat_statements` shows per-dish UPDATEs dropping to near-zero `calls/hour`.
- Both crons running, mostly idle, with active runs correlating to admin activity.
- Restaurant vectors stay fresh (max 2 min staleness).
- Edits to name/description still trigger re-embedding.

### Open questions

- **Decision needed**: Extract `buildEmbeddingInput` into a shared package or copy-paste? Recommendation: copy-paste for now — only 2 callers, extract if a 3rd appears.
- **Decision needed**: Per-statement vs per-row debounce inside the dirty-flag trigger? The current plan uses a per-row trigger with an `IS NULL OR < 1 min` guard. For a batched UPDATE of 30 rows, the first row writes the flag, the next 29 short-circuit on the guard. Per-statement would also work but requires using a STATEMENT-level trigger with `REFERENCING NEW TABLE AS` semantics. Recommendation: per-row with guard — simpler.

---

## Phase 4 — HNSW partial index for the consumer feed

**Goal:** Eliminate the dominant read-IOPS source — sequential scan of all dish embeddings per feed request.
**Expected outcome:** Feed query latency 500-1500ms → 50-150ms. Read IOPS drops ~10×.
**Risk:** Medium — concurrent index build is IOPS-intensive; planner may need help to use the new index.
**Rollback:** Drop the index. Feed reverts to seq-scan.

### Tasks

- [ ] **4.1** Schedule low-traffic window (e.g., 03:00 local time).
- [ ] **4.2** Run during window:
  ```sql
  CREATE INDEX CONCURRENTLY dishes_embedding_hnsw_idx
    ON dishes
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE status = 'published'
      AND is_parent = false
      AND is_template = false
      AND enrichment_status = 'completed';
  ```
  Expect 5-15 min build time on Pro tier.
- [ ] **4.3** `ANALYZE dishes;`
- [ ] **4.4** `EXPLAIN ANALYZE` a representative `generate_candidates` call (script the query with a real preference_vector and known location). Confirm `Index Scan using dishes_embedding_hnsw_idx` appears in the plan.
- [ ] **4.5** If planner falls back to seq-scan due to the `CASE WHEN p_preference_vector IS NOT NULL` wrapper in the ORDER BY: write migration `136_planner_friendly_candidates.sql` that splits `generate_candidates` (and `get_group_candidates`) into two code paths — one with raw `ORDER BY (embedding <=> p_vector)` when preference_vector is non-null, one without.
- [ ] **4.6** Repeat 4.4 for `get_group_candidates`.
- [ ] **4.7** Monitor feed p99 latency for 24h in Supabase Edge Function logs.
- [ ] **4.8** Optional: try setting `hnsw.ef_search = 100` in the RPC function body and compare recall@200 vs latency at default `ef_search = 40`.

### Acceptance criteria

- `EXPLAIN ANALYZE` confirms HNSW index in use for both `generate_candidates` and `get_group_candidates`.
- p99 feed call latency drops to <200ms.
- Read IOPS shows another visible step-down.
- No regression in feed result quality (sample comparison of top-20 dishes before/after for known users).

### Open questions

- **Decision pending EXPLAIN result**: planner-friendly RPC rewrite needed or not.
- **Decision pending data**: optimal `ef_search` value — default vs 100 vs higher.

---

## Phase 5 — Schema cleanup

**Goal:** Remove dead columns, indexes, and triggers now that they have no consumers.
**Expected outcome:** Cleaner schema, slightly smaller row width.
**Risk:** Very low — drops only confirmed-unused state. Wait 1+ week after Phase 4 stabilizes.
**Rollback:** Restore from backup if needed; drops are forward-only.

### Tasks

- [ ] **5.1** Write migration `infra/supabase/migrations/137_record_webhook_trigger_drop.sql` — idempotent record of the Phase 1 live drop:
  ```sql
  DROP TRIGGER IF EXISTS "WEBHOOK_SECRET" ON public.dishes;
  ```
- [ ] **5.2** Write migration `infra/supabase/migrations/138_drop_dead_enrichment_columns.sql`:
  ```sql
  BEGIN;

  ALTER TABLE dishes
    DROP COLUMN IF EXISTS enrichment_payload,
    DROP COLUMN IF EXISTS enrichment_review_status,
    DROP COLUMN IF EXISTS embedding_input,
    DROP COLUMN IF EXISTS enrichment_source,
    DROP COLUMN IF EXISTS enrichment_confidence;

  DROP INDEX IF EXISTS dishes_enrichment_review_status_idx;

  COMMIT;
  ```
- [ ] **5.3** Regenerate types: `supabase gen types typescript --linked > packages/database/src/types.ts`.
- [ ] **5.4** Remove `enrichment_source`/`enrichment_confidence` writes from `apps/web-portal/app/api/menu-scan/confirm/route.ts:375-376`.
- [ ] **5.5** Remove `enrichment_source`/`enrichment_confidence` fields from `apps/web-portal/lib/menu-scan.ts`.
- [ ] **5.6** Run `supabase inspect db unused-indexes`. Audit each flagged index for any code reference; drop those confirmed unused (one-line migration per drop).
- [ ] **5.7** Verify all apps build clean: `turbo build` `turbo check-types` `turbo lint`.

### Acceptance criteria

- `\d dishes` shows the slimmer column set.
- No TypeScript compile errors.
- All apps build and lint clean.

### Open questions

None.

---

## Overall verification

After each phase, capture:

```sql
SELECT substring(query, 1, 80) AS q, calls,
       round(mean_exec_time::numeric, 2) AS mean_ms,
       round(total_exec_time::numeric, 0) AS total_ms,
       shared_blks_read
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;
```

Expected progression:

| Phase | What should drop out of top 10 |
|---|---|
| 1 | The `UPDATE dishes SET enrichment_status='pending'` query (was 57%) |
| 2 | gpt-4o-mini-related lookups (parent ingredients, options, courses loads) |
| 3 | Per-dish dish UPDATEs — replaced by infrequent batched UPDATE |
| 4 | Sequential scan on `dishes.embedding` from `generate_candidates` |

Dashboard graphs to watch:
- **Disk IO % consumed**: trends down each phase.
- **Database CPU**: drops after Phase 4 most visibly.
- **Feed Edge Function p99 latency**: drops sharply after Phase 4.

Cron monitoring (after Phase 2 + 3):

```sql
SELECT command,
       percentile_disc(0.5)  WITHIN GROUP (ORDER BY end_time - start_time) AS p50,
       percentile_disc(0.99) WITHIN GROUP (ORDER BY end_time - start_time) AS p99,
       count(*) AS runs_24h
FROM cron.job_run_details
WHERE start_time > now() - interval '24 hours'
GROUP BY command;
```

Healthy state: idle runs <10ms, active runs <500ms.

---

## Open items requiring user input

1. When to start Phase 1 — any time ok; ideally a window where you can monitor for ~1 hour after deploy.
2. When to schedule Phase 4 — needs a low-traffic window for the concurrent index build.
3. Who runs migrations and deploys — locally or via CI? Affects whether commit message convention should reference deploy commands.

> **Deferred decision (revisit before public launch):** rotate the service-role JWT. The key was exposed via the `WEBHOOK_SECRET` trigger definition (now dropped in Phase 1) and in chat history. Risk is currently low (no public endpoint to abuse, narrow attack surface to this one project). Rotating now would force all users to re-login and require a coordinated mobile rebuild. See conversation history 2026-05-15 for the rotation procedure when ready.

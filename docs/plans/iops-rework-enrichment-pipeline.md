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

| # | Commit | Migration # | Phase | PR |
|---|---|---|---|---|
| 1 | `fix(enrich-dish): remove redundant pending UPDATE and restaurant_vector RPC` | — | 1 | 1 |
| 2 | `chore(db): drop WEBHOOK_SECRET trigger on dishes` | live SQL + 138 in Phase 5 | 1 | live + 5 |
| 3 | `feat(db): Vault-based auth for _trg_notify_enrich_dish` | 132 | 1.5 | 1.5 |
| 4 | `refactor(enrich-dish): strip to embedding-only; remove gpt-4o-mini call` | — | 2 | 2 |
| 5 | `feat(db): embed-recovery-tick cron` (no separate batch fn — cron calls enrich-dish directly) | 133 | 2 | 2 |
| 6 | `feat(db): restaurant_vector_dirty_at + recompute cron` | 134 | 3 | 3 |
| 7 | `feat(db): update_dish_embeddings_batch RPC` | 135 | 3 | 3 |
| 8 | `refactor(db): narrow trg_enrich_on_dish_change to UPDATE-only` | 136 | 3 | 3 |
| 9 | `feat(web-portal): batched embedding at menu-scan confirm time` | — | 3 | 3 |
| 10 | `feat(db): HNSW partial index on dishes.embedding` | (CONCURRENTLY, no migration) | 4 | 4 |
| 11 | `refactor(db): generate_candidates planner-friendly ORDER BY` (if needed) | 137 | 4 | 4 |
| 12 | `chore(db): record WEBHOOK_SECRET trigger drop` | 138 | 5 | 5 |
| 13 | `chore(db): drop dead enrichment columns` | 139 | 5 | 5 |

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

- [x] **2.1** Stripped `infra/supabase/functions/enrich-dish/index.ts` to embedding-only — 577 → 287 lines. AI helpers (`enrichWithAI`, completeness/confidence eval, related types) removed. `buildEmbeddingInput` simplified. Dead fields no longer written to dishes. Parent ingredient loading kept (variant embedding quality). Strict service-role auth check added in-function.
- [x] **2.2** N/A (symlink — 2.1 covers both paths).
- [ ] **2.3** Update `infra/scripts/batch-embed.ts` — **DEFERRED.** Script still functional with the old response shape; will log `undefined` for the removed fields but won't break. Update at next-touch (e.g., when running a manual backfill).
- [x] **2.4** ~~Write new Edge Function `embed-dish-batch`~~ — Skipped per design decision; cron calls enrich-dish directly via pg_net.
- [x] **2.5** Migration `133_embed_recovery_cron.sql` written — partial index `dishes_pending_embed_idx`, stored function `_cron_embed_recovery_tick()` reading `enrich_dish_service_key` from Vault, cron schedule `*/5 * * * *`.
- [x] **2.6** Reverse migration `133_REVERSE_ONLY_embed_recovery_cron.sql` written.
- [x] **2.7** Deployed `enrich-dish` — completed 2026-05-15.
- [x] **2.8** Migration 133 applied — completed 2026-05-15.
- [x] **2.9** Live-path smoke test green — Flat white dish bumped via description UPDATE, trigger fired, enrich-dish returned 200, dish landed back at `completed` with embedding.
- [x] **2.10** Force-failure cron test green — manually broken dish recovered via cron within 5 min, `cron.job_run_details` shows `succeeded`.

### Acceptance criteria

- `enrich-dish` Edge Function is ~150 lines.
- Normal menu confirm produces exactly one OpenAI call per dish (the embeddings call), zero gpt-4o-mini calls.
- Force-failed dish recovers automatically within 5 min.
- `cron.job_run_details` shows `embed-recovery-tick` mostly idle when no failures are pending.

### Open questions

- **Decision needed**: Keep `enrichment_review_status` column for a possible future admin review UI? Recommendation: yes, defer dropping it until Phase 5. The Edge Function stops writing it now; column stays harmlessly.
- **Decision needed**: Keep `infra/scripts/batch-embed.ts` as a manual-trigger tool for bulk operations (e.g., model upgrades) once the cron exists? Recommendation: yes — manual one-off backfills are still a legitimate need.

---

## Phase 3 — Restaurant-vector debouncing + trigger drift fix (Slice A only)

**Goal:** Move `update_restaurant_vector` off the synchronous embedding-write path so a 30-dish menu confirm causes 1 centroid recompute per ~2 min instead of 30. Also record the missing `CREATE TRIGGER` statements in migrations.
**Expected outcome:** Restaurant-vector RPC firings drop from N (one per dish embedded) to 1 per restaurant per ~2 min. Fresh-env migration apply now correctly attaches enrichment triggers.
**Risk:** Low — DB-only changes, no app code touched, all four triggers already exist in production (we're just recording them).
**Rollback:** Apply 134_REVERSE_ONLY + 135_REVERSE_ONLY.

### Scope reduction (2026-05-15)

The original Phase 3 plan assumed `apps/web-portal/app/api/menu-scan/confirm/route.ts` was the active path. Investigation revealed:

- The active path is `apps/admin/src/app/(admin)/menu-scan/actions/menuScan.ts` (`adminConfirmMenuScan` server action).
- Admin's flow is already async: batch INSERTs dishes, returns; trigger fires enrich-dish per dish in background. The user doesn't wait for embeddings.
- This invalidates the "30s → 1-2s" headline win — confirm is already fast.
- `apps/web-portal-v2` calls `confirm_menu_scan` RPC (migration 121); deferred for now.

Slice A (this phase) does the DB-side debouncing and the trigger drift fix. Slice B (batched embedding endpoint + admin code changes) is deferred indefinitely — async trigger path is fine until proven otherwise.

### Tasks

- [x] **3.1** Migration `134_restaurant_vector_dirty_flag.sql` — adds dirty flag column + partial index, replaces `_trg_after_dish_embedded` to write the flag with 1-min per-row debounce, creates `_cron_restaurant_vector_recompute()` worker, schedules cron `*/2 * * * *`.
- [x] **3.2** Reverse migration `134_REVERSE_ONLY_*` — unschedule cron, drop worker, restore prior trigger body, drop index + column.
- [x] **3.3** Migration `135_record_enrich_dish_triggers.sql` — records the four production triggers (`trg_enrich_on_dish_change` on dishes; `after_dish_embedded` on dishes; `trg_enrich_on_ingredient_change` on dish_ingredients; `trg_enrich_on_option_group_change` on option_groups). Idempotent via `DROP IF EXISTS` + `CREATE`.
- [x] **3.4** Reverse migration `135_REVERSE_ONLY_*` — drops all four.
- [x] **3.5** Migrations 134 + 135 applied — completed 2026-05-16.
- [x] **3.6** Smoke test passed — trigger fires correctly, dirty flag gets written, cron picks it up and clears.
- [x] **3.7** Multi-dish test passed — single dirty-flag write coalesces multiple embedding changes per restaurant.

### Slice B — DEFERRED (not in this phase)

These were original plan tasks 3.3-3.8. Deferred unless we observe specific need:

- ~~Migration `136_dish_embeddings_batch_rpc.sql` (was 134)~~
- ~~Migration `137_narrow_enrich_trigger.sql` (was 135) — narrow trigger to UPDATE-only~~
- ~~Update admin's `adminConfirmMenuScan` to do batched embedding at confirm time~~
- ~~Update web-portal-v2 RPC if applicable~~
- ~~Update `infra/scripts/batch-embed.ts` to use new RPC~~

### Acceptance criteria

- After applying 134: `_trg_after_dish_embedded` writes `restaurant_vector_dirty_at` rather than calling the RPC directly.
- After applying 135: a fresh `supabase db reset` or equivalent attaches all four triggers correctly.
- 30 dish embedding writes in the same minute result in 1 `restaurant_vector_dirty_at` write on the parent restaurant (29 short-circuit on debounce guard).
- `cron.job_run_details` shows `restaurant-vector-recompute` mostly idle, with sub-200ms runs when active.
- `update_restaurant_vector` `calls/hour` in `pg_stat_statements` drops by ≥80% vs pre-Phase-3 baseline.

### Open questions

- None remaining for Slice A.

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

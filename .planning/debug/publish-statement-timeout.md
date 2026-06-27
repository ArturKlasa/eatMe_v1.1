---
slug: publish-statement-timeout
status: fix-applied
trigger: |
  Publishing a restaurant (and confirming a large menu scan) intermittently fails
  with Postgres "canceling statement due to statement timeout". Happens on larger
  menus (sucursales / multi-page scans); small menus publish fine.
created: 2026-06-26
updated: 2026-06-26
---

# Debug: publish / confirm "statement timeout"

## Symptoms
- **Expected:** Publishing a restaurant (or confirming a menu scan) completes quickly.
- **Actual:** Intermittently hangs, then errors with `canceling statement due to statement timeout`.
- **Error:** Postgres `57014` — `canceling statement due to statement timeout`.
- **Timeline:** Surfaces on large menus; correlated with dish count × modifier-group count.
- **Reproduction:** Confirm a large scanned menu, or publish a restaurant that has many draft dishes.

## Current Focus
- hypothesis: Per-row SECURITY DEFINER triggers fan out vault-decrypt + `net.http_post`
  inside one PostgREST statement; on large menus the cumulative per-row work exceeds
  the role's `statement_timeout`.
- next_action: Decide fix scope, write migration(s), apply to prod, re-test large publish.

## Evidence (code-traced)
- timestamp 2026-06-26: `_trg_invalidate_feed_cache` (migration 176) is
  `AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW` with **full-row** scope on
  `restaurants` / `menus` / `dishes`. Each fired row does
  `SELECT decrypted_secret FROM vault.decrypted_secrets` + `net.http_post`.
- timestamp 2026-06-26: `_trg_notify_enrich_dish` (migration 132) runs
  `UPDATE dishes SET enrichment_status='pending' WHERE id = v_dish_id` (132:82)
  inside the AFTER-INSERT trigger. Because the invalidate trigger is full-row and
  unscoped, that self-UPDATE **re-fires** `_trg_invalidate_feed_cache` → a second
  vault-decrypt + `net.http_post` per dish.
- timestamp 2026-06-26: Net effect per inserted dish ≈ 3× (vault decrypt + net.http_post)
  + 1 extra UPDATE; option_group inserts add more enrich cycles. Confirm RPC
  `admin_confirm_menu_scan` (migration 163) does all dish/group/option inserts in one
  transaction → O(N) fan-out in a single statement.
- timestamp 2026-06-26: Publish path `apps/admin/src/app/(admin)/restaurants/[id]/actions/restaurant.ts:62-68`
  is one `UPDATE dishes SET status='published' ... .select('id')` — flips every draft
  dish, each firing the full-row invalidate trigger (status update does NOT match
  enrich's `UPDATE OF name, description`, so enrich is skipped on publish — invalidate
  is the dominant cost there).
- timestamp 2026-06-26: `invalidate-cache/index.ts` is a **flush-all** of `feed:v2:*`
  (its own comment: the feed key is restaurant-agnostic, so a single edit can't be
  scoped). The per-restaurant key bust is explicitly "best-effort / legacy". → the
  trigger does not actually need per-row NEW/OLD for the correctness guarantee.
- timestamp 2026-06-26: Migration 176 header warns the legacy dashboard Database
  Webhook for invalidate-cache must be DISABLED at apply time or every write fires
  the cache flush TWICE. If still enabled in prod, per-row HTTP work is doubled.

## Eliminated
- hypothesis: The plpgsql insert loop itself is too slow → unlikely; set-based inserts
  of ~70 rows are sub-second. The cost is in the per-row trigger fan-out, not the loop.
- hypothesis: `net.http_post` blocks on the HTTP response → no; pg_net enqueues async.
  The cost is the volume of enqueues + per-row vault decrypts + the cascading self-UPDATE,
  not waiting on responses.

## Resolution
- root_cause: Per-row, full-row `_trg_invalidate_feed_cache` (mig 176) + `_trg_notify_enrich_dish`
  self-UPDATE re-trigger (mig 132) produce O(N)–O(3N) vault-decrypt + net.http_post work
  inside a single PostgREST statement (confirm RPC / publish UPDATE). On large menus this
  exceeds `statement_timeout` (57014). The invalidate flush is restaurant-agnostic, so the
  per-row firing is unnecessary work.
- fix: Option A (targeted). Migration 177 replaces the migration-176 FOR EACH ROW
  invalidate triggers with STATEMENT-level triggers backed by transition tables:
  restaurants flush once per statement; menus/dishes flush only when a 'published'
  row is involved (drafts skipped → confirm flushes nothing); a `pg_trigger_depth()>1`
  guard makes the enrich self-UPDATE a no-op so it can't cascade. Per-restaurant
  cache keys dropped (confirmed dead — written by invalidate-cache, read by nothing).
  Publish → O(1) http_post; confirm invalidate fan-out → 0. Enrich trigger untouched.
- verification:
  - 2026-06-27 STEP 1 DONE — 177 applied to prod; trigger probe confirms
    fn_stmt_exists=true, old_row_triggers_gone=true, all 7 invalidate triggers are
    STATEMENT-level + enabled (dishes/menus insert+update+delete, restaurants change).
    Clean compile confirms transition-tables-under-search_path='' is fine.
  - STEP 2 PENDING — re-publish a large sucursal menu to confirm the timeout is gone.
  - STEP 3 PENDING — confirm the legacy dashboard Database Webhook for invalidate-cache
    is disabled (else it keeps firing per-row).
- files_changed:
  - infra/supabase/migrations/177_invalidate_cache_statement_level.sql
  - infra/supabase/migrations/177_REVERSE_ONLY_invalidate_cache_statement_level.sql

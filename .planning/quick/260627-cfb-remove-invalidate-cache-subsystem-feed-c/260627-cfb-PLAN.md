---
quick_id: 260627-cfb
slug: remove-invalidate-cache-subsystem-feed-c
description: Remove invalidate-cache subsystem; feed cache goes TTL-only
date: 2026-06-27
mode: quick
status: planned
---

# Quick Task 260627-cfb: Remove the invalidate-cache subsystem

## Goal

Retire the discovery-feed cache-busting subsystem. The `feed` edge function keeps
its Redis cache (heavy PostGIS + pgvector RPC — worth caching) but it now expires
**purely by the 300s TTL**. We remove the DB triggers + functions that fire
`net.http_post` to the `invalidate-cache` edge function, delete that edge function,
and clean up two now-stale comments that name it.

**Accepted tradeoff (user-confirmed):** newly published/suspended restaurants and
dish/price edits take up to 5 min to reflect in the *discovery feed*. The mobile
restaurant-detail screen reads `dishes` live from Postgres (uncached), so menu
accuracy is unaffected.

## Why this is safe

- Only `feed` (read/write) and `invalidate-cache` (delete) touch Redis. Removing
  the busting half leaves `feed` as a clean TTL cache.
- The triggers (migration 177, statement-level) are the *only* caller of
  `invalidate-cache` (the legacy dashboard Database Webhook is confirmed disabled).
  Dropping them orphans the edge function.
- The per-restaurant keys (`restaurant:{id}`, `restaurant:cuisines:{id}`) are dead
  (written only by invalidate-cache, read by nothing).
- Migrations 176/177 stay as historical record — never edit applied migrations;
  178 supersedes.

## Tasks

### Task 1 — Migration 178: drop triggers + functions
**Files:** `infra/supabase/migrations/178_drop_invalidate_cache.sql` (new),
`infra/supabase/migrations/178_REVERSE_ONLY_drop_invalidate_cache.sql` (new)
- **178 forward:** DROP the 7 statement-level triggers created by mig 177
  (restaurants change; menus insert/update/delete; dishes insert/update/delete),
  then DROP `public._trg_invalidate_feed_cache_stmt()` and the legacy
  `public._trg_invalidate_feed_cache()`. Wrapped in BEGIN/COMMIT, idempotent
  (DROP ... IF EXISTS).
- **178 reverse:** Recreate the pre-178 (== migration-177) state — both functions
  verbatim from 176/177 + the 7 statement-level triggers with their transition
  tables. Restores the cheap busting setup, not the slow row-level one.
- **verify:** Files parse; trigger/function names match mig 177 exactly.
- **done:** Both SQL files exist and are internally consistent.

### Task 2 — Delete the invalidate-cache edge function
**Files:** `infra/supabase/functions/invalidate-cache/index.ts`,
`infra/supabase/functions/invalidate-cache/__tests__/delete-path.test.ts` (delete dir)
- Remove the whole `infra/supabase/functions/invalidate-cache/` directory.
- **verify:** `find infra/supabase/functions/invalidate-cache` returns nothing.
- **done:** Directory gone; no source references remain except historical migrations.

### Task 3 — Clean stale comments
**Files:** `infra/supabase/functions/feed/index.ts` (~line 740),
`infra/supabase/functions/_shared/cors.ts` (line 3-4)
- `feed/index.ts`: reword the `feed:v2:` prefix comment — no longer "so
  invalidate-cache's flush matches"; now "TTL-only, expires via the 300s TTL".
- `cors.ts`: drop `invalidate-cache` from the "(feed, enrich-dish, invalidate-cache)"
  consumer list.
- **verify:** `grep -ri invalidate.cache infra/supabase/functions` returns only
  nothing under non-migration source (migrations keep their history).
- **done:** No live edge-function source names the removed function.

## Out-of-band (user, prod — not done by this task)
1. Apply `178_drop_invalidate_cache.sql` in the Supabase SQL editor.
2. `supabase functions delete invalidate-cache` (undeploy).
3. (Optional) remove the `invalidate_cache_service_key` Vault secret — dead after this.

## must_haves
- truths:
  - The feed cache still functions (read/write) and expires by 300s TTL.
  - No live edge-function source calls invalidate-cache after this task.
  - Migration 178 is reversible to the exact migration-177 state.
- artifacts:
  - `infra/supabase/migrations/178_drop_invalidate_cache.sql`
  - `infra/supabase/migrations/178_REVERSE_ONLY_drop_invalidate_cache.sql`
  - `infra/supabase/functions/invalidate-cache/` deleted
- key_links:
  - `infra/supabase/migrations/177_invalidate_cache_statement_level.sql` (what 178 undoes)
  - `infra/supabase/functions/feed/index.ts:742` (cache key — unchanged behavior)

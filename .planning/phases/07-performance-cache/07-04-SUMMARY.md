---
phase: 07-performance-cache
plan: 04
subsystem: backend-cache-invalidation
tags: [supabase, migrations, edge-function, redis, cache, vault, pg_net]
requires: ["07-01"]
provides:
  - "migration 176 (forward + REVERSE): tracked feed-cache invalidation triggers"
  - "invalidate-cache DELETE-path old_record fallback"
affects:
  - infra/supabase/migrations/
  - infra/supabase/functions/invalidate-cache/
tech-stack:
  added: []
  patterns:
    - "net.http_post + vault.decrypted_secrets backend→edge trigger auth (migration 132/135 precedent)"
    - "fire-and-forget trigger (PERFORM + NULL-guard fail-soft, never blocks the write)"
    - "REVERSE_ONLY migration pairing (stage-don't-apply)"
key-files:
  created:
    - infra/supabase/migrations/176_invalidate_cache_triggers.sql
    - infra/supabase/migrations/176_REVERSE_ONLY_invalidate_cache_triggers.sql
  modified:
    - infra/supabase/functions/invalidate-cache/index.ts
decisions:
  - "D-08: keep feed:v2:* flush-all unchanged; documented as deliberate (restaurant-agnostic key, operator-rare writes, 5-min TTL)"
  - "D-09: codify dashboard webhook as a tracked public-schema net.http_post trigger; widen to INSERT/UPDATE/DELETE"
  - "D-10: CORS confirmed wired via buildCorsHeaders (confirmation only, no new code)"
metrics:
  duration: ~3 min
  completed: 2026-06-21
status: complete
---

# Phase 07 Plan 04: Cache-Invalidation Triggers (Codify + Widen) Summary

Codified the dashboard-configured feed-cache invalidation webhook as a tracked migration-176 `net.http_post` + Vault trigger and widened coverage from UPDATE-only to INSERT/UPDATE/DELETE on restaurants/menus/dishes, plus made `invalidate-cache` resolve the per-restaurant key from `old_record` on DELETE — staged (forward + REVERSE), not applied.

## What Was Built

**Task 1 — migration 176 forward** (`454de03`): `public._trg_invalidate_feed_cache()` SECURITY DEFINER trigger fn copying the migration-132 skeleton — reads the service-role JWT from `vault.decrypted_secrets` by name `invalidate_cache_service_key` (secret NAME only, never a literal), NULL-guards with `RAISE WARNING` + `RETURN COALESCE(NEW, OLD)` (fire-and-forget, never blocks the write), and fires `net.http_post` to `.../functions/v1/invalidate-cache` with the `{type,table,schema,record,old_record}` body shape the function parses (record null on DELETE, old_record null on INSERT). Three idempotent `AFTER INSERT OR UPDATE OR DELETE` FOR EACH ROW triggers on restaurants/menus/dishes. Header carries the Vault `vault.create_secret(...)` per-environment prerequisite + the dashboard-webhook-disable (double-flush) warning. No `supabase_functions.http_request`, no JWT literal, no `db push`.

**Task 2 — migration 176 REVERSE** (`a41e239`): drops the 3 triggers (reverse order: dishes, menus, restaurants) then `DROP FUNCTION IF EXISTS public._trg_invalidate_feed_cache()`. Header warns rollback reverts the feed to TTL-only (5 min) staleness unless the dashboard webhook is re-created; controlled rollback only.

**Task 3 — invalidate-cache/index.ts** (`001055e`): three minimal edits, no logic restructure —
1. DELETE-path fallback: `const record = body.record ?? body.old_record ?? {}` so the best-effort per-restaurant key resolves on DELETE.
2. Strengthened the D-08 flush-all comment to explicitly reconcile SC#4's "never flush-all" as a DELIBERATE choice (restaurant-agnostic key, operator-rare writes, 5-min TTL, event-independent correctness guarantee). The `deleteByPattern(redis, 'feed:v2:*')` call is unchanged.
3. Header corrected from "on UPDATE events" to INSERT/UPDATE/DELETE; payload doc notes record null on DELETE, old_record null on INSERT.
4. D-10 CORS confirmed: `buildCorsHeaders` import + per-request wiring present (grep assertion only, no code change).

## Verification

- Migration 176 forward: `net.http_post` + `vault.decrypted_secrets` + `invalidate_cache_service_key` + function URL present; exactly 3 `AFTER INSERT OR UPDATE OR DELETE` triggers; zero `supabase_functions.http_request` in executable SQL; zero `eyJ` JWT literal; zero `db push`. PASS.
- Migration 176 REVERSE: exactly 3 `DROP TRIGGER IF EXISTS trg_invalidate_cache_on_*` + `DROP FUNCTION IF EXISTS public._trg_invalidate_feed_cache`; `NNN_REVERSE_ONLY_` naming. PASS.
- `deno check infra/supabase/functions/invalidate-cache/index.ts` exits 0. PASS.
- `body.record ?? body.old_record`, `buildCorsHeaders`, `deleteByPattern(redis, 'feed:v2:*')` all present. PASS.
- Plan-01 DELETE-path harness (`delete-path.test.ts`): 3 passed, 0 failed. PASS.

The 9-row trigger-catalog assertion (3 tables × 3 events via `information_schema.triggers`) is OPERATOR-GATED and deferred to the Plan 05 handoff — it only reflects truth after apply (stage-don't-apply).

## Deviations from Plan

**1. [Rule 3 - Blocking] Reworded a header comment to satisfy the automated verify grep**
- **Found during:** Task 1 verification
- **Issue:** The plan's verify command `grep -cE "AFTER INSERT OR UPDATE OR DELETE" | grep -qx 3` counted 4 matches because a descriptive header comment also contained the literal phrase "AFTER INSERT OR UPDATE OR DELETE", causing the exactly-3 trigger-count assertion to fail.
- **Fix:** Reworded the comment to "Each trigger is AFTER (insert/update/delete)…" so only the 3 actual `CREATE TRIGGER` definitions match. No SQL behavior change.
- **Files modified:** infra/supabase/migrations/176_invalidate_cache_triggers.sql
- **Commit:** 454de03

## Self-Check: PASSED

- FOUND: infra/supabase/migrations/176_invalidate_cache_triggers.sql
- FOUND: infra/supabase/migrations/176_REVERSE_ONLY_invalidate_cache_triggers.sql
- FOUND: infra/supabase/functions/invalidate-cache/index.ts
- FOUND commit 454de03, a41e239, 001055e

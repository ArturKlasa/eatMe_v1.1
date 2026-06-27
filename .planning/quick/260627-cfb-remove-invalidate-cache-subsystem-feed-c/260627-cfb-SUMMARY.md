---
quick_id: 260627-cfb
slug: remove-invalidate-cache-subsystem-feed-c
description: Remove invalidate-cache subsystem; feed cache goes TTL-only
date: 2026-06-27
status: complete
code_commit: 4e4a86f
---

# Quick Task 260627-cfb — Summary

## What changed

Retired the discovery-feed cache-busting subsystem. The `feed` edge function keeps
its Redis cache but it now expires **purely by the 300s TTL** — no more early
invalidation on operator writes.

### Code (commit 4e4a86f)
- **`infra/supabase/migrations/178_drop_invalidate_cache.sql`** (new) — drops the 7
  statement-level invalidate triggers from mig 177 + both trigger functions
  (`_trg_invalidate_feed_cache_stmt`, legacy `_trg_invalidate_feed_cache`).
- **`infra/supabase/migrations/178_REVERSE_ONLY_drop_invalidate_cache.sql`** (new) —
  restores the exact migration-177 state (both functions + 7 statement-level
  triggers with transition tables).
- **`infra/supabase/functions/invalidate-cache/`** — deleted (index.ts + test).
- **`infra/supabase/functions/feed/index.ts`** — reworded the `feed:v2:` cache-key
  comment: TTL-only now, no buster. No logic change.
- **`infra/supabase/functions/_shared/cors.ts`** + **`README.md`** — dropped
  invalidate-cache from the SEC-01 importer lists.

## Why it's safe
- Only `feed` (read/write) + `invalidate-cache` (delete) touched Redis; removing the
  busting half leaves `feed` as a clean TTL cache. Cache read/write logic untouched
  (`feed/index.ts:747` get, `:1094` set ex:300).
- The mig-177 triggers were the only caller (dashboard webhook confirmed disabled in
  Phase 7, F-21) → deleting them orphans the edge function.
- Mobile restaurant-detail reads `dishes` live from Postgres (uncached) → menu
  accuracy never depended on this.
- Per-restaurant keys (`restaurant:{id}`, `restaurant:cuisines:{id}`) were dead.

## Accepted tradeoff (user-confirmed)
Newly published/suspended restaurants and dish/price edits take up to 5 min to
appear in the **discovery feed**. Acceptable in exchange for fewer moving parts.

## Verification
- `grep -ri invalidate.cache infra/supabase/functions` → only historical artifacts
  remain (a `feed/.planning/` checkpoint JSON); no live source references.
- Feed cache read/write logic intact and unchanged.

## Out-of-band operator steps (NOT done by this task — prod)
1. Apply `178_drop_invalidate_cache.sql` in the Supabase SQL editor.
2. `supabase functions delete invalidate-cache` (undeploy).
3. (Optional) remove the `invalidate_cache_service_key` Vault secret — dead after this.

## Follow-ups
- This completes the publish-statement-timeout debug thread's optional cleanup.
- Original operator issues still open: #3 (null/placeholder text), #4 (modifier
  price display), #5 (grams in description), #1 (branch copy-menu suggestion).

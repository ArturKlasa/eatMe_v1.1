---
status: partial
phase: 07-performance-cache
source: [07-VERIFICATION.md]
started: 2026-06-21
updated: 2026-06-21
---

## Current Test

Operator deploy actions to make Phase 7 fully live (code authored + verified; migrations partially applied).

## Tests

### 1. Trigger-catalog coverage (PERF-03 SC#4)
expected: `SELECT count(*) FROM information_schema.triggers WHERE trigger_name LIKE 'trg_invalidate_cache%';` returns 9
result: PASS — operator confirmed `row_count: 9` (all AFTER, restaurants/menus/dishes × INSERT/UPDATE/DELETE) in session 2026-06-21

### 2. Pre-cap present in live function (PERF-02 SC#3)
expected: applied `generate_candidates` body contains `WHERE ranked.rn <= 8`
result: PASS — operator applied migration 175 (final no-GUC version, commit 40aa09d) and benchmarked it in session 2026-06-21

### 3. Re-apply migration 176 (WR-02 search_path hardening)
expected: re-run `176_invalidate_cache_triggers.sql` (commit 1bf1a75) — idempotent CREATE OR REPLACE; the function now pins `SET search_path = ''`
result: [pending]

### 4. Deploy `feed` edge function
expected: `supabase functions deploy feed` — ships the tiered-radius loop (07-03) + the cache-key radius/mode/limit fix (CR-01). Until deployed, the tiered loop is NOT live.
result: [pending]

### 5. Deploy `invalidate-cache` edge function
expected: `supabase functions deploy invalidate-cache` — ships the DELETE `old_record` fallback (07-04). The flush-all already works on the prior deploy (smoke test 200), so feed correctness holds either way.
result: [pending]

## Summary

total: 5
passed: 2
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

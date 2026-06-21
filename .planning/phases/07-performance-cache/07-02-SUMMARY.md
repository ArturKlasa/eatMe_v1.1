---
phase: 07-performance-cache
plan: 02
subsystem: feed-ranking-sql
tags: [postgres, pgvector, hnsw, generate_candidates, migration, perf]
requires:
  - "infra/supabase/migrations/169_generate_candidates_pushdown.sql (body being extended)"
  - "infra/supabase/migrations/136_hnsw_dishes_embedding.sql (the HNSW index the GUC tunes)"
provides:
  - "Migration 175 forward: iterative_scan GUC (relaxed_order + 3 bounds) + per-restaurant ROW_NUMBER pre-cap K=8"
  - "Migration 175 REVERSE: RESET all 4 GUCs + restore verbatim 169 body"
affects:
  - "generate_candidates RPC (Stage-1 candidate generation for the mobile feed)"
tech-stack:
  added: []
  patterns:
    - "ALTER FUNCTION ... SET hnsw.* scopes pgvector GUCs to one function (self-restoring, no pooled-connection leak)"
    - "ROW_NUMBER() OVER (PARTITION BY ...) windowed-subquery pre-cap inside a MATERIALIZED CTE before the global ORDER BY + LIMIT"
key-files:
  created:
    - "infra/supabase/migrations/175_generate_candidates_precap_iterative_scan.sql"
    - "infra/supabase/migrations/175_REVERSE_ONLY_generate_candidates_precap_iterative_scan.sql"
  modified: []
decisions:
  - "K=8 per-restaurant pre-cap (D-07 range 5-10): >2.5x the JS applyDiversity max-3 cap, behavior-preserving"
  - "iterative_scan = relaxed_order (D-05): order re-imposed by the CTE + outer ORDER BY, JS Stage-2 re-scores anyway"
  - "ef_search=400 (>=2x p_limit=200), max_scan_tuples=20000, scan_mem_multiplier=2 — tunable starting points, operator-gated (D-04)"
  - "Multi-SET comma form as primary; per-GUC fallback documented as commented prose only (Pitfall-1)"
metrics:
  duration: "~30m"
  completed: "2026-06-21"
  tasks: 2
  files: 2
status: complete
---

# Phase 07 Plan 02: generate_candidates Pre-cap + iterative_scan GUC Summary

Authored migration 175 — the single coordinated D-11 change set to `generate_candidates`: the function-scoped `hnsw.iterative_scan = 'relaxed_order'` GUC (plus three companion bounds) fixes filtered-ANN under-return, and a per-restaurant `ROW_NUMBER()` pre-cap (K=8) inside the materialized `candidates` CTE bounds the Stage-1→Stage-2 handoff payload — both preserving the 32-column shape, the single round-trip, and the migration-167 open-hours fold. Authored + dry-run only (stage-don't-apply); operator applies to prod.

## What Was Built

### Task 1 — Forward migration 175 (commit c902c6f)
`infra/supabase/migrations/175_generate_candidates_precap_iterative_scan.sql`, wrapped in `BEGIN; … COMMIT;`:

- **PART (a) — iterative_scan GUC (D-04/D-05, PERF-01 SC#2):** `ALTER FUNCTION generate_candidates(<full 13-arg signature>)` with the multi-SET comma form setting `hnsw.iterative_scan = 'relaxed_order'`, `hnsw.max_scan_tuples = 20000`, `hnsw.scan_mem_multiplier = 2`, `hnsw.ef_search = 400`. The Pitfall-1 per-GUC fallback (one `ALTER FUNCTION … SET x = y;` per GUC) is documented as commented prose only. Each value carries an inline rationale comment and is flagged tunable.
- **PART (b) — per-restaurant pre-cap (D-06/D-07, PERF-02 SC#3):** `CREATE OR REPLACE FUNCTION generate_candidates(…)` (no DROP — signature/shape unchanged) re-emitting the migration-169 body with exactly one structural change: the inner SELECT of `candidates AS MATERIALIZED` is wrapped in a `ranked` subquery that adds `ROW_NUMBER() OVER (PARTITION BY d.restaurant_id ORDER BY <vector_distance proxy, popularity_score DESC, distance_m ASC>)`, filtered `WHERE ranked.rn <= 8` before the existing global `ORDER BY … LIMIT p_limit`. The window ORDER BY uses the underlying expressions (the `d.embedding <=> p_preference_vector` CASE, `COALESCE(da.popularity_score,0)`, `ST_Distance(...)`), not the OUT-param aliases, because `rn` is computed before the `ranked`-layer aliases exist.

Preserved verbatim from 169: the `#variable_conflict use_column` directive, the `r.open_hours/r.timezone/r.country_code` (167) fold, the entire LATERAL modifier-JSON block, the `reachable_proteins`/`reachable_protein_families` projection, and the outer ORDER BY on the bare column refs. No `DROP FUNCTION`, no apply step, no `supabase_functions.http_request`.

### Task 2 — REVERSE pair (commit 80e6af3)
`infra/supabase/migrations/175_REVERSE_ONLY_generate_candidates_precap_iterative_scan.sql`, wrapped in `BEGIN; … COMMIT;`, with a controlled-rollback warning header (mirrors 169_REVERSE + 170_REVERSE prose):

1. `ALTER FUNCTION generate_candidates(<13-arg signature>)` with four `RESET hnsw.*` clauses (the inverse of 175's SET).
2. `CREATE OR REPLACE FUNCTION generate_candidates(…)` restoring the **verbatim** migration-169 body (no `ranked` wrap, no `ROW_NUMBER`). Verified byte-identical to `169_generate_candidates_pushdown.sql` via `diff` (function block through GRANT). No DROP. `NNN_REVERSE_ONLY_<slug>.sql` naming.

## Verification

- Forward grep-structure gate: PASS (`hnsw.iterative_scan`, `ROW_NUMBER() OVER`, `PARTITION BY d.restaurant_id`, `#variable_conflict use_column`, `r.open_hours`, `relaxed_order`, `rn <= 8` all present).
- Forward acceptance extras: no `supabase db push`, no `DROP FUNCTION`, `supabase_functions.http_request` count == 0, BEGIN/COMMIT present, all 4 GUC values present.
- REVERSE grep-structure gate: PASS (4× `RESET hnsw.*`, `CREATE OR REPLACE FUNCTION generate_candidates`, no `ROW_NUMBER() OVER`, no `DROP FUNCTION`).
- REVERSE body verified byte-identical to migration 169 via `diff` (BODY MATCHES 169 VERBATIM).
- SQL parse sanity: paren balance OK on both files (comments stripped); `$$;` dollar-quoted block closure present; no local `psql`/`pg_query` (REST-only env — grep-structure + paren balance stand in per stage-don't-apply).
- `pnpm check-types` is N/A — both artifacts are pure `.sql`, no TypeScript touched.

Recall/latency of iterative_scan and the K=8 cap are OPERATOR-GATED (D-04) and not validated here; the Plan 05 handoff carries the prod-validation step. Plan 01's `precap-behavior.test.ts` is the automated behavior-preserving gate for K=8 (SC#3).

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was rewording one header comment to avoid the literal string `supabase db push` so the "Does NOT contain `supabase db push`" acceptance criterion holds at the grep level (intent unchanged: the migration is authored + dry-run only, applied by the operator). Tracked as a wording adjustment, not a behavioral deviation.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. The function keeps 169's `SECURITY DEFINER` + `SET search_path = extensions, public`; no new credential, no new external call, no broadened privilege (T-07-04 accept). T-07-01 (pre-cap proxy vs final JS score) mitigated by K=8 margin + Plan-01 behavior test; T-07-02 (iterative_scan DoS) mitigated by `max_scan_tuples=20000` + function-scoped GUC; T-07-03 (`#variable_conflict` drop) mitigated — directive preserved (gate greps for it), window ORDER BY uses underlying expressions.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: infra/supabase/migrations/175_generate_candidates_precap_iterative_scan.sql
- FOUND: infra/supabase/migrations/175_REVERSE_ONLY_generate_candidates_precap_iterative_scan.sql
- FOUND: commit c902c6f (forward)
- FOUND: commit 80e6af3 (REVERSE)

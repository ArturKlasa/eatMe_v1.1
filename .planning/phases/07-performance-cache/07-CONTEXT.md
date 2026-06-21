# Phase 7: Performance & Cache - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the feed candidate query stay within `statement_timeout` at the default radius, slim the Stage-1→Stage-2 handoff, and ensure every menu-affecting write busts the feed cache — **with the mobile client's response contract unchanged**.

Three requirements, four success criteria:
- **PERF-01 (SC#1, SC#2):** Tiered/expanding-radius loop in the `feed` edge function (no mobile change) + apply `hnsw.iterative_scan`.
- **PERF-02 (SC#3):** Reduce the Stage-2 candidate payload by moving the diversity cap toward SQL.
- **PERF-03 (SC#4):** Widen cache-invalidation event coverage to INSERT/UPDATE/DELETE; `invalidate-cache` CORS already locked (Phase 2).

**Explicitly out of scope (v2 milestone):** `PERF-V2-01` durable geo-aware ANN rebuild (per-restaurant centroid + restaurant-level vector search), `PERF-V2-02` full SQL-side ranking pushdown. The JS Stage-2 scoring stays in JS this phase.

</domain>

<decisions>
## Implementation Decisions

### Tiered-radius loop (PERF-01 / SC#1) — edge function only, NO migration
- **D-01:** Wrap the single `generate_candidates` RPC call (`feed/index.ts:881`) in an expanding-radius loop. Tiers are **fractions of the client-requested radius** (starting point: 25% → 50% → 100%; exact fractions tunable during research).
- **D-02:** **Stop condition = a healthy ranking pool (~100 candidates).** Once a tier returns ≈ half the 200-row `p_limit`, stop expanding so Stage-2 scoring + the max-3/restaurant diversity cap stay meaningful. The constant is tunable.
- **D-03:** **Never exceed the requested radius.** The client radius (default 10km) is the hard ceiling; tiers are sub-steps up to it. The final 100% tier reproduces today's behavior, so worst-case (sparse/rural) is never slower than the current single-shot. Response shape stays byte-identical — no mobile change.

### hnsw.iterative_scan (PERF-01 / SC#2) — coordinated SQL change
- **D-04:** **Apply it.** Author a minimal tracked migration (`ALTER FUNCTION generate_candidates(...) SET hnsw.iterative_scan = ...`) scoping the GUC to the RPC only. Authored + dry-run only (stage-don't-apply); the operator validates recall + latency on prod before relying on it. Rationale: prod pgvector `0.8.0` confirms availability (F-13), and iterative_scan fixes the *filtered-ANN under-return* case (heavy hard filters in `generate_candidates` discard most ANN hits) that tiered radius cannot — they are complementary.
- **D-05:** **Mode = `relaxed_order` with a `max_scan_tuples` cost bound.** Approximate ordering is fine because the feed's final order is JS-scored downstream, not raw vector distance; the scan-tuple cap keeps worst-case cost bounded. (Exact `max_scan_tuples`/`scan_mem_multiplier` values → research.)

### Stage-2 payload reduction (PERF-02 / SC#3) — coordinated SQL change
- **D-06:** **SQL per-restaurant pre-cap.** `generate_candidates` returns at most K rows per restaurant, ordered by a SQL-available signal (`vector_distance`/distance), bounding the row count before the JS handoff. This is the literal reading of "move the diversity cap toward SQL." The JS max-3-by-score diversity cap still runs on the smaller set; **single round-trip preserved** (no reversal of migration 167's consolidation).
- **D-07:** **K must sit comfortably above the JS max-3-by-score cap** (e.g. 5–10/restaurant) because the SQL pre-cap orders by a proxy, not the final JS score — too tight a K would change which dishes surface. Exact K → research, but "behavior-preserving" is the gate.

### Cache invalidation (PERF-03 / SC#4)
- **D-08:** **Keep the `feed:v2:*` namespace flush-all; document it as deliberate.** The cache key (`feed:v2:{user}:{geo}:{filters}`) carries no `restaurant_id`, so targeted purge would need a key redesign + write-path tag bookkeeping. SC#4's "never flush-all" is reconciled in writing: single operator, rare writes, 5-min TTL already bounds staleness, entries recompute lazily. This matches the existing in-code rationale at `invalidate-cache/index.ts`. The flush logic itself does **not** change.
- **D-09:** **Widen event coverage via a tracked migration.** Author `supabase_functions.http_request` triggers on `restaurants`/`menus`/`dishes` for **INSERT + UPDATE + DELETE** (currently the webhook is dashboard-configured, documented UPDATE-only, and not visible as a tracked trigger — F-21). Same codify-drift pattern Phase 3 used for RLS; repo becomes source of truth. Authored + dry-run only. **Research item:** `http_request` needs the function URL + auth header (secrets) — resolve via Vault/placeholder rather than hardcoding.
- **D-10:** `invalidate-cache` CORS lockdown is a **confirmation only** — already delivered in Phase 2 (SEC-01) via `_shared/cors.ts`. No new CORS work.

### Cross-cutting
- **D-11:** D-06 (per-restaurant pre-cap) and D-04 (iterative_scan) **both modify `generate_candidates`** → land them as ONE coordinated SQL change set with REVERSE pairs (project migration discipline). The tiered-radius loop (D-01..D-03) stays purely in the edge function. D-09 (cache triggers) is an independent migration.

### Claude's Discretion
- Exact tier fractions (D-01), stop-pool constant (D-02), per-restaurant K (D-07), and `max_scan_tuples`/`scan_mem_multiplier` values (D-05) — pick sensible starting values, justify against the codebase, leave tunable.
- Verification approach for "measurably reduced" (D-06): a row-count / serialized-byte before-vs-after on a representative query is acceptable (no prod access required).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Assessment evidence (verdicts + live-state, gates this phase's scope)
- `.planning/codebase/FINDINGS.md` — F-13 (pgvector `0.8.0` → iterative_scan available), F-14 (Stage-2 JS ranking / payload), F-21 (cache flush-all tension + webhook NOT a tracked trigger; the open sub-fact that INSERT/DELETE coverage is unconfirmed)
- `.planning/codebase/CONCERNS.md` — § Performance Bottlenecks, § Scaling Limits (original concern statements)

### Targets to modify
- `infra/supabase/functions/feed/index.ts` — Stage-1 RPC call (`:881`), cache key/read/write (`:736`, `:740`, `:1081`), Stage-2 `rankCandidates`, `applyDiversity(scored, 3)` (`:951`), final `slice(0, limit)` (`:983`)
- `infra/supabase/functions/invalidate-cache/index.ts` — `deleteByPattern('feed:v2:*')` flush-all (`:79`); DELETE-payload handling note (best-effort per-restaurant lookup reads a now-deleted row)

### Existing SQL to extend / reuse
- `infra/supabase/migrations/169_generate_candidates_pushdown.sql` — current materialized-CTE pushdown (the function the pre-cap + iterative_scan changes extend)
- `infra/supabase/migrations/136_hnsw_dishes_embedding.sql` — the HNSW index iterative_scan operates over
- `infra/supabase/migrations/167_*` — folded open-hours into `generate_candidates` (the single-round-trip we must NOT reverse) — confirm exact filename in research
- `infra/supabase/migrations/170_codify_behavioral_rls.sql` — Phase 3 codify-drift precedent (forward + REVERSE pairing pattern for the new cache-trigger migration)

### Constraints
- `.planning/PROJECT.md` — Constraints (stage-don't-apply; REST-only, no local psql; behavior-preserving; mobile verified on-device)

No additional external specs — requirements are fully captured in the decisions above + FINDINGS evidence.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`generate_candidates` RPC** — already accepts `p_radius_m` and `p_limit`; the tiered loop just calls it repeatedly with a growing `p_radius_m`. No new signature needed for the loop (D-01).
- **`deleteByPattern(redis, pattern)`** (`invalidate-cache/index.ts`) — SCAN-paged glob delete already exists and is kept as-is (D-08).
- **`_shared/cors.ts buildCorsHeaders`** — already wired into `invalidate-cache` (Phase 2); CORS is done (D-10).
- **`applyDiversity(scored, 3)`** — the JS max-3/restaurant cap stays; the SQL pre-cap (D-06) feeds it a smaller, bounded set.

### Established Patterns
- **Migration discipline:** every authored migration ships with a REVERSE pair; authored + dry-run only, operator applies to prod (Phases 3 & 6 precedent). D-04/D-06/D-09 all follow this.
- **Codify-drift:** Phase 3 turned out-of-band prod RLS into a tracked migration — D-09 applies the identical move to the dashboard-configured cache webhook.
- **Single round-trip:** migration 167 deliberately folded open-hours into the RPC to kill a second query — D-06 preserves this (rejected the lean+hydrate option specifically to avoid reintroducing a round-trip).
- **Cache key:** `feed:v2:{user}:{geo}:{filters}` with `currentTime` excluded; 300s TTL. Restaurant-agnostic by design — the reason flush-all is kept (D-08).

### Integration Points
- The tiered loop wraps the existing RPC call site at `feed/index.ts:881` — response assembly downstream is untouched.
- The new cache-invalidation triggers call the existing `invalidate-cache` function URL; the function body needs no logic change (it already ignores event type and flush-alls), except the planner should make the DELETE path read `old_record` for the best-effort per-restaurant key (D-08 note).

</code_context>

<specifics>
## Specific Ideas

- The flush-all-vs-targeted decision was the flagged tension (F-21). User chose pragmatism: flush-all is correct *because* writes are operator-rare and the key is restaurant-agnostic — write it down, don't engineer around it.
- iterative_scan is wanted as the *durable* half of PERF-01 (recall under heavy filters), not just a checkbox — but gated behind operator prod validation because it changes live feed results.

</specifics>

<deferred>
## Deferred Ideas

- **PERF-V2-01** — Geo-aware ANN rebuild (per-restaurant centroid + restaurant-level vector search). The durable fix beyond tiered radius. v2 milestone.
- **PERF-V2-02** — Full SQL-side ranking pushdown (beyond the per-restaurant pre-cap). v2 milestone.
- **Targeted-purge cache redesign** — restaurant-scoped cache keys + tag-set bookkeeping to honor "never flush-all" literally. Rejected for v1 (D-08); revisit only if write volume grows beyond the single-operator assumption.

None of these are blocking — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-performance-cache*
*Context gathered: 2026-06-21*

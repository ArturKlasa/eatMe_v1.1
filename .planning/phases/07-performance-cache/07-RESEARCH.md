# Phase 7: Performance & Cache - Research

**Researched:** 2026-06-21
**Domain:** Supabase Edge Function (Deno/TS) + PostgreSQL/pgvector tuning + DB-webhook trigger codification
**Confidence:** HIGH (codebase claims grounded in file:line; pgvector GUC mechanics from official v0.8.0 README)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Wrap the single `generate_candidates` RPC call (`feed/index.ts:881`) in an expanding-radius loop. Tiers are **fractions of the client-requested radius** (starting point: 25% → 50% → 100%; exact fractions tunable during research).
- **D-02:** **Stop condition = a healthy ranking pool (~100 candidates).** Once a tier returns ≈ half the 200-row `p_limit`, stop expanding. The constant is tunable.
- **D-03:** **Never exceed the requested radius.** Client radius (default 10km) is the hard ceiling; final 100% tier reproduces today's behavior. Response shape stays byte-identical — no mobile change.
- **D-04:** **Apply `hnsw.iterative_scan`.** Author a minimal tracked migration (`ALTER FUNCTION generate_candidates(...) SET hnsw.iterative_scan = ...`) scoping the GUC to the RPC only. Authored + dry-run only; operator validates recall + latency on prod.
- **D-05:** **Mode = `relaxed_order` with a `max_scan_tuples` cost bound.** Approximate ordering is fine (final order is JS-scored downstream). Exact `max_scan_tuples`/`scan_mem_multiplier` → research.
- **D-06:** **SQL per-restaurant pre-cap.** `generate_candidates` returns at most K rows per restaurant, ordered by a SQL-available signal (`vector_distance`/distance). JS max-3-by-score diversity cap still runs on the smaller set; **single round-trip preserved** (no reversal of migration 167).
- **D-07:** **K must sit comfortably above the JS max-3 cap** (e.g. 5–10/restaurant). Exact K → research; "behavior-preserving" is the gate.
- **D-08:** **Keep the `feed:v2:*` namespace flush-all; document it as deliberate.** Flush logic does NOT change.
- **D-09:** **Widen event coverage via a tracked migration.** Author cache-invalidation triggers on `restaurants`/`menus`/`dishes` for **INSERT + UPDATE + DELETE**, codify-drift pattern. **Research item:** function URL + auth header (secrets) — resolve via Vault/placeholder rather than hardcoding.
- **D-10:** `invalidate-cache` CORS lockdown is a **confirmation only** — already delivered in Phase 2 via `_shared/cors.ts`. No new CORS work.
- **D-11:** D-06 (pre-cap) and D-04 (iterative_scan) **both modify `generate_candidates`** → land them as ONE coordinated SQL change set with REVERSE pairs. The tiered-radius loop (D-01..D-03) stays purely in the edge function. D-09 (cache triggers) is an independent migration.

### Claude's Discretion

- Exact tier fractions (D-01), stop-pool constant (D-02), per-restaurant K (D-07), and `max_scan_tuples`/`scan_mem_multiplier` values (D-05) — pick sensible starting values, justify, leave tunable.
- Verification for "measurably reduced" (D-06): row-count / serialized-byte before-vs-after on a representative query is acceptable (no prod access required).

### Deferred Ideas (OUT OF SCOPE)

- **PERF-V2-01** — Geo-aware ANN rebuild (per-restaurant centroid + restaurant-level vector search). v2.
- **PERF-V2-02** — Full SQL-side ranking pushdown (beyond the per-restaurant pre-cap). v2. JS Stage-2 scoring STAYS in JS this phase.
- **Targeted-purge cache redesign** — restaurant-scoped keys + tag-set bookkeeping. Rejected for v1 (D-08).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | `generate_candidates` returns within `statement_timeout` at default radius via tiered/expanding-radius approach (no migration); `hnsw.iterative_scan` assessed | §1 (iterative_scan GUC mechanics — apply via ALTER FUNCTION), §2 (tiered-radius loop wrapping `feed/index.ts:881`) |
| PERF-02 | Feed Stage-2 response payload reduced (diversity cap / final sort moved toward SQL where it measurably helps) | §3 (SQL per-restaurant pre-cap injected in migration 169's `candidates` CTE; byte/row before-after harness) |
| PERF-03 | Feed-cache invalidation covers INSERT/UPDATE/DELETE for menu-affecting changes; `invalidate-cache` CORS locked (with SEC-01) | §4 (cache-invalidation triggers via `net.http_post` + Vault, matching migration 132/135 precedent), §5 (REVERSE pairing) |
</phase_requirements>

## Project Constraints (from CLAUDE.md + PROJECT.md)

- **Stage-don't-apply** (`PROJECT.md:93`): author + dry-run all migrations; operator deploys to prod (dry-run → sample → full). **Never `supabase db push`. No `CREATE INDEX CONCURRENTLY` auto-apply.** No local psql (REST-only).
- **Behavior-preserving** (`PROJECT.md:94`): mobile response contract byte-identical; mobile verified on-device by user (no emulator in agent loop).
- **Migration discipline:** every authored migration ships a `NNN_REVERSE_ONLY_*.sql` pair (precedent throughout `infra/supabase/migrations/`).
- **RLS** (CLAUDE.md): not relevant to this phase — no new tables.
- **GSD enforcement** (CLAUDE.md): all edits go through a GSD command.

---

## Summary

Phase 7 is three coordinated, low-blast-radius backend changes with the mobile contract frozen:

1. **Tiered-radius loop** (edge-only, no migration): wrap the lone `generate_candidates` RPC at `feed/index.ts:881` in a loop that calls the RPC with growing `p_radius_m` (fractions of the client radius), stopping once the pool reaches ~100 candidates or the 100% tier is reached. The RPC signature already accepts `p_radius_m` and `p_limit` (`169:43`,`169:50`) — no SQL change. Worst case (sparse) = today's single-shot at 100%, never slower.

2. **Coordinated `generate_candidates` SQL change set** (one migration + REVERSE, D-11): (a) `ALTER FUNCTION ... SET hnsw.iterative_scan = 'relaxed_order'` plus `hnsw.max_scan_tuples` / `hnsw.scan_mem_multiplier` / `hnsw.ef_search` bounds, and (b) a per-restaurant `ROW_NUMBER()` pre-cap injected into migration 169's `candidates` MATERIALIZED CTE. Both edit the same function → land together.

3. **Cache-invalidation trigger migration** (independent, D-09): codify the dashboard-configured webhook as tracked `net.http_post` triggers firing AFTER INSERT/UPDATE/DELETE on `restaurants`/`menus`/`dishes`, using the **exact Vault-secret + `net.http_post` pattern already in migrations 132 + 135** — NOT the `supabase_functions.http_request` helper (which appears nowhere in this repo).

**Primary recommendation:** Reuse the in-repo `net.http_post` + `vault.decrypted_secrets` trigger pattern (migration 132:43–91) verbatim for D-09; scope `hnsw.iterative_scan` with `ALTER FUNCTION` because the GUC applies to the whole function body including the CTE's index scan; inject the pre-cap as a second window-function column in the existing materialized CTE so the single round-trip and migration-167 open-hours fold are both preserved.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tiered-radius candidate fetch (D-01..03) | Edge Function (Deno) | — | RPC already parameterized by `p_radius_m`; looping is orchestration, belongs at the call site (`feed/index.ts:881`), not in SQL |
| Filtered-ANN recall under hard filters (D-04/05) | Database (pgvector GUC) | — | Only the index scanner can expand its own search; GUC scoped to the function via `ALTER FUNCTION` |
| Per-restaurant row cap (D-06/07) | Database (SQL window fn) | Edge (JS max-3 still runs) | "Move the diversity cap toward SQL" — bounding row count before serialization is a set-cardinality job for SQL |
| Cache invalidation on writes (D-09) | Database (trigger → pg_net) | Edge (`invalidate-cache` body unchanged) | Write events originate in the DB; `net.http_post` is the established backend→edge call path (migration 132) |
| Cache flush logic (D-08) | Edge Function (`invalidate-cache`) | — | Unchanged; `deleteByPattern` flush-all stays (`invalidate-cache/index.ts:76`) |

## Standard Stack

This phase introduces **no new packages**. It reuses what is already pinned and in-repo.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pgvector | 0.8.0 (prod-confirmed, F-13) | HNSW vector index + `hnsw.iterative_scan` GUC | Platform-provisioned; iterative_scan ships in 0.8.0 |
| pg_net (`net.http_post`) | Supabase platform extension | Postgres→Edge HTTP from triggers | Already the enrich-dish call path (migration 132:84) |
| Supabase Vault (`vault.decrypted_secrets`) | platform | Store service-role JWT for trigger auth | Already used for `enrich_dish_service_key` (migration 132:46) |
| `@upstash/redis` | 1.38.0 (pinned, F-23/DEBT-05 done) | Cache flush (`deleteByPattern`) | Unchanged this phase |
| `@supabase/supabase-js` | 2.39.3 (pinned) | RPC + restaurant lookup | Unchanged |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `net.http_post` + Vault (migration 132 pattern) | `supabase_functions.http_request` (the dashboard "Database Webhooks" helper) | The `supabase_functions.http_request` trigger function is what the dashboard generates, but it appears in ZERO migrations in this repo (`grep -rl "http_request\|supabase_functions" infra/supabase/migrations/` → empty). The repo's established, tested codify pattern is `net.http_post` (migrations 132/135/133/164/165/166). **Use `net.http_post`** — it is the in-repo precedent, keeps auth in Vault, and matches the codify-drift discipline. |
| `ALTER FUNCTION ... SET hnsw.iterative_scan` | Per-session `SET` from the edge client before each RPC | Per-session SET is fragile (every call site must remember it; pooled connections leak the setting) and is NOT a tracked migration. ALTER FUNCTION scopes the GUC to exactly the RPC, is version-controlled, and self-restores at function exit. **Use ALTER FUNCTION** (D-04 mandates this). |

**Version verification (pgvector):** prod `extversion=0.8.0` confirmed by operator paste-back (FINDINGS F-13, `FINDINGS.md:182`). iterative_scan is available. No `CREATE EXTENSION` / upgrade needed — platform-provisioned.

## Package Legitimacy Audit

No external packages installed this phase. All dependencies are already pinned in-repo (Phase 4 DEBT-05). **N/A — no new packages.**

---

## §1 — hnsw.iterative_scan GUC mechanics (D-04 / D-05)

### Exact ALTER FUNCTION syntax (full signature required)

`ALTER FUNCTION ... SET param = value` requires the function be **uniquely identified**. `generate_candidates` is not overloaded today, but PostgreSQL still requires either no args (only if unambiguous) or the full argument-type list. To be safe and explicit, supply the full signature exactly as migration 167's REVERSE drop does (`167_REVERSE...:13-15`):

```sql
-- Scope the iterative-scan GUCs to ONLY the feed RPC.
ALTER FUNCTION generate_candidates(
  FLOAT, FLOAT, FLOAT, vector, UUID[], TEXT, TEXT[], BOOLEAN, INT, TIME, TEXT, TEXT, BOOLEAN
)
  SET hnsw.iterative_scan    = 'relaxed_order',
  SET hnsw.max_scan_tuples   = 20000,
  SET hnsw.scan_mem_multiplier = 2,
  SET hnsw.ef_search         = 400;
```

> Note: each `SET` is a separate clause; PostgreSQL `ALTER FUNCTION` accepts a comma-separated list of `SET` actions. If the operator's pg version rejects the comma-list, fall back to one `ALTER FUNCTION ... SET x = y;` statement per GUC (all are independent and idempotent).

The argument-type list is taken verbatim from the function's declared parameter types (`169:42-54`): `p_lat FLOAT, p_lng FLOAT, p_radius_m FLOAT, p_preference_vector vector(1536), p_disliked_dish_ids UUID[], p_diet_tag TEXT, p_exclude_families TEXT[], p_exclude_spicy BOOLEAN, p_limit INT, p_current_time TIME, p_current_day TEXT, p_schedule_type TEXT, p_group_meals BOOLEAN`. `vector(1536)` may be written `vector` in the signature (167_REVERSE uses bare `vector`) — both resolve. `[CITED: 167_REVERSE_ONLY...:13-15]`

### Does the GUC apply to the HNSW scan inside the materialized CTE?

**Yes.** Per the PostgreSQL CREATE FUNCTION docs: *"The SET clause causes the specified configuration parameter to be set to the specified value when the function is entered, and then restored to its prior value when the function exits."* `[CITED: postgresql.org/docs/current/sql-createfunction.html]` The GUC is active for the entire function body — including the `RETURN QUERY ... WITH candidates AS MATERIALIZED (...)` block (`169:97-101`) where the HNSW index scan on `dishes.embedding` (`169:116-119`, index from `136`) is evaluated. There is **no CTE-boundary caveat**: the materialized CTE is still planned and executed within the function's GUC scope. `[VERIFIED: postgresql docs + pgvector README]`

One real interaction to flag for the planner (LOW-risk, not a blocker): the `candidates` CTE is `MATERIALIZED` with an inner `ORDER BY vector_distance ASC NULLS LAST` + `LIMIT p_limit` (`169:301-306`), and the outer query re-sorts by `c.vector_distance` (`169:411-414`). `relaxed_order` returns rows *slightly* out of vector-distance order, but both ORDER BYs re-impose the sort, so the final order is deterministic on `vector_distance`. The only behavioral effect of `relaxed_order` vs `strict_order` is **which** candidate set survives (recall), not the ordering of what's returned — which is exactly why relaxed is safe here (D-05): the JS Stage-2 re-scores on a weighted blend (`feed/index.ts:246-261`), so raw vector order is never the user-visible order anyway.

### GUC values — defaults, ranges, recommended starting values

| GUC | Default | Meaning | Recommended start (this query) | Rationale |
|-----|---------|---------|-------------------------------|-----------|
| `hnsw.iterative_scan` | `off` | Auto-expand search when filtering drops results below LIMIT | `relaxed_order` | D-05 locked; better recall, order re-imposed downstream |
| `hnsw.ef_search` | `40` | Dynamic candidate-list width per scan | `400` | pgvector guidance: *"set ef_search to at least twice the LIMIT"*; LIMIT here is `p_limit=200` (`feed/index.ts:890`), so ≥400. **Judgment call** — start at 400, operator tunes for recall/latency. |
| `hnsw.max_scan_tuples` | `20000` | Max tuples to visit (approximate; doesn't bound the initial scan) | `20000` (keep default) | Bounds worst-case cost. Heavy hard filters (radius + diet + time, `169:153-299`) mean the iterative scan may walk many tuples to find ~100-200 survivors; 20k is a sane ceiling. **Judgment call** — raise toward 40000 only if operator sees recall shortfall. |
| `hnsw.scan_mem_multiplier` | `1` | Max memory as multiple of `work_mem` | `2` | pgvector: *"try increasing this if raising max_scan_tuples does not improve recall."* Starting at 2 gives the iterative scan headroom without unbounded memory. **Judgment call.** |

`[VERIFIED: pgvector v0.8.0 README — iterative scans section]`

**Why iterative_scan is the durable half of PERF-01 (and complementary to tiered radius):** pgvector applies filters *after* the index scan. With default `ef_search=40` and a filter matching ~10% of rows, only ~4 rows survive on average. `generate_candidates` applies heavy hard filters (radius, diet, exclude-families, exclude-spicy, time/day windows, required-group safety — `169:153-299`) **after** the `d.embedding <=> p_preference_vector` ANN ordering (`169:116-119`), so a personalized request can under-return badly. Iterative scan auto-expands until the LIMIT is met. Tiered radius cannot fix this (it only changes the spatial filter); the two are orthogonal. `[VERIFIED: pgvector README "filtering applied after index scan"]`

**Caveat — only matters when a preference vector is present.** The ANN scan only runs when `p_preference_vector IS NOT NULL` (`169:115-119`); for anon/cold-start users `vector_distance` is NULL and the sort falls through to `popularity_score`/`distance_m` (no HNSW scan). So iterative_scan helps personalized requests only — which is the majority and the slow path. Note this in the operator validation gate.

---

## §2 — Tiered-radius loop design (D-01 / D-02 / D-03)

### RPC signature & call site (ground truth)

- `generate_candidates` signature: `169:41-55`. Relevant params: `p_radius_m FLOAT DEFAULT 10000` (`169:44`), `p_limit INT DEFAULT 200` (`169:50`).
- Call site: `feed/index.ts:881-896`. The request passes `p_radius_m: radius * 1000` (`:884`, `radius` defaults to 10 → 10000m, `:713`) and `p_limit: 200` (`:890`).
- Response binding: `const { data: candidates, error: candidateError } = await supabase.rpc(...)` (`:881`), then `const pool = candidates ?? []` (`:903`). **Everything downstream of `:903` consumes `pool` as a `Candidate[]`** — the loop must produce the same `Candidate[]` shape so nothing downstream changes.

### Recommended loop design

Wrap `:881-896` in a helper that calls the RPC with growing `p_radius_m`, keeping all other params identical:

```ts
// Tiers are FRACTIONS of the client radius (D-01). Final tier == requested radius (D-03).
const TIER_FRACTIONS = [0.25, 0.5, 1.0];          // 25% → 50% → 100%
const POOL_TARGET = 100;                           // ~half of p_limit=200 (D-02)
const requestedRadiusM = radius * 1000;

let pool: Candidate[] = [];
for (const frac of TIER_FRACTIONS) {
  const tierRadiusM = Math.round(requestedRadiusM * frac);
  const { data, error } = await supabase.rpc('generate_candidates', {
    p_lat: location.lat,
    p_lng: location.lng,
    p_radius_m: tierRadiusM,                        // ONLY this changes per tier
    p_preference_vector: preferenceVector ? JSON.stringify(preferenceVector) : null,
    p_disliked_dish_ids: userDislikes.length ? userDislikes : null,
    p_diet_tag: hardDietTag,
    p_exclude_families: filters.excludeFamilies?.length ? filters.excludeFamilies : null,
    p_exclude_spicy: filters.excludeSpicy ?? false,
    p_limit: 200,
    p_current_time: filters.currentTime ?? null,
    p_current_day: filters.currentDayOfWeek ?? null,
    p_schedule_type: filters.scheduleType ?? null,
    p_group_meals: filters.groupMeals ?? false,
  }) as { data: Candidate[] | null; error: unknown };
  if (error) { console.error('[Feed] generate_candidates failed:', error); throw error; }
  pool = data ?? [];                                // each tier is a SUPERSET (wider radius) → replace, don't merge
  if (pool.length >= POOL_TARGET) break;            // healthy pool reached (D-02)
}
```

**Why "replace, not merge":** each tier widens `p_radius_m` while keeping every other filter identical, so a wider tier's result set is a strict superset of a narrower one's (same ANN order, same `p_limit=200` cap). Taking the last (widest-so-far) result is correct and avoids dedup logic. The narrower tiers exist purely to let dense-urban requests finish fast and bail before paying for the full 10km scan.

### Recommended starting values

| Knob | Recommendation | Rationale |
|------|---------------|-----------|
| Tier fractions | `[0.25, 0.5, 1.0]` (CONTEXT starting point) | Dense urban finishes at 25% (2.5km) under timeout; rural falls through to 100% = today's behavior |
| Stop-pool target | `100` (≈ half of `p_limit=200`) | Keeps Stage-2 scoring + max-3/restaurant diversity (`feed/index.ts:951`) meaningful (D-02) |
| Hard ceiling | `radius * 1000` (the 100% tier) | Never exceed requested radius (D-03); final tier reproduces current single-shot exactly |

All three are **judgment calls** flagged tunable in CONTEXT. Defensible defaults given above.

### Byte-identical guarantee

The loop produces a `Candidate[]` assigned to `pool` — identical to the current `const pool = candidates ?? []` (`:903`). Everything from `:903` onward (price filter `:931`, `rankCandidates` `:940`, `applyDiversity` `:951`, open-now `:975`, `dishResult` build `:980-1014`, response assembly `:1064-1077`) is untouched. **No response-shape change.** The `stage1Candidates`/`totalAvailable` metadata (`:1068`,`:1074`) still reflects `pool.length` — now the final tier's count, semantically the same field.

### Per-call overhead concern (flag for planner)

On **sparse/rural** data the loop makes up to **3 RPC round-trips** (25% returns few → 50% returns few → 100%) instead of 1 today. Each is a full `generate_candidates` execution. Mitigations baked into the design: (a) narrow tiers are *cheaper* than the full scan (smaller `ST_DWithin` radius → fewer rows into the ANN/modifier LATERAL), so 3 narrow+medium+full ≈ 1 full + small overhead, not 3× full; (b) the `break` short-circuits the moment `POOL_TARGET` is hit, so dense areas pay 1 trip. **Worst case is bounded by D-03**: the 100% tier == today's query, so the loop is never *slower than today plus the cost of the two narrower probes*. If the operator finds the rural double-probe wasteful, the fallback is a 2-tier `[0.5, 1.0]` schedule (one fewer probe). Note this as a tunable.

---

## §3 — SQL per-restaurant pre-cap (D-06 / D-07)

### Where to inject (exact location in migration 169)

The pre-cap belongs **inside the `candidates` MATERIALIZED CTE**, applied to the already-filtered, already-sorted set, *before* the `LIMIT p_limit`. Two valid placements:

**Option A (recommended) — wrap the CTE select in a windowed subquery.** Add `ROW_NUMBER() OVER (PARTITION BY restaurant_id ORDER BY <signal>)` as a computed column in the current CTE body (`169:101-307`), then filter `WHERE rn <= K` in an enclosing layer before the global `ORDER BY ... LIMIT p_limit`. Because the current CTE already computes `vector_distance` (`169:116-119`), `popularity_score` (`169:132`), and `distance_m` (`169:121-124`) as columns, the window can order by them directly.

```sql
WITH candidates AS MATERIALIZED (
  SELECT * FROM (
    SELECT
      <all the existing columns 169:102-144>,
      ROW_NUMBER() OVER (
        PARTITION BY d.restaurant_id
        ORDER BY
          CASE WHEN p_preference_vector IS NOT NULL AND d.embedding IS NOT NULL
               THEN (d.embedding <=> p_preference_vector) ELSE NULL END ASC NULLS LAST,
          COALESCE(da.popularity_score, 0) DESC,
          ST_Distance(r.location_point, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography) ASC
      ) AS rn
    FROM dishes d
    JOIN restaurants r ON ...
    <all existing JOINs + WHERE 169:146-299>
  ) ranked
  WHERE ranked.rn <= 8                      -- per-restaurant pre-cap K (D-07)
  ORDER BY vector_distance ASC NULLS LAST, popularity_score DESC, distance_m ASC
  LIMIT p_limit
)
```

> The window's ORDER BY must mirror the existing global sort keys (`169:301-304`) so the K survivors per restaurant are the *best* K by the same proxy the function already trusts. **Reuse the column aliases** — note the `#variable_conflict use_column` directive (`169:95`) already forces bare `vector_distance`/`popularity_score`/`distance_m` to resolve to columns; preserve it.

**Option B — `QUALIFY`-style filter** is unavailable in PostgreSQL (no `QUALIFY`), so Option A's subquery wrap is the idiomatic form. Use Option A.

### Which distance/score signal to order the pre-cap by

`vector_distance` is the natural primary (it's what the global sort leads on, `169:302`), with `popularity_score` then `distance_m` as tiebreakers — **identical to the existing global ORDER BY** (`169:301-304`,`411-414`). This guarantees the pre-cap keeps the same dishes the function would have surfaced first, just bounded per restaurant. For anon/cold-start (`vector_distance` NULL), the order falls through to `popularity_score`/`distance_m` exactly as today.

### Recommended K

| K | Verdict |
|---|---------|
| **8** (recommended start) | Comfortably above the JS `applyDiversity(scored, 3)` max-3 cap (`feed/index.ts:951`), giving the JS re-score room to pick the best 3 by *final* weighted score from 8 proxy-best candidates. |
| 5 | Acceptable floor (D-07 range 5–10); tighter risks dropping a dish the JS score would have ranked top-3. |
| 10 | Acceptable ceiling; more payload savings but less headroom shrinkage. |

**Why K=8 is behavior-preserving:** the JS pipeline scores then caps at 3/restaurant. The pre-cap orders by a *proxy* (vector distance), not the final JS score, so K must exceed 3 enough that the JS top-3 is almost always within the proxy top-K. 8 is >2.5× the JS cap — a safe margin. **Judgment call**, flagged tunable. The gate is: does the diversified output (`feed/index.ts:951`) change? It must not for representative inputs (see Validation Architecture §6).

### Single round-trip & open-hours fold preserved

The pre-cap is a pure addition *inside* the existing `candidates` CTE. The LATERAL modifier-JSON build (`169:370-409`), the `reachable_proteins`/`reachable_protein_families` projection (`169:336-360`), and the `open_hours`/`timezone`/`country_code` columns folded in by migration 167 (`169:142-144`, surfaced at `169:365-367`) are all **downstream of the CTE and untouched**. No second query is introduced. The 32-column return shape (`169:56-89`) is unchanged → `CREATE OR REPLACE`, no signature change, no deploy-ordering constraint (same property migration 169 itself relies on, `169:36-38`).

### Measuring "measurably reduced" without prod (D-06 discretion)

Two no-prod-access measurements, both feasible under REST-only/stage-don't-apply:

1. **Row-count delta (SQL-level, deterministic):** the pre-cap reduces CTE output from "up to `p_limit`=200 rows, any restaurant distribution" to "≤ K per restaurant within the 200 cap." On a representative candidate set where a few restaurants dominate (the dense-urban case PERF-01 targets), this is a measurable row drop. Capture by running the *old* vs *new* CTE body (the SELECT only, no DDL apply) against a representative fixture and counting rows — doable via a read-only REST RPC or an EXPLAIN if reachable, or against a local fixture table.

2. **Serialized-byte delta (edge-level, most faithful to "payload"):** the user-visible payload is the JSON the edge function returns. Build a before/after harness: feed the old `pool` (200 rows) vs the new pre-capped `pool` through the existing `dishResult` builder (`feed/index.ts:980-1014`) and `JSON.stringify` both, diff `Buffer.byteLength`. Because each candidate row carries `modifier_groups` JSON (`169:372-398`) — the heaviest field — dropping rows yields a concrete byte reduction. This is the recommended primary metric (matches "Stage-2 response payload size", PERF-02 wording).

> Honest scope note: the *final* response is already capped at `limit` (default 20) dishes (`feed/index.ts:983`), so end-user response bytes may not shrink much — the reduction is in the **Stage-1→Stage-2 handoff** (the 200-row `pool` that JS scores), which is exactly what F-14/PERF-02 names ("Stage-2 candidate payload"). Measure the handoff set, not just the final 20.

---

## §4 — Cache-invalidation triggers (D-09)

### USE THE IN-REPO PATTERN, NOT `supabase_functions.http_request`

**Critical finding:** `grep -rl "http_request\|supabase_functions" infra/supabase/migrations/` returns **nothing**. The repo has never codified the dashboard "Database Webhooks" helper. What it HAS codified, repeatedly, is `net.http_post` (pg_net) called from a `SECURITY DEFINER` plpgsql trigger function that reads a service-role JWT from Vault (`vault.decrypted_secrets`):

- `132_vault_based_trigger_auth.sql:36-95` — `_trg_notify_enrich_dish()`: reads `decrypted_secret` from `vault.decrypted_secrets WHERE name='enrich_dish_service_key'` (`132:46-48`), guards NULL key with a WARNING (`132:50-53`), calls `net.http_post(url, body, headers => {'Authorization':'Bearer '||v_key})` (`132:84-91`). The function URL is a hardcoded project constant `https://tqroqqvxabolydyznewa.supabase.co/functions/v1/enrich-dish` (`132:43`).
- `135_record_enrich_dish_triggers.sql:24-59` — the matching `CREATE TRIGGER` statements (idempotent DROP IF EXISTS + CREATE).

**D-09 must mirror this exactly.** This is the codify-drift pattern the decision references. `[VERIFIED: codebase grep + migrations 132/135]`

### Recommended trigger function (codifies the dashboard webhook)

```sql
-- New function: backend→edge call to invalidate-cache, Vault-authed.
CREATE OR REPLACE FUNCTION public._trg_invalidate_feed_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_url TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/invalidate-cache';  -- same project ref as migration 132:43
  v_key TEXT;
  v_record JSONB;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'invalidate_cache_service_key';   -- operator stores via vault.create_secret (see prereq)

  IF v_key IS NULL THEN
    RAISE WARNING 'invalidate_cache_service_key not in vault';
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- DELETE path: the row is already gone, so the function's best-effort per-restaurant
  -- key lookup must read OLD, not NEW (D-08 note). Send old_record so the body shape
  -- matches the Supabase DB-webhook contract invalidate-cache already parses.
  v_record := to_jsonb(COALESCE(NEW, OLD));

  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
                 'type',       TG_OP,            -- 'INSERT' | 'UPDATE' | 'DELETE'
                 'table',      TG_TABLE_NAME,    -- 'restaurants' | 'menus' | 'dishes'
                 'schema',     TG_TABLE_SCHEMA,
                 'record',     CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
                 'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
               ),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               )
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;
```

### Recommended CREATE TRIGGER statements (INSERT + UPDATE + DELETE, 3 tables)

```sql
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_restaurant_change ON public.restaurants;
CREATE TRIGGER trg_invalidate_cache_on_restaurant_change
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public._trg_invalidate_feed_cache();

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_change ON public.menus;
CREATE TRIGGER trg_invalidate_cache_on_menu_change
  AFTER INSERT OR UPDATE OR DELETE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public._trg_invalidate_feed_cache();

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_change ON public.dishes;
CREATE TRIGGER trg_invalidate_cache_on_dish_change
  AFTER INSERT OR UPDATE OR DELETE ON public.dishes
  FOR EACH ROW EXECUTE FUNCTION public._trg_invalidate_feed_cache();
```

### The secrets problem — RESOLVED via Vault (not hardcoding)

- **Auth header:** read the service-role JWT from `vault.decrypted_secrets` under a new secret name `invalidate_cache_service_key` — identical mechanism to `enrich_dish_service_key` (`132:46-48`). The migration header MUST carry the same per-environment prerequisite note migration 132 uses (`132:21-32`): the operator runs `SELECT vault.create_secret('<service-role JWT>', 'invalidate_cache_service_key', '...')` *before* applying, or the trigger logs a WARNING and skips (fail-soft, never blocks the write).
- **Function URL:** hardcode the project-ref URL as a plpgsql constant exactly as migration 132:43 does (`https://tqroqqvxabolydyznewa.supabase.co/functions/v1/invalidate-cache`). This is the established convention — the project ref is not a secret and is already a literal in migration 132. (Alternative: a second Vault secret for the URL — rejected as over-engineering; migration 132 precedent hardcodes it.)

### DELETE path — read `old_record` (D-08 note confirmed)

`invalidate-cache/index.ts` reads `body.record` (`:54`). On DELETE there is no `record` (the row is gone), so the best-effort per-restaurant key block (`:79-100`) would get a null id. Two-part fix the planner must implement:

1. **Trigger side (above):** on DELETE, send `record: NULL` and `old_record: to_jsonb(OLD)`.
2. **Function side (`invalidate-cache/index.ts`):** make the per-restaurant lookup fall back to `old_record` when `record` is absent. Change `const record = body.record ?? {}` (`:54`) to prefer `body.record` then `body.old_record`. **The flush-all (`deleteByPattern('feed:v2:*')`, `:76`) already runs unconditionally regardless of event type**, so cache correctness on DELETE does NOT depend on the per-restaurant lookup — it's purely the best-effort legacy `restaurant:*` keys (`:98-100`) that need `old_record`. This keeps D-08 intact (flush-all unchanged) while making the DELETE per-restaurant best-effort actually work.

> Note: for `dishes` DELETE, the function's current `restaurant_id` resolution does a live `supabase.from('dishes').select(...).eq('id', record.id)` (`:90-95`) — that row is gone on DELETE, so the lookup returns null. This is acceptable: the flush-all still clears the feed cache; the per-restaurant legacy key is best-effort only. The planner should NOT add complexity to recover it (out of scope; D-08 keeps flush-all as the correctness guarantee).

### What the deployed (dashboard) webhook likely looks like (F-21)

F-21 (`FINDINGS.md:254`) confirms the `invalidate-cache` webhook is **dashboard-configured, documented UPDATE-only, and NOT visible as a tracked table trigger** — the complete prod trigger dump shows no `http_request`/`invalidate-cache` trigger on restaurants/menus/dishes. The function header self-documents "Invoked by Supabase webhooks on UPDATE events" (`invalidate-cache/index.ts:3`). So the deployed reality is: a dashboard Database Webhook (which under the hood is a `supabase_functions.http_request` trigger in the `supabase_functions` schema, invisible to a `public`-schema trigger dump) firing on UPDATE only. **The codify migration both (a) makes the wiring a tracked `public`-schema `net.http_post` trigger and (b) widens to INSERT+UPDATE+DELETE.** The operator must DISABLE/DELETE the old dashboard webhook when applying, or both will fire (double flush — harmless but wasteful). Flag this in the migration header + operator checklist.

---

## §5 — REVERSE migration pairing (D-11) + filenames

### Next free migration numbers

Highest existing is `174` (`ls` of `infra/supabase/migrations/`: …172, 173, 174 with REVERSE pairs). **Next free numbers: 175, 176.** Recommended:

- **175** — coordinated `generate_candidates` change set (iterative_scan GUC + per-restaurant pre-cap, D-04+D-06, landed together per D-11) + `175_REVERSE_ONLY_*.sql`
- **176** — cache-invalidation triggers (D-09) + `176_REVERSE_ONLY_*.sql`

### Migration 167 filename (confirmed)

`167_generate_candidates_open_hours.sql` (+ `167_REVERSE_ONLY_generate_candidates_open_hours.sql`). This is the open-hours fold that must NOT be reversed. `[VERIFIED: ls infra/supabase/migrations/]`

### Exact REVERSE content

**(a) For 175 (coordinated generate_candidates change set):** This is a `CREATE OR REPLACE FUNCTION` (32-column shape unchanged, like 169 itself `169:36-38`). The REVERSE recreates migration **169's** body verbatim (the pre-169-state is 167, but 169 is the current HEAD function, so REVERSE-to-169 is correct) AND drops the GUC settings:

```sql
-- 175_REVERSE_ONLY: restore migration-169 generate_candidates + clear the iterative_scan GUCs.
-- Pattern mirrors 169_REVERSE_ONLY (CREATE OR REPLACE, no DROP — signature unchanged).
ALTER FUNCTION generate_candidates(
  FLOAT, FLOAT, FLOAT, vector, UUID[], TEXT, TEXT[], BOOLEAN, INT, TIME, TEXT, TEXT, BOOLEAN
)
  RESET hnsw.iterative_scan,
  RESET hnsw.max_scan_tuples,
  RESET hnsw.scan_mem_multiplier,
  RESET hnsw.ef_search;

CREATE OR REPLACE FUNCTION generate_candidates(...)  -- VERBATIM migration 169 body
...
```

> Mirror `169_REVERSE_ONLY...:10` which is a plain `CREATE OR REPLACE` restoring migration 167. The 175 REVERSE restores the *pre-pre-cap* body, i.e. migration 169's, plus `RESET` for each GUC. Use `ALTER FUNCTION ... RESET <guc>` to strip the per-function settings (the inverse of `SET`).

**(b) For 176 (cache triggers):** Mirror `135`'s structure inverted — DROP the three triggers + the function:

```sql
-- 176_REVERSE_ONLY: remove the codified cache-invalidation triggers.
-- WARNING: after this, no migration-tracked feed-cache invalidation fires; if the
-- old dashboard webhook was deleted at apply-time, re-create it or feed staleness
-- returns to TTL-only (5 min). Controlled rollback only.
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_change ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_change ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_restaurant_change ON public.restaurants;
DROP FUNCTION IF EXISTS public._trg_invalidate_feed_cache();
```

> The `170_REVERSE_ONLY` header (`170_REVERSE...:1-22`) is the model for the security/rollback warning prose. The trigger-drop ordering mirrors `135` reversed.

---

## Architecture Patterns

### System Architecture Diagram (post-Phase-7)

```
                         feed/index.ts  (edge, Deno)
                                │
              cache check (feed:v2 key) ── Redis hit? ──► return cached
                                │ miss
                                ▼
        ┌──────── TIERED-RADIUS LOOP (NEW, §2, D-01..03) ────────┐
        │  for frac in [0.25, 0.5, 1.0]:                          │
        │     rpc generate_candidates(p_radius_m = reqRadius*frac)│◄─┐
        │     if pool.length >= 100: break                        │  │ each tier =
        └─────────────────────────┬──────────────────────────────┘  │ 1 RPC round-trip
                                  │ pool: Candidate[]                │
                                  ▼                                  │
        ┌─ generate_candidates RPC (SQL, migration 175) ───────────┐│
        │  ALTER FUNCTION SET hnsw.iterative_scan=relaxed_order ◄───┘│  GUC scoped
        │  WITH candidates AS MATERIALIZED (                         │  to function body
        │     HNSW ANN scan (dishes_embedding_hnsw_idx, mig 136)    │  (covers CTE scan)
        │     + hard filters (radius/diet/time…)                    │
        │     + ROW_NUMBER() PARTITION BY restaurant_id <= 8  (NEW) │◄─ per-restaurant
        │     ORDER BY vector_distance… LIMIT 200 )                 │  pre-cap §3, D-06
        │  LATERAL modifier_groups JSON + open_hours (mig 167) ◄────┘  single round-trip
        └──────────────────────────┬───────────────────────────────┘  preserved
                                   ▼
         Stage-2 JS: rankCandidates → sort → applyDiversity(3) → slice(limit)
                                   ▼
                          gzip JSON response (UNCHANGED shape)

    ── WRITE PATH (independent, §4, D-09) ────────────────────────────
    INSERT/UPDATE/DELETE on restaurants|menus|dishes
        │ AFTER ROW trigger (migration 176)
        ▼
    _trg_invalidate_feed_cache()  ── Vault: invalidate_cache_service_key
        │ net.http_post(invalidate-cache URL, Bearer JWT)
        ▼
    invalidate-cache/index.ts → deleteByPattern('feed:v2:*')  [flush-all, D-08 unchanged]
```

### Anti-Patterns to Avoid

- **Using `supabase_functions.http_request` for D-09.** Not in this repo; breaks the codify-drift convention. Use `net.http_post` + Vault (migration 132).
- **Merging tier results.** Wider tiers are supersets — replace, don't merge/dedup (§2).
- **Changing the flush-all to targeted purge.** D-08 explicitly keeps flush-all; the cache key is restaurant-agnostic (`feed/index.ts:736`).
- **Reversing migration 167's open-hours fold.** The pre-cap is additive inside the CTE; open_hours columns (`169:142-144`) stay.
- **Per-session `SET hnsw.iterative_scan` from the edge client.** Leaks across pooled connections; use `ALTER FUNCTION` (D-04).
- **Dropping the `#variable_conflict use_column` directive** (`169:95`) when editing the CTE — the new `ROW_NUMBER` ORDER BY relies on bare column refs resolving to columns, not OUT params.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Postgres→Edge HTTP from a trigger | Custom HTTP client / curl in plpgsql | `net.http_post` (pg_net) | Already the path in migration 132; async, fire-and-forget |
| Trigger auth secret | Hardcoded JWT in function body | `vault.decrypted_secrets` lookup | Migration 132 moved off hardcoded JWT after a 2026-05-15 incident (`132:7-19`) |
| Filtered-ANN under-return | Manual candidate re-querying loop in JS | `hnsw.iterative_scan` GUC | The index scanner expands its own search; JS can't (§1) |
| Glob cache delete | Manual KEYS scan | existing `deleteByPattern` (`invalidate-cache/index.ts:30`) | SCAN-paged, non-blocking, already in-repo |

## Common Pitfalls

### Pitfall 1: GUC comma-list syntax rejected by older pg
**What goes wrong:** `ALTER FUNCTION ... SET a=x, SET b=y` may not parse on some versions.
**How to avoid:** Fall back to one `ALTER FUNCTION ... SET <guc> = <val>;` statement per GUC. All independent/idempotent.

### Pitfall 2: Double cache flush after codifying the trigger
**What goes wrong:** The old dashboard webhook AND the new tracked trigger both fire → two flushes per write.
**How to avoid:** Operator checklist step: disable/delete the dashboard Database Webhook for invalidate-cache when applying migration 176. Harmless (flush is idempotent) but document it.

### Pitfall 3: Vault secret missing at apply time
**What goes wrong:** Trigger logs WARNING and skips the http_post; cache never busts.
**How to avoid:** Migration 176 header carries the `vault.create_secret('invalidate_cache_service_key', …)` prerequisite (copy migration 132:21-32 prose).

### Pitfall 4: Pre-cap K too tight changes which dishes surface
**What goes wrong:** K<5 drops a dish the JS final score would have ranked top-3 → behavior change.
**How to avoid:** Start K=8 (>2.5× the JS max-3 cap); validate diversified output unchanged (§6).

### Pitfall 5: iterative_scan changes live recall — operator-gated
**What goes wrong:** `relaxed_order` returns a different candidate set → feed results shift for personalized users.
**How to avoid:** D-04 gates this behind operator prod recall+latency validation. Author + dry-run only; the migration is authored, the operator decides to keep it.

## Runtime State Inventory

> This phase is NOT a rename/refactor of stored identifiers. It adds triggers and tunes a function. The relevant "runtime state" is the out-of-band webhook config:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Live service config | Dashboard-configured `invalidate-cache` Database Webhook (UPDATE-only), NOT in any migration (F-21, `FINDINGS.md:254`); lives in the `supabase_functions` schema, invisible to a `public` trigger dump | Operator disables/deletes it when applying migration 176 (else double-flush) |
| Secrets/env vars | New Vault secret `invalidate_cache_service_key` (service-role JWT) — does not exist yet | Operator runs `vault.create_secret(...)` before applying 176 (prereq in header) |
| Stored data | None — no renamed keys/collections/ids | None |
| OS-registered state | None | None |
| Build artifacts | None | None |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Filtered ANN under-returns silently | `hnsw.iterative_scan` auto-expands | pgvector 0.8.0 (prod-confirmed) | Recall fix for heavy-filter feed queries (§1) |
| Dashboard webhook (untracked, UPDATE-only) | Tracked `net.http_post` triggers, INSERT/UPDATE/DELETE | This phase (migration 176) | Repo becomes source of truth; wider coverage |

---

## Validation Architecture

> nyquist_validation = true (config.json). Required. All validation must work WITHOUT prod access (stage-don't-apply, REST-only, no local psql).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno test for edge logic (`deno test --node-modules-dir=none -A <path>`; deno at ~/.deno per MEMORY) + SQL dry-run parse for migrations |
| Config file | none for feed/ (F-26 — no existing Deno suite); migrations validated by parse/dry-run only |
| Quick run command | `deno check infra/supabase/functions/feed/index.ts` (type-safety of the loop) |
| Full suite command | n/a (minimal-tests posture, REQUIREMENTS Out-of-Scope; F-26) |

### Per-Success-Criterion validation (no prod)

| SC | Behavior | Validation method (no prod access) |
|----|----------|-----------------------------------|
| SC#1 (tiered loop) | Loop wraps RPC, identical response shape | (a) `deno check` the edited `feed/index.ts` compiles; (b) a focused Deno test stubbing `supabase.rpc` to return tiered fixtures, asserting the loop breaks at POOL_TARGET and the final `pool` shape == current `Candidate[]`; (c) diff the response-builder path (`:903`+) — must be untouched (git diff scoped to `:881-903`). |
| SC#2 (iterative_scan) | GUC applied or recorded unavailable | (a) Migration 175 parses (dry-run SQL syntax check); (b) pgvector 0.8.0 prod-confirmed (F-13) → available, recorded; (c) recall/latency = **operator-gated** (D-04) — open question §below. |
| SC#3 (pre-cap payload) | Measurably reduced handoff payload | **Byte-diff harness (no prod):** stringify old 200-row `pool` vs new pre-capped `pool` through `dishResult` builder, assert `byteLength(after) < byteLength(before)` on a representative multi-restaurant fixture (§3). **Row-count assertion:** count CTE output rows old vs new on the same fixture. Both run against a local fixture, no prod. |
| SC#3 (behavior-preserving) | Diversified output unchanged | Run `rankCandidates`+`sort`+`applyDiversity(3)` on old-200 vs new-K-capped fixture; assert the diversified dish ID list is identical (the pre-cap must not change the top-3/restaurant the JS picks). |
| SC#4 (trigger coverage) | INSERT/UPDATE/DELETE on 3 tables call invalidate-cache | (a) Migration 176 parses; (b) **trigger-catalog assertion** — a SQL snippet the operator runs on a prod CLONE/branch: `SELECT event_object_table, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_name LIKE 'trg_invalidate_cache%'` must show 9 rows (3 tables × INSERT/UPDATE/DELETE) AFTER; (c) DELETE-path: Deno test of `invalidate-cache` parsing a `{type:'DELETE', old_record:{...}, record:null}` body resolves the per-restaurant key from `old_record`. |
| SC#4 (CORS) | `invalidate-cache` CORS locked | Confirmation only (D-10) — already shipped Phase 2 via `_shared/cors.ts` (`invalidate-cache/index.ts:17,45`). Assert `buildCorsHeaders` is wired (grep). |

### Sampling
- **Per task commit:** `deno check` on edited edge files; SQL parse of edited migration.
- **Per wave merge:** byte/row-count harness + behavior-preserving diversified-output assertion.
- **Phase gate:** all migrations authored + REVERSE-paired + dry-run validated; operator checklist (Vault secret, dashboard-webhook disable, recall validation) handed off.

### Wave 0 Gaps
- [ ] Representative multi-restaurant candidate fixture (≥3 restaurants, ≥8 dishes each) for the §3 byte/row + behavior-preserving harness — none exists (F-26). Author as a JSON fixture.
- [ ] Deno test harness for the tiered-loop stub + DELETE-path body parsing — none exists. Minimal, targeted (allowed under minimal-tests posture for a behavior-preserving seam, cf. RFCT-01 SC#4 precedent).

*(No framework install needed — Deno is available per MEMORY `edge_fn_deno_tests`.)*

## Security Domain

> security_enforcement not explicitly false → included. This phase adds a backend→edge HTTP trigger with a service-role credential.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Trigger→edge call authed with service-role JWT from Vault (migration 132 pattern); never hardcoded |
| V6 Cryptography / Secrets | yes | `vault.decrypted_secrets` — never inline the JWT in the function body (the exact mistake migration 132 fixed, `132:7-19`) |
| V5 Input Validation | partial | `invalidate-cache` already validates `table ∈ {restaurants,menus,dishes}` (`:65`) and ignores unknown tables — keep |
| V4 Access Control | yes | `invalidate-cache` CORS locked to allowlist (Phase 2, D-10); trigger is `SECURITY DEFINER` — scope is the cache flush only |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hardcoded service JWT in migration | Information Disclosure | Vault lookup (`132:46-48`) — the migration body contains only the secret *name* |
| Unauthenticated cache-flush endpoint | Denial of Service | CORS allowlist (Phase 2) + service-role Bearer required; `invalidate-cache` is webhook-only |
| Trigger failure blocks writes | Availability | Fire-and-forget `net.http_post` + NULL-key WARNING fallback (`132:50-53`) — never blocks the originating write |

---

## Open Questions for the Planner

1. **iterative_scan recall + latency (operator-gated, D-04).** Whether `relaxed_order` + the chosen `ef_search=400`/`max_scan_tuples=20000` actually improves recall without blowing latency can only be measured on prod data. The migration is authored + dry-run; the operator validates and decides to keep. Plan a `checkpoint:human-verify` for prod recall validation. **Not resolvable without prod.**

2. **Exact tuning values are judgment calls.** Tier fractions `[0.25,0.5,1.0]`, POOL_TARGET=100, K=8, ef_search=400, max_scan_tuples=20000, scan_mem_multiplier=2 are all defensible starting points (rationale in §1–§3) but flagged tunable in CONTEXT's Claude's-Discretion. The planner should keep them as named constants so the operator can tune post-deploy.

3. **Dashboard-webhook disable timing.** The operator must disable/delete the existing untracked dashboard Database Webhook when applying migration 176, or both fire (harmless double-flush). This is an operator runbook step, not code — confirm it lands in the apply checklist.

4. **Project ref URL hardcode.** §4 hardcodes `https://tqroqqvxabolydyznewa.supabase.co/.../invalidate-cache` matching migration 132:43. Confirm this is the correct/only project ref (it is the one already in-repo). If a non-prod environment needs a different ref, the operator edits the constant — same as migration 132 today.

## Sources

### Primary (HIGH confidence)
- pgvector v0.8.0 README (raw.githubusercontent.com/pgvector/pgvector/v0.8.0/README.md) — iterative_scan modes, `hnsw.max_scan_tuples` (20000), `hnsw.scan_mem_multiplier` (1), `hnsw.ef_search` (40), "filtering applied after index scan", "ef_search ≥ 2× LIMIT"
- PostgreSQL CREATE FUNCTION docs (postgresql.org/docs/current/sql-createfunction.html) — `SET` clause applies on function entry, restored at exit (proves GUC covers the CTE scan)
- Codebase (all file:line verified this session): `feed/index.ts`, `invalidate-cache/index.ts`, migrations 132, 135, 136, 167, 169, 170 (+ REVERSE), `ls` of migrations dir

### Secondary (MEDIUM confidence)
- WebSearch: ALTER FUNCTION SET / proconfig per-function GUC semantics (corroborates the postgres docs)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ALTER FUNCTION ... SET a, SET b` comma-list parses on the prod pg version | §1 | LOW — Pitfall 1 gives the one-statement-per-GUC fallback |
| A2 | The project ref `tqroqqvxabolydyznewa` is the correct invalidate-cache target | §4 | LOW — taken verbatim from migration 132:43 (same project); operator edits if wrong |
| A3 | Wider radius tiers are strict supersets (replace, not merge is safe) | §2 | LOW — same filters, only `p_radius_m` grows; `ST_DWithin` is monotonic in radius |
| A4 | K=8 keeps diversified output identical for representative inputs | §3 | MEDIUM — proxy ordering ≠ final JS score; validated by the behavior-preserving harness (§6); operator can raise K |
| A5 | ef_search=400 / max_scan_tuples=20000 are good starting points | §1 | MEDIUM — operator-gated recall validation is the real arbiter (Open Q1) |

**Empty-table note:** A1–A3 are LOW risk with explicit fallbacks; A4–A5 are MEDIUM and explicitly operator-gated — no claim is presented as verified fact where it is a judgment call.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all in-repo, pinned
- Tiered loop (§2): HIGH — RPC signature + call site read directly (`169:41-55`, `feed/index.ts:881`)
- iterative_scan (§1): HIGH on mechanics (pgvector README + pg docs); MEDIUM on exact values (operator-gated)
- Pre-cap (§3): HIGH on placement (CTE read at `169:101-307`); MEDIUM on K (judgment call, harness-gated)
- Cache triggers (§4): HIGH — exact in-repo pattern (migrations 132/135) reused
- REVERSE pairing (§5): HIGH — filenames + next number verified by `ls`

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (pgvector 0.8.0 prod-pinned; codebase claims stable until the migrations land)

# Project Research Summary

**Project:** EatMe — Codebase Hardening
**Domain:** Brownfield tech-debt remediation (Supabase + Expo/RN + Next.js + Deno edge functions)
**Researched:** 2026-06-18
**Confidence:** HIGH

## Executive Summary

This is a brownfield hardening milestone — remediating the findings in `.planning/codebase/CONCERNS.md`, not building product features. Research confirms most fixes are well-understood and low-risk *if sequenced correctly and gated by assessment*, but a few carry high blast radius (silent data exposure or data loss) and must be guarded explicitly.

The dominant theme is **assessment-first**: several findings are genuinely uncertain against live state — RLS may already be enabled on the behavioral tables, the cache-invalidation webhook may already cover the needed events, migration 169 already partially fixed the geo timeout, and the prod pgvector version gates whether the cleanest perf fix is even available. These must be verified with read-only queries (`pg_tables.rowsecurity`, `pg_policies`, `pg_depend`, `extversion`) before any fix is authored, so we don't "fix" already-resolved items or break working ones.

The recommended approach: one strictly-ordered spine (ingredient-pipeline teardown B→C → shared type regen) with everything else (CORS, RLS, dep pins, dead-code removal, perf, refactors) running as independent parallel tracks. All DB changes are authored + dry-run only (stage-don't-apply); the operator deploys manually.

## Key Findings

### Recommended Stack

The biggest stack insight: for the edge-function dependency findings, the best "pin" is often *removal/replacement*. Pin once, uniformly, across all functions.

**Core technologies:**
- **`Deno.serve` (native)** — replaces the deprecated `deno.land/std@0.168.0/http/server.ts` import entirely; std moved to JSR (`@std/http` is 1.1.x). Cleaner than upgrading the import.
- **`jsr:@supabase/supabase-js@2.108.2` (exact pin)** — JSR is now the officially recommended Deno path (replaces esm.sh); functions currently drift between `@2`, `@2.39.3`, etc. Pin one exact version everywhere.
- **`@upstash/redis@1.38.0` (exact pin)** — `feed/` already pins this; only `invalidate-cache` uses `@latest` (one-line fix).
- **RLS policy form `(select auth.uid()) = <owner_col>` + btree index on the owner column** — the subselect caches as an InitPlan (100x+ on large tables; Supabase lint flags the bare `auth.uid()` form).
- **pgvector 0.8.0 `hnsw.iterative_scan`** — fixes filtered-ANN returning too few rows; verify prod `extversion` before relying on the GUC, else use the tiered-radius fallback.

See `STACK.md` for versions + rationale (all verified against live registries 2026-06-18).

### Expected Features (Hardening Baselines)

Reframed from product features to production-hardening practices.

**Must have (table stakes — all map to CONCERNS findings):**
- RLS enabled + owner policy on every behavioral table (highest severity)
- CORS allowlist on `feed` / `enrich-dish` / `invalidate-cache` (no wildcard in prod)
- Prod-write guard on `infra/scripts`
- Exact-pinned edge-function dependencies
- Event-driven feed-cache invalidation covering INSERT/UPDATE/DELETE
- DB types regenerated in sync with schema

**Should have (competitive differentiators):**
- Automated RLS regression test (high ROI — the one place a solo operator can't eyeball regressions; TESTING.md already has the anon-deny pattern)
- SQL-side ranking/diversity pushdown for the feed (secondary, behavior-sensitive)

**Defer / anti-features (respect solo + minimal-tests constraint):**
- Broad unit/component test-coverage push, heavy observability stack, microservice extraction, full geo-aware ANN rebuild, CI/PR gates (contradicts commit-straight-to-main), auto-applying migrations to prod.

See `FEATURES.md`.

### Architecture Approach

The work splits into one sequenced spine and several independent tracks.

**Major components / work areas:**
1. **Ingredient teardown spine** — Phase B (mig 151, already authored) drops inert triggers; then Phase C drops orphaned tables (child→parent, explicit `RESTRICT` order) then columns; then regenerate types once (also closes the stale-types finding). `pnpm check-types` is the load-bearing verification substitute for no-local-psql.
2. **Geo-vector fix** — root cause is geo-filter-then-rank making the HNSW index unusable. Recommend (A) edge-function tiered/expanding radius now (no migration, no mobile change, cheapest win) → (B) per-restaurant centroid + restaurant-level ANN later. Reject true ANN-first (empties geo-local feeds).
3. **filterStore split** — Zustand *slice creators* under the existing store; keep the public API and the hand-rolled `saveFilters`/`loadFilters` AsyncStorage shape byte-identical (it is NOT `persist` middleware — no version/migrate safety net). Extract order: types/defaults → selectors → presentational children → action slices → persistence seam last.
4. **Cache invalidation** — mostly already built (`invalidate-cache` busts `feed:v2:*` via DB webhook); the gap is event coverage (verify INSERT/DELETE, not just UPDATE) + its own wildcard CORS. Widen the webhook, don't rebuild.

See `ARCHITECTURE.md`.

### Critical Pitfalls

1. **RLS `ENABLE` without a co-located `CREATE POLICY` = silent deny-all** — instantly breaks mobile favorites/interactions as empty results (no error). Enable + policy must land atomically; map each table's caller (mobile-direct vs service-role-only) first.
2. **`DROP ... CASCADE` in ingredient Phase C** — `canonical_ingredients` is an FK target; CASCADE can transitively drop live objects on the `dishes` lineage, irreversibly, on an unrehearsed manual deploy. Use `pg_depend` pre-flight + ordered `RESTRICT` drops; treat Phase C as one-way (snapshot first).
3. **Corrupting persisted mobile filters when splitting `filterStore.ts`** — any rename/partialize change to serialized fields silently wipes every installed user's saved filters on update, invisible to code review (no emulator). Keep the serialization shape identical.
4. **Deno import break** — dropping `std@0.168.0/http/server` is a runtime-only break; switch to `Deno.serve` and smoke-test each function on deploy.
5. **CORS lockdown mis-modeling React Native** — RN sends no `Origin` header; an overly strict allowlist can break the mobile client and admin preflight. Model both callers before locking.

See `PITFALLS.md` (14 pitfalls with warning signs + prevention + phase mapping).

## Implications for Roadmap

Suggested phase structure (Fine granularity → these may split further into per-finding phases/plans):

### Phase 1: Assessment & Findings Register
**Rationale:** Several findings are uncertain against live state; verifying first prevents fixing already-resolved or breaking working items.
**Delivers:** Read-only audit (RLS status, pgvector version, webhook event coverage, persist boundaries, web-portal-deletion residue) → findings register with per-item verdicts.
**Avoids:** Wasted/duplicate work; silent-deny-all and CASCADE foot-guns (informs later phases).

### Phase 2: Security Hardening
**Rationale:** Highest severity; mostly independent of the teardown spine.
**Delivers:** CORS allowlist (feed/enrich-dish/invalidate-cache), RLS enable+policy on behavioral tables (atomic), `infra/scripts` prod-write guard.
**Avoids:** RLS silent deny-all; RN/preflight CORS breakage.

### Phase 3: Edge Dependencies & Dead Code
**Rationale:** Independent, low-risk, fast wins.
**Delivers:** `Deno.serve` migration, exact dep pins, remove dead map view-mode branch, fix `enrich-dish` stale comments, finish web-portal residual doc cleanup.

### Phase 4: Schema Teardown Spine (sequenced)
**Rationale:** The ONE strictly-ordered chain.
**Delivers:** Ingredient Phase B (triggers) → snapshot → Phase C (tables→columns) → DishKind shim removal (v2 first) → regenerate DB types once.
**Avoids:** DROP CASCADE data loss; type drift.

### Phase 5: Performance & Cache
**Rationale:** Independent; tiered-radius needs no migration.
**Delivers:** `generate_candidates` tiered-radius fix (+ assess hnsw.iterative_scan), feed Stage-2 payload reduction, widen cache-invalidation event coverage.

### Phase 6: Big-File Refactors (behavior-preserving)
**Rationale:** Highest regression risk (mobile, no emulator); do after the surface is otherwise hardened.
**Delivers:** Split filterStore / BasicMapScreen / DailyFilterModal / ReviewDishEditor; optional targeted filterStore-persistence test.

### Phase Ordering Rationale
- Assessment first because verdicts gate scope of every later phase.
- Phases 2, 3, 5 are parallelizable; Phase 4 is the only strictly ordered chain; Phase 6 last (regression risk).
- Type regen happens once, in Phase 4, shared with the stale-types finding.

### Research Flags
Phases likely needing deeper per-phase research/verification:
- **Phase 2:** confirm actual RLS state + each table's caller before writing policies.
- **Phase 4:** `pg_depend` dependency audit before any DROP.
- **Phase 5:** confirm prod pgvector `extversion`; benchmark tiered radius.

Phases with standard patterns (lighter research):
- **Phase 3:** well-documented Deno/dep changes.
- **Phase 6:** mechanical splits — risk is verification (on-device), not novelty.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against live JSR/GitHub/npm + official docs 2026-06-18 |
| Features | HIGH | Directly mapped to CONCERNS findings + PROJECT.md constraints |
| Architecture | HIGH | Grounded in codebase map + existing migrations (151, 169, 136) |
| Pitfalls | HIGH | Stack-specific, tied to actual file/line + live-state risks |

**Overall confidence:** HIGH

### Gaps to Address
- **Live RLS state unknown** — resolve in Phase 1 via `pg_tables.rowsecurity` / `pg_policies`.
- **Prod pgvector version unknown** — resolve in Phase 1/5 via `extversion`; gates the GUC fix.
- **Webhook event coverage unknown** — resolve in Phase 1; may shrink the cache-invalidation work.
- **No local psql / no mobile emulator** — verification leans on `pnpm check-types`, dry-run migrations, and operator on-device testing.

## Sources

### Primary (HIGH confidence)
- Supabase Edge Functions + RLS performance docs — CORS, `(select auth.uid())` InitPlan pattern
- `@supabase/supabase-js` on JSR; `@std/http` on JSR / denoland/std releases — current versions
- pgvector 0.8.0 release notes — `hnsw.iterative_scan`
- Zustand slices-pattern docs — store splitting
- `.planning/codebase/` map + migrations 151, 163, 169, 136 — current state

---
*Research completed: 2026-06-18*
*Ready for roadmap: yes*

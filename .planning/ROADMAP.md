# Roadmap: EatMe — Codebase Hardening

## Overview

This milestone remediates the findings in `.planning/codebase/CONCERNS.md` across four areas (security/bugs, debt/deps, perf/scaling, refactors), leaving the codebase more secure, leaner, and easier to evolve — with zero regression to the live mobile discovery experience. The work begins with an assessment phase that verifies each finding against live state (RLS status, pgvector version, webhook coverage), because several findings are explicitly uncertain. From there, most work runs as independent, parallelizable tracks (CORS, RLS, dep pins, dead-code, perf), with one strictly-ordered spine — the ingredient-pipeline teardown (triggers → tables → columns → type regen) — that must not be reordered. Behavior-preserving refactors come last because they carry the highest regression risk (mobile, no emulator). All DB migrations and scripts are authored + dry-run only; the operator deploys to prod manually (stage-don't-apply).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Parallelization:** Phase 1 gates all others. Phases 2, 3, 4, 5, 7 are mutually independent and parallelizable after Phase 1. Phase 6 is a strictly-ordered internal spine. Phases 8, 9, 10 are the refactor track (9 depends on 5).

- [x] **Phase 1: Assessment & Findings Register** - Verify every finding against live code + prod state; verdict each (confirmed / stale / resolved) — completed 2026-06-19
- [ ] **Phase 2: CORS Lockdown** - Restrict `feed` / `enrich-dish` / `invalidate-cache` CORS to an allowlist without breaking the native client or admin preflight
- [ ] **Phase 3: RLS Hardening** - Enable RLS + atomic owner policies on all behavioral tables, InitPlan-safe and indexed
- [ ] **Phase 4: Edge Dependency Pinning & Script Guard** - `Deno.serve` migration, exact dep pins across functions, and a prod-write guard on `infra/scripts`
- [ ] **Phase 5: Dead Code & Doc Cleanup** - Remove the dead map view-mode branch, verify the web-portal deletion, and fix stale comments/docs
- [ ] **Phase 6: Schema Teardown Spine** - Sequenced ingredient teardown (B triggers → C tables → C columns), DishKind shim removal, single type regen
- [ ] **Phase 7: Performance & Cache** - Tiered-radius candidate fix, Stage-2 payload reduction, and widened cache-invalidation event coverage
- [ ] **Phase 8: Mobile Filter Store Refactor** - Split `filterStore.ts` into slices, preserving the public API and persistence shape byte-for-byte
- [ ] **Phase 9: Mobile Map & Modal Refactor** - Decompose `BasicMapScreen.tsx` and `DailyFilterModal.tsx`, behavior-preserving, verified on-device
- [ ] **Phase 10: Admin Editor Refactor** - Decompose `ReviewDishEditor.tsx`, preserving the `admin_confirm_menu_scan` payload contract

## Phase Details

### Phase 1: Assessment & Findings Register

**Goal**: Every in-scope finding has an evidence-backed verdict, and the live-state unknowns that gate later phases are resolved, so no later phase fixes an already-resolved item or breaks a working one.
**Depends on**: Nothing (first phase)
**Requirements**: ASSESS-01, ASSESS-02, ASSESS-03
**Success Criteria** (what must be TRUE):

  1. A findings register exists with a verdict (confirmed / stale / already-resolved) and supporting evidence for every in-scope CONCERNS finding
  2. Live RLS state (`pg_tables.rowsecurity` + `pg_policies`) is captured for every behavioral table, and each table is labeled by caller (mobile-direct vs service-role-only), via read-only queries the operator ran on prod
  3. Prod pgvector `extversion` is recorded (gating whether `hnsw.iterative_scan` is available) and the feed-cache webhook's actual INSERT/UPDATE/DELETE event coverage is documented
  4. The register adjusts downstream phase scope where verdicts come back "stale" or "already-resolved" (e.g. RLS already enabled, webhook already covers all events)

**Plans**: 2/4 plans executed

- [x] 01-01-PLAN.md — Author FINDINGS.md Pass A: 26-row summary table + per-finding detail sections (code-assessable verdicts FINAL; 3 live-state findings PENDING)
- [x] 01-02-PLAN.md — Author the read-only assess-live-state.sql probe (4 blocks + catch-all + guard) and run the Wave-0 static-safety gate
- [x] 01-03-PLAN.md — Operator checkpoint: run the probe on prod, paste back, fill the 3 live-state sections + reconcile code-first vs deployed
- [x] 01-04-PLAN.md — User-gated scope propagation: apply approved ROADMAP/REQUIREMENTS annotations (no renumber)

### Phase 2: CORS Lockdown

**Goal**: The three wildcard-CORS edge functions restrict origins to a configured allowlist for browser callers while continuing to serve the native mobile client (no `Origin` header) and the admin preflight without breakage.
**Depends on**: Phase 1
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):

  1. `feed`, `enrich-dish`, and `invalidate-cache` no longer return `Access-Control-Allow-Origin: *` in prod; they reflect an allowlisted admin origin and add `Vary: Origin`
  2. A request with no `Origin` header (native/curl) still succeeds (auth enforced via existing JWT validation, not CORS) — verified by a no-Origin smoke call
  3. The OPTIONS preflight and the main response return matching CORS headers (including the existing `authorization, x-client-info, apikey, content-type` allow-headers) — verified from a browser-origin admin path

**Plans**: TBD

### Phase 3: RLS Hardening

**Goal**: Every user-owned behavioral table that lacks protection has RLS enabled with a correct owner policy, authored so it cannot silently deny-all the live mobile client and cannot regress query performance.
**Depends on**: Phase 1
**Requirements**: SEC-02
**Success Criteria** (what must be TRUE):

  1. For each behavioral table that Phase 1 flagged as unprotected, a staged migration enables RLS and creates the owner policy in the same file (atomic enable + policy — never split across deploys)
  2. Every authored policy uses the `(select auth.uid()) = <owner_col>` InitPlan form (not bare `auth.uid()`), and the owner column has a btree index created in the same migration
  3. Each policy targets the verified owner column name and only applies to mobile-direct tables (service-role-only tables are left unchanged, since service-role bypasses RLS)
  4. `pnpm check-types` passes and the migration dry-run validates; tables already protected (per the Phase 1 register) are explicitly skipped, not re-enabled

**Scope note (per FINDINGS):** F-11 — all 11 behavioral tables ALREADY have RLS enabled with owner policies in prod (operator probe 2026-06-19; catch-all: only `spatial_ref_sys` (PostGIS) is unprotected). The SEC-02 "enable RLS" gap does not exist in prod, so SC#1's flagged-unprotected set is empty. **Phase 3 is repurposed to CODIFY the existing prod RLS into a tracked migration** — the repo baseline currently has ZERO `ENABLE ROW LEVEL SECURITY` (migrations↔prod drift; a fresh DB built from migrations would come up unprotected). Authored + dry-run only (stage-don't-apply; prod already protected). `dish_analytics` is dish-keyed (no `user_id`) → public-read + service-role, NOT a per-user owner policy. SEC-02 stays open until the codifying migration is authored.

**Plans**: TBD

### Phase 4: Edge Dependency Pinning & Script Guard

**Goal**: Edge functions run on pinned, non-deprecated dependencies and `infra/scripts` cannot reach a prod write path without explicit confirmation.
**Depends on**: Phase 1
**Requirements**: DEBT-05, SEC-03
**Success Criteria** (what must be TRUE):

  1. The `deno.land/std@0.168.0/http/server` import is replaced with native `Deno.serve` across all edge functions, and the `std@0.168.0/testing/asserts` test import is migrated in the same pass
  2. `@supabase/supabase-js` is pinned to one exact JSR version with a single specifier style across all functions, and `@upstash/redis` is exact-pinned everywhere (including `invalidate-cache`)
  3. `infra/scripts` write paths default to dry-run and refuse to mutate prod without an explicit confirmation flag, print the target project ref before any mutation, and preserve the existing dry-run → sample → full workflow
  4. Each migrated function compiles in the local edge runtime and its Deno tests pass (`deno test --node-modules-dir=none -A`); the operator smoke-tests one real call per function on deploy

**Plans**: TBD

### Phase 5: Dead Code & Doc Cleanup

**Goal**: Reachable-only-programmatically dead code is removed and stale references to deleted/abandoned concepts no longer mislead readers or complicate the upcoming map refactor.
**Depends on**: Phase 1
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03
**Success Criteria** (what must be TRUE):

  1. The map restaurant-view-mode dead code is gone — `viewModeStore`, `ViewModeToggle`, and the dead branch in `BasicMapScreen` are removed and `pnpm check-types` passes
  2. The `apps/web-portal` deletion is verified clean against workspace/build, and residual doc references are removed from `CLAUDE.md`, `agent_docs/architecture.md`, `.github/copilot-instructions.md`, and `INTEGRATION_COMPLETE_SUMMARY.md`
  3. `enrich-dish` header comments are corrected to drop ingredient/parent-dish references while preserving language for the triggers migration 151 explicitly kept alive (`trg_enrich_on_dish_change`, `after_dish_embedded`, `trg_enrich_on_option_group_change`)

**Plans**: TBD
**UI hint**: yes

**Scope note (per FINDINGS):** F-03/F-04/F-08 already-resolved — `apps/web-portal` was deleted AND committed (`c1a7e3f`, 2026-06-18), so SC#2's deletion is already done; Phase 5 narrows to **residual-doc cleanup** (`CLAUDE.md`, `agent_docs/architecture.md`, `.github/copilot-instructions.md`, `INTEGRATION_COMPLETE_SUMMARY.md`). SC#1 (CLEAN-01 map dead code) and SC#3 (CLEAN-03 enrich-dish comments) remain fully in scope — phase NOT descoped.

### Phase 6: Schema Teardown Spine

**Goal**: The orphaned ingredient pipeline and the now-isolated DishKind shims are removed in the one strictly-ordered, irreversible-aware sequence, and the generated DB types are regenerated exactly once to match the slimmed schema.
**Depends on**: Phase 1
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Success Criteria** (what must be TRUE):

  1. Phase B (migration 151) drops the inert triggers, preceded by a clean `git grep` pre-flight (zero hits in `apps/` and `infra/supabase/functions/`; web-portal-v2 hits acceptable), with its REVERSE pair authored
  2. Phase C is authored as staged migrations that drop tables then columns in explicit child→parent order using `RESTRICT` (no `CASCADE` as the load-bearing mechanism), preceded by a `pg_depend` dependency-audit query and a data snapshot procedure; Phase C is treated as one-way
  3. `DishKind` / `DISH_KIND_META` usage is removed from `apps/web-portal-v2` (`DishForm.tsx`, `KindSelector.tsx`) FIRST, then the shims + `dish-kinds.test.ts` are deleted from `@eatme/shared`, verified by a consumer grep showing zero remaining importers
  4. DB types are regenerated ONCE after the teardown migrations, the slimmed `types.ts` no longer contains the dropped tables/columns, inline edge-function enum copies are reconciled, and `turbo check-types` passes across all apps

**Plans**: TBD

### Phase 7: Performance & Cache

**Goal**: The feed candidate query stays within `statement_timeout` at the default radius, the Stage-2 response is leaner, and every menu-affecting write busts the feed cache.
**Depends on**: Phase 1
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):

  1. The `feed` edge function wraps the `generate_candidates` RPC in an expanding/tiered-radius loop (no migration, no mobile change, identical response shape), keeping the common dense-urban case fast and bounding worst-case scan size
  2. The `hnsw.iterative_scan` option is assessed against the Phase 1 pgvector version and either applied or explicitly recorded as unavailable (tiered radius remains the fallback)
  3. Feed Stage-2 response payload size is measurably reduced by moving the diversity cap / final sort toward SQL where it helps, with the client response contract unchanged
  4. Cache invalidation covers INSERT / UPDATE / DELETE for `dishes` / `menus` / `restaurants` (webhook event coverage widened per the Phase 1 finding, never a namespace flush-all from a single change), and `invalidate-cache` CORS is confirmed locked (with Phase 2)

**Scope note (per FINDINGS):** F-13 — prod pgvector `extversion=0.8.0` (≥0.8.0) → `hnsw.iterative_scan` IS available; SC#2 can apply it via a session GUC (no extension upgrade). F-21 — the deployed `trg_enrich_on_dish_change` covers INSERT+UPDATE on `dishes` (agrees with migration 135; no DELETE), but the feed-cache `invalidate-cache` webhook is **NOT present in the deployed trigger catalog** on restaurants/menus/dishes → SC#4 must first **locate the actual cache-invalidation wiring** (it is dashboard-configured, not in any migration) before widening event coverage. The existing `feed:v2:*` flush-all-on-every-change vs SC#4's "never flush-all" goal is the design tension to resolve in Phase 7.

**Plans**: TBD

### Phase 8: Mobile Filter Store Refactor

**Goal**: `filterStore.ts` is split into slice creators with the public store API and the hand-rolled AsyncStorage persistence shape preserved byte-for-byte, so no installed user loses their saved filters.
**Depends on**: Phase 1
**Requirements**: RFCT-01
**Success Criteria** (what must be TRUE):

  1. `filterStore.ts` is decomposed into slice creators (defaults/types → selectors → daily actions → permanent actions → persistence seam last) composed in an `index.ts`, with `useFilterStore`'s import path and exported type unchanged for every consumer
  2. The object `saveFilters` serializes and `loadFilters` parses keeps identical field names and nesting — verified by diffing the serialized shape before vs after the split (the partialize boundary stays: permanent persisted, daily session-only)
  3. `pnpm check-types` passes, and the operator confirms on-device that an app opened with pre-existing saved filters retains them across a force-close/reopen (proves the persistence shape is intact)
  4. Any targeted test added is limited to de-risking the persistence-serialization seam (no broad coverage push)

**Plans**: TBD
**UI hint**: yes

### Phase 9: Mobile Map & Modal Refactor

**Goal**: `BasicMapScreen.tsx` and `DailyFilterModal.tsx` are decomposed into smaller hooks and presentational children with all map, location, marker, deep-link, and filter behavior preserved, verified by the operator on-device.
**Depends on**: Phase 5 (dead view-mode branch removed first), Phase 8 (filter store stable)
**Requirements**: RFCT-02, RFCT-03
**Success Criteria** (what must be TRUE):

  1. `BasicMapScreen.tsx` is decomposed into custom hooks (`useMapCamera`, `useLocationPermission`, `useFeedMarkers`) plus presentational children, after the dead view-mode branch from Phase 5 is already gone
  2. `DailyFilterModal.tsx` is decomposed into one presentational sub-component per filter section, with state remaining in `filterStore` (value+onChange props bound to existing daily actions)
  3. `pnpm check-types` passes and the changes are split one refactor per commit so any on-device regression bisects cleanly
  4. The operator's on-device smoke checklist passes (camera centers on location, dish markers render and tap-through, daily filters apply/reset, deep-link opens the correct dish)

**Plans**: TBD
**UI hint**: yes

### Phase 10: Admin Editor Refactor

**Goal**: `ReviewDishEditor.tsx` is decomposed into smaller editor-region components without changing the `admin_confirm_menu_scan` payload contract that its integration test guards.
**Depends on**: Phase 1
**Requirements**: RFCT-04
**Success Criteria** (what must be TRUE):

  1. `ReviewDishEditor.tsx` is split along form regions (`DishFieldsForm`, `ModifierGroupsEditor`, `DishImagePanel`), delegating to existing modifier helpers, not along the submit boundary
  2. A single `buildConfirmPayload()` and a single submit call remain so the RPC contract stays in one place, and the payload shape is unchanged
  3. `turbo check-types` passes and the existing `admin-confirm-rpc.test.ts` integration test still passes as the regression gate

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Phase 1 gates all others; Phases 2-7 are parallelizable after Phase 1; Phase 9 also depends on Phases 5 and 8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Assessment & Findings Register | 4/4 | Complete | 2026-06-19 |
| 2. CORS Lockdown | 0/TBD | Not started | - |
| 3. RLS Hardening | 0/TBD | Not started | - |
| 4. Edge Dependency Pinning & Script Guard | 0/TBD | Not started | - |
| 5. Dead Code & Doc Cleanup | 0/TBD | Not started | - |
| 6. Schema Teardown Spine | 0/TBD | Not started | - |
| 7. Performance & Cache | 0/TBD | Not started | - |
| 8. Mobile Filter Store Refactor | 0/TBD | Not started | - |
| 9. Mobile Map & Modal Refactor | 0/TBD | Not started | - |
| 10. Admin Editor Refactor | 0/TBD | Not started | - |

# Requirements: EatMe — Codebase Hardening

**Defined:** 2026-06-18
**Core Value:** Documented CONCERNS.md concerns are fixed or have a verified, deliberate disposition — with zero regression to the live mobile discovery experience.

## v1 Requirements

Each finding is assessed (validated against current code + live DB) before being addressed.

### Assessment

- [x] **ASSESS-01**: Every in-scope CONCERNS finding has a verdict in a findings register (confirmed / stale / already-resolved), with evidence
- [x] **ASSESS-02**: Live RLS state (`rowsecurity` + existing policies) is captured for all behavioral tables before any RLS change is authored
- [x] **ASSESS-03**: Prod pgvector extension version and feed-cache webhook event coverage are captured before perf/cache work begins

### Security

- [x] **SEC-01**: `feed`, `enrich-dish`, and `invalidate-cache` edge functions restrict CORS to a configured allowlist (no wildcard in prod) without breaking the mobile client (no `Origin` header) or admin preflight
- [x] **SEC-02**: RLS is enabled with an owner policy on every user-owned behavioral table (favorites, dish_opinions, user_dish_interactions, user_behavior_profiles, dish_analytics, user_visits, session_views, etc.); policies use `(select auth.uid())` with an index on the owner column; enable + policy land atomically in the same migration
- [x] **SEC-03**: `infra/scripts` production-mutation scripts refuse to run any write path without explicit dry-run/confirmation clearance

### Cleanup & Dead Code

- [x] **CLEAN-01**: Dead map restaurant-view-mode code is removed (`viewModeStore`, `ViewModeToggle`, the `BasicMapScreen` branch) — on-device UI confirmation pending (`05-HUMAN-UAT.md`)
- [x] **CLEAN-02**: The `apps/web-portal` deletion is verified clean (workspace/build) and residual doc references are removed (`CLAUDE.md`, `agent_docs/architecture.md`, `.github/copilot-instructions.md`, `INTEGRATION_COMPLETE_SUMMARY.md`)
- [x] **CLEAN-03**: `enrich-dish` header comments are corrected to drop ingredient/parent-dish references

### Debt & Dependencies

- [x] **DEBT-01**: Ingredient-pipeline triggers are dropped (Phase B) via a staged, dry-run migration
- [x] **DEBT-02**: Orphaned ingredient-pipeline tables and columns are dropped (Phase C) via a staged migration with a `pg_depend` pre-flight and ordered `RESTRICT` drops (child → parent); snapshot first
- [x] **DEBT-03**: `DishKind` / `DISH_KIND_META` usage is removed from `apps/web-portal-v2` (`DishForm.tsx`, `KindSelector.tsx`), then the shims + `dish-kinds.test.ts` are deleted from `@eatme/shared`
- [x] **DEBT-04**: `@eatme/database` types are regenerated in sync with the current schema (post-teardown) and committed
- [x] **DEBT-05

**: Edge-function dependencies are pinned — `deno.land/std@0.168.0/http/server` replaced with native `Deno.serve`; `@supabase/supabase-js` pinned to one exact JSR version and `@upstash/redis` exact-pinned across all functions

### Performance & Scaling

- [ ] **PERF-01**: `generate_candidates` returns within `statement_timeout` at the default radius via a tiered/expanding-radius approach (no migration required); `hnsw.iterative_scan` assessed once the prod pgvector version is confirmed
- [ ] **PERF-02**: Feed Stage-2 response payload size is reduced (diversity cap / final sort moved toward SQL where it measurably helps)
- [ ] **PERF-03**: Feed-cache invalidation covers INSERT / UPDATE / DELETE for menu-affecting changes (webhook event coverage widened), and `invalidate-cache` CORS is locked down (with SEC-01)

### Refactors (behavior-preserving)

- [ ] **RFCT-01**: `filterStore.ts` is split into slice creators, preserving the public store API and the hand-rolled `saveFilters`/`loadFilters` AsyncStorage serialization shape byte-for-byte
- [ ] **RFCT-02**: `BasicMapScreen.tsx` is decomposed into smaller units (after CLEAN-01), behavior-preserving, verified on-device
- [ ] **RFCT-03**: `DailyFilterModal.tsx` is decomposed into smaller units, behavior-preserving, verified on-device
- [ ] **RFCT-04**: `ReviewDishEditor.tsx` (admin) is decomposed into smaller units, behavior-preserving

## v2 Requirements

Deferred to a future cycle. Tracked but not in this roadmap.

### Performance

- **PERF-V2-01**: Geo-aware ANN rebuild — per-restaurant centroid + restaurant-level vector search (the durable fix beyond tiered radius)
- **PERF-V2-02**: Full SQL-side ranking pushdown (beyond payload reduction)

### Quality

- **QUAL-V2-01**: Automated RLS regression test suite (anon-deny pattern) — high-ROI differentiator, deferred to keep this cycle minimal-test
- **QUAL-V2-02**: Deno std → JSR full modernization beyond the import swap

## Out of Scope

| Feature | Reason |
|---------|--------|
| Applying migrations/scripts directly to prod | Stage-don't-apply — operator deploys manually (dry-run → sample → full) |
| Broad automated test-coverage push | Solo/single-operator app; ROI not there this cycle (minimal targeted tests only) |
| Deleting `apps/web-portal-v2` | On ice — kept for future revival |
| Allergen / dietary-tag / religious features | Abandoned — protein-based discovery app |
| Reintroducing parent/variant dish model | Replaced by modifier groups (dropped migration 163) |
| New end-user product features | This is a hardening cycle, not a feature cycle |

## Traceability

Each requirement maps to exactly one phase. See ROADMAP.md for phase details.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ASSESS-01 | Phase 1 | Complete |
| ASSESS-02 | Phase 1 | Complete |
| ASSESS-03 | Phase 1 | Complete |
| SEC-01 | Phase 2 | Complete |
| SEC-02 | Phase 3 | Complete |
| SEC-03 | Phase 4 | Complete |
| DEBT-05 | Phase 4 | Complete |
| CLEAN-01 | Phase 5 | Complete |
| CLEAN-02 | Phase 5 | Complete |
| CLEAN-03 | Phase 5 | Complete |
| DEBT-01 | Phase 6 | Complete |
| DEBT-02 | Phase 6 | Complete |
| DEBT-03 | Phase 6 | Complete |
| DEBT-04 | Phase 6 | Complete |
| PERF-01 | Phase 7 | Pending |
| PERF-02 | Phase 7 | Pending |
| PERF-03 | Phase 7 | Pending |
| RFCT-01 | Phase 8 | Pending |
| RFCT-02 | Phase 9 | Pending |
| RFCT-03 | Phase 9 | Pending |
| RFCT-04 | Phase 10 | Pending |

**Coverage:**

- v1 requirements: 21 total
- Mapped to phases: 21 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-18*
*Last updated: 2026-06-20 — Phase 5 complete: CLEAN-01/02/03 Complete. CLEAN-01 removed the map restaurant-view-mode dead code (3 files deleted, 6 pruned; mobile tsc green, zero residue) — on-device UI confirmation pending (`05-HUMAN-UAT.md`). CLEAN-02 purged residual `apps/web-portal` refs from 7 agent docs (zero live imports; web-portal-v2 + provenance preserved; CLAUDE.md DishKind line deferred to Phase 6). CLEAN-03 corrected the `enrich-dish` header (deno check green). No renumber; 21 requirements / 10 phases intact.*

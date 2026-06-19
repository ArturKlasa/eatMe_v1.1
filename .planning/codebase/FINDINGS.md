# Codebase Findings Register

**Assessment Date:** 2026-06-18

This is the **verdict overlay** on `.planning/codebase/CONCERNS.md` (the concerns audit dated 2026-06-19). Each finding below carries a stable ID `F-01 … F-26` that maps one-to-one, in document order, back to a `### ` finding in CONCERNS.md. A reader can go finding-by-finding from CONCERNS.md into this register and find a verdict for every concern.

**Legend — verdict vocabulary (D-06):** `confirmed` (issue is real and present on current HEAD) · `stale` (CONCERNS describes something no longer accurate) · `already-resolved` (the work CONCERNS recommends is already done) · `out-of-scope` (deliberately excluded this milestone, with a recorded reason). Verdicts may carry a short modifier (e.g. `confirmed — per-table PENDING`).

**Live-state rows:** Three findings (F-11 RLS, F-13 pgvector, F-21/PERF-03 webhook events) carry a code-first determination but defer a prod-only detail to the operator checkpoint (Plan 03, D-10). Their Evidence is marked `PENDING — live-state, see assess-live-state.sql Block N` and is filled once the operator pastes prod output. The phase is not fully "done" until those sections are populated.

CONCERNS.md is dated 2026-06-19 and has **drifted** — every non-PENDING code-assessable verdict was re-grepped against current HEAD (commit at assessment time), and cites a file:line that resolves NOW, not the stale CONCERNS line numbers. Verified drift corrections (web-portal already committed `c1a7e3f`, enrich-dish CORS at line 31 not 33, dish_analytics has no `user_id`) are baked into the detail sections.

## Summary

| ID | CONCERNS finding (title) | area | requirement ID | verdict | gated phase | scope impact |
|----|--------------------------|------|----------------|---------|-------------|--------------|
| F-01 | Ingredient Pipeline — Orphaned DB Schema | Tech Debt | DEBT-01 / DEBT-02 | confirmed | Phase 6 | Phase 6 work stands — migration 151 authored, tables still in schema; triggers + schema drop pending |
| F-02 | DishKind / DISH_KIND_META Shims | Tech Debt | DEBT-03 | confirmed | Phase 6 | Last importer is `apps/web-portal-v2/.../KindSelector.tsx` (web-portal gone, v2 remains on-ice) — shims cannot be removed until Phase 6 updates v2 |
| F-03 | apps/web-portal Onboarding-Only App | Tech Debt | (none) | already-resolved | Phase 5 | `apps/web-portal` deleted AND committed `c1a7e3f` (2026-06-18); Phase 5 = residual-doc cleanup only |
| F-04 | Two Admin Codepaths | Tech Debt | (none) | already-resolved | (none) | web-portal deleted `c1a7e3f`; `apps/admin` is the sole admin surface — no codepath ambiguity remains |
| F-05 | apps/web-portal-v2 Dormant / On-Ice | Tech Debt | (none) | out-of-scope | (none) | On-ice, kept for revival (REQUIREMENTS Out-of-Scope); do NOT delete; blocks full DishKind shim removal until Phase 6 updates KindSelector |
| F-06 | enrich-dish Stale Comment References | Tech Debt | CLEAN-03 | confirmed | Phase 5 | Header lines 9 + 14–15 reference the retired ingredient / parent-dish pipeline; correct in Phase 5 |
| F-07 | packages/database/src/types.ts Stale Generated Types | Tech Debt | DEBT-04 | confirmed | Phase 6 | 3226 lines; regenerate ONCE post-teardown (Phase 6) — assess-only here, do not regenerate now |
| F-08 | apps/web-portal Dish Create/Edit Broken | Known Bugs | (none) | already-resolved | (none) | App deleted `c1a7e3f`; the broken-by-design dish-form path no longer exists |
| F-09 | Map Restaurant View Mode Disabled | Known Bugs | CLEAN-01 | confirmed | Phase 5 | `viewModeStore` + `ViewModeToggle` + dead `BasicMapScreen` branch present; remove in Phase 5 |
| F-10 | Feed Edge Function Wildcard CORS | Security | SEC-01 | confirmed | Phase 2 | Wildcard CORS `'*'` at `feed/index.ts:20`, `enrich-dish/index.ts:31`, `invalidate-cache/index.ts:20`; lock to allowlist in Phase 2 |
| F-11 | dish_analytics / User Behavioral Tables RLS Audit Gap | Security | SEC-02 / ASSESS-02 | confirmed — per-table PENDING | Phase 3 | Zero `ENABLE ROW LEVEL SECURITY` for behavioral tables in any migration or baseline dump; per-table verdict PENDING (Block 1). `dish_analytics` is dish-keyed NOT user-owned — Phase 3 must NOT add an owner policy on it |
| F-12 | infra/scripts Production Mutation Scripts Without Guard | Security | SEC-03 | confirmed | Phase 4 | `replay-menu-scan-ab.ts` / `apply-phase6-flag-fixes.ts` hit prod service-role with manual `--dry-run` only; add a harness gate in Phase 4 |
| F-13 | generate_candidates Radius Timeout | Performance | PERF-01 | confirmed — perf-detail PENDING | Phase 7 | Migration 169 pushdown exists; `hnsw.iterative_scan` gating PENDING (Block 2, pgvector version) |
| F-14 | feed/index.ts Single-Threaded JS Ranking Pass | Performance | PERF-02 | confirmed | Phase 7 | Stage-2 ranking runs in JS in the edge function; payload reduction is a Phase 7 design call |
| F-15 | packages/database/src/types.ts 3226-Line File | Performance | DEBT-04 | confirmed — duplicate of F-07 | Phase 6 | Same artifact as F-07; regen post-teardown sheds orphaned types — no separate work item |
| F-16 | BasicMapScreen.tsx 608 Lines | Fragile Areas | RFCT-02 | confirmed | Phase 9 | Decompose AFTER the CLEAN-01 dead branch is removed (Phase 5); behavior-preserving, verify on-device |
| F-17 | filterStore.ts 927 Lines | Fragile Areas | RFCT-01 | confirmed | Phase 8 | Split into slice creators; preserve the AsyncStorage persistence shape byte-for-byte |
| F-18 | DailyFilterModal.tsx 894 Lines | Fragile Areas | RFCT-03 | confirmed | Phase 9 | Decompose per filter section; behavior-preserving, verify on-device |
| F-19 | ReviewDishEditor.tsx 1258 Lines | Fragile Areas | RFCT-04 | confirmed | Phase 10 | Decompose along form regions; preserve the `admin_confirm_menu_scan` RPC contract |
| F-20 | Vector Candidate Generation Dense Urban | Scaling Limits | (none) | out-of-scope | (none) | Durable geo-aware ANN rebuild is PERF-V2-01 (REQUIREMENTS v2); Phase 7 tiered-radius is the v1 mitigation tracked under F-13 |
| F-21 | Upstash Redis Feed Cache Single Namespace | Scaling Limits | PERF-03 | confirmed — tension flagged | Phase 7 | `invalidate-cache` already flush-alls `feed:v2:*` on every change; the "never flush-all" goal is a Phase 7 design call — flagged as scope-impact, NOT pre-judged. Deployed INSERT/UPDATE/DELETE event coverage PENDING (Block 3) |
| F-22 | deno.land/std@0.168.0 Pinned Old Version | Dependencies at Risk | DEBT-05 | confirmed | Phase 4 | `std@0.168.0/http/server` imported in every edge function; replace with native `Deno.serve` |
| F-23 | esm.sh/@supabase/supabase-js@2 Unpinned Minor | Dependencies at Risk | DEBT-05 | confirmed | Phase 4 | Unpinned `@2` AND pinned `@2.39.3` coexist across functions; `@upstash/redis@latest` (invalidate-cache) vs `@1.38.0` elsewhere — pin all to exact versions |
| F-24 | apps/mobile Zero Automated Tests | Test Coverage Gaps | (none) | out-of-scope | (none) | Broad test-coverage push out of scope (REQUIREMENTS Out-of-Scope, minimal-tests decision); one targeted persistence-seam test allowed in Phase 8 (RFCT-01 SC#4) |
| F-25 | apps/admin No Component Tests, E2E Only | Test Coverage Gaps | (none) | out-of-scope | (none) | Broad test-coverage push out of scope (REQUIREMENTS Out-of-Scope); admin is single-operator, breakage caught quickly |
| F-26 | infra/supabase/functions No Deno Unit Tests for feed/ | Test Coverage Gaps | (none) | out-of-scope | (none) | Broad test-coverage push out of scope (REQUIREMENTS Out-of-Scope, minimal-tests decision) |

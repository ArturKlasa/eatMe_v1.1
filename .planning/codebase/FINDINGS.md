# Codebase Findings Register

**Assessment Date:** 2026-06-18

This is the **verdict overlay** on `.planning/codebase/CONCERNS.md` (the concerns audit dated 2026-06-19). Each finding below carries a stable ID `F-01 … F-26` that maps one-to-one, in document order, back to a `### ` finding in CONCERNS.md. A reader can go finding-by-finding from CONCERNS.md into this register and find a verdict for every concern.

**Legend — verdict vocabulary (D-06):** `confirmed` (issue is real and present on current HEAD) · `stale` (CONCERNS describes something no longer accurate) · `already-resolved` (the work CONCERNS recommends is already done) · `out-of-scope` (deliberately excluded this milestone, with a recorded reason). Verdicts may carry a short modifier (e.g. `confirmed — per-table PENDING`).

**Live-state rows (RESOLVED 2026-06-19, Plan 03 / D-10):** Three findings (F-11 RLS, F-13 pgvector, F-21/PERF-03 webhook events) carried a code-first determination but deferred a prod-only detail to the operator checkpoint. The operator ran `infra/scripts/assess-live-state.sql` once on prod and pasted the full output back; all three sections are now FINAL (no deferred markers remain). Net effect: F-11 flipped to `already-resolved` (RLS enabled in prod on all 11 behavioral tables, with a migrations↔prod drift recorded), F-13 records pgvector `0.8.0` (so `hnsw.iterative_scan` is available), and F-21/PERF-03 reconciles the deployed enrich trigger (agrees with code-first) while honestly flagging that the feed-cache `invalidate-cache` webhook is NOT visible as a deployed table trigger.

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
| F-11 | dish_analytics / User Behavioral Tables RLS Audit Gap | Security | SEC-02 / ASSESS-02 | already-resolved (prod) — migrations↔prod DRIFT | Phase 3 | Live: all 11 behavioral tables have `rowsecurity=true` + owner policies; catch-all shows only `spatial_ref_sys` unprotected (PostGIS system table) → NO prod RLS gap. But ZERO `ENABLE ROW LEVEL SECURITY` in any migration/baseline → prod was configured out-of-band (drift). `dish_analytics` is dish-keyed NOT user-owned (Block 4 absence) — Phase 3 must NOT add an owner policy on it. Phase 3 "enable RLS" work is descoped; residual = CODIFY existing prod RLS into a migration vs. empty Phase 3 (user-gated at Plan 04) |
| F-12 | infra/scripts Production Mutation Scripts Without Guard | Security | SEC-03 | confirmed | Phase 4 | `replay-menu-scan-ab.ts` / `apply-phase6-flag-fixes.ts` hit prod service-role with manual `--dry-run` only; add a harness gate in Phase 4 |
| F-13 | generate_candidates Radius Timeout | Performance | PERF-01 | confirmed | Phase 7 | Migration 169 pushdown exists; live pgvector `extversion=0.8.0` (≥0.8.0) → `hnsw.iterative_scan` IS available, so Phase 7's iterative-scan / tiered-radius approach is viable on the live extension (final applicability call remains Phase 7's) |
| F-14 | feed/index.ts Single-Threaded JS Ranking Pass | Performance | PERF-02 | confirmed | Phase 7 | Stage-2 ranking runs in JS in the edge function; payload reduction is a Phase 7 design call |
| F-15 | packages/database/src/types.ts 3226-Line File | Performance | DEBT-04 | confirmed — duplicate of F-07 | Phase 6 | Same artifact as F-07; regen post-teardown sheds orphaned types — no separate work item |
| F-16 | BasicMapScreen.tsx 608 Lines | Fragile Areas | RFCT-02 | confirmed | Phase 9 | Decompose AFTER the CLEAN-01 dead branch is removed (Phase 5); behavior-preserving, verify on-device |
| F-17 | filterStore.ts 927 Lines | Fragile Areas | RFCT-01 | confirmed | Phase 8 | Split into slice creators; preserve the AsyncStorage persistence shape byte-for-byte |
| F-18 | DailyFilterModal.tsx 894 Lines | Fragile Areas | RFCT-03 | confirmed | Phase 9 | Decompose per filter section; behavior-preserving, verify on-device |
| F-19 | ReviewDishEditor.tsx 1258 Lines | Fragile Areas | RFCT-04 | confirmed | Phase 10 | Decompose along form regions; preserve the `admin_confirm_menu_scan` RPC contract |
| F-20 | Vector Candidate Generation Dense Urban | Scaling Limits | (none) | out-of-scope | (none) | Durable geo-aware ANN rebuild is PERF-V2-01 (REQUIREMENTS v2); Phase 7 tiered-radius is the v1 mitigation tracked under F-13 |
| F-21 | Upstash Redis Feed Cache Single Namespace | Scaling Limits | PERF-03 | confirmed — tension flagged | Phase 7 | `invalidate-cache` already flush-alls `feed:v2:*` on every change; "never flush-all" goal is a Phase 7 design call (NOT pre-judged). Live Block 3: deployed `trg_enrich_on_dish_change` fires AFTER INSERT+UPDATE on dishes — AGREES with migration-135 code-first baseline. But NO `invalidate-cache`/`http_request` cache-invalidation trigger appears in the complete trigger dump on restaurants/menus/dishes → feed-cache webhook NOT visible as a deployed table trigger; Phase 7 must confirm actual invalidation wiring + whether INSERT/DELETE invalidate |
| F-22 | deno.land/std@0.168.0 Pinned Old Version | Dependencies at Risk | DEBT-05 | confirmed | Phase 4 | `std@0.168.0/http/server` imported in every edge function; replace with native `Deno.serve` |
| F-23 | esm.sh/@supabase/supabase-js@2 Unpinned Minor | Dependencies at Risk | DEBT-05 | confirmed | Phase 4 | Unpinned `@2` AND pinned `@2.39.3` coexist across functions; `@upstash/redis@latest` (invalidate-cache) vs `@1.38.0` elsewhere — pin all to exact versions |
| F-24 | apps/mobile Zero Automated Tests | Test Coverage Gaps | (none) | out-of-scope | (none) | Broad test-coverage push out of scope (REQUIREMENTS Out-of-Scope, minimal-tests decision); one targeted persistence-seam test allowed in Phase 8 (RFCT-01 SC#4) |
| F-25 | apps/admin No Component Tests, E2E Only | Test Coverage Gaps | (none) | out-of-scope | (none) | Broad test-coverage push out of scope (REQUIREMENTS Out-of-Scope); admin is single-operator, breakage caught quickly |
| F-26 | infra/supabase/functions No Deno Unit Tests for feed/ | Test Coverage Gaps | (none) | out-of-scope | (none) | Broad test-coverage push out of scope (REQUIREMENTS Out-of-Scope, minimal-tests decision) |

## Findings Detail

### F-01 — Ingredient Pipeline — Orphaned DB Schema (Phase B + C Pending)

**Verdict:** confirmed
**Maps to:** CONCERNS § Tech Debt; requirements DEBT-01 (drop triggers) + DEBT-02 (drop schema); gated Phase 6.
**Evidence:** Phase B migration is authored but not yet run in prod — `infra/supabase/migrations/151_retire_ingredient_triggers.sql` exists on current HEAD. The orphaned tables still appear in `infra/supabase/migrations/database_schema.sql` (e.g. `dish_ingredients`, `canonical_ingredients`, `ingredient_concepts`). The ingredient-fired enrichment trigger is still declared at `infra/supabase/migrations/135_record_enrich_dish_triggers.sql:46` (`trg_enrich_on_ingredient_change AFTER INSERT OR DELETE ON public.dish_ingredients`). Phase C plan: `docs/plans/ingredient-pipeline-phase-c-schema-retirement.md`.
**Scope impact:** Phase 6 work stands as written. The strict Phase 6 spine (triggers → tables → columns → one type regen) is unaffected; this register confirms nothing has been dropped yet in prod, so the `pg_depend` pre-flight + RESTRICT-drop discipline (DEBT-02) is still required.

---

### F-02 — DishKind / DISH_KIND_META Shims — Known-Broken-by-Design

**Verdict:** confirmed
**Maps to:** CONCERNS § Tech Debt; requirement DEBT-03; gated Phase 6.
**Evidence:** The deprecated `DishKind` type and `DISH_KIND_META` constant still export from `packages/shared/src/types/restaurant.ts` and `packages/shared/src/constants/menu.ts` (marked `@deprecated since 2026-05-18`). With `apps/web-portal` deleted (`c1a7e3f`), the **last remaining importer** is `apps/web-portal-v2/src/components/menu/KindSelector.tsx`.
**Scope impact:** The shims cannot be fully removed from `@eatme/shared` until Phase 6 updates `apps/web-portal-v2` (`DishForm.tsx`, `KindSelector.tsx`) to drop the import, then deletes the shims + `dish-kinds.test.ts`. `apps/web-portal-v2` is on-ice (F-05) but must NOT be deleted — Phase 6 edits it in place. Per CLAUDE.md, the shims survive only for the retired apps; remove once v2's import is gone.

---

### F-03 — apps/web-portal — Onboarding-Only App with Broken Dish Management

**Verdict:** already-resolved
**Maps to:** CONCERNS § Tech Debt; no direct requirement (folds into CLEAN-02 residual-doc cleanup); gated Phase 5.
**Evidence:** `apps/web-portal` was deleted AND committed in commit `c1a7e3f` (2026-06-18, "deleting old web-portal"); `ls apps/web-portal` returns "No such file or directory" on current HEAD. **Correction:** CONCERNS.md (and the original PROJECT/CONTEXT input) describe the deletion as "uncommitted" — that is **stale**; the deletion is committed.
**Scope impact:** Phase 5 is reduced to **residual-doc cleanup only** — purge the remaining `apps/web-portal` references in `CLAUDE.md`, `agent_docs/architecture.md`, `.github/copilot-instructions.md`, and `INTEGRATION_COMPLETE_SUMMARY.md` (CLEAN-02). No app code to remove.

---

### F-04 — Two Admin Codepaths

**Verdict:** already-resolved
**Maps to:** CONCERNS § Tech Debt; no requirement; no gated phase.
**Evidence:** The "two codepaths" concern existed because legacy admin routes lived under `apps/web-portal/app/` alongside the active `apps/admin`. With `apps/web-portal` deleted + committed (`c1a7e3f`), `apps/admin` (port 3001) is the **sole** admin surface — the ambiguity no longer exists.
**Scope impact:** No phase work. Settled; a future audit should not re-open this — there is exactly one admin app.

---

### F-05 — apps/web-portal-v2 — Dormant / On-Ice App

**Verdict:** out-of-scope
**Maps to:** CONCERNS § Tech Debt; no requirement; no gated phase (touched only incidentally by Phase 6 / DEBT-03).
**Evidence:** `apps/web-portal-v2` still exists in the monorepo as a paused Next.js 16 + React 19 rewrite; its `src/components/menu/KindSelector.tsx` imports the deprecated `DishKind` / `DISH_KIND_META`. It is not built in CI and not deployed.
**Scope impact:** Deleting `apps/web-portal-v2` is **explicitly out of scope** (REQUIREMENTS Out-of-Scope: "On ice — kept for future revival"; user memory: do NOT auto-delete). It blocks full DishKind shim removal until Phase 6 updates its `KindSelector.tsx` import (see F-02). Disposition: keep, annotate on-ice, edit-in-place at Phase 6 — never delete this milestone.

---

### F-06 — enrich-dish Edge Function — Stale Comment References

**Verdict:** confirmed
**Maps to:** CONCERNS § Tech Debt; requirement CLEAN-03; gated Phase 5.
**Evidence:** `infra/supabase/functions/enrich-dish/index.ts` header still references the retired pipelines on current HEAD: line 9 (`_trg_notify_enrich_dish trigger on dish/ingredient/option_group writes`) and lines 14–15 (`Load dish + ingredients + option groups + restaurant cuisine + parent dish (when this is a variant) + parent ingredients`). The ingredient pipeline and parent-dish model are both retired, so the comment misdescribes current inputs (dish + option groups + restaurant cuisine only).
**Scope impact:** Phase 5 corrects the header comment (CLEAN-03) — drop the ingredient and parent-dish references. Documentation-only; no runtime behavior change.

---

### F-07 — packages/database/src/types.ts — Stale Generated Types

**Verdict:** confirmed
**Maps to:** CONCERNS § Tech Debt; requirement DEBT-04; gated Phase 6.
**Evidence:** `packages/database/src/types.ts` is a 3226-line generated Supabase types file on current HEAD. It predates migrations 153 / 156 / 163 (column drops) and may still carry types for dropped columns / orphaned tables.
**Scope impact:** **Assess-only here** — do NOT regenerate now. The single coordinated regen happens ONCE in Phase 6, after the schema teardown (DEBT-01/02) so the regenerated file sheds orphaned-table types in one pass. Premature regen before teardown would just have to be redone.

---

### F-08 — apps/web-portal Dish Create/Edit — Broken by Design

**Verdict:** already-resolved
**Maps to:** CONCERNS § Known Bugs; no requirement; no gated phase.
**Evidence:** The bug was that the web-portal dish form wrote the dropped `dish_kind` column. The entire `apps/web-portal` app was deleted + committed (`c1a7e3f`); the broken-by-design path (`DishFormDialog.tsx`, `app/onboard/menu/page.tsx`) no longer exists on current HEAD.
**Scope impact:** No phase work — the broken codepath is gone. `apps/admin` is the dish-management surface. Settled.

---

### F-09 — Map Restaurant View Mode — Disabled but Code Present

**Verdict:** confirmed
**Maps to:** CONCERNS § Known Bugs; requirement CLEAN-01; gated Phase 5.
**Evidence:** The dead view-mode code is present on current HEAD: `apps/mobile/src/stores/viewModeStore.ts`, `apps/mobile/src/components/map/ViewModeToggle.tsx`, and the conditional restaurant-marker branch in `apps/mobile/src/screens/BasicMapScreen.tsx` (the `mode` read from `useViewModeStore`). The toggle is not rendered, so the branch is reachable only programmatically.
**Scope impact:** Phase 5 removes the dead branch + store + toggle (CLEAN-01). This must land BEFORE the F-16 / RFCT-02 `BasicMapScreen.tsx` decomposition (Phase 9) so the refactor operates on already-pruned code.

---

### F-10 — Feed Edge Function — Wildcard CORS

**Verdict:** confirmed
**Maps to:** CONCERNS § Security Considerations; requirement SEC-01; gated Phase 2.
**Evidence:** Wildcard CORS `'Access-Control-Allow-Origin': '*'` confirmed on current HEAD at `infra/supabase/functions/feed/index.ts:20`, `infra/supabase/functions/enrich-dish/index.ts:31`, and `infra/supabase/functions/invalidate-cache/index.ts:20`. **Correction:** CONCERNS line 164 cites enrich-dish CORS at line 33 — that is line drift; the wildcard is at line **31** on current HEAD.
**Scope impact:** Phase 2 (SEC-01) restricts CORS to a configured allowlist across all three functions WITHOUT breaking the mobile client (which sends no `Origin` header) or admin preflight. `invalidate-cache` CORS lockdown is co-owned by PERF-03 (F-21) and lands with SEC-01.

---

### F-11 — dish_analytics / User Behavioral Tables — RLS Audit Gap

**Verdict:** already-resolved (prod) — migrations↔prod DRIFT
**Maps to:** CONCERNS § Security Considerations; requirements SEC-02 + ASSESS-02; gated Phase 3.

**Live-state (operator paste-back 2026-06-19, assess-live-state.sql Blocks 1 / 1b / 4):** Every one of the 11 behavioral tables has `rowsecurity=true` in prod **with** owner/policy coverage. Per-table `rowsecurity` + policy + caller-label (all 11 are **mobile-direct** — read/written by the mobile app via the anon/authed REST client, confirmed by the `authenticated`/`public` own-row policies; none are service-role-only):

| Table | rowsecurity | caller | policies (cmd → role → predicate) |
|-------|-------------|--------|-----------------------------------|
| `dish_analytics` | true | mobile-direct (public-read) + service-role-write | SELECT public `true`; ALL service_role `true`. **NOT user-owned** (no `user_id`) |
| `dish_opinions` | true | mobile-direct | SELECT public `true`; INSERT/UPDATE/DELETE authenticated own-row `auth.uid()=user_id` |
| `dish_photos` | true | mobile-direct | SELECT public `true`; INSERT/UPDATE/DELETE authenticated own-row `auth.uid()=user_id` |
| `favorites` | true | mobile-direct | SELECT/INSERT/DELETE public own-row `auth.uid()=user_id` |
| `restaurant_experience_responses` | true | mobile-direct | SELECT public `true`; INSERT authenticated own-row `auth.uid()=user_id` |
| `session_views` | true | mobile-direct | SELECT/INSERT authenticated own-row `auth.uid()=user_id` |
| `user_behavior_profiles` | true | mobile-direct (read/update) + service-role-managed | SELECT/UPDATE authenticated own-row `auth.uid()=user_id`; ALL service_role `true` |
| `user_dish_interactions` | true | mobile-direct | SELECT/INSERT public own-row `auth.uid()=user_id` |
| `user_points` | true | mobile-direct | SELECT/INSERT authenticated own-row `auth.uid()=user_id` |
| `user_sessions` | true | mobile-direct | SELECT/INSERT/UPDATE authenticated own-row `auth.uid()=user_id` |
| `user_visits` | true | mobile-direct | SELECT/INSERT/UPDATE authenticated own-row `auth.uid()=user_id` |

**Catch-all (Block 1b):** the ONLY public table with `rowsecurity=false` in prod is `spatial_ref_sys` (PostGIS system table, not user-owned). No user-owned table is exposed — confirms there is no unprotected behavioral table missed by the list above.

**Owner-column sanity (Block 4):** 10 tables carry a `user_id (uuid)` column (`dish_opinions`, `dish_photos`, `favorites`, `restaurant_experience_responses`, `session_views`, `user_behavior_profiles`, `user_dish_interactions`, `user_points`, `user_sessions`, `user_visits`). `dish_analytics` is **ABSENT** from the owner-column list → confirms it has no `user_id` (dish-keyed / not user-owned).

**Verdict flip + DRIFT:** the prod live-state OVERTURNS the code-first "gap exists" reading — RLS is enabled in prod on all 11 behavioral tables with appropriate owner policies → **no prod RLS security gap.** BUT the repo migrations / `database_schema.sql` baseline contain **ZERO** `ENABLE ROW LEVEL SECURITY` for these tables (the code-first finding stands) — so prod was configured **out-of-band** (Supabase dashboard or an untracked migration). The migration baseline does NOT reproduce prod's protection → **migrations↔prod drift.**

**Critical correction (still holds):** `dish_analytics` PK is `dish_id` with an FK to `dishes(id)` and has **NO `user_id` column** (confirmed by Block 4 absence + `database_schema.sql` `dish_analytics_pkey PRIMARY KEY (dish_id)`). It is a dish-keyed public aggregate, NOT user-owned; its prod policies are public-read + service-role-manage. CONCERNS line 174 mislists it among user-owned tables; **Phase 3 must NOT add a per-user owner policy on `dish_analytics`.**

**Scope impact (F-11 → Phase 3):** prod has NO RLS security gap → the original Phase 3 "enable RLS" work is **descoped** (every behavioral table is already protected in prod; the SEC-02 enable+policy pattern has nothing to enable). The residual question for Phase 3 — a Phase-4-style choice the user resolves at the Plan-04 scope review — is whether to **CODIFY** the existing prod RLS into a tracked migration (closing the migrations↔prod drift so the baseline reproduces prod protection) **vs.** leave Phase 3 fully empty. Both options stated; NOT pre-decided here.

---

### F-12 — infra/scripts — Production Mutation Scripts Without Guard

**Verdict:** confirmed
**Maps to:** CONCERNS § Security Considerations; requirement SEC-03; gated Phase 4.
**Evidence:** On current HEAD, `infra/scripts/replay-menu-scan-ab.ts` and `infra/scripts/apply-phase6-flag-fixes.ts` connect to live Supabase with the service-role key and mutate prod data, relying on manual `--dry-run` discipline with no harness-enforced gate.
**Scope impact:** Phase 4 (SEC-03) adds a refuse-to-write-without-clearance gate (e.g. `REQUIRE_DRY_RUN` / explicit confirmation) to the prod-mutation scripts. Read-only scripts (e.g. `verify-phase7.ts`) are unaffected.

---

### F-13 — generate_candidates — Radius Timeout Past ~5km

**Verdict:** confirmed
**Maps to:** CONCERNS § Performance Bottlenecks; requirement PERF-01; gated Phase 7.
**Evidence (live-state):** Operator paste-back 2026-06-19 (assess-live-state.sql Block 2): prod pgvector `extversion=0.8.0` (`pg_extension`); `pg_available_extensions` confirms `default_version=0.8.0`, `installed_version=0.8.0`. Code-first: the materialized-CTE pushdown fix exists at `infra/supabase/migrations/169_generate_candidates_pushdown.sql`, and the HNSW index at `infra/supabase/migrations/136_hnsw_dishes_embedding.sql` — the pushdown narrows but does not eliminate the timeout at large radii on a full catalog. The pgvector version is platform-provisioned (no `CREATE EXTENSION vector` in any migration); the live catalog confirms **0.8.0**.
**Scope impact:** Phase 7 PERF-01 uses a tiered / expanding-radius approach (no migration required) to stay within `statement_timeout` at the default radius. Live pgvector `0.8.0` ≥ 0.8.0 → **`hnsw.iterative_scan` IS available** in prod, so Phase 7 may additionally enable it (a session/GUC `SET hnsw.iterative_scan` — no extension upgrade needed); the final applicability/perf call remains Phase 7's. The durable geo-aware ANN rebuild is PERF-V2-01, out of scope — see F-20.

---

### F-14 — feed/index.ts — Single-Threaded JS Ranking Pass

**Verdict:** confirmed
**Maps to:** CONCERNS § Performance Bottlenecks; requirement PERF-02; gated Phase 7.
**Evidence:** On current HEAD, Stage-2 ranking (`rankCandidates`) runs entirely in the Deno edge function `infra/supabase/functions/feed/index.ts` after the SQL candidate fetch, and the response payload includes full dish records. Upstash Redis caching with gzip is the current mitigation.
**Scope impact:** Phase 7 PERF-02 reduces Stage-2 payload size (move diversity capping / final sort toward SQL where it measurably helps). This is a design call — the full SQL-side ranking pushdown is PERF-V2-02 (out of scope).

---

### F-15 — packages/database/src/types.ts — 3226-Line Generated File

**Verdict:** confirmed — duplicate of F-07
**Maps to:** CONCERNS § Performance Bottlenecks; requirement DEBT-04; gated Phase 6.
**Evidence:** Same artifact as F-07 — the 3226-line `packages/database/src/types.ts` on current HEAD. CONCERNS lists it twice (once as stale types under Tech Debt, once as a compile-time size concern under Performance); both resolve via the single Phase 6 regen.
**Scope impact:** No separate work item — folded into DEBT-04 (F-07). Regenerating post-teardown both refreshes the types AND sheds orphaned-table entries, reducing the file size. One regen satisfies both framings.

---

### F-16 — BasicMapScreen.tsx — 608 Lines, Multiple Concerns

**Verdict:** confirmed
**Maps to:** CONCERNS § Fragile Areas; requirement RFCT-02; gated Phase 9.
**Evidence:** `apps/mobile/src/screens/BasicMapScreen.tsx` (608 lines on current HEAD) combines Mapbox camera management, location permissions, dish + restaurant marker rendering (the dead branch — see F-09), filter subscription, feed calls, and deep-link handling. No unit tests.
**Scope impact:** Phase 9 (RFCT-02) decomposes it — but ONLY AFTER Phase 5 removes the CLEAN-01 dead view-mode branch (F-09), so the refactor operates on pruned code. Behavior-preserving; verified on-device (no emulator in CI).

---

### F-17 — filterStore.ts — 927 Lines

**Verdict:** confirmed
**Maps to:** CONCERNS § Fragile Areas; requirement RFCT-01; gated Phase 8.
**Evidence:** `apps/mobile/src/stores/filterStore.ts` (927 lines on current HEAD) is the largest store — a single Zustand store holding all filter axes plus persistence logic and derived selectors. Changes to one axis can alter the serialized storage format and break user-persisted preferences on app update.
**Scope impact:** Phase 8 (RFCT-01) splits it into slice creators, **preserving the public store API and the hand-rolled `saveFilters` / `loadFilters` AsyncStorage serialization shape byte-for-byte**. A single targeted persistence-seam test is permitted (RFCT-01 SC#4) despite the broad minimal-tests posture (see F-24).

---

### F-18 — DailyFilterModal.tsx — 894 Lines

**Verdict:** confirmed
**Maps to:** CONCERNS § Fragile Areas; requirement RFCT-03; gated Phase 9.
**Evidence:** `apps/mobile/src/components/map/DailyFilterModal.tsx` (894 lines on current HEAD) renders all daily filter controls (price, diet, protein, cuisine, spice) in one component with inline state and `useCallback`-heavy logic. No tests.
**Scope impact:** Phase 9 (RFCT-03) decomposes it per filter section, behavior-preserving, verified on-device.

---

### F-19 — ReviewDishEditor.tsx — 1258 Lines (Admin)

**Verdict:** confirmed
**Maps to:** CONCERNS § Fragile Areas; requirement RFCT-04; gated Phase 10.
**Evidence:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (1258 lines on current HEAD) is the largest single component — it manages the full menu-scan review workflow and is deeply coupled to the `admin_confirm_menu_scan` RPC shape. Integration-tested at the RPC level (`apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts`) but no component-level tests.
**Scope impact:** Phase 10 (RFCT-04) decomposes it along form regions, behavior-preserving, **preserving the `admin_confirm_menu_scan` contract** (the existing RPC integration test is the regression guard).

---

### F-20 — Vector Candidate Generation — Dense Urban Areas

**Verdict:** out-of-scope
**Maps to:** CONCERNS § Scaling Limits; no v1 requirement (maps to v2 PERF-V2-01); no gated v1 phase.
**Evidence:** A scaling note — performance degrades past ~5km radius on a full catalog. The durable fix (geographic-tile partitioning / per-restaurant centroid vectors / geo-aware ANN) is architectural.
**Scope impact:** The durable geo-aware ANN rebuild is **PERF-V2-01** (REQUIREMENTS v2 — deferred). The v1 mitigation is the Phase 7 tiered-radius approach tracked under F-13 / PERF-01. No additional v1 scope.

---

### F-21 — Upstash Redis Feed Cache — Single Namespace

**Verdict:** confirmed — tension flagged
**Maps to:** CONCERNS § Scaling Limits; requirement PERF-03; gated Phase 7.
**Evidence (deployed event coverage — live-state):** Operator paste-back 2026-06-19 (assess-live-state.sql Block 3 — the COMPLETE trigger dump on `restaurants`/`menus`/`dishes`, no name filter). Deployed triggers: on `dishes` — `trg_enrich_on_dish_change` AFTER **INSERT + UPDATE** (→ `_trg_notify_enrich_dish()`), `trg_compute_dish_protein_families` BEFORE INSERT/UPDATE, `after_dish_embedded` AFTER UPDATE, `update_dishes_updated_at` BEFORE UPDATE; on `menus` — only `update_menus_updated_at` BEFORE UPDATE; on `restaurants` — only `update_restaurants_updated_at` BEFORE UPDATE. **Reconciliation (D-09): the deployed enrich trigger AGREES with the migration-135 code-first baseline** — it fires on INSERT + UPDATE (not DELETE), exactly as `trg_enrich_on_dish_change AFTER INSERT OR UPDATE OF name, description` declares. **However:** the complete dump contains **NO `invalidate-cache` / `supabase_functions.http_request` cache-invalidation trigger** on restaurants/menus/dishes → the feed-cache webhook is **not visible as a deployed table trigger** on the core feed tables. Recorded AS-IS: on current HEAD `infra/supabase/functions/invalidate-cache/index.ts` already performs a `feed:v2:*` flush-all on every change, and its header (line 1, line 3) documents it as a Supabase DB webhook handler "Invoked by Supabase webhooks on UPDATE events for restaurants, menus, and dishes" — its OWN triggers are dashboard-configured, NOT in any migration (grep for invalidate-cache triggers in migrations returns nothing). **Open sub-fact (honestly unresolved — not fabricated):** because the cache-invalidation webhook is not a table trigger on these tables, Block 3 cannot confirm its deployed INSERT/UPDATE/DELETE coverage; Phase 7 must locate the actual invalidation wiring and confirm whether INSERT/DELETE (not just the documented UPDATE) invalidate the cache. The `@upstash/redis@latest` import is at `invalidate-cache/index.ts:17` (see F-23).

**Code-first webhook event_manipulation baseline (D-09):** Extracted from the trigger migrations BEFORE marking the deployed side PENDING —
- `infra/supabase/migrations/135_record_enrich_dish_triggers.sql:26` declares `trg_enrich_on_dish_change AFTER INSERT OR UPDATE OF name, description ON public.dishes` (the legitimate enrich path on dishes covers INSERT + UPDATE-of-name/description). The same migration adds `trg_enrich_on_ingredient_change AFTER INSERT OR DELETE ON public.dish_ingredients` (line 46) and `trg_enrich_on_option_group_change AFTER INSERT OR DELETE OR UPDATE OF name ON public.option_groups` (line 56).
- `infra/supabase/migrations/132_vault_based_trigger_auth.sql:36` defines `_trg_notify_enrich_dish()` with explicit `TG_OP = 'DELETE'` and `TG_OP = 'UPDATE'` branches (function-level event handling).
- `infra/supabase/migrations/138_record_webhook_trigger_drop.sql:29` records the drop of the dashboard-created `WEBHOOK_SECRET` trigger that previously fired on every INSERT/UPDATE of `dishes`; the legitimate replacement path is `trg_enrich_on_dish_change` (migration 135).
- Embed-recovery header/timeout changes are recorded in `infra/supabase/migrations/165_embed_recovery_add_apikey_header.sql` and `166_embed_recovery_raise_pgnet_timeout.sql` (header/auth/timeout only — not new event coverage).

So the migration-defined trigger event set on `dishes` is **INSERT + UPDATE OF name, description** (via `trg_enrich_on_dish_change`); the `invalidate-cache` function ITSELF is dashboard-webhook'd (no migration), documented UPDATE-only. This migration-DDL event set is the **code-first baseline** that the Block-3 deployed `information_schema.triggers` dump must be reconciled against (agree-or-drift) at the operator checkpoint — NOT the `invalidate-cache` header alone, since prod webhooks can drift from migrations.

**Scope impact:** Phase 7 PERF-03 widens feed-cache invalidation to cover INSERT / UPDATE / DELETE for menu-affecting changes (and locks down `invalidate-cache` CORS with SEC-01). **Tension flagged, NOT pre-judged:** `invalidate-cache` already flush-alls `feed:v2:*` on every change, which sits in tension with ROADMAP Phase-7 SC#4's "never flush-all" goal — this is a Phase 7 **design call** to resolve (targeted key purge vs flush-all), recorded here as scope-impact only, not as a verdict.

---

### F-22 — deno.land/std@0.168.0 — Pinned Old Version

**Verdict:** confirmed
**Maps to:** CONCERNS § Dependencies at Risk; requirement DEBT-05; gated Phase 4.
**Evidence:** On current HEAD, `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'` appears in the edge functions (e.g. `enrich-dish/index.ts:23`, and feed / menu-scan-worker). std 0.168.0 is far behind current; Deno 2.x changed module resolution.
**Scope impact:** Phase 4 (DEBT-05) replaces `std@0.168.0/http/server` with the native `Deno.serve` across all edge functions. Full Deno std → JSR modernization beyond this import swap is QUAL-V2-02 (out of scope).

---

### F-23 — esm.sh/@supabase/supabase-js@2 — Unpinned Minor

**Verdict:** confirmed
**Maps to:** CONCERNS § Dependencies at Risk; requirement DEBT-05; gated Phase 4.
**Evidence:** On current HEAD the edge functions show a mixed dependency-pinning posture: unpinned `https://esm.sh/@supabase/supabase-js@2` (e.g. `enrich-dish/index.ts:24`) coexists with the pinned `@2.39.3` elsewhere; and `@upstash/redis@latest` (`invalidate-cache/index.ts:17`) coexists with `@1.38.0` in other functions. Unpinned imports let a breaking patch/minor silently affect functions on the next cold start.
**Scope impact:** Phase 4 (DEBT-05) pins `@supabase/supabase-js` to one exact version and exact-pins `@upstash/redis` across ALL functions for deterministic cold starts. This is the same Phase 4 work item as F-22 (both DEBT-05).

---

### F-24 — apps/mobile — Zero Automated Tests

**Verdict:** out-of-scope
**Maps to:** CONCERNS § Test Coverage Gaps; no requirement; no gated phase.
**Evidence:** `apps/mobile` has no automated test suite (screens, stores, services, components untested) on current HEAD.
**Scope impact:** A broad mobile test-coverage push is **out of scope** (REQUIREMENTS Out-of-Scope: "Solo/single-operator app; ROI not there this cycle — minimal targeted tests only"). The ONE permitted exception is a targeted `filterStore` persistence-seam test in Phase 8 (RFCT-01 SC#4) to guard the byte-for-byte serialization shape (F-17). The full RLS-regression / broad suite is QUAL-V2-01 (v2).

---

### F-25 — apps/admin — No Component Tests, E2E Only

**Verdict:** out-of-scope
**Maps to:** CONCERNS § Test Coverage Gaps; no requirement; no gated phase.
**Evidence:** On current HEAD `apps/admin` has E2E (`tests/e2e/`) + RPC-integration coverage (`src/__tests__/integration/admin-confirm-rpc.test.ts`) but no component-level tests for large components (`ReviewDishEditor.tsx`, `AdminJobShell.tsx`, `DishRowEditor.tsx`).
**Scope impact:** Out of scope (REQUIREMENTS Out-of-Scope, minimal-tests decision). Admin is single-operator, so breakage is caught quickly by manual QA. The existing RPC integration test remains the regression guard for the Phase 10 RFCT-04 refactor (F-19).

---

### F-26 — infra/supabase/functions — No Deno Unit Tests for feed/

**Verdict:** out-of-scope
**Maps to:** CONCERNS § Test Coverage Gaps; no requirement; no gated phase.
**Evidence:** On current HEAD `infra/supabase/functions/feed/index.ts` has no Deno test file; `menu-scan-worker/test.ts` covers extraction logic only, not the full job lifecycle.
**Scope impact:** A broad edge-function test push is out of scope (REQUIREMENTS Out-of-Scope, minimal-tests decision). Stage-2 ranking changes in Phase 7 (F-14) are validated by the stage-don't-apply / dry-run discipline rather than a new Deno unit suite this cycle.

---

## Net-new findings

None surfaced during Phase 1 assessment.

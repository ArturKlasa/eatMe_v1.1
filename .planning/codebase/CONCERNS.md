# Codebase Concerns

**Analysis Date:** 2026-06-19

---

## Tech Debt

### Ingredient Pipeline — Orphaned DB Schema (Phase B + C Pending)

**Issue:** Phase A removed all application-level and edge-function reads/writes of the ingredient pipeline (2026-05-17). Phases B and C — which drop the DB triggers and then the schema itself — are still proposed/unstarted.

**Tables still alive in DB:**
- `dish_ingredients` — RLS enabled, FK to `canonical_ingredients`
- `canonical_ingredients` — used as FK target
- `ingredient_concepts` — RLS enabled
- `ingredient_variants` — RLS enabled
- `concept_translations` — RLS enabled
- `variant_translations` — RLS enabled
- `ingredient_aliases_v2` — RLS enabled

**Triggers still alive (Phase B gate):**
- `dish_ingredients_refresh` (mig 092) — fires on `dish_ingredients` INSERT/UPDATE/DELETE, recomputes `dishes.allergens` / `dishes.dietary_tags` (columns now also removed, so trigger is inert but present)
- `dishes_override_refresh` (mig 092) — fires on `dishes` UPDATE of override columns (also removed); inert
- `trg_enrich_on_ingredient_change` (mig 135) — fires on `dish_ingredients` writes, notifies `enrich-dish` edge function; no-op since Phase A

**Sequencing gate:** Phase B requires Phase 7 of dish-model rewrite to be stable for 1–2 weeks first (it has shipped as of migration 163). Phase B migration exists at `infra/supabase/migrations/151_retire_ingredient_triggers.sql` and is already written. Phase C schema drop plan is at `docs/plans/ingredient-pipeline-phase-c-schema-retirement.md`.

**Impact:** Dead triggers add zero runtime cost but create confusion during future schema work. The tables consume storage and appear in `packages/database/src/types.ts` (3226-line generated file) even though no app code reads them.

**Fix:** Run Phase B (drop triggers) then Phase C (drop schema). See `docs/plans/ingredient-pipeline-phase-b-trigger-retirement.md` for gating conditions.

---

### `DishKind` / `DISH_KIND_META` Shims — Known-Broken-by-Design

**Issue:** `packages/shared/src/types/restaurant.ts` and `packages/shared/src/constants/menu.ts` still export deprecated `DishKind` type and `DISH_KIND_META` constant, marked `@deprecated since 2026-05-18`. They exist solely to keep `apps/web-portal/` compiling. The dish create/edit flow in `apps/web-portal/` is **intentionally broken** post-migration 163 (the `dish_kind` column was dropped).

**Files:**
- `packages/shared/src/types/restaurant.ts` — `DishKind`, `DishCourse`, deprecated fields on `Dish` interface (`dish_kind`, `parent_dish_id`, `is_parent`, `is_template`, `variants`)
- `packages/shared/src/constants/menu.ts` — `DISH_KIND_META`
- `apps/web-portal/components/forms/dish/DishKindSelector.tsx` — renders `DISH_KIND_META`
- `apps/web-portal/components/forms/DishFormDialog.tsx` — renders `<DishKindSelector />`
- `apps/web-portal/components/forms/DishCard.tsx` — reads `DISH_KIND_META[dish.dish_kind]`

**Impact:** If `apps/web-portal/` is ever activated again (not just for onboarding), the dish edit/create UI silently miscategorizes dishes. Stale type exports pollute the shared package for `apps/admin/` and `apps/mobile/`.

**Fix:** Delete `apps/web-portal/` (or its dish-form components) and remove the shims from `@eatme/shared`. See `docs/plans/dish-model-rewrite-phase-7-cleanup.md`.

---

### `apps/web-portal/` — Onboarding-Only App with Broken Dish Management

**Issue:** `apps/web-portal/` is the live restaurant-owner onboarding portal (`apps/web-portal/app/onboard/`). Its dish create/edit (`DishFormDialog`, `DishKindSelector`) is broken post-migration 163 because `dish_kind` no longer exists in the DB. The onboarding flow itself (basic info, location, menus) is still functional but dish management is silently non-functional.

**Files:**
- `apps/web-portal/app/onboard/menu/page.tsx` (561 lines)
- `apps/web-portal/components/forms/DishFormDialog.tsx`
- `apps/web-portal/lib/restaurantService.ts` (629 lines)

**Impact:** Restaurant owners who attempt to create/edit dishes through web-portal will get errors or submit empty/invalid `dish_kind` values. New admin work goes to `apps/admin/` (port 3001).

**Fix:** Either redirect dish management from web-portal to admin or remove dish management from web-portal entirely. Document the intentional scope of web-portal as onboarding-only.

---

### Two Admin Codepaths

**Issue:** `apps/web-portal/app/` contains legacy admin routes alongside onboarding routes. `apps/admin/` is the active rewrite (port 3001). There is no redirect or deprecation notice in the legacy paths.

**Files:**
- `apps/web-portal/app/` — legacy owner portal routes
- `apps/admin/src/app/(admin)/` — active admin rewrite

**Impact:** Any new admin feature added to `apps/web-portal/` is wasted work. Future developers may not know which app to extend.

**Fix:** Document that `apps/admin/` is the canonical admin surface. Optionally redirect legacy web-portal admin paths to the admin app.

---

### `apps/web-portal-v2/` — Dormant / On-Ice App

**Issue:** `apps/web-portal-v2/` exists in the monorepo as a paused Next.js 16 + React 19 rewrite (Playwright configured, proxy server included). It is not built in CI, not deployed, and its `KindSelector` component imports the deprecated `DishKind` / `DISH_KIND_META` from `@eatme/shared`.

**Files:**
- `apps/web-portal-v2/` — entire directory
- `apps/web-portal-v2/src/components/menu/KindSelector.tsx` — imports `DishKind`, `DISH_KIND_META`

**Impact:** Adds confusion to the monorepo layout. `DishKind` shims cannot be fully removed from `@eatme/shared` until v2 is either deleted or updated. Playwright suite is unenforced.

**Fix:** Do not delete (paused, not abandoned per memory). Annotate with a root `README` explaining on-ice status. Remove `DishKind` import from `KindSelector.tsx` when shims are cleaned up.

---

### `enrich-dish` Edge Function — Stale Comment References

**Issue:** `infra/supabase/functions/enrich-dish/index.ts` header comment (lines 9, 14–15) still references:
- `_trg_notify_enrich_dish trigger on dish/ingredient/option_group writes`
- `Load dish + ingredients + option groups + restaurant cuisine + parent dish (when this is a variant) + parent ingredients`

The ingredient pipeline and parent-dish model were both retired. The trigger comment may cause confusion about what the function actually does vs. what the comment describes.

**Files:**
- `infra/supabase/functions/enrich-dish/index.ts`

**Impact:** Low runtime impact; documentation debt that can mislead future maintainers.

**Fix:** Update the header comment to reflect current inputs (dish + option groups + restaurant cuisine only; no ingredient or parent-dish references).

---

### `packages/database/src/types.ts` — Stale Generated Types

**Issue:** The generated Supabase types file is 3226 lines. If it was generated before migrations 153 (drop ingredient columns), 156 (drop dietary/allergen columns), and 163 (drop dish composition columns) it may still contain types for dropped columns or orphaned tables.

**Files:**
- `packages/database/src/types.ts`

**Impact:** Type mismatches at runtime if code uses types referencing dropped columns. Editor autocomplete may suggest fields that no longer exist.

**Fix:** Regenerate types with `supabase gen types typescript` after all recent migrations (through 169) and commit the updated file.

---

## Known Bugs

### `apps/web-portal/` Dish Create/Edit — Broken by Design

**Symptoms:** Submitting the dish form in `apps/web-portal/` will attempt to write `dish_kind` to a column that no longer exists (dropped in migration 163). The form may throw a Postgres error or silently fail.

**Files:**
- `apps/web-portal/components/forms/DishFormDialog.tsx`
- `apps/web-portal/app/onboard/menu/page.tsx`

**Trigger:** Any restaurant owner who reaches the dish create/edit step in the onboarding flow.

**Workaround:** Use `apps/admin/` for dish management. Web-portal onboarding stops at menu structure.

---

### Map Restaurant View Mode — Disabled but Code Present

**Symptoms:** The restaurant view mode is not exposed to users (no toggle in the UI). The `ViewModeToggle` component (`apps/mobile/src/components/map/ViewModeToggle.tsx`) and `viewModeStore` (`apps/mobile/src/stores/viewModeStore.ts`) exist but the toggle is not rendered in `BasicMapScreen.tsx`.

**Files:**
- `apps/mobile/src/stores/viewModeStore.ts`
- `apps/mobile/src/components/map/ViewModeToggle.tsx`
- `apps/mobile/src/screens/BasicMapScreen.tsx`

**Impact:** Dead code that will cause confusion. `BasicMapScreen.tsx` still reads `mode` from `useViewModeStore` and conditionally renders restaurant markers (line 510), meaning the branch is reachable only programmatically.

**Fix:** Either enable the toggle or remove the dead branch and store.

---

## Security Considerations

### Feed Edge Function — Wildcard CORS

**Risk:** `infra/supabase/functions/feed/index.ts` sets `'Access-Control-Allow-Origin': '*'`. The feed endpoint accepts location data and returns ranked dish results tied to a user preference vector.

**Files:**
- `infra/supabase/functions/feed/index.ts` (line 20)
- `infra/supabase/functions/enrich-dish/index.ts` (line 33)

**Current mitigation:** Feed reads require a valid user JWT for the `generate_candidates` RPC (uses `supabase` service-role client internally but validates the user's vector from `user_behavior_profiles`). Enrich-dish requires service-role JWT per its docs.

**Recommendation:** Restrict CORS origin to known app domains in production (`app.eatme.com`, the admin origin). Wildcard is appropriate only during development.

---

### `dish_analytics` / User Behavioral Tables — RLS Audit Gap

**Risk:** Several tables in `database_schema.sql` (the baseline dump) — `dish_analytics`, `user_behavior_profiles`, `user_dish_interactions`, `user_points`, `user_sessions`, `user_visits`, `session_views`, `dish_opinions`, `dish_photos`, `favorites`, `restaurant_experience_responses`, `eat_together_*` — have no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` found in any non-REVERSE migration file. RLS may have been enabled in earlier migrations not captured here, or in Supabase dashboard directly.

**Files:**
- `infra/supabase/migrations/database_schema.sql` — baseline schema dump
- Migrations 079, 091 cover `user_streaks`, `user_badges`, core content tables

**Impact:** If RLS is absent on `user_dish_interactions`, `dish_opinions`, or `favorites`, one authenticated user could read another user's interactions or favorites via the REST API.

**Recommendation:** Verify RLS status by running `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` against production. Add RLS + owner policies to any table missing them.

---

### `infra/scripts/` — Production Mutation Scripts Without Guard

**Risk:** `infra/scripts/replay-menu-scan-ab.ts`, `apply-phase6-flag-fixes.ts`, and similar scripts connect directly to live Supabase (service-role key) and mutate production data. They require manual `--dry-run` discipline; there is no harness-enforced gate.

**Files:**
- `infra/scripts/replay-menu-scan-ab.ts`
- `infra/scripts/apply-phase6-flag-fixes.ts` (536 lines)

**Impact:** Accidental production mutations if scripts are run without `--dry-run` flag first.

**Fix:** Add a `REQUIRE_DRY_RUN=true` env check or prompt confirmation before any write path executes.

---

## Performance Bottlenecks

### `generate_candidates` — Radius Timeout Past ~5km

**Problem:** `generate_candidates` (migration 169) exceeded Postgres's 8-second `statement_timeout` at radii beyond ~5km on a full dish catalog. Migration 169 introduced a materialized CTE pushdown fix (§S9), but the root cause is that the vector ANN scan (`<=>` operator with HNSW) cannot be filtered by geography before execution — geography filtering happens after the ANN pass.

**Files:**
- `infra/supabase/migrations/169_generate_candidates_pushdown.sql` (418 lines)
- `infra/supabase/migrations/136_hnsw_dishes_embedding.sql` — HNSW index on `dishes.embedding`

**Current capacity:** Default radius is 10km (`p_radius_m DEFAULT 10000`). Pushdown fix narrows the problem but doesn't eliminate it at large radii with dense dish catalogs.

**Scaling path:** As dish count grows, shrink the default radius, add a per-restaurant cached vector, or move ANN to a dedicated vector store with geo-aware filtering.

---

### `feed/index.ts` — Single-Threaded JS Ranking Pass

**Problem:** Stage 2 ranking runs entirely in the Deno edge function after the SQL candidate fetch. At 200 candidates, the weighted scoring loop (`rankCandidates`) is fast, but response payload includes full dish records. As dishes get richer (more modifier groups, photos), serialization cost grows.

**Files:**
- `infra/supabase/functions/feed/index.ts` (1111 lines)

**Current mitigation:** Upstash Redis cache (`getRedis()`) with gzip compression on the response.

**Scaling path:** Move diversity capping and final sort back into SQL to reduce JS payload size; or add a CDN layer for public (non-personalized) feed segments.

---

### `packages/database/src/types.ts` — 3226-Line Generated File

**Problem:** The generated types file is very large. Every consumer app imports the entire file. TypeScript compile times scale with this file.

**Files:**
- `packages/database/src/types.ts`

**Fix:** Regenerate after schema cleanup (Phases B/C) to shed types for orphaned tables.

---

## Fragile Areas

### `BasicMapScreen.tsx` — 608 Lines, Multiple Concerns

**Files:** `apps/mobile/src/screens/BasicMapScreen.tsx`

**Why fragile:** Combines Mapbox camera management, location permission handling, dish marker rendering, restaurant marker rendering (dead branch), filter state subscription, feed service calls, and deep-link handling in one component. Changes to any single concern risk breaking others. No unit tests.

**Safe modification:** Test on a physical device after any change (no emulator in CI). Changes to marker rendering or camera logic should be smoke-tested against the live Mapbox token.

**Test coverage:** None in `apps/mobile/`.

---

### `filterStore.ts` — 927 Lines

**Files:** `apps/mobile/src/stores/filterStore.ts`

**Why fragile:** Single Zustand store holding all filter state (price range, protein, diet, spice, max price, cuisine) plus persistence logic and derived selectors. At 927 lines it is the largest store file. Changes to one filter axis can affect serialized storage format, breaking user-persisted preferences on app update.

**Safe modification:** Any change to stored field names requires a migration version bump on the Zustand `persist` middleware config. Verify the `partialize` function still excludes transient state.

---

### `DailyFilterModal.tsx` — 894 Lines

**Files:** `apps/mobile/src/components/map/DailyFilterModal.tsx`

**Why fragile:** Renders all daily filter controls (price, diet, protein, cuisine, spice) in a single component with inline state and `useCallback`-heavy logic. No tests. UI must be verified on-device.

---

### `ReviewDishEditor.tsx` — 1258 Lines (Admin)

**Files:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`

**Why fragile:** Largest single component in the codebase. Manages the full menu-scan review workflow: dish form, modifier group editing, image display, protein selector, category assignment, and RPC submission. Deeply coupled to the `admin_confirm_menu_scan` RPC shape.

**Test coverage:** Integration-tested at the RPC level (`apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts`, 565 lines), but no component-level tests.

---

## Scaling Limits

### Vector Candidate Generation — Dense Urban Areas

**Current capacity:** Tested stable at default 10km radius with current restaurant count. Performance degrades past ~5km radius on full catalog (pre-migration-169 baseline exceeded 8s timeout).

**Limit:** Unknown exact dish count ceiling; migration 169 comment notes the issue exists at "full dish catalog" scale.

**Scaling path:** Partition dishes by geographic tile; use a tiered radius (try 3km first, expand if < N results).

---

### Upstash Redis Feed Cache — Single Namespace

**Current capacity:** Feed responses are cached per `(user_id, location_hash, filter_hash)`. No TTL management beyond what Upstash provides.

**Limit:** Cache invalidation on menu changes relies on passive expiry, not event-driven purge. A restaurant updating its menu won't be reflected until the cache TTL expires.

**Scaling path:** Add a cache-bust call in the admin RPC (`admin_confirm_menu_scan`) to purge affected feed cache keys.

---

## Dependencies at Risk

### `deno.land/std@0.168.0` — Pinned Old Version

**Risk:** All edge functions import from `https://deno.land/std@0.168.0/http/server.ts`. Deno std 0.168.0 is far behind current. Deno 2.x changed module resolution; upgrading will require updating all import URLs.

**Impact:** Security patches in Deno std not received. Migration to Deno 2.x module resolution is a breaking change for all edge functions.

**Files:**
- `infra/supabase/functions/feed/index.ts`
- `infra/supabase/functions/enrich-dish/index.ts`
- `infra/supabase/functions/menu-scan-worker/index.ts`

---

### `esm.sh/@supabase/supabase-js@2` — Unpinned Minor

**Risk:** Edge functions import `@supabase/supabase-js@2` from esm.sh without a patch-version pin. A breaking patch release could silently affect all edge functions on next cold start.

**Files:** All edge function `index.ts` files.

**Fix:** Pin to exact version (e.g., `@2.49.0`) for deterministic cold starts. Comment in `feed/index.ts` already notes this philosophy for Upstash Redis — apply same discipline to supabase-js.

---

## Test Coverage Gaps

### `apps/mobile/` — Zero Automated Tests

**What's not tested:** All mobile screens, stores, services, and components. This includes:
- `filterStore.ts` — persistence logic, derived selectors
- `BasicMapScreen.tsx` — camera, markers, filter interactions
- `eatTogetherService.ts` (567 lines) — session creation, voting, recommendation logic
- `ratingService.ts` (527 lines) — opinion submission, streak tracking
- `edgeFunctionsService.ts` — feed API call construction

**Risk:** Any refactor of mobile stores or services is unverifiable without on-device testing.

**Priority:** High for `filterStore.ts` (persistence format) and `eatTogetherService.ts` (multi-user session logic).

---

### `apps/admin/` — No Component Tests, E2E Only

**What's not tested:** `ReviewDishEditor.tsx` (1258 lines), `AdminJobShell.tsx` (579 lines), `DishRowEditor.tsx` (651 lines) have no unit or component tests. E2E tests in `apps/admin/tests/e2e/` cover browsing and menu-scan flows but require a live backend.

**Files:**
- `apps/admin/tests/e2e/menu-scan-power-tool.spec.ts`
- `apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts` (565 lines — integration level only)

**Risk:** Breaking the dish editor UI is invisible until manual QA.

**Priority:** Medium (admin is single-operator; breakage is caught quickly).

---

### `infra/supabase/functions/` — No Deno Unit Tests for `feed/`

**What's not tested:** `feed/index.ts` (1111 lines) has no Deno test file. `menu-scan-worker/test.ts` (1644 lines) exists for the worker but tests only extraction logic, not the full job lifecycle.

**Files:**
- `infra/supabase/functions/feed/index.ts` — untested
- `infra/supabase/functions/menu-scan-worker/test.ts` — partial coverage

**Risk:** Ranking weight changes or Stage 2 logic bugs go undetected until production.

**Priority:** High for Stage 2 ranking logic (weights `W`, diversity cap, diet filter).

---

*Concerns audit: 2026-06-19*

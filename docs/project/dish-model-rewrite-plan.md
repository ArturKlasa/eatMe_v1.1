# Dish model rewrite — overview & cross-phase plan

**Status:** Proposed
**Last updated:** 2026-05-17
**Scope:** Collapse `dish_kind` + parent/child variants + `dish_courses` into a single model — every dish is one row, with optional modifier groups + options (extending the existing `option_groups`/`options` tables), a `dining_format` UX hint, and optional `bundled_items` JSON.

**Out of scope:** `apps/web-portal` (legacy v1 portal, being retired) and `apps/web-portal-v2` (out of scope per user direction 2026-05-17). All admin work in this rewrite targets `apps/admin` only.

This document is the architectural overview. **Per-phase implementation plans live in `docs/plans/`:**

| Phase | File |
|---|---|
| 1 | [`docs/plans/dish-model-rewrite-phase-1-database.md`](../plans/dish-model-rewrite-phase-1-database.md) |
| 2 | [`docs/plans/dish-model-rewrite-phase-2-backend.md`](../plans/dish-model-rewrite-phase-2-backend.md) |
| 3 | [`docs/plans/dish-model-rewrite-phase-3-shared.md`](../plans/dish-model-rewrite-phase-3-shared.md) |
| 4 | [`docs/plans/dish-model-rewrite-phase-4-admin.md`](../plans/dish-model-rewrite-phase-4-admin.md) |
| 5 | [`docs/plans/dish-model-rewrite-phase-5-mobile.md`](../plans/dish-model-rewrite-phase-5-mobile.md) |
| 6 | [`docs/plans/dish-model-rewrite-phase-6-data-migration.md`](../plans/dish-model-rewrite-phase-6-data-migration.md) |
| 7 | [`docs/plans/dish-model-rewrite-phase-7-cleanup.md`](../plans/dish-model-rewrite-phase-7-cleanup.md) |

---

## 0. End-state model

```
dishes                              (existing, extended)
├── price                           the base price (anchor for "from $X")
├── primary_protein, dietary_tags, allergens
├── serves, calories, spice_level, display_price_prefix
├── dining_format (NEW)             UX hint: NULL | 'buffet' | 'course_menu'
│                                              | 'interactive_table'
│                                              | 'shared_plates' | 'sampler'
├── bundled_items jsonb (NEW)       "comes with [...]" informational metadata
└── availability fields (NEW)       available_days, hours, dates

option_groups                       (existing, EXTENDED)
├── dish_id, name, selection_type ('single'|'multiple')
├── min_selections (0 = optional group; ≥1 = required group)
├── max_selections, display_order, is_active
└── display_in_card boolean (NEW)           feed-card descriptor opt-in flag

options                             (existing, EXTENDED with new columns)
├── option_group_id, name, price_delta, canonical_ingredient_id
├── is_available, display_order, calories_delta
├── price_override numeric (NEW)            non-linear pricing (tiered)
├── primary_protein text (NEW)              overrides base if set
├── adds_dietary_tags text[] (NEW)
├── removes_dietary_tags text[] (NEW)
├── adds_allergens text[] (NEW)             supplement to canonical_ingredient_allergens
├── serves_delta int (NEW)
└── is_default boolean (NEW)
```

**Removed (Phase 7):** `dishes.dish_kind`, `dishes.parent_dish_id`, `dishes.is_parent`, `dishes.is_template`, `dishes.price_per_person`, `dish_courses` table, `dish_course_items` table.

**Required vs optional semantics:** captured by `option_groups.min_selections`:
- `min_selections ≥ 1` = required group (must pick at least N).
- `min_selections = 0` = optional group (may pick zero or more up to `max_selections`).

No new enum needed. The user-facing labels in the admin UI ("Choose your protein" / "Add-ons") derive from the combination of `selection_type` + `min_selections`.

---

## 1. Phasing overview

Each phase is independently shippable. Phases 1–5 are additive; legacy code paths keep working. Phase 6 is the one destructive cutover.

| Phase | Component | Reversible? |
|---|---|---|
| 1 | Database — extend `options` + add `dishes` columns + new `generate_candidates` + app-config gate | ✅ pure-additive |
| 2 | Backend functions — worker, enrich-dish, feed | ✅ additive output fields |
| 3 | Shared package — types + validation schemas | ✅ additive |
| 4 | Admin app — review UI + confirm action (as RPC) | ✅ writes both shapes during transition |
| 5 | Mobile app — menu view + feed consumer | ✅ feature-flagged |
| 6 | Data migration — variants/courses/bundles → new shape | ⚠ destructive |
| 7 | Cleanup — drop legacy columns/tables, retire shims | ✅ after monitoring |

---

## 2. Cross-phase risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `option_groups`/`options` already in use; extending them mid-flight | High | Phase 1 migrations are pure-additive. New columns default to safe values. No existing reader breaks. |
| Confirm-action partial failure leaving orphan rows | High | Phase 4 §2 wraps confirm in a Postgres RPC with implicit transaction. Tested with simulated mid-failure. |
| Phase 6 variant→option price-delta computation bug | High | Use the SQL pattern in `phase-6-data-migration.md` §1 that anchors deltas to `MIN(variant.price)`. Dry-run + manual audit before production. |
| AI extraction regression after worker prompt change | Medium | Maintain a 50-menu test fixture set with golden outputs. Compare new prompt against old before deploy. Keep old prompt accessible via env flag for instant rollback. |
| Mobile clients on old version reading dropped columns post-Phase 6 | High | Force-upgrade gate at app startup (`phase-1-database.md` §6). Don't run Phase 6 until ≥95% on new version. |
| Feed response shape change breaks deployed mobile | Medium | Server deploys first. New `effective_*` fields are optional. Old mobile ignores them; new mobile uses them when present. |
| Redis cache returning stale feed responses | Low | Bump cache key to `feed:v2:`. Old cached entries naturally expire (TTL 5 min). |
| Worker mid-deploy stuck job | Low | Pre-deploy: drain `menu_scan_jobs` to zero rows in `processing` status. Confirm before deploy. |
| Re-enrichment cost (embedding recompute for affected dishes) | Low | One-time OpenAI cost. Batch through `pg_cron` over ~1 hour. ~$0.0001 per dish × ~10K dishes = ~$1. |
| RLS gap: malicious actor crafts modifier mutations for another restaurant | High | Phase 1 RLS policies on `options` table piggyback on existing `option_groups` policy. Explicit test cases in `admin-confirm-rpc.test.ts`. |
| `dish_categories.is_drink = true` interaction with modifier groups | Low | Existing filter applies at dish level; option-level modifiers inherit drink status. No special handling needed. |
| Generated columns (price_per_person) still referenced post-drop | Medium | Audit all code for `price_per_person` references before dropping in Phase 7. Replace with view or computed property. |

---

## 3. Sequencing and dependencies

```
Phase 1 (DB)  ──────────┐
                        ├─→ Phase 2 (Backend)  ─┐
Phase 3 (Shared) ───────┘                       │
                                                ├─→ Phase 4 (Admin)  ─┐
                                                │                     │
                                                └─→ Phase 5 (Mobile)  ┤
                                                                      │
                                                                      ├─→ Phase 6 (Data migration) → Phase 7 (Cleanup)
```

**Parallel work streams possible:**
- Phases 1 + 3 can land same week.
- Phase 2 starts once Phase 1 is on staging.
- Phases 4 and 5 can run in parallel after Phases 2 + 3 are merged.
- Phase 6 is the sequential gate (no parallel work).

---

## 4. Effort summary

| Phase | Engineer-days | Calendar (1 engineer) | Calendar (2 engineers, parallel where possible) |
|---|---|---|---|
| 1: Database + app-version gate | 2.5 | 2.5 days | 2.5 days |
| 2: Backend | 3 | 3 days | 3 days (parallel with 3) |
| 3: Shared | 1 | 1 day | parallel |
| 4: Admin (incl. test infra) | 6–7 | 7 days | parallel with 5 |
| 5: Mobile | 3–4 | 4 days | parallel with 4 |
| 6: Data migration + docs | 4 | 4 days | 4 days |
| 7: Cleanup | 1 | 1 day | 1 day |
| **Total dev** | **20.5–22.5** | **~4–5 weeks** | **~3 weeks** |

Plus QA, prompt tuning, data audit: **+3 days** safety buffer. Including the buffer, one-engineer calendar is **~5 weeks**, two-engineer parallel calendar is **~3.5 weeks**.

---

## 5. Acceptance gates (go/no-go per phase)

| Phase | Gate to next |
|---|---|
| 1 | All migrations apply on staging. Benchmarks within 20% of baseline. App-config edge function returns seed row. |
| 2 | Worker emits new shape for the 6 test fixtures cleanly. Feed returns `effective_*` fields. |
| 3 | `pnpm build` + `pnpm check-types` pass across all workspaces. |
| 4 | Admin can scan + confirm Pad Thai. Simulated mid-RPC failure leaves DB unchanged. |
| 5 | Mobile renders modifier groups inline. Legacy parent/variant dishes still render. |
| 6 | Pre/post counts match. Zero orphan rows. Feed quality shadow-comparison stable. |
| 7 | All deprecated code paths removed. Doc updates reviewed. |

---

## 6. Open questions to resolve before kickoff

1. **Generated `price_per_person` column.** Who reads it today? List callers; decide replacement strategy before Phase 7. Note: Phase 7 §1 already includes an explicit grep + replace task.
2. **Worker prompt A/B tooling.** Is there an existing framework for prompt-version comparison, or do we build a one-off script for Phase 2 acceptance?
3. **Re-enrichment batch budget.** OpenAI cost cap during the Phase 6 re-enrich sweep. Default: $10 ceiling.

**Resolved:**
- ~~Confirm RPC's `SECURITY DEFINER` model.~~ → Resolved: use `SECURITY INVOKER` + service-role caller pattern. See `phase-4-admin.md` §2.
- ~~apps/web-portal scope.~~ → Resolved: out of scope (legacy v1 portal, being retired).
- ~~apps/web-portal-v2 scope.~~ → Resolved 2026-05-17: out of scope per user direction.
- ~~`option_groups.selection_type='quantity'` semantics.~~ → Resolved 2026-05-17: codebase grep shows zero rendering branches; prod query confirmed zero rows. Migration 140 tightens the CHECK to `('single','multiple')`. Phase 3 drops `'quantity'` from the Zod enum and the TS union type. The admin form (`apps/web-portal/components/forms/dish/DishOptionsSection.tsx`) is on the retired v1 portal — no update needed.
- ~~Force-upgrade infrastructure.~~ → Resolved 2026-05-17: build it in Phase 1 (new `app_config` table + `app-config` edge function + mobile `useAppVersionGate` hook). See `phase-1-database.md` §6.
- ~~RPC testing infrastructure.~~ → Resolved 2026-05-17: extend Vitest with a `vitest.integration.config.ts` running against local Supabase (rejected pgTAP). See `phase-4-admin.md` §1.

---

## 7. Appendix — file change summary

### New files
- `infra/supabase/migrations/140_extend_option_groups_and_options.sql`
- `infra/supabase/migrations/141_dishes_dining_format_and_availability.sql`
- `infra/supabase/migrations/141a_app_config.sql`
- `infra/supabase/migrations/142_generate_candidates_modifier_aware.sql`
- `infra/supabase/migrations/143_get_group_candidates_modifier_aware.sql`
- `infra/supabase/migrations/144_admin_menu_scan_and_modifier_rpcs.sql` (contains both `admin_confirm_menu_scan` and `admin_replace_dish_modifiers`)
- `infra/supabase/migrations/145_migrate_configurable_variants_to_options.sql`
- `infra/supabase/migrations/146_migrate_bundle_to_bundled_items.sql`
- `infra/supabase/migrations/147_migrate_courses_to_option_groups.sql`
- `infra/supabase/migrations/148_buffet_to_dining_format.sql`
- `infra/supabase/migrations/149_trigger_reenrichment.sql`
- `infra/supabase/migrations/150_drop_legacy_dish_structure.sql`
- `infra/supabase/functions/app-config/index.ts`
- `apps/mobile/src/hooks/useAppVersionGate.ts`
- `apps/admin/vitest.integration.config.ts`
- `apps/admin/src/__tests__/integration/setup.ts`
- `apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts`
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ModifierGroupsEditor.tsx`
- `apps/mobile/src/screens/restaurant-detail/ModifierGroupsList.tsx`

### Modified files (admin)
- `apps/admin/src/app/(admin)/menu-scan/actions/menuScan.ts`
- `apps/admin/src/app/(admin)/menu-scan/actions/confirmSchema.ts`
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts`
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `apps/admin/src/app/(admin)/restaurants/[id]/AddDishButton.tsx`
- `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts`
- `apps/admin/src/lib/auth/dal.ts`
- `apps/admin/src/__tests__/menu-scan/useReviewState.test.ts` (rewritten)
- `apps/admin/src/__tests__/menu-scan/confirm-multi-kind.test.ts` → renamed to `confirm-modifier-groups.test.ts`

### Modified files (mobile)
- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts`
- `apps/mobile/src/screens/restaurant-detail/FoodTab.tsx`
- `apps/mobile/src/screens/restaurant-detail/DishMenuItem.tsx`
- `apps/mobile/src/screens/restaurant-detail/DishPhotoModal.tsx`
- `apps/mobile/src/services/edgeFunctionsService.ts`
- `apps/mobile/src/screens/BasicMapScreen.tsx`
- `apps/mobile/src/stores/restaurantStore.ts`
- `apps/mobile/src/utils/menuFilterUtils.ts`

### Modified files (backend)
- `infra/supabase/functions/menu-scan-worker/index.ts`
- `infra/supabase/functions/menu-scan-worker/test.ts`
- `infra/supabase/functions/enrich-dish/index.ts`
- `infra/supabase/functions/feed/index.ts`

### Modified files (shared)
- `packages/shared/src/constants/menu.ts`
- `packages/shared/src/types/restaurant.ts`
- `packages/shared/src/validation/menuScan.ts`
- `packages/shared/src/validation/dish.ts`
- `packages/database/src/types.ts` (regenerated)

### Files removed (Phase 7 only)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/VariantEditor.tsx`
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/CourseEditor.tsx`
- `apps/mobile/src/screens/restaurant-detail/DishGrouping.ts`
- `apps/mobile/src/screens/restaurant-detail/VariantPickerSheet.tsx`

### Documentation updates
- `CLAUDE.md`
- `agent_docs/architecture.md`
- `agent_docs/database.md`
- `agent_docs/terminology.md`
- `docs/project/06-database-schema.md`
- `docs/project/04-web-portal.md`
- `docs/project/05-mobile-app.md`

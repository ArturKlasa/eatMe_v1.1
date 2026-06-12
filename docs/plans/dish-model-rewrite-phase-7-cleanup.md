# Phase 7 — Cleanup: the coordinated drop

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** In progress (2026-06-11) — pulled forward by user decision; Phase 6 fully closed same day (conversion + re-embed + 51-flag triage all verified in prod).
**Authoritative drop scope:** this doc (supersedes the 2026-05-17 draft and `phase-6 §6` — both under-scoped; see §1).
**Reversibility:** ⚠ destructive. `163_REVERSE_ONLY` recreates columns/tables + restores prior function bodies, but column *data* is unrecoverable (already migrated to modifier groups by 158 — nothing meaningful is lost).

Drops `dishes.dish_kind`, `parent_dish_id`, `is_parent`, `is_template`, `price_per_person` and tables `dish_courses` + `dish_course_items`, with every live reader/writer rewritten.

---

## 0. Strategy: code first, SQL second

Code that stops **selecting/forwarding/writing** the doomed columns is backward-compatible with the current DB (selecting fewer columns never errors; old RPCs returning extra fields are ignored). The DB function rewrites can only ship inside the migration. So:

1. **Commit A (code)** — all app/edge cleanup. Deployable immediately; works against both pre- and post-163 schemas.
2. **Commit B (SQL)** — migration `163_phase7_coordinated_drop.sql` + `163_REVERSE_ONLY_*.sql` + read-only `verify-phase7.ts`.
3. **Deploy** `feed` + `enrich-dish` edge functions (from `infra/supabase/`).
4. **User applies 163** via Supabase dashboard SQL editor (no psql in this env).
5. **Verify** via `infra/scripts/verify-phase7.ts` (read-only; calls `generate_candidates` over REST).
6. **User rebuilds the mobile dev app** — old builds SELECT dropped columns in restaurant detail and will error post-163.
7. **Docs** (§5) + hand-update `packages/database/src/types.ts` (in Commit A; no supabase CLI gen here).

## 1. Scope corrections vs. the old plan / phase-6 §6 (found 2026-06-11)

| Old plan said | Reality |
|---|---|
| `generate_candidates` live def = mig 155 | **159** (turkey) redefined it AND `get_group_candidates`. Author from 159. |
| 4 DB functions to rewrite | **6**: + `admin_copy_restaurant_menu` (160 copies all 5 doomed columns + has a `dish_courses` guard) and + **`enrich-dish` edge fn** (selects `dish_kind`/`is_parent`/`parent_dish_id` on every dish insert via trigger — missing it breaks ALL enrichment). |
| — | Old `confirm_menu_scan` (mig 121, pre-admin scan RPC) inserts `dish_kind`/`is_template`. Sole caller is `apps/web-portal-v2` (on ice) → **DROP FUNCTION** in 163, no rewrite. |
| Delete VariantEditor/CourseEditor/VariantPickerSheet | Already gone (deleted in Phases 4–5). |
| Remove `@eatme/shared` shims (`DISH_KIND_META`, `DishKind`, legacy `Dish` fields) | **DEFERRED** — `apps/web-portal` + `web-portal-v2` still import them; removal lands with web-portal retirement. Compile-time only, zero runtime risk. |
| `price_per_person` caller replacement | Done in Phase 6 §5 (pure deletion; never rendered). |

**Accepted breakage (per parent plan "out of scope"):** `apps/web-portal` dish create/edit writes `dish_kind`/`is_template` → errors at runtime post-163. The legacy owner portal is being retired; the operator uses `apps/admin`. Same for web-portal-v2's scan confirm (on ice).

**Deliberately NOT touched (menu-scan lane owns, has uncommitted work):** `menu-scan-worker` (its `dish_kind` lands in the scan-payload jsonb only; the rewritten RPC simply ignores it), `ReviewDishEditor`/`useReviewState`, and `packages/shared/src/validation/menuScan.ts` schemas.

## 2. Migration 163 (single transaction)

| Object | Source of live body | Change |
|---|---|---|
| `generate_candidates` | 159 §3 | **DROP + CREATE** (signature change): remove `dish_kind`/`parent_dish_id`/`price_per_person` from RETURN TABLE + SELECT; remove `is_parent=false`/`is_template=false` filters. Re-GRANT to anon/authenticated/service_role. |
| `get_group_candidates` | 159 §4 | CREATE OR REPLACE: remove the 2 filter lines in the EXISTS subquery. |
| `admin_confirm_menu_scan` | 155 §3 | CREATE OR REPLACE: delete the whole legacy parent/variant/course branch + its DECLARE vars/counters; remove `dish_kind`/`is_parent`/`parent_dish_id`/`is_template` from the flat INSERT; keep parents/variants/courses counters OUT of audit log + return (admin action doesn't read them — verify at edit time). |
| `admin_copy_restaurant_menu` | 160 | CREATE OR REPLACE: remove 5 doomed columns from the dishes INSERT/SELECT, drop the `_dish_map pm` self-join, drop the `dish_courses` guard. |
| `_cron_embed_recovery_tick` | 133 | CREATE OR REPLACE: remove the 2 filter lines. |
| `confirm_menu_scan` (legacy) | 121 | **DROP FUNCTION**. |
| `dish_course_items`, `dish_courses` | 114 | DROP TABLE (RLS policies + indexes go with them). |
| `dishes` columns | — | `ALTER TABLE ... DROP COLUMN` ×5. Partial indexes `idx_dishes_parent_dish_id`/`idx_dishes_is_parent` (073) + CHECK `dishes_dish_kind_check` (115) drop automatically. |

Pre-flight guards at the top of 163 (abort if violated): 0 rows `is_parent=true`, 0 rows `parent_dish_id IS NOT NULL`, 0 rows `is_template=true`, 0 rows in `dish_courses`/`dish_course_items`.

## 3. Commit A — file-by-file

**Mobile** (`apps/mobile/src/`):
- `screens/restaurant-detail/dishTypes.ts` (NEW) — `DishWithGroups` moves here, minus `parent_dish_id`/`is_parent`.
- `screens/restaurant-detail/DishGrouping.ts` — **DELETE** (post-158 it's a pass-through; synthetic-group folding is dead).
- `FoodTab.tsx` — drop `groupDishesByParent` (render `sortedDishes(...)` directly); simplify featured-dish lookup (no variant-child fallback); import type from `dishTypes`.
- `DishMenuItem.tsx`, `useRestaurantDetail.ts` — import type from `dishTypes`.
- `RestaurantDetailScreen.tsx` — drop `dishKind` prop pass.
- `components/DishPhotoModal.tsx` — drop `dishKind` prop + `KIND_BADGE` (badge was bundle/course/buffet; `bundled_items` already renders "comes with" separately).
- `stores/restaurantStore.ts` — drop `dish_kind, parent_dish_id, is_parent` from the dish SELECT.

**Edge functions** (`infra/supabase/functions/`):
- `feed/index.ts` — drop `dish_kind` from Candidate type + response forward; drop `parent_dish_id` field + the `applyDiversity` per-parent cap (inert since 158: all NULL).
- `enrich-dish/index.ts` — drop the 3 columns from DishRow + SELECT; drop the parent-name fetch + `parentName`/`dishKind` from `buildEmbeddingInput` (check call site; minor embedding-input drift for future embeds only — acceptable, dishes are overwhelmingly `standard`).

**Admin** (`apps/admin/src/`):
- `lib/auth/dal.ts` — `AdminMenuDish`: remove `is_template`/`dish_kind`/`is_parent`/`parent_dish_id`/`variants`/`courses`; remove `AdminMenuCourse`; trim SELECT + mapping; delete the courses query + variant nesting (all dishes are top-level now).
- `restaurants/[id]/DishRowEditor.tsx` — remove variant/course sublists + `dish_kind`/variants/courses/template badges.
- `restaurants/[id]/AddDishButton.tsx` — remove `is_template`/`dish_kind`/`is_parent`/`parent_dish_id` from the insert payload.
- `restaurants/[id]/actions/dish.ts` — remove `dish_kind` from create/update schemas, payload, and SELECT.
- `__tests__` — update `admin-confirm-rpc.test.ts` / `confirm-modifier-groups.test.ts` expectations (legacy counters/fields).

**Types:** `packages/database/src/types.ts` — hand-remove the 5 columns from `dishes` Row/Insert/Update, the `dish_courses`/`dish_course_items` table defs, the 3 fields from `generate_candidates` Returns, and the `confirm_menu_scan` function entry.

**Validation:** `turbo check-types` + admin vitest + eslint on touched files. (5 pre-existing tsc errors in mobile gamification/dishPhoto/useRestaurantDetail are known and unrelated.)

## 4. Apply + verify sequence

1. Commit A lands + edge deploys → everything still works on the old schema.
2. User runs 163 in the dashboard SQL editor (it's transactional; guards abort safely).
3. `pnpm exec ts-node infra/scripts/verify-phase7.ts` — read-only: doomed columns gone (REST select errors), `generate_candidates` RPC returns rows without the dropped fields, copy/confirm functions exist, feed edge fn smoke.
4. User rebuilds mobile dev app on device.

## 5. Docs (after 163 is live)

- `/CLAUDE.md` — replace "Dish Kind — Composition Type" with a "Dish model — modifier groups + dining_format" section; drop pitfall references if any.
- `agent_docs/architecture.md` / `database.md` / `terminology.md`; `docs/project/06-database-schema.md`, `04-web-portal.md`, `05-mobile-app.md`.

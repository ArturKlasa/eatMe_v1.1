# Universal Dish Structure — Schema Migration & Implementation

## Objective

Implement the universal dish structure redesign: add parent-child variant model to the dishes table, expand dish_kind, add menu schedule_type, add serves/price_per_person fields, update the feed/recommendation engine, update mobile menu view grouping, update admin/AI data entry flows, and update all TypeScript types — so that the platform can represent any dish pattern (template, combo, buffet, experience, group meals) through one unified data model.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo) with:

- **`apps/mobile`** — React Native + Expo, map-based dish discovery, Zustand stores, recommendation feed
- **`apps/web-portal`** — Next.js, restaurant owner onboarding, admin dashboard, AI menu scanning (GPT-4o Vision)
- **Backend** — Supabase (PostgreSQL + PostGIS + pgvector), Edge Functions (feed, enrich-dish, group-recommendations, etc.), Upstash Redis
- **Shared packages** — `packages/database` (Supabase client + auto-generated types)

### The Problem

The current dish model only supports flat dishes with option_groups. It cannot properly represent configurable dishes (poke bowls, build-your-own, combos, buffets) in a way that works for both:
1. **Recommendation engine** — needs individually addressable variants with accurate allergens, dietary_tags, price, and embeddings
2. **Menu presentation** — needs to group variants under a parent dish for clean display

### The Solution (Designed & Approved)

A complete design document exists at `.agents/planning/2026-04-05-universal-dish-structure/design/detailed-design.md`. **You must follow this design document precisely.** It specifies:

- **Parent-child variant model**: `parent_dish_id` FK + `is_parent` boolean on dishes table
- **Primary dimension approach**: resolve the most dietary-significant choice (usually protein) into separate dish rows; secondary choices (sauce, size) stay as option_groups
- **New fields**: `serves` (integer), `price_per_person` (generated column), `schedule_type` on menus
- **Expanded `dish_kind`**: `'standard' | 'template' | 'experience' | 'combo'`
- **Feed changes**: exclude parents from candidates, diversity cap per parent_dish_id, new filters (daily menu, group meals, time-based)
- **Mobile changes**: client-side grouping by parent_dish_id for menu view
- **AI extraction changes**: updated GPT prompt to detect primary dimension patterns

### Supporting Research

Research notes with analysis and decision rationale are in `.agents/planning/2026-04-05-universal-dish-structure/research/`:
- `variant-explosion-analysis.md` — Why primary dimension approach was chosen (scored 8.4/10 vs alternatives)
- `buffet-model-analysis.md` — Why buffets use dietary-profile variants
- `combo-model-analysis.md` — Why combos are first-class entities with main-dish variants
- `small-plates-group-meals-analysis.md` — Why `serves` integer is sufficient

### Key Source Files

**Database schema** (source of truth):
- `infra/supabase/migrations/database_schema.sql` — current table definitions
- `packages/database/src/types.ts` — auto-generated TypeScript types

**Feed/recommendation engine**:
- `infra/supabase/functions/feed/index.ts` — two-stage pipeline (generate_candidates SQL + rankCandidates JS)
- `infra/supabase/migrations/072_remove_swipe_feature.sql` — latest generate_candidates() function
- `infra/supabase/functions/enrich-dish/index.ts` — embedding generation, must skip parent dishes

**Mobile app**:
- `apps/mobile/src/screens/RestaurantDetailScreen.tsx` — menu view (needs parent-child grouping)
- `apps/mobile/src/lib/supabase.ts` — types (needs DishWithVariants, updated RestaurantWithMenus)
- `apps/mobile/src/stores/filterStore.ts` — filter definitions (needs groupMeals daily filter)

**Web portal**:
- `apps/web-portal/types/restaurant.ts` — Dish, Menu types (needs new fields)
- `apps/web-portal/app/api/menu-scan/route.ts` — AI extraction (needs updated GPT prompt)
- `apps/web-portal/lib/restaurantService.ts` — restaurant/menu CRUD services
- `apps/web-portal/app/admin/menu-scan/page.tsx` — admin menu scan UI

**Group recommendations**:
- `infra/supabase/functions/group-recommendations/index.ts` — must exclude parent dishes

## Requirements

1. **Database migration**: Add `parent_dish_id` (uuid FK self-referencing with ON DELETE CASCADE), `is_parent` (boolean, default false), `serves` (integer, default 1, CHECK >= 1), `price_per_person` (generated stored column: price/serves) to dishes table. Expand `dish_kind` CHECK to include `'combo'`. Add `schedule_type` (`'regular' | 'daily' | 'rotating'`, default 'regular') to menus table. Add indexes on `parent_dish_id` and `is_parent`.
2. **Update generate_candidates() SQL function**: Add `WHERE d.is_parent = false` to exclude parent dishes. Add time-based menu filtering using existing `available_start_time`/`available_end_time`/`available_days`. Add `schedule_type` filter parameter. Add `serves >= 2` filter parameter for group meals. Add new parameters: `p_current_time`, `p_current_day`, `p_schedule_type`, `p_group_meals`.
3. **Update feed edge function (rankCandidates + applyDiversity)**: Add parent-dish-level diversity cap (max 1 variant per `parent_dish_id`) in `applyDiversity()`. Pass new filter parameters from request to generate_candidates. Add `groupMeals` and `scheduleType` to request interface.
4. **Update enrich-dish edge function**: Skip enrichment/embedding for dishes with `is_parent = true`. Ensure variant dishes build embedding input including their variant-specific name and ingredients.
5. **Update group-recommendations edge function**: Add `is_parent = false` filter to candidate query.
6. **Regenerate TypeScript types**: Run `supabase gen types typescript` after migration. Update `packages/database/src/types.ts`.
7. **Update web-portal types**: Add `parent_dish_id`, `is_parent`, `serves`, `price_per_person`, `variants` to Dish interface. Add `DishKind: 'combo'`. Add `ScheduleType` and `schedule_type` to Menu interface. Update `apps/web-portal/types/restaurant.ts`.
8. **Update mobile types**: Add updated compound query shapes (`DishWithVariants`, updated `RestaurantWithMenus`). Update `apps/mobile/src/lib/supabase.ts`.
9. **Update mobile RestaurantDetailScreen**: Implement client-side grouping logic — group dishes by `parent_dish_id`, render parent as header with variants listed underneath showing individual prices, option_groups on variants. Standalone dishes render as before.
10. **Update mobile filterStore**: Add `groupMeals` boolean to daily filters. Pass to feed request.
11. **Update AI menu scan prompt**: Update GPT-4o Vision system prompt in `/api/menu-scan/route.ts` to detect "choose your protein" patterns and output parent + variant dish structures with correct `parent_dish_id` references and per-variant pricing/ingredients.
12. **Update restaurantService**: Ensure `saveMenus()` and `submitRestaurantProfile()` handle parent + variant dish creation (insert parent first, then variants with parent_dish_id).
13. **Verify backwards compatibility**: All existing dishes must work unchanged with default values (`parent_dish_id: null`, `is_parent: false`, `serves: 1`). No data migration needed.

## Constraints

- **Follow the design document**: `.agents/planning/2026-04-05-universal-dish-structure/design/detailed-design.md` is the specification. Do not deviate from schema definitions, field names, or enum values specified there.
- **Read research notes**: Consult the research files in `.agents/planning/2026-04-05-universal-dish-structure/research/` for decision rationale when making implementation choices.
- **Read before writing**: Always read the current state of a file before modifying it. The codebase has recent changes that may not match older assumptions.
- **Migration safety**: The migration must be additive only — no data loss, no breaking changes to existing rows. All new columns must have sensible defaults.
- **Type generation**: After the database migration, regenerate types with `supabase gen types typescript --project-id tqroqqvxabolydyznewa > packages/database/src/types.ts`. Manually authored types must match the generated schema.
- **Test with existing data**: Existing dishes (standard, template, experience kinds) must continue to work. The feed must return the same results for restaurants without variants.
- **No new tables**: The design uses self-referential FK on dishes table, not separate variant tables.
- **No new dependencies**: Use existing libraries and patterns in the codebase.

## Success Criteria

The task is complete when:

- [ ] Database migration file created and applies cleanly (new columns, constraints, indexes on dishes + menus tables)
- [ ] `generate_candidates()` SQL function updated with parent exclusion, time-based filtering, schedule_type filter, and group meals filter
- [ ] Feed edge function updated: new filters passed through, applyDiversity enforces max 1 per parent_dish_id
- [ ] Enrich-dish edge function skips `is_parent = true` dishes
- [ ] Group-recommendations edge function excludes parent dishes
- [ ] `packages/database/src/types.ts` regenerated with new columns
- [ ] Web-portal TypeScript types updated (Dish, Menu, DishKind, ScheduleType)
- [ ] Mobile TypeScript types updated (DishWithVariants, RestaurantWithMenus)
- [ ] Mobile RestaurantDetailScreen groups dishes by parent_dish_id with clean variant rendering
- [ ] Mobile filterStore has `groupMeals` daily filter wired to feed request
- [ ] AI menu scan GPT prompt updated to detect and output parent + variant structures
- [ ] restaurantService handles parent + variant dish creation/saving
- [ ] All existing dishes continue to work with default values (backwards compatible)
- [ ] No regressions in feed results for restaurants without variants

## Notes

- The database already has `available_start_time`, `available_end_time`, and `available_days` on the menus table — these just need to be used in `generate_candidates()`.
- The existing `menu_type` field (`'food' | 'drink'`) is a different concern from `schedule_type` (`'regular' | 'daily' | 'rotating'`). Both are needed.
- `price_per_person` is a `GENERATED ALWAYS AS (ROUND(price / serves, 2)) STORED` column — never manually set.
- Parent dishes have `is_parent: true`, `price: 0`, no embedding, excluded from feed. They exist purely for menu display grouping.
- The `ON DELETE CASCADE` on `parent_dish_id` ensures deleting a parent removes all its variants.
- Option_groups remain per-dish (duplicated on each variant). The "Copy options" UI tooling is a future enhancement, not part of this task.
- Start by reading the full design document before implementing anything.
- Mark the Progress Log checkboxes as you complete each item so the orchestrator can track progress.

## Progress Log

- [ ] Database migration created
- [ ] generate_candidates() updated
- [ ] Feed edge function updated
- [ ] Enrich-dish updated
- [ ] Group-recommendations updated
- [ ] TypeScript types regenerated
- [ ] Web-portal types updated
- [ ] Mobile types updated
- [ ] RestaurantDetailScreen updated with grouping
- [ ] FilterStore updated with groupMeals
- [ ] AI menu scan prompt updated
- [ ] restaurantService updated
- [ ] Backwards compatibility verified

---

The orchestrator will continue iterations until limits are reached.

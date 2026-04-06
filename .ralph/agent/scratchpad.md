
---
## Iteration: 2026-04-06 — Universal Dish Structure implementation

### What was done in this iteration:

1. **Migration 073** (`infra/supabase/migrations/073_universal_dish_structure.sql`):
   - Added `parent_dish_id`, `is_parent`, `serves`, `price_per_person` to dishes table
   - Expanded `dish_kind` CHECK to include 'combo'
   - Added `schedule_type` to menus table
   - Added indexes on `parent_dish_id` and `is_parent`
   - Updated `generate_candidates()` with new params: `p_current_time`, `p_current_day`, `p_schedule_type`, `p_group_meals`; added `is_parent = false` filter; returns new columns
   - Added `get_group_candidates()` with `is_parent = false` filter in dish sub-query

2. **Feed edge function** (`infra/supabase/functions/feed/index.ts`):
   - Added `scheduleType`, `groupMeals`, `currentTime`, `currentDayOfWeek` to FeedRequest.filters
   - Added `parent_dish_id`, `serves`, `price_per_person` to Candidate interface
   - Updated `applyDiversity()` to enforce max 1 variant per parent_dish_id
   - Passed new parameters to `generate_candidates` RPC

3. **Enrich-dish** (`infra/supabase/functions/enrich-dish/index.ts`):
   - Skip enrichment if `dish.is_parent === true`
   - Added `is_parent`, `parent_dish_id` to DishRow type and select query

4. **TypeScript types**:
   - `apps/web-portal/types/restaurant.ts`: Added `DishKind: 'combo'`, `ScheduleType`, `parent_dish_id`, `is_parent`, `serves`, `price_per_person`, `variants` to Dish; added `schedule_type`, `available_*` to Menu
   - `apps/mobile/src/lib/supabase.ts`: Added `DishWithVariants`, updated `RestaurantWithMenus`

5. **Mobile filterStore** (`apps/mobile/src/stores/filterStore.ts`):
   - Added `groupMeals: boolean` to DailyFilters
   - Added `toggleGroupMeals` action
   - Updated `getDailyFilterCount()`

6. **Mobile RestaurantDetailScreen** (`apps/mobile/src/screens/RestaurantDetailScreen.tsx`):
   - Added `parent_dish_id`, `is_parent` to DishWithGroups
   - Added `groupDishesByParent()` function
   - Updated food tab rendering to group variants under parent header

7. **AI menu scan** (`apps/web-portal/app/api/menu-scan/route.ts`):
   - Updated system prompt to detect "choose your protein" patterns
   - Output schema now includes `is_parent`, `dish_kind`, `variants[]` fields

8. **restaurantService** (`apps/web-portal/lib/restaurantService.ts`):
   - Updated `saveMenus()` to insert parent dishes first, then variants with `parent_dish_id`
   - Handles inline `dish.variants[]` and explicit `dish.parent_dish_id` references

### Blocked:
- TypeScript types regeneration requires applying migration 073 to the live Supabase DB first
  Then: `supabase gen types typescript --project-id tqroqqvxabolydyznewa > packages/database/src/types.ts`

### Migration application note:
Migration file 073 cannot be pushed with `supabase db push` due to naming convention mismatch.
Apply via Supabase Dashboard SQL Editor: copy content of `infra/supabase/migrations/073_universal_dish_structure.sql`.

---
## Iteration: 2026-04-06 — Critic review of ts:regen complete increment

### Review findings:

**TypeScript type check**: Passes — only pre-existing error in app/onboard/basic-info/page.tsx (confirmed pre-existed via git stash test). No new errors introduced.

**group-recommendations**: Edge function not directly modified, but `get_group_candidates()` SQL function was updated in migration 073 with `AND d.is_parent = false`. Requirement satisfied at SQL level.

**BUG FOUND — restaurantService.ts line 501 (operator precedence)**:
```javascript
// Intended: mark as parent if is_parent=true OR if dish has inline variants
is_parent: dish.is_parent ?? (dish.variants && dish.variants.length > 0) ? true : false,
```
In JS, `??` has HIGHER precedence than `? :`, so this parses as:
```
(dish.is_parent ?? (dish.variants && dish.variants.length > 0)) ? true : false
```
When `dish.is_parent = false` (not null/undefined), `??` short-circuits and returns `false`.
The ternary then returns `false` — even if variants are present.

**Fix**: Replace with:
```javascript
is_parent: !!(dish.is_parent || (dish.variants && dish.variants.length > 0)),
```

**Decision**: reject — concrete bug, one-line fix.

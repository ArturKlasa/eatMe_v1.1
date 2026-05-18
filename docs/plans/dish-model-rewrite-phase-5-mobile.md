# Phase 5 — Mobile app

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Proposed
**Last updated:** 2026-05-17
**Estimated wall time:** 3–4 days
**Reversibility:** Feature-flagged behind app version — old builds keep using legacy parent/variant rendering.

Extend the restaurant detail query to fetch new option columns, replace `groupDishesByParent` with a flat list + `<ModifierGroupsList>`, add `classifyOption` filter utility, and update the feed card to compose names from `applied_options`.

---

## 1. Restaurant detail queries

**File:** `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts`

Extend the dish query (the existing `option_groups(options(...))` join already exists; just add new fields):

```ts
.select(`
  id, name, description, price, display_price_prefix,
  dining_format, bundled_items, serves,
  primary_protein, dietary_tags, allergens, spice_level, image_url,
  available_days, available_hours_start, available_hours_end,
  status, is_available,
  option_groups(
    id, name, selection_type, min_selections, max_selections,
    display_order, display_in_card, is_active,
    options(
      id, name, price_delta, price_override, primary_protein,
      adds_dietary_tags, removes_dietary_tags, adds_allergens,
      serves_delta, calories_delta, is_default, display_order,
      is_available, canonical_ingredient_id
    )
  )
`)
```

Note: `calories_delta` is the existing plural column on `options`. No `spice_delta` (dropped from v1 — conflicts with categorical `spice_level` enum on dishes).

Sort groups + options client-side by `display_order`.

## 2. Menu rendering changes

**File:** `apps/mobile/src/screens/restaurant-detail/FoodTab.tsx`

- Remove `groupDishesByParent()` call. Render dishes as a flat list per category.
- For each dish, render a `<ModifierGroupsList>` inline below the dish row.
- Switch outer container layout on `dish.dining_format`.

**New file:** `apps/mobile/src/screens/restaurant-detail/ModifierGroupsList.tsx`

```tsx
interface Props {
  groups: ModifierGroup[];
  permanent: PermanentFilters;
  daily: DailyFilters;
  basePrice: number;
}
```

Renders each group as a section with header (group name + chip from selection_type + min_selections to convey required/optional), then list of options with annotations via `classifyOption`.

**File:** `apps/mobile/src/screens/restaurant-detail/DishMenuItem.tsx`

- Drop the `is_parent` branching (was the trigger for VariantPickerSheet).
- Render `<ModifierGroupsList>` as child component if groups exist.
- Use `bundled_items` to render the "comes with" subtitle line.
- Use `dining_format` for outer card class.

**File:** `apps/mobile/src/screens/restaurant-detail/DishGrouping.ts`

Keep during transition (legacy parent/variant data still exists). Remove in Phase 7.

**File:** `apps/mobile/src/screens/restaurant-detail/VariantPickerSheet.tsx`

Keep during transition (legacy data still triggers it for old parent/variant rows). Remove in Phase 7.

**File:** `apps/mobile/src/screens/restaurant-detail/DishPhotoModal.tsx`

- Replace `dish_kind` badge with `dining_format` badge (only when set).
- The existing `option_groups` rendering already exists — just ensure new fields render (allergy badges, primary_protein annotations, removes_dietary_tags chips).

## 3. Filter utilities

**File:** `apps/mobile/src/utils/menuFilterUtils.ts`

Add `classifyOption`:
```ts
export interface OptionClassification {
  triggersAllergy: string[];
  stripsDietaryTags: string[];
  matchesPreferredProtein: boolean;
  matchesDailyMeatType: boolean;
}

export function classifyOption(
  option: {
    adds_allergens?: string[];
    removes_dietary_tags?: string[];
    primary_protein?: string | null;
  },
  permanent: PermanentFilters,
  daily: DailyFilters,
): OptionClassification { /* ... */ }
```

## 4. Feed consumer

**File:** `apps/mobile/src/services/edgeFunctionsService.ts`

Update `ServerDish` interface:
```ts
interface ServerDish {
  // existing fields...
  effective_price?: number;
  effective_primary_protein?: string;
  effective_dietary_tags?: string[];
  effective_allergens?: string[];
  applied_options?: Array<{
    option_id: string;
    group_name: string;
    group_display_in_card: boolean;
    name: string;
    primary_protein: string | null;
    price_delta: number;
  }>;
  dining_format?: DiningFormat | null;
  bundled_items?: Array<{name: string; note?: string}> | null;
}
```

**File:** `apps/mobile/src/screens/BasicMapScreen.tsx` (or wherever the feed dish card renders)

The dish.name stored in DB is a plain string (`"Pad Thai"`). The card descriptor `"with chicken"` is **composed at display time** from `applied_options[]`. Use the **Hybrid A+C rule**:

1. From `applied_options`, build `displayDescriptors`:
   - Include the option if `group_display_in_card === true` (Approach A — explicit override).
   - **OR** if `option.primary_protein` is set (Approach C — protein-introducing options are meaningful by default).
2. Compose card name:

```ts
function composeCardName(dish: ServerDish): string {
  const descriptors = (dish.applied_options ?? [])
    .filter(opt => opt.group_display_in_card || opt.primary_protein !== null)
    .map(opt => opt.name);

  if (descriptors.length === 0) return dish.name;
  if (descriptors.length === 1) return `${dish.name} with ${descriptors[0]}`;
  if (descriptors.length === 2) return `${dish.name} with ${descriptors[0]} and ${descriptors[1]}`;
  // Cap at 2; if more, show first + count
  return `${dish.name} with ${descriptors[0]} (+${descriptors.length - 1} more)`;
}
```

Examples:

| Scenario | Composed name |
|---|---|
| Pizza Margherita, Size=Medium (no protein, display_in_card=false), Toppings=Pepperoni (pork, display_in_card=true) | `Pizza Margherita with Pepperoni — $20` |
| Pad Thai, Protein=Chicken (chicken, display_in_card=true) | `Pad Thai with chicken — $14` |
| Build Your Bowl, Base=Brown rice (no protein, display_in_card=false), Protein=Chicken (chicken, display_in_card=false but primary_protein matches → included via C) | `Build Your Bowl with chicken — $14` |
| Burger Meal, Burger=Classic Cheeseburger (beef, display_in_card=true), Side=Fries (no protein, false), Drink=Coke (no protein, false) | `Burger Meal with Classic Cheeseburger — $15` |
| Caesar Salad, no required modifiers, no applied options | `Caesar Salad — $10` |

Also:
- Use `effective_dietary_tags` for chips on the card.
- Use `effective_allergens` for badge logic.
- Use `effective_price` for the price display.

## 5. Restaurant store

**File:** `apps/mobile/src/stores/restaurantStore.ts`

Mirror the query shape from `useRestaurantDetail`.

## 6. Backward compatibility

**Mobile-server contract:**
- Server is **deployed first** (Phase 2 ships fields, mobile ignores them).
- Mobile updates **after** server is live (so new mobile reading `effective_price` always sees a value).
- Force-upgrade gate: see `phase-1-database.md` §6 — `app-config` edge function + `useAppVersionGate` hook. Mobile shows "update required" screen below threshold.
- Phase 6 (drop legacy columns) only after force-upgrade penetration ≥ 95% — typically 4–6 weeks after release.

## 7. Tests

- `classifyOption` unit tests: veg user + chicken option → `stripsDietaryTags=['vegetarian']`; shellfish-allergic user + shrimp option → `triggersAllergy=['shellfish']`.
- `ModifierGroupsList` component test: renders sections per group, applies annotations.
- Feed card test: renders with `applied_options` populated vs empty.
- E2E test (Maestro/Detox): scan a Pad Thai → confirm → mobile shows it with protein options inline.

## 8. Acceptance criteria

- New mobile build renders modifier groups for new dishes in restaurant detail.
- Old (legacy parent/variant) dishes still render correctly via the kept-during-transition `DishGrouping` code.
- Feed card shows `applied_options` configuration in the dish name.
- Allergy badges, vegetarian chips per option work correctly.

## 9. Effort: 3–4 days

1d query + types extension, 1d ModifierGroupsList + DishMenuItem update, 1d filter classifyOption + tests, 1d feed card updates + tests.

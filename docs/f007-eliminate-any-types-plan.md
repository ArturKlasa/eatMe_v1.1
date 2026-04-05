# F-007: Eliminate `any` Type Usage in Web Portal

**Priority:** HIGH  
**Scope:** `apps/web-portal` only  
**Current count:** 35 occurrences across 8 files  
**Goal:** 0 `any` + ESLint rule to prevent regressions

---

## Current State (Audit — April 2026)

```
10  lib/restaurantService.ts
 7  components/forms/DishFormDialog.tsx
 7  app/admin/restaurants/[id]/menus/page.tsx  (6 catch + 1 cast)
 4  app/admin/ingredients/page.tsx
 3  components/admin/NewRestaurantForm.tsx
 2  components/forms/DishCard.tsx
 1  app/admin/page.tsx
 1  app/admin/layout.tsx
──
35  total
```

---

## Root Causes

Eight patterns account for all 35 occurrences (some occurrences fall into multiple patterns):

| Pattern                                                         | Count | Root cause                                                                                                                            |
| --------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `catch (error: any)` / `(error as any)`                         | 13    | Pre-TS 4.4 habit; `catch` binding defaults to `unknown` now. 12 catch blocks + 1 `as any` cast in logging.                            |
| Supabase nested query result lambdas                            | 10    | No local types for deeply-nested select responses                                                                                     |
| `as any` casts to bridge type mismatches                        | 6     | Two separate `Dish` types (`Tables<'dishes'>` vs `types/restaurant.Dish`), untyped `insertData`, untyped `selectedIngredients` access |
| Form library / Hook Form resolver cast                          | 1     | Version mismatch between `@hookform/resolvers` and `react-hook-form` generics                                                         |
| `(dish as any).field` — accessing fields that exist on the type | 2     | Unnecessary casts; fields are declared on `Partial<Dish>` already                                                                     |
| `selectedIngredients` element typed as `any` in `.map()`        | 1     | DishCard uses `(ing: any)` inside `.map()` — separate from the `as any` cast on the array itself                                      |
| `useState<any>` for Supabase User                               | 1     | Missing `User` import from `@supabase/supabase-js`                                                                                    |
| `:any` annotation in DishFormDialog Supabase callbacks          | 2     | Supabase query results mapped without types                                                                                           |

---

## Implementation Plan

### Phase 1 — `catch (error: any)` → `catch (error: unknown)` (13 occurrences)

**Files affected (12 catch blocks + 1 `as any` cast):**

- `app/admin/ingredients/page.tsx` — 4 catches
- `app/admin/restaurants/[id]/menus/page.tsx` — 6 catches
- `components/admin/NewRestaurantForm.tsx` — 1 catch (`err: any`)
- `components/forms/DishFormDialog.tsx` — 1 catch
- `app/admin/page.tsx` — 1 `(error as any).statusCode` (not a catch, but same error-typing issue)

**Pattern to apply everywhere:**

```typescript
// Before
} catch (error: any) {
  toast.error(error.message);
}

// After
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  toast.error(message);
}
```

**Special case — `app/admin/page.tsx` line 40:**

This is NOT inside a catch block — it's inside an `if (error)` check after a Supabase query where `error` is a `PostgrestError`. The `statusCode` property does not exist on `PostgrestError` (which has `.code: string` and `.status: number` instead).

```typescript
// Before
if (error) {
  console.error('[Admin] Failed to load stats:', {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    statusCode: (error as any).statusCode, // wrong field name, always undefined
  });
}

// After — just remove the non-existent field:
if (error) {
  console.error('[Admin] Failed to load stats:', {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}
```

> **Effort:** Low — mechanical find-and-replace. No business logic changes.

---

### Phase 2 — Type Supabase nested query responses in `restaurantService.ts` (10 occurrences)

All 10 occurrences are lambda parameters for mapping results of:

```typescript
supabase
  .from('restaurants')
  .select('*, menus(*, menu_categories(*, dishes(*, option_groups(*, options(*)))))');
```

Supabase JS v2 can infer the nested shape via `Database` generics, but the current code overrides with `as FormProgress`, losing the inferred type mid-map. The fix is to define local raw-result interfaces that match the select shape, then use them as lambda types.

**Add to `lib/restaurantService.ts`** (exported so `DishFormDialog.tsx` can reuse `RawOptionGroup` in Phase 4c):

```typescript
// ─── Raw Supabase select result shapes (exported for reuse in DishFormDialog) ─

/** Raw option row as returned by nested select. */
type RawOption = {
  id: string;
  name: string;
  description?: string | null;
  price_delta: number;
  calories_delta?: number | null;
  canonical_ingredient_id?: string | null;
  is_available?: boolean | null;
  display_order?: number | null;
};

/** Raw option_group row with nested options as returned by nested select. */
type RawOptionGroup = {
  id: string;
  name: string;
  description?: string | null;
  selection_type: string;
  min_selections?: number | null;
  max_selections?: number | null;
  display_order?: number | null;
  is_active?: boolean | null;
  options?: RawOption[];
};

/** Raw dish row with nested option_groups as returned by nested select. */
type RawDish = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  calories?: number | null;
  dietary_tags?: string[] | null;
  allergens?: string[] | null;
  spice_level?: string | null;
  image_url?: string | null;
  is_available?: boolean | null;
  dish_category_id?: string | null;
  description_visibility?: string | null;
  ingredients_visibility?: string | null;
  dish_kind?: string | null;
  display_price_prefix?: string | null;
  option_groups?: RawOptionGroup[];
};

/** Raw menu_category row with nested dishes as returned by nested select. */
type RawMenuCategory = {
  id: string;
  dishes?: RawDish[];
};

/** Raw menu row with nested menu_categories as returned by nested select. */
type RawMenu = {
  id: string;
  name: string;
  description?: string | null;
  menu_type?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
  menu_categories?: RawMenuCategory[];
};
```

**Then replace all `any` lambdas:**

```typescript
// Before
menus: (restaurant.menus ?? []).map((menu: any) => ({

// After — note: parentheses around the entire expression, not just the cast
menus: ((restaurant.menus ?? []) as RawMenu[]).map((menu) => ({
```

This applies to all 10 occurrences across `getRestaurantFull` and `getRestaurantWithMenus`.

> **Effort:** Medium — add ~50 lines of type definitions, then mechanical substitution. No logic changes.

---

### Phase 3 — Fix `admin/layout.tsx` `useState<any>` (1 occurrence)

`AdminHeader` already declares `user: User` from `@supabase/supabase-js`. The layout state just needs the correct type.

```typescript
// Before
import { ReactNode, useEffect, useState } from 'react';
// ...
const [user, setUser] = useState<any>(null);

// After
import { ReactNode, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
// ...
const [user, setUser] = useState<User | null>(null);
```

The `AdminHeader` call in JSX passes `user` which would then be `User | null`. If `AdminHeader` requires `user: User` (non-nullable), add a guard before rendering:

```tsx
// AdminHeader only renders after loading=false, which only sets when user exists,
// so the non-null assertion is safe here:
<AdminHeader user={user!} />
```

Or change `AdminHeader` props to `user: User | null` and guard internally. The `user!` approach is the minimal change.

> **Effort:** Trivial — 2-line change.

---

### Phase 4 — Fix `DishFormDialog.tsx` (4 non-catch occurrences)

#### 4a — `zodResolver(dishSchema) as any` (line 103)

The project uses `@hookform/resolvers` v5.2+ which has native Zod v4 support. `DishFormData` is `z.infer<typeof dishSchema>`, so the resolver types align. Simply remove the cast:

```typescript
// Before
resolver: zodResolver(dishSchema) as any,

// After
resolver: zodResolver(dishSchema),
```

No version bump or `Resolver<DishFormData>` cast needed — the current dependency versions support this directly.

#### 4b — `(dish as any).description_visibility` / `.ingredients_visibility` (lines 155–156)

Both fields are already declared on `types/restaurant.Dish` (lines 75–76). The `dish` prop is typed as `Partial<Dish> & { id?: string }`, so both fields should be accessible without a cast:

```typescript
// Before
description_visibility: (dish as any).description_visibility ?? 'menu',
ingredients_visibility: (dish as any).ingredients_visibility ?? 'detail',

// After — no cast needed
description_visibility: dish.description_visibility ?? 'menu',
ingredients_visibility: dish.ingredients_visibility ?? 'detail',
```

#### 4c — Supabase option_groups query result mapping (lines 177–180)

```typescript
// Before
data.map((g: any) => ({
  ...g,
  options: (g.options ?? []).sort((a: any, b: any) => a.display_order - b.display_order),
}));

// After — reuse exported RawOptionGroup from Phase 2
import type { RawOptionGroup } from '@/lib/restaurantService';

data.map((g: RawOptionGroup) => ({
  ...g,
  options: (g.options ?? []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
}));
```

#### 4d — `dish_ingredients` query result mapping (line 211)

```typescript
// Define the row shape inline (matches the .select() columns exactly):
type DishIngredientRow = {
  ingredient_id: string;
  quantity: string | null;
  canonical_ingredient: {
    id: string;
    canonical_name: string;
    ingredient_family_name: string | null;
    is_vegetarian: boolean;
    is_vegan: boolean;
    ingredient_aliases: Array<{ id: string; display_name: string }>;
  } | null;
};

// Before
const loaded = data.map((row: any) => { ... });

// After
const loaded = data.map((row: DishIngredientRow): Ingredient => {
  const alias = row.canonical_ingredient?.ingredient_aliases?.[0];
  return {
    id: alias?.id ?? row.ingredient_id,
    display_name: alias?.display_name ?? row.canonical_ingredient?.canonical_name ?? '',
    canonical_ingredient_id: row.ingredient_id,
    canonical_name: row.canonical_ingredient?.canonical_name,
    ingredient_family_name: row.canonical_ingredient?.ingredient_family_name ?? undefined,
    is_vegetarian: row.canonical_ingredient?.is_vegetarian,
    is_vegan: row.canonical_ingredient?.is_vegan,
    quantity: row.quantity ?? undefined,
  };
});
```

> **Effort:** Medium — requires understanding the data shapes but no logic changes.

---

### Phase 5 — Fix `DishCard.tsx` `selectedIngredients` typing (2 occurrences)

**Problem:** `Dish.selectedIngredients` is declared as `SelectedIngredient[]` in `types/restaurant.ts`, but the `DishFormDialog` stores a full `Ingredient[]` object there (which has `display_name`, `canonical_name`, etc.), and `DishCard` then accesses `ing.name` which exists on neither type.

**Current state of `SelectedIngredient`:**

There are actually **two** `SelectedIngredient` interfaces:

1. `types/restaurant.ts` — `{ id: string; quantity?: string | null }` (minimal)
2. `components/IngredientAutocomplete.tsx` — `extends Ingredient { quantity?: string }` (full)

The `IngredientAutocomplete` component's local interface is the correct shape — it has all the `Ingredient` fields plus `quantity`. The `types/restaurant.ts` one is incomplete.

Importantly, `SelectedIngredient` from `types/restaurant.ts` is imported by:

- `lib/restaurantService.ts` line 21 + 429 (used in `submitRestaurantProfile`)
- `app/onboard/menu/page.tsx` line 23

**Fix — update `types/restaurant.ts` to match the real usage:**

```typescript
// Before
export interface SelectedIngredient {
  id: string; // ingredient alias ID
  quantity?: string | null;
}

// After — extend Ingredient so all downstream usage gets the full shape
import type { Ingredient } from '@/lib/ingredients';

/** UI-only: ingredient selected via IngredientAutocomplete, with optional quantity. */
export interface SelectedIngredient extends Ingredient {
  quantity?: string;
}

// In Dish — keep the type name (do NOT change to Ingredient[]):
selectedIngredients?: SelectedIngredient[];
```

This aligns `types/restaurant.ts` with `IngredientAutocomplete.tsx`'s local interface, avoids breaking `restaurantService.ts` and `onboard/menu/page.tsx` imports, and adds the `.display_name` field that `DishCard` needs.

**Then in `DishCard.tsx` — remove cast and fix property access:**

```typescript
// Before
{(dish as any).selectedIngredients?.length > 0 && (
  ...
  {(dish as any).selectedIngredients.map((ing: any, idx: number) => (
    <Badge key={idx} variant="secondary" className="text-xs">{ing.name}</Badge>
  ))}
)}

// After
{dish.selectedIngredients && dish.selectedIngredients.length > 0 && (
  ...
  {dish.selectedIngredients.map((ing, idx) => (
    <Badge key={ing.id ?? idx} variant="secondary" className="text-xs">{ing.display_name}</Badge>
  ))}
)}
```

Note: `ing.name` does not exist on `Ingredient`; the display field is `ing.display_name`.

> **Effort:** Low — type change + rename one property access. Risk: confirm no other code accesses `selectedIngredients` elements via `.name`.

---

### Phase 6 — Fix `NewRestaurantForm.tsx` casts (3 occurrences)

#### 6a — `(insertData as any).location = { lat, lng }` (line 288)

`insertData` is already typed as `Record<string, unknown>`, so bracket notation works without a cast:

```typescript
// Before
(insertData as any).location = { lat, lng };

// After — bracket notation on Record<string, unknown> needs no cast
insertData['location'] = { lat, lng };
```

**Note:** `formatLocationForSupabase(lat, lng)` defaults to `'json'` format which returns `{ lat, lng }` — the same object. Only use `formatLocationForSupabase(lat, lng, 'point')` if the column expects a PostGIS POINT string. The current code intentionally stores `{ lat, lng }` as JSON, so keep that behavior.

#### 6b — `.insert(insertData as any)` (line 293)

The root issue is that `insertData: Record<string, unknown>` is not assignable to `TablesInsert<'restaurants'>`. The correct fix is to type `insertData` properly:

```typescript
// Replace the dynamic object with the typed RestaurantInsert shape:
import type { RestaurantInsert } from '@/lib/supabase';

const insertData: RestaurantInsert = {
  name: formData.name.trim(),
  address: formData.address || null,
  // ... all other fields with their proper types
  owner_id: userData.user.id,
};

// Then the insert needs no cast:
const { data, error } = await supabase.from('restaurants').insert(insertData).select().single();
```

This is the most refactoring-heavy change in Phase 6 but it's the correct approach. The `RestaurantInsert` type is already exported from `lib/supabase.ts`.

> **Effort:** Medium — requires converting the dynamic `Record<string, unknown>` pattern to a properly typed object. Validate all required fields are covered by `RestaurantInsert`.

---

### Phase 7 — Fix `menus/page.tsx` `editingDish as any` (1 occurrence)

**Root cause:** The page imports `Dish` from `lib/supabase` (`Tables<'dishes'>`), but `DishFormDialog.dish` expects `Partial<types/restaurant.Dish> & { id?: string }`. These are different types.

**Option A (recommended) — map DB dish to form dish before passing:**

```typescript
import type { Dish as DbDish } from '@/lib/supabase';
import type { Dish as FormDish } from '@/types/restaurant';

function dbDishToFormDish(d: DbDish): Partial<FormDish> & { id?: string } {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? undefined,
    price: d.price,
    calories: d.calories ?? undefined,
    dietary_tags: (d.dietary_tags as string[]) ?? [],
    allergens: (d.allergens as string[]) ?? [],
    spice_level: d.spice_level as FormDish['spice_level'],
    photo_url: d.image_url ?? undefined,
    is_available: d.is_available ?? true,
    dish_category_id: d.dish_category_id,
    description_visibility: d.description_visibility as FormDish['description_visibility'],
    ingredients_visibility: d.ingredients_visibility as FormDish['ingredients_visibility'],
    dish_kind: d.dish_kind as FormDish['dish_kind'],
    display_price_prefix: d.display_price_prefix as FormDish['display_price_prefix'],
  };
}

// Usage:
<DishFormDialog
  dish={editingDish ? dbDishToFormDish(editingDish) : null}
  ...
/>
```

**Option B (quick)** — verify that the fields present on `Tables<'dishes'>` are a structural subset of `Partial<FormDish>` and use a targeted cast:

```typescript
dish={editingDish as Partial<FormDish> & { id?: string } | null}
```

Option B is acceptable as a short-term fix while Option A is the correct long-term solution, since the DB type and form type will diverge further as the schema evolves.

> **Effort:** Medium (Option A) / Trivial (Option B).

---

### Phase 8 — ESLint enforcement (prevent regressions)

Add `@typescript-eslint/no-explicit-any` to `eslint.config.mjs`:

```javascript
// apps/web-portal/eslint.config.mjs
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  // ...existing config...
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Also enable unsafe rules to catch implicit any:
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
    },
  },
];
```

Run `pnpm lint` to confirm zero violations after all phases are complete. CI should fail on any new `any` introduced in a PR.

> **Effort:** Trivial once all phases are complete.

---

## Execution Order & Dependencies

```
Phase 1  ─── independent ─────────────────────────────── (start here)
Phase 3  ─── independent ───────────────────────────────
Phase 2  ─── independent ───────────────────────────────
Phase 4a ─── independent ───────────────────────────────
Phase 4b ─── independent ───────────────────────────────
Phase 4c ─── depends on Phase 2 types ──────────────────
Phase 4d ─── independent ───────────────────────────────
Phase 5  ─── independent (but verify DishFormDialog after) ─
Phase 6a ─── independent ───────────────────────────────
Phase 6b ─── independent ───────────────────────────────
Phase 7  ─── independent ───────────────────────────────
Phase 8  ─── depends on ALL phases complete ────────────
```

Phases 1–7 can all be done in a single PR. Phase 8 (ESLint) should be the last commit.

---

## Risk Assessment

| Change                                   | Risk           | Notes                                                                 |
| ---------------------------------------- | -------------- | --------------------------------------------------------------------- |
| `catch (error: any)` → `unknown`         | **Low**        | Pure type change, no runtime impact                                   |
| `restaurantService.ts` raw types         | **Low**        | Adds types, no logic changes                                          |
| `layout.tsx` `User` type                 | **Low**        | Tightens null safety, behavior identical                              |
| `DishFormDialog` resolver cast           | **Low**        | Confirmed: `@hookform/resolvers` v5.2 + Zod v4 work without a cast    |
| `DishFormDialog` `(dish as any)` removal | **Low**        | Fields already exist on the type                                      |
| `DishCard` `selectedIngredients` fix     | **Medium**     | `ing.name` → `ing.display_name` — test wizard mode to confirm display |
| `NewRestaurantForm` typed insertData     | **Medium**     | Verify `RestaurantInsert` covers all inserted fields                  |
| `menus/page.tsx` dish mapping function   | **Low–Medium** | Verify field mapping covers all fields used in form                   |

---

## Verification Checklist

After completing all phases, run:

```bash
cd apps/web-portal
pnpm build          # Should produce 0 TypeScript errors
pnpm lint           # Should produce 0 ESLint errors for no-explicit-any
```

Manual test:

- [ ] Restaurant onboarding wizard: create a restaurant end-to-end
- [ ] Add a dish with ingredients in wizard mode → ingredients display in `DishCard`
- [ ] Admin panel: admin login, view stats
- [ ] Admin → restaurant menus page: add, edit, delete menu/category/dish
- [ ] Admin → ingredients page: CRUD operations

---

_Plan created: April 5, 2026_

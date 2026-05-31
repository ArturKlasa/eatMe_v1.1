# Mobile: Unify legacy "from"-price (parent/variant) dishes with the standard render path

- **Status:** Implemented (2026-05-31)
- **Scope:** `apps/mobile/` only — no DB changes
- **Created:** 2026-05-30
- **Related:** `docs/plans/dish-model-rewrite-phase-5-mobile.md`, `docs/plans/dish-model-rewrite-phase-6-data-migration.md`, `docs/plans/dish-model-rewrite-phase-7-cleanup.md`

---

## 1. Context — the problem

In the mobile restaurant menu, a dish can show a **"from $X"** price in two structurally different ways, and they behave inconsistently:

| | Standalone "from" dish (good) | Legacy parent/variant group (divergent) |
|---|---|---|
| **Render path** | `DishMenuItem` | Bespoke inline block in `FoodTab.tsx:168-205` |
| **Description** | Muted line under the name, respects `description_visibility` | Concatenated `Name — Description`, semibold **italic**, same size/colour as the name, ignores `description_visibility` |
| **Tap** | Opens `DishPhotoModal` (1 step) | Opens `VariantPickerSheet` bottom sheet → pick variant → *then* modal (2 steps) |
| **Options visibility** | Inline (`ModifierGroupsList`) + modal | Only inside the picker sheet |

Two rows that look identical to the user ("from $12.00") behave differently on tap and render their descriptions differently — which reads as a bug.

### Goal (from the user)
1. Description rendered the **same way as a standard dish** in both cases.
2. Tapping a dish has the **same main behaviour** in both cases (opens the detail modal).
3. Still possible to **see the options/sizes** for multi-option ("from") dishes — shown **inline on the menu AND in the detail modal**, with **absolute prices** per option.

### Facts that shaped the approach (from research)
- **No cart / ordering.** This is a discovery app. Both the inline `ModifierGroupsList` and the modal's option list are **read-only displays** — "see the options" is purely a display concern, not an interactive configurator.
- **Variants are thin `{name, price, serves}` rows.** Confirmed in the web-portal variant editor (`apps/web-portal/components/forms/dish/DishVariantsSection.tsx`) and the menu-scan pipeline — no per-variant photos, descriptions, or ratings exist in practice. Collapsing variants into an options list loses nothing of substance.
- **The org already chose this direction.** The documented "dish-model rewrite" Phase 6 migrates each parent/variant group into **one single-select option group** (`price_delta = price − MIN(price)`), and Phase 7 deletes `DishGrouping.ts` + `VariantPickerSheet.tsx` and drops the columns. Phases 1–3 shipped; 5–7 proposed/unbuilt. **This change is a DB-free, forward-compatible preview of Phase 6** that Phase 7 later removes wholesale — no conflict.
- `ModifierGroupsList.formatPrice` (`apps/mobile/src/screens/restaurant-detail/ModifierGroupsList.tsx:139`) **already renders `price_override` as an absolute price**. The detail modal does **not** (it only renders `price_delta`) — that's the single small gap to patch.

---

## 2. Solution — a presentation-layer adapter (no DB changes)

Fold each `{parent, variants}` group into a **single synthesized standalone `DishWithGroups`** that carries a synthetic single-select **"Options"** group (one option per variant, `price_override = variant.price`). Then render *everything* through the existing standalone path (`DishMenuItem` + `ModifierGroupsList` + `DishPhotoModal`), and delete the bespoke parent branch + picker sheet.

This one move satisfies all three goals because the standard path already does exactly what's wanted:
- Description → standard muted line via `DishMenuItem`, respecting `description_visibility`.
- Tap → `handleDishPress` → `DishPhotoModal` directly.
- Options → rendered inline by `ModifierGroupsList` *and* in the modal, with absolute prices.

### Why not the alternatives
- **Do the real Phase 6 DB migration now** — destructive, depends on Phase 4 admin work, much larger/riskier than a mobile fix. The adapter is the bridge until that lands.
- **Keep `VariantPickerSheet`, just change the entry point** — preserves per-variant drill-in, but variants carry no per-variant content, so drill-in is complexity for zero payoff and keeps the divergent code.

---

## 3. Implementation

### 3.1 `apps/mobile/src/screens/restaurant-detail/DishGrouping.ts` — core change

Add a pure transform and change `groupDishesByParent` to return a **flat, render-ready** `DishWithGroups[]` (standalones pass through; parents become one synthesized standalone each). Keep the transform pure so it's unit-testable later.

```ts
import { type Dish, type OptionGroup, type Option } from '../../lib/supabase';

export type DishWithGroups = Dish & {
  option_groups?: OptionGroup[];
  photo_url?: string | null;
  ingredients?: string[];
  parent_dish_id?: string | null;
  is_parent?: boolean;
};

// Build a synthetic single-select "Options" group from a parent's variant children.
// Absolute prices via price_override (ModifierGroupsList + the patched modal both honor it).
// Mirrors the Phase 6 migration shape (one single-select group per parent).
function variantsToOptionGroup(
  parent: DishWithGroups,
  variants: DishWithGroups[],
  optionsLabel: string
): OptionGroup {
  const groupId = `variants:${parent.id}`;
  return {
    id: groupId,
    restaurant_id: parent.restaurant_id ?? '',
    dish_id: parent.id,
    name: optionsLabel,
    selection_type: 'single',
    min_selections: 1,
    max_selections: 1,
    display_order: -1, // sort before any real parent option groups
    is_active: true,
    options: variants.map((v, i): Option => ({
      id: v.id,
      option_group_id: groupId,
      name: v.name,
      price_delta: 0,
      price_override: v.price ?? null, // absolute price per size
      is_available: true,
      display_order: i,
    })),
  };
}

// Returns dishes ready to render as standalone rows, preserving restaurant-defined order.
// Parent/variant groups are folded into a synthesized dish carrying a "from $min" price
// and a synthetic Options group. (Legacy shim — deleted in dish-model-rewrite Phase 7.)
export function groupDishesByParent(
  dishes: DishWithGroups[],
  optionsLabel: string
): DishWithGroups[] {
  const variantsByParent = new Map<string, DishWithGroups[]>();
  for (const dish of dishes) {
    if (dish.is_parent) {
      if (!variantsByParent.has(dish.id)) variantsByParent.set(dish.id, []);
    } else if (dish.parent_dish_id) {
      const list = variantsByParent.get(dish.parent_dish_id) ?? [];
      list.push(dish);
      variantsByParent.set(dish.parent_dish_id, list);
    }
  }

  const result: DishWithGroups[] = [];
  for (const dish of dishes) {
    if (dish.is_parent) {
      const variants = variantsByParent.get(dish.id) ?? [];
      if (variants.length === 0) continue; // skip display-only parent with no variants
      const minPrice = variants.reduce(
        (acc, v) => (v.price != null && v.price < acc ? v.price : acc),
        Infinity
      );
      const hasPrice = Number.isFinite(minPrice);
      result.push({
        ...dish,
        price: hasPrice ? minPrice : dish.price,
        display_price_prefix: hasPrice ? 'from' : dish.display_price_prefix,
        option_groups: [
          variantsToOptionGroup(dish, variants, optionsLabel),
          ...(dish.option_groups ?? []),
        ],
      });
    } else if (!dish.parent_dish_id) {
      result.push(dish); // genuine standalone, unchanged
    }
    // variant children are folded into their parent — skip at top level
  }
  return result;
}
```

- Remove the now-unused `DishGroupItem` union (only `FoodTab` consumed it).

### 3.2 `apps/mobile/src/screens/restaurant-detail/FoodTab.tsx`

- Pass the localized label: `groupDishesByParent(sortedDishes(dishes, permanentFilters), t('restaurant.optionsGroupLabel'))`.
- Replace the `grouped.map(item => { if (item.type === 'standalone') ... else <parent branch> })` with a **single standalone render** per dish:

```tsx
{Array.isArray(categoryState) &&
  grouped.map(dish => (
    <View key={dish.id}>
      <DishMenuItem
        item={dish}
        permanentFilters={permanentFilters}
        dishRatings={dishRatings}
        onPress={onDishPress}
      />
      {(dish.option_groups?.length ?? 0) > 0 && (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ModifierGroupsList
            groups={dish.option_groups ?? []}
            permanent={permanentFilters}
            daily={dailyFilters}
            basePrice={dish.price ?? 0}
          />
        </View>
      )}
    </View>
  ))}
```

- Delete: `pickerGroup` state (`useState`), the `<VariantPickerSheet ... />` element, and the `import { VariantPickerSheet }`. The min-price reduce in the old parent branch is gone (now lives in the adapter).

### 3.3 `apps/mobile/src/components/DishPhotoModal.tsx`

The option list currently shows only `price_delta` (`DishPhotoModal.tsx:344-347` chip path and `:370-373` list path). Make it prefer absolute `price_override`, mirroring `ModifierGroupsList.formatPrice`:

```tsx
{opt.price_override != null
  ? `$${opt.price_override.toFixed(2)}`
  : opt.price_delta !== 0
    ? `${opt.price_delta > 0 ? '+' : ''}$${opt.price_delta.toFixed(2)}`
    : null}
```

Apply in **both** the chip branch and the list branch. Small, generally-correct fix (the modal should honor overrides); forward-compatible with Phase 6 data, which uses deltas.

### 3.4 Locale files — `apps/mobile/src/locales/{en,es,pl}.json`

Add under the existing `restaurant` object (sibling of `price`). Neutral wording — variants may be sizes *or* flavours:

| File | Key | Value |
|---|---|---|
| `en.json` | `restaurant.optionsGroupLabel` | `"Options"` |
| `es.json` | `restaurant.optionsGroupLabel` | `"Opciones"` |
| `pl.json` | `restaurant.optionsGroupLabel` | `"Opcje"` |

### 3.5 Delete `apps/mobile/src/screens/restaurant-detail/VariantPickerSheet.tsx`

Only referenced by `FoodTab`. Phase 7 deletes it anyway; removing now avoids dead code.

---

## 4. Behaviour changes to expect (acceptable / future-aligned)

- **Ratings, "viewed"/"liked" interactions, and photos now attach to the parent dish** (`selectedDish.id = parent.id`) instead of per-variant. Variants have no per-variant ratings/photos today, and Phase 6 collapses them — so parent-level is the correct going-forward behaviour.
- **Menu rows for multi-size dishes get taller** (options listed inline). This is the chosen "inline + modal" behaviour and is identical to how standard option-dishes already render.
- The synthetic group's meta reads **"pick 1 — required"** (single-select, min 1) — accurate for sizes and matches Phase 6's single-select group. If undesired later, it's a one-line tweak to `min_selections`.
- **Parent base price (`0`) no longer leaks** as "from $0.00": the adapter overrides `price` with `minPrice`, so both the row and the modal show "from $min".

---

## 5. Out of scope

- The real **Phase 6** destructive DB migration (variant rows → real option groups) and **Phase 7** column drops — separate documented backend efforts.
- The **legacy web-portal** still minting new parent/variant rows — unchanged; the adapter handles both existing and any newly-created parent/variant data.

---

## 6. Verification

- `turbo check-types` and `turbo lint` pass.
- No unit tests added: `apps/mobile` has **no test runner** (package scripts are `start`/`android`/`ios`/`web`/`lint`). The transform is kept pure/isolated so it's testable if a runner is added later.
- **Manual (Expo)** — open a restaurant detail with: (a) a legacy parent/variant dish, (b) a standard dish with option groups, (c) a plain dish. Confirm:
  - (a) and (b) show the description as the **standard muted line** under the name, and it's hidden when `description_visibility='detail'`.
  - (a) shows **"from $min"**, lists each size **inline with absolute prices**, and a **single tap opens the detail modal** (the old bottom sheet never appears); the modal lists the same options with absolute prices.
  - (a)'s "from" label is localized (PL/ES) via the `restaurant.price.from` key added earlier.
  - (c) is unchanged.

---

## 7. Implementation checklist

1. [x] `DishGrouping.ts`: add `variantsToOptionGroup`, rewrite `groupDishesByParent` to return `DishWithGroups[]`, remove `DishGroupItem`.
2. [x] `FoodTab.tsx`: pass `optionsLabel`, collapse to single standalone branch, remove `pickerGroup` + `VariantPickerSheet` usage/import.
3. [x] `DishPhotoModal.tsx`: render absolute `price_override` in both option branches.
4. [x] `locales/{en,es,pl}.json`: add `restaurant.optionsGroupLabel`.
5. [x] Delete `VariantPickerSheet.tsx`.
6. [x] `turbo check-types` + `turbo lint` pass. Manual Expo smoke test per §6 — **pending on-device**.

---

## 8. Follow-up — shipped UX polish (2026-05-31)

After the core unification landed, several presentation refinements were made to the same screen and shipped in the same change set. All mobile-only, DB-free, forward-compatible with the Phase 6/7 rewrite.

### 8.1 Options rendered as a list (not chips) in the modal
`DishPhotoModal` shows the synthetic "Options" group as a vertical **list** (name left, absolute price right) instead of wrap chips — easier to scan sizes/variants. Read-only; absolute `price_override` per row.

### 8.2 `DishPhotoModal` → three-quarter bottom sheet
Converted the full-screen dish modal into a **~75%-height bottom sheet**: dimmed backdrop with the menu visible above, rounded top, drag-handle affordance, tap-outside-to-close. The photo shrank from a full-width square to a compact `SCREEN_WIDTH × 0.6` strip; the header is fixed while photo + thumbnails + info scroll together. Safe-area bottom padding via `useSafeAreaInsets`.

### 8.3 Menu-name heading hidden for single-menu restaurants
The `menus.name` heading — often the hardcoded default **"Main Menu"** (admin scan RPC `migrations/144...:147`, web-portal onboarding fallback) or a foreign-language AI-scanned name like **"Comidas y Cenas"** (the name is stored once and **un-localized**; `menus` has no `name_translations`) — was a big `2xl` title pushing the food down. For the common **single-menu** case it's now suppressed, so categories sit directly under the tab bar.

### 8.4 Multiple menus collapsed by default
With **2+ menus** (e.g. a food menu + a separate drinks menu) each renders as a tappable **collapsible header** (name + `▴`/`▾` chevron), **collapsed by default** — the tab opens as a compact picker the user expands one at a time. Dishes auto-load on mount (`useRestaurantDetail.ts:217`) so expand is instant; toggles are independent (not accordion).

### 8.5 Category header spacing rebalanced
The category name's bottom margin moved onto a header wrapper so the **name→description** gap is tight (~4px, the description hugs its category) while **description→first-dish** is clear (~12px) — and identical whether or not a description is present. New styles `categoryHeader` + `categoryDescription` in `restaurantDetail.ts`.

### Files touched by the follow-up
`DishPhotoModal.tsx` (§8.1–8.2), `FoodTab.tsx` (§8.3–8.5), `styles/restaurantDetail.ts` (§8.2 sheet styles, §8.4 `menuHeader`/`menuHeaderName`/`menuChevron`, §8.5 `categoryHeader`/`categoryDescription`).

### Still pending
On-device visual pass (no emulator in the dev loop): sheet height/feel, collapsed-menu tap targets, and the category spacing values — all easy one-number tweaks if anything reads slightly off.

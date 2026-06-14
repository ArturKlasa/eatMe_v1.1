# Plan — Virtualize the restaurant-detail menu list (§M2)

**Date:** 2026-06-13
**Source:** `docs/findings/mobile-performance-audit.md` Part C (M2)
**Scope:** One file — `apps/mobile/src/screens/restaurant-detail/FoodTab.tsx`. **No new dependency, no DB/edge change.**
**Status:** Plan — awaiting go-ahead. Not implemented.
**Builds on:** `menu-cold-open-batch-m1-m3-m4.md` (the rows it lists are already `React.memo`'d).

---

## Why

`FoodTab` renders a `ScrollView` + nested `.map` (`menus → categories → dishes`). **Every**
dish row + its `ModifierGroupsList` mounts at once — a 100-dish menu mounts 100
`DishMenuItem` + 100 `ModifierGroupsList` up front. M1 already fixed what's *fetched*; M2
fixes what's *mounted*: only on-screen rows should render. (The felt win scales with menu
size — large menus benefit most; a <20-dish menu sees little.)

## Approach decision

| Option | Verdict |
|--------|---------|
| **FlashList** (`@shopify/flash-list`) | ❌ Not installed; adds a **native dependency** → forces `expo prebuild --clean` + a device rebuild (CLAUDE.md pitfall #4). Overkill for menu-sized lists. |
| **SectionList** (RN core) | ❌ The UI has **two** header levels (menu + category) and **collapsible** menus; that maps awkwardly onto SectionList's flat section model. |
| **`FlatList` over a memoized typed-row array** ✅ | RN core (no new dep, no rebuild), fully virtualized (built on `VirtualizedList`), and faithfully preserves the nested + collapsible layout because *we* compute the flat row list. **Chosen.** |

Use `FlatList` from **`react-native-gesture-handler`** (not RN core) — the current
`ScrollView` is imported from there; the gesture-handler list is a drop-in that preserves
whatever nested-scroll/gesture integration that import was for.

## The typed-row model

Compute one flat `rows` array via `useMemo`, render with `FlatList`, switch on `kind`:

```ts
type Row =
  | { key; kind: 'featured';     dish: ClassifiedDish }
  | { key; kind: 'menuHeader';   menu; expanded: boolean }
  | { key; kind: 'menuDescription'; text: string }
  | { key; kind: 'categoryHeader';  category }
  | { key; kind: 'categoryLoading' | 'categoryError' | 'categoryLoad'; categoryId }
  | { key; kind: 'dish';         dish: ClassifiedDish };
```

`rows` useMemo (deps `[restaurant, categoryDishes, sortedByCategory, expandedMenus, featuredDish]`):
walk `restaurant.menus` exactly as the current JSX does —

1. featured dish (if resolved) → one `featured` row (it still *also* appears in its category, as today),
2. per menu: `menuHeader` (skip when `singleMenu`), optional `menuDescription` (expanded + multi-menu + has description),
3. when expanded, per category: `categoryHeader`, then the category's state → `categoryLoading` / `categoryError` / `categoryLoad` (dead path now, kept for parity) / a `dish` row per `sortedByCategory.get(cat.id)`.

Collapsed menus contribute only their `menuHeader` row. `singleMenu` menus are always expanded with no header — unchanged.

## Style redistribution (the one real risk, now mapped)

Verified in `styles/restaurantDetail.ts`:

- `menuSection` is **empty** (comment: rhythm comes from headers + per-dish wrappers) → flattening loses nothing.
- `menuHeader`, `menuDescription`, `categoryHeader`, `featuredSection`, `featuredLabel` are **self-contained** per element → render as-is, one per row.
- **Only** `menuCategory` (`paddingHorizontal: lg` + `paddingTop: lg`) wrapped a whole category block. Replicate it per row:
  - **category-scoped rows** (header, loading/error/load, dish) get wrapped in `paddingHorizontal: lg`,
  - the **categoryHeader** row additionally gets `paddingTop: lg`.
  - The dish-row divider must stay inset: keep the `lg` pad on an **outer** wrapper and leave `localStyles.dishRow` (border) inside it, so the `borderBottom` stays inset exactly as today (not full-bleed). `modifierWrap`'s `md` stays additive inside → modifiers keep their `lg + md` inset.

New `localStyles`: `categoryRowPad { paddingHorizontal: lg }`, `categoryHeaderPad { paddingHorizontal: lg, paddingTop: lg }`.

## FlatList wiring

- `data={rows}`, `keyExtractor={r => r.key}`.
- `renderItem` = a `useCallback` switching on `kind`; dish rows render the existing
  `DishMenuItem` + `ModifierGroupsList` (unchanged, already memoized), resolving
  `rating`/`userOpinion`/`isFavorite` per dish exactly as now.
- `extraData` = `useMemo(() => ({ dishRatings, userDishOpinions, favoriteDishIds }), [...])`
  so rows re-evaluate when ratings/opinions/favourites arrive (they don't change `rows`);
  the memoized rows mean only actually-changed rows re-render.
- `ListEmptyComponent` = the existing "no menu items" block.
- `contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}`,
  `showsVerticalScrollIndicator={false}`.
- Perf props: `initialNumToRender={8}`, `windowSize={11}` (default), `removeClippedSubviews`
  (Android), `maxToRenderPerBatch={8}`. **No `getItemLayout`** — dish rows have variable
  height (modifiers expand/collapse), so fixed layout would be wrong.

## Stays exactly the same

- `DishMenuItem`, `ModifierGroupsList`, both rating badges — untouched.
- `sortedByCategory` / `featuredDish` memos, `expandedMenus` + `toggleMenu`, `singleMenu`,
  `resolveCategoryName` / `resolveCategoryDescription`, `loadCategoryDishes` header tap.

## Risks

- **Visual regression from flattening** — mitigated: every grouping style is mapped above; the only redistribution is `menuCategory`'s padding. Needs an on-device eyeball.
- **Nested scroll on Android** — using gesture-handler's `FlatList` (matching the current
  `ScrollView` import) to preserve behavior; verify scroll + the parent tab still feel right.
- **Variable row heights** — handled by omitting `getItemLayout`; FlatList measures lazily.

## Verification

- `tsc` + `eslint` clean for `FoodTab.tsx`.
- **User, on device:** open a restaurant (single-menu **and** multi-menu) → layout matches
  today (category insets, dividers, featured block, collapse/expand chevrons); scroll a long
  menu and confirm it's smoother / lower memory; the featured-dish block still pins on top;
  "no menu items" still shows for empty restaurants.

## Commit

One docs commit + one code commit to `main`, **only on your "commit"**. Frontend-only — no deploy.

# Menu-Scan Review Page — Current Architecture

File:line references throughout. Based on `apps/web-portal/app/admin/menu-scan/` + `apps/web-portal/components/admin/menu-scan/`.

## Page flow

Four steps managed by `useMenuScan()` (`hooks/useMenuScan.ts:20-302`):

1. **upload** (`page.tsx:11-52`) — restaurant select, image upload + drag-drop, PDF→image, trigger scan
2. **processing** — image resize → OpenAI Vision → ingredient resolution
3. **review** (`page.tsx:55-124`) — main UI; dense nested tree of menus → categories → dishes
4. **done** — implicit after successful save

## Component tree

`apps/web-portal/app/admin/menu-scan/components/`:
- `MenuScanUpload.tsx` — file drop, restaurant search, process button
- `MenuScanProcessing.tsx` — staged progress UI
- `MenuScanReview.tsx` — **root review container**, receives ~96 props (prop-drilled from page)
- `ReviewHeader.tsx` — title, count, warnings, save button
- `ReviewLeftPanel.tsx` — tab switcher: Images | Details
- `ImageCarousel.tsx` + `ImageZoomLightbox.tsx` — image viewer
- `MenuExtractionList.tsx` — **the dense tree**; per-dish renders `DishEditPanel` or `DishGroupCard`
- `DishEditPanel.tsx` — dish edit form: name/desc/price/kind/serves/ingredients
- `RestaurantDetailsFormPanel.tsx` — address + map picker
- `ScanJobQueue.tsx` — completed jobs list

`apps/web-portal/components/admin/menu-scan/`:
- `DishGroupCard.tsx` — parent/child variant UI (WIP: now editable fields, kind selector w/ price_prefix auto-patch)
- `BatchToolbar.tsx` — filters (confidence, kind, grouping); batch accept/reject
- `FlaggedDuplicateCard.tsx` — "similar dish in DB" alerts

## Hooks / state composition

`useMenuScan()` orchestrates, exposes ~100 fields. Composed from:

- **`useUploadState`** — restaurant selection, image files, previews, drag state
- **`useProcessingState`** — image resize, PDF convert, API POST + polling
- **`useReviewState` (`hooks/useReviewState.ts:33-354`)** — largest:
  - `editableMenus: EditableMenu[]` — mutable tree
  - `expandedDishes: Set<string>`
  - `dishCategories: DishCategory[]`
  - `restaurantDetails: RestaurantDetailsForm`
  - Nested modal state: `addIngredientTarget`, `suggestingDishId`, `inlineSearchTarget`, `subIngredientEditTarget`
  - Updaters: `updateDish`, `addDish`, `addVariantDish` (NEW in WIP)
- **`useIngredientState`** — ingredient matching; AI suggest is stubbed (lines 217-230) but buttons still appear in UI
- **`useGroupState` (`hooks/useGroupState.ts:17-200`)** — `flaggedDuplicates`, `selectedGroupIds`, `batchFilters`, `focusedGroupId`; group actions
- **`useJobQueue`** — in-memory client-side background job tracking; polls until `needs_review`

All state lives in React. **No URL state**, no query params or hash for recovery. Server writes only at save via `POST /api/menu-scan/confirm`.

## Data shapes (TypeScript)

`lib/menu-scan.ts:117-139`:

```ts
interface EditableDish {
  _id: string;                    // UUID, React key
  name: string;
  price: string;
  description: string;
  dietary_tags: string[];
  spice_level: 'none' | 'mild' | 'hot' | null;
  calories: number | null;
  dish_category_id: string | null;
  confidence: number;
  ingredients: EditableIngredient[];
  suggested_allergens?: string[];

  dish_kind: 'standard' | 'template' | 'combo' | 'experience';
  is_parent: boolean;
  serves: number | null;
  display_price_prefix: 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';
  primary_protein: string | null;

  variant_ids: string[];
  parent_id: string | null;
  group_status: 'ai_proposed' | 'accepted' | 'rejected' | 'manual';
}

interface EditableIngredient {
  raw_text: string;
  raw_modifier?: string | null;
  status: 'matched' | 'unmatched';
  concept_id?: string;
  variant_id?: string | null;
  canonical_name?: string;
  display_name?: string;
  sub_ingredients?: EditableIngredient[];
}

interface EditableMenu {
  name: string;
  menu_type: 'food' | 'drink';
  categories: EditableCategory[];
}
```

## Kind in the UI

**Primary selector** — `DishEditPanel.tsx:91-121` and `DishGroupCard.tsx:108-119`. Kind dropdown auto-patches `is_parent` and `display_price_prefix`:

```ts
// DishEditPanel.tsx:98-113
if (newKind === 'template')   { patch.is_parent = true;  patch.display_price_prefix = 'from'; }
if (newKind === 'experience') { patch.is_parent = true;  patch.display_price_prefix = 'per_person'; }
if (newKind === 'combo')      { patch.is_parent = true;  patch.display_price_prefix = 'exact'; }
if (newKind === 'standard')   { patch.is_parent = false; patch.display_price_prefix = 'exact'; }
```

**Kind-specific UI deltas:**
- `standard` — single dish form, no variants area, price visible
- `template` — parent with variants; price prefix "from"
- `combo` — parent with variants; base price input **hidden** (`DishEditPanel.tsx:91: {!isCombo && …}`) — pain point: users who entered a price lose visibility
- `experience` — parent with variants; price prefix "per_person"

**No explicit UI validation;** server-side in confirm/route.ts enforces variant_ids/parent_id backlinks.

## API surface

**`POST /api/menu-scan/route.ts`**
Input: FormData with images + restaurant_id.
Flow: resize → Supabase Storage → OpenAI Vision (Structured Outputs) → ingredient resolver → dietary/allergen hint mapping → flagged duplicate detection.
Output: `{ job_id, result, flaggedDuplicates, extractionNotes, dishCount }`.

**`POST /api/menu-scan/confirm/route.ts`**
Input: `{ job_id, restaurant_id, menus: EditableMenu[] }`.
Flow: admin check → three-pass insert (menus → categories → dishes, including parents before children) → dish_ingredients with concept mapping → trigger allergen/dietary compute → mark job complete.
Output: `{ dishes_saved, warnings }`.

**`POST /api/menu-scan/suggest-ingredients/route.ts`** — **disabled** (hook returns no-op at `useIngredientState.ts:217-230`).

## UX pain points worth addressing

1. **Prop-drilling overload** (`page.tsx:24-120`). ~96 props flow through `MenuScanReview` → `MenuExtractionList`. No context. Refactor target.
2. **Kind / combo price hiding** — changing to "combo" silently hides the price input. No visual hint; entered prices look lost (`DishEditPanel.tsx:91`).
3. **Modal fatigue** — overlapping modals for AddIngredient, InlineIngredientSearch, SubIngredientEdit. No stacking/focus lock; user can lose context.
4. **Orphan UX: AI suggest-ingredients** — stubbed server-side, but buttons still render in UI (`MenuExtractionList`, `DishEditPanel`). Dead clicks.
5. **Density on desktop** — long menus scroll forever. No virtualization, no pagination, no section collapse memory.
6. **Accessibility gaps** — icon-only buttons without aria-labels; uncontrolled tab index in nested editable forms; small touch targets.
7. **Flagged duplicates opaque** — no "why flagged" explanation (similarity score, name/desc match, etc.).
8. **Mobile-unfriendly** — `w-80` fixed left panel; right panel shrinks to <300px on narrow viewports.
9. **Batch filter confusion** — filter scope vs. "accept selected" behavior unclear when filters change.
10. **No undo / no "compare against source image"** — hard to sanity-check AI output without re-scrolling.

## Test coverage

`test/menu-scan-components.test.tsx`:

**Tested:** basic render of Upload, Processing, Review components; some UI element presence checks.

**Not tested:**
- Kind selection logic / auto price_prefix patching
- Parent-child variant ops (`addVariantDish`, ungroup, accept/reject group)
- Ingredient resolution, sub-ingredient editing
- Batch toolbar filter interactions
- Flagged duplicate workflow
- Menu/category/dish CRUD
- Save flow (`/api/menu-scan/confirm`)
- Warning/error display
- Any hook logic directly (`useReviewState`, `useGroupState`, `useIngredientState`, `useMenuScan`)

High refactor risk — hooks are untested.

## Current WIP (uncommitted git diffs)

Active modifications extending variant editing in place:
- `DishGroupCard.tsx` — name/desc/price now editable; kind selector with auto price_prefix; "Add variant" plus icon; `onAddVariant` prop.
- `useReviewState.ts` — new `addVariantDish()` returning child with `parent_id`, `is_parent=false`, `group_status='manual'`.
- `useMenuScan.ts` / `page.tsx` / `MenuExtractionList.tsx` — plumbing for the above.
- `DishEditPanel.tsx` — explicit kind patching block (replaces earlier inline logic).
- `lib/menu-scan.ts` — added `dish_category` / `dish_category_id` to types; expanded `DIETARY_HINT_MAP` with 16 non-alcoholic variants (matches migration 113).
- `route.ts` — (likely maps `dish_category` → `dish_category_id`).

**WIP intent:** let admins add variants to parents directly in the review UI; tighten kind ↔ price_prefix coupling.

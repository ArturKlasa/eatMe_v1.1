# Implementation Plan — v2 admin multi-kind support

Port v1's parent/variant/course machinery from `apps/web-portal/` into `apps/admin/` so the v2 menu-scan review can correctly handle Bundle, Configurable, Course Menu, and Buffet kinds (today only Standard works end-to-end).

## Background

The v2 admin menu-scan review (`apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`) has a Kind dropdown that updates `dish_kind` in local state but provides no Kind-conditional UI. There is no `is_parent`, no variants, no courses, no `display_price_prefix`, no Parent badge. The save action only persists `dish_kind` plus a few core fields — `is_parent`, `parent_dish_id`, `display_price_prefix`, `serves`, `dish_courses`, and `dish_course_items` are never written. So switching to Bundle/Configurable/Course Menu produces semantically broken DB rows; switching to Buffet only changes a hidden `display_price_prefix`.

The DB schema is fully ready (migration 114 added `dish_courses` + `dish_course_items` and the dishes table already has the parent/variant columns). The v2 admin server action uses direct `INSERT INTO dishes` (not the `confirm_menu_scan` RPC from migration 121), so we have full flexibility to extend the action.

## Decisions locked in

| Decision | Choice |
|---|---|
| State management | `useState` + extracted `useReviewState` hook with reducer-style actions (no Zustand) |
| Kind selector primitive | Native `<select>` — no Radix/shadcn (admin app has no shadcn primitives locally) |
| Course reordering | Up/down buttons — no dnd-kit |
| Component tests | Reducer logic only via Vitest; UI flows via Playwright E2E |
| AI extraction | Defer to Phase 7; Phases 2-6 ship with admin building variants/courses by hand |
| Wire format | Variants nest under parent as `variant_dishes[]`; courses on `course_menu` parents as `courses[]` |
| Save path | Direct INSERT (current pattern), no RPC migration |

## Atomic commit map

| # | Commit | Phase |
|---|---|---|
| 1 | `feat(admin/menu-scan): extend EditableDish + extract useReviewState reducer` | 2 |
| 2 | `feat(admin/menu-scan): wire setKind reducer + Parent badge + price-prefix dropdown` | 3 |
| 3 | `feat(admin/menu-scan): extend confirm-payload schema + multi-pass dish insert` | 4a (server) |
| 4 | `feat(admin/menu-scan): VariantEditor for bundle/configurable/standard parents` | 4b (client) |
| 5 | `feat(admin/menu-scan): CourseEditor for course_menu parents (no dnd)` | 5 |
| 6 | `feat(admin): unfilter parents in restaurant verifier + load courses` | 6a (dal) |
| 7 | `feat(admin): render variants + courses in DishRowEditor` | 6b (UI) |
| 8 | `feat(menu-scan-worker): extract variants + courses recursively` | 7 |

---

## Phase 2 — extend `EditableDish` + extract reducer

### Goal
Lay the type foundation so every later phase plugs into a single source of truth. **All Phase 7 fields exist now**, defaulted empty/null.

### Files
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (modify)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` (new)
- `apps/admin/src/__tests__/menu-scan/useReviewState.test.ts` (new)

### Type changes

Extend `ExtractedDish` (the wire shape from worker) with optional fields so today's flat output and Phase 7's recursive output both parse:

```ts
export type ExtractedCourseItem = {
  option_label: string;
  price_delta: number;
};

export type ExtractedCourse = {
  course_number: number;
  course_name: string | null;
  choice_type: 'fixed' | 'one_of';
  required_count: number;
  items: ExtractedCourseItem[];
};

export type ExtractedDish = {
  // ...existing fields...
  is_parent?: boolean;
  display_price_prefix?: 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';
  serves?: number | null;
  variants?: ExtractedDish[] | null;
  courses?: ExtractedCourse[] | null;
};
```

Extend `EditableDish` (always populated, defaults applied during hydration):

```ts
type PricePrefix = 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';

type EditableCourseItem = {
  _id: string;
  option_label: string;
  price_delta: number;
};

type EditableCourse = {
  _id: string;
  course_number: number;
  course_name: string;
  choice_type: 'fixed' | 'one_of';
  required_count: number;
  items: EditableCourseItem[];
};

type EditableDish = ExtractedDish & {
  _id: string;
  _deleted: boolean;
  // Existing category fields...
  // New:
  is_parent: boolean;
  display_price_prefix: PricePrefix;
  serves: number | null;
  parent_id: string | null;
  courses: EditableCourse[];
};
```

### Hydration (`asEditable`)

Default all new fields. For Phase 7 forward-compat, when AI returns `variants[]`, hydration recursively flattens them into the `dishes` array with `parent_id` set. Phase 2 can leave that recursion stub as a no-op since AI-extracted variants don't exist yet — but the reducer actions to add them must work.

### `useReviewState` hook

Extract from `ReviewDishEditor`'s current `useState<EditableDish[]>` plus the existing `update` / `toggleDelete` helpers. Pure reducer functions live alongside the hook so they can be unit-tested without `@testing-library/react`.

Actions:
- `update(id, patch)` — existing
- `toggleDelete(id)` — existing
- `setKind(id, newKind)` — port from `apps/web-portal/.../reviewSlice.ts:641-677`
- `addVariant(parentId)` / `removeVariant(variantId)` / variant updates via existing `update`
- `addCourse(parentId)` / `removeCourse(parentId, idx)` / `moveCourse(parentId, from, to)` / `updateCourse(parentId, idx, patch)`
- `addCourseItem(parentId, courseIdx)` / `removeCourseItem(parentId, courseIdx, itemIdx)` / `moveCourseItem(parentId, courseIdx, from, to)` / `updateCourseItem(parentId, courseIdx, itemIdx, patch)`

setKind's behaviour:
- standard → is_parent=false, display_price_prefix='exact'
- bundle → is_parent=true, display_price_prefix='exact'
- configurable → is_parent=true, display_price_prefix='from'
- course_menu → is_parent=true, display_price_prefix='per_person', auto-seeds Course 1 if `courses` is empty
- buffet → is_parent=false, display_price_prefix='per_person'
- Leaving course_menu clears `courses`

### Tests (`useReviewState.test.ts`)

Mirror v1 reviewSlice tests. Unit-test the pure reducer functions (e.g. `applySetKind(dishes, id, kind): EditableDish[]`); the hook just wraps them.

Test cases:
- setKind → standard / bundle / configurable / buffet (each correct fields)
- setKind → course_menu auto-seeds Course 1
- setKind → course_menu does not duplicate if already present
- setKind → leaving course_menu clears courses
- setKind → does not reset price
- addVariant creates dish with parent_id set, is_parent: false
- removeVariant removes the dish
- addCourse appends + numbers correctly
- removeCourse removes + renumbers remaining
- moveCourse swaps + renumbers

### Verification
```
cd apps/admin && pnpm test useReviewState
cd apps/admin && pnpm check-types
```

### Commit
```
feat(admin/menu-scan): extend EditableDish + extract useReviewState reducer

Adds is_parent / display_price_prefix / serves / parent_id / courses to the
editable dish model and extracts state mutations into a testable reducer.
Forward-compat scaffolding for variants + courses; UI wiring lands in Phases
3-5.
```

---

## Phase 3 — Kind selector wiring + Parent badge + price-prefix dropdown

### Goal
The Kind dropdown actually does something visible. Parent badge appears for `is_parent` dishes. Admin can override the price prefix.

### Files
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (modify)

### Changes

Replace the existing Kind `<select>` onChange (line 665-676) to call `setKind(d._id, newKind)`.

Add Parent badge next to dish name (next to confidence + page badges):
```tsx
{d.is_parent && (
  <span className="...rounded-full border border-blue-200 bg-blue-50...">
    Parent ({dishes.filter(c => c.parent_id === d._id && !c._deleted).length} variants)
  </span>
)}
```

Add price-prefix dropdown (5 options) to the Kind/protein grid.

Conditional price label for course_menu parents: "Total price (optional)" when `dish_kind === 'course_menu' && is_parent`, else "Price".

### Tests
- Manual: load a job, change Kind to each of the 5 values, confirm Parent badge appears for bundle/configurable/course_menu, disappears for standard/buffet.
- Reducer tests already cover state transitions.

### Commit
```
feat(admin/menu-scan): wire setKind reducer + Parent badge + price-prefix dropdown
```

---

## Phase 4a — server save: extended Zod schema + multi-pass insert

### Goal
The save action accepts the new shape and persists parents → variants → courses correctly. Ship before client UI so client can save without crashing the server.

### Files
- `apps/admin/src/app/(admin)/menu-scan/actions/menuScan.ts` (modify)
- `apps/admin/src/__tests__/menu-scan/confirm-multi-kind.test.ts` (new)

### Schema changes

Add `reviewedCourseItemSchema` + `reviewedCourseSchema`. Extend `reviewedDishSchema` with `is_parent`, `display_price_prefix`, `serves`, recursive `variant_dishes`, `courses`. Recursive Zod requires `z.ZodType<ReviewedDish>` annotation + a hand-defined TS type.

### Insert logic rewrite (replace single bulk insert)

Multi-pass:
1. **Parents** — insert with `is_parent: true`, capture returned IDs. Apply price rule (`bundle/course_menu/buffet` keep parent.price; `configurable/standard` parents force `price=0`).
2. **Variant children** — insert with `parent_dish_id = parent.id`, `is_parent: false`.
3. **Courses + items** for `course_menu` parents — insert into `dish_courses` then `dish_course_items` with `sort_order`.
4. **Standalone** — existing logic, unchanged.

Atomicity caveat: multi-pass without a transaction means partial failures leave orphan rows. For MVP, accept this and rely on `formError` propagation; orphan cleanup is a hardening item. RPC-based transactional save is a follow-up.

### Tests (`confirm-multi-kind.test.ts`)

Stub Supabase client (existing tests in `apps/admin/src/__tests__/menu-scan/` show the pattern). Cases:
- Bundle parent + 3 variants → 4 rows, parent has `price=<bundlePrice>` `is_parent=true`, children have `parent_dish_id`
- Configurable parent + 5 variants → parent forces `price=0`
- Course menu parent + 3 courses + items → `dish_courses` + `dish_course_items` rows correct
- Standalone standard + buffet → unchanged (regression)
- Mixed payload — all save correctly

### Commit
```
feat(admin/menu-scan): extend confirm-payload schema + multi-pass dish insert
```

---

## Phase 4b — VariantEditor component

### Goal
Admin can add/remove/edit variant children for `bundle`, `configurable`, and size-variant `standard` parents.

### Files
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/VariantEditor.tsx` (new, ~120 LOC)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (modify)

### `VariantEditor.tsx`

Inline editor below parent card. Header with "Variants (N)" + "Add variant" button. Each variant row: name input, price input, remove button. Empty state: "No variants yet."

### Wire into `ReviewDishEditor`

After Kind/protein/category grid, before closing `</li>`:
```tsx
{d.is_parent && ['standard', 'bundle', 'configurable'].includes(d.dish_kind) && (
  <VariantEditor
    parent={d}
    variants={dishes.filter(c => c.parent_id === d._id)}
    saving={saving}
    onAddVariant={() => addVariant(d._id)}
    onRemoveVariant={removeVariant}
    onUpdateVariant={update}
  />
)}
```

Filter top-level rendering so variants don't appear standalone:
```ts
const topLevelDishes = useMemo(() => dishes.filter(d => !d.parent_id), [dishes]);
const activeDishes = useMemo(() => dishes.filter(d => !d._deleted && !d.parent_id), [dishes]);
```

### Save payload

In `handleSave`, nest variants under parent's `variant_dishes[]`; include `courses[]` for course_menu parents.

### Commit
```
feat(admin/menu-scan): VariantEditor for bundle/configurable/standard parents
```

---

## Phase 5 — CourseEditor (no dnd-kit)

### Goal
Admin can manage courses + items for `course_menu` parents.

### Files
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/CourseEditor.tsx` (new, ~370 LOC)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (modify, small)

### `CourseEditor.tsx`

Port v1's `CourseEditor.tsx` structure, replace dnd-kit with up/down arrow buttons (disabled at boundaries).

Per-course block: name input, `choice_type` select (fixed/one_of), `required_count` input, up/down/remove buttons, items list (option_label, price_delta, up/down/remove per item), add item button.

### Tests
- Reducer tests for course actions covered in Phase 2.
- Playwright E2E: scan menu → set dish to Course Menu → verify Course 1 auto-seeds → add 2 items → add Course 2 → save → verify `dish_courses` + `dish_course_items` rows.

### Commit
```
feat(admin/menu-scan): CourseEditor for course_menu parents (no dnd)
```

---

## Phase 6a — verifier read path: `dal.ts`

### Goal
Restaurant detail page loads parents + variants + courses (currently filters parents out).

### Files
- `apps/admin/src/lib/auth/dal.ts` (modify)

### Changes
1. Remove `.eq('is_parent', false)` at line 555.
2. Extend select with `is_parent`, `parent_dish_id`, `display_price_prefix`, `serves`.
3. Group children under parents post-fetch; attach `variants[]` to parents.
4. Load courses + items for `course_menu` parents (4th query, scoped via `parent_dish_id IN (...)`).
5. Update `AdminMenuDish` type with new fields.

### Tests
Update existing dal tests in `apps/admin/src/__tests__/`. Add cases for parent + variants + courses.

### Commit
```
feat(admin): unfilter parents in restaurant verifier + load courses
```

---

## Phase 6b — `DishRowEditor.tsx` rendering

### Goal
Restaurant detail page surfaces variants + courses to admins.

### Files
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx` (modify)

### Changes
- For each parent dish row, render nested variant children (read-only or with simple edit affordances).
- For `course_menu` parents, render courses + items.
- Add Parent / Course menu badges next to dish names.

Detailed UI structure depends on existing `DishRowEditor.tsx` — investigate when this phase starts.

### Commit
```
feat(admin): render variants + courses in DishRowEditor
```

---

## Phase 7 — AI extraction of variants + courses

### Goal
GPT-4o emits structured `variants[]` and `courses[]` per dish. Admin still reviews/edits — UI machinery from Phases 2-6 is unchanged.

### Files
- `infra/supabase/functions/menu-scan-worker/index.ts` (modify)
- `infra/supabase/functions/menu-scan-worker/test.ts` (modify)

### Schema changes

Add recursive `menuExtractionDishSchema` via `z.lazy()` with `is_parent`, `display_price_prefix`, `serves`, `variants`, `courses`. Add `courseSchema` + `courseItemSchema`.

### Prompt update

Port classification rules from `apps/web-portal/app/api/menu-scan/route.ts:139-200`:
- CONFIGURABLE → `is_parent=true`, `display_price_prefix="from"`, `variants[]`
- BUNDLE → `is_parent=true`, parent has price, `variants[]` with `price=null`
- COURSE MENU → `is_parent=true`, `display_price_prefix="per_person"`, `courses[]`
- BUFFET → `is_parent=false`, `display_price_prefix="per_person"`
- SIZE VARIANTS → `dish_kind="standard"`, `is_parent=true`, `variants[]`
- STANDARD → `is_parent=false`

### Hydration update

Phase 2 stub becomes real: `asEditable` recursively flattens `variants[]` into the top-level dishes list with `parent_id` set.

### Tests
- `menu-scan-worker/test.ts`: extend with bundle/configurable/course_menu fixtures.
- Manual: `replayMenuScan` against 2-3 known menus, eyeball-check quality.

### Risks
- GPT-4o reliability with recursive schema — monitor success rate, fallback to per-dish retry with temperature=0.
- Token budget — per-image extraction (already in place) limits scope per call.
- Bad classifications — admin review UI catches over-classification.

### Deployment
```bash
supabase functions deploy menu-scan-worker
```

### Commit
```
feat(menu-scan-worker): extract variants + courses recursively
```

---

## Final verification (after Phase 7 ships)

E2E checklist:
- [ ] Scan a menu containing 1 standard, 1 bundle (3 items), 1 configurable (4 options), 1 course menu (3 courses × 2 items), 1 buffet
- [ ] Review UI renders correctly for each kind (Parent badges, VariantEditor, CourseEditor, price-prefix dropdowns)
- [ ] Save → DB has 1+3+4+1+1 = 10 dish rows, 3 dish_courses, 6 dish_course_items
- [ ] Restaurant verifier shows the saved structure
- [ ] Mobile feed correctly excludes parents and shows children where appropriate

Type + tests:
```
pnpm check-types
pnpm test
pnpm test:e2e
```

## Estimate

| Phase | Files | New LOC | Modified LOC | Effort |
|---|---|---|---|---|
| 2 | 1 mod, 2 new | ~250 | ~50 | 3-4h |
| 3 | 1 mod | 0 | ~30 | 1h |
| 4a | 1 mod, 1 new | ~150 | ~80 | 3-4h |
| 4b | 1 mod, 1 new | ~120 | ~30 | 2-3h |
| 5 | 1 mod, 1 new | ~370 | ~10 | 4-5h |
| 6a | 1 mod | ~80 | ~30 | 2h |
| 6b | 1 mod | ~100 | ~50 | 2-3h |
| 7 | 2 mod | ~100 | ~50 | 4-5h |
| **Total** | **~10 files** | **~1170** | **~330** | **~3 days focused** |

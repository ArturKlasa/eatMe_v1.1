# Restaurant-detail modifier editor — wire-up

**Status:** Implementation complete — Waves 1–3 shipped 2026-05-23. T4.1 (integration test for `adminUpdateDishModifiers`) + T4.2 (manual browser UAT) deferred as follow-ups.
**Last updated:** 2026-05-23
**Scope:** Make `option_groups` + `options` editable on the admin restaurant detail page (`apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`) by wiring the existing `<ModifierGroupsEditor>` and the existing `adminUpdateDishModifiers` server action into the dish-row edit flow.
**Out of scope:** New modifier-group features (templates, library, reordering across dishes); restaurant-owner-facing UI in `apps/web-portal/`; the legacy `apps/web-portal/components/forms/dish/DishOptionsSection.tsx` (separate code path, not affected). No DB changes, no new server actions, no shared-package changes.
**Sequencing:** This finishes the §4 deliverable of `dish-model-rewrite-phase-4-admin.md` that shipped read-only ("Add a read-only modifier-groups display"). Phase 4's other §4 deliverable — calling `adminUpdateDishModifiers` from the restaurant detail editor — was deferred at the time and is the entire body of this plan. No dependencies on unshipped phases.

---

## 1. Background

Three pieces of the modifier-editing path already exist:

1. **Postgres RPC `admin_replace_dish_modifiers`** (migration 144) — atomic delete-and-replace of a dish's option_groups + options. Integration tests in `apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts:452+` are green.
2. **Server action `adminUpdateDishModifiers`** (`apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts:326–380`) — wraps the RPC with `withAdminAuth`, Zod validation against `modifierGroupSchema`, audit-log entry, and `revalidatePath`. **Currently has zero callers** in the app — written specifically for this case.
3. **`<ModifierGroupsEditor>`** (`apps/admin/src/app/(admin)/menu-scan/[jobId]/ModifierGroupsEditor.tsx`, 496 lines) — full editor: name, selection_type (single/multiple), min/max, display_in_card, price_delta vs price_override, is_default, primary_protein override, serves_delta, removes_dietary_tags, adds_allergens, reorder + delete on groups and options. Used today only in the menu-scan review flow.

The data is also already loaded on the restaurant-detail page: `getAdminRestaurantMenus` in `apps/admin/src/lib/auth/dal.ts:655,685` populates `dish.modifier_groups: AdminMenuModifierGroup[]` for every dish, and `DishRowEditor.tsx:485–545` (`ModifierGroupsSummary`) renders it read-only.

What's missing is the wire-up. `DishRowEditor`'s edit mode (lines 278–476) carries a `draft` of scalar fields only; `modifier_groups` is never reified into draft state and never patched on Save. The intent is documented in two comments — `DishRowEditor.tsx:44–47` ("Editing happens through the menu-scan review flow") and `DishRowEditor.tsx:482–484` ("a dedicated inline editor on this page is deferred until usage justifies it"). Usage now justifies it.

---

## 2. Decisions needed before kickoff

### 2.1 Component location for the lifted editor

`<ModifierGroupsEditor>` and the related `Editable*` types + `apply*` reducer helpers currently live under `menu-scan/[jobId]/`. They have no coupling to the menu-scan path beyond their location.

| Option | Description | Pro | Con |
|---|---|---|---|
| **L1 — Lift to `apps/admin/src/components/modifiers/`** | New folder with `ModifierGroupsEditor.tsx`, `editableTypes.ts`, `groupReducers.ts` (lifted from `useReviewState.ts`). Both menu-scan and restaurant-detail import from there. | Single source of truth. No drift between the two surfaces. Matches the existing pattern of `apps/admin/src/components/DishCategoryCombobox.tsx`. | One PR touches menu-scan files (import-path churn). |
| **L2 — Leave editor in place; import from restaurant-detail via relative path** | `DishRowEditor.tsx` imports `../../menu-scan/[jobId]/ModifierGroupsEditor`. | Smallest diff. | Cross-route relative imports across `(admin)` segments are fragile; menu-scan owns a component used outside its route. Reviewers will flag this. |
| **L3 — Duplicate the editor** | Copy + own a second copy under restaurants. | Zero coupling. | Two copies drift the moment either surface adds a feature (e.g. a new option field). Rejected on sight. |

**Recommendation: L1.** The import-path churn is mechanical and one-shot. L2 will get refactored to L1 the next time someone touches it; doing it now saves a round-trip. L3 is a non-starter given the editor's surface area.

**Action required:** confirm L1 before kickoff. If L2, §5 changes — Wave 1 tasks T1.1/T1.4 become path-only edits and adapters.ts must remain co-located with the editor (also L2).

### 2.2 Save semantics — single button or separate

| Option | Description | Pro | Con |
|---|---|---|---|
| **S1 — Single Save fires both** | The existing "Save" button runs `adminUpdateDish` then, if `draftGroups` differs from `dish.modifier_groups`, runs `adminUpdateDishModifiers`. Two server round-trips per save when both changed. | Matches user mental model ("I edited the dish; save the dish"). Cancel discards both. No second button to discover. | Two-step partial-failure window: scalar update succeeds, modifier update fails → user sees error, state is half-saved. Surfaced via `serverError`. |
| **S2 — Separate "Save modifiers" button inside the modifier editor** | Modifier editor has its own Save/Cancel. Scalar Save ignores groups. | Each mutation is independent; clearer failure ownership. | Two save buttons in one expanded row. Users will miss it. Cancel-of-dish doesn't roll back modifier draft. |

**Recommendation: S1** with a deep-compare gate (skip the modifier RPC when `draftGroups` matches `dish.modifier_groups` byte-for-byte after canonicalisation). The partial-failure case is tolerable — the modifier action's audit log entry is independent of the dish update; the user sees a clear error and can retry.

Partial-failure handling on Save — **modifier first, then scalar** (modifier is the more error-prone operation: atomic delete-and-replace RPC, larger payload, more validation. Failing first means clean abort with no DB writes, so Cancel still discards everything. Reverse order would leave an uncancellable scalar half-save):
1. If `draftGroups` differs from `dish.modifier_groups`, call `adminUpdateDishModifiers` first. On failure, abort with `serverError` set to the error message. No scalar write fires.
2. If the modifier call succeeded (or was skipped because groups didn't change), call `adminUpdateDish` next when `patch` is non-empty.
3. If the scalar call fails after the modifier already succeeded, surface `serverError` as `"Modifier groups saved, but dish update failed: …"`. `setIsEditing(true)` stays so the user can retry; on retry, `groupsEqual` is true so only the scalar update fires.
4. On full success, call `onUpdated({ ...draft, modifier_groups: dish.modifier_groups })` (scalar optimistic state only) plus `router.refresh()` to pull the freshly-persisted modifier groups via the action's `revalidatePath`, then `setIsEditing(false)`.

### 2.3 Empty-state affordance

| Option | Description | Pro | Con |
|---|---|---|---|
| **E1 — Show "+ Add modifier groups" button on the read-only row** | When `dish.modifier_groups.length === 0` and the row is not in edit mode, show a small button that opens edit-mode and immediately calls `onAddGroup`. | Discoverable. One-click to first group. | Adds visual noise to dishes that legitimately don't need modifiers (every standard dish). |
| **E2 — Inside edit mode only** | The editor always renders inside the expanded row, with its own "+ Add group" button (which already exists in `ModifierGroupsEditor`). Empty state is just the editor's "No modifier groups" placeholder. | Zero new affordance on read-only row. | Less discoverable — admin must enter edit mode to add the first group. |

**Recommendation: E2.** The read-only row is already dense with badges; adding a button to every row to support a minority of dishes hurts scan-ability. Admins who need to add modifiers will enter edit mode; the editor's existing "+ Add group" is the obvious next action. Revisit if users report difficulty.

### 2.4 `is_default` constraint on `single` groups

The current editor (`ModifierGroupsEditor.tsx:340–345`) lets multiple options in a `single` group be marked `is_default`. The DB doesn't enforce uniqueness. The mobile consumer side handles "multiple defaults in a single group" gracefully (picks the first), but it's not semantically meaningful.

**Recommendation: defer.** Not introduced by this change; not regressed by this change. File a separate ticket if it bites users. (Noted because reviewers may flag it during this PR.)

---

## 3. End state (after this plan)

```
apps/admin/src/
├── components/modifiers/                           ← NEW (per §2.1 L1)
│   ├── ModifierGroupsEditor.tsx                    ← moved from menu-scan
│   ├── editableTypes.ts                            ← lifted from useReviewState.ts
│   ├── groupReducers.ts                            ← apply* helpers (sibling, single-dish)
│   └── adapters.ts                                 ← NEW: DAL ↔ Editable ↔ API
│
└── app/(admin)/
    ├── menu-scan/[jobId]/
    │   ├── ModifierGroupsEditor.tsx                ← DELETED
    │   ├── useReviewState.ts                       ← imports from components/modifiers/
    │   └── ReviewDishEditor.tsx                    ← import path updated
    │
    └── restaurants/[id]/
        ├── DishRowEditor.tsx                       ← edit-mode now renders editor +
        │                                             fires adminUpdateDishModifiers
        └── actions/dish.ts                         ← unchanged (action already exists)
```

User-visible change: in the admin restaurant detail page, clicking a dish row to edit it now exposes the same modifier-groups editor as the menu-scan review flow. Save persists both scalar fields and modifier groups atomically (per-mutation atomicity; cross-mutation is sequential per §2.2 S1).

---

## 4. Implementation overview (prose walkthrough)

This section is the design narrative. §5 below is the executable task breakdown — go there to implement.

### 4.1 Lift the editor + types + reducers to `components/modifiers/`

Move `ModifierGroupsEditor.tsx` verbatim and refactor its prop type from `parent: EditableDish` (a menu-scan-only shape) to `groups: EditableModifierGroup[]` (the only thing it actually reads). Extract `EditableModifierGroup`, `EditableModifierOption`, `ExtractedModifier*`, `newEmptyModifierGroup`, `newEmptyModifierOption` from `useReviewState.ts:60–125` into `editableTypes.ts`. Extract the 8 `applyAdd*`/`applyRemove*`/`applyMove*`/`applyUpdate*` helpers (`useReviewState.ts:140–280`) into `groupReducers.ts` as sibling functions that operate on a single dish's groups: `addGroup(groups)`, `removeGroup(groups, i)`, `moveGroup(groups, from, to)`, `updateGroup(groups, i, patch)`, `addOption(groups, gi)`, `removeOption(groups, gi, oi)`, `moveOption(groups, gi, from, to)`, `updateOption(groups, gi, oi, patch)`. Rewrite the existing `apply*(dishes, dishId)` wrappers in `useReviewState.ts` as one-liners that call the new helpers. Update `useReviewState.ts` and `ReviewDishEditor.tsx` imports. Run the menu-scan tests to confirm no regression.

### 4.2 Add adapters

New file `apps/admin/src/components/modifiers/adapters.ts`:

```ts
import type { z } from 'zod';
import type { AdminMenuModifierGroup } from '@/lib/auth/dal';
import type { EditableModifierGroup } from './editableTypes';
import { modifierGroupSchema } from '@/lib/modifiers/schemas';

// DAL → Editable (open-edit path)
export function toEditableGroup(g: AdminMenuModifierGroup): EditableModifierGroup;
export function toEditableGroups(gs: AdminMenuModifierGroup[]): EditableModifierGroup[];

// Editable → API payload (Save path; strips _id; type inferred from the shared
// Zod schema — single source of truth, no hand-maintained duplicate)
export type ApiGroupPayload = z.infer<typeof modifierGroupSchema>;
export function toApiGroup(g: EditableModifierGroup): ApiGroupPayload;
export function toApiGroups(gs: EditableModifierGroup[]): ApiGroupPayload[];

// Deep-equality for the §2.2 dirty check
export function groupsEqual(a: EditableModifierGroup[], b: AdminMenuModifierGroup[]): boolean;
```

Post-save optimistic refresh is handled by `router.refresh()` in `DishRowEditor.tsx` (T3.3), not by synthesising DAL groups with placeholder ids: the action's `revalidatePath` propagates fresh server state on refetch (~100ms). The read-only `<ModifierGroupsSummary>` rerenders with real DB ids. No optimistic synthesis needed.

`groupsEqual` canonicalises: drop `_id` from Editable, drop `id` from DAL, JSON.stringify with sorted keys, compare. Cheap; runs once per Save.

The `modifierGroupSchema` import (and the inferred `ApiGroupPayload` type) requires T2.0 to land first, which extracts the schema from `actions/dish.ts` into the shared `@/lib/modifiers/schemas` module.

### 4.3 Wire `DishRowEditor.tsx`

Add a second draft slot for groups (paralleling `draft`):

```ts
const [draftGroups, setDraftGroups] = useState<EditableModifierGroup[]>(
  () => toEditableGroups(dish.modifier_groups)
);
```

Reset on `openEdit`. Render `<ModifierGroupsEditor>` after the existing "Available" checkbox (line ~418) and before `{serverError && …}` (line 420), wiring its 8 callbacks to the `groupReducers` helpers. Extend `handleSave` with the §2.2 partial-failure protocol: **modifier-replace → scalar-update** (modifier first because it's the more error-prone operation; failing first means clean abort with no scalar write). On success, `onUpdated({ ...draft, modifier_groups: dish.modifier_groups })` applies the scalar optimistic state, then `router.refresh()` pulls the fresh modifier groups via the action's `revalidatePath`. Update the two deferred-language comments at lines 44 and 482.

### 4.4 No changes to

- `actions/dish.ts` — `adminUpdateDishModifiers` is already defined exactly as needed.
- `lib/auth/dal.ts` — `modifier_groups` is already loaded onto every dish.
- Migration 144 — RPC is already deployed and tested.
- `apps/web-portal/` — out of scope. The legacy `DishOptionsSection.tsx` still works against the same tables.

---

## 5. Task breakdown (executable)

Tasks are organised into 4 waves. Within a wave, marked tasks may run in parallel. Across waves, strict ordering. Each task has a `read_first` (files the executor MUST read before editing), an `action` (concrete change with literal values), `files_modified`, and `acceptance_criteria` (grep-verifiable conditions).

### Wave 1 — Lift to shared

Wave-1 gate: T1.5 must exit 0 before Wave 2 begins.

#### T1.1 — Move `ModifierGroupsEditor.tsx` to shared location

**Action:** Move `apps/admin/src/app/(admin)/menu-scan/[jobId]/ModifierGroupsEditor.tsx` → `apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx`. Refactor the prop type: in the `Props` interface (currently line 7), replace `parent: EditableDish` with `groups: EditableModifierGroup[]`. In the function body (currently line 40 `parent.modifier_groups.length`), replace every occurrence of `parent.modifier_groups` with `groups`. Remove the `EditableDish` import; the component no longer needs it. Update the `GroupRow` and `OptionRow` sub-components' import lines to use the new shared `editableTypes` path (`@/components/modifiers/editableTypes`) — T1.2 creates that file, so this task may need to land in the same commit as T1.2 or use a temporary re-export in `useReviewState.ts` until T1.2 lands.

**read_first:**
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ModifierGroupsEditor.tsx`
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` (for the `Editable*` types currently exported here)

**files_modified:**
- `apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx` (new)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ModifierGroupsEditor.tsx` (deleted)

**acceptance_criteria:**
- `test -f apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx`
- `! test -f apps/admin/src/app/(admin)/menu-scan/[jobId]/ModifierGroupsEditor.tsx`
- `grep -q "groups: EditableModifierGroup\[\]" apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx`
- `! grep -q "parent: EditableDish" apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx`
- `! grep -q "parent\.modifier_groups" apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx`

**Parallelism:** runnable in parallel with T1.2 and T1.3 within Wave 1.

#### T1.2 — Extract `Editable*` types + factories

**Action:** Create `apps/admin/src/components/modifiers/editableTypes.ts`. Move the type definitions `EditableModifierGroup`, `EditableModifierOption`, `ExtractedModifierGroup`, `ExtractedModifierOption` from `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` (currently lines 60–99) into the new file as `export type` declarations. Move the factory functions `newEmptyModifierGroup` and `newEmptyModifierOption` (currently lines 104–135) into the same new file as `export function`. In `useReviewState.ts`, replace the moved definitions with re-exports: `export type { EditableModifierGroup, EditableModifierOption, ExtractedModifierGroup, ExtractedModifierOption } from '@/components/modifiers/editableTypes';` and `export { newEmptyModifierGroup, newEmptyModifierOption } from '@/components/modifiers/editableTypes';`. This keeps menu-scan callers working without import changes.

**read_first:**
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` (lines 60–135)

**files_modified:**
- `apps/admin/src/components/modifiers/editableTypes.ts` (new)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts`

**acceptance_criteria:**
- `test -f apps/admin/src/components/modifiers/editableTypes.ts`
- `grep -q "export type EditableModifierGroup" apps/admin/src/components/modifiers/editableTypes.ts`
- `grep -q "export type EditableModifierOption" apps/admin/src/components/modifiers/editableTypes.ts`
- `grep -q "export function newEmptyModifierGroup" apps/admin/src/components/modifiers/editableTypes.ts`
- `grep -q "from '@/components/modifiers/editableTypes'" apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts`

**Parallelism:** runnable in parallel with T1.1 and T1.3.

#### T1.3 — Extract reducer helpers

**Action:** Create `apps/admin/src/components/modifiers/groupReducers.ts` exporting 8 pure functions with these exact signatures:

```ts
import type { EditableModifierGroup, EditableModifierOption } from './editableTypes';

export function addGroup(groups: EditableModifierGroup[]): EditableModifierGroup[];
export function removeGroup(groups: EditableModifierGroup[], idx: number): EditableModifierGroup[];
export function moveGroup(groups: EditableModifierGroup[], from: number, to: number): EditableModifierGroup[];
export function updateGroup(groups: EditableModifierGroup[], idx: number, patch: Partial<EditableModifierGroup>): EditableModifierGroup[];
export function addOption(groups: EditableModifierGroup[], groupIdx: number): EditableModifierGroup[];
export function removeOption(groups: EditableModifierGroup[], groupIdx: number, optIdx: number): EditableModifierGroup[];
export function moveOption(groups: EditableModifierGroup[], groupIdx: number, from: number, to: number): EditableModifierGroup[];
export function updateOption(groups: EditableModifierGroup[], groupIdx: number, optIdx: number, patch: Partial<EditableModifierOption>): EditableModifierGroup[];
```

Body: lift the implementations from `useReviewState.ts:140–280` (the existing `applyAdd*`/`applyRemove*`/`applyMove*`/`applyUpdate*` functions), but operate on `groups[]` directly instead of `dishes[].find(d => d.id === dishId).modifier_groups`. Then **delete** the 8 existing `apply*(dishes, dishId, …)` wrappers from `useReviewState.ts` and update every menu-scan call site to invoke the new helpers directly on the right dish's `modifier_groups`. Find call sites with: `grep -rn -E "apply(Add|Remove|Move|Update)Modifier(Group|Option)\(" apps/admin/src/` — expected to be inside `useReviewState.ts` itself plus possibly `ReviewDishEditor.tsx`. The new pattern is: `setDishes(dishes => dishes.map(d => d.id === dishId ? { ...d, modifier_groups: addGroup(d.modifier_groups) } : d))` (and similar for the other 7 helpers). Keeps one obvious way to do the manipulation; avoids the "two ways to do this" debt the wrappers would create.

**read_first:**
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` (lines 140–280 — wrappers to delete)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (potential call-site updates)

**files_modified:**
- `apps/admin/src/components/modifiers/groupReducers.ts` (new)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts`
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (if it has call sites — grep first)

**acceptance_criteria:**
- `test -f apps/admin/src/components/modifiers/groupReducers.ts`
- `grep -E "^export function (addGroup|removeGroup|moveGroup|updateGroup|addOption|removeOption|moveOption|updateOption)" apps/admin/src/components/modifiers/groupReducers.ts | wc -l` returns `8`
- `! grep -E "^export function (applyAddModifierGroup|applyRemoveModifierGroup|applyMoveModifierGroup|applyUpdateModifierGroup|applyAddModifierOption|applyRemoveModifierOption|applyMoveModifierOption|applyUpdateModifierOption)" apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` (wrappers deleted)
- `grep -rn -E "apply(Add|Remove|Move|Update)Modifier(Group|Option)\(" apps/admin/src/` returns 0 lines (no callers reference the deleted wrappers)

**Parallelism:** runnable in parallel with T1.1 and T1.2.

#### T1.4 — Update menu-scan import paths

**Action:** In `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`, change the import line for `ModifierGroupsEditor` from `./ModifierGroupsEditor` to `@/components/modifiers/ModifierGroupsEditor`. In the JSX where it's rendered, change `parent={parent}` (or whatever prop the dish is passed under) to `groups={parent.modifier_groups}` to match the new prop name from T1.1. Run `grep -r "from.*menu-scan.*ModifierGroupsEditor" apps/admin/src/` and verify it returns no results — if anything turns up, update those import paths too.

**read_first:**
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`

**files_modified:**
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`

**acceptance_criteria:**
- `grep -q "from '@/components/modifiers/ModifierGroupsEditor'" apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`
- `grep -q "groups={" apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`
- `grep -rn "from.*menu-scan.*ModifierGroupsEditor" apps/admin/src/` returns 0 lines

**Parallelism:** depends on T1.1, T1.2, T1.3. Sequential within Wave 1.

#### T1.5 — Wave 1 gate: menu-scan tests + typecheck

**Action:** Run `cd apps/admin && npx tsc --noEmit && npx vitest run src/__tests__/menu-scan/useReviewState.test.ts src/__tests__/menu-scan/confirm-modifier-groups.test.ts`. Confirm zero TypeScript errors and both test files exit 0. If any test fails, the cause is almost always an import path or a missed `parent.modifier_groups` → `groups` rename in T1.1/T1.4 — fix and re-run.

**read_first:**
- `apps/admin/src/__tests__/menu-scan/useReviewState.test.ts`
- `apps/admin/src/__tests__/menu-scan/confirm-modifier-groups.test.ts`
- `apps/admin/package.json`

**files_modified:** none (verification only)

**acceptance_criteria:**
- `cd apps/admin && npx tsc --noEmit` exits 0
- `cd apps/admin && npx vitest run src/__tests__/menu-scan/useReviewState.test.ts src/__tests__/menu-scan/confirm-modifier-groups.test.ts` exits 0

**Parallelism:** none — gate.

### Wave 2 — Adapters

Depends on Wave 1 completing (T1.5 green).

#### T2.0 — Extract modifier Zod schemas to shared module

**Action:** Create `apps/admin/src/lib/modifiers/schemas.ts` exporting the modifier Zod schemas so both `actions/dish.ts` and the adapter test (T2.2) can import them. Move `modifierOptionSchema` and `modifierGroupSchema` verbatim from `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts` (currently lines 21–39) into the new file, converting `const` to `export const`. In `actions/dish.ts`, replace the moved declarations with `import { modifierOptionSchema, modifierGroupSchema } from '@/lib/modifiers/schemas';`. Do NOT move `adminDishModifiersReplaceSchema` (line 313) — it stays in `actions/dish.ts` and continues to wrap `modifierGroupSchema` via the import.

This task exists for two reasons: (1) `modifierGroupSchema` is `const` (not exported) in `actions/dish.ts`, so T2.2 case 2 cannot import it as written; (2) extracting lets `ApiGroupPayload` in adapters.ts be `z.infer<typeof modifierGroupSchema>` instead of a hand-maintained duplicate.

**read_first:**
- `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts` (lines 21–39 — schemas to lift; line 313 — `adminDishModifiersReplaceSchema` that depends on them)

**files_modified:**
- `apps/admin/src/lib/modifiers/schemas.ts` (new)
- `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts`

**acceptance_criteria:**
- `test -f apps/admin/src/lib/modifiers/schemas.ts`
- `grep -q "export const modifierGroupSchema" apps/admin/src/lib/modifiers/schemas.ts`
- `grep -q "export const modifierOptionSchema" apps/admin/src/lib/modifiers/schemas.ts`
- `grep -q "from '@/lib/modifiers/schemas'" apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts`
- `! grep -E "^const (modifierOptionSchema|modifierGroupSchema) = z\." apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts` (originals removed)
- `cd apps/admin && npx tsc --noEmit` exits 0
- `cd apps/admin && npx vitest run src/__tests__/integration/admin-confirm-rpc.test.ts` exits 0 (RPC tests unaffected by the schema lift)

**Parallelism:** none — predecessor to T2.1.

#### T2.1 — Create adapters module

**Action:** Create `apps/admin/src/components/modifiers/adapters.ts` exporting the functions described in §4.2 with these exact signatures:

```ts
import type { z } from 'zod';
import type { AdminMenuModifierGroup, AdminMenuModifierOption } from '@/lib/auth/dal';
import type { EditableModifierGroup, EditableModifierOption } from './editableTypes';
import { modifierGroupSchema } from '@/lib/modifiers/schemas';

export function toEditableGroup(g: AdminMenuModifierGroup): EditableModifierGroup;
export function toEditableGroups(gs: AdminMenuModifierGroup[]): EditableModifierGroup[];

// Inferred from the Zod schema (created in T2.0) — single source of truth.
// No hand-maintained duplicate interface.
export type ApiGroupPayload = z.infer<typeof modifierGroupSchema>;
export function toApiGroup(g: EditableModifierGroup): ApiGroupPayload;
export function toApiGroups(gs: EditableModifierGroup[]): ApiGroupPayload[];

export function groupsEqual(a: EditableModifierGroup[], b: AdminMenuModifierGroup[]): boolean;
```

`toEditableGroup` sets `_id = g.id` and copies every field through; options similarly (`_id = o.id`). `toApiGroup` strips `_id` from group and each option; the inferred `ApiGroupPayload` type guarantees structural match with the Zod schema at compile time. `groupsEqual` canonicalises both sides: build a normalised array dropping `_id`/`id`, JSON.stringify both with `Object.keys().sort()` per object, compare the strings.

No `toDalGroups` helper — post-save optimistic refresh uses `router.refresh()` in T3.3 (see §4.2). Avoids synthesising placeholder UUIDs just to satisfy React keys.

**read_first:**
- `apps/admin/src/lib/auth/dal.ts` (lines 490–525 — `AdminMenuModifierGroup` and `AdminMenuModifierOption` definitions)
- `apps/admin/src/lib/modifiers/schemas.ts` (created in T2.0 — `modifierGroupSchema` source)
- `apps/admin/src/components/modifiers/editableTypes.ts` (created in T1.2)

**files_modified:**
- `apps/admin/src/components/modifiers/adapters.ts` (new)

**acceptance_criteria:**
- `test -f apps/admin/src/components/modifiers/adapters.ts`
- `grep -E "^export function (toEditableGroup|toEditableGroups|toApiGroup|toApiGroups|groupsEqual)" apps/admin/src/components/modifiers/adapters.ts | wc -l` returns `5`
- `grep -q "export type ApiGroupPayload = z.infer<typeof modifierGroupSchema>" apps/admin/src/components/modifiers/adapters.ts`
- `! grep -q "toDalGroups" apps/admin/src/components/modifiers/adapters.ts`
- `cd apps/admin && npx tsc --noEmit` exits 0

#### T2.2 — Adapter unit tests

**Action:** Create `apps/admin/src/__tests__/components/modifiers/adapters.test.ts` with 4 cases:

1. **Round-trip** — given an `AdminMenuModifierGroup` with one group + two options (all fields populated), `toApiGroup(toEditableGroup(input))` equals the API-shape projection (every field preserved except `id`/`_id`).
2. **Zod conformance** — `toApiGroup(toEditableGroup(input))` parses successfully against `modifierGroupSchema` imported from `@/lib/modifiers/schemas` (the shared module created in T2.0). Expect no `ZodError`.
3. **`groupsEqual` true on byte-equal** — `groupsEqual(toEditableGroups(dalGroups), dalGroups)` is `true` for a non-trivial fixture.
4. **`groupsEqual` false on diff** — for each of: group name changed, option added, two options reordered, option `price_delta` changed — assert `groupsEqual(...)` is `false`.

Use Vitest. Follow the same describe/it pattern as `apps/admin/src/__tests__/menu-scan/useReviewState.test.ts`.

**read_first:**
- `apps/admin/src/components/modifiers/adapters.ts` (created in T2.1)
- `apps/admin/src/__tests__/menu-scan/useReviewState.test.ts` (for the test style)
- `apps/admin/src/lib/modifiers/schemas.ts` (created in T2.0 — for the Zod schema import used in case 2)

**files_modified:**
- `apps/admin/src/__tests__/components/modifiers/adapters.test.ts` (new)

**acceptance_criteria:**
- `test -f apps/admin/src/__tests__/components/modifiers/adapters.test.ts`
- `grep -cE "^\s*(it|test)\(" apps/admin/src/__tests__/components/modifiers/adapters.test.ts` returns `>= 4`
- `cd apps/admin && npx vitest run src/__tests__/components/modifiers/adapters.test.ts` exits 0

### Wave 3 — Wire `DishRowEditor`

Depends on Wave 1 + Wave 2.

#### T3.1 — Add `draftGroups` state + reset on openEdit

**Action:** In `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`, add these imports at the top alongside the existing imports:
```ts
import { ModifierGroupsEditor } from '@/components/modifiers/ModifierGroupsEditor';
import { addGroup, removeGroup, moveGroup, updateGroup, addOption, removeOption, moveOption, updateOption } from '@/components/modifiers/groupReducers';
import { toEditableGroups, toApiGroups, groupsEqual } from '@/components/modifiers/adapters';
import type { EditableModifierGroup } from '@/components/modifiers/editableTypes';
```
After the existing `const [draft, setDraft] = useState<AdminMenuDish>(dish);` (currently line ~138), add:
```ts
const [draftGroups, setDraftGroups] = useState<EditableModifierGroup[]>(() =>
  toEditableGroups(dish.modifier_groups)
);
```
In the `openEdit` function (currently lines 156–160), add the line `setDraftGroups(toEditableGroups(dish.modifier_groups));` right after `setDraft(dish);` so that re-opening edit-mode after a successful save reflects the current persisted groups.

**read_first:**
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `apps/admin/src/components/modifiers/adapters.ts`
- `apps/admin/src/components/modifiers/editableTypes.ts`

**files_modified:**
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`

**acceptance_criteria:**
- `grep -q "useState<EditableModifierGroup\[\]>" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "setDraftGroups(toEditableGroups(dish.modifier_groups))" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "from '@/components/modifiers/adapters'" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "from '@/components/modifiers/ModifierGroupsEditor'" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "from '@/components/modifiers/groupReducers'" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`

#### T3.2 — Render `<ModifierGroupsEditor>` in edit mode

**Action:** In `DishRowEditor.tsx`, after the existing `<label>` for the "Available" checkbox (currently lines 411–418) and before the `{serverError && …}` block (currently line 420), insert this JSX block:

```tsx
<div className="border-t border-border pt-2">
  <ModifierGroupsEditor
    groups={draftGroups}
    saving={isPending}
    onAddGroup={() => setDraftGroups(g => addGroup(g))}
    onRemoveGroup={(i) => setDraftGroups(g => removeGroup(g, i))}
    onMoveGroup={(from, to) => setDraftGroups(g => moveGroup(g, from, to))}
    onUpdateGroup={(i, patch) => setDraftGroups(g => updateGroup(g, i, patch))}
    onAddOption={(i) => setDraftGroups(g => addOption(g, i))}
    onRemoveOption={(gi, oi) => setDraftGroups(g => removeOption(g, gi, oi))}
    onMoveOption={(gi, from, to) => setDraftGroups(g => moveOption(g, gi, from, to))}
    onUpdateOption={(gi, oi, patch) => setDraftGroups(g => updateOption(g, gi, oi, patch))}
  />
</div>
```

The imports were added in T3.1. Verify the editor renders: `cd apps/admin && pnpm dev` and click any dish in the restaurant detail page; the editor should appear inside the expanded row.

**read_first:**
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx` (for the props contract — confirm prop names match)

**files_modified:**
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`

**acceptance_criteria:**
- `grep -q "<ModifierGroupsEditor" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "groups={draftGroups}" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -cE "on(Add|Remove|Move|Update)(Group|Option)=" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx` returns `8`

#### T3.3 — Extend `handleSave` with modifier-replace step

**Action:** Replace the existing `handleSave` function in `DishRowEditor.tsx` (currently lines 167–204) with:

```ts
function handleSave() {
  setServerError('');

  // Existing scalar-patch construction (keep verbatim from current implementation).
  const patch: Record<string, unknown> = {};
  if (draft.name !== dish.name) patch.name = draft.name;
  if (draft.description !== dish.description) patch.description = draft.description;
  if (draft.price !== dish.price) patch.price = draft.price;
  if (draft.status !== dish.status) patch.status = draft.status;
  if (draft.is_available !== dish.is_available) patch.is_available = draft.is_available ?? true;
  if (draft.primary_protein !== dish.primary_protein) patch.primary_protein = draft.primary_protein;
  if (draft.menu_category_id !== dish.menu_category_id) patch.menu_category_id = draft.menu_category_id;
  if (draft.dish_category_id !== dish.dish_category_id) patch.dish_category_id = draft.dish_category_id;
  if (draft.dining_format !== dish.dining_format) patch.dining_format = draft.dining_format;

  const scalarChanged = Object.keys(patch).length > 0;
  const groupsChanged = !groupsEqual(draftGroups, dish.modifier_groups);

  if (!scalarChanged && !groupsChanged) {
    setIsEditing(false);
    return;
  }

  startTransition(async () => {
    // Step 1 — modifier replace FIRST (the more error-prone operation; a failure
    // here aborts cleanly with no scalar write, so Cancel still discards everything).
    if (groupsChanged) {
      const result = await adminUpdateDishModifiers(dish.id, restaurantId, {
        groups: toApiGroups(draftGroups),
      });
      if (!result.ok) {
        setServerError(result.formError ?? 'Modifier update failed');
        return;
      }
    }

    // Step 2 — scalar update (only when dirty).
    if (scalarChanged) {
      const result = await adminUpdateDish(dish.id, restaurantId, patch);
      if (!result.ok) {
        setServerError(
          groupsChanged
            ? `Modifier groups saved, but dish update failed: ${result.formError ?? 'unknown error'}`
            : (result.formError ?? 'Update failed')
        );
        return;
      }
    }

    // Apply optimistic state for scalar fields only. Modifier groups update
    // via router.refresh() — the action's revalidatePath propagates fresh
    // server state on refetch (~100ms). Brief stale read in the summary is
    // acceptable; avoids synthesising placeholder UUIDs.
    const nextDishCategoryName =
      draft.dish_category_id != null
        ? (dishCategoryOptions.find(o => o.id === draft.dish_category_id)?.name ?? null)
        : null;
    onUpdated({
      ...draft,
      dish_category_name: nextDishCategoryName,
      // Keep pre-save groups in optimistic state; router.refresh() pulls the
      // freshly-persisted set.
      modifier_groups: dish.modifier_groups,
    });
    if (groupsChanged) {
      router.refresh();
    }
    setIsEditing(false);
  });
}
```

Add the import for `adminUpdateDishModifiers` alongside the existing imports of `adminDeleteDish, adminUpdateDish`:
```ts
import { adminDeleteDish, adminUpdateDish, adminUpdateDishModifiers } from './actions/dish';
```

Also add `useRouter` from `next/navigation` if not already imported, and instantiate near the other hooks:
```ts
import { useRouter } from 'next/navigation';
// …
const router = useRouter();
```

**read_first:**
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx` (lines 167–204 specifically; also scan top imports for existing `useRouter` to avoid duplicate import)
- `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts` (lines 326–380 — `adminUpdateDishModifiers` signature)

**files_modified:**
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`

**acceptance_criteria:**
- `grep -q "adminUpdateDishModifiers" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "groupsEqual(draftGroups, dish.modifier_groups)" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "toApiGroups(draftGroups)" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "Modifier groups saved, but dish update failed" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx` (modifier-first error message)
- `! grep -q "Dish saved, but modifier groups failed" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx` (the old scalar-first message must NOT appear)
- `grep -q "router.refresh()" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `! grep -q "toDalGroups" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "import { adminDeleteDish, adminUpdateDish, adminUpdateDishModifiers }" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "from 'next/navigation'" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`

#### T3.4 — Update deferred-language comments

**Action:** In `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`, replace the block comment at lines 44–47 (currently starting with "Read-only sub-list of modifier groups (Phase 4 model)") with:
```
// Sub-list shown beneath each dish row. Modifier groups render via <ModifierGroupsSummary>;
// clicking the row enters edit mode where <ModifierGroupsEditor> appears. Variants and
// courses remain read-only here (kept until Phase 7 drops those tables).
```
Replace the block comment at lines 482–484 (currently starting with "Collapsible read-only summary of a dish's modifier groups") with:
```
// Collapsible summary of a dish's modifier groups, rendered in the read-only row.
// Editing happens in the expanded edit-mode form via <ModifierGroupsEditor>.
```

**read_first:**
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx` (lines 44–47 and 482–484)

**files_modified:**
- `apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`

**acceptance_criteria:**
- `! grep -q "Editing happens through the menu-scan review flow" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `! grep -q "deferred until usage justifies it" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`
- `grep -q "Editing happens in the expanded edit-mode form via <ModifierGroupsEditor>" apps/admin/src/app/(admin)/restaurants/[id]/DishRowEditor.tsx`

#### T3.5 — Wave 3 gate: typecheck + lint

**Action:** Run `cd apps/admin && npx tsc --noEmit` and `cd apps/admin && pnpm lint` (or `pnpm -F admin lint` from repo root, whichever the project uses — check `apps/admin/package.json` scripts and CLAUDE.md "Key Commands" section). Confirm zero TypeScript errors and zero new lint warnings vs `main`.

**read_first:**
- `CLAUDE.md`
- `apps/admin/package.json`

**files_modified:** none (verification only)

**acceptance_criteria:**
- `cd apps/admin && npx tsc --noEmit` exits 0
- `cd apps/admin && pnpm lint` exits 0 (or equivalent per project convention)

### Wave 4 — Integration tests + UAT

Depends on Wave 3. T4.1 and T4.2 may run in parallel.

#### T4.1 — Integration test for `adminUpdateDishModifiers`

**Action:** Create `apps/admin/src/__tests__/restaurants/admin-update-dish-modifiers.test.ts`. Follow the same setup pattern as `apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts:452+` (local Supabase, service-role client, seeded restaurant + dish + admin user). Implement 5 cases:

1. **Happy path** — seed a dish with one group ("Size") + two options ("Small" / "Large"). Call `adminUpdateDishModifiers(dishId, restaurantId, { groups: […new group with different options…] })`. Query `option_groups` and `options` tables filtered by `dish_id`; assert the row set matches the input exactly (count, names, price_delta). Assert old "Size" group is gone.
2. **Empty groups** — seed a dish with two groups. Call with `{ groups: [] }`. Assert zero `option_groups` rows remain for that dish.
3. **Wrong restaurantId** — seed two restaurants A and B, a dish under A. Call with `restaurantId = B.id`. Assert result is `{ ok: false, formError: 'NOT_FOUND' }`. Assert no rows changed in either restaurant.
4. **Schema rejection** — call with a group missing the `name` field. Assert result is `{ ok: false, fieldErrors: { ... } }`. Assert no rows changed.
5. **Audit log entry** — after running case 1, query the audit-log table (verify the exact table name and column names in `apps/admin/src/lib/audit.ts` and any audit-table migration BEFORE writing the test query; `admin_audit_log` is the likely name but unverified at planning time) for at least one row where `action = 'replace_dish_modifiers'` AND the row references this `dishId`. Do NOT assert payload-column shape — the audit-log wrapper's payload serialisation is covered by `logAdminAction`'s own tests; here we only need to confirm the action wired the audit call at all.

**read_first:**
- `apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts` (lines 452+ — RPC test scaffolding to crib)
- `apps/admin/src/__tests__/restaurants/delete-restaurant.test.ts` (restaurants-domain test setup pattern)
- `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts` (lines 326–380 — the action under test)

**files_modified:**
- `apps/admin/src/__tests__/restaurants/admin-update-dish-modifiers.test.ts` (new)

**acceptance_criteria:**
- `test -f apps/admin/src/__tests__/restaurants/admin-update-dish-modifiers.test.ts`
- `grep -cE "^\s*(it|test)\(" apps/admin/src/__tests__/restaurants/admin-update-dish-modifiers.test.ts` returns `>= 5`
- `cd apps/admin && npx vitest run src/__tests__/restaurants/admin-update-dish-modifiers.test.ts` exits 0

#### T4.2 — Manual UAT

**Action:** Run through 6 steps in a local browser session against the dev admin app:

1. Open `/restaurants/{id}` in the admin app. Click a dish that has existing modifier groups (e.g. a scanned Pad Thai). Verify the read-only `<ModifierGroupsSummary>` expands as before.
2. Click the dish row to enter edit mode. Verify the modifier editor renders with all existing groups + options visible and editable.
3. Add a new group, add two options to it, set one as default. Click Save. Verify the row collapses, the read-only summary now shows the new group, and a hard refresh of the page (DB read) shows the same groups.
4. Edit only a scalar field (e.g. price) on a different dish and Save. Open browser DevTools Network tab and verify exactly **1** server action POST is made (only `adminUpdateDish`, no `adminUpdateDishModifiers` call).
5. Click a dish with zero modifier groups. Enter edit mode. Verify the editor renders empty with "No modifier groups" placeholder and a working "+ Add group" button. Add one group, Save.
6. In a second browser tab, delete the dish (or change its restaurantId). Return to the first tab and Save. Verify `serverError` shows `NOT_FOUND` and the dish row stays in edit mode without losing the modifier draft.

Document any defects in a follow-up comment on the PR.

**read_first:**
- `docs/plans/restaurant-detail-modifier-editor.md` (this file, §5 T4.2)

**files_modified:** none

**acceptance_criteria:**
- All 6 UAT steps pass without unexpected errors
- Network tab confirms scalar-only Save makes exactly 1 server action POST (step 4)
- Post-step-3, Supabase admin UI shows the new group in `option_groups` table for the dish

### Wave dependency / parallelism map

```
Wave 1   T1.1 ║ T1.2 ║ T1.3             (parallel)
                       ↓
                      T1.4               (sequential after T1.1+T1.2+T1.3)
                       ↓
                      T1.5 (gate)
                       ↓
─────────────────────────────────────────
Wave 2   T2.0
            ↓
         T2.1
            ↓
         T2.2
                       ↓
─────────────────────────────────────────
Wave 3   T3.1 → T3.2 → T3.3 → T3.4
                                ↓
                              T3.5 (gate)
                                ↓
─────────────────────────────────────────
Wave 4   T4.1 ║ T4.2             (parallel)
```

---

## 6. Must-haves (goal-backward verification)

These prove the phase achieved its goal. Verify after Wave 4.

- **M1 — Editing works end-to-end.** From `/restaurants/{id}` in the admin app, an admin can add, modify, reorder, and remove modifier groups + options on any dish without going through menu-scan. (Verified by UAT §5 T4.2 steps 2, 3, 5.)
- **M2 — Atomic per-mutation.** The modifier RPC either fully replaces the dish's option_groups + options or leaves them untouched. (Verified by integration test T4.1 case 4 and by migration 144's RPC transaction semantics already proven in `admin-confirm-rpc.test.ts`.)
- **M3 — Save is gated by deep-compare.** Clean modifier draft → modifier RPC NOT invoked. (Verified by UAT T4.2 step 4 + Network-tab inspection.)
- **M4 — Audit trail intact.** Modifier saves write a `replace_dish_modifiers` row to `admin_audit_log`. (Verified by integration test T4.1 case 5.)
- **M5 — Single source of truth.** `ModifierGroupsEditor` is imported by both menu-scan and restaurant-detail paths from the same file in `apps/admin/src/components/modifiers/`. (Verified by `grep -rE "from.*ModifierGroupsEditor" apps/admin/src/` returning ≥2 lines, all pointing to `@/components/modifiers/`.)
- **M6 — No menu-scan regression.** All existing menu-scan tests still pass after the lift. (Verified by Wave 1 gate T1.5.)

---

## 7. Threat model

| Threat | Mitigation in place | New gap introduced by this change |
|---|---|---|
| Unauthorized admin write to modifier groups | `withAdminAuth` wrapper on `adminUpdateDishModifiers` (`actions/dish.ts:326`); JWT `app_metadata.role='admin'` check enforced server-side. | None. |
| Cross-restaurant write (admin patches dish belonging to a different restaurant) | Explicit `restaurantId` guard in action (`actions/dish.ts:345–351`): dish must match `restaurant_id`. | None. |
| SQL injection / over-large payload | Zod `modifierGroupSchema` (`actions/dish.ts:32–39`) caps array sizes (max 20 groups, max 50 options/group, max 200-char names, max 50-char tag values) and validates enums (`selection_type`, `primary_protein`). | None. |
| RLS bypass / privilege escalation | Action uses `createAdminServiceClient()` (service-role). Auth check is in `withAdminAuth` BEFORE service client is invoked. RPC `admin_replace_dish_modifiers` is SECURITY DEFINER (migration 144) with execute restricted to service-role grants. Same pattern as `admin_confirm_menu_scan`. | None. |
| Stale-state overwrite (admin A edits while admin B saves) | None today; last-write-wins on RPC (delete-and-replace). | **Not new** — same as existing menu-scan confirm flow. Filed observation; defer to a future optimistic-concurrency phase if user reports collisions. |
| Audit-log omission | `logAdminAction(... 'replace_dish_modifiers' ...)` fires on RPC success (`actions/dish.ts:367–375`). | Verified by M4 / T4.1 case 5. |
| CSRF on server action | Next.js server actions require the per-request token; not user-exploitable from cross-origin. | None. |

**Verdict:** No new threats introduced. The action and RPC were threat-modeled when migration 144 + the action shipped in Phase 4 of `dish-model-rewrite`. This change is UI wiring that exercises existing server-side controls.

---

## 8. Tests summary

Automated tests are embedded in §5 tasks (T1.5 menu-scan regression, T2.2 adapter units, T4.1 action integration). This section consolidates the surface for the reviewer:

- **T1.5** — Existing menu-scan tests after the lift (regression guard).
- **T2.2** — Unit tests for `adapters.ts` — round-trip, Zod conformance, `groupsEqual` true/false.
- **T4.1** — Integration tests for `adminUpdateDishModifiers` — happy path, empty groups, wrong restaurantId, schema rejection, audit log.
- **T4.2** — Manual UAT — 6 steps covering open/edit/save/empty-state/scalar-only/failure paths.

Existing menu-scan tests may need call-site updates if they invoke the deleted `apply*` wrappers from `useReviewState.ts` (T1.3 deletes them); switch any wrapper calls to the new helpers, mirroring the production refactor. No changes to `admin-confirm-rpc.test.ts` (it calls the RPC with literal payloads, unaffected by the T2.0 schema lift).

---

## 9. Rollback

Pure UI + frontend wiring; no DB changes. Rollback strategy:

1. **Same-day rollback (UI bug discovered post-deploy):** revert the §5 Wave 3 commits (T3.1–T3.5) on `DishRowEditor.tsx`. Modifier groups return to read-only display. The lifted components from Wave 1 + adapters from Wave 2 stay in place — harmless without callers; menu-scan continues to use them.
2. **Persistent rollback:** revert the entire merge. The lifted components return to `menu-scan/[jobId]/`. Migration 144 + `adminUpdateDishModifiers` stay (they were introduced by `dish-model-rewrite-phase-4-admin.md`, not by this plan; reverting them isn't in scope here).

No data migration needed in either direction.

---

## 10. Effort estimate

**0.5–1 day** end-to-end if §2 decisions land on the recommended options:

| Wave | Tasks | Estimate |
|---|---|---|
| 1 | T1.1–T1.5 (lift + import updates + menu-scan regression) | 1–2h |
| 2 | T2.0–T2.2 (schema lift + adapters + unit tests) | 1–1.5h |
| 3 | T3.1–T3.5 (wire DishRowEditor + gates) | 1–2h |
| 4 | T4.1–T4.2 (integration test + UAT) | 1–2h |
| | **Total** | **4–7h** |

The brevity is because every backend piece already exists. This is plumbing.

---

## 11. Open questions for reviewer

Confirm or override before kickoff:

1. **§2.1 L1 vs L2** — shared-component location.
2. **§2.2 S1** — single-Save semantics with deep-compare gate.
3. **§2.3 E2** — no read-only-row affordance for empty groups.
4. **§2.4** — defer the `is_default` uniqueness UI constraint to a separate ticket.

---

## 12. Deferred follow-ups

Both deferred at execution time as a deliberate scope cut; functionally complete plan ships without them.

- **T4.1 — Integration test for `adminUpdateDishModifiers`.** Marginal value: the underlying RPC has integration tests (`admin-confirm-rpc.test.ts:452+`); the Zod schema is covered by `adapters.test.ts` case 2; the wrapper's restaurantId guard follows the same pattern as other actions tested in `admin-confirm-rpc.test.ts`. What's NOT covered without T4.1: audit-log call wiring, wrapper-level error formatting. Write + run when local Supabase is set up; runtime is `npm run test:integration`.
- **T4.2 — Manual browser UAT.** Run the 6-step checklist in §5 T4.2 against `pnpm dev` (admin app on :3001). Cannot be automated — requires a real browser session.

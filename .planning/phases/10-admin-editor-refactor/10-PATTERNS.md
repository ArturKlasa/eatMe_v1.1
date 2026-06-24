# Phase 10: Admin Editor Refactor - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 1 target (`ReviewDishEditor.tsx`, 1258 lines) → 6 new files + 1 test
**Analogs found:** all in-repo (every role has a precedent in `apps/admin/` or Phase 9)

> Behavior-preserving structural decomposition only. No new behavior, no UX change, no "fix while
> here." Every excerpt below is the EXACT code to relocate; the analogs show the SHAPE the new
> files must take, not new logic to add. Payload shape stays byte-identical (SC#2).

---

## Import-Path Contract (D-01 — verify with grep, the real zero-residue gate)

ONE consumer imports the target by directory bare-name. `turbo check-types` covers admin (unlike
mobile), but the grep is still the explicit zero-residue gate:

| Consumer | Line | Import | New `index.tsx` barrel must export |
|----------|------|--------|------------------------------------|
| `AdminJobShell.tsx` | 13 | `import { ReviewDishEditor, type ExtractedDish } from './ReviewDishEditor'` | named `ReviewDishEditor` component **and** `type ExtractedDish` |

Grep confirmed: `AdminJobShell.tsx:13` is the **only** external consumer of either symbol. The current
file re-exports `export type { ExtractedDish } from './useReviewState'` (line 40) — the new
`index.tsx` MUST reproduce that exact re-export line so both symbols keep resolving from
`'./ReviewDishEditor'` with zero path changes. Converting `ReviewDishEditor.tsx` → `ReviewDishEditor/`
keeps the bare-directory import (`./ReviewDishEditor`) resolving to `index.tsx` automatically.

`ExtractedDish` originates in `useReviewState.ts:51` — the barrel re-exports, it does NOT redefine it.

---

## File Classification

| New file | Role | Data flow | Closest analog | Match |
|----------|------|-----------|----------------|-------|
| `ReviewDishEditor/index.tsx` | composition-root + barrel | orchestration | `useReviewState.ts` (barrel) + Phase 9 `index.tsx` precedent | exact |
| `ReviewDishEditor/reviewHelpers.ts` | pure-module | transform (pure args) | `modifiers/adapters.ts` + `useReviewState.ts` (barrel head) | exact |
| `ReviewDishEditor/buildConfirmPayload.ts` | pure-module | transform (pure args) | `modifiers/adapters.ts` (DAL→payload mapper) | role-match |
| `ReviewDishEditor/DishCard.tsx` | presentational | props-in / callbacks-out | `ModifierGroupsEditor.tsx` | exact |
| `ReviewDishEditor/CategorySection.tsx` | presentational | props-in / callbacks-out | `ModifierGroupsEditor.tsx` | exact |
| `ReviewDishEditor/BundledItemsBlock.tsx` | presentational (verbatim move) | props-in / callbacks-out | self (lines 1192-1258) | exact |
| `__tests__/menu-scan/buildConfirmPayload.test.ts` | test | pure-args snapshot | `__tests__/menu-scan/useReviewState.test.ts` | exact |

`DishFieldsGrid` (carving the price/portion/protein grid out of `DishCard`) is **declined by default**
(D-66 discretion / deferred) — keep `DishCard` whole unless an obvious zero-behavior sub-block emerges.
`reviewHelpers.ts` may absorb the co-located types or a sibling `types.ts` may hold them (D-05, planner
discretion).

---

## Shared Pattern: Co-located module conventions (the in-directory precedent)

**Source:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` — sits in the SAME
directory the new files land in. Mirror its conventions exactly:

```typescript
// useReviewState.ts:1-3 — client directive only on files with React hooks/JSX
'use client';
import { useState } from 'react';

// useReviewState.ts:18-29 — re-export barrel: types + factories re-exported so
// callers import from one place. The new index.tsx mirrors this for ExtractedDish.
export type { Protein, EditableModifierGroup, ... } from '@/components/modifiers/editableTypes';
export { newEmptyModifierGroup, newEmptyModifierOption } from '@/components/modifiers/editableTypes';
```

- **`'use client'` placement:** `index.tsx`, `DishCard.tsx`, `CategorySection.tsx`, `BundledItemsBlock.tsx`
  need it (hooks/JSX/event handlers). `reviewHelpers.ts` and `buildConfirmPayload.ts` are **pure — no
  `'use client'`** (they import no React). This matches `modifiers/adapters.ts` (no directive, pure).
- **Import style:** `@/`-aliased absolute imports for cross-route modules (`@/components/...`,
  `@/lib/...`, `@eatme/shared`); relative `./` only for same-directory siblings (e.g.
  `./useReviewState`, `./ScanExtrasPanel`, `../actions/menuScan`). Inside the new `ReviewDishEditor/`
  dir, the existing `'../actions/menuScan'` import depth is unchanged (dir replaces the file at the
  same level). Sibling imports become `./reviewHelpers`, `./DishCard`, etc.

---

## Shared Pattern: Presentational child (value + typed callbacks, no orchestration) — D-03

**Source:** `apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx` (lines 7-47) — the canonical
admin presentational-editor: a typed `Props` interface = data slice + `onX` callbacks, destructured in
the function signature, owning NO store/orchestration state.

```typescript
// ModifierGroupsEditor.tsx:7-29 — Props = data + callbacks, callbacks named onVerb(idx, patch)
interface Props {
  groups: EditableModifierGroup[];
  saving: boolean;
  currencyCode: string;
  onAddGroup: () => void;
  onUpdateGroup: (groupIdx: number, patch: Partial<EditableModifierGroup>) => void;
  // ...
}
export function ModifierGroupsEditor({ groups, saving, currencyCode, onUpdateGroup, ... }: Props) {
```

**Apply to:** `DishCard.tsx` and `CategorySection.tsx`. Both receive their data slice + the parent's
handlers as props; neither calls `useReviewState`, `useState`, or touches `categoryDescriptions` /
`selectedIds` / `scanTarget` directly. The parent (`index.tsx`) owns all of that (D-06) and threads
down `value` + callbacks.

---

## Pattern Assignments

### `reviewHelpers.ts` (pure-module, transform) — D-05

**Analog:** `modifiers/adapters.ts` (pure mappers, no `'use client'`, exported functions) + the
`useReviewState.ts` barrel head for the type re-exports.

**Move VERBATIM** (all pure — read only their args): `pickName` (60-62), `deriveDiningFormat` (67-72),
`asEditable` (74-160), `confidenceTone` (162-166), `getGroupKey` (168-182), `encodeCategoryValue`
(184-196), `decodeCategoryValue` (198-220).

**Inputs these pull from `@eatme/shared` / `useReviewState`** (keep the imports, just relocate):
`SupportedLanguage`, `DEFAULT_LANGUAGE`, `DiningFormat` from `@eatme/shared`; `EditableDish`,
`CategoryMode`, `ExtractedDish` from `./useReviewState`; `DishCategoryMatch` from `@/lib/auth/dal`.

> **LANDMINE L-2** (`asEditable`, line 118) — the `price_override === 0 ? null` collapse. Backstop for
> pre-zero-override-fix jobs: old scans carry `0` where `null` was meant. Move byte-for-byte and add
> `// LANDMINE — do NOT "fix"; see 10-CONTEXT.md L-2` at the new site.

```typescript
// ReviewDishEditor.tsx:115-118 — keep the collapse + its rationale comment
// Jobs scanned before the worker's zero-override backstop carry 0 where
// null was meant — collapse it here so old pending scans render an empty field…
price_override: o.price_override === 0 ? null : o.price_override,
```

> **LANDMINE L-3** (`deriveDiningFormat`, lines 67-72) — reads legacy `d.dish_kind`. `dish_kind` was
> dropped from the schema (migration 163) but `ExtractedDish` still carries it as an optional read-only
> field (`useReviewState.ts:45-50` documents exactly this) from old `result_json` blobs. Preserve the
> `course_menu`/`buffet` mapping verbatim; add `// LANDMINE — do NOT "fix"; see 10-CONTEXT.md L-3`.

```typescript
// ReviewDishEditor.tsx:67-72 — legacy dish_kind → dining_format fallback, keep verbatim
if (d.dining_format !== undefined) return d.dining_format;
if (d.dish_kind === 'course_menu') return 'course_menu';
if (d.dish_kind === 'buffet') return 'buffet';
```

`getGroupMeta` (448-477) **does NOT move here** — it closes over `existingById` / `canonicalBySlug` /
`sourceLanguage` and stays in `index.tsx` (D-05). Forcing it pure would change call sites = behavior
risk.

### `buildConfirmPayload.ts` (pure-module, transform) — D-07

**Analog:** `modifiers/adapters.ts` — the existing "editable → API payload" mapper pattern. Note
`adapters.ts:9` infers the payload type from the Zod schema (`z.infer<typeof modifierGroupSchema>`);
`buildConfirmPayload` may mirror that to type its return, or let the inline object's structural type
flow (planner discretion — but the resulting object must be byte-identical to today's inline payload).

**Extract VERBATIM** the payload assembly from `handleSave` lines 525-599 (the `category_descriptions`
de-dup loop 526-559 + the `source_language_code` / `dishes[]` object 561-599). It becomes a **pure,
exported** function receiving plain data + predicates — **no closure over component state/maps** (D-07):

- `activeDishes: EditableDish[]`
- `sourceLanguage: SupportedLanguage`
- `categoryDescriptions: Map<string, string>`
- `getGroupKey` (already pure, from `reviewHelpers.ts`)
- a `descriptionLocked` predicate OR a precomputed `getGroupMeta` result keyed by group — because
  `getGroupMeta` itself is impure (closes over maps), pass its **output**, not the function. Exact
  signature is planner discretion (D-67).

Must preserve byte-for-byte: the `category_descriptions` de-dup (`seenKeys` set, `key === 'none'`
skip), the `verbatim_name` logic (canonical mode + `suggested_category_name` → trimmed, else null), the
`!desc && !verbatim` continue, the dish field mapping (portion/dining-format/serves/bundled-items), and
the `price_override` passthrough (note: the `=== 0 → null` collapse already happened in `asEditable`
L-2; the payload passes `o.price_override` through unchanged — line 592).

```typescript
// ReviewDishEditor.tsx:545-550 — verbatim_name + desc gating, must survive identical
const verbatim =
  d.categoryMode === 'canonical' && d.suggested_category_name?.trim()
    ? d.suggested_category_name.trim()
    : null;
if (!desc && !verbatim) continue;
```

**Validation does NOT move** (D-08) — it stays in `handleSave` (it's UI-coupled: `setError` +
early-return, lines 496-522). `handleSave` becomes: validate → `buildConfirmPayload(...)` → the single
`adminConfirmMenuScan(jobId, payload)` (line 600). One builder, one submit (SC#2).

### `DishCard.tsx` (presentational) — D-03

**Analog:** `ModifierGroupsEditor.tsx` (Props = value + callbacks).

**Move:** the entire per-dish `<li>` JSX (lines 818-1182) — checkbox, name/description, the
price/portion/price-label/protein/dining-format grid (887-1034), both category controls
(`MenuCategoryCombobox` + custom-name input 1037-1067; `DishCategoryCombobox` +
`DishCategoryCreateInline` 1069-1124), `BundledItemsBlock` (1127-1133), `ModifierGroupsEditor`
(1138-1153), the per-dish `ScanExtrasPanel` (1154-1165), and the copy-modifier-groups button
(1166-1179).

**Props** (data slice + callbacks the parent owns): `dish` (the `EditableDish`), `saving`,
`currencyCode`, `currencySymbol`, `sourceLanguage`, `menuCategoryOptions`, `dishCategories`,
`dishCategoryById`, `selectedIds`-membership (pass `selected: boolean` + `selectedActiveIds` info for
the copy button's count), `scanTarget` (for this dish), and the callbacks: `onUpdate` (→ `update`),
`onToggleDelete`, `onToggleSelected`, `onActiveImageIndexChange`, the modifier-group handlers (thread
through to `ModifierGroupsEditor`), the bundled-item handlers, `onCopyGroups`, `onScanFromImage`,
`onScannedExtrasAttach`, `onDishCategoryCreated`. Keep `encodeCategoryValue`/`decodeCategoryValue`
calls (now imported from `./reviewHelpers`) and `confidenceTone` at the call sites.

> **Integration point — MUST survive the move:** the `<li>`'s `onFocusCapture` / `onMouseDown` both
> fire `onActiveImageIndexChange?.(d.source_image_index)` (lines 821-822) to sync the parent-owned
> `SourceImageStrip` in `AdminJobShell`. `DishCard` must receive `onActiveImageIndexChange` as a prop
> and wire BOTH handlers exactly as today. Do NOT move/recreate `SourceImageStrip` (it lives in the
> parent — D-02; there is no "DishImagePanel" in this file).

`uses isSuspiciouslyHighPrice` / `priceWarnMessage` (`@/lib/priceWarnings`), `DINING_FORMAT_META`,
`DINING_FORMATS`, `PRIMARY_PROTEINS` from `@eatme/shared` — relocate those imports into `DishCard.tsx`.

### `CategorySection.tsx` (presentational) — D-03

**Analog:** `ModifierGroupsEditor.tsx`.

**Move:** the per-group `<section>` header (lines 740-815): display name + badge, the "Merge into…"
dropdown (756-780), the Select-all/Deselect-all button (781-791), and the locked/editable section
description textarea (794-814). The `<section>` wraps the `<ul>` of `DishCard`s; planner decides whether
`CategorySection` renders its `DishCard` children (passed as a prop / `children`) or whether `index.tsx`
maps them — keep render structure identical either way.

**Props:** `meta` (the `getGroupMeta` result: `displayName` / `descriptionLocked` / `badge`),
`mergeTargets` (with their `getGroupMeta` results for the dropdown labels — line 772 calls
`getGroupMeta` per target), `hasActiveDishes`, `saving`, `sourceLanguage`, `description` value, the
group's dishes count/selection state, and callbacks `onMergeGroup`, `onToggleGroupSelection`,
`onUpdateGroupDescription`. Because `getGroupMeta` is impure (closure), `index.tsx` calls it and passes
**results** down — `CategorySection` stays presentational.

> **LANDMINE L-5** (`groups` memo, lines 437-441) — stays in `index.tsx` (it's orchestration), but note
> it for render order: the `'none'` bucket is spliced to the END of the group order. The mapping over
> `groups` that renders `CategorySection`s must preserve that order. Add
> `// LANDMINE — do NOT "fix"; see 10-CONTEXT.md L-5` at the memo.

### `BundledItemsBlock.tsx` (presentational, verbatim move) — D-04

**Analog:** self. Move byte-for-byte: the `BundledBlockProps` interface (1192-1198) + the
`BundledItemsBlock` function (1200-1258). It already follows the presentational pattern (props = `dish`
+ `saving` + `onAdd`/`onRemove`/`onUpdate`). Add `'use client'` (it has event handlers). No logic
change. `DishCard.tsx` imports it from `./BundledItemsBlock`.

### `index.tsx` (composition-root + barrel) — D-01 / D-06

**Analog:** `useReviewState.ts` (barrel) + Phase 9's `index.tsx` composition-root precedent.

**KEEPS (orchestration — D-06):** `currencySymbol`; all the lookup memos (`canonicalSlugSet`,
`canonicalBySlug`, `existingById`, `matchByQuery`, `dishCategoryById`, lines 234-259); `dishCategories`
state; `sourceLanguage` state + `countryDerivedLang`; `menuCategoryOptions` memo (264-284); the
`useReviewState(...)` call (286-311); `categoryDescriptions` state (313-333); `saving`/`error` state;
`activeDishes`/`deletedCount` memos; bulk-copy selection (`selectedIds`/`toggleSelected`/
`toggleGroupSelection`/`selectedActiveIds`/`handleCopyGroups`, 344-377); category merge
(`groupCategoryPatch`/`handleMergeGroup`, 382-403); scan-target (`scanTarget`/`handleScannedExtrasAttach`,
409-420); `detectedDiffers`; the `groups` memo (427-446); `getGroupMeta` (448-477);
`updateGroupDescription` (479-486); `handleDishCategoryCreated` (488-494); `handleSave` validation +
the single submit (496-608, now calling `buildConfirmPayload`); the outer JSX shell (610-728) and the
`groups.map(...)` that now renders `<CategorySection>` + `<DishCard>` children.

**Barrel:** the named `export function ReviewDishEditor(...)` stays the default composition root, PLUS
reproduce `export type { ExtractedDish } from './useReviewState'` (current line 40) so `AdminJobShell.tsx:13`
resolves unchanged.

> **LANDMINE L-1** (lines 305-310) — the `useReviewState(useMemo(() => initialDishes.map(...), []))`
> with **empty deps + `eslint-disable react-hooks/exhaustive-deps`**. Stays in `index.tsx`. Keep the
> empty `[]` deps + the disable + the "initial only — recomputing on prop change would clobber edits"
> comment EXACTLY. Do NOT add `initialDishes` to deps. (`asEditable` now imported from `./reviewHelpers`,
> but the call site stays identical.)

```typescript
// ReviewDishEditor.tsx:305-310 — empty-deps initializer, do NOT add initialDishes
useMemo(
  () => initialDishes.map((d, i) => asEditable(d, i, canonicalSlugSet, matchByQuery)),
  // initial only — recomputing on prop change would clobber edits
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []
)
```

> **LANDMINE L-4** (lines 313-333) — the `categoryDescriptions` **lazy `useState` initializer**
> (one-time seed from existing-category descriptions + `suggested_category_description`). Stays in
> `index.tsx` verbatim. Keep the lazy `() => { ... }` form (NOT a plain initial value + effect — that
> would change seeding behavior). Add `// LANDMINE — do NOT "fix"; see 10-CONTEXT.md L-4`.

---

## Pattern Assignment — Test

### `__tests__/menu-scan/buildConfirmPayload.test.ts` (test) — D-10

**Analog:** `apps/admin/src/__tests__/menu-scan/useReviewState.test.ts` — same dir, same vitest
conventions. Copy its structure exactly:

```typescript
// useReviewState.test.ts:1-11 — imports: vitest + the pure fns from @/-aliased source
import { describe, it, expect } from 'vitest';
import { type EditableDish } from '@/app/(admin)/menu-scan/[jobId]/useReviewState';
```

```typescript
// useReviewState.test.ts:28-57 — makeDish() factory with full EditableDish defaults + overrides.
// REUSE this exact factory shape (copy it) so the snapshot test builds representative dishes.
function makeDish(overrides: Partial<EditableDish> = {}): EditableDish { return { /* all fields */ }; }
```

**Test must** import `buildConfirmPayload` from `@/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/buildConfirmPayload`,
build an `EditableDish[]` exercising: modifier groups (+ options), all three category modes
(custom / canonical / existing), bundled items, `portion_amount`/`portion_unit`, a non-null
`dining_format`, and the `price_override === 0 → null` case (note: that collapse is in `asEditable`,
so to exercise it via `buildConfirmPayload` either feed a dish whose option already has `price_override:
null` post-collapse, OR add a focused `asEditable` unit case in `reviewHelpers` — planner's call). Assert
the exact payload object via **inline snapshot** (`toMatchInlineSnapshot`). This is the durable
shape-regression proof (D-09: `admin-confirm-rpc.test.ts` does NOT exercise the component, so it can't
prove the payload is unchanged).

---

## Commit Discipline (SC#3)

**One refactor per commit** for a clean bisect — do NOT batch. Suggested independently-revertable order
(each keeps `turbo check-types` + tests green):

1. Convert file → `ReviewDishEditor/index.tsx` directory (barrel intact, no other change).
2. Extract `reviewHelpers.ts` (pure helpers move).
3. Extract `buildConfirmPayload.ts` + add the snapshot test (D-10).
4. Move `BundledItemsBlock.tsx` (verbatim).
5. Extract `CategorySection.tsx`.
6. Extract `DishCard.tsx`.

---

## Verification Gate

- **Types:** `turbo check-types` (admin IS covered — unlike mobile). Must stay green.
- **Tests:** `cd apps/admin && npx vitest run` — keep `useReviewState.test.ts` +
  `admin-confirm-rpc.test.ts` green; the new `buildConfirmPayload.test.ts` snapshot is the payload proof.
- **Zero-residue grep:** `grep -rn "ReviewDishEditor\|ExtractedDish" apps/admin/src` — only
  `AdminJobShell.tsx:13` should reference the import path, and it must resolve to the new `index.tsx`.
- **Operator in-browser save (D-11)** — the authoritative end-to-end gate: load a real `needs_review`
  job, edit, Save, confirm job → `completed` + dishes/groups persisted. Agent cannot run this.

---

## No Analog Found

None. Every new file has an in-repo precedent:

| File | Precedent |
|------|-----------|
| `index.tsx` | `useReviewState.ts` barrel + Phase 9 `index.tsx` composition root |
| `reviewHelpers.ts` / `buildConfirmPayload.ts` | `modifiers/adapters.ts` (pure mappers, no `'use client'`) |
| `DishCard.tsx` / `CategorySection.tsx` | `ModifierGroupsEditor.tsx` (presentational props+callbacks) |
| `BundledItemsBlock.tsx` | self (verbatim) |
| `buildConfirmPayload.test.ts` | `useReviewState.test.ts` (same dir, vitest conventions) |

---

## Metadata

**Analog search scope:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/`, `apps/admin/src/components/modifiers/`,
`apps/admin/src/__tests__/menu-scan/`.
**Files scanned:** `ReviewDishEditor.tsx` (full), `AdminJobShell.tsx:13` (consumer grep),
`useReviewState.ts` (head), `ModifierGroupsEditor.tsx` (head), `modifiers/adapters.ts` (head),
`__tests__/menu-scan/useReviewState.test.ts` (head).
**Landmines anchored:** L-1 (305-310 → index.tsx), L-2 (118 → reviewHelpers), L-3 (67-72 → reviewHelpers),
L-4 (313-333 → index.tsx), L-5 (437-441 → index.tsx). Each gets a `// LANDMINE — do NOT "fix"; see
10-CONTEXT.md L-N` guard comment at its new site (D-11 doctrine; a comment is not a behavior change).

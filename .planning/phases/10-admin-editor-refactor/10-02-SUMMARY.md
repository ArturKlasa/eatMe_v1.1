---
phase: 10-admin-editor-refactor
plan: 02
subsystem: admin-menu-scan-editor
tags: [refactor, behavior-preserving, presentational-children, RFCT-04]
status: complete
requires:
  - "ReviewDishEditor/index.tsx (Plan 01 composition root + barrel)"
  - "reviewHelpers.ts (Plan 01 pure helpers — confidenceTone/encodeCategoryValue/decodeCategoryValue consumed by DishCard)"
  - "useReviewState.ts (dish-CRUD owner — unchanged)"
  - "ModifierGroupsEditor.tsx (presentational analog + reused collaborator — unchanged)"
provides:
  - "BundledItemsBlock.tsx (verbatim presentational block, 'use client', imported by DishCard)"
  - "CategorySection.tsx (per-group <section>+<header> presentational; props in, callbacks out)"
  - "DishCard.tsx (whole per-dish <li> presentational; onActiveImageIndexChange wiring preserved)"
  - "slimmed index.tsx orchestration root threading value+callbacks to CategorySection/DishCard"
affects:
  - "AdminJobShell.tsx (consumer — byte-unchanged; import path + SourceImageStrip untouched)"
tech-stack:
  added: []
  patterns:
    - "presentational child (typed Props = data slice + onX callbacks, no orchestration state) — ModifierGroupsEditor analog"
    - "impure getGroupMeta stays in index.tsx; its RESULTS (meta, mergeTargets labels) threaded down as props"
    - "CategorySection receives the dish <ul> as children so render structure stays identical"
    - "alias const d = props.dish so the moved <li> JSX stays byte-identical"
key-files:
  created:
    - "apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/BundledItemsBlock.tsx"
    - "apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/CategorySection.tsx"
    - "apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/DishCard.tsx"
  modified:
    - "apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/index.tsx"
decisions:
  - "D-03: BundledItemsBlock/CategorySection/DishCard are presentational (props in, typed callbacks out); no hooks, no orchestration state"
  - "D-04: BundledItemsBlock moved verbatim into its own 'use client' file; DishCard imports it"
  - "D-05: getGroupMeta stays impure in index.tsx; mergeTargets labels (m.badge ? `${name} · ${badge}` : name) resolved in index.tsx and passed down"
  - "D-06: index.tsx keeps all orchestration — useReviewState, selectedIds, scanTarget, categoryDescriptions, getGroupMeta, validation, single submit, L-1/L-4/L-5"
  - "L-1/L-4/L-5 guard markers added at their existing index.tsx sites (no behavior change)"
metrics:
  duration: ~25 min
  completed: 2026-06-24
  tasks: 3
  files: 4
---

# Phase 10 Plan 02: ReviewDishEditor Presentational Children Summary

Behavior-preserving extraction of the three presentational children — `BundledItemsBlock` (verbatim move), `CategorySection` (per-group `<section>`+`<header>`), and `DishCard` (whole per-dish `<li>`) — leaving `index.tsx` as the orchestration composition root that threads `value` + typed callbacks down. The `onActiveImageIndexChange` wiring, the `'none'`-bucket-last render order (L-5), and every collaborator (`ModifierGroupsEditor`, `ScanExtrasPanel`, the three comboboxes) stay wired identically; the `admin_confirm_menu_scan` payload stays byte-identical (all payload-shaping remains in `index.tsx` + `buildConfirmPayload`).

## What Was Built

Three atomic, independently-revertable commits (SC#3):

1. **`ae284b9`** — `refactor(10-02): move BundledItemsBlock to its own file (verbatim)`. Moved the `BundledBlockProps` interface + `BundledItemsBlock` function byte-for-byte into a new `'use client'` `BundledItemsBlock.tsx` (imports `type EditableDish` from `../useReviewState`, exports the function). `index.tsx` imports it from `./BundledItemsBlock`; the call site inside the dish `<li>` was unchanged at this step (it moved into DishCard in commit 3).
2. **`7f2187f`** — `refactor(10-02): extract CategorySection (per-group header)`. New `'use client'` `CategorySection.tsx` renders `<section><header>…</header>{children}</section>` presentationally — display name + badge, the "Merge into…" `<select>`, Select-all/Deselect-all button, locked/editable description textarea. `index.tsx` precomputes `meta`, `mergeTargets` (with `{key,label}` labels — the impure `getGroupMeta` per target resolved here), `dishCount`, `hasActiveDishes`, `allSelected`, `desc` and passes them down + the three callbacks (`onMergeGroup`/`onToggleGroupSelection`/`onUpdateGroupDescription`). The dish `<ul>` is passed as `children`. Added the `// LANDMINE L-5` marker above the `groups` memo's `order.indexOf('none')` line.
3. **`6a3413d`** — `refactor(10-02): extract DishCard (whole per-dish li)`. New `'use client'` `DishCard.tsx` renders the entire per-dish `<li>` via `export function DishCard(props)` with a `const d = props.dish` alias so the moved JSX stays byte-identical. Relocated the DishCard-only imports (`PRIMARY_PROTEINS`/`DINING_FORMATS`/`DINING_FORMAT_META`/`DiningFormat` from `@eatme/shared`; `isSuspiciouslyHighPrice`/`priceWarnMessage`; `MenuCategoryCombobox`+`type MenuCategoryOption`; `DishCategoryCombobox`; `DishCategoryCreateInline`; `ModifierGroupsEditor`; `ScanExtrasPanel`; `BundledItemsBlock`; `encodeCategoryValue`/`decodeCategoryValue`/`confidenceTone` from `./reviewHelpers`). `index.tsx` maps `group.dishes` to `<DishCard d={d} … />`, binding every callback to the orchestration owner (`onUpdate`→`update(d._id,…)`, `onToggleDelete`, `onToggleSelected`, `onActiveImageIndexChange`, `onScanFromImage`, `scanTargetForThisDish`, `onScannedExtrasAttach`, `onScanClose`, `onCopyGroups`, `onDishCategoryCreated`, and the modifier/bundled handlers each closing over `d._id`). Added the `// LANDMINE L-1` and `// LANDMINE L-4` markers. Trimmed the now-unused imports out of `index.tsx`.

## Integration Point Preserved

The dish `<li>`'s `onFocusCapture={() => onActiveImageIndexChange?.(d.source_image_index)}` AND `onMouseDown={() => onActiveImageIndexChange?.(d.source_image_index)}` both moved into DishCard and fire `props.onActiveImageIndexChange?.(dish.source_image_index)` exactly as before — both handlers, on the `<li>`. This is the side channel that syncs the parent-owned `SourceImageStrip` in `AdminJobShell`. `SourceImageStrip` was NOT moved or recreated (D-02 — it lives in the parent); `AdminJobShell.tsx` is byte-unchanged.

## Landmines Preserved

- **L-1** (`useReviewState(useMemo(() => initialDishes.map(...), []))` empty deps + `eslint-disable react-hooks/exhaustive-deps` + the "initial only — recomputing on prop change would clobber edits" comment) — unchanged in `index.tsx`; added `// LANDMINE L-1 — empty deps intentional; do NOT add initialDishes; see 10-CONTEXT.md`.
- **L-4** (`categoryDescriptions` lazy `useState(() => {…})` one-time seed) — kept the lazy form; added `// LANDMINE L-4 — lazy one-time seed; do NOT convert to initial-value + effect; see 10-CONTEXT.md`.
- **L-5** (`groups` memo splicing the `'none'` bucket to the END) — unchanged; added `// LANDMINE L-5 — 'none' bucket pushed last; preserves render order; do NOT reorder; see 10-CONTEXT.md`. The `groups.map` render order still flows from this memo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Trimmed index.tsx imports that became unused after the DishCard move**
- **Found during:** Task 3.
- **Issue:** Moving the per-dish `<li>` into DishCard left ~12 imports unreferenced in `index.tsx` (`PRIMARY_PROTEINS`, `DINING_FORMATS`, `DINING_FORMAT_META`, `DiningFormat`, `isSuspiciouslyHighPrice`, `priceWarnMessage`, `DishCategoryCombobox`, `MenuCategoryCombobox`, `DishCategoryCreateInline`, `ModifierGroupsEditor`, `BundledItemsBlock`, `confidenceTone`, `encodeCategoryValue`, `decodeCategoryValue`, `PricePrefix`, `Protein`). The admin `tsc` config does not enforce `noUnusedLocals`, so these would not fail check-types but are dead code.
- **Fix:** Removed the genuinely-unused imports; KEPT the still-referenced ones — `type MenuCategoryOption` (the `menuCategoryOptions` memo), `ScanExtrasPanel` (the selection-level panel in the outer JSX), `EditableDish` (`toggleGroupSelection`/`groupCategoryPatch` signatures), `pickName`/`asEditable`/`getGroupKey` (still used). Verified clean with `eslint` (no unused-import warnings) on all four files.
- **Files modified:** `ReviewDishEditor/index.tsx`
- **Commit:** `6a3413d`

### Verify-line nuance (not a deviation in behavior — noted for the verifier)

The Task 3 `<automated>` verify line includes `! grep -q "useReviewState" DishCard.tsx`. DishCard is genuinely presentational — it calls **no** hook (`grep -c "useReviewState(" → 0`, `useState(` → 0) and references **none** of `selectedIds`/`categoryDescriptions`/`scanTarget` (all → 0). The single `useReviewState` string in DishCard is a **type-only import** (`type EditableDish`/`PricePrefix`/`ExtractedBundledItem`/`ExtractedModifierGroup`/`EditableModifierGroup`/`EditableModifierOption`), because those types are defined in / re-exported from `useReviewState.ts` and that is their only canonical home — the exact same pattern Plan 01's `reviewHelpers.ts` already uses (`import { type EditableDish } from '../useReviewState'`). The acceptance criterion's stated intent ("DishCard does NOT call `useReviewState`, `useState`, or reference `selectedIds`/`categoryDescriptions`/`scanTarget`") is fully met; the literal substring grep cannot distinguish a hook call from a type import. Kept the convention-matching type import rather than fragmenting type sources purely to dodge the grep. The `<DishCard` / `LANDMINE L-1` / `LANDMINE L-4` / `react-hooks/exhaustive-deps` / lazy-`useState` index.tsx checks all pass.

No architectural (Rule 4) changes. No authentication gates. No package installs.

## Verification

- `turbo check-types` (via `pnpm turbo check-types`) exits 0 at HEAD (admin + web-portal-v2 + ui green).
- `cd apps/admin && npx vitest run` → 18 files, 169 tests passing (incl. `buildConfirmPayload.test.ts`, `admin-confirm-rpc.test.ts`, `useReviewState.test.ts`).
- `eslint` clean on `index.tsx`/`DishCard.tsx`/`CategorySection.tsx`/`BundledItemsBlock.tsx` (no unused-import / hooks-deps warnings).
- Zero-residue consumer grep: `grep -rn "from './ReviewDishEditor'" apps/admin/src` returns only `AdminJobShell.tsx:13`.
- `onActiveImageIndexChange` (onFocusCapture + onMouseDown firing `source_image_index`) present in `DishCard.tsx`; `AdminJobShell.tsx` byte-unchanged (`SourceImageStrip` untouched).
- L-1/L-4/L-5 guard markers present in `index.tsx`.
- Each task is one atomic, independently-revertable commit (SC#3). No accidental file deletions.

## Resulting Shape

- `index.tsx` — 577 lines (orchestration root + barrel).
- `DishCard.tsx` — 466 lines (whole per-dish `<li>`).
- `CategorySection.tsx` — 112 lines (per-group header).
- `BundledItemsBlock.tsx` — 71 lines (verbatim move).

## Known Stubs

None. (Form `placeholder=` attributes are pre-existing UI text, not code stubs.)

## Threat Surface

No new surface. Behavior-preserving relocation of presentational JSX into typed props-in/callbacks-out children (T-10-04 mitigated — all payload-shaping stays in `index.tsx` + `buildConfirmPayload`, guarded by the Plan 01 inline-snapshot test + check-types). No package installs (T-10-05 N/A). The `onActiveImageIndexChange` UI-sync channel is unchanged (T-10-06 — non-sensitive source-image index only).

## Operator Follow-up (D-11)

The authoritative end-to-end gate remains owned by the operator and tracked for Phase 10 close: load a real `needs_review` job in the admin portal (port 3001), edit dishes/categories/modifier-groups, hit Save, confirm the job → `completed` with dishes/groups persisted. Agent-side proofs (check-types + snapshot + full suite green + zero-residue grep + AdminJobShell byte-unchanged) are complete.

## Self-Check: PASSED

All three created files exist on disk (BundledItemsBlock.tsx, CategorySection.tsx, DishCard.tsx); index.tsx modified; all three task commits (ae284b9, 7f2187f, 6a3413d) present in git history.

---
phase: 10-admin-editor-refactor
reviewed: 2026-06-24T07:10:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/index.tsx
  - apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/reviewHelpers.ts
  - apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/buildConfirmPayload.ts
  - apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/BundledItemsBlock.tsx
  - apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/CategorySection.tsx
  - apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/DishCard.tsx
  - apps/admin/src/__tests__/menu-scan/buildConfirmPayload.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-24T07:10:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** clean

## Summary

Phase 10 is a behavior-preserving decomposition (RFCT-04) of the 1258-line
`ReviewDishEditor.tsx` monolith into a `ReviewDishEditor/` directory: a
composition-root `index.tsx`, pure `reviewHelpers.ts` / `buildConfirmPayload.ts`,
and three presentational components (`DishCard`, `CategorySection`,
`BundledItemsBlock`). The governing invariant — a byte-identical
`admin_confirm_menu_scan` payload through a single `adminConfirmMenuScan` submit
path — holds.

I verified the refactor adversarially by extracting the pre-refactor monolith
(`git show 0b887e6^:…/ReviewDishEditor.tsx`) and diffing every moved region
against its new home:

- **`buildConfirmPayload`** — byte-for-byte identical to the old inline
  `categoryDescriptionsPayload` loop + `payload` literal (old lines 526-600).
  The `none`/`seenKeys` skip, `descriptionLocked` gating, `verbatim_name`
  derivation, and per-dish/group/option field order all match. The inline
  snapshot test passes (2/2).
- **`reviewHelpers.ts`** (`pickName`, `deriveDiningFormat`, `asEditable`,
  `confidenceTone`, `getGroupKey`, `encode/decodeCategoryValue`) — identical to
  old lines 60-215, including all three landmines (L-2 `0 -> null` collapse,
  L-3 legacy `dish_kind` mapping).
- **`DishCard`** — the `<li>` JSX is identical to old lines 818-1190. Every
  callback that previously closed over `update(d._id, …)` / `toggleSelected(d._id)`
  / `setScanTarget(…)` is now threaded as a prop and re-wired at the call site in
  `index.tsx` with the correct `d._id` binding (e.g. `onUpdate={patch =>
  update(d._id, patch)}`, `onToggleSelected={() => toggleSelected(d._id)}`,
  `onScanFromImage={() => setScanTarget({ kind: 'dish', dishId: d._id })}`). No
  mis-wired or dropped handler.
- **`CategorySection`** — header JSX identical to old lines 740-818. The
  `Select all` disabled/label predicates were refactored from inline
  `group.dishes.every(d => d._deleted)` / `.filter(...).every(...)` into the
  `hasActiveDishes` / `allSelected` props, and the boolean algebra is
  equivalent. `mergeTargets` label resolution (badge suffix) is preserved.
- **`BundledItemsBlock`** — identical to old lines 1200-1258.
- **`index.tsx`** — `getGroupMeta`, `updateGroupDescription`,
  `handleDishCategoryCreated`, `handleSave` (try/finally, no `catch`),
  `groups` memo (L-5 `none`-last), and both `ScanExtrasPanel` (selection + dish)
  wirings are byte-identical. `getGroupMeta` / `getGroupKey` are passed by
  reference into `buildConfirmPayload`; both are re-derived per render and
  invoked synchronously inside `handleSave`, so the closure semantics (capturing
  current `existingById` / `sourceLanguage` / `dishes`) are unchanged.

Gates: `npx tsc --noEmit` on `apps/admin` reports **0 errors**; the
`buildConfirmPayload` + `asEditable` L-2 tests pass; no `console.*`, `debugger`,
`TODO/FIXME`, or `as any` artifacts in the new modules. The barrel import
`./ReviewDishEditor` resolves to `index.tsx` and re-exports `ExtractedDish`, which
`AdminJobShell.tsx` consumes unchanged. All extracted helpers retain live
callers.

No bugs, security issues, or payload-shape drift found. The two Info items below
are observations, not defects.

## Info

### IN-01: `ExtractedDish` re-exported from index but DishCard imports `ExtractedBundledItem`/`ExtractedModifierGroup` only from `../useReviewState`

**File:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/index.tsx:32`
**Issue:** `index.tsx` re-exports `ExtractedDish` from `../useReviewState` to keep
`AdminJobShell`'s `import { ReviewDishEditor, type ExtractedDish } from
'./ReviewDishEditor'` working. This is correct and intentional, but the type now
has two public surfaces (`../useReviewState` and the barrel). This is benign for
a single-consumer module; flagged only so a future reader doesn't assume the
barrel is the canonical type home. No action required.
**Fix:** None needed. If consolidation is ever desired, point `AdminJobShell` at
`../useReviewState` directly and drop the re-export.

### IN-02: `getGroupMeta` / `getGroupKey` recreated every render and passed into the pure assembler

**File:** `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/index.tsx:281-310, 359-365`
**Issue:** `getGroupMeta` is a fresh function object on every render (matches the
pre-refactor monolith — not a regression). Because it is only invoked
synchronously inside `handleSave` and `groups.map`, there is no staleness or
referential-identity hazard today. Noted purely so a future change that passes
`getGroupMeta` into a memoized child or effect dependency array is aware it is
not stable.
**Fix:** None needed for current behavior. Wrap in `useCallback` only if it later
feeds a memo boundary.

---

_Reviewed: 2026-06-24T07:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

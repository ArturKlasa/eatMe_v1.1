---
phase: 10-admin-editor-refactor
plan: 01
subsystem: admin-menu-scan-editor
tags: [refactor, behavior-preserving, pure-modules, snapshot-test, RFCT-04]
status: complete
requires:
  - "ReviewDishEditor.tsx (1258-line monolith, the RFCT-04 target)"
  - "useReviewState.ts (dish-CRUD owner — unchanged)"
provides:
  - "ReviewDishEditor/ directory + index.tsx barrel (re-exports ReviewDishEditor + type ExtractedDish)"
  - "reviewHelpers.ts (7 pure transform helpers, importable by Plan 02 children)"
  - "buildConfirmPayload.ts (pure, exported, byte-identical confirm-payload builder)"
  - "buildConfirmPayload.test.ts (D-10 inline-snapshot payload-shape regression proof)"
affects:
  - "AdminJobShell.tsx (consumer — import path unchanged, resolves to index.tsx)"
tech-stack:
  added: []
  patterns:
    - "directory + index.tsx barrel (Phase 8/9 doctrine, carried to admin browser surface)"
    - "pure modules with no 'use client' (modifiers/adapters.ts analog)"
    - "getGroupMeta passed as a callback so buildConfirmPayload stays pure (no component-state closure)"
    - "inline-snapshot payload regression proof (vitest toMatchInlineSnapshot)"
key-files:
  created:
    - "apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/index.tsx"
    - "apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/reviewHelpers.ts"
    - "apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/buildConfirmPayload.ts"
    - "apps/admin/src/__tests__/menu-scan/buildConfirmPayload.test.ts"
  modified:
    - "(ReviewDishEditor.tsx removed via rename into ReviewDishEditor/index.tsx)"
decisions:
  - "D-01: ReviewDishEditor.tsx -> ReviewDishEditor/ directory; index.tsx is BOTH composition root AND re-export barrel"
  - "Import-depth deviation (Rule 3): the directory nests one level deeper than the old file, so the plan's claim that ./useReviewState / ../actions stay unchanged was wrong — bumped ./ -> ../ and ../ -> ../.. for relative imports (the @/-aliased ones stayed)"
  - "D-05: 7 pure helpers moved verbatim to reviewHelpers.ts; deriveDiningFormat stays internal to that module (only asEditable calls it)"
  - "D-07/D-08: buildConfirmPayload is pure + exported; handleSave is validate -> build -> single submit; getGroupMeta passed in as a callback"
  - "D-10: inline-snapshot test locks the payload shape across all 3 category modes + modifier groups + bundled items + portion + dining_format + locked-desc skip + L-2 collapse"
metrics:
  duration: ~6 min
  completed: 2026-06-24
  tasks: 3
  files: 4
---

# Phase 10 Plan 01: ReviewDishEditor Pure-Module Foundation Summary

Behavior-preserving decomposition of the 1258-line `ReviewDishEditor.tsx` into a `ReviewDishEditor/` directory + barrel plus two pure modules (`reviewHelpers.ts`, `buildConfirmPayload.ts`) and a D-10 inline-snapshot test that locks the `admin_confirm_menu_scan` payload byte-identical — the foundation Plan 02's presentational children build on.

## What Was Built

Three atomic, independently-revertable commits (SC#3):

1. **`0b887e6`** — `ReviewDishEditor.tsx` → `ReviewDishEditor/index.tsx` (git rename, byte-for-byte content, composition root + barrel). The bare-directory import `from './ReviewDishEditor'` in `AdminJobShell.tsx:13` resolves to `index.tsx` unchanged; the barrel re-exports `ReviewDishEditor` (named) + `type ExtractedDish`.
2. **`ea2599e`** — extracted the seven pure helpers (`pickName`, `deriveDiningFormat`, `asEditable`, `confidenceTone`, `getGroupKey`, `encodeCategoryValue`, `decodeCategoryValue`) into `reviewHelpers.ts` (pure, no `'use client'`). L-2 and L-3 preserved byte-for-byte with guard markers.
3. **`f2a9bdd`** — extracted the `handleSave` payload assembly into pure exported `buildConfirmPayload(args)`; `handleSave` is now validate → build → single `adminConfirmMenuScan(jobId, payload)`. Added the D-10 inline-snapshot test (+ a focused `asEditable` L-2 case).

## Landmines Preserved

- **L-2** (`asEditable`, `price_override === 0 ? null` collapse) — moved verbatim into `reviewHelpers.ts` with its rationale comment + new `// LANDMINE L-2 — do NOT "fix"...` marker. Proven exercised by a focused `asEditable` unit test (`price_override: 0` input → `null` output).
- **L-3** (`deriveDiningFormat`, legacy `d.dish_kind === 'course_menu' / 'buffet'` mapping) — moved verbatim with a `// LANDMINE L-3 ...` marker.
- **L-1** (`useReviewState(useMemo(() => initialDishes.map((d,i) => asEditable(...)), []))` empty-deps + eslint-disable) — stayed in `index.tsx`; `asEditable` now imported from `./reviewHelpers`, call site byte-for-byte unchanged.
- **L-4** (lazy `categoryDescriptions` `useState` initializer) and **L-5** (`groups` memo `'none'`-to-end) — untouched in `index.tsx` (orchestration stays per D-06; their guard-comment additions are Plan 02 scope since those blocks weren't relocated here).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Relative-import depth bumped one level after the directory move**
- **Found during:** Task 1 (first `turbo check-types` run produced ~20 implicit-`any` / cannot-find-name errors)
- **Issue:** The plan's action step 3 asserted `../actions/menuScan`, `./useReviewState`, `./ScanExtrasPanel` stay unchanged "because the dir replaces the file at the same level." That is incorrect — `index.tsx` lives one directory deeper than the old `ReviewDishEditor.tsx`, so its sibling references broke (`./useReviewState` pointed at the non-existent `ReviewDishEditor/useReviewState`).
- **Fix:** Bumped relative imports by one level — `./useReviewState` → `../useReviewState`, `./ScanExtrasPanel` → `../ScanExtrasPanel`, `../actions/menuScan` → `../../actions/menuScan`, and the barrel re-export `export type { ExtractedDish } from '../useReviewState'`. The `@/`-aliased imports (`@eatme/shared`, `@/lib/...`, `@/components/...`) stayed unchanged. The bare-directory consumer import in `AdminJobShell.tsx` is unaffected.
- **Files modified:** `ReviewDishEditor/index.tsx`
- **Commit:** `0b887e6`

**2. [Rule 3 - Blocking] Trimmed then restored imports that became / stayed referenced after the helper extraction**
- **Found during:** Task 2
- **Issue:** Removing the seven helpers from `index.tsx` left `DEFAULT_LANGUAGE`, `CategoryMode`, `deriveDiningFormat` unused (TS6133 / lint), but `DishCategoryMatch` and `SupportedLanguage`/`DiningFormat` were still referenced in the `Props` interface / JSX body. An initial over-trim of `DishCategoryMatch` (a line-offset scan started below the `Props` interface) tripped TS2552; restored it.
- **Fix:** Removed only the genuinely-unused `DEFAULT_LANGUAGE` + `CategoryMode` imports and the unused `deriveDiningFormat` from the `./reviewHelpers` import (it's internal to that module); kept `DishCategoryMatch`, `SupportedLanguage`, `DiningFormat`.
- **Files modified:** `ReviewDishEditor/index.tsx`
- **Commit:** `ea2599e`

No architectural (Rule 4) changes. No authentication gates. No package installs.

## Verification

- `turbo check-types` exits 0 (admin + web-portal-v2 green) at HEAD.
- `cd apps/admin && npx vitest run` → 18 files, 169 tests passing (incl. `admin-confirm-rpc.test.ts`, `useReviewState.test.ts`, and the new `buildConfirmPayload.test.ts` snapshot).
- Zero-residue grep: `grep -rn "from './ReviewDishEditor'" apps/admin/src` returns only `AdminJobShell.tsx:13`.
- Each task is one atomic, independently-revertable commit.

## Threat Surface

No new surface. Behavior-preserving refactor of an existing authenticated admin browser component; the `admin_confirm_menu_scan` payload is locked byte-identical by the inline-snapshot test (T-10-01 mitigated) and the single submit path is preserved. No new inputs, auth boundary, or network calls (T-10-03 unchanged). No package installs (T-10-02 N/A).

## Known Stubs

None. (Form `placeholder=` attributes in the JSX are pre-existing UI text, not code stubs.)

## Operator Follow-up (D-11)

The authoritative end-to-end gate — operator loads a real `needs_review` job in the admin portal (port 3001), edits, hits Save, confirms job → `completed` with dishes/groups persisted — is owned by the operator and tracked for Phase 10 close. Agent-side proofs (check-types + snapshot + suite green + zero-residue grep) are complete.

## Self-Check: PASSED

All created files exist on disk (index.tsx, reviewHelpers.ts, buildConfirmPayload.ts, buildConfirmPayload.test.ts, 10-01-SUMMARY.md); old ReviewDishEditor.tsx removed; all three task commits (0b887e6, ea2599e, f2a9bdd) present in git history.

---
phase: 10-admin-editor-refactor
plan: 03
subsystem: admin-menu-scan-editor
tags: [refactor, behavior-preserving, regression-gate, operator-verified, RFCT-04]
status: complete
requires:
  - "ReviewDishEditor/index.tsx (Plan 01 composition root + barrel)"
  - "reviewHelpers.ts + buildConfirmPayload.ts (Plan 01 pure modules)"
  - "BundledItemsBlock.tsx / CategorySection.tsx / DishCard.tsx (Plan 02 presentational children)"
provides:
  - "Operator-confirmed end-to-end regression proof (D-11): a real needs_review job Save lands, job -> completed, data persisted, no visual/behavioral diff"
  - "RFCT-04 closed"
affects:
  - "RFCT-04 requirement traceability (flips to validated at phase close)"
tech-stack:
  added: []
  patterns:
    - "operator in-browser Save as the authoritative behavior-preservation gate (mirrors Phase 8/9 on-device gates) — no emulator constraint on admin (browser surface, port 3001)"
key-files:
  created: []
  modified: []
decisions:
  - "D-11: the authoritative regression gate is the operator in-browser Save, not the named admin-confirm-rpc.test.ts (which does not import the component) nor the snapshot test (shape, not live path)"
metrics:
  duration: ~5 min
  completed: 2026-06-24
  tasks: 2
  files: 0
---

# Phase 10 Plan 03: Operator In-Browser Save — RFCT-04 Close

Verification-only plan (no file changes). Re-ran the full automated regression gate on the fully decomposed tree, then handed the operator the authoritative end-to-end gate (D-11): a real `needs_review` menu-scan job Save in the admin portal. The operator approved — the decomposed `ReviewDishEditor` produces an identical, persisting Save. RFCT-04 closed.

## What Was Done

**Task 1 — Full automated gate re-run at the phase head (all six 10-01/10-02 commits landed):**

- `pnpm check-types` (turbo) → exits 0; 3/3 tasks successful (admin + web-portal-v2 + ui).
- `cd apps/admin && npx vitest run` → 18 files / 169 tests passing, including `buildConfirmPayload.test.ts` (D-10 inline snapshot + focused `asEditable` L-2 case), `admin-confirm-rpc.test.ts`, `useReviewState.test.ts`.
- Zero-residue consumer grep: `grep -rn "from './ReviewDishEditor'" apps/admin/src` → exactly one line, `AdminJobShell.tsx:13`, resolving to `ReviewDishEditor/index.tsx`.
- Barrel re-exports both symbols: `export type { ExtractedDish } from '../useReviewState'` (index.tsx:32) and `export function ReviewDishEditor(` (index.tsx:52).

No cross-plan drift — nothing regressed across the two autonomous plans.

**Task 2 — Operator in-browser Save (D-11, blocking-human):**

The operator loaded a real `needs_review` menu-scan job in the admin portal (port 3001), confirmed the decomposed editor rendered identically (per-category sections with the "(no category)" bucket last; each dish card's fields; menu-category + dish-category controls; bundled items; modifier-groups editor), made edits, confirmed the source-image preview still synced on focus/click (proving `onActiveImageIndexChange` survived), and hit Save. Result: **approved** — Save landed, the job transitioned to `completed` with dishes/modifier groups/bundled items persisted, and there was no visual or behavioral difference vs the pre-refactor editor.

## Operator Confirmation

> **approved** (2026-06-24) — live in-browser Save on a real `needs_review` job lands (job → `completed`, data persisted); the decomposed editor behaves identically to the pre-refactor monolith. No visual or behavioral difference reported.

This is the authoritative behavior-preservation proof for RFCT-04, mirroring the Phase 8/9 on-device gates. The agent-side proofs (check-types + the byte-identical-payload snapshot + the full admin suite + zero-residue grep + `AdminJobShell` byte-unchanged) prove shape stability; the operator Save proves the live submit path still lands.

## Verification

- Task 1 automated gate green (check-types 0, vitest 169/169, single-importer grep, barrel re-exports both symbols).
- Task 2 operator checkpoint: **approved** — real `needs_review` Save lands, job → `completed`, data persisted, zero visual/behavioral diff.

## RFCT-04 Outcome

`ReviewDishEditor.tsx` (1258 lines) is decomposed into a `ReviewDishEditor/` directory — `index.tsx` (orchestration root + barrel), pure `reviewHelpers.ts` + `buildConfirmPayload.ts`, and presentational `BundledItemsBlock` / `CategorySection` / `DishCard` — split along form regions (not the submit boundary), with a single `buildConfirmPayload()` + single `adminConfirmMenuScan` submit preserving the byte-identical `admin_confirm_menu_scan` payload contract. All five landmines (L-1…L-5) preserved verbatim. Behavior-preservation verified live by the operator. RFCT-04 closed.

## Threat Surface

No new surface. This plan changed no files — it is the regression gate itself (T-10-07 mitigated by the operator Save backed by the snapshot test + check-types; T-10-08 N/A — no installs).

## Self-Check: PASSED

No files created or modified (verification-only plan). Task 1 automated gate re-confirmed green at HEAD; Task 2 operator checkpoint approved. SUMMARY recorded.

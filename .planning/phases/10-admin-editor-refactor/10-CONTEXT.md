# Phase 10: Admin Editor Refactor - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (1258 lines) into editor-region components + pure modules — **behavior-preserving**. No UX change, no "fix while here." The `admin_confirm_menu_scan` payload shape stays byte-identical and the submit path stays single.

This carries the Phase 8/9 refactor doctrine forward to the **admin browser surface** (not mobile): directory + barrel, preserve quirks exactly, one refactor per commit. Unlike the mobile phases, admin **enforces `turbo check-types`** and **has a vitest suite**, so the regression gate is richer.

**Locked by ROADMAP SC (read, then reconciled below):**
- SC#1: split along form regions, delegating to existing modifier helpers, **not** along the submit boundary. (ROADMAP literally names `DishFieldsForm` / `ModifierGroupsEditor` / `DishImagePanel` — see D-02 for why those names are reinterpreted against the actual code.)
- SC#2: a single `buildConfirmPayload()` + a single submit call; payload shape unchanged.
- SC#3: `turbo check-types` passes and the existing `admin-confirm-rpc.test.ts` still passes — see D-09 for why that test alone does **not** prove the editor's payload is unchanged.

</domain>

<decisions>
## Implementation Decisions

### Decomposition seams (discussed)

- **D-01: Directory + barrel** (Phase 8 D-08/D-09 + Phase 9 D-07/D-08 analog). Convert `ReviewDishEditor.tsx` → a `ReviewDishEditor/` directory whose `index.tsx` is BOTH the composition root AND the re-export barrel. The barrel MUST re-export the named `ReviewDishEditor` component **and** `type ExtractedDish` — the parent does `import { ReviewDishEditor, type ExtractedDish } from './ReviewDishEditor'` (`AdminJobShell.tsx:13`), and the current file re-exports `export type { ExtractedDish } from './useReviewState'` (line 40). Both must keep resolving with zero import-path changes. Verify with a consumer grep.

- **D-02: SC#1 name reconciliation — READ BEFORE PLANNING** (Phase 9 D-02 precedent). ROADMAP SC#1 literally names `DishFieldsForm` / `ModifierGroupsEditor` / `DishImagePanel`. Reality:
  - `ModifierGroupsEditor` **already exists** (`@/components/modifiers/ModifierGroupsEditor`, 474 lines) and is already delegated to (line 1138). Leave it as-is; do NOT recreate it.
  - There is **no image panel inside this file.** The source-image preview is `SourceImageStrip`, which lives in the **parent** `AdminJobShell` (line 450) and is synced only via the `onActiveImageIndexChange?.(d.source_image_index)` callback fired on the dish `<li>` (lines 821-822). So "DishImagePanel" maps to nothing here — do NOT invent one or move `SourceImageStrip`.
  - SC#1 is satisfied **in spirit** by splitting along the real form regions in D-03, not by literal name-matching.

- **D-03: Presentational children extracted** (children receive `value` + typed callbacks; they own NO orchestration/store state — Phase 9 D-03):
  - `DishCard.tsx` — the whole per-dish `<li>` (~lines 818-1182): name + description, the price/portion/price-label/protein/dining-format grid, both category controls (`MenuCategoryCombobox` + custom-name input, `DishCategoryCombobox` + `DishCategoryCreateInline`), `BundledItemsBlock`, `ModifierGroupsEditor`, the per-dish `ScanExtrasPanel`, and the copy-modifier-groups button.
  - `CategorySection.tsx` — the per-group `<section>` header (~lines 740-815): display name + badge, "Merge into…" dropdown, Select-all/Deselect-all, the section description textarea.
  - Existing already-extracted collaborators (`MenuCategoryCombobox`, `DishCategoryCombobox`, `DishCategoryCreateInline`, `ModifierGroupsEditor`, `ScanExtrasPanel`) stay wired unchanged.

- **D-04:** `BundledItemsBlock` (the existing inner component, lines 1192-1258) → its own file, moved **verbatim**.

- **D-05: Pure helpers module** `reviewHelpers.ts` — `pickName`, `deriveDiningFormat`, `asEditable`, `confidenceTone`, `getGroupKey`, `encodeCategoryValue`, `decodeCategoryValue` (all pure: read only their args). `getGroupMeta` (lines 448-477) **stays in `index.tsx`** — it closes over `existingById` / `canonicalBySlug` / `sourceLanguage`; pass its results down to children rather than forcing it pure (forcing it would change call sites = behavior risk). Co-located `types` may split into a file or stay in `reviewHelpers.ts` (planner discretion).

- **D-06: Orchestration stays in `index.tsx`** (the "Orchestration state" area was NOT selected → default applied). The composition root keeps: bulk-copy selection (`selectedIds` / `toggleSelected` / `toggleGroupSelection` / `handleCopyGroups`), category merge (`groupCategoryPatch` / `handleMergeGroup`), scan-target (`scanTarget` / `handleScannedExtrasAttach`), `categoryDescriptions`, `sourceLanguage`, and the derived memos (`groups`, `menuCategoryOptions`, the lookup maps). `useReviewState` remains the dish-CRUD owner, untouched. No new orchestration hook is required; the planner may add a thin one only if it is provably zero-behavior-change.

### buildConfirmPayload (discussed)

- **D-07:** Extract `buildConfirmPayload(...)` as a **PURE, exported module function** that returns the exact payload object currently assembled inline in `handleSave` (lines 525-599: `source_language_code`, `category_descriptions[]`, `dishes[]`). Shape **byte-identical**. It must receive its inputs as plain data/predicates (`activeDishes`, `sourceLanguage`, the `categoryDescriptions` map, `getGroupKey`, and a description-locked predicate or precomputed `getGroupMeta` result) so it stays pure — **no closure over component state/maps**. Exact signature is planner discretion. The `category_descriptions` de-dup + `verbatim_name` logic, the `price_override` passthrough, and the portion/dining-format/bundled-item field mapping move into it verbatim.

- **D-08: Validation STAYS in `handleSave`** — it is UI-coupled (calls `setError(...)` and early-returns: empty-active, missing dish name, empty custom category, empty group/option names; lines 496-522). `handleSave` becomes: validate → `buildConfirmPayload(...)` → the **single** `adminConfirmMenuScan(jobId, payload)` submit (line 600). One builder, one submit (SC#2).

### Real regression gate (discussed)

- **D-09: The named gate has a hole — state it so the planner doesn't lean on it.** `apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts` is a **DB-level RPC transactional test** with hand-built payloads; it does **not** import `ReviewDishEditor` or `buildConfirmPayload`, so it passes regardless of how the component is refactored. It stays as a contract guard on the RPC *side*, but it is **not** proof the editor's payload is unchanged.

- **D-10: Add ONE targeted test on the pure `buildConfirmPayload`** — feed a representative `EditableDish[]` exercising: modifier groups (+ options), all three category modes (custom / canonical / existing), bundled items, `portion_amount`/`portion_unit`, a non-null `dining_format`, and the `price_override === 0 → null` case — and assert the exact payload object (inline snapshot). This is the durable shape-regression proof and fits the **"targeted tests that de-risk a specific refactor"** carve-out (NOT a coverage push). Place it alongside the existing menu-scan tests (`apps/admin/src/__tests__/menu-scan/`).

- **D-11: PLUS an operator in-browser save** as the authoritative end-to-end gate. Admin is a browser surface (port 3001, no emulator constraint): the operator loads a real `needs_review` job, edits, hits Save, and confirms it lands (job → `completed`, dishes/groups persisted). Keep the existing `admin-confirm-rpc.test.ts` + `useReviewState.test.ts` green.

### Quirks / landmines — preserve verbatim + add a guard comment (Phase 9 D-11 doctrine)

- **L-1:** `useReviewState(useMemo(() => initialDishes.map((d,i) => asEditable(...)), []))` — **empty deps + `eslint-disable react-hooks/exhaustive-deps`** with the comment "initial only — recomputing on prop change would clobber edits" (lines 305-310). Keep empty deps + the disable; do NOT add `initialDishes`.
- **L-2:** `asEditable` `price_override === 0 ? null` collapse (line 118) — backstop for pre-zero-override-fix jobs.
- **L-3:** `deriveDiningFormat` reads legacy `d.dish_kind` (lines 67-72). `dish_kind` was dropped from the schema (migration 163) but `ExtractedDish` still carries it from old `result_json` blobs — preserve the mapping.
- **L-4:** `categoryDescriptions` lazy `useState` initializer (lines 313-333) — one-time seed; keep as-is.
- **L-5:** `groups` memo pushes the `'none'` bucket to the end (lines 437-441) — render order.

### Claude's Discretion
- Exact granularity inside `DishCard` (whether the field grid becomes a nested `DishFieldsGrid` or stays inline — the finer "also split DishFieldsForm" option was declined; default keeps `DishCard` whole, but the planner may factor obvious sub-blocks if zero behavior change).
- `buildConfirmPayload` exact signature, and whether it receives `getGroupMeta` or a narrower `descriptionLocked` predicate.
- Whether `reviewHelpers` splits into helpers + a types file, or stays one file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirement & success criteria
- `.planning/ROADMAP.md` § "Phase 10: Admin Editor Refactor" — Goal + SC#1-3 (note SC#1's component names are reinterpreted per D-02).
- `.planning/REQUIREMENTS.md` — RFCT-04 (decompose `ReviewDishEditor.tsx`, behavior-preserving). Last open requirement of the milestone.

### Precedent doctrine (apply the same patterns)
- `.planning/phases/09-mobile-map-modal-refactor/09-CONTEXT.md` — D-02 (ROADMAP name reinterpretation against real code), D-03 (parent owns state, children presentational), D-07/D-08 (directory + barrel, re-export every consumed symbol), D-10/D-11 (preserve quirks verbatim + guard comments).
- `.planning/phases/08-mobile-filter-store-refactor/08-CONTEXT.md` — D-06 (no "fix while here"), D-08/D-09 (directory + `index` barrel as both root and re-export).

### Target code & its fragility
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx` (1258 lines) — RFCT-04 target. Pure helpers lines 60-220; `ReviewDishEditor` component 222-1190 (handleSave payload build 525-599; per-group `<section>` 740-815; per-dish `<li>` 818-1182); inline `BundledItemsBlock` 1192-1258. Landmines: L-1 (305-310), L-2 (118), L-3 (67-72), L-4 (313-333), L-5 (437-441). Export consumed by `AdminJobShell.tsx:13`.
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/AdminJobShell.tsx` — parent. Import contract `{ ReviewDishEditor, type ExtractedDish } from './ReviewDishEditor'` (line 13); `SourceImageStrip` (the "image panel") lives HERE (line 450); `onActiveImageIndexChange` wired at lines 457-468. Keep all three intact.

### Collaborators — reuse, do not reinvent (SC#1 "delegate to existing modifier helpers")
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/useReviewState.ts` (366 lines) — owns dish CRUD + modifier/bundled/category reducers; unchanged. Guarded by `apps/admin/src/__tests__/menu-scan/useReviewState.test.ts` (keep green).
- `apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx` (474 lines) + `modifiers/{adapters,editableTypes,groupReducers}.ts` — existing modifier editor + helpers; stay as-is.
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ScanExtrasPanel.tsx` — existing scan-from-image panel; stays wired.

### Regression gate (see D-09 — the named test does NOT exercise the component)
- `apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts` — DB-level RPC contract test (hand-built payloads). Keep green, but it is NOT the editor-payload proof. The new `buildConfirmPayload` snapshot test (D-10) is.

### Payload contract / dish model
- `CLAUDE.md` § "Dish Model — Modifier Groups + dining_format" — the modifier-group + `dining_format` + `bundled_items` model the payload encodes; `primary_protein` NOT NULL; parent/variant model dropped (migration 163, explains L-3's legacy `dish_kind`).

### Verification toolchain
- Types: `turbo check-types` (admin IS covered — unlike mobile). Tests: `cd apps/admin && npx vitest run`.
- Zero-residue gate: consumer grep on `ReviewDishEditor` / `ExtractedDish` import paths after the move.

</canonical_refs>

<code_context>
## Existing Code Insights

### Split map for ReviewDishEditor.tsx
- **Pure → `reviewHelpers.ts`**: `pickName`, `deriveDiningFormat` (legacy `dish_kind` → `dining_format`, L-3), `asEditable` (`ExtractedDish`→`EditableDish`, incl. L-2 `price_override` collapse), `confidenceTone`, `getGroupKey`, `encodeCategoryValue`, `decodeCategoryValue`.
- **Pure → `buildConfirmPayload.ts`**: the payload assembly from `handleSave` (525-599). Receives plain data + predicates (no component-state closure).
- **Presentational → `CategorySection.tsx`**: per-group header (740-815).
- **Presentational → `DishCard.tsx`**: per-dish `<li>` (818-1182), wraps existing `MenuCategoryCombobox` / `DishCategoryCombobox` / `DishCategoryCreateInline` / `ModifierGroupsEditor` / `ScanExtrasPanel`.
- **Move → `BundledItemsBlock.tsx`**: existing inner component (1192-1258), verbatim.
- **Stays in `index.tsx`**: orchestration (D-06), `getGroupMeta` (closure over maps), validation (D-08), the single submit, all derived memos.

### Reusable assets (already extracted — keep wired)
- `useReviewState` (dish CRUD), `ModifierGroupsEditor` + `modifiers/*` helpers, `ScanExtrasPanel`, the three comboboxes, `SourceImageStrip` (parent-owned).

### Integration points
- Parent `AdminJobShell` import + `onActiveImageIndexChange` callback (the dish `<li>`'s `onFocusCapture`/`onMouseDown` fire `source_image_index` upward to sync `SourceImageStrip` — must survive the move into `DishCard`).

</code_context>

<specifics>
## Specific Ideas

- **One refactor per commit** (SC#3) — keep each extraction independently revertable for a clean bisect; do not batch the helpers move, the `buildConfirmPayload` extraction, and the `DishCard`/`CategorySection` splits into one commit.
- The agent makes the move provably shape-stable (`turbo check-types` green + `buildConfirmPayload` snapshot test + zero-residue import grep + `admin-confirm-rpc`/`useReviewState` tests green); the **operator confirms live save in the browser** (D-11).

</specifics>

<deferred>
## Deferred Ideas

- **Finer `DishFieldsForm` split** (carve the field grid out of `DishCard`) — declined here to keep the diff tight; revisit if `DishCard` proves unwieldy.
- **Pure `validateDishes()` extraction** (make `handleSave` thinner) — declined; validation stays UI-coupled (D-08). Capture as a follow-up.
- **Making `getGroupMeta` pure / a broader category-model refactor** — out of scope for this behavior-preserving phase.
- Any additional quirk surfaced while moving code → append here, do NOT fix in place.

</deferred>

---

*Phase: 10-admin-editor-refactor*
*Context gathered: 2026-06-23*

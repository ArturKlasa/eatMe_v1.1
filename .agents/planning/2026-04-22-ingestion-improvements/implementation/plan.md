# Implementation Plan — Dish Ingestion & Menu-Scan Review Rework

_Version: 1.0 — 2026-04-22_
_Source: `design/detailed-design.md`_

## Context

Convert the design into a series of implementation steps that will build each component in a test-driven manner following agile best practices. Each step must result in a working, demoable increment of functionality. Prioritize best practices, incremental progress, and early testing, ensuring no big jumps in complexity at any stage. Make sure that each step builds on the previous steps, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step.

Per Q9.2, this work lands as one coordinated PR (no feature flag). The step sequence below is intended to be merged to a **feature branch** in order; each step produces something demoable on the feature branch; the feature branch merges to `main` when all steps are complete and the final verification passes.

Assumptions going in:
- Existing `dishes.dish_kind` values in production include `standard`, `template`, `experience`, `combo` — rows per kind unknown but assumed small (early-stage product).
- Existing `menu_scan_jobs` in `needs_review` status may contain old-kind extraction results.
- Supabase migrations run in numeric order; next unused number is `114`.
- Tests run via `turbo test` and per-package `npx vitest run`.

## Checklist

- [x] Step 1: Schema migration — additive columns, new tables, menu_scan_jobs extensions, generate_candidates update, data rename
- [x] Step 2: Shared types, constants, and test fixture sweep
- [x] Step 3: AI extraction prompt + Zod schema + enrich-dish function update
- [x] Step 4: Confirm endpoint extended for new kinds + courses + soft-undo endpoint
- [x] Step 5: Experience triage admin page with audit log
- [x] Step 6: Tighten CHECK migration
- [x] Step 7: Zustand store scaffold — uploadSlice + processingSlice (ported from existing hooks)
- [x] Step 8: reviewSlice + draftSlice with versioned localStorage + confidence config
- [x] Step 9: groupSlice + selectors (flagged, grouped-by-image, confirm summary)
- [x] Step 10: ReviewPage shell reads from store (functional parity with old UI)
- [x] Step 11: DishEditPanelV2 + KindSelectorV2 + VariantEditor
- [x] Step 12: CourseEditor
- [x] Step 13: PageGroupedList with source-image chip and carousel sync
- [x] Step 14: FlaggedDuplicatePanel — why-flagged breakdown + side-by-side
- [x] Step 15: SavePreviewModal + UndoToast wired to soft-undo endpoint
- [x] Step 16: useKeyboardShortcuts + actionable warnings
- [x] Step 17: Mobile (React Native) kind-badge update
- [ ] Step 18: Merge prep — cleanup, docs, final verification against checklist

---

## Step 1: Schema migration — additive columns, new tables, menu_scan_jobs extensions, generate_candidates update, data rename

**Objective:** Land all DB-level structural changes except the final CHECK tightening. After this step the DB can hold both old and new kind values; new columns and tables exist; `generate_candidates` filters out templates.

**Implementation guidance:**
- New file: `infra/supabase/migrations/114_ingestion_rework.sql`.
- Contents (in order): add columns on `dishes` (`status`, `is_template`, `source_image_index`, `source_region`); relax CHECK on `dish_kind` to accept both old and new values; auto-rename data (`combo→bundle`, `template→configurable`+`is_template=true`); create `dish_courses` and `dish_course_items` with FKs, CHECKs, indexes, RLS policies; extend `menu_scan_jobs` with `saved_dish_ids` and `saved_at`; replace `generate_candidates()` body with the current one plus `AND d.is_template = false` added to the WHERE clause (copy from `111_primary_protein_user_prefs_and_feed.sql` as the latest baseline).
- All statements wrapped in a single transaction block so partial failure rolls back.
- RLS on new tables: SELECT allowed to the owner of the parent dish (join); INSERT/UPDATE/DELETE likewise.
- Ensure `dish_ingredients` FK on `dish_id` is `ON DELETE CASCADE` (verify; adjust if not).

**Test requirements:**
- Migration smoke-run locally: `supabase db reset` clean, then apply; verify columns, tables, indexes exist; verify existing `combo`/`template` rows were renamed correctly by running a read query.
- Negative auth test: attempt to insert into `dish_courses` as a non-owner; expect RLS rejection.
- Feed RPC test: insert two dishes (one with `is_template=true`), confirm `generate_candidates()` only returns the non-template.

**Integrates with:** first step — no prior dependencies.

**Demo:** running `select id, dish_kind, is_template, status from dishes limit 5;` on a fresh `supabase db reset` shows the new columns populated correctly; `select * from dish_courses` and `dish_course_items` exist and are empty; inserting a test row and reading it back works.

---

## Step 2: Shared types (transitional union) + fixture sweep

**Objective:** Add new kinds to `@eatme/shared` as a **transitional union** of old + new values. This lets dependent code (Steps 3–17) migrate one file at a time without breaking type-check. The narrow 5-value enum is enforced only in Step 18.

**Implementation guidance:**
- `packages/shared/src/types/restaurant.ts`:
  - Transitional: `export type DishKind = 'standard' | 'template' | 'experience' | 'combo' | 'bundle' | 'configurable' | 'course_menu' | 'buffet';` (8 values — union of old + new).
  - Add `DishStatus`, `DishCourse`, `DishCourseItem` interfaces (new shape per design §4.2).
  - Add a `LEGACY_DISH_KINDS = ['template','experience','combo'] as const` plus helper `isLegacyKind(k: string): boolean` for normalizer code in reviewSlice.hydrateFromJob.
- `packages/shared/src/constants/menu.ts`:
  - Add `DISH_KIND_META` keyed by the 5 new values (no legacy metadata; legacy values have no user-facing representation).
  - Keep the old `DISH_KINDS` export (4 old values) as **deprecated**; add a comment and plan to remove in Step 18.
- Test fixture sweep: no fixture file needs to change in this step because the union still accepts old values. Fixtures can update opportunistically as their owning code migrates.
- Run `turbo check-types` — expected to be green with no code changes in dependent files.

**Test requirements:**
- Add `packages/shared/src/__tests__/dish-kinds.test.ts`: assert `DISH_KIND_META` has 5 keys; `isLegacyKind('combo')` is true; `isLegacyKind('bundle')` is false.
- Run `turbo test` — all existing tests pass unchanged.
- `turbo check-types` green.

**Integrates with:** Step 1 (DB CHECK now accepts both old and new values, matching the transitional union).

**Demo:** import `DishKind` in a component — TypeScript accepts both `'combo'` and `'bundle'`. `DISH_KIND_META['bundle'].label === 'Bundle'` at runtime.

**Note on narrowing:** the final enum narrowing to 5 values is Step 18's responsibility. Between Steps 2 and 17, every dependent file is free to use either old or new literals; each step migrates its file(s) as it touches them. This avoids a "big bang" refactor commit.

---

## Step 3: AI extraction prompt + Zod schema + enrich-dish function update

**Objective:** The extraction pipeline emits new 5-kind values (and course structures for `course_menu`), tags each dish with `source_image_index`, and the enrich-dish function reasons about the new kinds for completeness.

**Implementation guidance:**
- `apps/web-portal/app/api/menu-scan/route.ts`:
  - Update the prompt decision tree (§4.3 in design) to use the 5-value enum.
  - Update the `DishExtractionSchema` Zod shape per §4.3, including optional `courses` array.
  - Ensure OpenAI call uses `response_format: { type: 'json_schema', json_schema: { strict: true, schema } }`; verify with a real API call.
  - After getting Vision response per image, tag every dish with `source_image_index = pageIndex` before merge.
  - Coerce defaults (§4.3 line 285-298 equivalent): `dish_kind ?? 'standard'`, `is_parent ?? false`.
- `infra/supabase/functions/enrich-dish/index.ts`: update completeness branches per design §4.12. Include handling for `course_menu` (requires >=2 courses, each with >=1 item) and `buffet` (price > 0). During the transition window, keep the old-kind branches too so the function is safe against pre-migration drafts.

**Deploy path note:** the web-portal API route (`route.ts`) deploys via the normal Next.js/Vercel PR flow. The Supabase Edge Function (`enrich-dish`) deploys separately via `supabase functions deploy enrich-dish`. The PR description should explicitly call out both deploy commands needed; don't assume a single `git push` covers both.

**Test requirements:**
- Unit test `menu-scan/route.ts` in `apps/web-portal/test/menu-scan-api.test.ts` (new) — mocks OpenAI, asserts `source_image_index` propagates, new-kind values pass Zod.
- One integration test that runs the real `enrich-dish` against a seeded dish of each kind; asserts the completeness flag matches expectation.

**Integrates with:** Step 2 (types used in Zod schema and function).

**Demo:** upload a two-image menu via `curl` to `/api/menu-scan`; response JSON shows dishes with new-kind values and `source_image_index: 0` / `source_image_index: 1`; a `course_menu` dish has a populated `courses` array. `enrich-dish` logs show the correct completeness decision.

---

## Step 4: Confirm endpoint extended for new kinds + courses + soft-undo endpoint

**Objective:** The confirm endpoint persists new-kind dishes, course structures, `status`, `is_template`, and `source_image_index` to the DB; it records `saved_dish_ids` / `saved_at` on `menu_scan_jobs`. The new soft-undo endpoint restores a pre-save state within 15 minutes.

**Implementation guidance:**
- `apps/web-portal/app/api/menu-scan/confirm/route.ts`:
  - Extend payload schema to accept `dish_kind` (new enum), `is_template`, `status`, `source_image_index`, and optional `courses` per dish.
  - Three-pass insert: parents first, children second, courses + course_items third. **`links_to_dish_id` is left `NULL` at save time** (per design §9.1 — admin can wire links later). No id-remap needed this cycle; removing this complexity keeps Step 4 small.
  - After success, set `menu_scan_jobs.saved_dish_ids = [<all inserted dish ids>]` and `saved_at = now()`.
- New file: `apps/web-portal/app/api/menu-scan/undo/route.ts`:
  - POST `{ job_id }`.
  - Look up `menu_scan_jobs`, verify `saved_at` within 15 minutes, else 409.
  - Delete dishes in `saved_dish_ids` (CASCADE handles courses, course_items, dish_ingredients).
  - Clear `saved_dish_ids`, `saved_at`; reset `status` to `'needs_review'`.
  - Return `{ undone: N }`.
- Admin-only gate on both endpoints (reuse existing auth middleware).

**Test requirements:**
- API-route tests in `apps/web-portal/test/menu-scan-confirm.test.ts` (new):
  - Insert a `course_menu` dish with 3 courses, verify DB rows match payload.
  - Insert parent+children variants; verify `parent_dish_id` wired.
  - Non-admin: 401.
- API-route tests in `apps/web-portal/test/menu-scan-undo.test.ts` (new):
  - Happy path: save then undo within window deletes rows and resets status.
  - After 15 min: 409 Conflict.

**Integrates with:** Steps 1–3 (DB schema, types, extraction output).

**Demo:** end-to-end via `curl`: extract a menu → POST confirm → rows appear in DB with courses → POST undo with same `job_id` → rows deleted, status back to `needs_review`.

---

## Step 5: Experience triage admin page with audit log

**Objective:** A one-time admin page lets admins reclassify legacy `experience` rows as `course_menu` or `buffet`, recording each decision in `admin_audit_log`.

**Implementation guidance:**
- New page: `apps/web-portal/app/admin/dishes/experience-triage/page.tsx`.
- Server component fetches all dishes where `dish_kind` ∈ `{'experience','template','combo'}` (defensive — post-rename, only `experience` should remain).
- Client component: table with per-row radio (`course_menu` / `buffet`), bulk auto-classify button (keyword heuristics: "tasting"→`course_menu`; "AYCE"/"buffet"/"all you can eat"→`buffet`), save button.
- Save handler calls new endpoint `POST /api/admin/dishes/triage` — batch-updates `dish_kind` + inserts one `admin_audit_log` row per dish. **Schema confirmed present** (created in `database_schema.sql`; columns include `admin_id`, `action`, `entity_type` with CHECK ∈ `{'restaurant','dish','menu'}`, `entity_id`, and metadata columns). Use `entity_type='dish'`, `action='dish_kind_triage'`, and put `{before_kind, after_kind}` into the metadata/jsonb column per existing conventions.
- Redirect to the restaurant admin index when the query returns zero rows.
- Add nav item "Experience Triage" to admin sidebar; hide via a server-side check when zero rows remain.

**Test requirements:**
- API route test for `POST /api/admin/dishes/triage`: batch update + audit log insertion.
- Component smoke test: renders with N rows, radio selection dispatches, save handler fires with expected payload.

**Integrates with:** Step 1 (DB relaxed CHECK accepts both old and new values during this window).

**Demo:** seed 3 rows with `dish_kind='experience'`, visit `/admin/dishes/experience-triage`, classify each, save, verify DB rows updated and 3 `admin_audit_log` rows written; refresh the page → redirected away (zero-row state).

---

## Step 6: Tighten CHECK migration (**post-deploy, operationally gated**)

**Objective:** Lock the `dish_kind` CHECK constraint to the 5 new values once triage has completed in production. Guarded by a row-count assertion to prevent data corruption.

**Timing model — important:**
- Step 6 is **not** bundled with the main deploy. The sequence is:
  1. Deploy Steps 1–5 (and all dependent UI steps 7–17) to production. Production DB now has the relaxed CHECK and both old + new kind values.
  2. Admin logs in, runs the `/admin/dishes/experience-triage` page (Step 5), classifies all legacy `experience` rows.
  3. Once triage-page row count hits zero, run the `115_tighten_dish_kind_check.sql` migration in production (manual `supabase db push` or the equivalent deploy hook).
  4. Step 18's narrow `DishKind` enum is safe to ship any time after Step 6 (or with Step 6 if releases align).
- Authoring this migration and testing it locally belongs to this step. **Running it in production** is a separate operational action that happens after admin triage.

**Implementation guidance:**
- New file: `infra/supabase/migrations/115_tighten_dish_kind_check.sql`.
- Contents: drop existing CHECK; add guard `DO $$ ... IF n > 0 THEN RAISE EXCEPTION ... END $$` per design §6.4; then ADD CONSTRAINT with the tightened values.
- Include a header comment stating "Requires all legacy `dish_kind` values to be triaged. Do NOT run before that is complete."

**Test requirements:**
- Negative test: on a DB with a remaining `experience` row, running the migration raises and rolls back.
- Positive test: on a DB with only valid kinds, migration succeeds.
- Post-migration: inserting a dish with `dish_kind='combo'` fails.

**Integrates with:** Step 5 (triage must be complete on any target DB before the migration runs).

**Demo:** run `supabase db reset` followed by 114, seed an `experience` row, run 115 → fails with explicit error. Update the row to `course_menu`, rerun → succeeds. Attempt to insert a dish with `dish_kind='combo'` → rejected.

**Dependency for Step 18:** the narrowed `DishKind = 'standard' | 'bundle' | 'configurable' | 'course_menu' | 'buffet'` type ships in Step 18. Step 18 in production depends on Step 6 having run (otherwise the DB could still contain values the narrower type rejects). Coordinate the release order: either (a) Step 18 ships in the same release as Step 6's migration after triage is complete, or (b) the narrow type is deferred to a follow-up release.

---

## Step 7: Zustand store scaffold — uploadSlice + processingSlice

**Objective:** Create the `store/` folder structure; port `useUploadState` and `useProcessingState` logic to Zustand slices. The page still renders via existing hooks that now re-export from the store.

**Implementation guidance:**
- **Add `zustand` to `apps/web-portal/package.json`** — verified absent today. Run `pnpm add zustand --filter @eatme/web-portal` (adjust package name to match the workspace). Mobile already uses Zustand; this brings web-portal in line.
- New folder: `apps/web-portal/app/admin/menu-scan/store/`.
- `store/index.ts`: create Zustand store combining slices via `create<T>()((...a) => ({ ...uploadSlice(...a), ...processingSlice(...a) }))`.
- `store/uploadSlice.ts`: translate existing `useUploadState` state and methods to slice creator signature `(set, get) => ({ ... })`.
- `store/processingSlice.ts`: same treatment.
- Existing hooks `useUploadState`, `useProcessingState` become thin wrappers around `useReviewStore(selector)` so consumer components don't change in this step.
- Delete the old hook internals once the wrapper is proven functional.

**Test requirements:**
- Unit tests in `store/__tests__/uploadSlice.test.ts` and `processingSlice.test.ts`: import the slice creator, attach to a fresh Zustand store, exercise every action.

**Integrates with:** Steps 2 and 4 (types, confirm flow unchanged; store is internal).

**Demo:** upload a menu and trigger extraction; behavior is identical to pre-step but state now lives in Zustand (verify via devtools — `window.__ZUSTAND__` or direct store ref).

---

## Step 8: reviewSlice + draftSlice with versioned localStorage + confidence config

**Objective:** Port `useReviewState` and add new `draftSlice`. Confidence threshold moves to config. Draft payloads are versioned in localStorage; unversioned drafts are discarded with a toast.

**Implementation guidance:**
- `store/reviewSlice.ts`: port `useReviewState` structure (`editableMenus`, `expandedDishes`, etc.) + new actions: `addCourse`, `removeCourse`, `reorderCourses`, `updateCourseField`, `addCourseItem`, `removeCourseItem`, `reorderCourseItems`, `updateCourseItem`. Also include `hydrateFromJob` that normalizes old-kind values in the stored result (see §4.14).
- `store/draftSlice.ts`: new. On any change to `editableMenus` or `groupState`, write `{ version: 2, editableMenus, groupState, timestamp }` to `localStorage['menu-scan-draft:'+jobId]` via a debounced writer (500 ms). On mount, try to read; if `version !== 2` or missing, discard and show toast.
- `lib/menuScanConfig.ts` (new): exports `CONFIDENCE_THRESHOLD` read from `process.env.NEXT_PUBLIC_MENU_SCAN_CONFIDENCE_THRESHOLD`, default `0.7`.
- `useReviewState` wrapper updated to select from the store.

**Test requirements:**
- `store/__tests__/reviewSlice.test.ts`: exercise kind changes (assert auto-patching of `is_parent` + `display_price_prefix`; no silent price drop on combo → configurable); course editor actions; `hydrateFromJob` normalization (feed in old-kind result, assert post-hydration has new kinds).
- `store/__tests__/draftSlice.test.ts`: mock localStorage; assert debounced write; assert version mismatch triggers discard.

**Integrates with:** Step 7 (store scaffold); Step 2 (types).

**Demo:** open review step, edit a dish, refresh the tab — draft restored with a "Draft restored" toast. In the console, `localStorage.getItem('menu-scan-draft:<jobId>')` shows the versioned payload. Manually set `version: 1` in localStorage, refresh — "Draft incompatible" toast, editor starts fresh.

---

## Step 9: groupSlice + selectors (flagged, grouped-by-image, confirm summary)

**Objective:** Port `useGroupState` to a slice; add memoized selectors for the review UI.

**Implementation guidance:**
- `store/groupSlice.ts`: translate existing `useGroupState`.
- `store/selectors.ts`: new. Memoized via `zustand/middleware`'s shallow or a small memoize helper:
  - `selectFlaggedDishes(state)` — dishes with `confidence < CONFIDENCE_THRESHOLD` AND not touched.
  - `selectDishesByImageIndex(state)` — groups dishes by `source_image_index`.
  - `selectConfirmSummary(state)` — returns `{ insertCount, updateCount, acceptedFlaggedCount, untouchedFlaggedCount }`.
  - `selectTotalDishCount(state)`.

**Test requirements:**
- `store/__tests__/selectors.test.ts`: fixture-based tests for each selector.
- `store/__tests__/groupSlice.test.ts`: exercise accept/reject/ungroup actions.

**Integrates with:** Step 8 (reviewSlice contains `editableMenus`; groupSlice references it).

**Demo:** load a fixture with 2 images × 5 dishes × 1 low-confidence; the store exposes groups-by-page of size 5 each, and `selectFlaggedDishes` returns the one low-confidence dish.

---

## Step 10: ReviewPage shell reads from store (functional parity with old UI)

**Objective:** Replace the top-level review page's prop-drilled subtree with a store-subscribed shell that has functional parity with the old UI. Old components still render; they now read from the store instead of props.

**Implementation guidance:**
- Rewrite `apps/web-portal/app/admin/menu-scan/page.tsx` to wrap the review step with a Zustand provider pattern (Zustand's store is global so this is a re-exports cleanup; no Provider tag needed).
- `MenuScanReview` component no longer accepts ~96 props — receives `{ jobId }` only, reads the rest from the store.
- All existing inner components (`MenuExtractionList`, `DishEditPanel`, `DishGroupCard`, `ReviewHeader`, etc.) are refactored to read from store hooks (`useReviewStore(s => ...)`) in place of props.
- No UI visual changes yet.

**Test requirements:**
- Component smoke tests for the top-level `MenuScanReview`: renders with a seeded store; `ReviewHeader` shows correct count.
- Ensure existing tests still pass (they may need updating to wrap the component in a store-initialized context).

**Integrates with:** Steps 7, 8, 9 (all slices available).

**Demo:** the review step looks identical to before but a fresh `rg "prop" app/admin/menu-scan/components/` confirms the ~96-prop explosion is gone. Manual test: upload → extract → review (no visual changes) → save still works.

---

## Step 11: DishEditPanelV2 + KindSelectorV2 + VariantEditor

**Objective:** Replace the dish edit panel with a version that (a) uses the 5-kind selector with tooltips, (b) shows an explicit "this will change" hint on kind change, (c) no longer silently hides the price for `bundle`/`combo`, and (d) surfaces variant editing as a clean sub-component.

**Implementation guidance:**
- New: `components/KindSelectorV2.tsx` — dropdown (using shadcn `Select`) with `DISH_KIND_META` for icon/label/description. On change, if the change affects `is_parent` or `display_price_prefix`, render a small inline caption ("Changing to Bundle: parent=true, price prefix=exact") so the effect isn't silent.
- Rewrite: `components/DishEditPanelV2.tsx` — name/desc/price/dietary/ingredients (unchanged), serves, and `KindSelectorV2`. Price field is rendered for all kinds except `course_menu` parents; for `course_menu` the label changes to "Total price (optional)".
- Rewrite: `components/VariantEditor.tsx` — for `is_parent=true` parents with `dish_kind` in `{standard, bundle, configurable}`, render a list of child variants with name/price/delete; an "Add variant" button calls `addVariantDish` store action.
- Remove silent combo price hiding. Remove the stubbed "Suggest ingredients" button (the feature is disabled; leaving a dead button violates the design).

**Test requirements:**
- Component smoke test: `KindSelectorV2` renders all 5 kinds; selecting `bundle` dispatches `setKind` with expected patch.
- Component test: `DishEditPanelV2` renders price field for `bundle` (regression guard).
- Hook test (already in Step 8): kind change mutates correct fields.

**Integrates with:** Steps 8, 10 (reviewSlice actions + store shell).

**Demo:** change a dish from `standard` to `bundle`; the caption "Changing to Bundle: parent=true..." appears; the price field remains editable. Change to `configurable`; variant editor appears.

---

## Step 12: CourseEditor

**Objective:** For `course_menu` parents, render the course editor per §4.7.

**Implementation guidance:**
- New: `components/CourseEditor.tsx`.
- Renders a list of courses (read via selector `state => state.editableMenus.find(...).courses`) — each course is a collapsible card (use `Collapsible` from shadcn).
- Card header: drag handle, `course_name` text input, `choice_type` select (`fixed`|`one_of`), delete button.
- Card body: if `fixed` → single option_label input; if `one_of` → list of items with option_label + price_delta + delete + drag, plus an "Add item" button.
- Drag-to-reorder via `@dnd-kit/core` (add to `apps/web-portal/package.json` if not present).
- Empty state: on transition to `kind=course_menu`, the `setKind` action in `reviewSlice` (§4.7) auto-creates one blank `one_of` course with one blank item (implement in Step 8 if not already; add the behavior here).

**Test requirements:**
- Component smoke: renders 2 courses + 2 items each; drag reorder fires store action; `choice_type='fixed'` renders single-item layout.
- Hook tests (in reviewSlice.test.ts): all course store actions.

**Integrates with:** Steps 8, 11 (reviewSlice actions + edit panel).

**Demo:** change a dish to `course_menu`; empty "Course 1" appears with one item. Rename the course to "Starter", add an item "Soup", then "Salad", reorder them, set the second course "Main" to `one_of` with "Salmon" and "Chicken". Save → verify in DB that `dish_courses` + `dish_course_items` rows match.

---

## Step 13: PageGroupedList with source-image chip and carousel sync

**Objective:** Replace the flat `MenuExtractionList` with a `PageGroupedList` that organizes dishes by `source_image_index`; clicking a dish's page chip jumps the left-panel carousel to the source image.

**Implementation guidance:**
- New: `components/PageGroupedList.tsx`. Reads `selectDishesByImageIndex`. For each image group, renders a sticky `PageHeader` (thumbnail + dish count) and the dishes underneath.
- Each dish row shows a "Page N" chip; clicking dispatches `uploadSlice.setCurrentImageIdx(N)` so the left carousel jumps.
- **Do NOT add `react-window` in this step.** Render plainly regardless of list size. Virtualization is a judgment call per design §9.3 — only reach for it if real-world admin usage on production menus shows noticeable lag. If we add it later, it's a localized change to `PageGroupedList`'s render block.
- Keep existing filter/search toolbar but route reads through store.

**Test requirements:**
- Component smoke: renders correct groups; click chip dispatches expected action.
- Unit test for `selectDishesByImageIndex` (already in Step 9).

**Integrates with:** Steps 9, 10 (selector + store shell).

**Demo:** multi-image menu with 20 dishes across 3 images; list shows 3 collapsible groups; click any "Page 2" chip; left carousel advances to image 2.

---

## Step 14: FlaggedDuplicatePanel — why-flagged breakdown + side-by-side

**Objective:** Replace the current flagged-duplicate UI with one showing the similarity reason and a side-by-side comparison.

**Implementation guidance:**
- New: `components/FlaggedDuplicatePanel.tsx`.
- Compute why-flagged reasons in the API (`menu-scan/route.ts`): name similarity % (Levenshtein or trigram), whether category matches, whether description overlaps beyond a threshold. Include this in the `flaggedDuplicates` payload (update `lib/menu-scan.ts` `FlaggedDuplicate` type: add `{ similarity: number, reasons: string[] }`).
- UI: two columns — "Incoming dish" and "Existing dish"; header shows "Flagged because: name 87% match, same category". Accept / reject / group-as-variants buttons retained.

**Test requirements:**
- API unit test on flag computation with known inputs/outputs.
- Component smoke: renders reasons; accept dispatches `groupSlice.acceptGroup`.

**Integrates with:** Steps 3, 9 (extraction payload extension + groupSlice).

**Demo:** seed an existing dish "Salmon Teriyaki"; scan a menu with "Salmon Teriyaki" again; panel shows "name 100% match; category match". Click accept → group added.

---

## Step 15: SavePreviewModal + UndoToast wired to soft-undo endpoint

**Objective:** Save button opens a preview modal; after save, an undo toast is shown for 15 minutes.

**Implementation guidance:**
- New: `components/SavePreviewModal.tsx` — renders `selectConfirmSummary` with counts; lists untouched-flagged dishes; if any exist, blocks save unless a checkbox "Save anyway" is ticked. On confirm, dispatches the confirm API call.
- New: `components/UndoToast.tsx` — subscribes to `lastSavedAt` in a new ephemeral slice (e.g., `savedMetaSlice`); shows a sticky toast "Saved 42 dishes · Undo (14:59)" with countdown; on click calls `POST /api/menu-scan/undo`; hides after 15 min.
- Wire `Cmd/Ctrl+S` to open the modal (Step 16 ties the keyboard hook in; for now, the button click is sufficient demo).
- On successful undo: clear draft; reset status; show success toast.

**Test requirements:**
- Component smoke for both.
- API-route test already in Step 4.
- E2E-ish: mock the API and assert the click-undo → API call flow.

**Integrates with:** Steps 4, 8, 9.

**Demo:** save from the review UI → preview modal with correct counts → confirm → toast with countdown → click undo within window → rows deleted, back in review with draft restored.

---

## Step 16: useKeyboardShortcuts + actionable warnings

**Objective:** Add the keyboard shortcut map and make header warnings clickable with fix-with-default actions.

**Implementation guidance:**
- New: `hooks/useKeyboardShortcuts.ts`. Mounted at the review page root. Listens for `E`, `N`, `Cmd/Ctrl+S`, `A`, `R`, `Escape`. Bails when `document.activeElement` is INPUT/TEXTAREA/SELECT/contenteditable (exception: `Cmd/Ctrl+S` fires regardless with `preventDefault`).
- Update `ReviewHeader` warnings: each warning row includes a `dishId` (when applicable) and a fix type. Click: scroll the right panel to that dish and expand it; apply the fix if it's one-click (e.g., "Assign to Uncategorized" → dispatch `setDishCategory(dishId, uncategorizedId)`).
- Add a small `<KeyboardShortcutHelp>` dropdown in the header showing the map.

**Test requirements:**
- Hook test: simulated keydowns in INPUT focus do not trigger; outside INPUT focus do.
- Component smoke: click warning dispatches expected action.

**Integrates with:** Steps 10, 15 (shell + save modal).

**Demo:** press `E` → all dishes collapse/expand. Press `N` → next flagged dish focused. Press `Cmd+S` while focus is in an input → SavePreviewModal opens (not the browser save dialog). Click a "Missing category" warning → page scrolls to the dish, offers "Fix: Uncategorized"; click → category assigned.

---

## Step 17: Mobile (React Native) kind-badge update

**Objective:** Mobile app accepts the new kind values and renders badges; unknown values fall through to no badge gracefully.

**Implementation guidance:**
- `apps/mobile/src/components/DishPhotoModal.tsx`: replace the two-line `dishKind === 'template'`/`'experience'` checks with a `KIND_BADGE` object lookup per §4.9.
- `apps/mobile/src/screens/restaurant-detail/RestaurantDetailScreen.tsx`: no change (passes `dish_kind` through).
- `apps/mobile/src/stores/restaurantStore.ts`: no change (field is already a raw string).
- Mobile release timing: per Q11.5, ship web first, mobile 1–2 weeks later. This step can merge to main with the web release and ride the mobile team's next build train.

**Test requirements:**
- Component smoke: renders the right badge for each of the 5 kinds; unknown → empty string.

**Integrates with:** Steps 1, 2 (DB has new values; shared types updated — mobile imports from `@eatme/shared`).

**Demo:** open the mobile app in the simulator, load a restaurant whose dishes span the 5 new kinds; each dish detail modal shows the correct badge emoji; a dish with kind `unknown_future_value` shows no badge and doesn't crash.

---

## Step 18: Merge prep — cleanup, docs, final verification

**Objective:** Remove dead code, narrow the `DishKind` type to 5 values, update documentation, run the full manual verification checklist, and prepare the merge.

**Implementation guidance:**
- **Narrow `DishKind`** in `packages/shared/src/types/restaurant.ts` from the transitional 8-value union (Step 2) down to the final 5-value union: `'standard' | 'bundle' | 'configurable' | 'course_menu' | 'buffet'`. Remove the deprecated `DISH_KINDS` 4-value export and the `LEGACY_DISH_KINDS` / `isLegacyKind` helpers (their callers should no longer exist after the normalizer-driven hydration in Steps 8–10 has seen the pre-migration job data through).
- Run `turbo check-types` — any remaining references to old literals fail compilation. Fix each.
- Delete the old hook files that were wrappers-only after store extraction (`useUploadState.ts`, `useProcessingState.ts`, `useReviewState.ts`, `useGroupState.ts`) — consumers should now import selectors directly from the store.
- Delete the old `MenuExtractionList.tsx`, `DishEditPanel.tsx`, `DishGroupCard.tsx` if they were renamed V2; otherwise leave.
- Delete the `Suggest ingredients` dead UI if it was still rendering anywhere.
- Update `CLAUDE.md`: "Dish Classification" section — replace the 4-value list with the 5-value list and `is_template` note. Update the feature flag paragraph as needed.
- Update `agent_docs/*.md` references that cite old kind names.
- Run the full manual verification checklist (§7.5 in design).
- Squash commits / rebase as needed; open the PR against main.

**Release-order dependency:** the narrow type change in this step can only reach production **after Step 6's migration has run there** (otherwise the DB can still contain `experience`/`combo`/`template` values that the narrowed type would reject when rows are read). Two acceptable release patterns:
- **(a)** Hold Step 18's narrow-type commit behind the same gate as Step 6's production migration: release web + mobile after triage is complete and the tighten migration has run.
- **(b)** Ship Step 18's narrow-type commit as a follow-up release after Step 6 runs, leaving the transitional union in place for the initial production cut.

Pattern (a) is cleaner operationally; pattern (b) reduces the chance of a coordinated release blocking on triage speed. Pick one at release time.

**Test requirements:**
- Full `turbo test && turbo check-types && turbo build` green.
- Manual checklist (§7.5) all items ticked.

**Integrates with:** all prior steps.

**Demo:** the PR branch contains only new code, zero references to old kind literals (`rg "'template'|'experience'|'combo'" | grep -v migrations | grep -v __` returns empty), full build green, manual checklist complete.

---

## Notes on sequencing

- **Steps 1–6 are back-end and server-side.** They can be developed and merged to the feature branch in order without affecting the live UI (the live UI still imports old types until Step 2 lands — the feature branch needs all of 1+2 before local dev works cleanly).
- **Steps 7–16 are the front-end rewrite.** Each step replaces a layer; after Step 10 the UI looks unchanged but is store-driven; visual changes accumulate in 11–16.
- **Step 17 is an independent mobile commit** that can ride the next mobile build train; it depends only on Steps 1–2 technically.
- **Step 18** is the merge gate. Nothing ships to production until this step's manual checklist is green.

If any step reveals a design assumption is wrong, return to the design doc and update it before continuing — this plan trusts the design to be internally consistent.

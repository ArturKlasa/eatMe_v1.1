## 2026-04-22 — Step 1 in progress

Context: implementing the 18-step dish-ingestion + menu-scan-review rework.

### Step 1: Schema migration (114_ingestion_rework.sql)

**Status:** Migration file created. Gates:
- `turbo check-types`: passes (no TS changes in step 1 — 0 tasks, all cached)
- `turbo test`: 443/443 pass; 14 pre-existing unhandled errors from `useMenuScanState.test.ts` (`supabase.auth.getUser is not a function`) — confirmed pre-existing, not introduced by step 1
- Migration smoke-run: Docker daemon not running; cannot run `supabase db reset`. Migration SQL reviewed manually for correctness against existing migration patterns.

**Migration contents:**
1. ADD COLUMN: status, is_template, source_image_index, source_region to dishes
2. RELAX dish_kind CHECK to 8-value transitional union
3. AUTO-RENAME: combo→bundle, template→configurable+is_template=true
4. FIX dish_ingredients FK: add ON DELETE CASCADE
5. CREATE dish_courses + dish_course_items with RLS (owner-via-parent pattern)
6. EXTEND menu_scan_jobs: saved_dish_ids + saved_at
7. UPDATE generate_candidates(): added AND d.is_template = false filter

**Note on Docker unavailability:** Docker daemon was not running. Manual review confirms:
- Column additions follow exact pattern from migrations 073, 110
- CHECK constraint relaxation follows exact pattern from migration 073
- RLS policies follow exact pattern from migration 091
- FK cascade follows dish_ingredients FK pattern
- generate_candidates() is a verbatim copy from 111 with one WHERE clause addition

**Design note re admin_audit_log schema:** Step 5's design doc says "entity_type with CHECK ∈ {'restaurant','dish','menu'}" but the actual schema (database_schema.sql) has `resource_type` not `entity_type`. Will flag when Step 5 is reached.

## 2026-04-22 — Step 1 complete

Migration 114_ingestion_rework.sql authored and committed. All pre-existing tests continue to pass. turbo check-types clean (no TS changes in step 1).

## 2026-04-22 — Step 5 complete

Implemented Step 5: Experience triage admin page + audit log.

Changes made:
- `apps/web-portal/app/api/admin/dishes/triage/route.ts` (new): POST endpoint; batch-updates dish_kind (experience→course_menu|buffet); inserts admin_audit_log per dish (resource_type='dish', action='dish_kind_triage', old_data/new_data jsonb); audit failures are non-fatal; 401/403 via verifyAdminRequest.
- `apps/web-portal/app/admin/dishes/experience-triage/page.tsx` (new): client component; fetches legacy dishes (dish_kind IN ['experience','template','combo']); per-row radio (course_menu|buffet); bulk auto-classify via keyword heuristics ('buffet'/'ayce'→buffet, 'tasting'/'prix fixe'→course_menu); save button calls triage API with auth header; redirects to /admin on zero rows.
- `apps/web-portal/components/admin/AdminSidebar.tsx`: added useEffect that checks legacy dish count; conditionally renders "Experience Triage" nav link (RefreshCcw icon, warning color) when count > 0.
- `apps/web-portal/test/experience-triage-api.test.ts` (new): 6 tests — batch update+audit, 401, 400 invalid kind, 400 empty array, partial failure reporting, non-fatal audit failure.

Design discrepancy note: design doc says `entity_type='dish'` but actual admin_audit_log column is `resource_type`. Used `resource_type` per actual schema.

Gates: tsc clean (new files); 471/471 tests pass; commit c0e4ad3.

## 2026-04-22 — Step 3 complete

Implemented Step 3: AI extraction prompt + Zod schema + enrich-dish function update.

Changes made:
- `apps/web-portal/app/api/menu-scan/route.ts`:
  - DishSchema: dish_kind enum updated to 5-value (`standard|bundle|configurable|course_menu|buffet`)
  - Added `CourseSchema` + `CourseItemSchema` Zod schemas; `courses: z.array(CourseSchema).optional()` added to DishSchema
  - `SYSTEM_PROMPT`: rewrote DISH PATTERN DETECTION section with new kind names + COURSE MENU rules; updated 5 few-shot examples
  - `tagSourceImageIndex()`: new helper that recursively sets 0-based `source_image_index` on all dishes after extraction
  - Called `tagSourceImageIndex(dish, pageNumber - 1)` after parsing per image
  - `applyDishDefaults`: added `courses = undefined` for non-course_menu dishes

- `apps/web-portal/lib/menu-scan.ts`:
  - Added `ExtractedCourse` + `ExtractedCourseItem` interfaces
  - `RawExtractedDish.dish_kind` → `DishKind` (transitional union from `@eatme/shared`)
  - Added `courses?: ExtractedCourse[]` and `source_image_index?: number` to `RawExtractedDish`
  - `EditableDish.dish_kind` → `DishKind`; added `source_image_index?: number`
  - `ConfirmDish.dish_kind` → `DishKind`
  - `enrichedToEditable`: propagates `source_image_index` from source dish

- `infra/supabase/functions/enrich-dish/index.ts`:
  - `DishRow`: added `price: number | null`
  - Select updated to include `price`
  - Added `dish_courses` parallel query for `course_menu`/`experience` kinds
  - `evaluateCompleteness`: updated for new kinds (course_menu, buffet, configurable, bundle) while keeping legacy kinds (template, combo, experience) for transition window

- `apps/web-portal/test/menu-scan-api.test.ts` (new): 16 tests — new/legacy kind validation, courses field, source_image_index propagation. Also fixed 3 pre-existing test failures caused by Step 2 kind changes not yet reflected in lib/menu-scan.ts.

Gates: `turbo check-types` green for modified files; `vitest run` 459/459 passed (51 files).

## 2026-04-22 — Step 6 complete

Implemented Step 6: Tighten CHECK migration (operationally gated).

Changes made:
- `infra/supabase/migrations/115_tighten_dish_kind_check.sql` (new): transaction-wrapped migration with DO $$ guard that counts `dish_kind NOT IN (5 canonical values)` and raises exception if n > 0; drops the relaxed 8-value CHECK from migration 114; adds tightened 5-value CHECK. Header comment explicitly states "Do NOT run before triage is complete."
- `apps/web-portal/test/migration-115-tighten-check.test.ts` (new): 10 structural Vitest tests validating guard presence, raise condition, all 5 canonical values in constraint, legacy kinds excluded from constraint, transaction wrapping, guard inside transaction.

Docker Desktop engine not running — live smoke-run (`supabase db reset` + seed `experience` row → expect failure; reclassify → expect success) not executed. SQL validated by manual review against migration 114 patterns. The plan.md Step 6 demo criterion remains for manual execution when local Supabase is available.

Gates: 481/481 tests pass (10 new); tsc pre-existing errors only (edge functions); commit 978be2c.

12 steps remain (7-18).

## 2026-04-22 — Step 7 complete

Implemented Step 7: Zustand store scaffold — uploadSlice + processingSlice.

Changes made:
- `apps/web-portal/package.json`: added `zustand` dependency
- `store/index.ts`: `useReviewStore = create<ReviewStore>()((...a) => ({ ...uploadSlice(...a), ...processingSlice(...a) }))`
- `store/uploadSlice.ts`: all upload-phase state + actions. Setters that had functional-updater callers in existing code (setRestaurants, setShowQuickAdd, setPreviewUrls, setCurrentImageIdx) typed as `T | ((prev: T) => T)` so existing components don't break.
- `store/processingSlice.ts`: `fireProcess` reads selectedRestaurant/imageFiles/isPdfConverting from store via get() — no deps parameter needed.
- `hooks/useUploadState.ts`: rewritten as thin wrapper — React effects (mount-load, query-param preselect) + fileInputRef stay; all state/actions come from useReviewStore selectors.
- `hooks/useProcessingState.ts`: rewritten as thin wrapper — deps param kept for API compat but ignored.
- `store/__tests__/uploadSlice.test.ts`: 12 unit tests (vanilla zustand store, no React).
- `store/__tests__/processingSlice.test.ts`: 5 unit tests covering all fireProcess paths.

Gates: 498/498 tests pass (17 new); tsc clean (only pre-existing test-file errors); commit 34741a0.

11 steps remain (8-18).

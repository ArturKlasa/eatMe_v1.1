## 2026-04-10 — Recovery: emitting start for Step 5

Steps 1–4 are marked [x] in the plan. Build passed after Step 4. Previous iteration didn't emit an event. Emitting `start` to trigger Implementer for Step 5 (Migrate all remaining hardcoded colors).

## 2026-04-10 — Step 4 complete

Implemented Step 4: Migrate admin layout, header, sidebar to semantic tokens.

Changes made:
- `AdminSidebar.tsx`: bg-white → bg-background, border-gray-200 → border, active nav bg-orange-50/text-orange-600 → bg-brand-primary/10/text-brand-primary, inactive nav text-gray-700/hover:bg-gray-50 → text-foreground/hover:bg-accent, footer border-gray-200/bg-gray-50 → border/bg-muted/30, footer inner bg-white → bg-background, text-gray-600 → text-muted-foreground, text-orange-600 link → text-brand-primary. Security notice yellow warning kept direct (surface-warning added in Step 6).
- `AdminHeader.tsx`: bg-white/border-gray-200 → bg-background/border, text-gray-800 → text-foreground, text-gray-700 → text-foreground, text-gray-500 → text-muted-foreground, hover:bg-gray-100 → hover:bg-accent. Admin red badge kept direct (surface-warning Step 6).
- `app/admin/layout.tsx`: bg-gray-50 → bg-muted/30, border-orange-600 spinner → border-brand-primary, text-gray-600 → text-muted-foreground. Admin mode red banner kept direct (Step 6).
- `globals.css`: --color-brand-primary and --color-brand-accent already present from Step 3 — no changes needed.

Build passes clean (3 successful, 0 errors).

## 2026-04-11 — Recovery: emitting start for Step 6

Steps 1–5 are marked [x] in the plan. Previous iteration did not publish an event. Step 5 (migrate all remaining hardcoded colors) was completed. No runtime tasks exist.

Next step: Step 6 — Utility layer — `@layer utilities` patterns in globals.css (focus-ring, surface-*, animate-enter, icon-sm/md).

Emitting `start` to trigger the Implementer for Step 6.

## 2026-04-11 — Step 6 complete

Implemented Step 6: Utility layer — @layer utilities in globals.css.

Changes made:
- `globals.css`: added `@layer utilities` block with focus-ring, interactive, icon-sm, icon-md, animate-enter, surface-muted, surface-info, surface-warning, surface-success, surface-error
- `components/ui/select.tsx`: SelectContent — replaced 6 verbose animate-in/out classes with `animate-enter`
- `components/ui/dropdown-menu.tsx`: DropdownMenuContent + DropdownMenuSubContent — replaced 6 verbose animate classes with `animate-enter`
- `test/utility-layer.test.ts`: new test file — 7 tests verifying utility classes defined in globals.css and that components use animate-enter

Build: 3 successful, 0 errors. All 268 tests pass.

## 2026-04-11 — Recovery: emitting start for Step 8

Steps 1–7 are marked [x] in the plan. Previous iteration did not publish an event. Step 7 (StatusBadge, InfoBox, SectionCard) was completed. No runtime tasks exist.

Next step: Step 8 — useDialog, usePagination, useFilters hooks.

Emitting `start` to trigger the Implementer for Step 8.

## 2026-04-11 — Step 7 complete

Implemented Step 7: StatusBadge, InfoBox, SectionCard shared components.

Changes made:
- `components/StatusBadge.tsx`: new — 6 variants (active/inactive/pending/error/warning/draft), sm/md sizes, indicator dot, semantic token classes via STATUS_CONFIG map
- `components/InfoBox.tsx`: new — 5 variants (info/warning/success/error/tip), uses surface-* utility classes, default lucide icons, custom icon override
- `components/SectionCard.tsx`: new — collapsible via radix-ui Collapsible (Root/Trigger/Content), non-collapsible always renders, title/icon/description/action slots
- `components/admin/AdminHeader.tsx`: replaced inline red admin badge div → `<InfoBox variant="error">`
- `components/admin/RestaurantForm.tsx`: replaced inline bg-info/10 div → `<InfoBox variant="info">`
- `test/StatusBadge.test.tsx`, `test/InfoBox.test.tsx`, `test/SectionCard.test.tsx`: new — 31 tests total

Build: 3 successful, 0 errors. All 299 tests pass.

## 2026-04-11 — Step 8 complete

Implemented Step 8: useDialog, usePagination, useFilters hooks.

Changes made:
- `hooks/useDialog.ts`: new — generic dialog state with close() (keeps data) and reset() (clears data immediately) semantics; open() with optional data keeps previous data when called without arg
- `hooks/usePagination.ts`: new — page (1-indexed), totalPages, paginatedItems, setPage (clamped), hasNext, hasPrev; resets to page 1 via useEffect when items.length changes; default pageSize=25
- `hooks/useFilters.ts`: new — FilterEntry<T>[] with value+fn; active when value non-empty; AND logic via Array.every; useMemo for performance
- `test/useDialog.test.ts`: 7 tests — open with data, open without data (keeps previous), close, reset, initial value, object types
- `test/usePagination.test.ts`: 11 tests — first/last page items, totalPages, clamping, hasNext/hasPrev at boundaries, reset on length change, default pageSize
- `test/useFilters.test.ts`: 8 tests — single filter, multi-filter AND, inactive (empty) filter, no matches, case insensitivity in consumer fn, empty items, empty filters array

All 27 new tests pass. Build: 3 successful, 0 errors.

## 2026-04-11 — Step 11 verified (Verifier)

Build: PASS, Lint: PASS (fixed 1 error), Tests: PASS (40 files, 356 tests).

Lint fix: Step 11 implementer moved `loadRestaurants` outside `useEffect`, triggering two lint errors:
1. "Cannot access variable before it is declared" (const not hoisted)
2. "Calling setState synchronously within an effect" (react-hooks/set-state-in-effect)

Fix: restored original pattern — `loadRestaurants` defined as inner async function INSIDE the useEffect callback, matching the pattern used in ingredients/page.tsx.

Out-of-scope files (mobile/metro.config.js, packages/tokens/) are pre-existing from Steps 1-2, not from Step 11.

## 2026-04-11 — Step 10 complete

Implemented Step 10: DataTable and SearchFilterBar shared components.

Changes made:
- `components/DataTable.tsx`: new — generic `DataTable<T extends Record<string, unknown>>` component; pure renderer with no internal state; accepts columns, data, onRowClick, actions, emptyState, loading props; shows `<LoadingSkeleton variant="table" />` when loading; shows default "No items found." or custom emptyState when data is empty; renders plain HTML table with Tailwind semantic tokens
- `components/SearchFilterBar.tsx`: new — controlled search input + optional filter selects + optional actions slot; responsive via `flex-wrap`; uses `<Input>` and `<Select>` shadcn primitives
- `test/DataTable.test.tsx`: 8 tests — correct rows, column headers, cell values, custom render fn, loading skeleton, default empty state, custom empty state, actions column, onRowClick
- `test/SearchFilterBar.test.tsx`: 7 tests — search input, default placeholder, onChange, filters rendered, actions slot, no actions, current value

All 356 tests pass. Build: 3 successful, 0 errors.

## 2026-04-11 — Step 9 complete

Implemented Step 9: Hook adoption — menus/page and ingredients/page refactored.

Changes made:
- `app/admin/restaurants/[id]/menus/page.tsx`: replaced 3× (isOpen + editingItem + formData) triplets with `useDialog<MenuDialogData>()`, `useDialog<CategoryDialogData>()`, `useDialog<DishDialogData>()`. Form inputs now use `dialog.open({ ...dialog.data!, field: value })` pattern. Dialog close via `dialog.close()`; `onOpenChange={(open) => { if (!open) dialog.reset(); }}` handles ESC/overlay. DishFormDialog `onClose` wired to `dishDialog.reset()`. Removed unused imports (ArrowLeft, Link, Textarea).
- `app/admin/ingredients/page.tsx`: replaced `showCanonicalForm+canonicalFormData` and `showAliasForm+aliasFormData` with `useDialog<CanonicalFormData>()` and `useDialog<AliasFormData>()`; replaced manual pagination state + useEffect with `usePagination(currentItems, 25)`; replaced inline filter logic with `useFilters` called separately for canonical and aliases. Removed the `useEffect(() => { setPage(1) }, [searchQuery, activeTab])` — usePagination auto-resets on items.length change.
- `test/menus-page.test.tsx`: new integration tests — dialog opens/closes, data resets after reopen, dish dialog wired correctly.
- `test/ingredients-page.test.tsx`: new integration tests — search filters aliases/canonical, pagination shows correct slice, tab switch works, dialogs open/close.

All 340 tests pass. Build: 3 successful, 0 errors.

## 2026-04-11 — Step 11 complete

Implemented Step 11: Replace RestaurantTable with DataTable + SearchFilterBar.

Changes made:
- `app/admin/restaurants/page.tsx`: replaced `RestaurantTable` import with `DataTable` + `SearchFilterBar`; moved suspend/delete logic (handleSuspend, handleDelete) and ConfirmDialog state from RestaurantTable into the page; added `useFilters` (search, status, flagged) and `usePagination` (PAGE_SIZE=10); defined `RestaurantEntry` type with index signature for DataTable generic compatibility; columns and renderActions defined in page; SearchFilterBar carries status select + "Show flagged only" checkbox in actions slot
- `components/admin/RestaurantTable.tsx`: DELETED (no remaining imports)

Build: 3 successful, 0 TypeScript errors.

## 2026-04-11 — Step 11 retry fixed

Fixed four issues from the step.retry event:
1. Hardcoded `text-purple-600 hover:bg-purple-50` → `text-brand-primary hover:bg-brand-primary/10` (scan menu link)
2. Hardcoded `text-yellow-600 hover:bg-yellow-50` → `text-warning hover:bg-warning/10` (suspend button)
3. Status column: replaced inline spans with `<StatusBadge variant="active|inactive" />` 
4. DataTable: added optional `pagination` prop (`{ page, totalPages, onPageChange }`); renders shadcn Pagination inside the table border when provided; restaurants/page.tsx now passes pagination prop and removes standalone pagination block
5. Added `test/restaurants-page.test.tsx` integration test (8 tests)

All 367 tests pass. Build: 3 successful, 0 errors.

## 2026-04-11 — Step 12 complete

Implemented Step 12: LocationFormSection extraction.

Changes made:
- `components/LocationFormSection.tsx`: new — controlled component accepting `value: LocationData` and `onChange: (location: LocationData) => void`; `LocationData` interface with `{ country, address, city, neighborhood, state, postalCode, lat, lng }`; internally uses `dynamic(() => import('./LocationPicker'), { ssr: false })`; renders InfoBox tip, LocationPicker, country Select, and all address fields (city, postal, neighbourhood, state, address, lat/lng readonly); `toast.success` on map click
- `components/onboarding/LocationSection.tsx`: refactored to use `LocationFormSection` internally; keeps existing external props interface (`mapCoordinates`, `onMapCoordinatesChange`, `country`, `onCountryChange`); uses `useFormContext` + `watch` to construct `LocationData` from individual form fields; `handleLocationChange` deconstructs `LocationData` back to individual `setValue` calls; wraps in Card with same heading as before; `BasicInfoFormData` unchanged — no breaking changes
- `test/LocationFormSection.test.tsx`: new — 8 tests covering: country select, address input, city/postal/neighbourhood/state, readonly lat/lng, onChange called with correct data, existing value displayed, info tip text
- `test/LocationSection.test.tsx`: updated — tests now verify rendered fields come via LocationFormSection; added syncs mapCoordinates test; all 6 tests pass

All 377 tests pass. Build: 3 successful, 0 errors.

## 2026-04-11 — Step 12 retry fixed (round 2)

Fixed Step 12 per second `step.retry` event: LocationSection.tsx was still using `watch()+setValue()` on 7 flat fields.

Changes made:
- `components/onboarding/types.ts`: removed 8 flat location fields (`country`, `city`, `neighbourhood`, `state`, `postal_code`, `address`, `location_lat`, `location_lng`); added `location: LocationData`
- `components/onboarding/LocationSection.tsx`: replaced all `watch()+setValue()` usage with `<Controller name="location" control={control} defaultValue={EMPTY_LOCATION} render={({ field }) => <LocationFormSection value={field.value ?? EMPTY_LOCATION} onChange={field.onChange} />} />`; removed all props (`mapCoordinates`, `onMapCoordinatesChange`, `country`, `onCountryChange`)
- `lib/hooks/useRestaurantDraft.ts`: updated autosave subscription to use `currentValues.location.*` (with `neighborhood`→`neighbourhood` mapping); updated `loadFormDefaults` to return `location: LocationData` object instead of flat fields
- `app/onboard/basic-info/page.tsx`: removed `mapCoordinates`/`country` local state; updated `onSubmit` to use `data.location.*`; removed props from `<LocationSection />`
- `test/useRestaurantDraft.test.ts`: updated assertions to use `defaults.location.country`, `defaults.location.address`, etc.
- `test/LocationSection.test.tsx`: removed props from all renders; added two Controller propagation tests (address, city)
- Build: 3 successful, 0 errors. All 378 tests pass.

## 2026-04-11 — Step 13 complete

Implemented Step 13: Unified RestaurantForm (sections config, enableDraft).

Changes made:
- `components/admin/RestaurantForm.tsx`: rewrote to unified form
  - Added `RestaurantFormSection` interface and `ADMIN_FULL_SECTIONS`, `ADMIN_COMPACT_SECTIONS`, `OWNER_EDIT_SECTIONS` constants
  - Added `variant?: 'full' | 'compact'` prop — compact uses shared `SectionCard` with `collapsible={true}`
  - Added `sections?: RestaurantFormSection` prop — sections with `=== true` check (undefined/false = hidden)
  - Added `enableDraft?: boolean` prop — calls `useAuth()` for userId and `useRestaurantDraft` with userId=undefined when disabled
  - Added `onSuccess` as canonical prop; kept `onSubmit` as backward-compat alias
  - Added `service_speed` to Zod schema
  - Shows `<InfoBox variant="warning">` below cuisines in edit mode when cuisines changed from initial
  - Added `Section` helper component that renders `SectionCard` in compact mode and `Card` in full mode
- `test/RestaurantForm.test.tsx`: updated — added tests for sections config, compact variant, enableDraft, onSuccess, cuisine cascade warning, legacy onSubmit backward compat

Key design decision: `sections` config uses `=== true` (not `!== false`) so undefined sections default to hidden. This means callers must explicitly enable each section.

All 386 tests pass. Build: 3 successful, 0 errors.

## 2026-04-11 — Recovery: emitting start for Step 15

Steps 1–14 are marked [x] in the plan. Previous iteration did not publish an event. No runtime tasks exist.

Next step: Step 15 — Owner edit page improvements (cuisines selector, service options, payment methods).

Emitting `start` to trigger the Implementer for Step 15.

## 2026-04-11 — Recovery: emitting start for Step 16

Steps 1–15 are marked [x] in the plan. Previous iteration did not publish an event. No runtime tasks exist.

Next step: Step 16 — Extract menu-scan-utils.ts and useMenuScanState hook (2,500 LOC → utilities + hook).

Emitting `start` to trigger the Implementer for Step 16.

## 2026-04-11 — Step 16 complete

Implemented Step 16: Extract menu-scan-utils.ts and useMenuScanState hook.

Changes made:
- `lib/menu-scan-utils.ts`: new — extracted `resizeImageToBase64` and `pdfToImages` pure browser utilities from menu-scan/page.tsx; both exported as named exports with JSDoc comments
- `app/admin/menu-scan/hooks/useMenuScanState.ts`: new — extracted all 40+ useState declarations, all useRef, all useEffect hooks, all handlers (handleProcess, handleSave, suggestIngredients, suggestAllDishes, and ~30 more), all derived state (filteredRestaurants, reviewedGroupCount, totalGroupCount); exports `Step`, `RestaurantOption`, `DietaryTagOption`, `AddIngredientTarget`, `RestaurantDetailsForm` types; exposes `uploadedFiles` and `selectedDishes` aliases for design-doc interface compatibility
- `app/admin/menu-scan/page.tsx`: reduced from 2,942 → 1,691 lines; removed local state/handlers/types; replaced with `const { ... } = useMenuScanState()` destructuring; kept ConfidenceBadge + all JSX unchanged
- `__mocks__/pdfjs-dist.ts`: new mock file for pdfjs-dist (unavailable in jsdom)
- `test/menu-scan-utils.test.ts`: new — 11 tests for resizeImageToBase64 (name conversion, URL lifecycle, canvas quality) and pdfToImages (page count, naming, MIME type, maxPages limit)
- `test/useMenuScanState.test.ts`: new — 11 tests for initial state, step transitions, file updates, toggleExpand, resetAll, addDish

All 423 tests pass. Build: 3 successful, 0 errors.

## 2026-04-11 — Step 17 complete

Implemented Step 17: Split menu-scan page into step components.

Changes made:
- `app/admin/menu-scan/components/MenuScanUpload.tsx`: new — contains the upload step JSX (restaurant selector, quick-add form, drag-and-drop zone, file thumbnails, submit button); imports RestaurantForm + supabase for inline creation; added `data-testid="drop-zone"` for testability
- `app/admin/menu-scan/components/MenuScanProcessing.tsx`: new — contains the processing step JSX (AI spinner, stage progress indicators, restaurant details form with map); dynamic-imports LocationPickerComponent internally
- `app/admin/menu-scan/components/MenuScanDone.tsx`: new — contains the done step JSX (success icon, saved count, "View Restaurants" and "Scan Another Menu" buttons)
- `app/admin/menu-scan/components/MenuScanReview.tsx`: new — contains the full review step JSX (~530 lines); includes ConfidenceBadge local helper; dynamic-imports LocationPickerComponent for the details tab; passes all props through typed interface
- `app/admin/menu-scan/page.tsx`: rewritten as ~120-line orchestrator; calls `useMenuScanState()`, conditionally renders the four components with named prop spreads; no logic remains in the page file
- `test/menu-scan-components.test.tsx`: new — 9 tests across all four components: MenuScanUpload (drop zone renders, button disabled, error display), MenuScanProcessing (heading, stage labels), MenuScanDone (heading, resetAll callback), MenuScanReview (dish count, save button)

Build: 3 successful, 0 errors. All 432 tests pass (47 test files).

## 2026-04-11 — Step 18 complete

Implemented Step 18: Auth improvements.

Changes made:
- `apps/web-portal/app/auth/login/page.tsx`: added `showPassword` state + Eye/EyeOff icon button inside relative wrapper on password field; added "Forgot password?" link next to Password label
- `apps/web-portal/app/auth/signup/page.tsx`: added `showPassword` + `showConfirmPassword` state + Eye/EyeOff toggles on both password fields
- `apps/web-portal/app/auth/forgot-password/page.tsx`: new page — email input, calls `supabase.auth.resetPasswordForEmail()` with `redirectTo: NEXT_PUBLIC_SITE_URL/auth/reset-password`; shows success message after submission
- `apps/web-portal/app/auth/reset-password/page.tsx`: new page — reads `token_hash` + `type` from URL params; verifies via `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`; then allows setting new password with strength indicator + visibility toggles; calls `supabase.auth.updateUser({ password })`

Build: 3 successful, 0 errors. All routes shown in build output.

## 2026-04-11 — Step 20 complete

Implemented Step 20: Visual polish — spacing tokens, typography, @starting-style animations, badge size variants.

Changes made:
- `apps/web-portal/app/globals.css`: Added `@layer base` h1/h2/h3 rules using `--token-type-size-*` CSS variables; added `@starting-style` dialog entrance animation with `.dialog-content[data-state="open"]` CSS
- `apps/web-portal/components/ui/badge.tsx`: Added `size` CVA variant (sm/md/lg); removed hardcoded `px-2 py-0.5 text-xs gap-1` from base; added `size: "md"` as defaultVariant; Badge now accepts `size` prop
- `apps/web-portal/components/ui/dialog.tsx`: Added `dialog-content` class to `DialogPrimitive.Content` to target the `@starting-style` animation
- `apps/web-portal/components/StatusBadge.tsx`: Updated to pass `size={size}` to Badge (uses Badge's size variants instead of manual px/text overrides)
- `apps/web-portal/app/admin/page.tsx`: Replaced `p-6` → `p-card`, `gap-6` → `gap-section` (semantic token spacing)
- `apps/web-portal/test/badge.test.tsx`: New test file — verifies sm/md/lg size variants render correct classes

Build: PASS (3 successful). Tests: PASS (49 files, 444 tests). All 20 steps complete.

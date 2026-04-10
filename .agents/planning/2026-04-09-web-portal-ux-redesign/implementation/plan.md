# Implementation Plan — Web Portal UX/UI Redesign

## Implementation Checklist

- [x] Step 1: Prerequisites — Install dependencies and set up test infrastructure
- [x] Step 2: Design tokens, shared constants, and utility foundations
- [x] Step 3: Core shared UI components — PageHeader, LoadingSkeleton, EmptyState, ConfirmDialog
- [x] Step 4: OnboardingStepper component and onboarding layout wrapper
- [x] Step 5: Extracted form sub-components — OperatingHoursEditor and CuisineSelector
- [x] Step 6: Admin RestaurantForm shared component (new + edit)
- [x] Step 7: DishFormDialog decomposition
- [x] Step 8: Onboarding BasicInfo page decomposition
- [x] Step 9: Admin mode pages — sidebar, dashboard, ingredients, dish categories, restaurant menus
- [x] Step 10: Restaurant owner mode — dashboard, auth pages, review page, restaurant edit
- [x] Step 11: ConfirmDialog integration — replace all window.confirm() calls across 3 files
- [x] Step 12: Menu Scan light touch and final accessibility pass

---

## Step 1: Prerequisites — Install dependencies and set up test infrastructure

**Objective:** Install missing shadcn components and set up Vitest so that every subsequent step can include tests alongside implementation.

**Implementation guidance:**

1. Install missing shadcn components:
   ```bash
   cd eatMe_v1/apps/web-portal
   npx shadcn@latest add skeleton
   npx shadcn@latest add pagination
   ```

2. Install test dependencies:
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
   ```

3. Create `vitest.config.ts` at the web-portal root:
   - Configure jsdom environment
   - Set up path aliases matching `tsconfig.json` (the `@/` alias)
   - Include `@testing-library/jest-dom` setup file

4. Create `test/setup.ts`:
   - Import `@testing-library/jest-dom`

5. Add to `package.json`:
   - `"test": "vitest"` script
   - `"test:run": "vitest run"` for CI

6. Create a trivial smoke test (`test/smoke.test.ts`) to verify the pipeline works.

**Test requirements:**
- Run `npm run test:run` — the smoke test passes
- Vitest resolves `@/` imports correctly

**Integration:** This is the foundation. All subsequent steps depend on this.

**Demo:** Run `npm run test:run` and show passing output.

---

## Step 2: Design tokens, shared constants, and utility foundations

**Objective:** Create the shared constants and design token refinements that all subsequent components will reference.

**Implementation guidance:**

1. Update `globals.css`:
   - Add standardized CSS custom properties for card padding (`--card-padding: 1.5rem`, `--card-padding-compact: 1rem`), section gap (`--section-gap: 1.5rem`)
   - These are additive — don't change existing variables yet

2. Create `lib/ui-constants.ts`:
   - `INGREDIENT_FAMILY_COLORS` — migrate the hardcoded color map from `/app/admin/ingredients/page.tsx`
   - `DIETARY_TAG_COLORS` — migrate from `DietaryTagBadges.tsx`
   - `STATUS_VARIANTS` — active/suspended/pending configs with icon, bg, text, label
   - `SPICE_LEVEL_CONFIG` — consolidate from DishCard and DishFormDialog
   - Export TypeScript types: `ColorVariant`, `StatusConfig`, `PaginationState`

3. Create `components/icons/OAuthIcons.tsx`:
   - Extract the inline Google and Facebook SVGs from `/app/auth/login/page.tsx` and `/app/auth/signup/page.tsx` into `GoogleIcon` and `FacebookIcon` components

4. Create `lib/hooks/useDebounce.ts`:
   - Extract the debounce pattern used in IngredientAutocomplete and BasicInfo auto-save into a reusable hook

**Test requirements:**
- Unit test for `INGREDIENT_FAMILY_COLORS` — verify all 20+ families have valid bg/text keys
- Unit test for `useDebounce` hook — verify debounce timing behavior
- Unit test for OAuthIcons — render without errors

**Integration:** These are leaf dependencies — no integration needed yet. Components in later steps import from these.

**Demo:** Import `INGREDIENT_FAMILY_COLORS` in a test and show it resolves all ingredient families. Render `GoogleIcon` and `FacebookIcon` in a test.

---

## Step 3: Core shared UI components — PageHeader, LoadingSkeleton, EmptyState, ConfirmDialog

**Objective:** Build the four most-reused shared components that will be integrated into nearly every page in subsequent steps.

**Implementation guidance:**

1. Create `components/PageHeader.tsx`:
   - Props: `title`, `description?`, `backHref?`, `breadcrumbs?`, `actions?`, `badge?`
   - Renders: optional back arrow link, optional breadcrumb trail, `<h1>` title, optional description, right-aligned action buttons
   - Uses shadcn `Badge` for the badge prop
   - Responsive: title and actions stack on mobile

2. Create `components/LoadingSkeleton.tsx`:
   - Props: `variant` ("card" | "table" | "form" | "stats" | "page"), `count?`
   - Composes shadcn `Skeleton` primitives into layout-appropriate shapes
   - `stats` variant: 3-column grid of card-shaped skeletons
   - `table` variant: header row + `count` body rows
   - `card` variant: single card with header line + body lines
   - `form` variant: label + input pairs
   - `page` variant: header skeleton + content area skeleton

3. Create `components/EmptyState.tsx`:
   - Props: `icon` (LucideIcon), `title`, `description`, `action?` (button with onClick or href)
   - Centered layout: muted icon (48px, text-muted-foreground), title (text-lg font-medium), description (text-sm text-muted-foreground), optional Button CTA
   - Padding: `py-12` for vertical breathing room

4. Create `components/ConfirmDialog.tsx`:
   - Props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel?` (default "Delete"), `confirmVariant?` (default "destructive"), `onConfirm`, `loading?`
   - Wraps shadcn `AlertDialog` with `AlertDialogAction` and `AlertDialogCancel`
   - Shows loading spinner on confirm button when `loading=true`
   - Focus trapped by AlertDialog by default
   - **Reference implementation:** Model after the existing AlertDialog pattern in `/app/admin/dish-categories/page.tsx` (lines 427-449), which is the only page already using AlertDialog correctly for destructive actions

**Test requirements:**
- `PageHeader`: renders title, renders breadcrumbs when provided, renders back link when backHref set, renders actions slot
- `LoadingSkeleton`: renders correct number of skeleton rows for each variant
- `EmptyState`: renders icon, title, description; renders CTA button when action provided
- `ConfirmDialog`: renders when open=true, calls onConfirm when confirm clicked, calls onOpenChange(false) when cancel clicked

**Integration:** These are standalone — they import only from shadcn `ui/` and Lucide. No wiring into pages yet.

**Demo:** Render each component in isolation in tests. Show all variants of `LoadingSkeleton` pass rendering tests.

---

## Step 4: OnboardingStepper component and onboarding layout wrapper

**Objective:** Build the progress indicator for the 3-step onboarding flow and create the shared layout that wraps all onboarding pages.

**Implementation guidance:**

1. Create `components/OnboardingStepper.tsx`:
   - Props: `currentStep` (1 | 2 | 3), `steps` array of `{ label, description, href }`
   - Horizontal layout with 3 numbered circles connected by lines
   - Completed steps: filled orange circle with checkmark, clickable (links via `href`)
   - Current step: outlined orange circle with step number, highlighted label
   - Future steps: muted gray circle with step number, muted label
   - Connecting lines: orange for completed segments, gray for upcoming
   - Responsive: on mobile, show only step numbers (hide descriptions)

2. Create `/app/onboard/layout.tsx`:
   - Import `OnboardingStepper`
   - Determine `currentStep` from the current pathname:
     - `/onboard/basic-info` → step 1
     - `/onboard/menu` → step 2
     - `/onboard/review` → step 3
   - Render stepper above `{children}` with consistent padding/max-width
   - Use `usePathname()` from next/navigation

3. Configure step definitions:
   ```typescript
   const ONBOARDING_STEPS = [
     { label: "Basic Info", description: "Restaurant details", href: "/onboard/basic-info" },
     { label: "Menu", description: "Add your dishes", href: "/onboard/menu" },
     { label: "Review", description: "Review & submit", href: "/onboard/review" },
   ];
   ```

**Test requirements:**
- `OnboardingStepper`: renders all 3 steps, highlights current step correctly, completed steps are links, future steps are not links
- Step determination from pathname works correctly for all 3 routes

**Integration:** The layout wrapper automatically applies to all `/onboard/*` pages via Next.js nested layouts. No changes to individual onboarding pages required for the stepper to appear.

**Demo:** Navigate through `/onboard/basic-info` → `/onboard/menu` → `/onboard/review` and see the stepper update. Completed steps are clickable.

---

## Step 5: Extracted form sub-components — OperatingHoursEditor and CuisineSelector

**Objective:** Extract the two most-duplicated form patterns into reusable components, reducing code in admin restaurant forms and onboarding BasicInfo.

**Implementation guidance:**

1. Create `components/forms/OperatingHoursEditor.tsx`:
   - Props: `value` (Record of day → {open, close, closed}), `onChange`
   - Extract the operating hours UI from `/app/admin/restaurants/[id]/edit/page.tsx` as the reference implementation (it's cleaner than the onboarding version)
   - Quick-fill buttons: "All days", "Weekdays", "Weekends" — sets same open/close for selected days
   - Day rows: day label (fixed width), shadcn `Checkbox` for closed toggle, two `<input type="time">` with aria-labels ("Opening time for Monday", etc.)
   - Responsive: time inputs stack below day label on small screens
   - Default hours: 09:00–17:00 for new entries

2. Create `components/forms/CuisineSelector.tsx`:
   - Props: `selected` (string[]), `onChange`, `maxDisplay?`
   - Extract from admin restaurant forms / onboarding BasicInfo
   - Selected cuisines shown as orange `Badge` components with X remove button
   - Grid of cuisine options below: toggleable pills
   - Search input to filter the grid
   - "Popular" vs "All" toggle at top of grid
   - Uses the cuisine list from existing constants

3. Do NOT wire into pages yet — these components are tested in isolation in this step:
   - Admin restaurant pages will consume them via `RestaurantForm` in Step 6
   - Onboarding BasicInfo will consume them in Step 8
   - Owner Restaurant Edit will consume `OperatingHoursEditor` in Step 10

**Test requirements:**
- `OperatingHoursEditor`: renders 7 days, toggling closed disables time inputs, quick-fill sets all selected days, onChange fires with correct structure
- `CuisineSelector`: renders selected badges, clicking cuisine toggles selection, search filters grid, remove badge updates selection

**Integration:** Components are standalone with controlled props. Integration into pages happens in Steps 6, 8, and 10.

**Demo:** Run component tests — both pass with correct behavior for all interactions (quick-fill, toggle, search, badge removal).

---

## Step 6: Admin RestaurantForm shared component (new + edit)

**Objective:** Unify the admin restaurant new (779 lines) and edit (831 lines) pages into a single shared form component, eliminating ~70% code duplication.

**Implementation guidance:**

1. Create `components/admin/RestaurantForm.tsx`:
   - Props: `mode` ("create" | "edit"), `initialData?`, `onSubmit`, `onCancel`
   - Uses React Hook Form with Zod validation schema
   - Form sections (using shadcn Card for grouping):
     - Basic Info: name (required), restaurant_type (Select), description (Textarea)
     - Cuisines: `<CuisineSelector>` (from Step 5)
     - Location: `<LocationPicker>` (dynamic import with LoadingSkeleton fallback) + address, city, postal_code, country_code, neighbourhood, state fields + read-only lat/lng
     - Contact: phone, website
     - Service Options: delivery/takeout/dine_in/reservations checkboxes
     - Payment Methods: radio group (cash_only | card_only | cash_and_card)
     - Operating Hours: `<OperatingHoursEditor>` (from Step 5)
   - Submit button shows loading state with spinner
   - Inline field-level validation errors (via React Hook Form `formState.errors`)

2. Refactor `/app/admin/restaurants/new/page.tsx`:
   - Reduce to thin wrapper (~50 lines): AdminLayout check, `<RestaurantForm mode="create" onSubmit={handleCreate} onCancel={...} />`
   - `handleCreate`: inserts to Supabase, redirects to restaurant list

3. Refactor `/app/admin/restaurants/[id]/edit/page.tsx`:
   - Reduce to thin wrapper (~80 lines): fetch restaurant by ID, loading state, `<RestaurantForm mode="edit" initialData={restaurant} onSubmit={handleUpdate} onCancel={...} />`
   - `handleUpdate`: updates Supabase, redirects to restaurant detail

4. Use `PageHeader` (from Step 3) in both page wrappers with appropriate breadcrumbs.

**Test requirements:**
- `RestaurantForm`: renders all sections, required fields show errors on empty submit, mode="create" shows "Create Restaurant" button, mode="edit" shows "Save Changes" button
- Integration: admin new page renders the form, admin edit page loads data and pre-fills form

**Integration:** Admin new and edit pages now use the shared form. The `OperatingHoursEditor` and `CuisineSelector` from Step 5 are composed inside `RestaurantForm`. `PageHeader` from Step 3 provides consistent headers.

**Demo:** Create a new restaurant via `/admin/restaurants/new` → all fields work. Edit an existing restaurant via `/admin/restaurants/[id]/edit` → data pre-fills, save updates correctly.

---

## Step 7: DishFormDialog decomposition

**Objective:** Break the 1,354-line `DishFormDialog` into focused sub-components while preserving all existing functionality.

**Implementation guidance:**

1. Create sub-components in `components/forms/dish/`:

   - `DishBasicFields.tsx`: name, description, price prefix selector, price input, calories, portion size. Uses `useFormContext`.
   - `DishCategorySelect.tsx`: async category dropdown (fetches from Supabase). Manages its own loading state. Uses `useFormContext`.
   - `DishSpiceLevel.tsx`: spice level radio group with icons/labels. Uses spice config from `lib/ui-constants.ts`. Uses `useFormContext`.
   - `DishDietarySection.tsx`: dietary tag checkboxes + allergen checkboxes. Handles vegan→vegetarian auto-select logic. Uses `useFormContext`.
   - `DishIngredientSection.tsx`: wraps `IngredientAutocomplete`, manages `selectedIngredients` state, syncs calculated allergens/dietary tags back to form. Receives `ingredients` and `onIngredientsChange` as props (this state is managed by parent since it's used for allergen calculation).
   - `DishKindSelector.tsx`: standard/template/experience/combo radio. Controls visibility of option sections. Uses `useFormContext`.
   - `DishOptionsSection.tsx`: option group management for template/combo types. Complex nested state — keep this as a self-contained unit.
   - `DishVisibilityFields.tsx`: description_visibility, ingredients_visibility toggles. Uses `useFormContext`.
   - `DishPhotoField.tsx`: photo URL input. Simple. Uses `useFormContext`.

2. Refactor `DishFormDialog.tsx`:
   - Wrap form in `<FormProvider>` from React Hook Form
   - Keep: dialog shell, form initialization, mode detection (wizard vs DB), submit handler
   - Replace inline JSX sections with sub-component imports
   - The orchestrator should be ~200-300 lines (down from 1,354)

3. Key architectural constraint: the `selectedIngredients` state and allergen/dietary calculation logic must stay in the orchestrator (or a custom hook) because multiple sub-components need this data. Create `hooks/useDishIngredients.ts` if the logic is complex enough.

4. Improve `IngredientAutocomplete` (design section 3.2):
   - Add `LoadingSkeleton` for initial suggestion fetch
   - Show inline error message if ingredient search API fails (currently silent `console.error`)
   - Add `aria-label` and `role="combobox"` for accessibility
   - Replace internal debounce with `useDebounce` from Step 2

**Test requirements:**
- `DishBasicFields`: renders name/description/price fields, price prefix changes update display
- `DishCategorySelect`: shows loading state, renders categories after fetch
- `DishDietarySection`: selecting vegan auto-checks vegetarian
- `DishKindSelector`: selecting "template" shows option section
- `IngredientAutocomplete`: shows loading state, shows error on API failure, has role="combobox"
- `DishFormDialog` (integration): full form renders, submit with required fields works

**Integration:** `DishFormDialog` is used by onboarding menu page and admin menu management. Both must still work after decomposition. Test by opening the dish dialog from both contexts.

**Demo:** Open dish form dialog → add a dish with all fields (name, price, category, ingredients, dietary tags, spice level) → save. Verify it works from both onboarding menu and admin menus page.

---

## Step 8: Onboarding BasicInfo page decomposition

**Objective:** Break the 1,027-line BasicInfo page into focused sub-components while preserving the auto-save to localStorage behavior.

**Implementation guidance:**

1. Create `lib/hooks/useRestaurantDraft.ts`:
   - Encapsulate the three data loading scenarios (server-side, no user, localStorage)
   - Expose: `draftData`, `saveDraft`, `isLoading`
   - Handle the `loadRestaurantData` / `saveRestaurantData` calls
   - Debounced auto-save (500ms) via `useDebounce` from Step 2
   - Track and expose `lastSaved` timestamp

2. Create sub-components in `components/onboarding/`:

   - `BasicInfoFields.tsx`: name, restaurant_type, description. Uses `useFormContext`.
   - `LocationSection.tsx`: wraps `LocationPicker` (dynamic import with `LoadingSkeleton` fallback) + address, city, postal_code, country, neighbourhood, state fields + read-only coordinates. Uses `useFormContext`. Handles reverse geocoding callbacks.
   - `ContactFields.tsx`: phone, website. Uses `useFormContext`.
   - `ServiceOptionsSection.tsx`: delivery/takeout/dine_in/reservations checkboxes + service_speed radio. Uses `useFormContext`.
   - `PaymentMethodsSection.tsx`: payment method radio group. Uses `useFormContext`.
   - `AutoSaveIndicator.tsx`: shows "Draft saved" with timestamp, fades out after 3 seconds. Props: `lastSaved` timestamp, `saving` boolean.

3. Refactor `/app/onboard/basic-info/page.tsx`:
   - Wrap form in `<FormProvider>`
   - Use `useRestaurantDraft` hook for data loading and auto-save
   - Use `OperatingHoursEditor` from Step 5 (replaces inline hours UI)
   - Use `CuisineSelector` from Step 5 (replaces inline cuisine grid)
   - Import sub-components for each section
   - Target: ~150-200 lines (down from 1,027)

4. The `watch()` subscription for auto-save moves into `useRestaurantDraft` hook, with refs for cuisine/hours to avoid dependency churn.

5. Improve `LocationPicker` (design section 3.3):
   - Add visible loading state while map and Leaflet initialize (currently blank)
   - Show toast if browser geolocation is denied (currently silently falls back to New York coordinates)
   - Throttle reverse geocoding calls to max 1 per second (currently unthrottled on rapid clicks)
   - (aria-label and console.log cleanup are in Step 12)

**Test requirements:**
- `useRestaurantDraft`: loads from localStorage, debounced save works, returns lastSaved
- `AutoSaveIndicator`: shows timestamp, fades after 3s
- `LocationSection`: renders loading skeleton initially, shows map when loaded
- `LocationPicker`: shows toast on geolocation denial
- `BasicInfoPage` (integration): form renders all sections, auto-save fires on field change

**Integration:** This page now uses `OperatingHoursEditor` and `CuisineSelector` from Step 5, `LoadingSkeleton` from Step 3, and `PageHeader` from Step 3. The onboarding layout from Step 4 provides the stepper above.

**Demo:** Navigate to `/onboard/basic-info` → stepper shows step 1 active → fill in fields → see "Draft saved" indicator → navigate away and back → data persists.

---

## Step 9: Admin mode pages — sidebar, dashboard, ingredients, dish categories, restaurant menus

**Objective:** Apply the shared components and UX improvements to all remaining admin pages.

**Implementation guidance:**

1. **AdminSidebar** (`components/admin/AdminSidebar.tsx`):
   - Remove "Coming Soon" nav items (Users, Settings) and their `opacity-50 cursor-not-allowed` styling
   - Replace 5-bullet security warning panel with single line: "All actions are logged" (yellow-50 badge with Shield icon)
   - Keep: Dashboard, Restaurants, Ingredients, Dish Categories, Menu Scan, Audit Logs

2. **Admin Dashboard** (`/app/admin/page.tsx`):
   - Replace spinner with `<LoadingSkeleton variant="stats" />`
   - Remove "System Status: Secure" banner (low information value)
   - Reduce 5-bullet security reminders to 1-line banner (consistent with sidebar change)
   - Use `PageHeader` with title "Admin Dashboard"
   - Keep stats cards and quick action links

3. **Restaurant List** (`/app/admin/restaurants/page.tsx`):
   - Add `<PageHeader>` with title "Restaurants" and "Add Restaurant" action button
   - Add `<LoadingSkeleton variant="table" />` for initial load
   - Add `<EmptyState>` when no restaurants match filters
   - Add pagination using shadcn `Pagination` (10/25/50 per page selector + page controls)
   - (window.confirm replacement for RestaurantTable happens in Step 11)

4. **Ingredients** (`/app/admin/ingredients/page.tsx`):
   - Replace raw HTML modal overlays (lines ~441-596) with shadcn `Dialog` component
   - Use `INGREDIENT_FAMILY_COLORS` from `lib/ui-constants.ts` (Step 2) instead of hardcoded color map
   - Replace bare HTML checkboxes with shadcn `Checkbox` component
   - Add `<EmptyState>` for empty tables (when search returns no results)
   - Add `<PageHeader>` with title and count
   - Add pagination using shadcn `Pagination` for large lists

5. **Dish Categories** (`/app/admin/dish-categories/page.tsx`):
   - Add `<PageHeader>` with title
   - Add `<EmptyState>` for empty category lists
   - **No ConfirmDialog changes needed** — this page already uses shadcn AlertDialog correctly for both delete and status toggle (lines 427-449). This is the reference pattern for Step 11.

6. **Admin Restaurant Menus** (`/app/admin/restaurants/[id]/menus/page.tsx`):
   - Add `<PageHeader>` with breadcrumbs: Admin > Restaurants > {name} > Menus
   - Add `<EmptyState>` for empty menus/categories
   - (window.confirm replacement happens in Step 11)

7. **Admin Restaurant Detail** (`/app/admin/restaurants/[id]/page.tsx`):
   - Add `<PageHeader>` with breadcrumbs: Admin > Restaurants > {name}
   - Use `STATUS_VARIANTS` from constants for status badges

8. **Audit Logs** — Create `/app/admin/audit/page.tsx`:
   - Simple page using `<EmptyState icon={FileText} title="Audit Logs Coming Soon" description="Action logging is active. The audit viewer is under development." />`

**Test requirements:**
- AdminSidebar: renders only active nav items (no "Coming Soon"), single-line security notice
- Admin Dashboard: renders `LoadingSkeleton` in loading state, renders stats when loaded
- Restaurant List: renders with pagination controls, shows EmptyState when filtered to zero
- Ingredients: Dialog opens for add/edit, family colors from constants render correctly
- Audit Logs page: renders EmptyState with correct message

**Integration:** All admin pages now use `PageHeader`, `LoadingSkeleton`, `EmptyState` from Step 3 and constants from Step 2. Sidebar cleanup affects navigation across all admin pages.

**Demo:** Navigate through admin dashboard → restaurants → ingredients → dish categories → audit logs. Each page has consistent headers, loading states, and empty states. Sidebar is clean with no disabled items.

---

## Step 10: Restaurant owner mode — dashboard, auth pages, review page, restaurant edit

**Objective:** Apply UX improvements to all restaurant owner pages.

**Implementation guidance:**

1. **Owner Dashboard** (`/app/page.tsx`):
   - Remove non-functional Quick Actions cards (Download Template, Settings)
   - Replace spinner with `<LoadingSkeleton variant="card" />`
   - Update "last saved" display: show "Draft saved locally" (with clock icon) vs "Saved" (with check icon) with distinct styling
   - Use `<PageHeader>` with greeting and sign-out button as action

2. **Login Page** (`/app/auth/login/page.tsx`):
   - Replace inline Google SVG (~50 lines) and Facebook SVG (~50 lines) with `<GoogleIcon />` and `<FacebookIcon />` from Step 2
   - Disable OAuth buttons during loading with spinner overlay
   - Add real-time email format validation (show error on blur if invalid format)
   - **Note:** "Forgot Password" functionality does not exist in the codebase (no route, no `resetPasswordForEmail()` call). Adding it is new feature work and out of scope for this UX redesign. Can be added as a follow-up.

3. **Signup Page** (`/app/auth/signup/page.tsx`):
   - Replace inline SVGs with `<GoogleIcon />` and `<FacebookIcon />`
   - Add password strength visual indicator (simple colored bar: red < 6 chars, yellow 6-8, green 8+)
   - Disable OAuth buttons during loading

4. **Onboarding Review** (`/app/onboard/review/page.tsx`):
   - Add summary stats row at top: total menus count, total dishes count, cuisines count (in Badge-styled cards)
   - Remove the 2-second `setTimeout` redirect delay after submission — use `router.push()` immediately after success toast
   - Improve edit button prominence: change from `variant="outline"` to `variant="default"` (filled)
   - Add visual checkmarks next to completed sections

5. **Restaurant Edit** (`/app/restaurant/edit/page.tsx`):
   - Add `<PageHeader>` with breadcrumbs: Dashboard > Edit Restaurant
   - Use `<OperatingHoursEditor>` from Step 5 (replaces inline hours UI)
   - Add inline field-level validation errors (React Hook Form `formState.errors` displayed below inputs)
   - Add unsaved changes warning via `beforeunload` event listener

6. **Onboarding Menu** (`/app/onboard/menu/page.tsx`):
   - Add `<EmptyState>` for menus with no dishes
   - Improve tab overflow for many menus: add `overflow-x-auto` with subtle fade indicators on edges
   - Add `<ConfirmDialog>` for menu deletion and dish deletion — currently these fire immediately with only a toast, no confirmation (see `handleDeleteMenu` line 180 and `handleDeleteDish` line 237)

**Test requirements:**
- Dashboard: does not render Quick Actions cards, shows correct save state labels
- Login: renders OAuthIcon components (not inline SVGs), OAuth buttons disabled during loading
- Signup: password strength indicator renders, changes color based on length
- Review: summary stats render correct counts, no setTimeout in submission logic

**Integration:** Auth pages use OAuthIcons from Step 2. Owner dashboard uses LoadingSkeleton and PageHeader from Step 3. Restaurant edit uses OperatingHoursEditor from Step 5. Review page benefits from the onboarding stepper layout from Step 4.

**Demo:** Full restaurant owner flow: login → dashboard (clean, no placeholder cards) → onboarding with stepper → basic-info → menu → review (with stats) → submit (immediate redirect). Edit existing restaurant with breadcrumbs and hours editor.

---

## Step 11: ConfirmDialog integration — replace all window.confirm() calls across 3 files

**Objective:** Replace all 8 `window.confirm()` / `confirm()` calls across 3 files with the `ConfirmDialog` component for consistent, accessible destructive action confirmation.

**Note:** The onboarding menu page (`/app/onboard/menu/page.tsx`) gets ConfirmDialog in Step 10 (its deletions currently fire with no confirmation — not even `window.confirm()`). The dish categories page (`/app/admin/dish-categories/page.tsx`) already uses AlertDialog correctly — use it as the reference pattern.

**Implementation guidance:**

Each file needs: a `confirmState` object in component state (`{ open: boolean, action: () => void, title: string, description: string }`), and a `<ConfirmDialog>` rendered in the JSX.

1. **RestaurantTable** (`components/admin/RestaurantTable.tsx`) — 3 `window.confirm()` calls:
   - Line 41: delete confirmation (first step)
   - Line 69: delete warning with restaurant name
   - Line 80: double-check confirmation
   - Add `confirmState` useState, render `<ConfirmDialog>` at end of component
   - Consolidate the 2-step delete (confirm + doubleCheck) into a single ConfirmDialog with clear warning text

2. **Ingredients** (`/app/admin/ingredients/page.tsx`) — 2 `confirm()` calls:
   - Line 144: delete canonical ingredient confirmation
   - Line 162: delete alias confirmation
   - Add `confirmState` useState, render `<ConfirmDialog>`

3. **Admin Restaurant Menus** (`/app/admin/restaurants/[id]/menus/page.tsx`) — 3 `confirm()` calls:
   - Line 248: delete confirmation
   - Line 331: delete category confirmation
   - Line 363: delete dish confirmation
   - Add `confirmState` useState, render `<ConfirmDialog>`

4. Pattern for each replacement:
   ```typescript
   // Before:
   if (confirm("Are you sure?")) { await deleteItem(id); }

   // After:
   const [confirmState, setConfirmState] = useState<{
     open: boolean; title: string; description: string; onConfirm: () => void;
   }>({ open: false, title: "", description: "", onConfirm: () => {} });

   // Trigger:
   setConfirmState({
     open: true,
     title: "Delete Restaurant",
     description: "This action cannot be undone. The restaurant and all its data will be permanently removed.",
     onConfirm: () => handleDelete(id),
   });

   // In JSX:
   <ConfirmDialog {...confirmState} onOpenChange={(open) => setConfirmState(s => ({ ...s, open }))} />
   ```

5. Verify after each file: the destructive action still works, but now shows a styled dialog instead of browser confirm.

**Test requirements:**
- For each of the 3 files: confirm dialog appears on delete click, cancel closes dialog without action, confirm executes the delete
- No remaining `window.confirm()` or bare `confirm()` calls in the codebase (grep verification)

**Integration:** `ConfirmDialog` from Step 3 is now used across all 3 files (plus dish-categories already has AlertDialog). All destructive actions have consistent UX.

**Demo:** In admin mode: delete a restaurant → styled dialog appears → cancel → nothing happens → confirm → restaurant deleted. Same pattern for ingredients and menus/dishes.

---

## Step 12: Menu Scan light touch and final accessibility pass

**Objective:** Apply light styling improvements to Menu Scan, fix remaining accessibility issues across the portal, and clean up code artifacts.

**Implementation guidance:**

**Menu Scan light touch:**
1. Standardize card borders and spacing in `DishGroupCard` and `BatchToolbar` to use design tokens from `globals.css`
2. Add upload progress indicator: when processing multi-page PDFs, show a progress bar or "Processing page X of Y" message
3. Standardize badge styling to use consistent color patterns (match `STATUS_VARIANTS` approach)
4. No workflow or interaction changes

**Accessibility pass across all pages:**
1. Icon-only buttons: add `aria-label` to all icon-only buttons (edit, delete, duplicate, back arrows) across:
   - DishCard action buttons
   - RestaurantTable action buttons
   - Admin restaurant detail/menus action buttons
   - All back-arrow navigation buttons
2. Status badges: ensure text labels accompany all color-coded badges (already done in Step 9 via `STATUS_VARIANTS`, verify completeness)
3. Replace emoji usage with Lucide icons in the following components:
   - `components/forms/DishCard.tsx` — replace `⚠️` allergen prefix (line 144) with Lucide `AlertTriangle` icon
   - `components/IngredientAutocomplete.tsx` — replace `🥬` and `🌱` (lines 144, 149, 176, 181, 184) with Lucide `Sprout` and `Leaf` icons
   - `components/forms/dish/DishBasicFields.tsx` (post-Step 7) or `DishFormDialog.tsx` — replace `🍽️` Food / `🥤` Drink / `🌱` Vegan with Lucide `UtensilsCrossed`, `GlassWater`, `Leaf` icons
   - `components/admin/InlineIngredientSearch.tsx` — replace `🌱` (line 126) with Lucide `Leaf`
   - `components/admin/AddIngredientPanel.tsx` — replace `🌱` (lines 308, 398) with Lucide `Leaf`
   - **Note:** `AllergenWarnings.tsx` already uses Lucide `AlertTriangle` — no changes needed
   - **Note:** `DietaryTagBadges.tsx` has no emojis — only needs color map extraction to `DIETARY_TAG_COLORS` from `lib/ui-constants.ts`
4. LocationPicker: add `aria-label="Restaurant location map"` to map container
5. OperatingHoursEditor: verify time inputs have aria-labels (done in Step 5, verify)
6. ProtectedRoute: show "Redirecting to login..." message instead of blank page on auth failure

**Transitions/animations:**
1. Add Tailwind `transition-all duration-200` to card hover states (currently some have `hover:shadow-md` without transition)
2. Ensure shadcn Dialog/AlertDialog components have open/close animations (shadcn defaults handle this, but verify)
3. Add fade-in transition to LoadingSkeleton → loaded content swap (use Tailwind `animate-in fade-in`)
4. No Framer Motion — Tailwind CSS transitions are sufficient for the scope of changes

**Code cleanup:**
1. Remove `console.log` statements from `LocationPicker.tsx`
2. Verify no remaining inline SVGs in auth pages
3. Grep for any remaining `window.confirm()` calls (should be zero after Step 11)
4. Grep for remaining emoji characters in component files (should be zero after this step)
5. Verify consistent card padding across all pages (spot-check 5 pages)

**Test requirements:**
- DishCard: renders Lucide AlertTriangle icon for allergens, no `⚠️` emoji in output
- IngredientAutocomplete: renders Lucide Leaf/Sprout icons, no `🌱`/`🥬` emojis
- DietaryTagBadges: uses colors from `DIETARY_TAG_COLORS` constants (no hardcoded color map)
- ProtectedRoute: shows redirect message (not blank) when unauthenticated
- Accessibility: grep for icon-only buttons without aria-label (should be zero)

**Integration:** This is the final polish step. All prior steps' components are in place. This step touches files across both modes for consistency.

**Demo:** Full walkthrough of both modes:
- Admin: login → dashboard → restaurants → create → edit → ingredients → categories → menu scan → audit logs (coming soon)
- Owner: login → dashboard → onboard step 1 (with stepper) → step 2 → step 3 (with stats) → submit → edit restaurant
- Verify: no browser confirm dialogs, loading skeletons on all data-fetching pages, empty states where appropriate, no emoji-based icons, consistent headers with breadcrumbs.

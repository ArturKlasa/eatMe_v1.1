# Idea Honing — Web Portal Redesign

## Q1: What specifically is wrong with the current style organization?

**Proposed Answer:** Three major problems found through codebase analysis:

1. **Three disconnected color systems** — `@eatme/tokens` (JS objects, used by mobile only), `globals.css` (OKLch CSS variables, partially used), and 312+ hardcoded Tailwind color classes sprinkled across every component. These are never synchronized.

2. **Massive inline className bloat** — Some components have 200-350 character className strings (e.g., `dialog.tsx:72` at 353 chars, `dropdown-menu.tsx` at 280+ chars). No extraction into reusable style patterns.

3. **Inconsistent visual patterns** — Status badges are styled 4 different ways, action button hover states use different shade levels (`-50` vs `-100`), info boxes use 3 different background colors. There's a `STATUS_VARIANTS` constant defined in `ui-constants.ts` but it's never used.

---

## Q2: What does "modern look" mean concretely for this redesign?

**Proposed Answer:** Based on the current tech stack (Tailwind v4 + Radix/shadcn), "modern" means:

- **Cleaner visual hierarchy** — More whitespace, consistent spacing using the existing `--card-padding` and `--section-gap` tokens, fewer competing visual elements per page
- **Refined color palette** — Consolidate the 3 color systems into one. Use semantic color tokens (`--destructive`, `--muted`, `--accent`) instead of raw Tailwind colors
- **Better typography scale** — Consistent heading/body/caption sizing (the tokens package already defines this but web doesn't use it)
- **Subtle animations** — Loading states, transitions between views (Tailwind v4 supports this well)
- **Card-based layouts** — The shadcn Card component exists but isn't consistently used for content grouping

No framework change needed — the existing Tailwind + shadcn/ui stack is already modern; the issue is inconsistent application.

---

## Q3: How should dark mode be implemented?

**Proposed Answer:** The infrastructure is 80% there, needs 3 things:

1. **Wrap root layout with `next-themes` ThemeProvider** — The package is already installed, `globals.css` already has `.dark` variable overrides, shadcn components already have `dark:` prefixes
2. **Add a theme toggle** — Button in the header (both admin and owner views)
3. **Replace 312+ hardcoded color classes** with CSS variable-based alternatives — This is the bulk of the work. Examples: `text-gray-500` → `text-muted-foreground`, `bg-white` → `bg-card`, `border-gray-200` → `border`

The admin layout is the worst offender — it uses `bg-gray-50`, `bg-white`, `border-gray-200` everywhere with zero dark mode support.

---

## Q4: What's the refactoring strategy for oversized files?

**Proposed Answer:** Five files need splitting:

| File | LOC | Strategy |
|------|-----|----------|
| `menu-scan/page.tsx` | 2,921 | Split into FileUploadStep, ProcessingStep, ReviewStep components + extract image/PDF utils to `lib/` + create `useMenuScanState()` hook for the 40+ useState calls |
| `NewRestaurantForm.tsx` | 748 | Merge with RestaurantForm (75% overlap) into single component with `mode` prop. Standardize on react-hook-form + Zod |
| `RestaurantForm.tsx` | 622 | See above — becomes the unified form |
| `menus/page.tsx` | 713 | Extract `useDialog<T>()` hook for the 3 repeated dialog state patterns, extract CRUD operations to service |
| `ingredients/page.tsx` | 685 | Same dialog hook + extract `usePagination()` |

---

## Q5: Should the styling approach change, or just be better organized?

**Proposed Answer:** Keep Tailwind + shadcn/ui (it's the right stack), but fix the organization:

1. **Unify the color system** — Sync `@eatme/tokens` values into `globals.css` CSS variables. All components use tokens via Tailwind utilities mapped to CSS vars (e.g., `text-brand-primary` instead of `text-orange-600`)
2. **Extract repeated patterns** — Create reusable Tailwind class compositions using CVA (already installed) for: status badges, action buttons, info boxes, card sections, form field groups
3. **Expand shadcn/ui component library** — Add missing shared components: DataTable, SearchFilterBar, StatusBadge, InfoBox, SectionCard
4. **`@layer components`** — Add a components layer in `globals.css` for frequently repeated utility combinations

---

## Q6: How should shared design tokens be integrated?

**Proposed Answer:** The `@eatme/tokens` package is well-designed but completely ignored by the web portal. The plan:

1. **Generate CSS variables from `@eatme/tokens`** — Build a small script or Tailwind plugin that converts the JS token objects into CSS custom properties
2. **Map tokens to Tailwind theme** — In `globals.css`, reference generated CSS vars instead of hand-picked OKLch values
3. **Single source of truth** — Mobile and web both consume `@eatme/tokens`, ensuring brand consistency
4. **Remove `ui-constants.ts` color definitions** — The `INGREDIENT_FAMILY_COLORS`, `DIETARY_TAG_COLORS`, and `STATUS_VARIANTS` should move to tokens or become component variants

---

## Q7: What reusable components are missing?

**Proposed Answer:** Based on repeated patterns across 5+ pages:

| Component | Used In | Current State |
|-----------|---------|---------------|
| `DataTable` | restaurants, ingredients, menus | Reimplemented per page with custom pagination, sorting, filtering |
| `SearchFilterBar` | restaurants, ingredients | Inline search inputs + selects per page |
| `StatusBadge` | 16+ places | Same badge pattern repeated with different colors |
| `InfoBox` | forms, onboarding | `bg-[color]-50` boxes with icon + text, 3+ variants |
| `LocationFormSection` | NewRestaurantForm, RestaurantForm, onboarding | Identical LocationPicker + address handling duplicated |
| `SectionCard` | NewRestaurantForm (compact mode only) | Collapsible card with icon + title, should be shared |

Hooks to extract:
- `useDialog<T>()` — replaces 3-useState pattern per dialog
- `usePagination(items, pageSize)` — replaces per-page pagination logic
- `useFilters(items, query, filterFns)` — replaces per-page filter logic

---

## Q8: Should admin and restaurant owner flows share more components?

**Proposed Answer:** Yes, but carefully. The flows have different user mental models:

- **Share**: Form field components (LocationSection, CuisineSelector, OperatingHoursEditor are already shared — extend this), validation schemas (Zod), data types, design tokens
- **Don't merge**: Navigation patterns (sidebar vs stepper), page layouts, auth flows — these serve different purposes
- **Unify restaurant editing**: The owner's `/restaurant/edit` and admin's `/admin/restaurants/[id]/edit` should use the same underlying `RestaurantForm` with a `role: 'owner' | 'admin'` prop that controls which fields are visible/editable

---

## Q9: What's the priority order for this work?

**Proposed Answer:**

**Phase 1 — Foundation (style system + dark mode)**
1. Sync `@eatme/tokens` → CSS variables → Tailwind theme
2. Wire up `next-themes` ThemeProvider + toggle
3. Replace hardcoded colors with semantic tokens (312+ instances)
4. Audit and fix dark mode across all pages

**Phase 2 — Component library (reduce code, improve consistency)**
5. Create shared components: DataTable, SearchFilterBar, StatusBadge, InfoBox, SectionCard
6. Extract hooks: useDialog, usePagination, useFilters
7. Unify RestaurantForm (merge New + Edit, standardize on react-hook-form)
8. Extract LocationFormSection shared between forms

**Phase 3 — Page refactoring (reduce LOC, improve UX)**
9. Split menu-scan/page.tsx into step components + hooks
10. Refactor menus/page.tsx and ingredients/page.tsx using new shared components
11. Unify owner vs admin restaurant editing

**Phase 4 — UX polish**
12. Consistent spacing, typography, animations
13. Responsive improvements
14. Loading states and empty states polish

---

## Q10: What testing strategy should accompany the redesign?

**Proposed Answer:**

- **Existing tests**: 24 test files with Vitest + Testing Library — keep and update as components change
- **Per refactored component**: Write tests alongside each extraction (TDD approach per implementation plan)
- **Visual regression**: Consider adding Storybook or Chromatic for the new shared components (DataTable, StatusBadge, etc.) to catch visual regressions
- **Dark mode testing**: Each component should be tested in both light and dark modes
- **Snapshot tests**: For shared UI components to catch unintended style changes

---

## Q11: What's the expected LOC reduction?

**Proposed Answer:** Conservative estimate based on identified duplications:

| Refactor | Current LOC | Estimated After | Savings |
|----------|-------------|-----------------|---------|
| Merge RestaurantForms | 1,370 | ~700 | ~670 |
| Split menu-scan + extract utils | 2,921 | ~2,400 (same total but organized) | ~500 (shared utils) |
| Shared DataTable + hooks | ~800 across pages | ~400 | ~400 |
| Color hardcoding → tokens | N/A (less code per className) | N/A | ~200 (shorter class strings) |
| Dialog/pagination hooks | ~300 across pages | ~150 | ~150 |
| **Total estimated savings** | | | **~1,900 LOC** |

Plus significant improvement in readability and maintainability.

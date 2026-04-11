# Web Portal Redesign — Detailed Design

## Overview

This document describes the redesign of the EatMe web-portal, covering both the admin and restaurant owner views. The goal is threefold:

1. **Visual modernization** — consistent design language, dark mode, refined typography and spacing
2. **Developer experience** — reduce code duplication, unify the style system, extract shared components and hooks
3. **UX improvements** — fix broken flows (onboarding step order), improve mobile responsiveness, reduce page complexity

The existing stack (Next.js 16, React 19, Tailwind v4, Radix UI/shadcn, Supabase) is kept unchanged. This is a redesign within the current architecture, not a rewrite.

**Estimated code reduction:** ~1,900 lines of code eliminated through deduplication and extraction.

---

## Detailed Requirements

### R1: Style System Unification
- Establish a single source of truth for all design tokens: `@eatme/tokens` → CSS variables → Tailwind utilities
- Eliminate all 312+ hardcoded Tailwind color classes (e.g., `text-gray-500`, `bg-orange-600`)
- Replace with semantic token classes (`text-muted-foreground`, `bg-brand-primary`)
- Add a `@layer utilities` block to `globals.css` for frequently repeated class combinations
- Align brand colors: resolve the mismatch between `@eatme/tokens` (blue primary) and web (orange primary). Web's orange brand identity takes precedence — update tokens package to reflect this.
- **Token format:** `@eatme/tokens` stores colors as hex. The generate-css-vars script outputs them in `oklch()` format (converting via the `culori` library, already in the JS ecosystem) so they remain consistent with the existing OKLch palette in `globals.css` and work correctly with Tailwind v4's dark mode color mixing.

### R2: Dark Mode
- Wire up `next-themes` ThemeProvider (package already installed)
- Add a theme toggle button visible in both admin header and owner header
- Fix admin layout: replace all hardcoded `bg-gray-50`, `bg-white`, `border-gray-200` with semantic tokens
- Replace remaining 312+ hardcoded colors across all pages and components
- Persist dark mode preference in localStorage (built into next-themes)

### R3: Modern Visual Design
- Consistent spacing using existing `--card-padding`, `--section-gap` CSS tokens (currently defined but unused)
- Consistent card-based layouts using the shadcn `<Card>` component
- Consistent typography scale: `@eatme/tokens` typography values are in pixels (React Native units). The generate-css-vars script converts them to `rem` (dividing by 16) before outputting to `tokens.css`. Web-specific typographic overrides (line-height, letter-spacing) remain in `globals.css` directly.
- Subtle entrance animations using CSS `@starting-style` (native CSS feature, supported by Tailwind v4's animation utilities) for dialogs/modals
- Badge size variants added to shadcn badge component (sm/md/lg)

### R4: Mobile Responsiveness
- All pages must have proper responsive breakpoints
- Fix review page `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
- Menu tabs: replace horizontal scroll with responsive wrapping on small screens
- Form button groups: `flex-col sm:flex-row` stacking on mobile
- Dialog height: use `max-h-[100dvh]` (`dvh` = dynamic viewport height, correctly accounts for mobile browser chrome collapsing/expanding) instead of `max-h-[90vh]`
- Dialog bottom padding: add `pb-[env(safe-area-inset-bottom)]` to dialog footers so action buttons aren't obscured by iOS home indicator

### R5: Shared Component Library (new components)
- `DataTable` — generic sortable/filterable/paginated table replacing per-page reimplementations
- `SearchFilterBar` — search input + filter selects, shared across admin pages
- `StatusBadge` — semantic status display (active/suspended/pending/draft) replacing 16+ inline badge patterns
- `InfoBox` — icon + text info/warning/tip box with variants (info/warning/success/error)
- `SectionCard` — collapsible card with icon + title, used in forms

### R6: Shared Hooks
- `useDialog<T>()` — replaces the 3-useState pattern (`isOpen`, `editingItem`, `formData`) used per dialog across menus, ingredients, restaurants pages
- `usePagination(items, pageSize)` — replaces per-page pagination reimplementations
- `useFilters<T>(items, searchQuery, filterFns)` — replaces per-page filter logic

### R7: Form Unification
- Merge `NewRestaurantForm.tsx` (748 LOC) and `RestaurantForm.tsx` (622 LOC) into a single `RestaurantForm` component
- Accept `mode: 'create' | 'edit'` and `variant: 'full' | 'compact'` props
- Standardize on `react-hook-form + Zod` (RestaurantForm's current approach)
- Extract `LocationFormSection` as a shared component reused across admin and owner forms

### R8: Page Refactoring
- Split `menu-scan/page.tsx` (2,921 LOC) into step components: `MenuScanUpload`, `MenuScanProcessing`, `MenuScanReview`
- Extract image/PDF utilities from menu-scan page to `lib/menu-scan-utils.ts`
- Extract `useMenuScanState()` hook for the 40+ useState calls
- Refactor `menus/page.tsx` and `ingredients/page.tsx` using new shared hooks and components

### R9: Onboarding UX Fixes
- Fix step routing: Basic Info → Menu → Review (currently skips menu)
- Add password visibility toggle on login/signup
- Add "Forgot Password" link — requires a new `/auth/forgot-password` page with an email input that calls Supabase `resetPasswordForEmail()`. Also add `/auth/reset-password` callback page to handle the email link. Fix double-feedback on OAuth errors (currently shown in both Alert and toast — use Alert only).
- Make restaurant name optional at signup (can be filled during onboarding); update user metadata schema accordingly
- Add responsive grid to review page stats

### R10: Performance Quick Wins
- Remove unused `mapbox-gl` and `react-map-gl` dependencies (~700KB)
- Add `middleware.ts` for auth redirects — check session cookie before rendering protected routes, redirect unauthenticated users to `/auth/login` instead of letting the page render then redirect
- Add `loading.tsx` route files for key routes (`app/loading.tsx`, `app/admin/loading.tsx`) — Next.js App Router renders these as instant skeleton placeholders while the page component loads. This is the correct approach for client component pages (Suspense boundaries work with RSC data fetching, not `useEffect`; our pages are all `'use client'` so `loading.tsx` is the right tool)
- Add `web-vitals` reporting (one import, no new infrastructure)

### R11: Owner Edit Page Improvements
- Add cuisine re-selection to restaurant edit page
- Add service options (delivery/takeout/dine-in) editing
- Add payment methods editing
- Unify with admin edit form via shared `RestaurantForm` component
- **Cuisine cascade warning:** When a restaurant owner changes cuisines, existing dish categories may no longer match the new cuisine. The edit form must display a warning: "Changing cuisines will not remove existing dishes, but some dish categories may no longer be available. Review your menu after saving." No automatic cascade — dishes remain as-is; the warning is informational.

---

## Architecture Overview

```mermaid
graph TB
    subgraph "Design Token Pipeline"
        T[packages/tokens/src/*.ts] -->|generate-css-vars script\nhex → oklch + px → rem| CV[app/tokens.css\nCSS Custom Properties]
        CV -->|@import| GC[app/globals.css\n@theme inline]
        GC -->|Tailwind utilities| C[Components]
    end

    subgraph "Component Hierarchy"
        UI[components/ui/\n18 shadcn primitives]
        SH[Shared Components\nDataTable, SearchFilterBar\nStatusBadge, InfoBox, SectionCard]
        FE[Feature Components\nRestaurantForm, LocationFormSection\nDishFormDialog, OperatingHoursEditor]
        LY[Layouts\nAdminLayout, OnboardingLayout\nOwnerLayout — all include ThemeToggle]
        PG[Pages\nAdmin + Owner views]
        UI --> SH
        UI --> FE
        SH --> FE
        SH --> PG
        FE --> PG
        LY --> PG
    end

    subgraph "Shared Hooks"
        HD[useDialog&lt;T&gt;\nusePagination\nuseFilters\nuseMenuScanState\nuseRestaurantDraft]
        HD --> PG
        HD --> FE
    end

    subgraph "Lib / Services"
        LB[lib/restaurantService.ts\nlib/menu-scan.ts\nlib/menu-scan-utils.ts\nlib/constants.ts]
        LB --> PG
        LB --> FE
    end
```

### Key Architectural Decisions

**Keep the current stack** — No framework changes. The problems are organizational.

**CSS-first token pipeline** — Tokens flow from `@eatme/tokens` (JS) → generated CSS variables → Tailwind theme. This gives type-safe token access in React (mobile pattern) AND utility class access in Tailwind (web pattern).

**Unified RestaurantForm** — A single component with mode/variant props eliminates 75% overlap between create and edit forms. Both admin and owner use the same component.

**Hooks over context** — Dialog state, pagination, and filters are extracted into hooks (not context providers) to keep components testable and independent.

---

## Components and Interfaces

### New Shared Components

#### `DataTable<T>`

The parent page is responsible for filtering and searching (via `useFilters()` and `usePagination()` hooks). `DataTable` is a pure rendering component — it receives already-filtered, already-paginated data. This keeps the component simple, predictable, and easy to test.

```tsx
interface DataTableProps<T> {
  data: T[]           // pre-filtered, pre-paginated by parent
  columns: ColumnDef<T>[]
  onRowClick?: (row: T) => void
  actions?: (row: T) => ReactNode
  emptyState?: ReactNode
  loading?: boolean
}
```

#### `SearchFilterBar`
```tsx
interface SearchFilterBarProps {
  search: { value: string; onChange: (v: string) => void; placeholder?: string }
  filters?: Array<{
    label: string
    value: string
    onChange: (v: string) => void
    options: Array<{ label: string; value: string }>
  }>
  actions?: ReactNode  // e.g., "New Restaurant" button
}
```

#### `StatusBadge`
```tsx
type StatusVariant = 'active' | 'inactive' | 'pending' | 'error' | 'warning' | 'draft'

interface StatusBadgeProps {
  variant: StatusVariant
  label?: string  // override default label
  size?: 'sm' | 'md'
}
```

#### `InfoBox`
```tsx
type InfoBoxVariant = 'info' | 'warning' | 'success' | 'error' | 'tip'

interface InfoBoxProps {
  variant?: InfoBoxVariant  // default: 'info'
  icon?: ReactNode           // override default icon
  children: ReactNode
  className?: string
}
```

#### `SectionCard`
```tsx
interface SectionCardProps {
  title: string
  icon?: ReactNode
  description?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  children: ReactNode
  action?: ReactNode  // optional header action (e.g., "Edit" link)
}
```

### Updated RestaurantForm

The `role` prop antipattern (scattering `if (role === 'admin')` conditionals inside the component) is avoided. Instead, the caller passes an explicit field configuration object. The component renders whatever sections are enabled — it has no knowledge of who is calling it.

```tsx
interface RestaurantFormSection {
  basicInfo?: boolean       // name, description, type
  contact?: boolean         // phone, website, email
  location?: boolean        // address + map picker
  cuisines?: boolean        // cuisine multi-select
  operatingHours?: boolean  // weekly schedule
  serviceOptions?: boolean  // delivery/takeout/dine-in, speed, payment
}

// Sensible defaults per call site:
const ADMIN_FULL_SECTIONS: RestaurantFormSection = {
  basicInfo: true, contact: true, location: true,
  cuisines: true, operatingHours: true, serviceOptions: true,
}
const OWNER_EDIT_SECTIONS: RestaurantFormSection = {
  basicInfo: true, contact: true, location: true,
  cuisines: true, operatingHours: true, serviceOptions: true,
}
const ADMIN_COMPACT_SECTIONS: RestaurantFormSection = {
  basicInfo: true, location: true, cuisines: true,
}

interface RestaurantFormProps {
  mode: 'create' | 'edit'
  variant?: 'full' | 'compact'  // compact: collapsible SectionCards (used in menu-scan)
  sections?: RestaurantFormSection
  initialData?: Partial<Restaurant>
  enableDraft?: boolean          // when true, wires up useRestaurantDraft auto-save (owner onboarding only)
  onSuccess?: (restaurant: Restaurant) => void
  onCancel?: () => void
}
```

### New Shared Hooks

#### `useDialog<T>`
```tsx
function useDialog<T>(initial?: T): {
  isOpen: boolean
  data: T | null
  open: (data?: T) => void
  close: () => void   // sets isOpen: false, keeps data (for exit animation — data cleared after animation)
  reset: () => void   // sets isOpen: false AND clears data immediately
}
```
Replaces: `const [isOpen, setIsOpen] = useState(false); const [editingItem, setEditingItem] = useState(null); const [formData, setFormData] = useState({})`

#### `usePagination<T>`
```tsx
function usePagination<T>(items: T[], pageSize?: number): {
  page: number
  totalPages: number
  paginatedItems: T[]
  setPage: (page: number) => void
  hasNext: boolean
  hasPrev: boolean
}
```

#### `useFilters<T>`
```tsx
function useFilters<T>(
  items: T[],
  searchQuery: string,
  filterFns: FilterFn<T>[]
): T[]
```

#### `useMenuScanState`
```tsx
// Extracts the 40+ useState calls from menu-scan/page.tsx
function useMenuScanState(): {
  step: 'upload' | 'processing' | 'review' | 'done'
  uploadedFiles: File[]
  processingProgress: {
    stage: string
    percent: number
    currentFile: number
    totalFiles: number
  }
  scanResults: ScanResult | null
  reviewState: {
    expandedDishes: Set<string>
    selectedDishes: Set<string>
    flaggedDuplicates: string[]
  }
  actions: {
    setFiles: (files: File[]) => void
    startProcessing: () => Promise<void>
    resetToUpload: () => void
    toggleDish: (id: string) => void
    selectAll: () => void
    clearSelection: () => void
    confirmImport: () => Promise<void>
  }
}
```

### Theme Toggle Component
```tsx
// Placed in AdminHeader and owner header
function ThemeToggle(): ReactNode
// Uses next-themes useTheme() hook
// Sun/Moon icon, cycles light/dark/system
```

---

## Data Models

No database schema changes. The redesign is purely UI/code organization.

### New TypeScript Types (for shared components)

```typescript
// For DataTable (parent pre-filters and pre-paginates; DataTable only renders)
interface ColumnDef<T> {
  key: keyof T | string
  header: string
  render?: (value: unknown, row: T) => ReactNode
  width?: string
}

// For useFilters hook
type FilterFn<T> = (item: T, value: string) => boolean

// For StatusBadge
const STATUS_CONFIG: Record<StatusVariant, { label: string; className: string }> = {
  active:   { label: 'Active',   className: 'bg-success/10 text-success border-success/20' },
  inactive: { label: 'Inactive', className: 'bg-muted text-muted-foreground' },
  pending:  { label: 'Pending',  className: 'bg-warning/10 text-warning border-warning/20' },
  error:    { label: 'Error',    className: 'bg-destructive/10 text-destructive border-destructive/20' },
  warning:  { label: 'Warning',  className: 'bg-warning/10 text-warning border-warning/20' },
  draft:    { label: 'Draft',    className: 'bg-muted text-muted-foreground' },
}
```

---

## Token Pipeline Design

### Token Generation Script
`packages/tokens/scripts/generate-css-vars.ts`

```typescript
// Converts @eatme/tokens JS objects → CSS custom properties
// Run: pnpm --filter @eatme/tokens generate:css
// Output: apps/web-portal/app/tokens.css
//
// Conversions applied:
//   colors (hex)        → oklch() via `culori` npm package (consistent with existing globals.css)
//   spacing (px number) → rem (divide by 16)
//   typography sizes    → rem (divide by 16)
//   border radius (px)  → rem (divide by 16)
//   shadows             → web box-shadow format (React Native shadow props are skipped)
//
// Naming convention: --token-{category}-{name}
// e.g., colors.accent          → --token-color-accent: oklch(0.715 0.168 55.4)
//       spacing.md             → --token-space-md: 0.75rem
//       typography.sizes.base  → --token-type-size-base: 1rem
```

### Updated globals.css Structure

```css
/* 1. Tailwind v4 base */
@import 'tailwindcss';

/* 2. Generated token values */
@import './tokens.css';

/* 3. Component utilities */
@layer utilities {
  .focus-ring-primary { ... }
  .interactive-base { ... }
  .icon-auto-size { ... }
  .enter-animation { ... }
  .status-badge-base { ... }
  .info-box-base { ... }
}

/* 4. Theme mapping (light) */
@theme inline {
  /* Brand — sourced from generated token vars */
  --color-brand-primary:      var(--token-color-brand-primary);
  --color-brand-accent:       var(--token-color-accent);
  --color-brand-accent-dark:  var(--token-color-accent-dark);

  /* Semantic */
  --color-success:     var(--token-color-success);
  --color-warning:     var(--token-color-warning);
  --color-info:        var(--token-color-info);

  /* Spacing (mapped from token scale) */
  --spacing-card:     var(--token-space-card);
  --spacing-section:  var(--token-space-section);

  /* ... other tokens */
}

/* 5. Dark mode overrides */
.dark {
  --color-background:   var(--token-color-dark);
  --color-foreground:   var(--token-color-dark-text);
  --color-card:         var(--token-color-dark-secondary);
  --color-border:       var(--token-color-dark-border);
  /* ... full dark palette */
}
```

---

## File Structure Changes

### New Files
```
apps/web-portal/
├── app/
│   ├── tokens.css                         # Generated from @eatme/tokens (hex→oklch, px→rem)
│   ├── loading.tsx                        # Route-level skeleton for owner dashboard
│   ├── middleware.ts                      # Auth redirect before page render
│   ├── auth/
│   │   ├── forgot-password/
│   │   │   └── page.tsx                   # Email input → resetPasswordForEmail()
│   │   └── reset-password/
│   │       └── page.tsx                   # Supabase callback for email reset link
│   └── admin/
│       ├── loading.tsx                    # Route-level skeleton for admin dashboard
│       └── menu-scan/
│           ├── components/
│           │   ├── MenuScanUpload.tsx      # Step 1: file upload
│           │   ├── MenuScanProcessing.tsx  # Step 2: progress view
│           │   └── MenuScanReview.tsx      # Step 3: review/edit results
│           └── hooks/
│               └── useMenuScanState.ts    # Extracted state (40+ useState → 1 hook)
├── components/
│   ├── DataTable.tsx                      # Generic table (renders pre-filtered data)
│   ├── SearchFilterBar.tsx                # Search + filters (state owned by parent)
│   ├── StatusBadge.tsx                    # Semantic status display
│   ├── InfoBox.tsx                        # Info/warning/success/error/tip boxes (5 variants)
│   ├── SectionCard.tsx                    # Collapsible form section
│   ├── ThemeToggle.tsx                    # Light/dark/system switcher
│   └── LocationFormSection.tsx            # Shared location picker + address fields
├── hooks/
│   ├── useDialog.ts                       # Generic dialog state (close vs reset semantics)
│   ├── usePagination.ts                   # Pagination logic
│   └── useFilters.ts                      # Filter/search logic
└── lib/
    └── menu-scan-utils.ts                 # Image resize + PDF conversion (extracted from page)
packages/tokens/
└── scripts/
    └── generate-css-vars.ts              # Token → CSS pipeline (uses culori for hex→oklch)
```

### Modified Files (key changes)
```
apps/web-portal/
├── app/
│   ├── layout.tsx                          # + ThemeProvider wrapper
│   ├── admin/layout.tsx                    # Replace hardcoded colors with semantic tokens
│   ├── admin/restaurants/[id]/menus/
│   │   └── page.tsx                        # Use useDialog hook (removes 3× dialog useState)
│   ├── admin/ingredients/
│   │   └── page.tsx                        # Use useDialog + usePagination + useFilters hooks
│   ├── onboard/basic-info/page.tsx         # Fix: navigate to /onboard/menu not /onboard/review
│   ├── auth/login/page.tsx                 # + password toggle, forgot password link, fix double-error
│   ├── auth/signup/page.tsx                # Restaurant name optional; fix double-error feedback
│   └── restaurant/edit/page.tsx            # + cuisines (with cascade warning), service options, payment
├── components/
│   ├── admin/
│   │   ├── RestaurantForm.tsx              # Unified form with sections config + enableDraft prop
│   │   ├── RestaurantTable.tsx             # Refactored to use DataTable + SearchFilterBar
│   │   ├── AdminHeader.tsx                 # + ThemeToggle, replace hardcoded colors
│   │   └── AdminSidebar.tsx               # Replace hardcoded colors with semantic tokens
│   └── ui/
│       └── badge.tsx                       # + size variants (sm/md/lg)
```

### Deleted Files
```
apps/web-portal/
└── components/
    └── admin/
        └── NewRestaurantForm.tsx           # Merged into RestaurantForm.tsx
```

---

## Error Handling

### Current State
- Mix of inline error state + toast notifications
- Some errors shown in both Alert and toast (double feedback)
- No retry mechanisms
- No network timeout handling

### Target State

**Pattern:** Single feedback channel per error type
- **Form validation errors** → inline field errors only (react-hook-form handles this)
- **API/network errors** → toast only (non-blocking, dismissible)
- **Auth errors** → Alert component in the form (persistent, until user fixes)
- **Critical errors** → existing error boundary (no change needed)

**No retry logic added** — out of scope for this redesign (would require significant backend changes).

---

## Testing Strategy

### Existing Tests (keep + update)
- 26 existing test files — update imports and component names as components are refactored
- Do not delete tests; update them to match new component interfaces

### New Tests Required (per step in implementation plan)
Each new shared component and hook must have tests written alongside:
- `DataTable` — render columns, empty state, loading state, actions column, row click
- `StatusBadge` — all 6 variants render with correct label and class
- `InfoBox` — all 5 variants (info/warning/success/error/tip), custom icon override, children rendering
- `useDialog` — open with/without data, close (keeps data), reset (clears data), type safety
- `usePagination` — page navigation, boundary conditions (first/last page), pageSize changes
- `useFilters` — single filter, multiple filters, no matches, query reset
- `RestaurantForm` (unified) — create mode, edit mode, compact variant, sections config, enableDraft wiring
- `LocationFormSection` — renders map, address selection callback, lat/lng propagation
- `generate-css-vars.ts` — outputs valid CSS, hex values converted to oklch, px values converted to rem, dark theme variables present
- `useMenuScanState` — step transitions, file setting, action callbacks

### Coverage Goals
- All new shared components: 90%+ coverage
- All new hooks: 100% coverage (pure logic, easy to test)
- Refactored pages: maintain existing coverage; add tests for new behavior
- Token generation script: 100% coverage (critical infrastructure)

### Dark Mode Testing Setup
Dark mode tests require `ThemeProvider` from `next-themes`. Add to `test/setup.ts`:
```tsx
// Wrap renders in a forced-theme provider
export function renderDark(ui: ReactElement) {
  return render(
    <ThemeProvider forcedTheme="dark" attribute="class">
      {ui}
    </ThemeProvider>
  )
}
```
Components should be tested in both `render()` (light) and `renderDark()` (dark) to verify correct class application.

---

## Appendices

### A. Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| CSS styling | Tailwind v4 + CSS variables | Keep existing; it's modern and correct |
| Component library | Radix UI + shadcn/ui | Keep existing; already comprehensive |
| Dark mode | next-themes | Already installed; well-maintained |
| Form validation | react-hook-form + Zod | Keep existing; standardize across all forms |
| Token pipeline | Custom generate-css-vars.ts script + `culori` | Simple, minimal deps; `culori` handles hex→oklch conversion; Style Dictionary is overkill for a single CSS output |
| Color format | OKLch (keep) | Best perceptual consistency for dark mode |

### B. Research Findings Summary

**Style issues (312+ hardcoded colors)**
- Root cause: three parallel color systems never synchronized
- Fix: token pipeline + semantic class migration

**Dark mode (infrastructure exists, not wired up)**
- Root cause: next-themes ThemeProvider never added to layout
- Fix: one-time wrap + color token migration

**Large files (menu-scan 2,921 LOC, forms 747+622 LOC)**
- Root cause: no extraction conventions, state accumulated in pages
- Fix: step components + hooks extraction

**Test coverage (26%)**
- Largest untested files are all refactoring targets
- Must add tests before refactoring these files

**Unused dependencies**
- mapbox-gl + react-map-gl (~700KB) never imported
- Remove in first PR

**Performance**
- 77 client components, 0 server components, 0 Suspense boundaries
- Adding middleware + Suspense is in scope; full RSC migration is not

### C. Alternative Approaches Considered

**CSS Modules instead of Tailwind**
- Rejected: would require rewriting all 63 components; Tailwind v4 is modern and well-suited

**Design system from scratch (Figma → tokens → code)**
- Rejected: existing OKLch color system and shadcn components are high quality; the issue is consistency of use, not the system itself

**Migrate to Next.js Server Components throughout**
- Rejected: most pages require client-side interactivity (forms, dialogs, real-time state); RSC migration would be a separate project

**Use Tailwind's built-in `tailwind.config.ts` instead of CSS-first**
- Rejected: Tailwind v4 recommends CSS-first; the existing `@theme inline` setup is correct; moving back to JS config would be regression

**Storybook for visual regression**
- Deferred: valuable but out of scope for this redesign; add after implementation

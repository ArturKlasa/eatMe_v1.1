# UX and Component Organization Issues

## Largest Files (Refactoring Targets)

### 1. menu-scan/page.tsx — 2,921 LOC
- 40+ useState calls (lines 213-302)
- Image resizing + PDF conversion logic mixed into page component
- ConfidenceBadge sub-component defined inline
- Should split into: FileUploadStep, ProcessingStep, ReviewStep + custom hooks

### 2. NewRestaurantForm.tsx (748 LOC) vs RestaurantForm.tsx (622 LOC)
- 75% code overlap
- Different state approaches: plain useState vs react-hook-form + Zod
- Both dynamically import LocationPicker identically
- Cuisine handling duplicated (inline vs CuisineSelector)
- Operating hours logic 90% identical

### 3. restaurants/[id]/menus/page.tsx — 713 LOC
- 3 separate dialog state groups (menu, category, dish)
- Pattern: isXxxDialogOpen + editingXxx + formDataXxx × 3

### 4. ingredients/page.tsx — 685 LOC
- Same dialog state pattern repeated for canonical + aliases
- Pagination reimplemented (same as restaurants page)

## Missing Shared Patterns

| Pattern | Current State | Should Be |
|---------|--------------|-----------|
| Data tables | Reimplemented per page | Generic DataTable component |
| Search/filter bars | Inline per page | Shared SearchFilterBar |
| Dialog state | 3+ useState per dialog | `useDialog<T>()` hook |
| Pagination | Custom per page | `usePagination()` hook |
| Form state | Mix of useState, react-hook-form, localStorage | Standardize on react-hook-form + Zod |

## Admin vs Owner UX

| Dimension | Owner | Admin | Issue |
|-----------|-------|-------|-------|
| Form approach | Multi-step stepper + localStorage | Full form + Supabase | Different mental models |
| Validation | Custom validation | Zod + react-hook-form | Inconsistent |
| Navigation | Step-based redirect | Sidebar + breadcrumbs | No unified nav |
| Component reuse | onboarding/* custom fields | admin/* custom forms | Separate trees |
| Restaurant edit | /restaurant/edit (simpler) | /admin/restaurants/[id]/edit (full) | Different capabilities |

## Mobile App Style Pattern (Exemplar)

The mobile app (`apps/mobile/src/styles/common.ts`, 1,203 lines) uses a factory pattern:
- Base factories: `createFlexContainer()`, `createTextStyle()`, etc.
- Atomic styles: `flex1`, `bgPrimary`, `textMuted`
- Composite: `modalBase`, `cardBase`, `buttonBase`
- Exported groups: `containers`, `headers`, `text`, `forms`, `buttons`

This eliminates duplication and maintains consistency — the web portal should adopt a similar systematic approach.

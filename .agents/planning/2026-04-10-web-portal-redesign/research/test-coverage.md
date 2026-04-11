# Test Coverage Analysis

## Overview

- **Framework:** Vitest 4.1.4 + Testing Library
- **Total test files:** 26
- **Overall coverage:** ~26% of codebase

## Coverage Breakdown

### Components: 23% (15 of 64 tested)

**Tested:**
- Onboarding: AutoSaveIndicator, LocationSection, BasicInfoPage
- Forms: DishFormDialog, CuisineSelector, OperatingHoursEditor, ConfirmDialog, LocationPicker, RestaurantForm
- UI: PageHeader, EmptyState, LoadingSkeleton
- Utilities: OnboardingStepper, OAuthIcons

**Not tested (49 components):**
- Radix UI primitives (13) — typically not unit tested
- Admin components (10) including NewRestaurantForm (747 LOC)
- Dish form sub-components (8)
- Menu scan components (3)
- Others (15)

### Libraries: 35% (7 of 20 tested)

**Tested:** csv-import, import-validation, import-service, google-places, useDebounce, useRestaurantDraft, ui-constants

**Not tested (critical gaps):**
- `menu-scan.ts` (769 LOC) — menu dedup algorithms
- `restaurantService.ts` (684 LOC) — core CRUD
- `useDishFormData.ts` (344 LOC) — complex form hook
- `constants.ts` (372 LOC)

### API Routes: 20% (2 of ~10)
Only CSV and Google import routes tested.

### Pages: ~0%
No page component tests.

## High-Risk Untested Files for Redesign

| Risk | File | LOC | Why |
|------|------|-----|-----|
| 🔴 CRITICAL | `lib/menu-scan.ts` | 769 | Menu dedup algorithms, refactoring target |
| 🔴 CRITICAL | `lib/restaurantService.ts` | 684 | Core CRUD, affects all pages |
| 🔴 CRITICAL | `NewRestaurantForm.tsx` | 747 | Largest component, merging with RestaurantForm |
| 🟠 HIGH | `AddIngredientPanel.tsx` | 477 | Large form component |
| 🟠 HIGH | `DishOptionsSection.tsx` | 380 | Complex nested form |
| 🟠 HIGH | `useDishFormData.ts` | 344 | Complex form state hook |
| 🟠 MED | `RestaurantTable.tsx` | 299 | Data table with actions |
| 🟠 MED | `ImportAreaSelector.tsx` | 310 | Map-based UI |

## Recommendations for Redesign

**Before refactoring:** Add tests for menu-scan.ts, restaurantService.ts, NewRestaurantForm
**During refactoring:** Write tests alongside each extraction (TDD)
**After refactoring:** Add E2E tests, visual regression, accessibility tests

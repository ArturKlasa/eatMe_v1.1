# Current Web-Portal Codebase Analysis

## Overview

- **Framework:** Next.js 16.0.3 (App Router) + React 19.2.0
- **Language:** TypeScript 5.x
- **Total:** ~128 source files, ~24,600 LOC
- **Testing:** Vitest + Testing Library (24 test files)
- **Database:** Supabase (PostgreSQL + Auth)

## Styling Approach

- **Tailwind CSS v4** with CSS Custom Properties (theming)
- Single `globals.css` file (161 lines) — all design tokens
- Uses `@theme inline` directives to map CSS variables to Tailwind tokens
- No CSS modules, no styled-components — pure Tailwind utility classes
- OKLch color space for perceptual consistency
- Radix UI primitives (17 components) wrapped with CVA (class-variance-authority)
- `clsx` + `tailwind-merge` for conditional classname merging

## Dark Mode Status

**Infrastructure exists, but not fully functional:**
- `next-themes` v0.4.6 installed but essentially unused (only sonner uses `useTheme`)
- CSS variables defined for `.dark` class in `globals.css`
- All UI components have `dark:` prefixed Tailwind styles
- **Missing:** No ThemeProvider wrapper, no toggle button, admin layout uses hardcoded `bg-gray-50`/white

## Pages & Views (25 page files)

### Restaurant Owner Views (~20 pages)
- `/` — Dashboard
- `/auth/login`, `/auth/signup`, `/auth/callback` — Auth flows
- `/onboard/*` — 4-step wizard (basic-info, menu, review)
- `/restaurant/edit` — Update restaurant details
- `/menu/manage` — Full menu management

### Admin Views (~8 pages)
- `/admin` — Dashboard with stats
- `/admin/restaurants` — Table, create, view, edit, menus
- `/admin/ingredients` — Ingredient master list
- `/admin/dish-categories` — Category management
- `/admin/menu-scan` — AI menu scanning & OCR
- `/admin/restaurants/import` — Bulk import (CSV/Google Places)

## Component Organization (63 tsx files)

| Layer | Files | Description |
|-------|-------|-------------|
| UI (`/components/ui/`) | 18 | Radix-wrapped primitives (shadcn/ui pattern) |
| Feature (`/components/`) | 10 | LocationPicker, IngredientAutocomplete, etc. |
| Onboarding (`/components/onboarding/`) | 5 | AutoSave, BasicInfo, Contact, Location, ServiceOptions |
| Forms (`/components/forms/`) | 11 | DishFormDialog, OperatingHours, CuisineSelector, dish sub-components |
| Admin (`/components/admin/`) | 14 | NewRestaurantForm, RestaurantTable, ImportArea, MenuScan cards |

## Largest Files (Refactoring Candidates)

1. `app/admin/menu-scan/page.tsx` — **2,921 LOC** (AI OCR processor)
2. `components/admin/NewRestaurantForm.tsx` — **747 LOC**
3. `app/admin/restaurants/[id]/menus/page.tsx` — **713 LOC**
4. `app/admin/ingredients/page.tsx` — **685 LOC**
5. `components/admin/RestaurantForm.tsx` — **622 LOC**
6. `lib/menu-scan.ts` — **769 LOC** (OpenAI integration)
7. `lib/restaurantService.ts` — **684 LOC** (DB queries)

## Dependencies

**UI/Styling:** Tailwind v4, Radix UI (17 packages), CVA, clsx, tailwind-merge, lucide-react, sonner, next-themes
**Forms:** react-hook-form, @hookform/resolvers, zod
**Data:** @supabase/supabase-js, @supabase/ssr, openai
**Maps:** leaflet, mapbox-gl, react-map-gl
**Utilities:** date-fns, papaparse, pdfjs-dist, string-similarity
**Workspace:** @eatme/database, @eatme/tokens

**No external UI frameworks** (Material UI, Ant Design, Chakra, etc.) — pure Radix + Tailwind.

## Code Quality Observations

### Strengths
- Clean component hierarchy (UI -> Feature -> Page)
- Well-organized shared utilities in `/lib`
- Consistent Radix UI + Tailwind pattern
- TypeScript throughout
- Comprehensive test suite
- Form validation with Zod + React Hook Form
- Proper error boundaries

### Issues
1. Several oversized files (menu-scan page at 2,921 LOC)
2. Admin layout uses hardcoded colors instead of design tokens
3. Component duplication between RestaurantForm & NewRestaurantForm (~200 LOC overlap)
4. Dark mode CSS ready but not UI-exposed
5. Large API route handlers could benefit from service extraction

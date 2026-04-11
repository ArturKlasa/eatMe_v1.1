# EatMe — Admin Restaurant Data Ingestion

## Objective

Implement the 10-step admin restaurant data ingestion system per the checklist in:
  `.agents/planning/2026-04-10-admin-restaurant-ingestion/implementation/plan.md`

Work through steps in order, one at a time. Mark each step `[x]` when complete.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo). This task touches:
- **`infra/supabase/migrations/`** — Step 1 only: DB migration SQL file
- **`apps/web-portal`** — Next.js 16 + React 19, shadcn/ui (Radix), Tailwind CSS 4, Supabase client
  - New API routes: `app/api/admin/import/google/route.ts`, `app/api/admin/import/csv/route.ts`
  - New lib files: `lib/google-places.ts`, `lib/import-service.ts`, `lib/import-validation.ts`, `lib/import-types.ts`, `lib/csv-import.ts`
  - New UI: `app/admin/restaurants/import/page.tsx`, `components/admin/Import*.tsx`, `components/admin/RestaurantWarningBadge.tsx`
  - Modified: `components/admin/AdminSidebar.tsx`, `components/admin/RestaurantTable.tsx`, `app/admin/restaurants/page.tsx`, `app/admin/menu-scan/page.tsx`, `app/admin/page.tsx`

**Do NOT modify**: `apps/mobile/`, `packages/`, existing Supabase schema beyond migration 080.

**CRITICAL — preserve the manual flow**: The existing single-restaurant creation and edit flow (`/admin/restaurants/new`, `/admin/restaurants/[id]/edit`, `components/admin/RestaurantForm.tsx`) must remain fully functional. The bulk import feature is **additive** — a new path alongside manual entry, not a replacement for it.

## Key Documents

- **Implementation plan** (checklist): `.agents/planning/2026-04-10-admin-restaurant-ingestion/implementation/plan.md`
- **Design spec** (authoritative): `.agents/planning/2026-04-10-admin-restaurant-ingestion/design/detailed-design.md`

## Steps

1. DB migration — `google_place_id` column, `restaurant_import_jobs`, `google_api_usage` tables
2. Shared types, validation, and import service — `import-types.ts`, `import-validation.ts`, `import-service.ts`
3. Google Places API client — `google-places.ts` with Nearby Search, Text Search, field mapping
4. Google import API route — `POST /api/admin/import/google` (search + dedup + insert)
5. Warning flags and RestaurantTable enhancements — badges, flagged filter, scan menu button
6. Import page UI — `/admin/restaurants/import` with map area selector and results display
7. CSV import — `csv-import.ts`, `POST /api/admin/import/csv`, CSV tab on import page
8. Menu-scan query param support — accept `?restaurant_id=` in menu-scan page
9. Admin sidebar and dashboard integration — nav item, import stats
10. End-to-end testing and polish — full flow tests, edge cases, UX refinements

## Validation

- Build: `pnpm turbo run build --filter=web-portal`
- Lint: `pnpm turbo run lint --filter=web-portal`
- Tests: `cd apps/web-portal && npx vitest run`

## Success Criteria

All 10 checklist items marked `[x]`, build succeeds, tests pass, and `GOOGLE_PLACES_API_KEY` is documented in `.env.example`.

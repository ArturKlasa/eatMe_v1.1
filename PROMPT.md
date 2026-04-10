# EatMe — Web Portal UX/UI Redesign

## Objective

Implement the 12-step web portal UX/UI redesign per the checklist in:
  `.agents/planning/2026-04-09-web-portal-ux-redesign/implementation/plan.md`

Work through steps in order, one at a time. Mark each step `[x]` when complete.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo). This task modifies **only** the web portal:
- **`apps/web-portal`** — Next.js 16 + React 19, shadcn/ui (Radix), Tailwind CSS 4, Supabase client
- Two modes: **Admin** (`/admin/*`) and **Restaurant Owner** (dashboard, onboarding, edit)
- UI components in `components/ui/` (shadcn), domain components in `components/`, `components/admin/`, `components/forms/`

**Do NOT modify**: `apps/mobile/`, `packages/`, `infra/`, database schema, API routes.

## Key Documents

- **Implementation plan** (checklist): `.agents/planning/2026-04-09-web-portal-ux-redesign/implementation/plan.md`
- **Design spec** (authoritative): `.agents/planning/2026-04-09-web-portal-ux-redesign/design/detailed-design.md`

## Steps

1. Prerequisites — install shadcn skeleton/pagination, set up Vitest
2. Design tokens & constants — `lib/ui-constants.ts`, OAuthIcons, useDebounce
3. Core shared components — PageHeader, LoadingSkeleton, EmptyState, ConfirmDialog
4. Onboarding stepper — OnboardingStepper + `/app/onboard/layout.tsx`
5. Form sub-components — OperatingHoursEditor, CuisineSelector (test in isolation only)
6. Admin RestaurantForm — shared new/edit, thin page wrappers
7. DishFormDialog decomposition — 1,354 lines → orchestrator + 9 sub-components
8. BasicInfo decomposition — 1,027 lines → orchestrator + 7 sub-components + useRestaurantDraft hook
9. Admin pages polish — sidebar, dashboard, restaurant list, ingredients, categories, menus, audit
10. Owner pages polish — dashboard, auth, review, restaurant edit, onboarding menu
11. ConfirmDialog integration — replace 8 `confirm()` calls across 3 admin files
12. Menu Scan light touch + accessibility pass + transitions + code cleanup

## Validation

- Build: `pnpm turbo run build --filter=web-portal`
- Lint: `pnpm turbo run lint --filter=web-portal`
- Tests: `cd apps/web-portal && npx vitest run`

## Success Criteria

All 12 checklist items marked `[x]`, build succeeds, and tests pass.

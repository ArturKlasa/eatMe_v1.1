# EatMe — Web Portal Redesign

## Objective

Implement the 20-step web portal redesign per the checklist in:
  `.agents/planning/2026-04-10-web-portal-redesign/implementation/plan.md`

Work through steps in order, one at a time. Mark each step `[x]` when complete.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo). This redesign touches:
- **`packages/tokens/`** — Step 2 only: add `generate-css-vars.ts` script + culori/tsx dev deps
- **`apps/web-portal`** — Next.js 16 + React 19, shadcn/ui (Radix), Tailwind CSS v4, Supabase client
  - New shared components: `DataTable`, `SearchFilterBar`, `StatusBadge`, `InfoBox`, `SectionCard`, `ThemeToggle`, `OwnerHeader`, `LocationFormSection`
  - New hooks: `hooks/useDialog.ts`, `hooks/usePagination.ts`, `hooks/useFilters.ts`
  - New pages: `app/auth/forgot-password/page.tsx`, `app/auth/reset-password/page.tsx`
  - New infra: `middleware.ts`, `app/tokens.css`, `app/loading.tsx`, `app/admin/loading.tsx`
  - New menu-scan artifacts: `lib/menu-scan-utils.ts`, `app/admin/menu-scan/hooks/useMenuScanState.ts`, 3 step components
  - Unified `components/admin/RestaurantForm.tsx` (sections config + enableDraft)
  - Deleted: `components/admin/NewRestaurantForm.tsx`, `components/admin/RestaurantTable.tsx`

**Do NOT modify**: `apps/mobile/`, `infra/`, any package other than `packages/tokens/`.

**CRITICAL — never break existing functionality**: every page and API route that works before each step must still work after it.

## Key Documents

- **Implementation plan** (checklist): `.agents/planning/2026-04-10-web-portal-redesign/implementation/plan.md`
- **Design spec** (authoritative): `.agents/planning/2026-04-10-web-portal-redesign/design/detailed-design.md`
- **Project summary**: `.agents/planning/2026-04-10-web-portal-redesign/summary.md`

## Steps

1. Quick wins — remove mapbox-gl/react-map-gl (-700KB), add middleware.ts auth redirects, add loading.tsx skeletons
2. Token pipeline — `packages/tokens/scripts/generate-css-vars.ts` (hex→oklch, px→rem) → `app/tokens.css`
3. ThemeProvider + ThemeToggle — dark mode activated end-to-end (many components will look broken until Step 5)
4. Migrate admin layout, header, sidebar to semantic tokens (bg-background, text-foreground, etc.)
5. Migrate all remaining hardcoded colors across every page and component
6. Utility layer — `@layer utilities` in globals.css: focus-ring, surface-*, animate-enter, icon-sm/md
7. StatusBadge, InfoBox, SectionCard shared components
8. useDialog, usePagination, useFilters hooks
9. Refactor menus/page and ingredients/page with new hooks
10. DataTable and SearchFilterBar shared components
11. Replace RestaurantTable with DataTable + SearchFilterBar in restaurants page; delete RestaurantTable.tsx
12. LocationFormSection extraction (wired via react-hook-form `<Controller>`)
13. Unified RestaurantForm (sections config object, enableDraft prop)
14. Refactor admin create/edit pages to unified form; delete NewRestaurantForm.tsx
15. Owner edit page — add cuisines selector, service options, payment methods
16. Extract menu-scan-utils.ts and useMenuScanState hook (2,500 LOC → utilities + hook)
17. Split menu-scan page into three step components; page becomes ~80 LOC orchestrator
18. Auth improvements — password visibility toggle, forgot-password page, reset-password page
19. Onboarding routing fix (basic-info → menu, not review) + mobile responsiveness pass
20. Visual polish — spacing tokens (p-card), typography, @starting-style animations, badge sizes

## Validation

- Build: `pnpm turbo run build --filter=web-portal`
- Lint: `pnpm turbo run lint --filter=web-portal`
- Tests: `cd apps/web-portal && npx vitest run`

## Success Criteria

All 20 checklist items marked `[x]`, build succeeds, all tests pass, and:
- `apps/web-portal/app/tokens.css` exists and is imported as the first line of `globals.css`
- Dark mode is fully functional across all pages (toggle in admin header + owner header)
- Zero hardcoded color classes outside `components/ui/` (enforced by a Vitest grep check from Step 5)
- `components/admin/NewRestaurantForm.tsx` is deleted
- `components/admin/RestaurantTable.tsx` is deleted
- `app/auth/forgot-password/page.tsx` and `app/auth/reset-password/page.tsx` exist
- `app/onboard/basic-info/page.tsx` routes to `/onboard/menu` (not `/onboard/review`)

# Context: EatMe Codebase Audit

## Source Type
Rough description — comprehensive read-only audit producing 9 documentation files.

## Original Request Summary
Perform end-to-end audit of the EatMe monorepo. Produce structured technical documentation in `docs/agentic-docs/`. Surface concrete recommendations for code quality, security, architecture, product, and DX improvements. Audit existing docs for staleness.

## Repo Layout
- **apps/mobile/** — React Native 0.81 + Expo Bare, ~127 TS/TSX source files in `src/`
  - Screens: auth, onboarding, map discovery, eat-together, profile, favorites, filters, settings, restaurant detail, viewed history
  - Services: rating, geo, edge functions, user preferences, interaction
  - Stores: Zustand-based (need to locate)
  - Navigation: RootNavigator.tsx
- **apps/web-portal/** — Next.js 14 + shadcn/ui, ~78 TS/TSX source files
  - Routes: `/onboard/*`, `/auth/*`, `/admin/*`, `/menu/manage`, `/restaurant/edit`, `/api/ingredients`, `/api/menu-scan/*`
  - Components: forms (DishCard, DishFormDialog), admin panel, IngredientAutocomplete, LocationPicker, ProtectedRoute
  - Lib: supabase client, ingredients, menu-scan, validation, storage, restaurant service
  - Contexts: AuthContext
  - Types: restaurant.ts
- **packages/database/** — Supabase client + types (3 source files)
- **packages/tokens/** — Design tokens (7 source files: colors, spacing, typography, etc.)
- **packages/ui/, packages/typescript-config/, packages/eslint-config/** — Minimal shared config
- **infra/supabase/migrations/** — 39 migration files (001–039), `database_schema.sql` (503 lines)
- **shelf/swipe-feature/** — Shelved swipe implementation (hooks, screens, services)
- **docs/** — ~20+ markdown files across docs/, docs/workflows/ (MOB-01 to MOB-10, SHARED-01/02, WEB-01 to WEB-04), docs/todos/

## Key Dependencies
- pnpm + Turborepo monorepo
- Supabase (PostgreSQL + PostGIS + RLS)
- React Native 0.81 + Expo Bare workflow
- Next.js 14 + shadcn/ui
- Mapbox for geospatial discovery
- Zustand for mobile state
- OpenAI (menu-scan AI feature)

## Acceptance Criteria
1. All 9 required `docs/agentic-docs/` files exist with accurate, non-trivial content
2. `database-schema.md` covers every table and RLS policy from `database_schema.sql`
3. `improvement-recommendations.md` has 15+ actionable findings across security/code/perf/product/DX
4. `architecture-overview.md` includes at least one Mermaid diagram
5. `onboarding-guide.md` has step-by-step local dev setup instructions
6. No source files outside `docs/agentic-docs/` modified
7. `docs-audit.md` lists every identified stale claim with file path, claim, ground truth, fix

## Constraints
- Read-only audit: no source/migration modifications
- No secret values logged; reference key names only
- All Mermaid must be valid
- Files >100 lines need TOC
- Migration numbering: note highest number (039) and any gaps

# Codebase Structure

**Analysis Date:** 2026-06-19

## Directory Layout

```
eatMe_v1/                          # Monorepo root
├── apps/
│   ├── mobile/                    # Expo 54 + React Native 0.81 consumer app
│   │   ├── src/
│   │   │   ├── components/        # Shared UI components (map, auth, common, icons, rating)
│   │   │   ├── config/            # Environment helpers (debugLog)
│   │   │   ├── constants/         # App-level constants
│   │   │   ├── hooks/             # Custom React hooks
│   │   │   ├── i18n/              # i18next setup
│   │   │   ├── locales/           # en/es/pl translation JSON files
│   │   │   ├── navigation/        # RootNavigator, stack definitions, param types
│   │   │   ├── screens/           # Screen components (auth/, eatTogether/, onboarding/, restaurant-detail/)
│   │   │   ├── services/          # Supabase/edge function call modules (one per domain)
│   │   │   ├── stores/            # Zustand stores (one per domain)
│   │   │   ├── styles/            # Global StyleSheet tokens
│   │   │   ├── types/             # App-specific TS types (navigation param lists, etc.)
│   │   │   └── utils/             # Pure helpers (currencyConfig, etc.)
│   │   ├── app.json               # Expo config
│   │   └── package.json
│   │
│   ├── admin/                     # Next.js admin portal (port 3001) — NEW WORK GOES HERE
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (admin)/       # Route group: all admin pages (auth-gated)
│   │       │   │   ├── audit/     # Audit page
│   │       │   │   ├── imports/   # CSV import + actions/
│   │       │   │   ├── menu-scan/ # Menu scan list + [jobId]/ detail + actions/
│   │       │   │   └── restaurants/ # Restaurant list + [id]/ detail + [id]/actions/
│   │       │   ├── api/admin/     # API route handlers (e.g. import-csv)
│   │       │   └── signin/        # Auth page
│   │       ├── components/        # Shared UI components (modifiers/, etc.)
│   │       ├── lib/
│   │       │   ├── auth/          # Auth helpers
│   │       │   ├── google/        # Google Places integration
│   │       │   ├── modifiers/     # Modifier group utilities
│   │       │   ├── query/         # Shared query helpers
│   │       │   └── supabase/      # browser.ts + server.ts client wrappers
│   │       ├── types/             # Admin-specific TS types
│   │       └── __tests__/         # Vitest test suite (mirrors src structure)
│   │
│   ├── web-portal/                # Next.js owner portal (v1, live) — legacy, partially broken post-migration 163
│   │   ├── app/
│   │   │   ├── auth/              # Login, signup, forgot/reset password, callback
│   │   │   ├── menu/manage/       # Menu management page
│   │   │   ├── onboard/           # Multi-step onboarding: basic-info/, menu/, review/
│   │   │   └── restaurant/edit/   # Restaurant edit page
│   │   ├── components/            # Page-level components
│   │   ├── lib/                   # Service layer: restaurantService, storage, supabase, utils
│   │   └── package.json
│   │
│   └── web-portal-v2/             # PAUSED — do not delete, do not add new work here
│
├── packages/
│   ├── database/                  # @eatme/database
│   │   └── src/
│   │       ├── client.ts          # getMobileClient(), getWebClient() factories
│   │       ├── types.ts           # Generated Supabase DB types (Database type)
│   │       ├── web.ts             # createBrowserClient / createServerClient wrappers
│   │       └── index.ts           # Package entry
│   │
│   ├── shared/                    # @eatme/shared
│   │   └── src/
│   │       ├── constants/         # Shared constants
│   │       ├── logic/             # protein.ts (PRIMARY_PROTEINS, deriveProteinFields), role.ts, locale.ts, currency.ts, discoverability.ts
│   │       ├── types/             # Shared TS interfaces (restaurant.ts, dish.ts)
│   │       ├── validation/        # Zod schemas: menuScan.ts, menu.ts, restaurant.ts, publish.ts
│   │       └── auth/              # Auth-related shared types
│   │
│   ├── tokens/                    # @eatme/tokens — colors, spacing, typography
│   │   └── src/
│   │
│   ├── ui/                        # @eatme/ui — shadcn/ui components for web apps
│   │   └── src/
│   │       ├── components/ui/     # shadcn primitives
│   │       ├── compose/           # Composed components
│   │       └── lib/               # cn() and other utils
│   │
│   └── eslint-config-eatme/       # Shared ESLint config package
│       └── rules/
│
├── infra/
│   ├── supabase/
│   │   ├── functions/             # Deno edge functions
│   │   │   ├── feed/              # Discovery feed: two-stage candidate + scoring
│   │   │   ├── menu-scan-worker/  # OpenAI menu extraction worker
│   │   │   ├── update-preference-vector/  # Update user taste vector after interaction
│   │   │   ├── batch-update-preference-vectors/  # Bulk vector refresh
│   │   │   ├── group-recommendations/     # EatTogether group session feed
│   │   │   ├── enrich-dish/       # Dish enrichment (embedding generation)
│   │   │   ├── app-config/        # Remote config endpoint
│   │   │   └── invalidate-cache/  # Redis cache invalidation
│   │   ├── migrations/            # Numbered SQL migration files (001_*.sql … 169_*.sql)
│   │   │                          # Each migration has a paired *_REVERSE_ONLY_*.sql
│   │   └── tests/                 # Migration test scripts
│   │
│   └── scripts/                   # ts-node prod backfill + diagnostic scripts
│       └── *.ts                   # e.g. backfill-restaurant-currency.ts, seed-cold-start-vectors.ts
│
├── docs/
│   ├── plans/                     # Phase implementation plans (persisted before execution)
│   └── project/                   # Foundation docs (01-project-overview.md … 11 docs)
│
├── agent_docs/                    # Architecture, commands, conventions, database, terminology docs
├── .planning/codebase/            # GSD codebase maps (this directory)
├── turbo.json                     # Turborepo task pipeline
├── pnpm-workspace.yaml            # Workspace package definitions
└── package.json                   # Root scripts + devDependencies
```

## Directory Purposes

**`apps/mobile/src/stores/`:**
- Purpose: All cross-screen state; one Zustand store per domain
- Key files: `filterStore.ts` (daily + permanent filters), `authStore.ts`, `feedStore.ts`, `settingsStore.ts`, `viewModeStore.ts`, `storeBindings.ts` (cross-store wiring)

**`apps/mobile/src/services/`:**
- Purpose: All Supabase and edge function calls; one module per domain
- Key files: `edgeFunctionsService.ts` (feed, group-recommendations), `userPreferencesService.ts`, `interactionService.ts`, `favoritesService.ts`, `ratingService.ts`

**`apps/admin/src/app/(admin)/`:**
- Purpose: All admin pages — gated by auth middleware
- Pattern: Next.js App Router route groups; each feature folder contains `page.tsx` + `actions/` (server actions)

**`apps/admin/src/lib/supabase/`:**
- Purpose: Supabase client creation wrappers for admin
- Key files: `browser.ts` (client component use), `server.ts` (server components + actions using cookie-based session via `@supabase/ssr`)

**`packages/shared/src/logic/`:**
- Purpose: Canonical business logic shared across all apps
- Key files: `protein.ts` — `PRIMARY_PROTEINS` const + `deriveProteinFields()` — the sole food-classification axis

**`packages/database/src/`:**
- Purpose: Typed Supabase client factory + generated DB types
- Key files: `client.ts` (factories), `types.ts` (generated `Database` type — do not hand-edit), `web.ts` (SSR-compatible wrappers)

**`infra/supabase/functions/`:**
- Purpose: Server-side async processing in Deno
- Pattern: Each function is a directory with `index.ts` entry point. Import from `npm:` or `https://deno.land/`. Cannot import `@eatme/*` packages — duplicate types inline.

**`infra/supabase/migrations/`:**
- Purpose: Sequential SQL migrations (numbered 001–169+)
- Pattern: `NNN_description.sql` + `NNN_REVERSE_ONLY_description.sql` rollback pair. `database_schema.sql` is full schema snapshot.

**`infra/scripts/`:**
- Purpose: One-off prod backfill and diagnostic scripts that hit live Supabase with service-role key
- Pattern: ts-node scripts; always run `--dry-run` first. See memory note: `infra_scripts_prod_backfills.md`.

## Key File Locations

**Entry Points:**
- `apps/mobile/src/navigation/RootNavigator.tsx`: Auth gate + main navigation
- `apps/admin/src/app/layout.tsx`: Admin app shell
- `apps/web-portal/app/layout.tsx`: Web portal app shell
- `infra/supabase/functions/feed/index.ts`: Discovery feed edge function
- `infra/supabase/functions/menu-scan-worker/index.ts`: AI menu scan worker

**Configuration:**
- `turbo.json`: Turborepo pipeline (build, dev, lint, check-types task dependencies)
- `pnpm-workspace.yaml`: Workspace package paths
- `apps/admin/next.config.ts`: Admin Next.js config (transpilePackages, etc.)
- `apps/web-portal/next.config.ts`: Web portal Next.js config

**Core Logic:**
- `packages/shared/src/logic/protein.ts`: PRIMARY_PROTEINS enum + deriveProteinFields
- `packages/database/src/client.ts`: Supabase client factories (read before creating clients)
- `apps/mobile/src/services/edgeFunctionsService.ts`: Feed call + ServerDish type + composeCardName
- `apps/mobile/src/stores/filterStore.ts`: Two-tier filter state (daily + permanent)

**Testing:**
- `apps/admin/src/__tests__/`: Vitest suite for admin app (mirrors `src/` structure)
- `packages/shared/src/__tests__/`: Shared package unit tests
- `infra/supabase/tests/`: Deno migration tests

## Naming Conventions

**Files — Mobile:**
- Screens: `PascalCaseScreen.tsx` (e.g. `FiltersScreen.tsx`, `BasicMapScreen.tsx`)
- Styles: `PascalCaseScreen.styles.ts` co-located with screen
- Stores: `camelCaseStore.ts` (e.g. `filterStore.ts`)
- Services: `camelCaseService.ts` (e.g. `edgeFunctionsService.ts`)
- Hooks: `useHookName.ts`

**Files — Admin/Web-Portal:**
- Pages: `page.tsx` (Next.js App Router convention)
- Server actions: `actions/actionName.ts` or `actions.ts`
- Components: `PascalCase.tsx`
- Lib helpers: `camelCase.ts`

**Files — Migrations:**
- `NNN_snake_case_description.sql` + paired `NNN_REVERSE_ONLY_snake_case_description.sql`

**Packages:**
- Scoped as `@eatme/*` (database, shared, tokens, ui)

## Where to Add New Code

**New mobile screen:**
- Screen: `apps/mobile/src/screens/NewScreen.tsx`
- Register in: `apps/mobile/src/navigation/RootNavigator.tsx` + param types in `apps/mobile/src/types/navigation.ts`
- Styles: `apps/mobile/src/screens/NewScreen.styles.ts`

**New mobile feature with state:**
- Store: `apps/mobile/src/stores/featureStore.ts`
- Service: `apps/mobile/src/services/featureService.ts`
- Hook (if needed): `apps/mobile/src/hooks/useFeature.ts`

**New admin page:**
- Route: `apps/admin/src/app/(admin)/feature/page.tsx`
- Server actions: `apps/admin/src/app/(admin)/feature/actions/featureName.ts`
- Tests: `apps/admin/src/__tests__/feature/` (mirror src structure)

**New shared type or schema:**
- Types: `packages/shared/src/types/newDomain.ts`, export from `packages/shared/src/types/index.ts`
- Zod schema: `packages/shared/src/validation/newDomain.ts`
- Note: If also needed in edge functions, duplicate inline in the relevant `infra/supabase/functions/*/index.ts`

**New edge function:**
- Directory: `infra/supabase/functions/function-name/index.ts`
- Pattern: Follow `feed/index.ts` — export Deno `serve()`, use `npm:` imports, duplicate shared types locally

**New DB migration:**
- Files: `infra/supabase/migrations/NNN_description.sql` + `NNN_REVERSE_ONLY_description.sql`
- Increment number from current highest (169 as of 2026-06-19)
- Every new table needs RLS enabled + `owner_id` FK to `auth.users`

**New utility for web apps:**
- Admin: `apps/admin/src/lib/featureName.ts`
- Web portal: `apps/web-portal/lib/featureName.ts`
- Shared across web apps: `packages/ui/src/lib/featureName.ts` (if UI-related) or `packages/shared/src/logic/featureName.ts`

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Yes

**`infra/supabase/migrations/`:**
- Purpose: Source of truth for DB schema evolution
- Generated: No (hand-authored SQL)
- Committed: Yes

**`packages/database/src/types.ts`:**
- Purpose: Generated TypeScript types from Supabase schema
- Generated: Yes (via `supabase gen types typescript`)
- Committed: Yes — do not hand-edit

**`apps/web-portal-v2/`:**
- Purpose: Paused rewrite of owner portal
- Status: On ice — do NOT delete, do NOT add new work here
- New owner portal work: `apps/admin/` only

**`agent_docs/`:**
- Purpose: Curated architecture, conventions, database, and terminology docs for AI agents
- Committed: Yes

---

*Structure analysis: 2026-06-19*

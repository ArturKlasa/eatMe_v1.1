<!-- refreshed: 2026-06-19 -->
# Architecture

**Analysis Date:** 2026-06-19

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         Client Applications                               │
├──────────────────┬───────────────────────┬───────────────────────────────┤
│   apps/mobile    │    apps/admin         │    apps/web-portal            │
│  (Expo/RN 0.81)  │  (Next.js, port 3001) │  (Next.js 16 — owner portal) │
│  Discovery feed  │  Active admin rewrite │  Legacy portal (v1, live)     │
└────────┬─────────┴───────────┬───────────┴──────────────┬────────────────┘
         │                     │                           │
         │      ┌──────────────┴────────────────────────────────┐
         │      │           Shared Packages                      │
         │      │   packages/database  (@eatme/database)         │
         │      │   packages/shared    (@eatme/shared)           │
         │      │   packages/tokens    (@eatme/tokens)           │
         │      │   packages/ui        (@eatme/ui)               │
         │      └──────────────────────────────────────────────-─┘
         │                     │
         ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Supabase Backend                                 │
│   PostgreSQL 15 + PostGIS + pgvector · RLS-enforced ownership           │
├─────────────────────────┬───────────────────────────────────────────────┤
│   Edge Functions (Deno) │   Database / RLS                              │
│   feed                  │   dishes, restaurants, option_groups, options  │
│   menu-scan-worker      │   user_preferences, ratings, interactions      │
│   update-preference-    │   menu_scan_jobs                               │
│     vector              │   generate_candidates() RPC (SQL)              │
│   batch-update-*        │   get_group_candidates() RPC (SQL)             │
│   group-recommendations │                                                │
│   enrich-dish           │                                                │
│   app-config            │                                                │
│   invalidate-cache      │                                                │
└─────────────────────────┴───────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│   External Services                                                      │
│   OpenAI GPT (menu-scan-worker — gpt-5.4-mini, escalation gpt-5.5)     │
│   Upstash Redis (feed caching)                                           │
│   Mapbox (mobile map layer)                                              │
│   Google Places (restaurant ingestion, address geocoding)               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Path |
|-----------|----------------|------|
| apps/mobile | Consumer dish-discovery app; map browsing, personalised feed, EatTogether group sessions | `apps/mobile/` |
| apps/admin | Active admin portal rewrite (port 3001); restaurant ingestion, menu scan management, audit | `apps/admin/` |
| apps/web-portal | Live owner self-service portal (v1); onboarding, menu management (post-migration partially broken) | `apps/web-portal/` |
| apps/web-portal-v2 | Paused rewrite — on ice, do NOT treat as live or delete | `apps/web-portal-v2/` |
| packages/database | Supabase client factories (getMobileClient, getWebClient) + generated DB types | `packages/database/src/` |
| packages/shared | Canonical protein list, Zod validation schemas, shared TS types, role/locale/currency logic | `packages/shared/src/` |
| packages/tokens | Design tokens (colors, spacing, typography) consumed by all apps | `packages/tokens/src/` |
| packages/ui | Shared shadcn/ui component set for web apps | `packages/ui/src/` |
| infra/supabase | DB migrations, edge functions (Deno), SQL scripts | `infra/supabase/` |
| infra/scripts | One-off prod backfill + diagnostic scripts (ts-node, hits live Supabase) | `infra/scripts/` |

## Pattern Overview

**Overall:** Multi-layer monorepo — shared library packages consumed by platform-specific apps, with Supabase as the sole backend. Edge functions own heavy async processing (feed ranking, AI menu scan). Apps communicate with Supabase directly (via RLS-gated anon client) or via edge functions (for server-side logic).

**Key Characteristics:**
- All DB access is RLS-enforced; every table requires `owner_id` FK to `auth.users`
- Supabase client is never instantiated inside shared packages — each app injects its own env vars
- Edge functions run in Deno and cannot import workspace packages (schemas duplicated locally)
- The two-stage feed pipeline (SQL candidate generation → JS scoring) is the core discovery algorithm
- `primary_protein` is the sole food-classification axis; allergen/dietary-tag columns are retired

## Layers

**Shared Packages Layer:**
- Purpose: Canonical types, validation schemas, DB client factory, design tokens
- Location: `packages/`
- Contains: TypeScript types, Zod schemas, protein logic, client factories
- Depends on: External npm packages only (`zod`, `@supabase/supabase-js`)
- Used by: All apps and edge functions (edge functions copy schemas locally — can't import workspace)

**Application Layer — Mobile:**
- Purpose: Consumer-facing food discovery
- Location: `apps/mobile/src/`
- Contains: Screens, Zustand stores, service modules, navigation, hooks, i18n
- Architecture: Store-centric — Zustand stores own all cross-screen state; service modules call Supabase/edge functions directly
- Depends on: `@eatme/database`, `@eatme/shared`, `@eatme/tokens`

**Application Layer — Admin (active):**
- Purpose: Internal admin tooling — restaurant ingestion, menu scan, audit
- Location: `apps/admin/src/`
- Contains: Next.js App Router pages, server actions, `lib/` helpers, `__tests__/`
- Architecture: Next.js App Router with server actions; no client-side state library
- Depends on: `@eatme/database`, `@eatme/shared`

**Application Layer — Web Portal (legacy v1):**
- Purpose: Restaurant owner self-service portal
- Location: `apps/web-portal/app/`
- Contains: Next.js App Router pages for onboarding, menu management, auth
- Architecture: App Router with `lib/` service layer; LocalStorage draft persistence
- Depends on: `@eatme/database`, `@eatme/shared`, `@eatme/tokens`

**Edge Functions Layer:**
- Purpose: Server-side async processing — feed generation, AI menu scanning, preference vector maintenance
- Location: `infra/supabase/functions/`
- Runtime: Deno; deployed to Supabase Edge Runtime
- Cannot import workspace packages; schemas duplicated inline

**Database Layer:**
- Purpose: Persistent storage, RLS enforcement, PostGIS spatial queries, pgvector similarity search
- Location: `infra/supabase/migrations/`, SQL RPCs embedded in migrations
- Key abstractions: `generate_candidates()` RPC, `get_group_candidates()` RPC, `complete_menu_scan_job()` RPC

## Data Flow

### Mobile Discovery Feed (primary request path)

1. User opens map → `BasicMapScreen.tsx` reads location → loads `filterStore` state (`apps/mobile/src/stores/filterStore.ts`)
2. `edgeFunctionsService.ts` POSTs to `/functions/v1/feed` with filters, location, user JWT (`apps/mobile/src/services/edgeFunctionsService.ts`)
3. Edge function `feed/index.ts` runs Stage 1: calls `generate_candidates()` SQL RPC — PostGIS radius + hard permanent filters + pgvector ANN → 200 candidates (`infra/supabase/functions/feed/index.ts`)
4. Stage 2 JS scoring: weights `similarity(0.4) + rating(0.2) + popularity(0.15) + distance(0.1) + ...`, diversity cap (max 3 per restaurant), returns top N gzip-compressed
5. Result hydrates `feedStore`; `BasicMapScreen` renders dish cards
6. On interaction (view/like/skip) → `interactionService.ts` writes to DB → triggers `update-preference-vector` edge function to update pgvector embedding

### Admin Menu Scan Flow (AI pipeline)

1. Admin uploads menu images via `apps/admin/src/app/(admin)/menu-scan/` page
2. Server action `adminCreateMenuScanJob` writes `menu_scan_jobs` row + uploads images to Supabase Storage
3. Server action immediately POSTs to `menu-scan-worker` edge function (pg_cron tick disabled since 2026-05-03)
4. Worker downloads images, resizes, sends to OpenAI gpt-5.4-mini with Structured Outputs + Zod schema
5. Extracted dishes (with modifier groups, pricing, `primary_protein`) written back via `complete_menu_scan_job()` RPC
6. Admin reviews result at `apps/admin/src/app/(admin)/menu-scan/[jobId]/`

### Restaurant Onboarding (web-portal)

1. Multi-step form: `app/onboard/basic-info/` → `app/onboard/menu/` → `app/onboard/review/`
2. Each step auto-saves to LocalStorage keys `restaurant-draft`, `onboarding-step` via `lib/storage.ts`
3. Final review step submits all data to Supabase in single transaction

**State Management — Mobile:**
- Zustand stores: `authStore`, `filterStore`, `feedStore`, `restaurantStore`, `sessionStore`, `settingsStore`, `viewModeStore`, `onboardingStore`
- `storeBindings.ts` wires cross-store reactions (e.g. auth → clear feed on logout)
- Stores persist to `AsyncStorage` where needed

## Key Abstractions

**Supabase Client Factory:**
- Purpose: Typed, platform-specific client creation without shared package reading env vars
- Location: `packages/database/src/client.ts`
- Pattern: Apps call `getMobileClient(url, key, AsyncStorage)` or use `createBrowserClient` from `@supabase/ssr` (web). Admin uses `createServerClient()` wrapper in `apps/admin/src/lib/supabase/server.ts`

**Primary Protein System:**
- Purpose: Sole food-classification axis replacing retired allergen/dietary-tag system
- Location: `packages/shared/src/logic/protein.ts`
- Exports: `PRIMARY_PROTEINS` (12-value const array), `PrimaryProtein` type, `deriveProteinFields()` helper
- Note: Edge functions duplicate this enum locally (cannot import workspace packages)

**generate_candidates() RPC:**
- Purpose: SQL-side Stage 1 of discovery feed — spatial + vector pre-filter
- Location: Defined in migration SQL, called from `infra/supabase/functions/feed/index.ts`
- Inputs: User location, radius, permanent filters (diet, max price, protein exclusions), preference vector
- Output: Up to 200 candidate dishes for JS-side scoring

**Modifier Groups:**
- Purpose: Dish customisation (size, add-ons, protein choice) replacing retired parent/variant dish model
- Tables: `option_groups` (selection_type, min/max_selections, display_in_card) + `options` (price_delta, price_override, primary_protein, is_default)
- Note: `dish_kind`/`parent_dish_id` columns are dropped (migration 163); `DISH_KIND_META` shim remains in `@eatme/shared` only for web-portal compatibility until that app is deleted

## Entry Points

**Mobile App:**
- Location: `apps/mobile/App.tsx` (or Expo root) → `apps/mobile/src/navigation/RootNavigator.tsx`
- Triggers: Expo dev server / production build
- Responsibilities: Auth gate → route to AuthNavigator or MainNavigator (map, profile, EatTogether tabs)

**Admin App:**
- Location: `apps/admin/src/app/layout.tsx` → `apps/admin/src/app/(admin)/`
- Triggers: `next dev` on port 3001 / production build
- Responsibilities: Auth check → restaurant list, menu-scan management, import/audit pages

**Web Portal:**
- Location: `apps/web-portal/app/layout.tsx` → `apps/web-portal/app/page.tsx`
- Triggers: `next dev` / production build
- Responsibilities: Owner onboarding flow, menu management (partially broken post-migration 163)

**Feed Edge Function:**
- Location: `infra/supabase/functions/feed/index.ts`
- Triggers: POST from mobile `edgeFunctionsService`
- Responsibilities: Two-stage candidate generation + JS scoring → gzip-compressed dish array

**Menu-Scan-Worker Edge Function:**
- Location: `infra/supabase/functions/menu-scan-worker/index.ts`
- Triggers: Direct POST from admin server action (not pg_cron)
- Responsibilities: Claim job → download images → OpenAI extraction → write results

## Architectural Constraints

- **Env vars:** Never computed dynamically in shared packages. Each app passes literal env var values to client factories. `EXPO_PUBLIC_*` for mobile, `NEXT_PUBLIC_*` for web/admin.
- **RLS:** Every new table requires RLS enabled with `owner_id` FK to `auth.users`. Default is deny-all.
- **Edge function imports:** Deno edge functions cannot import from workspace packages (`@eatme/shared`, etc.). Schemas and enums must be duplicated inline.
- **PostGIS coordinate order:** `POINT(lng lat)` — longitude first. Supabase returns `{type: "Point", coordinates: [lng, lat]}`.
- **primary_protein NOT NULL:** Every dish row must have a `primary_protein` value. No allergen/dietary-tag columns exist.
- **Native module rebuild:** After adding native dependencies in mobile, run `npx expo prebuild --clean`.
- **transpilePackages:** Workspace packages using TypeScript source must be listed in `next.config.ts` `transpilePackages` for both `apps/admin` and `apps/web-portal`.

## Anti-Patterns

### Reading env vars inside shared packages

**What happens:** Calling `process.env.NEXT_PUBLIC_SUPABASE_URL` inside `packages/database/`
**Why it's wrong:** Next.js and Expo/Metro replace env vars at build time via static analysis on literal keys only. Computed access evaluates to `undefined` at runtime.
**Do this instead:** Each app reads its own env vars with literal keys and passes them to `getMobileClient()` or `createBrowserClient()`. See `packages/database/src/client.ts`.

### Reintroducing parent/variant dish model

**What happens:** Adding `parent_dish_id`, `is_parent`, `dish_courses` references
**Why it's wrong:** These columns and tables were dropped in migration 163. The data was migrated to modifier groups.
**Do this instead:** Model size/protein variants as modifier groups (`option_groups` + `options` with `price_delta`). See `docs/plans/dish-model-rewrite-phase-7-cleanup.md`.

### Allergen or dietary-tag filtering

**What happens:** Adding allergen/dietary-tag columns, user preference fields for allergies/diet_types
**Why it's wrong:** These were removed across all apps + DB (migrations 155/156). EatMe is a protein-based discovery app, not an allergen-safety app.
**Do this instead:** Use `primary_protein` and `deriveProteinFields()` for diet inference. See `packages/shared/src/logic/protein.ts`.

## Error Handling

**Strategy:** Service-layer try/catch with typed error objects; React error boundaries at screen level on mobile; Next.js `error.tsx` boundaries on web.

**Patterns:**
- Mobile service modules catch Supabase errors and return typed `{data, error}` objects matching Supabase conventions
- Edge functions return structured JSON error responses with HTTP status codes
- Menu-scan-worker writes failure reason back to `menu_scan_jobs.error_message` column

## Cross-Cutting Concerns

**Logging:** `debugLog()` utility in mobile (`apps/mobile/src/config/environment.ts`); `console.error/log` in edge functions
**Validation:** Zod schemas in `packages/shared/src/validation/` for forms and API payloads; duplicated inline in edge functions
**Authentication:** Supabase Auth — JWT via cookie (web/admin, `@supabase/ssr`) or AsyncStorage (mobile). Auth gate in `RootNavigator` (mobile) and middleware (web/admin).

---

*Architecture analysis: 2026-06-19*

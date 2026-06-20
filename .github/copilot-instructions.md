# EatMe AI Coding Instructions

> Current reality as of 2026-06-20. For the canonical project guide see `CLAUDE.md`;
> for deeper architecture see `agent_docs/architecture.md`. This file is the GitHub
> Copilot mirror of those — keep it in sync when they change.

## Project Overview

**EatMe** is a food discovery platform: map-based restaurant/dish discovery with personalized, protein-based dish recommendations. Apps:

- **Mobile App** (`apps/mobile`): React Native 0.81 + Expo (bare) with Mapbox & Zustand — consumers discover and rate restaurants/dishes.
- **Admin Portal** (`apps/admin`): Next.js 16 + React 19, shadcn/ui (port 3001) — the **active web surface** (operator/admin tooling).
- **Owner Portal rebuild** (`apps/web-portal-v2`): Next.js 16 owner portal — **on ice** (paused, not abandoned). Supersedes the retired v1 owner portal.
- **Backend**: Supabase (PostgreSQL + PostGIS + pgvector), RLS-enforced data ownership.

**pnpm + Turborepo monorepo.** Shared packages:

- `packages/database`: Supabase client factory + generated types (`@eatme/database`).
- `packages/shared`: Constants, TypeScript types, Zod validation schemas (`@eatme/shared`) — single source of truth for domain types, cuisine lists, and form validation.
- `packages/tokens`: Design tokens (`@eatme/tokens`).
- `packages/ui`: Shared React UI components (`@eatme/ui`) — used by the web apps.

## Dish Classification — Primary Protein (NOT allergens)

EatMe is a **discovery + protein-based filtering app, NOT an allergen-safety app.** Dishes are classified by a single `primary_protein` enum (NOT NULL) on `dishes`. The canonical 12 values live in `packages/shared/src/logic/protein.ts`. The legacy allergen / dietary-tag / ingredient pipeline has been **removed** across apps, edge functions, and the DB (do not reintroduce it). Diet filtering is protein-derived (vegan = `primary_protein = 'vegan'`; vegetarian = no meat/poultry/fish/shellfish family).

## Architecture & Core Patterns

1. **Supabase client factory** — each app builds its own typed client via `@eatme/database`, passing env vars **explicitly** (the package never reads `process.env`). Required because Next.js and Expo statically replace env vars on literal keys only. See `packages/database/src/client.ts`.
2. **Database ownership via RLS** — every table has RLS enabled (default deny-all) with an `owner_id` FK to `auth.users`. Users CRUD only their own data; service role bypasses for system operations.
3. **Geospatial format** — PostGIS `POINT(lng lat)`, **longitude first**. Supabase returns `{ type: "Point", coordinates: [lng, lat] }`.
4. **AI menu scanning** — owners upload menu photos/PDF; a Supabase edge function (OpenAI vision) extracts structured dish data (including `primary_protein`) for review before saving.
5. **Mobile state** — Zustand stores in `apps/mobile/src/stores/`; auth via Supabase with AsyncStorage session persistence.

## Development Commands

```bash
# From project root
pnpm install              # Install all deps
turbo dev                 # Run apps in dev mode
turbo build               # Build all packages + apps
turbo lint                # ESLint across the monorepo
turbo check-types         # TypeScript check (packages + admin/web-portal-v2; mobile has no check-types script)
turbo test                # Vitest across admin, web-portal-v2 + shared packages

# Run a specific app
turbo dev --filter=admin            # admin portal (port 3001)
turbo dev --filter=web-portal-v2    # owner portal rebuild (port 3000, on ice)
turbo dev --filter=mobile           # Expo dev server
```

### Admin Portal (`apps/admin`) — Next.js 16

```bash
cd apps/admin
pnpm dev                  # http://localhost:3001
pnpm build && pnpm start  # Production
pnpm test                 # Vitest
```

### Mobile App (`apps/mobile`) — React Native 0.81 + Expo (bare)

**Bare workflow requires a native dev build, not Expo Go** (custom Mapbox native module).

```bash
cd apps/mobile
npx expo prebuild --clean   # After adding/updating native deps
npx expo run:android        # Build + run dev client on Android
pnpm start                  # Start Metro
```

### Database / Supabase

- **Migrations**: `infra/supabase/migrations/NNN_descriptive_name.sql` (sequential; use `NNNa_`/`NNNb_` suffixes for same-slot splits — never reuse a number prefix without a letter).
- **Authoritative schema**: `infra/supabase/migrations/database_schema.sql` is a snapshot of the live DB — read it first to know the actual schema (do NOT run it; apply changes via numbered migrations).
- **Edge functions**: `infra/supabase/functions/` are **Deno** (cannot import workspace packages); validate with `deno check`.
- **RLS**: always enable on new tables and test policies (default deny-all).

## Conventions

- **Shared domain types**: `@eatme/shared` (Restaurant, Dish, Option, OptionGroup, primary-protein logic, etc.).
- **Database types**: `@eatme/database` (Supabase-generated).
- **Mobile-specific types**: `apps/mobile/src/types/`.
- **Monorepo imports**: use the workspace protocol (`"@eatme/shared": "workspace:*"`), never relative paths across app boundaries. New TS-source packages must be added to the consuming app's `next.config.ts` `transpilePackages`.
- **Logging**: prefixed — `console.error('[ComponentName] message')`, context prefixes like `[OAuth]`, `[Storage]`.

## Common Pitfalls

1. **PostGIS POINT format** — `POINT(lng lat)`, longitude first (use the helper).
2. **RLS on new tables** — always enable + add an `owner_id` policy; default is deny-all.
3. **`primary_protein` is NOT NULL** — every dish must have one; delete/backfill legacy rows that lack it.
4. **Native modules need rebuild** — after native dependency changes in mobile, run `npx expo prebuild --clean`.
5. **transpilePackages** — workspace packages consumed as TypeScript source must be listed in the app's `next.config.ts`.
6. **Don't reintroduce abandoned concepts** — no allergen/dietary-tag/ingredient pipeline, and no parent/variant dishes (size/add-on variants are modifier groups).

## Testing

- **Web apps** (`apps/admin`, `apps/web-portal-v2`): Vitest (`pnpm test` in the app, or `turbo test` from root). Playwright for e2e.
- **Mobile**: no automated tests — verify on physical devices (`__DEV__` checks for dev-only features).
- **Edge functions**: `deno test --node-modules-dir=none -A <path>`.

---

_For detailed documentation, see `CLAUDE.md` and `agent_docs/` (architecture, commands, conventions, database, terminology)._

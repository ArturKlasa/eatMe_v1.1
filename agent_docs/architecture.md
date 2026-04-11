# Architecture

## Monorepo Structure

```
eatMe_v1/
├── apps/
│   ├── mobile/              # Expo 54 + React Native 0.81 consumer app
│   └── web-portal/          # Next.js 16 + React 19 restaurant owner portal
├── packages/
│   ├── database/            # @eatme/database — Supabase client factory + generated types
│   ├── shared/              # @eatme/shared — Constants, types, Zod validation schemas
│   └── tokens/              # @eatme/tokens — Design tokens (colors, spacing, typography)
├── infra/
│   └── supabase/            # Migrations, seed data, edge functions
├── docs/project/            # Foundation documentation (11 docs)
└── turbo.json               # Turborepo task pipeline
```

## Package Relationships

```
apps/mobile         → @eatme/database, @eatme/shared, @eatme/tokens
apps/web-portal     → @eatme/database, @eatme/shared, @eatme/tokens
packages/shared     → (no internal deps; zod as optional peer dep)
packages/database   → @supabase/supabase-js
packages/tokens     → (standalone)
```

Both apps depend on all three packages. `@eatme/shared` has no internal package dependencies — it only requires `zod` as an optional peer dependency for validation schemas.

## Data Flow

### Web Portal (Restaurant Onboarding)

1. Multi-step form with LocalStorage draft auto-save at each step (`lib/storage.ts`)
2. Final submission writes all data to Supabase in a single transaction
3. Pattern: `apps/web-portal/app/onboard/{basic-info,menu,review}/page.tsx`

### Mobile App (Dish Discovery)

1. Map-based browsing fetches restaurants by proximity (PostGIS `ST_DDistance`)
2. Feed algorithm scores dishes by user preferences, ratings, and distance
3. State management via Zustand stores (`stores/filterStore.ts`, `stores/feedStore.ts`)

### Supabase Client Pattern

Each app creates its own typed client via `@eatme/database` factory, passing env vars explicitly (not reading `process.env` in the package). This is required because Next.js and Expo replace env vars via static analysis on literal keys only. See `packages/database/src/client.ts` for details.

### AI Menu Scanning (Web Portal)

1. Restaurant owner uploads menu photos/PDF
2. Images resized client-side, sent to API route
3. GPT-4o Vision extracts structured dish data
4. Owner reviews and edits extracted dishes before saving

## Key Documentation

- `docs/project/01-project-overview.md` — Full project overview
- `docs/project/02-tech-stack.md` — Complete technology inventory
- `docs/project/04-web-portal.md` — Web portal architecture details
- `docs/project/05-mobile-app.md` — Mobile app architecture details
- `docs/project/06-database-schema.md` — Database schema and relationships

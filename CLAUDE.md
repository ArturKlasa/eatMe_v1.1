# EatMe

EatMe is a food discovery platform connecting consumers with restaurants through personalized dish recommendations. Consumers discover dishes via a mobile app; restaurant owners manage menus through a web portal with AI-assisted menu scanning. Built as a pnpm + Turborepo monorepo with Supabase backend.

## Tech Stack

- **Mobile App** (`apps/mobile/`): Expo 54 + React Native 0.81, Zustand, Mapbox, i18next (en/es/pl)
- **Web Portal** (`apps/web-portal/`): Next.js 16 + React 19, shadcn/ui, Tailwind CSS v4, react-hook-form + Zod
- **Backend**: Supabase (PostgreSQL 15 + PostGIS + pgvector), RLS-enforced data ownership
- **Shared Packages**:
  - `packages/database/` — Supabase client factory + generated types (`@eatme/database`)
  - `packages/shared/` — Constants, TypeScript types, Zod validation schemas (`@eatme/shared`)
  - `packages/tokens/` — Design tokens (`@eatme/tokens`)

## Key Commands

```bash
pnpm install              # Install all dependencies
turbo dev                 # Start all apps in dev mode
turbo build               # Build all packages and apps
turbo test                # Run tests (web-portal Vitest suite)
turbo lint                # Lint all packages
turbo check-types         # TypeScript type-checking
```

### App-specific

```bash
cd apps/web-portal && npx vitest run    # Run web-portal tests
cd apps/web-portal && npx vitest        # Watch mode
cd apps/mobile && npx expo start        # Start Expo dev server
```

## Architecture

Monorepo with three packages consumed by two apps. Both apps create their own Supabase client via `@eatme/database` factory (explicit env var passing — see `packages/database/src/client.ts` for why). Shared constants, types, and validation schemas live in `@eatme/shared`.

See `agent_docs/architecture.md` for package relationships and data flow.

## Common Pitfalls

1. **PostGIS POINT format** — `POINT(lng lat)` not `POINT(lat lng)`. Supabase returns `{type: "Point", coordinates: [lng, lat]}`.
2. **RLS on new tables** — Every new table needs RLS enabled with `owner_id` FK to `auth.users`. Default is deny-all.
3. **localStorage keys** — Web portal uses specific keys for draft persistence (`restaurant-draft`, `onboarding-step`). Changing them breaks in-progress onboarding.
4. **Native modules need rebuild** — After adding/updating native dependencies in mobile, run `npx expo prebuild --clean`.
5. **transpilePackages** — Workspace packages using TypeScript source (not compiled) must be listed in `next.config.ts` `transpilePackages`.

## Further Reading

- `agent_docs/` — Architecture, commands, conventions, database, terminology
- `docs/project/` — Detailed foundation docs (overview, tech stack, CLI, database schema, contributing, etc.)

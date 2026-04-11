# Commands

## Monorepo (from project root)

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `turbo dev` | Start all apps in development mode |
| `turbo build` | Build all packages and apps |
| `turbo test` | Run test suites (web-portal Vitest) |
| `turbo lint` | Lint all packages and apps |
| `turbo check-types` | TypeScript type-checking across all packages |
| `turbo build && turbo lint && turbo check-types` | Full validation pipeline |

## Web Portal (`apps/web-portal/`)

| Command | Description |
|---------|-------------|
| `npx next dev --turbopack` | Start dev server with Turbopack |
| `npx next build` | Production build |
| `npx vitest run` | Run all tests once |
| `npx vitest` | Run tests in watch mode |
| `npx vitest run path/to/test.ts` | Run specific test file |

## Mobile App (`apps/mobile/`)

| Command | Description |
|---------|-------------|
| `npx expo start` | Start Expo dev server |
| `npx expo start --ios` | Start with iOS simulator |
| `npx expo start --android` | Start with Android emulator |
| `npx expo prebuild --clean` | Regenerate native projects (after native dep changes) |

## Database / Supabase

| Command | Description |
|---------|-------------|
| `supabase start` | Start local Supabase (Docker) |
| `supabase db reset` | Reset local DB and rerun migrations |
| `supabase gen types typescript --local` | Regenerate TypeScript types from local schema |
| `supabase migration new <name>` | Create a new migration file |

Migration files live in `infra/supabase/migrations/`. The authoritative schema is `infra/supabase/migrations/database_schema.sql`.

## Packages

| Command | Dir | Description |
|---------|-----|-------------|
| `pnpm build` | `packages/database/` | Compile database package |
| `pnpm build` | `packages/shared/` | Compile shared package |
| `pnpm build` | `packages/tokens/` | Build design tokens |

See `docs/project/03-cli-commands.md` for the complete command reference.

# CLI Commands

## Prerequisites

- Node >= 18
- pnpm 9.0.0
- Supabase CLI
- EAS CLI (for mobile builds)

---

## Root Monorepo

Run from the repository root.

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start all apps in dev mode via Turborepo |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all workspaces |
| `pnpm format` | Format code with Prettier |
| `pnpm check-types` | Run TypeScript type checking across all workspaces |

## Web Portal

Run from `apps/web-portal`.

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server on localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Lint web portal code |

## Mobile App

Run from `apps/mobile`.

| Command | Description |
|---------|-------------|
| `pnpm start` | Start Expo dev client |
| `pnpm android` | Run on Android emulator/device |
| `pnpm ios` | Run on iOS simulator/device |
| `pnpm web` | Run in web browser |
| `npx expo prebuild` | Generate native projects (android/ and ios/) |
| `eas build --platform android --profile development` | Build Android dev client via EAS |

## Database Package

Run from `packages/database`.

| Command | Description |
|---------|-------------|
| `pnpm build` | Build the database package |
| `pnpm dev` | Watch mode for development |
| `pnpm gen:types` | Regenerate TypeScript types from Supabase schema |

## Supabase CLI

Run from the repository root or `infra/supabase`.

| Command | Description |
|---------|-------------|
| `supabase start` | Start local Supabase stack (DB, Auth, Storage, etc.) |
| `supabase db push` | Push migrations to remote database |
| `supabase gen types typescript --project-id <ref>` | Generate TypeScript types from remote schema |
| `supabase functions deploy` | Deploy all edge functions |
| `supabase functions serve` | Serve edge functions locally |
| `supabase functions logs <name> --tail` | Tail logs for a specific edge function |

## Infrastructure Scripts

Run from `infra/scripts`.

| Command | Description |
|---------|-------------|
| `pnpm batch-embed` | Batch-generate embeddings for dishes missing vectors |

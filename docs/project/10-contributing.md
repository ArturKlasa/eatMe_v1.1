# Contributing

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Branching Strategy](#branching-strategy)
- [Making Changes](#making-changes)
- [Database Changes](#database-changes)
- [Adding Edge Functions](#adding-edge-functions)
- [Mobile Development](#mobile-development)

## Getting Started

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd eatMe_v1
   ```

2. Install dependencies (requires **pnpm 9.0.0+** and **Node >= 18**):

   ```bash
   pnpm install
   ```

3. Start all apps in development mode:

   ```bash
   pnpm dev
   ```

4. The web portal will be available at `http://localhost:3000`.

See [Environment Setup](./08-environment-setup.md) for environment variable configuration.

## Project Structure

| Directory              | Description                              |
|------------------------|------------------------------------------|
| `apps/web-portal`      | Next.js restaurant/admin portal          |
| `apps/mobile`          | React Native (Expo) consumer app         |
| `packages/database`    | Shared Supabase client + generated types |
| `packages/tokens`      | Design tokens                            |
| `infra/supabase`       | Migrations + edge functions              |
| `infra/scripts`        | Batch scripts                            |

See [Tech Stack](./02-tech-stack.md) for full technology details.

## Code Style

- **TypeScript strict mode** is enforced across all packages.
- **ESLint + Prettier** handle linting and formatting:

  ```bash
  pnpm lint      # Check for lint issues
  pnpm format    # Format code with Prettier
  ```

- **Naming conventions:**
  - PascalCase for React components (e.g., `DishCard.tsx`, `MenuScanScreen.tsx`)
  - camelCase for services, hooks, and utilities (e.g., `useLocation.ts`, `feedService.ts`)

## Branching Strategy

<!-- TODO: Document branching model when CI/CD is implemented -->

## Making Changes

Before committing changes, run the following checks:

```bash
# Type-check the entire monorepo
pnpm check-types

# Lint all packages
pnpm lint
```

To test edge functions locally:

```bash
supabase functions serve
```

See [CLI Commands](./03-cli-commands.md) for the full list of available commands.

## Database Changes

1. Create a new migration file in `infra/supabase/migrations/` with a numbered prefix to ensure correct ordering.

2. Apply the migration to your Supabase project:

   ```bash
   supabase db push
   ```

3. Regenerate TypeScript types so the shared `packages/database` package stays in sync:

   ```bash
   cd packages/database && pnpm gen:types
   ```

## Adding Edge Functions

1. Create a new directory under `supabase/functions/<name>/`.

2. Add an `index.ts` file that includes:
   - CORS headers for cross-origin requests
   - Supabase client initialization with auth from the request
   - Standard error handling and JSON responses

3. Follow the patterns established by existing functions. See [Edge Functions](./07-edge-functions.md) for implementation details and examples.

## Mobile Development

- Run `npx expo prebuild` after adding or changing native dependencies.
- Test on a **physical device** for location and map features (emulators have limited GPS support).
- Build environment variables are configured in `eas.json` per profile (development, preview, production).

See [Environment Setup](./08-environment-setup.md) for required environment variables.

---

**See also:** [CLI Commands](./03-cli-commands.md) | [Tech Stack](./02-tech-stack.md) | [Environment Setup](./08-environment-setup.md)

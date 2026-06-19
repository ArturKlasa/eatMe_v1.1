# Technology Stack

**Analysis Date:** 2026-06-19

## Languages

**Primary:**
- TypeScript 5.9.2 — all apps and packages (source, not compiled for workspace consumption)
- SQL (PostgreSQL) — migrations in `infra/supabase/migrations/`

**Secondary:**
- JavaScript — config files (eslint.config.mjs, postcss.config.mjs)
- Deno TypeScript — Supabase Edge Functions in `infra/supabase/functions/` (Deno runtime, not Node)

## Runtime

**Environment:**
- Node.js >=18 (current: v22.20.0) — apps, packages, infra/scripts
- Deno (latest, via Supabase) — edge functions only

**Package Manager:**
- pnpm 9.0.0 (pinned via `packageManager` field in root `package.json`)
- Lockfile: `pnpm-lock.yaml` present

## Build System

- Turbo 2.5.8 — task runner for build, dev, lint, check-types across all workspaces
- Root scripts: `turbo run build`, `turbo run dev`, `turbo run lint`, `turbo run check-types`
- Pre-build step: `@eatme/tokens` CSS generation runs before build/dev

## Frameworks

**Mobile (`apps/mobile/`):**
- Expo ~54.0.13 — React Native host, dev client mode (`expo start --dev-client`)
- React Native 0.81.4 — core mobile framework
- React 19.1.0

**Web Portal — live owner portal (`apps/web-portal/`):**
- Next.js 16.2.6 — App Router
- React 19.2.0

**Admin (`apps/admin/`):**
- Next.js 16.2.6 — App Router, port 3001
- React 19.2.0
- Turbopack enabled (workspace root pinned via `next.config.ts`)

**Web Portal v2 (`apps/web-portal-v2/`):**
- Next.js — paused/on-ice; do NOT delete

## Key Dependencies by App

### Mobile (`apps/mobile/`)
- `zustand ^5.0.8` — global state management
- `@rnmapbox/maps ^10.1.45` — map rendering (Mapbox GL)
- `@react-native-google-signin/google-signin ^16.1.2` — native Google OAuth
- `@supabase/supabase-js ^2.47.11` — database + auth client
- `i18next ^25.8.7` + `react-i18next ^16.5.4` — i18n (en/es/pl)
- `expo-localization ^17.0.8` — locale detection
- `expo-location ^19.0.7` — GPS
- `expo-image-picker ~17.0.10` — photo upload
- `react-native-reanimated ~4.1.3` — animations
- `react-native-gesture-handler ^2.28.0` — touch gestures
- `@react-navigation/native ^7.1.17`, `@react-navigation/stack ^7.4.8`, `@react-navigation/drawer ^7.5.8` — navigation
- `react-native-qrcode-svg ^6.3.11` — QR code display
- `@react-native-async-storage/async-storage ^2.2.0` — Supabase session persistence

### Web Portal (`apps/web-portal/`)
- `next 16.2.6`
- `@supabase/supabase-js ^2.89.0` + `@supabase/ssr ^0.8.0` — cookie-based PKCE auth
- Radix UI primitives (alert-dialog, checkbox, collapsible, dialog, dropdown-menu, label, progress, radio-group, select, separator, slot, tabs) — headless UI
- `react-hook-form ^7.66.0` + `@hookform/resolvers ^5.2.2` + `zod ^4.1.12` — form validation
- `@dnd-kit/core ^6.3.1`, `@dnd-kit/sortable ^10.0.0` — drag-and-drop menu ordering
- `openai ^6.25.0` — direct OpenAI call (menu scan, legacy path — primary path is edge function)
- `pdfjs-dist ^5.5.207` — PDF menu upload parsing
- `leaflet ^1.9.4` — restaurant location map (web, for web-portal forms)
- `lucide-react ^0.553.0` — icons
- `tailwindcss ^4` — styling
- `sonner ^2.0.7` — toast notifications
- `date-fns ^4.1.0` — date formatting
- `papaparse ^5.5.3` — CSV parsing
- `zustand ^5.0.8` — state management
- `next-themes ^0.4.6` — dark/light mode
- Testing: `vitest ^4.1.4`, `@testing-library/react ^16.3.2`, `jsdom ^29.0.2`

### Admin (`apps/admin/`)
- `next 16.2.6`
- `@supabase/supabase-js ^2.104.1` + `@supabase/ssr ^0.8.0`
- `@tanstack/react-query ^5.100.1` — server state / data fetching
- `@dnd-kit/core`, `@dnd-kit/sortable` — drag-and-drop
- `zod ^4.1.12` — validation
- `browser-image-compression ^2.0.2` — image compression before upload
- `pdfjs-dist ^5.5.207` — PDF parsing
- `leaflet ^1.9.4` — map for import area selection
- `tz-lookup ^6.1.25` — timezone inference by coordinates
- `server-only` — marks server-only modules
- Testing: `vitest ^4.1.4`, `@playwright/test ^1.59.1` (E2E)

### Shared Packages

**`packages/database` (`@eatme/database`):**
- `@supabase/supabase-js ^2.39.0` — Supabase client factory
- `@supabase/ssr ^0.8.0` — SSR/cookie session support
- Exports: `getMobileClient()`, `getWebClient()` (deprecated), `createBrowserClient` (web uses `@supabase/ssr` directly)
- Generated types: `packages/database/src/types.ts` (via `supabase gen types typescript`)

**`packages/shared` (`@eatme/shared`):**
- Peer dep: `zod ^3.0.0` (optional)
- Contains: constants, TS types, Zod validation schemas, `PRIMARY_PROTEINS` / `deriveProteinFields` logic

**`packages/tokens` (`@eatme/tokens`):**
- Design tokens; generates CSS as pre-build step

**`packages/ui` (`@eatme/ui`):**
- Shared UI components (consumed by `apps/admin`)

**`packages/eslint-config-eatme`:**
- Shared ESLint config

### Infrastructure Scripts (`infra/scripts/`)
- `ts-node ^10.9.2` — direct TypeScript execution (no compile step)
- `dotenv ^16.4.5` — loads `.env` for prod credentials
- `@supabase/supabase-js ^2.49.1`
- `tz-lookup ^6.1.25`

## Configuration

**TypeScript:**
- Root `tsconfig.json` with per-package extends; strict mode throughout
- `turbo check-types` runs `tsc --noEmit` across all workspaces

**Linting/Formatting:**
- ESLint 9 (flat config) per app; `packages/eslint-config-eatme` for shared rules
- Prettier 3.6.2 (root) — `prettier --write "**/*.{ts,tsx,md}"`
- Husky 9.1.7 + lint-staged: runs Prettier on staged `*.{ts,tsx}` files

**Environment:**
- Mobile: `EXPO_PUBLIC_*` env vars (build-time static substitution by Metro)
- Web/Admin: `NEXT_PUBLIC_*` env vars (build-time static substitution by Next.js)
- Edge functions: `Deno.env.get()` at runtime
- infra/scripts: `dotenv` loaded from `.env` at runtime

**Build Output:**
- Next.js apps: `.next/` (standard)
- Packages: TypeScript source consumed directly via workspace protocol (no compile to `dist/` required for dev)

## Platform Requirements

**Development:**
- Node.js >=18
- pnpm 9.0.0
- Deno (~/.deno, not on PATH) for edge function tests
- Physical device for mobile visual testing (no emulator in CI loop)

**Production:**
- Mobile: iOS / Android native builds via Expo (EAS or local prebuild)
- Web Portal + Admin: Vercel (Next.js) — `apps/admin/next.config.ts` pins Turbopack root for Vercel deployment
- Edge Functions: Supabase hosted Deno runtime
- Database: Supabase managed PostgreSQL 15

---

*Stack analysis: 2026-06-19*

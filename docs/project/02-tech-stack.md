# Tech Stack

## Frontend — Web Portal

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | React framework (App Router) |
| React | 19 | UI library |
| TypeScript | 5.9.2 | Type safety |
| Tailwind CSS | 4 | Utility-first styling |
| Radix UI (shadcn/ui) | — | Accessible component primitives |
| react-hook-form | — | Form state management |
| Zod | 4 | Schema validation |
| Sonner | — | Toast notifications |
| Mapbox GL (react-map-gl) | — | Map rendering for restaurant locations |
| Leaflet (LocationPicker) | — | Location picker component |
| OpenAI SDK | — | Menu scan (GPT-4o Vision) and dish enrichment |

## Frontend — Mobile App

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81 | Cross-platform mobile framework |
| Expo | 54 | Build tooling and native modules (bare workflow) |
| TypeScript | — | Type safety |
| React Navigation | — | Drawer + stack navigation |
| Zustand | — | Client state management |
| AsyncStorage | — | Persistent local storage |
| @rnmapbox/maps | — | Native Mapbox map component |
| i18next | — | Internationalization (en, es, pl) |
| @react-native-google-signin | — | Google OAuth on mobile |

## Backend & Database

| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase | — | Backend-as-a-service (Auth, DB, Realtime, Storage) |
| PostgreSQL | 15 | Primary database |
| PostGIS | — | Geospatial queries (proximity-based dish search) |
| pgvector | — | 1536-dimensional vector similarity search |
| Deno Edge Functions | — | Serverless functions (enrichment, feed, etc.) |

## AI & ML

| Model / Service | Provider | Purpose |
|-----------------|----------|---------|
| gpt-4o | OpenAI | Menu scan — vision-based dish extraction from images/PDFs |
| gpt-4o-mini | OpenAI | Dish enrichment — generate descriptions, tags, metadata |
| text-embedding-3-small | OpenAI | Generate 1536-dim embeddings for dishes and user preferences |

## Infrastructure & DevOps

| Tool | Version | Purpose |
|------|---------|---------|
| pnpm | 9 | Package manager with workspace support |
| Turborepo | 2.5 | Monorepo build orchestration |
| EAS (Expo Application Services) | — | Mobile app builds and OTA updates |
| Upstash Redis | — | Feed response caching |

## Tooling

| Tool | Purpose |
|------|---------|
| ESLint | Linting |
| Prettier | Code formatting |
| TypeScript strict mode | Enforced across all workspaces |
| Supabase CLI | Local dev, migrations, type generation, function deployment |

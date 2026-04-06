# Environment & Deployment Research

## Environment Variables

### Root Level
- MAPBOX_ACCESS_TOKEN — Public Mapbox token
- MAPBOX_DOWNLOADS_TOKEN — Secret Mapbox downloads token
- NODE_ENV — development
- SUPABASE_SERVICE_ROLE_KEY — Service-level Supabase access
- OPENAI_API_KEY — OpenAI API key

### Mobile (EXPO_PUBLIC_ prefix)
- EXPO_PUBLIC_SUPABASE_URL — Supabase project URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY — Public anon key
- EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — Google OAuth Web Client ID
- EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN — Mapbox token
- EXPO_PUBLIC_API_URL — Edge Functions base URL
- EXPO_PUBLIC_DEFAULT_LAT/LNG/ZOOM — Map defaults (Mexico City)
- EXPO_PUBLIC_DEBUG — Verbose logging

### Web Portal (NEXT_PUBLIC_ prefix)
- NEXT_PUBLIC_SUPABASE_URL — Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase public key

### Edge Functions (auto-injected)
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — Auto-injected
- OPENAI_API_KEY — Must be set in Supabase Dashboard secrets

### Infrastructure Scripts
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- ENRICH_DISH_URL — Edge function endpoint

## Development Setup
- Package manager: pnpm 9.0.0
- Node.js: >=18
- Build orchestration: Turborepo 2.5.8
- TypeScript: 5.9.2 (strict mode)
- No Docker/dev containers

## EAS Configuration (Mobile)
- 3 build profiles: development, preview, production
- Android APK for dev/preview, auto-increment for production
- Environment variables hardcoded in eas.json

## CI/CD Status
- PLANNED but NOT YET IMPLEMENTED
- GitHub Actions chosen as orchestration
- Vercel for web portal hosting (account pending)
- EAS for mobile builds
- Supabase CLI for migrations

### Planned Pipeline
- Alpha: develop branch → auto-deploy
- Beta: main branch → manual approval
- Production: release/* → disabled

## CLI Commands

### Root
- pnpm dev — Start all apps (Turbo)
- pnpm build — Build all apps
- pnpm lint — Lint all workspaces
- pnpm format — Prettier formatting
- pnpm check-types — TypeScript validation

### Web Portal
- pnpm dev — Next.js dev server (localhost:3000)
- pnpm build / pnpm start — Production build/serve

### Mobile
- pnpm start — Expo dev client
- pnpm android / pnpm ios — Platform builds
- eas build --platform android — Cloud build

### Database Package
- pnpm gen:types — Generate types from Supabase schema

### Infrastructure
- pnpm batch-embed — Batch embedding generation
- supabase functions deploy — Deploy edge functions
- supabase db push — Push migrations

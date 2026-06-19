# External Integrations

**Analysis Date:** 2026-06-19

## APIs & External Services

### OpenAI

**Menu Scan Vision (primary path):**
- Service: OpenAI Chat Completions API (vision)
- Edge function: `infra/supabase/functions/menu-scan-worker/index.ts`
- Models: `PRIMARY_MODEL = 'gpt-5.4-mini'`, `FALLBACK_MODEL = 'gpt-5-mini'` (escalation path: `gpt-5.5`)
- Auth env var: `OPENAI_API_KEY` (Deno edge secret)
- Triggered by: pg_cron polling `menu_scan_jobs` table every N minutes via pg_net HTTP POST

**Dish Embedding:**
- Service: OpenAI Embeddings API
- Edge function: `infra/supabase/functions/enrich-dish/index.ts`
- Model: `text-embedding-3-small`, 1536 dimensions
- Auth env var: `OPENAI_API_KEY` (Deno edge secret)
- Output: written to `dishes.restaurant_vector` (pgvector column)

**Web Portal direct call (legacy/secondary):**
- Package: `openai ^6.25.0` in `apps/web-portal/`
- Auth env var: `OPENAI_API_KEY` (server-side Next.js)

### Mapbox

**Mobile map rendering:**
- SDK: `@rnmapbox/maps ^10.1.45`
- Used in: `apps/mobile/App.tsx`, `apps/mobile/src/screens/BasicMapScreen.tsx`
- Auth env var: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (must start with `pk.`)
- Purpose: interactive map for restaurant/dish discovery in mobile feed

**Web admin map:**
- Library: `leaflet ^1.9.4` (NOT Mapbox) — used in `apps/admin` for import area selection
- Web portal also uses `leaflet ^1.9.4` for restaurant location forms
- Auth env var: `NEXT_PUBLIC_MAPBOX_TOKEN` (web portal, if Mapbox tiles used)

### Google

**Google Sign-In (mobile — native):**
- SDK: `@react-native-google-signin/google-signin ^16.1.2`
- Implementation: `apps/mobile/src/lib/googleAuth.ts`
- Auth env var: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- Flow: Native OS-level Google sign-in sheet → Supabase session via `signInWithIdToken`

**Google Places API (infra scripts — prod backfills only):**
- Used in: `infra/scripts/backfill-cuisine-from-google.ts`
- Endpoint: `https://places.googleapis.com/v1/places/{placeId}`
- Auth env var: `GOOGLE_PLACES_API_KEY`
- Purpose: infer `cuisine_types` for restaurants that lack it

**Facebook OAuth (mobile — browser-based):**
- Not a native SDK; uses Supabase `auth.signInWithOAuth({ provider: 'facebook' })` with browser redirect
- UI buttons present in `apps/mobile/src/screens/auth/LoginScreen.tsx` and `RegisterScreen.tsx`
- No dedicated Facebook env var (handled entirely by Supabase OAuth config)

## Data Storage

### Supabase PostgreSQL (primary database)

**Provider:** Supabase managed PostgreSQL 15

**Connection env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` — web portal (client-side)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — web portal (client-side)
- `EXPO_PUBLIC_SUPABASE_URL` — mobile
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — mobile
- `SUPABASE_URL` — edge functions (Deno runtime secret, auto-injected)
- `SUPABASE_ANON_KEY` — edge functions
- `SUPABASE_SERVICE_ROLE_KEY` — edge functions (bypasses RLS for admin ops)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — infra/scripts

**PostgreSQL Extensions:**
- `postgis` — geospatial queries (`POINT(lng lat)` format); restaurant coordinates stored as `geometry(Point, 4326)`
- `pgvector` — vector similarity search; `restaurant_vector` and `preference_vector` columns (1536-dim float arrays)
- `pg_cron` — scheduled jobs (see pg_cron section below)
- `pg_net` — HTTP calls from within PostgreSQL (triggers edge functions from SQL)
- `pgroonga` or `tsvector` — full-text search (`search_vector tsvector` column on dishes)

**Key tables:** `restaurants`, `dishes`, `menus`, `option_groups`, `options`, `menu_scan_jobs`, `user_preferences`

**RLS:** Every table enforces RLS with `owner_id` FK to `auth.users`

**Generated types:** `packages/database/src/types.ts` — regenerated via `supabase gen types typescript --project-id $SUPABASE_PROJECT_ID`
- Env var for regen: `SUPABASE_PROJECT_ID`

### Supabase Storage (file storage)

**Buckets:**
- `menu-scan-uploads` — menu image/PDF uploads for AI processing
  - Used by: `apps/admin`, `apps/web-portal-v2`, edge function `menu-scan-worker`
- `photos` — user-submitted dish/restaurant photos
  - Used by: `apps/mobile/src/services/ratingService.ts`
- `restaurant-photos` — restaurant photos
  - Used by: `apps/web-portal-v2`

**Image serving:** `*.supabase.co` CDN (allowlisted in `apps/admin/next.config.ts` `images.remotePatterns`)

### Upstash Redis (feed cache)

**Provider:** Upstash (serverless Redis, REST API)
- SDK: `@upstash/redis` (imported via Deno ESM from `https://esm.sh/@upstash/redis@latest`)
- Used in: `infra/supabase/functions/feed/index.ts`, `infra/supabase/functions/invalidate-cache/index.ts`
- Cache key pattern: `feed:v2:*`
- Auth env vars:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Optional: graceful skip if env vars absent (`skipped: true, reason: 'redis_not_configured'`)

## Authentication & Identity

**Auth Provider:** Supabase Auth

**Web Portal / Admin:**
- Cookie-based PKCE sessions via `@supabase/ssr` (`createBrowserClient`)
- Server-side session reading via `createServerClient` (SSR-compatible)
- Email/password auth

**Mobile:**
- AsyncStorage-backed sessions (`@react-native-async-storage/async-storage`)
- Google Sign-In: native SDK (`@react-native-google-signin`) → Supabase `signInWithIdToken`
- Facebook Sign-In: browser-based OAuth redirect via Supabase `signInWithOAuth`
- Email/password auth also supported
- Implementation: `apps/mobile/src/stores/authStore.ts`, `apps/mobile/src/lib/googleAuth.ts`

**Supabase auth relay (admin proxy):**
- `apps/admin/proxy.ts` — auth proxy for admin server-side auth
- Env vars for staging tests: `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_KEY`, `SUPABASE_STAGING_FUNCTIONS_URL`

## Scheduled Jobs (pg_cron)

All schedules run inside Supabase PostgreSQL via the `pg_cron` extension, using `pg_net` to POST to Supabase Edge Function URLs.

**Menu scan polling** (`116b_menu_scan_cron.sql`):
- Polls `menu_scan_jobs` table and calls `menu-scan-worker` edge function
- Reads: `SUPABASE_SERVICE_ROLE_KEY` (stored as DB secret)

**Embed recovery** (`133_embed_recovery_cron.sql`):
- Every 5 minutes — retries failed/missing dish embeddings
- Calls `enrich-dish` edge function

**Restaurant vector recompute** (`134_restaurant_vector_dirty_flag.sql`):
- Recomputes `restaurant_vector` (pgvector) for dirty-flagged restaurants

**Group recommendations scheduling** (`075_fix_eat_together.sql`):
- Batch preference vector updates

## DB Webhooks (Supabase Database Webhooks)

**invalidate-cache edge function:**
- Triggered by: `UPDATE` events on `restaurants`, `menus`, `dishes` tables via Supabase Database Webhooks UI
- Implementation: `infra/supabase/functions/invalidate-cache/index.ts`
- Action: deletes `feed:v2:*` keys from Upstash Redis

**Note:** A previous DB webhook that triggered `enrich-dish` on dish insert was dropped (migration `138_record_webhook_trigger_drop.sql`); embedding now triggered via pg_cron recovery loop.

## Edge Functions Summary

All deployed to Supabase Edge runtime (Deno). Located in `infra/supabase/functions/`.

| Function | Trigger | Purpose |
|----------|---------|---------|
| `menu-scan-worker` | pg_cron + pg_net HTTP POST | AI vision extraction of menu images/PDFs → dishes |
| `enrich-dish` | pg_cron embed recovery + direct calls | Generate text-embedding-3-small vector for dish |
| `feed` | HTTP (mobile client) | Personalized dish feed with Redis caching |
| `group-recommendations` | HTTP | Group dining recommendations |
| `batch-update-preference-vectors` | HTTP / cron | Bulk preference vector updates |
| `update-preference-vector` | HTTP | Single user preference vector update |
| `invalidate-cache` | DB webhook (UPDATE on restaurants/menus/dishes) | Purge Upstash Redis feed cache |
| `app-config` | HTTP | Mobile app remote config |

## CI/CD & Deployment

**Hosting:**
- Web Portal + Admin: Vercel (Next.js)
- Edge Functions: Supabase (deployed via `supabase functions deploy` from `infra/supabase/`)
- Database migrations: `supabase db push` / migration files in `infra/supabase/migrations/`

**CI Pipeline:** Not detected in codebase (no `.github/workflows/` visible)

**Playwright E2E** (`apps/admin`):
- Config: `apps/admin/playwright.config.ts`
- Env vars: `PLAYWRIGHT_BASE_URL`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_RUN_ID`

## Environment Configuration

**Mobile (`EXPO_PUBLIC_*`):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_DEFAULT_LAT` / `EXPO_PUBLIC_DEFAULT_LNG` / `EXPO_PUBLIC_DEFAULT_ZOOM`
- `EXPO_PUBLIC_DEBUG`

**Web Portal (`NEXT_PUBLIC_*`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`

**Admin (server-side):**
- `SUPABASE_SERVICE_ROLE_KEY` (server actions)
- `LOCAL_SUPABASE_URL` / `LOCAL_SUPABASE_SERVICE_ROLE_KEY` (local dev overrides)
- `ENRICH_DISH_URL` (points to `enrich-dish` edge function URL)

**Edge Functions (Deno secrets):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**infra/scripts (`.env` loaded via dotenv):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_PLACES_API_KEY`

**Secrets location:** `.env` files (gitignored); Supabase project secrets for edge functions; Vercel environment variables for web deployments.

---

*Integration audit: 2026-06-19*

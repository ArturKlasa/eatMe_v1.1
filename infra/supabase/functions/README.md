# Supabase Edge Functions Deployment Guide

## Prerequisites

1. Install Supabase CLI:

```bash
npm install -g supabase
# or
brew install supabase/tap/supabase
```

2. Login to Supabase:

```bash
supabase login
```

3. Link your project:

```bash
cd infra/supabase
supabase link --project-ref tqroqqvxabolydyznewa
```

## Deploy Edge Functions

### Deploy nearby-restaurants function:

```bash
supabase functions deploy nearby-restaurants
```

### Deploy all functions:

```bash
supabase functions deploy
```

## Test Locally (Optional)

1. Start local Supabase:

```bash
supabase start
```

2. Serve function locally:

```bash
supabase functions serve nearby-restaurants
```

3. Test with curl:

```bash
curl -X POST 'http://localhost:54321/functions/v1/nearby-restaurants' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radiusKm": 5,
    "limit": 10
  }'
```

## Environment Variables

The Edge Function uses these environment variables (auto-configured by Supabase):

- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Public anon key

## CORS Configuration

CORS for `feed`, `enrich-dish`, and `invalidate-cache` is **allowlist-reflecting, not wildcard** (SEC-01). `Access-Control-Allow-Origin` is set **only** when the request `Origin` exactly matches an entry in the `ALLOWED_ORIGINS` env var; for any other (or absent) origin the header is omitted entirely — it never falls back to `*`.

- **Allowlist (`ALLOWED_ORIGINS`)** — a comma-separated list configured as a Supabase **function secret** (operator-managed, no code edit). Initial value:
  `https://eat-me-v1-1-admin.vercel.app,http://localhost:3001`
  Set it via the Supabase Dashboard (Edge Functions → Secrets) or `supabase secrets set ALLOWED_ORIGINS="..."`.
- **Fail-closed** — if `ALLOWED_ORIGINS` is unset, **no** browser origin receives `Access-Control-Allow-Origin` (it never falls back to `*`). Requests with **no** `Origin` header (native mobile / curl) still succeed normally — auth is enforced by JWT, not CORS.
- **Always emitted** — `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`, `Access-Control-Allow-Methods`, and `Vary: Origin` are present on every response (preflight and main alike).
- **Shared module** — the logic lives in `_shared/cors.ts` (`buildCorsHeaders(origin)`). **IMPORTANT:** Supabase bundles `_shared/` into each importing function at deploy time, so a change to `cors.ts` does **not** propagate to already-deployed functions. After editing `_shared/cors.ts` you must **redeploy ALL THREE importing functions** (`feed`, `enrich-dish`, `invalidate-cache`).

## Monitoring

View function logs:

```bash
supabase functions logs nearby-restaurants
```

View function logs in real-time:

```bash
supabase functions logs nearby-restaurants --tail
```

## Common Issues

**Issue**: "Failed to fetch restaurants"
**Solution**: Check that restaurants table has data and location is properly formatted as `{lat: number, lng: number}`

**Issue**: CORS errors in mobile app
**Solution**: Verify CORS headers are included in function response

**Issue**: Function timeout
**Solution**: Reduce `limit` parameter or optimize query (add database indexes)

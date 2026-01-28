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

The function includes CORS headers to allow mobile app access:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`

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

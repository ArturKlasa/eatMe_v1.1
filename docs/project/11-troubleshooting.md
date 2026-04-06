# Troubleshooting

## Table of Contents

- [Development Setup Issues](#development-setup-issues)
- [Mobile App Issues](#mobile-app-issues)
- [Web Portal Issues](#web-portal-issues)
- [Database Issues](#database-issues)
- [Edge Function Issues](#edge-function-issues)
- [Known Limitations](#known-limitations)

## Development Setup Issues

### pnpm install failures

Ensure you are running the correct versions:

- **Node.js >= 18** (`node --version`)
- **pnpm 9.x** (`pnpm --version`)

If versions are correct and install still fails, delete `node_modules` and the pnpm lockfile, then retry:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Expo prebuild issues

If the native project is in a bad state, clean and rebuild:

```bash
npx expo prebuild --clean
```

### Mapbox token errors

Mapbox uses two different token types:

- **Public token** (`pk.` prefix) — used at runtime via `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
- **Secret/downloads token** (`sk.` prefix) — used for downloading the Mapbox SDK at build time

Ensure you are using the correct prefix for each context.

### Turborepo cache issues

If builds produce stale results, bypass the Turborepo cache:

```bash
pnpm build --force
```

## Mobile App Issues

### Location permissions denied

- Check device Settings and ensure location permissions are granted for the app.
- Enable **high accuracy GPS** mode on the device for best results.

### Google Sign-In configuration

Verify the following:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set correctly in your environment.
- The SHA-1 fingerprint for your debug/release keystore is registered in the Google Cloud Console.

### Metro bundler cache

If the Metro bundler serves stale JavaScript, clear its cache:

```bash
npx expo start --clear
```

### Android emulator GPS

The Android emulator does not provide real GPS data. To simulate a location:

1. Open the emulator's **Extended Controls** (three-dot menu).
2. Navigate to **Location**.
3. Set the desired coordinates and click **Send**.

### Mapbox not loading

Ensure `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is set in your environment. The token must be a public token with the `pk.` prefix.

## Web Portal Issues

### Supabase connection errors

Verify the following environment variables are set correctly:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These must match your Supabase project's API settings.

### Auth callback redirect issues

Ensure the `/auth/callback` route is properly configured in your Next.js app and that the redirect URL is registered in your Supabase project's auth settings.

### Menu scan timeout

Large images may exceed GPT-4o Vision processing limits. To resolve:

- Reduce image file size before uploading.
- Compress or resize images to reasonable dimensions.

### localStorage draft issues

If stale draft data persists in the web portal, clear the browser's localStorage:

1. Open browser DevTools (F12).
2. Navigate to **Application** > **Local Storage**.
3. Clear entries for the portal's domain.

## Database Issues

### Migration ordering conflicts

Migration files must sort correctly by filename. Use a numbered or timestamped prefix (e.g., `20260101000000_create_table.sql`) to ensure correct ordering.

### Type generation out of sync

After applying new migrations, always regenerate TypeScript types:

```bash
cd packages/database && pnpm gen:types
```

### PostGIS function errors

The project uses PostGIS for geospatial queries. Ensure the **PostGIS extension** is enabled in your Supabase project:

- Go to Supabase Dashboard > Database > Extensions
- Search for `postgis` and enable it

### pgvector errors

The project uses pgvector for embedding-based similarity search. Ensure the **pgvector extension** is enabled in your Supabase project:

- Go to Supabase Dashboard > Database > Extensions
- Search for `vector` and enable it

## Edge Function Issues

### CORS errors

Ensure the edge function includes proper CORS headers in its response. All functions should handle `OPTIONS` preflight requests and return appropriate `Access-Control-Allow-*` headers. See [Edge Functions](./07-edge-functions.md) for the standard CORS pattern.

### Missing environment variables

Edge function secrets must be set via the Supabase CLI:

```bash
supabase secrets set KEY=value
```

Common required secrets include `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`.

### Cold start timeouts

The first invocation of an edge function may be slow due to Deno cold start. Subsequent invocations will be faster. If timeouts persist, check function complexity and external API call latency.

### Redis connection failures (feed function)

The `feed` function uses Upstash Redis for caching. Verify:

- `UPSTASH_REDIS_REST_URL` is set correctly
- `UPSTASH_REDIS_REST_TOKEN` is set correctly

### 8-second debounce on enrich-dish

The `enrich-dish` function has an 8-second debounce window. Rapid dish saves within this window may skip enrichment. This is by design to avoid redundant API calls during batch edits.

## Known Limitations

- **TypeScript types may lag behind latest migrations.** Re-run `pnpm gen:types` in `packages/database` after any migration change.
- **FavoritesScreen and ViewedHistoryScreen** are placeholder implementations in the mobile app.
- **CI/CD pipeline** is not yet implemented; all deployments are manual.
- **iOS builds** require an Apple Developer account configuration that is not yet set up.

<!-- TODO: Add issues as they are discovered -->

---

**See also:** [Environment Setup](./08-environment-setup.md) | [CLI Commands](./03-cli-commands.md) | [Edge Functions](./07-edge-functions.md)

# Environment Setup

## Table of Contents

- [Overview](#overview)
- [Variable Reference](#variable-reference)
- [Getting API Keys](#getting-api-keys)
- [Security Notes](#security-notes)

---

## Overview

Environment variables follow platform-specific naming conventions:

- **Mobile app**: prefixed with `EXPO_PUBLIC_` (bundled into the client at build time)
- **Web portal**: prefixed with `NEXT_PUBLIC_` for client-exposed vars; unprefixed for server-only
- **Edge functions**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the Supabase runtime; additional secrets must be set via the Supabase Dashboard

Each app has its own `.env` (or `.env.local`) file. See the `.env.example` in each workspace for the template.

## Variable Reference

### Root

| Variable | Required | Description |
|----------|----------|-------------|
| `MAPBOX_ACCESS_TOKEN` | Yes | Public Mapbox token for map rendering |
| `MAPBOX_DOWNLOADS_TOKEN` | Yes | Secret Mapbox token for downloading native SDK artifacts |
| `NODE_ENV` | No | Environment mode (defaults to `development`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-level Supabase access (bypasses RLS) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for enrichment and embeddings |

### Mobile App

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anonymous key |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Yes | Google OAuth Web Client ID |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Yes | Mapbox public token for map component |
| `EXPO_PUBLIC_API_URL` | Yes | Base URL for edge functions |
| `EXPO_PUBLIC_DEFAULT_LAT` | No | Default map latitude (defaults to Mexico City) |
| `EXPO_PUBLIC_DEFAULT_LNG` | No | Default map longitude |
| `EXPO_PUBLIC_DEFAULT_ZOOM` | No | Default map zoom level |
| `EXPO_PUBLIC_DEBUG` | No | Enable verbose logging |

### Web Portal

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anonymous key |

<!-- TODO: document any server-only web portal env vars (e.g., OPENAI_API_KEY if used server-side) -->

### Edge Functions

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Auto-injected | Provided automatically by the Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Provided automatically by the Supabase runtime |
| `OPENAI_API_KEY` | Yes | Must be set manually in Supabase Dashboard > Secrets |

### Infrastructure Scripts

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-level Supabase access |
| `ENRICH_DISH_URL` | Yes | Full URL of the `enrich-dish` edge function endpoint |

## Getting API Keys

**Supabase**
1. Create a project at [supabase.com](https://supabase.com)
2. Copy the project URL and anon key from Settings > API
3. Copy the service role key from the same page (keep this secret)

**Mapbox**
1. Sign up at [mapbox.com](https://www.mapbox.com)
2. Create a public access token (for map rendering)
3. Create a secret token with `Downloads:Read` scope (for native SDK installation)

**OpenAI**
1. Create an API key at [platform.openai.com](https://platform.openai.com)
2. Ensure the key has access to `gpt-4o`, `gpt-4o-mini`, and `text-embedding-3-small`

**Google OAuth**
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Configure the OAuth consent screen
3. Create an OAuth 2.0 Web Client ID (used for both mobile and web sign-in)

<!-- TODO: document iOS Client ID setup if applicable -->

## Security Notes

- **Never commit `.env` files.** All `.env` and `.env.local` files are listed in `.gitignore`.
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Use it only in trusted server-side contexts (edge functions, infra scripts).
- `EXPO_PUBLIC_` and `NEXT_PUBLIC_` vars are bundled into client code and visible to end users. Only put public/non-secret values in these.
- Store edge function secrets via the Supabase Dashboard, not in config files.

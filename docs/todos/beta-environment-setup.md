# Beta Environment Setup Plan — EatMe

> **Status**: Planning complete. Implementation pending.
> **Created**: March 6, 2026
> **Resume here when ready to implement.**

---

## Context

The Alpha Supabase project (`tqroqqvxabolydyznewa`) contains the live development database with significant test data. A new **BETA_EatMe** Supabase project has been created as a clean slate for Friends & Family testing with real-world data only.

This document covers every step required to:

1. Set up the BETA Supabase project from scratch (schema, auth, storage, edge functions).
2. Route all app environments (web portal + mobile) to BETA.
3. Preserve the ability to switch back to Alpha for continued development.

---

## Key File Locations (for reference)

| Artifact                   | Path                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Migrations (41 files)      | `infra/supabase/migrations/`                                                                 |
| Web portal Supabase client | `apps/web-portal/lib/supabase.ts`                                                            |
| Mobile Supabase client     | `apps/mobile/src/lib/supabase.ts`                                                            |
| Mobile env template        | `apps/mobile/.env.example`                                                                   |
| Root env template          | `.env.example`                                                                               |
| Edge functions             | `infra/supabase/functions/` (`feed`, `group-recommendations`, `nearby-restaurants`, `swipe`) |
| EAS build config           | `apps/mobile/eas.json`                                                                       |
| Authoritative DB schema    | `infra/supabase/migrations/databa_schema.sql`                                                |

---

## Phase 1 — Audit & Clean Duplicate Migrations

**Estimated effort**: 1–2 hours

The `infra/supabase/migrations/` folder has **duplicate number prefixes** from development experiments (two `006_`, two `007_`, two `008_`, etc.). Running these on a fresh project would cause conflicts or apply the wrong file.

**Actions**:

- [ ] For each duplicated number (006–017), compare the two files side by side and decide which is canonical.
- [ ] Rename/remove superseded files so the full sequence is unambiguous (001 → 040, no duplicate prefixes).
- [ ] Verify `databa_schema.sql` matches the intended final state.
- [ ] Do a dry run: mentally walk through the ordered list and confirm the schema builds up correctly end-to-end.

**Current duplicate pairs to resolve**:

| Number | File A                                         | File B                                            |
| ------ | ---------------------------------------------- | ------------------------------------------------- |
| 006    | `006_add_dish_photos.sql`                      | `006_create_user_profiles.sql`                    |
| 007    | `007_add_rating_system.sql`                    | `007_change_location_to_jsonb.sql`                |
| 008    | `008_add_admin_role_with_security.sql`         | `008_create_storage_bucket.sql`                   |
| 009    | `009_add_dietary_columns.sql`                  | `009_add_refresh_materialized_views_function.sql` |
| 011    | `011_link_dishes_to_ingredients.sql`           | `011_remove_ingredients_columns.sql`              |
| 012    | `012_create_canonical_ingredient_system.sql`   | `012_user_swipe_tracking.sql`                     |
| 013    | `013_add_comprehensive_ingredients.sql`        | `013_user_behavior_profiles.sql`                  |
| 014    | `014_dish_analytics.sql`                       | `014_fix_canonical_ingredients_mapping.sql`       |
| 015    | `015_add_comprehensive_ingredient_aliases.sql` | `015_geospatial_functions.sql`                    |
| 016    | `016_fix_geospatial_functions.sql`             | `016_restructure_menu_system.sql`                 |
| 017    | `017_add_display_order_to_dishes.sql`          | `017_multi_role_and_preferences.sql`              |

> **Tip**: Both files in each pair may be valid and should both be kept — they just need unique prefixes (e.g. `006a_` and `006b_`). The copilot-instructions.md already documents this pattern.

---

## Phase 2 — Supabase CLI: Link & Push Schema to BETA

**Estimated effort**: 30 minutes

The project has no `config.toml` yet (Supabase CLI was never linked).

**Actions**:

- [ ] Install Supabase CLI if not already installed:
  ```bash
  # macOS/Linux via npm
  npm install -g supabase
  # or via Homebrew
  brew install supabase/tap/supabase
  ```
- [ ] Log in:
  ```bash
  supabase login
  ```
- [ ] From `infra/supabase/`, link to the BETA project (get `<BETA_PROJECT_REF>` from the Supabase BETA dashboard URL):
  ```bash
  cd infra/supabase
  supabase link --project-ref <BETA_PROJECT_REF>
  ```
  This creates `infra/supabase/config.toml` — commit it.
- [ ] Push all cleaned migrations to BETA:
  ```bash
  supabase db push
  ```
- [ ] Verify in Supabase Dashboard → Database → Migrations that all 40 migrations show as applied.

---

## Phase 3 — Auth Configuration in BETA Dashboard

**Estimated effort**: 45 minutes  
**Done manually in the Supabase BETA Dashboard** (cannot be scripted via migrations).

- [ ] **OAuth Providers** (Settings → Auth → Providers):
  - Enable **Google** OAuth — reuse same Client ID/Secret from Google Cloud Console.
  - Enable **Facebook** OAuth — reuse same App ID/Secret from Facebook Developer Console.
  - Add the new BETA redirect URI to each OAuth app's allowed callback list:
    `https://<BETA_PROJECT_REF>.supabase.co/auth/v1/callback`
- [ ] **Site URL**: Set to web-portal domain (use `http://localhost:3000` during initial F&F testing if self-hosted).
- [ ] **Redirect URLs allowlist**: Add:
  - `http://localhost:3000/**`
  - `eatme://` (mobile deep link)
  - Production web domain when available
- [ ] **Email Templates**: Customise signup confirmation, password reset, and magic link emails to use EatMe branding (copy from Alpha's configuration).
- [ ] **JWT Expiry**: Review and set to match Alpha settings.

---

## Phase 4 — Deploy Edge Functions to BETA

**Estimated effort**: 20 minutes

Four edge functions must be deployed: `feed`, `group-recommendations`, `nearby-restaurants`, `swipe`.

**Actions**:

- [ ] Deploy all functions:
  ```bash
  cd infra/supabase
  supabase functions deploy --project-ref <BETA_PROJECT_REF>
  ```
- [ ] Check if any functions use secrets (e.g. OpenAI key, service role key). If so, set them:
  ```bash
  supabase secrets set OPENAI_API_KEY=<value> --project-ref <BETA_PROJECT_REF>
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<value> --project-ref <BETA_PROJECT_REF>
  ```
- [ ] Smoke-test the `nearby-restaurants` function:
  ```bash
  curl -X POST 'https://<BETA_PROJECT_REF>.supabase.co/functions/v1/nearby-restaurants' \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <BETA_ANON_KEY>" \
    -d '{"latitude": 19.4326, "longitude": -99.1332, "radiusKm": 5}'
  ```

---

## Phase 5 — Swap Environment Variables

**Estimated effort**: 20 minutes

Get BETA credentials from: Supabase BETA Dashboard → Settings → API.

### Web Portal (`apps/web-portal/`)

- [ ] Rename current `.env.local` → `.env.alpha` (backup Alpha credentials).
- [ ] Create new `.env.local` with BETA values:
  ```dotenv
  NEXT_PUBLIC_SUPABASE_URL=https://<BETA_PROJECT_REF>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<BETA_ANON_KEY>
  ```
  (Keep all other variables like `MAPBOX_ACCESS_TOKEN` unchanged.)

### Mobile (`apps/mobile/`)

- [ ] Rename current `.env` → `.env.alpha` (backup Alpha credentials).
- [ ] Create new `.env` with BETA values:
  ```dotenv
  EXPO_PUBLIC_SUPABASE_URL=https://<BETA_PROJECT_REF>.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<BETA_ANON_KEY>
  ```
  (Keep `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` and location defaults unchanged.)

### EAS Build (`apps/mobile/eas.json`)

- [ ] Add a `beta` build profile so cloud builds target BETA:
  ```json
  "beta": {
    "extends": "preview",
    "env": {
      "EXPO_PUBLIC_SUPABASE_URL": "https://<BETA_PROJECT_REF>.supabase.co",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<BETA_ANON_KEY>"
    }
  }
  ```
- [ ] Keep the existing `preview` profile pointing to Alpha for development builds.

---

## Phase 6 — Smoke Test & Sign-off

**Estimated effort**: 1 hour

- [ ] All 40 migrations applied (Dashboard → Database → Migrations).
- [ ] `photos` storage bucket exists and is public (Dashboard → Storage).
- [ ] Sign up with a new test email → confirmation email arrives from BETA.
- [ ] Google OAuth login completes and redirects correctly.
- [ ] Restaurant onboarding form submits → record appears in BETA (not Alpha).
- [ ] Upload a dish photo → appears in BETA's `photos` storage bucket.
- [ ] `nearby-restaurants` edge function responds with valid JSON.
- [ ] Mobile app authenticates and map loads restaurant markers.
- [ ] No console errors referencing the Alpha project URL.

---

## Alpha Preservation

The Alpha project (`tqroqqvxabolydyznewa`) is **not decommissioned**. It remains accessible for:

- Continued feature development.
- Debugging and testing new migrations before promoting to BETA.
- Switching back: restore `.env.alpha` → `.env.local` (web) and `.env.alpha` → `.env` (mobile).

---

## Summary

| Phase     | Action                             | Effort       |
| --------- | ---------------------------------- | ------------ |
| 1         | Audit & clean duplicate migrations | ~1–2 hrs     |
| 2         | Supabase CLI link + `db push`      | ~30 min      |
| 3         | Auth config in BETA Dashboard      | ~45 min      |
| 4         | Deploy edge functions + secrets    | ~20 min      |
| 5         | Swap env vars (web + mobile + EAS) | ~20 min      |
| 6         | Smoke test                         | ~1 hr        |
| **Total** |                                    | **~4–5 hrs** |

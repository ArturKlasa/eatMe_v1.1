# CI/CD Implementation Plan — EatMe

> **Status**: Planning complete. Implementation pending.
> **Created**: March 6, 2026
> **Resume here when ready to implement.**

---

## Context

EatMe is a pnpm + Turborepo monorepo with three deployment targets:

| Target     | Tech                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| Web Portal | Next.js 16 (app router)                                                      |
| Mobile App | React Native 0.81 + Expo Bare workflow                                       |
| Database   | Supabase/PostgreSQL + PostGIS, 41 migrations in `infra/supabase/migrations/` |

---

## Chosen Solution

**GitHub Actions** as the CI/CD backbone, with purpose-fit tools for each layer:

| Layer               | Tool                              | Reason                                                        |
| ------------------- | --------------------------------- | ------------------------------------------------------------- |
| CI orchestration    | GitHub Actions                    | Native GitHub, free tier generous, best ecosystem             |
| Web Portal hosting  | Vercel                            | Zero-config Next.js, per-environment variables, preview URLs  |
| Mobile builds       | EAS (Expo Application Services)   | Irreplaceable for Bare workflow; already partially configured |
| Database migrations | Supabase CLI (`supabase db push`) | Official tool, targets projects by ref ID                     |

---

## Environments

### Branch → Environment Mapping

```
develop   ──►  Alpha       (Supabase: tqroqqvxabolydyznewa)
main      ──►  Beta        (Supabase: vknkvvipgenvnqsdqwjg)
release/* ──►  Production  [DISABLED — commented out everywhere]
```

### Environment Details

|                      | Alpha                                      | Beta                                       | Production                    |
| -------------------- | ------------------------------------------ | ------------------------------------------ | ----------------------------- |
| Purpose              | Active dev, QA, refining                   | Stable, stakeholder testing                | App Store / Live              |
| Supabase project ref | `tqroqqvxabolydyznewa`                     | `vknkvvipgenvnqsdqwjg`                     | TBD                           |
| Supabase URL         | `https://tqroqqvxabolydyznewa.supabase.co` | `https://vknkvvipgenvnqsdqwjg.supabase.co` | TBD                           |
| Supabase anon key    | Already in `eas.json` (see file)           | **⚠️ Still needed — to be provided later** | TBD                           |
| Mobile bundle ID     | `com.eatme.alpha` (proposed)               | `com.eatme.beta` (proposed)                | `com.eatme` (proposed)        |
| Vercel project       | `eatme-alpha`                              | `eatme-beta`                               | `eatme-production`            |
| DB migrations        | Auto on push                               | **Manual approval gate required**          | Manual approval gate required |
| Mobile builds        | Auto on push                               | Auto on push (after approval?)             | TBD                           |

---

## Known Answers to Pre-Implementation Questions

1. ✅ **Git hosting**: GitHub — GitHub Actions confirmed as the right choice.
2. ⚠️ **Vercel account**: Does not exist yet — must be created before Phase 4.
   - Sign up at https://vercel.com, then create two projects: `eatme-alpha` and `eatme-beta`.
   - Link both to the GitHub repo. Collect `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and per-project `VERCEL_PROJECT_ID`.
3. ✅ **Beta Supabase state**: Fresh, empty project — all 41 migrations must be applied on first deploy.
4. ❓ **Mobile platform scope**: **Not yet answered.** Android only for now, or also iOS?
   - iOS requires a macOS GitHub Actions runner (significantly more expensive EAS minutes + Apple Developer account $99/year).
   - Recommendation: Start Android-only, add iOS later.
5. ⚠️ **Beta Supabase anon key**: To be provided before implementation. Retrieve from:
   Supabase Dashboard → Project `vknkvvipgenvnqsdqwjg` → Settings → API → `anon public` key.
6. ✅ **Migration approval for Beta**: Migrations to Beta (and Production) require **manual approval** via GitHub Environment protection rules.

---

## Implementation Phases

### Phase 1 — Repository & GitHub Setup

1. In the GitHub repo, go to **Settings → Environments** and create:
   - `alpha` — no protection rules (auto-deploys from `develop`)
   - `beta` — add protection rule: **required reviewers** (manual approval gate)
   - `production` — add protection rule: required reviewers (disabled in workflows for now)

2. Add secrets to each environment (see Secrets Reference section below).

3. Confirm `develop` and `main` branches exist and have appropriate branch protection (optional but recommended: require PRs, require CI to pass).

---

### Phase 2 — CI Quality Gate

**File**: `.github/workflows/ci.yml`
**Triggers**: Every pull request to `develop` or `main`

**Steps**:

- Checkout code
- Setup pnpm + Node 18
- Install deps (`pnpm install --frozen-lockfile`)
- `turbo run lint check-types` (uses existing Turborepo config)
- `turbo run build` (web portal only — mobile native builds are too slow/expensive for CI)

**Make this a required status check** on both `develop` and `main` branches via GitHub branch protection settings.

---

### Phase 3 — Database Migration Workflow

**File**: `.github/workflows/migrate.yml`
**Triggers**:

- Push to `develop` → Alpha (auto)
- Push to `main` → Beta (requires manual approval via GitHub Environment)
- Push to `release/*` → Production (commented out)

**Steps**:

- Install Supabase CLI (`npx supabase` or via official action)
- Run `supabase db push --project-ref <REF> --password $SUPABASE_DB_PASSWORD`
- Use `SUPABASE_ACCESS_TOKEN` for auth

**Important**: On the very first deploy to Beta, all 41 migrations will run in sequence. Verify the `database_schema.sql` snapshot matches migration output after the initial apply.

---

### Phase 4 — Web Portal Deployment

**File**: `.github/workflows/deploy-web.yml`
**Triggers**: Same as Phase 3

**Pre-requisites**:

- Create Vercel account
- Create two Vercel projects: `eatme-alpha`, `eatme-beta`
- Set Supabase env vars per project in Vercel dashboard (as environment variables, not secrets — Vercel handles this)
- Collect `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_ALPHA`, `VERCEL_PROJECT_ID_BETA`

**Steps**:

- `vercel pull --environment=production --token=$VERCEL_TOKEN`
- `vercel build --prod --token=$VERCEL_TOKEN`
- `vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN`
- Uses `actions/github-script` or official `amondnet/vercel-action` GitHub Action

**Environment variables needed in Vercel (per project)**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
```

---

### Phase 5 — Mobile Build Pipeline

**File**: `.github/workflows/build-mobile.yml`
**Triggers**: Same as Phase 3 (push to `develop` or `main`)

#### 5a — Update `eas.json` (mobile app)

Rename/restructure EAS build profiles:

```jsonc
{
  "build": {
    "development": {
      /* unchanged — local dev only */
    },
    "alpha": {
      "distribution": "internal",
      "android": { "buildType": "apk" }, // APK for internal testers
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://tqroqqvxabolydyznewa.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<alpha-anon-key>",
        "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN": "<mapbox-token>",
        "MAPBOX_DOWNLOADS_TOKEN": "<mapbox-dl-token>",
      },
    },
    "beta": {
      "distribution": "internal",
      "android": { "buildType": "apk" }, // APK for beta testers, or aab for Play Store Internal Track
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://vknkvvipgenvnqsdqwjg.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<beta-anon-key — TO BE PROVIDED>",
        "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN": "<mapbox-token>",
        "MAPBOX_DOWNLOADS_TOKEN": "<mapbox-dl-token>",
      },
    },
    "production": {
      // Commented out / disabled until ready
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" }, // AAB required for Play Store
      "env": {
        /* ... */
      },
    },
  },
}
```

#### 5b — OTA Updates vs Full Builds

- **JS-only changes**: Use `eas update --branch alpha` (fast, ~2 min, no store review)
- **Native changes** (new packages, `app.json` changes, `npx expo prebuild`): Full EAS build required (~15 min)
- The workflow should detect which type of build is needed, or always do OTA + conditionally do full build.

#### 5c — Workflow logic

```
Push to develop:
  → eas update --branch alpha        (always, fast OTA)
  → eas build --profile alpha        (only if native changes detected — optional gate)

Push to main:
  → eas update --branch beta
  → eas build --profile beta

# Push to release/*: eas build --profile production  [COMMENTED OUT]
```

---

### Phase 6 — Supabase Edge Functions (if applicable)

The `nearby-restaurants` edge function exists. Consider adding:

**File**: `.github/workflows/deploy-functions.yml`

```
Push to develop → supabase functions deploy --project-ref tqroqqvxabolydyznewa
Push to main    → supabase functions deploy --project-ref vknkvvipgenvnqsdqwjg
```

---

## Store Readiness Additions (Google Play & Apple App Store)

These items should be implemented **alongside** CI/CD — they make the pipeline production-ready from day one rather than requiring a painful retrofit later.

### 1. Separate Bundle IDs per Environment

Different package names allow all three builds to coexist on a device and be submitted to separate store tracks.

Update `app.json` / `eas.json`:

```
Alpha:      com.eatme.alpha      (or com.yourcompany.eatme.alpha)
Beta:       com.eatme.beta
Production: com.eatme            (the final store listing)
```

In `app.json`, use EAS environment variables to set `android.package` and `ios.bundleIdentifier` dynamically per build profile.

### 2. EAS Managed Signing (Critical — Do This Early)

EAS can generate and securely store your Android keystore and iOS certificates in the cloud. If you lose a keystore, you **cannot** update your Play Store app.

```bash
# Run once per profile to generate and store credentials
eas credentials --platform android --profile alpha
eas credentials --platform android --profile beta
eas credentials --platform android --profile production
```

### 3. Android App Bundle (AAB) for Production

Google Play requires `.aab`, not `.apk`. APK is fine for internal alpha/beta distribution. Set `buildType: "app-bundle"` only in the `production` profile.

### 4. Auto-Incrementing Version Codes

`autoIncrement: true` is already set in the production profile. Consider enabling it for all profiles to avoid version conflicts.

### 5. `eas submit` — Automated Store Submission

EAS can push builds directly to:

- Google Play (Internal Testing → Alpha → Beta → Production tracks)
- Apple TestFlight

Add to `eas.json`:

```jsonc
"submit": {
  "alpha": {
    "android": { "serviceAccountKeyPath": "./google-play-key.json", "track": "internal" }
  },
  "beta": {
    "android": { "serviceAccountKeyPath": "./google-play-key.json", "track": "beta" }
  }
}
```

This means a `push to main` can automatically deliver a new build to Play Store Beta testers.

### 6. iOS Privacy Manifest (Required since iOS 17)

Create `ios/PrivacyInfo.xcprivacy` declaring:

- Location access (`NSPrivacyAccessedAPICategoryLocation`)
- UserDefaults / AsyncStorage (`NSPrivacyAccessedAPICategoryUserDefaults`)

Apple will **reject** submissions without this since Spring 2024.

### 7. `app.json` Permission Strings

Ensure these exist for App Store review approval:

```json
{
  "ios": {
    "infoPlist": {
      "NSLocationWhenInUseUsageDescription": "EatMe uses your location to find nearby restaurants.",
      "NSLocationAlwaysAndWhenInUseUsageDescription": "EatMe uses your location to find nearby restaurants."
    }
  },
  "android": {
    "permissions": ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
  }
}
```

### 8. EAS Update (OTA) Channels

Configure OTA update channels that mirror deployment stages:

```bash
eas update:configure
# Creates channels: alpha, beta, production
```

Allows pushing JS hotfixes without a full app store review (~hours vs. ~days).

---

## Secrets Reference

### GitHub Repository-level Secrets (shared across environments)

| Secret                   | Where to get it                               |
| ------------------------ | --------------------------------------------- |
| `EXPO_TOKEN`             | expo.dev → Account Settings → Access Tokens   |
| `SUPABASE_ACCESS_TOKEN`  | supabase.com → Account → Access Tokens        |
| `MAPBOX_DOWNLOADS_TOKEN` | Already in `eas.json` — move to GitHub secret |

### GitHub Environment: `alpha`

| Secret                 | Value                                         |
| ---------------------- | --------------------------------------------- |
| `SUPABASE_PROJECT_REF` | `tqroqqvxabolydyznewa`                        |
| `SUPABASE_DB_PASSWORD` | From Supabase Dashboard → Settings → Database |
| `SUPABASE_ANON_KEY`    | Already known (in `eas.json`)                 |
| `VERCEL_PROJECT_ID`    | From Vercel project `eatme-alpha`             |
| `VERCEL_TOKEN`         | From Vercel → Account Settings → Tokens       |
| `VERCEL_ORG_ID`        | From Vercel → Team/Org settings               |

### GitHub Environment: `beta`

| Secret                 | Value                                         |
| ---------------------- | --------------------------------------------- |
| `SUPABASE_PROJECT_REF` | `vknkvvipgenvnqsdqwjg`                        |
| `SUPABASE_DB_PASSWORD` | From Supabase Dashboard → Settings → Database |
| `SUPABASE_ANON_KEY`    | **⚠️ To be provided**                         |
| `VERCEL_PROJECT_ID`    | From Vercel project `eatme-beta`              |
| `VERCEL_TOKEN`         | Same token as alpha (or separate)             |
| `VERCEL_ORG_ID`        | Same as alpha                                 |

---

## Workflow Files to Create

```
.github/
  workflows/
    ci.yml                  # PR quality gate (lint, type-check, build)
    migrate.yml             # Supabase migrations per environment
    deploy-web.yml          # Vercel deployment per environment
    build-mobile.yml        # EAS build + OTA update per environment
    deploy-functions.yml    # Supabase Edge Functions deployment
```

---

## Outstanding Decisions / Open Questions

- [ ] **Mobile platform scope**: Android only for now, or also iOS? (iOS = macOS runner, Apple Dev account $99/yr)
- [ ] **Beta Supabase anon key**: Retrieve from Supabase dashboard and add to this doc / GitHub secrets.
- [ ] **Vercel account**: Create account, then two projects (`eatme-alpha`, `eatme-beta`), collect IDs.
- [ ] **Google Play Developer account**: Needed for `eas submit` to Play Store ($25 one-time fee).
- [ ] **Apple Developer account**: Needed for iOS builds + TestFlight ($99/yr).
- [ ] **Bundle ID**: Confirm `com.eatme` (or different) as the base package name.
- [ ] **OTA-only vs full build trigger**: Decide if full EAS builds always run on push, or only when native changes are detected.

---

## Useful Commands (for when implementation starts)

```bash
# Install Supabase CLI
npx supabase login

# Push migrations to Alpha
npx supabase db push --project-ref tqroqqvxabolydyznewa

# Push migrations to Beta
npx supabase db push --project-ref vknkvvipgenvnqsdqwjg

# EAS build for alpha
eas build --profile alpha --platform android --non-interactive

# EAS OTA update for alpha
eas update --branch alpha --message "describe change"

# EAS submit to Play Store
eas submit --profile alpha --platform android

# Deploy edge functions to Alpha
npx supabase functions deploy nearby-restaurants --project-ref tqroqqvxabolydyznewa
```

---

## Reference Files in This Repo

| File                                                                                                 | Relevance                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [apps/mobile/eas.json](../../apps/mobile/eas.json)                                                   | Current EAS build profiles — needs alpha/beta restructure                 |
| [infra/supabase/migrations/](../../infra/supabase/migrations/)                                       | 41 migration files to be applied to Beta on first run                     |
| [infra/supabase/migrations/database_schema.sql](../../infra/supabase/migrations/database_schema.sql) | Authoritative schema snapshot — use for verification after Beta migration |
| [turbo.json](../../turbo.json)                                                                       | Turborepo task graph — CI uses `lint`, `check-types`, `build`             |
| [apps/web-portal/package.json](../../apps/web-portal/package.json)                                   | Web portal deps and scripts                                               |
| [apps/mobile/app.json](../../apps/mobile/app.json)                                                   | Expo config — bundle ID and permissions live here                         |

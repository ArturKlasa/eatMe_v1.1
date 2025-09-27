## EatMe — Setup & Getting Started

This guide covers local setup for the monorepo and the Expo Bare mobile app, environment variable handling (Mapbox, Supabase), and common troubleshooting tips.

### Prerequisites
- Node.js (LTS) and npm or Yarn
- Git
- Expo CLI (optional, `npm i -g expo-cli`) — useful for some commands
- EAS CLI (optional for custom dev clients and builds): `npm i -g eas-cli`
- Android Studio (for Android emulator) and/or Xcode (for iOS simulator) if you need native builds

### Recommended Project Layout
Assumes repo root contains a Turborepo-style workspace with `/apps` and `/packages`:

```
/eatMe
  /apps/mobile
  /apps/web
  /packages/services
  /.ppd-docs
```

### 1 — Environment Files
Create a local `.env` file from the template in `.ppd-docs/.env.template` and do NOT commit it.

- Add `.env` to your `.gitignore`.
- Use `EAS secrets` or your CI provider's secret store for production values.

Sample `.env` variables (see `.ppd-docs/.env.template`):

```
# Mapbox
MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token_here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key

# Optional
SENTRY_DSN=
NODE_ENV=development
```

Note: Mapbox client tokens are used in the mobile app UI; treat them as public keys for client use but keep them private from the public repo.

### 2 — Scaffolding (quick)
If you haven't created the monorepo yet, you can scaffold a Turborepo workspace, or simply create the `/apps/mobile` folder and initialize an Expo app there.

Example quick commands (adjust as preferred):

```bash
# from repo root
npx create-turbo@latest   # follow prompts (or create manually)
cd apps
expo init mobile --template bare-minimum   # choose TypeScript template when prompted
cd mobile
npm install
```

Note: `create-turbo` may be interactive. If you prefer deterministic scaffolding, create the folders and add a `package.json` and `turbo.json` manually.

### 3 — Installing Core Dependencies (mobile)
From `/apps/mobile` install the primary libraries used in Phase 1:

```bash
npm install @rnmapbox/maps native-base zustand @react-navigation/native @react-navigation/drawer react-native-deck-swiper @react-native-async-storage/async-storage react-native-safe-area-context react-native-screens
```

For some libraries you may need to run `pod install` from the `ios` folder after `expo prebuild` or when using native projects.

### 4 — Mapbox Setup Notes
- Create a Mapbox account and generate a public access token (starts with `pk.`).
- Put the token in your local `.env` as `MAPBOX_ACCESS_TOKEN`.
- Expose the token to the app via `app.json`/`app.config.js` `extra` values or use `react-native-config`/EAS secrets.

Example `app.config.js` pattern for Expo (compile-time):

```js
// app.config.js
import 'dotenv/config'

export default {
  expo: {
    name: 'EatMe',
    slug: 'eatme',
    extra: {
      MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    },
  },
}
```

Access tokens at runtime in the app using `expo-constants`:

```js
import Constants from 'expo-constants'
const MAPBOX_TOKEN = Constants.expoConfig.extra.MAPBOX_ACCESS_TOKEN
```

#### Native config (Android / iOS)
- iOS: ensure `NSLocationWhenInUseUsageDescription` is present in `Info.plist`.
- Android: add `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions in `AndroidManifest.xml`.
- The `@rnmapbox/maps` README contains native setup steps — follow them after `expo prebuild` or in your native project.

#### Cost control and token notes
- Mapbox usage may incur costs if tile or API usage is high. During development use sparse markers and avoid heavy tile requests.
- For production, monitor usage in the Mapbox dashboard and set usage alerts.
- If Mapbox costs or integration become blockers, fallback options include `react-native-maps` with OpenStreetMap tiles.

### 5 — Running the App Locally
- For quick JS-only dev (no native Mapbox features):

```bash
cd apps/mobile
expo start
```

- To run a native development build (recommended for Mapbox):

```bash
cd apps/mobile
expo prebuild   # if using config plugins or native changes
expo run:android   # or expo run:ios
# Or create a custom dev client with EAS
eas build --profile development --platform android
```

If `expo run:android` fails, ensure Android SDK and platform tools are installed and the Android emulator is running.

### 6 — Supabase Quick Notes
- Create a Supabase project and copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` into your `.env`.
- Use `@supabase/supabase-js` on the client for read operations. For secure operations or API keys, use Supabase Edge Functions.

Example client init:

```js
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = Constants.expoConfig.extra.SUPABASE_URL
const supabaseAnonKey = Constants.expoConfig.extra.SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 7 — Sensitive Data & CI/CD
- Do not commit `.env` to git. Add it to `.gitignore`.
- For CI and production builds, use `EAS secrets` (for Expo) or your provider's environment variable store.

### 8 — Troubleshooting (common issues)
- Map renders blank: ensure token is set, native modules installed, and platform permissions granted.
- Map markers missing: verify coordinates in mock data and that `ShapeSource`/`SymbolLayer` are populated.
- Build failures after installing native deps: run `expo prebuild` then `cd ios && pod install`.
- Permission request refused: clear app data or reinstall app to re-trigger permission flows.

### 9 — Next Steps (suggested)
1. Create `.env` from `.ppd-docs/.env.template` and fill credentials.
2. Scaffold the monorepo or create `/apps/mobile` and `expo init` the app.
3. Install core deps and verify `expo run:android` (or run a custom dev client via EAS).
4. Add a minimal Mapbox map screen and load mock markers from `packages/services/mock`.

If you want, I can scaffold the initial `/apps/mobile` boilerplate and add a minimal Mapbox screen and mock data files.

# EatMe AI Coding Instructions

## Project Overview

**EatMe** is a food discovery platform combining map-based restaurant discovery with swipe-based preference learning. Three main components:

- **Mobile App** (`apps/mobile`): React Native 0.81 + Expo Bare with Mapbox & Zustand, consumers discover & rate restaurants/dishes
- **Web Portal** (`apps/web-portal`): Next.js 14 with shadcn/ui, restaurant partners manage menus & ingredients  
- **Backend**: Supabase (PostgreSQL + PostGIS), RLS-enforced data ownership, ingredient/allergen system

**pnpm + Turborepo monorepo**. Shared packages:
- `packages/database`: Planned Supabase client (web-portal currently has own at `lib/supabase.ts`)
- `packages/ui`: React components (minimal use)
- `packages/typescript-config`: TypeScript configs
- `packages/eslint-config`: ESLint configs

## Architecture & Data Flow

### Core Design Patterns

1. **Restaurant Onboarding** → LocalStorage draft auto-save at each form step → Final submission to Supabase all-at-once. Avoids partial incomplete states. Pattern: `apps/web-portal/app/onboard/{basic-info,menu,review}/page.tsx` + `lib/storage.ts`

2. **Ingredient System** (NEW - Feb 2026): Master ingredients table with auto-calculated allergens/dietary tags via Postgres triggers on dish creation. Workflow:
   - User selects ingredients via `IngredientAutocomplete` component 
   - Selected ingredients array stored temporarily in form state
   - On dish save: link to `ingredients_master`, trigger fires to populate `dishes.allergens` and `dishes.dietary_tags`
   - Components: `lib/ingredients.ts` (API), `AllergenWarnings.tsx`, `DietaryTagBadges.tsx`

3. **Database Ownership** via RLS policies: `owner_id` FK to `auth.users`. Users can CRUD only their own restaurants/menus/dishes. Every table has RLS enabled (default deny-all).

4. **Geospatial Format**: PostGIS `POINT(lng lat)` - **longitude first**. Helper: `formatLocationForSupabase(lat, lng)` in `apps/web-portal/lib/supabase.ts`

5. **Mobile State**: Zustand stores (`apps/mobile/src/stores/`) for UI state, auth via Supabase (async storage for session persistence - planned/in-progress).

### Data Flow Example: Restaurant Creation
```
Web Portal Form (LocalStorage draft) 
  → User clicks Submit 
  → review/page.tsx validates & transforms
  → Supabase: INSERT restaurants, menus, dishes (with ingredient_ids)
  → DB triggers calculate allergens/dietary tags
  → Clear LocalStorage 
  → Redirect to dashboard
```

## Development Commands

### Monorepo Setup & Running

```bash
# From project root
pnpm install              # Install all deps
pnpm dev                  # Run all apps in parallel (web-portal + mobile)
pnpm build                # Build all packages
pnpm lint                 # Run ESLint across monorepo
turbo run check-types     # TypeScript check all packages

# Run specific app
turbo dev --filter=web-portal
turbo dev --filter=mobile
```

### Web Portal (`apps/web-portal`) - Next.js 14

```bash
cd apps/web-portal
pnpm dev                  # http://localhost:3000
pnpm build && pnpm start  # Production
```

**Key URLs during dev:**
- Onboarding: `/onboard/basic-info` → `/onboard/menu` → `/onboard/review`
- Auth: `/auth/login`, `/auth/signup`, `/auth/callback` (OAuth redirect)
- Admin: `/admin/*` (if implemented)

### Mobile App (`apps/mobile`) - React Native 0.81 + Expo Bare

**CRITICAL: Bare workflow requires native build, not Expo Go**

```bash
cd apps/mobile

# First time ONLY:
npx expo prebuild          # Generate android/ and ios/ folders
npx expo run:android       # Build + run dev client on Android

# After first build:
pnpm start                 # Start Metro bundler
pnpm android               # Run on Android emulator/device  
pnpm ios                   # iOS (macOS + Xcode only)

# For production builds:
eas build --platform android  # Cloud build via EAS
```

**Why not Expo Go?** Custom Mapbox native module + custom native code won't run in Expo Go. Development client is required.

### Database / Supabase

- **Migrations**: `infra/supabase/migrations/*.sql` (sequential 001-023)
- **Naming**: `00X_descriptive_name.sql`
- **Test locally**: Supabase Dashboard SQL Editor before committing
- **RLS**: Always enable on new tables, test policies thoroughly

### Important Scripts

```bash
# Across monorepo from root
pnpm format               # Prettier format (TypeScript, Markdown)
turbo clean               # Clear Turbo cache (if builds behave oddly)
```

## Project-Specific Conventions

### Web Portal Forms & State

- **Form Library**: React Hook Form + Zod validation pattern: `apps/web-portal/app/onboard/basic-info/page.tsx`
- **LocalStorage Auto-Save**: `apps/web-portal/lib/storage.ts` - wrapped in try-catch, non-fatal errors
- **Storage Keys**: `eatme_restaurant_draft`, `eatme_draft_${user.id}` - clear after Supabase submission to prevent stale data
- **Components**: shadcn/ui in `apps/web-portal/components/ui/`

### Ingredient & Allergen System (Feb 2026)

**Tables**: `ingredients_master`, `allergens`, `dietary_tags`, `dish_ingredients`

**Flow**:
1. `IngredientAutocomplete.tsx` - User selects from `ingredients_master` with search
2. Selected ingredients stored in component state (array of ingredient IDs + quantities)
3. On form submit → dish saved with `ingredient_ids` 
4. **Postgres trigger** fires: calculates allergens from ingredients → populates `dishes.allergens` JSON column
5. Display via `AllergenWarnings.tsx` (⚠️ icons) and `DietaryTagBadges.tsx` (🏷️ tags)

**API Layer**: `apps/web-portal/lib/ingredients.ts` - Handles ingredient search and allergen lookup

### Database & RLS

**Location**: `infra/supabase/migrations/` (numbered 001-023, latest adds currency/preferences)

**Every table needs**:
- ✅ RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- ✅ Policy for `owner_id` FK check (users see/edit only own data)
- ✅ Service role bypass for system operations (with `security_invoker` note)

**Conditional DDL Pattern**:
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'dishes' AND column_name = 'allergens') THEN
    ALTER TABLE dishes ADD COLUMN allergens JSONB DEFAULT '[]';
  END IF;
END $$;
```

### TypeScript Types

- **Web Portal DB Types**: `apps/web-portal/lib/supabase.ts` (RestaurantInsert, Restaurant, Dish, etc.)
- **Mobile Types**: `apps/mobile/src/types/` (separate, not yet connected to Supabase)
- **Keep synced** with SQL migrations in `infra/supabase/migrations/`

### State Management

- **Mobile**: Zustand stores in `apps/mobile/src/stores/` (UI state layer)
- **Web Portal**: React Hook Form (forms), AuthContext (`apps/web-portal/contexts/AuthContext.tsx` for session), no global state
- **Auth**: Supabase Auth handles sign-up/sign-in, AuthContext wraps app

### Authentication (Web Portal)

**Sign Up**: Email/password + restaurant name → Supabase Auth → email verification → user.user_metadata.restaurant_name

**Sign In**: Email/password OR Google/Facebook OAuth → `/auth/callback` URL handler → parse token → redirect dashboard

**Protected Routes**: Check `useAuth().user`, redirect to `/auth/login` if null

**Sign Out**: Clears Supabase session + localStorage (uses `eatme_draft_${user.id}` cleanup)

### Maps

- **Web**: Mapbox GL JS (vanilla JavaScript, not React wrapper)
- **Mobile**: `@rnmapbox/maps` v10.1.45 (React Native Mapbox - different API!)
- **Setup guides**: 
  - Mobile: `apps/mobile/MAPBOX_RESTORATION.md`
  - Web: `docs/mapbox-setup.md`

## Testing & Validation

**Ingredient System Test** (from `INTEGRATION_COMPLETE_SUMMARY.md`):
1. Go to `/onboard/menu` → Create menu → Add dish
2. Search ingredients: "cheese", "lettuce", "eggs"
3. Watch allergen warnings appear (⚠️ Milk, Eggs)
4. Check dietary badge shows (🌱 Vegetarian)
5. Verify in Supabase Dashboard that `dishes.allergens` and `dishes.dietary_tags` populated by trigger

## Testing & Validation

- **Web Portal**: Manual testing in browser. Verify Supabase integration via SQL Editor queries.
- **Mobile**: Test on physical devices or emulators. Use `__DEV__` checks for dev-only features.
- No automated test suite yet - TDD is aspirational, not current practice.

## Debugging & Logging Conventions

### Current Practice

- **Prefix Logs**: `console.error('[ComponentName] message')`, `console.log('[Feature] state')`
- **Context Prefixes**: `[OAuth]`, `[Storage]`, `[Ingredients]` for readability
- **Error Pattern**: Try-catch with context, log error, show user-friendly toast (via `sonner` library)
- **Non-Fatal Failures**: LocalStorage errors log but don't crash - graceful degradation

### Error Handling Pattern

```typescript
try {
  const { data, error } = await supabaseAction();
  if (error) {
    console.error('[Context] Action failed:', error);
    toast.error('User-friendly message');
    throw error;
  }
  console.log('[Context] Action successful:', data);
} catch (error) {
  console.error('[Context] Unexpected error:', error);
  return { error: error as Error };
}
```

### Debugging Tips

- **Mobile Native Issues**: Check `android/app/build.gradle`, `ios/Podfile` - changes need `npx expo prebuild --clean`
- **Ingredient Triggers**: Verify trigger fired in Supabase Dashboard by checking `dishes.allergens` JSONB column post-insert
- **RLS Blocks Writes**: If INSERT silently fails, check RLS policy matches user session
- **PostGIS POINT Error**: If error contains "GiST index", verify `POINT(lng lat)` order - longitude first!
- **LocalStorage Quota**: Check `navigator.storage.estimate()` if form data won't persist

## Common Pitfalls

1. **PostGIS POINT Format**: Always use `POINT(lng lat)` - longitude comes first, not latitude. Use the helper function.

2. **Supabase RLS**: When adding new tables, ALWAYS enable RLS and create policies. Default is deny-all. See existing migrations for patterns.

3. **LocalStorage Keys**: Web portal uses `eatme_restaurant_draft` for form data. Clear it after successful submission to avoid stale data.

4. **Monorepo Paths**: When importing from packages, use workspace protocol: `"@repo/ui": "workspace:*"` in package.json. Don't use relative paths across app boundaries.

5. **Mobile Native Modules**: Changes to `app.json`, native dependencies, or native code require a new development build. Restart Metro is not enough.

6. **Turbo Cache**: If builds behave strangely, try `turbo clean` from root to clear cache.

7. **Shared Packages Status**:
   - `packages/database` contains platform-agnostic Supabase client intended for sharing between mobile and web
   - Currently **web-portal uses its own client** at `apps/web-portal/lib/supabase.ts` with identical types
   - Migration to shared package is planned but not yet implemented
   - When refactoring, use `@eatme/database` export and update environment variable prefixes

## Mobile Supabase Integration (Planned)

When connecting mobile app to Supabase:

1. **Option A: Use Shared Package** (Recommended)

   ```typescript
   // apps/mobile/src/lib/supabase.ts
   import { supabase } from '@eatme/database';
   // Add AsyncStorage for React Native session persistence
   ```

   - Set environment variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - The shared client automatically detects Expo environment variables
   - Requires adding `@react-native-async-storage/async-storage` (already installed)

2. **Option B: Separate Mobile Client** (Current web-portal pattern)

   ```typescript
   // Create similar to apps/web-portal/lib/supabase.ts
   // But use expo-secure-store or AsyncStorage for auth persistence
   ```

3. **AsyncStorage Configuration**

   ```typescript
   import AsyncStorage from '@react-native-async-storage/async-storage';

   const supabase = createClient(url, anonKey, {
     auth: {
       storage: AsyncStorage,
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: false, // Not needed in mobile
     },
   });
   ```

## File Locations Reference

- **Supabase Client**: `apps/web-portal/lib/supabase.ts` (web), not yet created for mobile
- **Auth Logic**: Web portal auth pages in `apps/web-portal/app/auth/`
- **Restaurant Onboarding**: Multi-step wizard in `apps/web-portal/app/onboard/` (basic-info, menu, review)
- **Database Schema**: Full ERD documented in `docs/schema-erd.md`
- **Mapbox Setup**: Mobile guide at `apps/mobile/MAPBOX_RESTORATION.md`
- **Migration Status**: Current state in `docs/supabase-integration-status.md`

## Current Development Phase

**Status as of February 2026**: 
- ✅ Web Portal: Live with Supabase integration, ingredient system with allergen triggers complete
- ⏳ Mobile: Mapbox setup done, Supabase connection planned
- 📋 Next: Mobile dish/restaurant browsing UI, swipe interface, user preferences

**Key Files by Phase**:
- Restaurant Onboarding: `apps/web-portal/app/onboard/*/page.tsx`
- Ingredient System: `apps/web-portal/lib/ingredients.ts` + `IngredientAutocomplete.tsx`
- DB Schema: `infra/supabase/migrations/023_fix_profile_completion_function.sql` (latest)
- Mobile Foundation: `apps/mobile/src/screens/`, `apps/mobile/src/stores/`

## Testing Strategy

- **Web Portal**: Manual testing in browser. Verify Supabase integration via SQL Editor queries.
- **Mobile**: Test on physical devices or emulators. Use `__DEV__` checks for dev-only features.
- **Ingredient Triggers**: Go to `/onboard/menu`, add dish with 3+ ingredients, check Supabase Dashboard for allergens/dietary_tags JSONB updates
- No automated test suite yet - TDD is aspirational, not current practice.

---

_Last Updated: February 16, 2026_

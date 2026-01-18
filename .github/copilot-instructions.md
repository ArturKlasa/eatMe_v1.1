# EatMe AI Coding Instructions

## Project Overview

**EatMe** is a food discovery platform with three main components:

- **Mobile App** (`apps/mobile`): React Native (Expo bare workflow) for consumers to discover restaurants and dishes
- **Web Portal** (`apps/web-portal`): Next.js 14 app for restaurant partners to manage their listings
- **Backend**: Supabase (PostgreSQL with PostGIS) for data storage and authentication

This is a **pnpm + Turborepo monorepo** with shared packages:

- `packages/database`: Platform-agnostic Supabase client (planned for sharing, currently web-portal has its own)
- `packages/ui`: Shared React components (stub, not actively used yet)
- `packages/typescript-config`: Shared TypeScript configurations
- `packages/eslint-config`: Shared ESLint configurations

## Architecture & Data Flow

### Key Design Decisions

1. **Restaurant Portal Strategy**: Built as a standalone Next.js app first, using LocalStorage for drafts and direct Supabase submission for production data. No separate admin backend needed - restaurant owners authenticate directly via Supabase Auth.

2. **Geospatial Data**: All location data uses **PostGIS** `POINT(lng lat)` format (longitude first!). Convert using `formatLocationForSupabase(lat, lng)` from `apps/web-portal/lib/supabase.ts`.

3. **Database Ownership Model**: Restaurants have `owner_id` (FK to `auth.users`). RLS policies enforce that users can only modify their own restaurants, menus, and dishes. See `infra/supabase/migrations/005_add_authentication.sql`.

4. **Multi-Step Forms**: Web portal uses React Hook Form + Zod validation with LocalStorage auto-save at each step (`apps/web-portal/app/onboard/*`). Data persists across page refreshes until final submission.

## Development Commands

### Monorepo-Level Commands (from root)

```bash
pnpm dev              # Start all apps in parallel
pnpm build            # Build all apps
pnpm lint             # Lint all packages
turbo dev --filter=web-portal    # Run specific app
```

### Mobile App (`apps/mobile`)

```bash
cd apps/mobile
pnpm start            # Start Metro bundler
pnpm android          # Run on Android (requires emulator/device)
pnpm ios              # Run on iOS (macOS + Xcode only)
```

**Important**: Mobile uses **Expo bare workflow** with custom native code. Do NOT suggest Expo Go - it won't work with Mapbox or custom native modules. Use development builds via EAS: `eas build --profile development --platform android`.

### Web Portal (`apps/web-portal`)

```bash
cd apps/web-portal
pnpm dev              # Runs on http://localhost:3000
pnpm build            # Production build
```

## Project-Specific Conventions

### Database Migrations

- Location: `infra/supabase/migrations/*.sql`
- Naming: `00X_descriptive_name.sql` (sequential numbering)
- Always include RLS policies for every table
- Use `DO $$ BEGIN ... END $$;` blocks for conditional DDL (checking column existence, etc.)
- Test locally via Supabase Dashboard SQL Editor before committing

### Component Structure (Web Portal)

- Uses **shadcn/ui** components in `apps/web-portal/components/ui/`
- Form fields use React Hook Form + Zod: see `apps/web-portal/app/onboard/basic-info/page.tsx` for pattern
- Map integration via **Mapbox GL JS** (web) and **@rnmapbox/maps** (mobile) - these are different libraries!

### TypeScript Types

- Database types defined in `apps/web-portal/lib/supabase.ts` (e.g., `RestaurantInsert`, `Restaurant`)
- Keep types synced with SQL schema in `infra/supabase/migrations/`
- Mobile app uses separate types in `apps/mobile/src/types/`

### State Management

- Mobile: **Zustand** stores in `apps/mobile/src/stores/`
- Web Portal: React Hook Form for forms, AuthContext for user session, no global state library yet

### Authentication Flow (Web Portal)

- **Sign Up**: Email/password + restaurant name → Supabase Auth → email verification required
- **Sign In**: Email/password or OAuth (Google/Facebook) → redirects to `/auth/callback`
- **Session Management**: `AuthContext` wraps app in `apps/web-portal/contexts/AuthContext.tsx`
- **Protected Routes**: Check `user` from `useAuth()` hook, redirect to `/auth/login` if null
- **User Metadata**: Restaurant name stored in `user.user_metadata.restaurant_name` during signup
- **Sign Out**: Clears Supabase session + user-specific LocalStorage (`eatme_draft_${user.id}`)

OAuth callback flow: Provider → Supabase → `/auth/callback` → parse URL params → redirect to dashboard

## Debugging & Logging Conventions

### Current Practice

- Use `console.error()` for errors with context prefixes: `console.error('[OAuth] Error:', error)`
- Use `console.log()` for success states and debugging OAuth flows
- Prefix logs with component context: `[OAuth]`, `[Storage]` for readability
- Toast notifications via `sonner` library for user-facing feedback

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

### LocalStorage Operations

- All LocalStorage access wrapped in try-catch (see `apps/web-portal/lib/storage.ts`)
- Errors logged but non-fatal - gracefully degrade if unavailable

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

**Status as of January 2026**: Restaurant portal is live with Supabase integration. Mobile app is in development with Mapbox but no backend connection yet. Next priorities:

1. Connect mobile app to Supabase for restaurant/dish data
2. Implement user preferences and swipe interface in mobile
3. Add social features (reviews, favorites)

## Testing Strategy

- **Web Portal**: Manual testing in browser. Verify Supabase integration via SQL Editor queries.
- **Mobile**: Test on physical devices or emulators. Use `__DEV__` checks for dev-only features.
- No automated test suite yet - TDD is aspirational, not current practice.

---

_Last Updated: January 18, 2026_

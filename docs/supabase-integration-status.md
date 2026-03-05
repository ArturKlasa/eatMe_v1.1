# Supabase Integration Status

_Last updated: March 3, 2026_

---

## Overall Status: ✅ Live & Connected

Supabase is fully integrated across the web portal and database. Mobile integration is **in progress**. 40 migrations have been applied.

---

## ✅ Web Portal (Complete)

| Feature                    | Status  | Files                                                    |
| -------------------------- | ------- | -------------------------------------------------------- |
| Supabase client            | ✅ Live | `apps/web-portal/lib/supabase.ts`                        |
| Restaurant onboarding → DB | ✅ Live | `app/onboard/review/page.tsx`                            |
| Auth (email + OAuth)       | ✅ Live | `app/auth/login`, `app/auth/signup`, `app/auth/callback` |
| Owner RLS (own data only)  | ✅ Live | Migrations 005, 008                                      |
| Admin dashboard + RLS      | ✅ Live | `app/admin/*` + migration 008                            |
| Ingredient autocomplete    | ✅ Live | `lib/ingredients.ts`, `IngredientAutocomplete.tsx`       |
| Allergen/dietary auto-calc | ✅ Live | Postgres trigger on `dish_ingredients`                   |
| Menu scan (AI extraction)  | ✅ Live | `app/admin/menu-scan`, migration 034                     |
| Dish categories            | ✅ Live | `app/admin/dish-categories`, migration 025               |
| Currency support           | ✅ Live | Migration 021                                            |

---

## ⏳ Mobile App (In Progress)

| Feature                    | Status     | Notes                                                               |
| -------------------------- | ---------- | ------------------------------------------------------------------- |
| Supabase client setup      | ⏳ Planned | Use `packages/database` or create `apps/mobile/src/lib/supabase.ts` |
| Auth (sign in / sign up)   | ⏳ Planned | Screens exist at `src/screens/auth/`; need Supabase wired up        |
| Nearby restaurants query   | ⏳ Planned | Edge Function `nearby-restaurants` is deployed                      |
| Swipe feed with real data  | ⏳ Planned | `SwipeScreen.tsx` uses mock data today                              |
| Dish opinions (swipe → DB) | ⏳ Planned | Edge Function `swipe` is deployed                                   |
| Eat Together feature       | ⏳ Planned | `EatTogetherScreen.tsx` + sessions tables ready                     |
| User preferences save      | ⏳ Planned | `user_preferences` table ready (migration 022)                      |
| Favorites / history        | ⏳ Planned | `FavoritesScreen.tsx`, `ViewedHistoryScreen.tsx` exist              |

**Mobile Supabase client pattern (when implementing):**

```typescript
// apps/mobile/src/lib/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

---

## ✅ Database (40 Migrations Applied)

### Schema Groups

| Area                | Migrations                | Tables                                                                     |
| ------------------- | ------------------------- | -------------------------------------------------------------------------- |
| Core schema         | 001–004                   | `restaurants`, `menus`, `dishes`                                           |
| Auth & profiles     | 005–006                   | `users`, auth policies                                                     |
| Rating & sessions   | 007                       | `user_sessions`, `session_views`, `dish_opinions`                          |
| Admin & security    | 008                       | `admin_audit_log`, `is_admin()` function                                   |
| Ingredients         | 010–015, 027–031, 035–040 | `ingredients_master`, `ingredient_aliases`, `dish_ingredients`             |
| User swipes         | 012–013                   | `user_swipes`, `user_behavior_profiles`                                    |
| Geospatial          | 015–016                   | PostGIS functions, `ST_DWithin`                                            |
| Eat Together        | 018–019                   | `eat_together_sessions`, `eat_together_participants`, `eat_together_votes` |
| Currency            | 021                       | `restaurants.primary_currency`                                             |
| User preferences    | 022, 024, 032             | `user_preferences`                                                         |
| Dish categories     | 025                       | `dish_categories`                                                          |
| Restaurant location | 026                       | `restaurants.neighbourhood`, `restaurants.state`                           |
| Ratings (live)      | 033                       | Trigger: `dish_opinions` → `restaurants.rating`                            |
| Menu scan           | 034                       | `menu_scan_jobs`                                                           |
| Ingredient aliases  | 035–040                   | English, Spanish, Latin American, Polish aliases                           |

---

## ✅ Edge Functions (Deployed)

| Function              | Path                               | Status      |
| --------------------- | ---------------------------------- | ----------- |
| Nearby restaurants    | `functions/nearby-restaurants/`    | ✅ Deployed |
| Feed                  | `functions/feed/`                  | ✅ Deployed |
| Swipe recording       | `functions/swipe/`                 | ✅ Deployed |
| Group recommendations | `functions/group-recommendations/` | ✅ Deployed |

---

## Data Flow Reference

```
Restaurant Owner (Web Portal)
  → fills onboarding form
  → auto-saves to LocalStorage
  → submits on /onboard/review
  → Supabase INSERT: restaurants, menus, dishes (with ingredient_ids)
  → DB triggers: calculate allergens + dietary_tags on dishes
  → LocalStorage cleared
  → redirected to dashboard

Consumer (Mobile — target state)
  → opens app, grants location
  → Edge Function: nearby-restaurants (PostGIS ST_DWithin)
  → SwipeScreen shows 20 pre-filtered dishes
  → User swipes right/left/super
  → Edge Function: swipe records opinion in dish_opinions
  → Trigger updates restaurants.rating
  → Preferences learned, feed improves over time
```

---

## Environment Variables

### Web Portal (`apps/web-portal/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Mobile (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

⚠️ Never commit `.env.local` or `.env` — both are in `.gitignore`.

---

## Security Notes

- All tables have **RLS enabled** (default deny-all)
- `owner_id` FK on `restaurants`, `menus`, `dishes` — owners can only CRUD their own data
- Admin role stored in `auth.users.raw_user_meta_data->>'role'` — cannot be self-assigned
- Service role used only in Edge Functions and server-side operations
- Audit log (`admin_audit_log`) is append-only — no UPDATE/DELETE policies

---

<!-- Legacy content below retained for historical reference only. Everything above is the current state. -->

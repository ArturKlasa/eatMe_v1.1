# SHARED-02 — Database Schema & Migrations

## Overview

EatMe uses **Supabase (PostgreSQL + PostGIS)** as its database. All schema changes are made through numbered SQL migration files. Row-Level Security (RLS) is enabled on every table to enforce data ownership.

---

## Migration Files Location

```
infra/supabase/migrations/
```

Migrations are plain `.sql` files. They must be applied sequentially. The Supabase CLI applies them in alphabetical order.

---

## ⚠️ Duplicate Migration Numbers

The migration history has a significant issue: **multiple migration files share the same number prefix**. This happened when the schema evolved in parallel tracks.

| Duplicate # | Files                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| 006         | `006_add_dish_photos.sql`, `006_create_user_profiles.sql`                        |
| 007         | `007_add_rating_system.sql`, `007_change_location_to_jsonb.sql`                  |
| 008         | `008_add_admin_role_with_security.sql`, `008_create_storage_bucket.sql`          |
| 009         | `009_add_dietary_columns.sql`, `009_add_refresh_materialized_views_function.sql` |
| 011         | `011_link_dishes_to_ingredients.sql`, `011_remove_ingredients_columns.sql`       |
| 012         | `012_create_canonical_ingredient_system.sql`, `012_user_swipe_tracking.sql`      |
| 013         | `013_add_comprehensive_ingredients.sql`, `013_user_behavior_profiles.sql`        |
| 014         | `014_dish_analytics.sql`, `014_fix_canonical_ingredients_mapping.sql`            |

The Supabase CLI will apply these in filename order within each number group. Both files in each pair will run, but the order between pairs may not be what was intended. **Before adding any new migrations, the numbering must be audited and corrected.** See improvement item DX2 in `CODEBASE_IMPROVEMENTS.md`.

---

## Core Tables

### `restaurants`

| Column             | Type                   | Notes                                      |
| ------------------ | ---------------------- | ------------------------------------------ |
| `id`               | UUID PK                |                                            |
| `owner_id`         | UUID FK → `auth.users` | RLS policy owner                           |
| `name`             | TEXT                   |                                            |
| `location`         | JSONB                  | `{ lat, lng }` — see Location Format below |
| `address`          | TEXT                   |                                            |
| `cuisine_types`    | TEXT[]                 |                                            |
| `open_hours`       | JSONB                  | Map of day → `{ open, close }`             |
| `restaurant_type`  | TEXT                   | café, restaurant, food_truck, etc.         |
| `is_active`        | BOOLEAN                | Admin-controlled                           |
| `status`           | TEXT                   | active, suspended, pending                 |
| `rating`           | NUMERIC                | Aggregated via trigger / view              |
| `primary_currency` | TEXT                   | ISO 4217 code                              |

### `menus`

Meal periods within a restaurant (Breakfast, Lunch, Dinner, etc.).

| Column          | Type                    | Notes            |
| --------------- | ----------------------- | ---------------- |
| `id`            | UUID PK                 |                  |
| `restaurant_id` | UUID FK → `restaurants` | CASCADE DELETE   |
| `name`          | TEXT                    |                  |
| `menu_type`     | `'food' \| 'drink'`     |                  |
| `is_active`     | BOOLEAN                 |                  |
| `display_order` | INT                     | Sort order in UI |

### `menu_categories`

Sections within a menu (Starters, Mains, Desserts, etc.).

| Column          | Type              | Notes                       |
| --------------- | ----------------- | --------------------------- |
| `id`            | UUID PK           |                             |
| `menu_id`       | UUID FK → `menus` | CASCADE DELETE              |
| `restaurant_id` | UUID FK           | Denormalised for easier RLS |
| `name`          | TEXT              |                             |
| `display_order` | INT               |                             |

### `dishes`

Individual food items.

| Column                   | Type                        | Notes                              |
| ------------------------ | --------------------------- | ---------------------------------- |
| `id`                     | UUID PK                     |                                    |
| `restaurant_id`          | UUID FK                     |                                    |
| `menu_category_id`       | UUID FK → `menu_categories` |                                    |
| `dish_category_id`       | UUID FK → `dish_categories` | Canonical type: Pizza, Pasta, etc. |
| `name`                   | TEXT                        |                                    |
| `price`                  | NUMERIC                     |                                    |
| `allergens`              | JSONB                       | Auto-calculated by trigger         |
| `dietary_tags`           | JSONB                       | Auto-calculated by trigger         |
| `is_available`           | BOOLEAN                     |                                    |
| `description_visibility` | TEXT                        | `'menu' \| 'detail'`               |
| `ingredients_visibility` | TEXT                        | `'menu' \| 'detail' \| 'none'`     |

### `canonical_ingredients` / `ingredient_aliases` / `dish_ingredients`

See [SHARED-01-ingredient-allergen-system.md](SHARED-01-ingredient-allergen-system.md) for full detail.

### `user_profiles`

Created automatically by `handle_new_user` trigger on `auth.users` insert.

| Column                | Type                                      |
| --------------------- | ----------------------------------------- |
| `id`                  | UUID PK (= `auth.users.id`)               |
| `profile_name`        | TEXT                                      |
| `avatar_url`          | TEXT                                      |
| `role`                | TEXT (`'owner' \| 'admin' \| 'consumer'`) |
| `is_profile_complete` | BOOLEAN                                   |

### `user_preferences`

Dietary and preference settings for mobile consumers.

| Column              | Type    |
| ------------------- | ------- |
| `user_id`           | UUID PK |
| `diet_type`         | TEXT    |
| `allergies`         | TEXT[]  |
| `favorite_cuisines` | TEXT[]  |
| `spice_tolerance`   | BOOLEAN |
| `currency`          | TEXT    |

### `user_swipes`

Records every swipe action on the swipe screen.

| Column             | Type                           |
| ------------------ | ------------------------------ |
| `user_id`          | UUID FK                        |
| `dish_id`          | UUID FK                        |
| `action`           | `'left' \| 'right' \| 'super'` |
| `session_id`       | TEXT                           |
| `view_duration_ms` | INT                            |

### `favorites`

User-saved restaurants and dishes.

| Column         | Type                     |
| -------------- | ------------------------ |
| `user_id`      | UUID FK                  |
| `subject_type` | `'restaurant' \| 'dish'` |
| `subject_id`   | UUID                     |

### `eat_together_sessions` / `eat_together_members` / `eat_together_recommendations` / `eat_together_votes`

See [MOB-08-eat-together.md](MOB-08-eat-together.md) for full detail.

---

## Location Format

> **Important**: The location field on `restaurants` uses **JSONB**, not PostGIS POINT.

```json
{ "lat": 40.7128, "lng": -74.006 }
```

The helper `formatLocationForSupabase(lat, lng, 'json')` in `apps/web-portal/lib/supabase.ts` produces this format. If PostGIS queries are needed (e.g., geospatial radius search), the Supabase RPC functions convert this JSONB to a geometry on the fly.

> Note: Early comments in the codebase mention `POINT(lng lat)` — this refers to the PostGIS POINT format used internally in RPC functions, not the column storage format.

---

## Row-Level Security (RLS)

**All tables have RLS enabled.** The default policy is deny-all. Every table that stores user data has a policy that restricts access to the row's `owner_id` or `user_id`.

### Common RLS pattern

```sql
-- Users can only see/modify their own data
CREATE POLICY "users_own_data" ON restaurants
  FOR ALL USING (auth.uid() = owner_id);

-- Service role bypasses RLS (used by admin Edge Functions)
-- Achieved by using the service role key, not a special policy
```

### Admin access

Admin users (role = 'admin' in user_metadata) have special policies on tables like `restaurants` that allow SELECT on all rows. This is what powers the admin dashboard.

---

## Adding a New Migration

1. Determine the next sequential number (currently 040 is the last — use `041_...`)
2. Name the file: `041_short_descriptive_name.sql`
3. Use conditional DDL to make migrations idempotent:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'my_table' AND column_name = 'new_column'
  ) THEN
    ALTER TABLE my_table ADD COLUMN new_column TEXT;
  END IF;
END $$;
```

4. Always enable RLS on new tables:

```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON new_table FOR ALL USING (auth.uid() = user_id);
```

5. Test the migration in Supabase Dashboard SQL Editor before committing.

---

## Supabase Edge Functions

Located in `infra/supabase/functions/`. Each subdirectory is a separate Edge Function deployed to Supabase's Deno runtime.

| Function      | Purpose                                                 |
| ------------- | ------------------------------------------------------- |
| `get-feed`    | Returns personalised dish feed for the swipe screen     |
| `track-swipe` | Records a swipe event                                   |
| _(others)_    | See `docs/EDGE_FUNCTIONS_ARCHITECTURE.md` for full list |

Edge Functions are called via `SUPABASE_URL/functions/v1/{function-name}` with the anon key for public functions, or the service role key for admin operations.

---

## Supabase RPC Functions

Several operations use `supabase.rpc()` to call Postgres functions directly:

| RPC                          | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| `generate_session_code`      | Generates unique 6-char code for Eat Together sessions |
| Geospatial nearby search     | Returns restaurants within radius of a coordinate      |
| `refresh_materialized_views` | Refreshes rating aggregation views (migration `009`)   |

---

## Shared Database Package

`packages/database/` contains a shared Supabase client intended for use by both the web portal and mobile app. It exports `supabase`, type definitions, and config helpers. **Neither app currently imports from it** — both maintain their own clients. See improvement item A1/D1 in `CODEBASE_IMPROVEMENTS.md`.

---

## Generating TypeScript Types from Schema

Run the following to regenerate types from the live Supabase schema:

```bash
npx supabase gen types typescript \
  --project-id <your-project-id> \
  > packages/database/src/types.ts
```

This should be done after every migration to keep TypeScript types in sync with the database.

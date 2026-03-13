# EatMe — Migration Log

All migrations live in `infra/supabase/migrations/` and are applied in the order listed below.
Migrations 006–017 used an `a`/`b` suffix convention for two parallel feature tracks; they are
applied alphabetically (e.g. `006a` before `006b`).

**Next migration number: `042`**

---

## Applied Migrations

| File                                               | Description                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `001_initial_schema.sql`                           | Initial schema: `restaurants`, `menus`, `dishes`, `users` core tables      |
| `002_restaurant_portal_schema.sql`                 | Restaurant portal additions: partner portal columns                        |
| `003_restaurant_portal_safe.sql`                   | Safe idempotent re-run of portal schema changes                            |
| `004_complete_portal_schema.sql`                   | Complete portal schema: menus, categories, RLS policies                    |
| `005_add_authentication.sql`                       | Auth triggers: `handle_new_user` populates `users` on sign-up              |
| `006a_create_user_profiles.sql`                    | User profiles table and related RLS                                        |
| `006b_add_dish_photos.sql`                         | `dish_photos` table for user-uploaded dish images                          |
| `007a_change_location_to_jsonb.sql`                | Migrates restaurant location column from text to JSONB                     |
| `007b_add_rating_system.sql`                       | `dish_opinions`, `user_visits`, rating aggregation tables                  |
| `008a_add_admin_role_with_security.sql`            | Admin role, `admin_audit_log`, RLS policies for admin routes               |
| `008b_create_storage_bucket.sql`                   | Supabase Storage bucket for dish photos                                    |
| `009a_add_dietary_columns.sql`                     | `dietary_tags` and `allergens` columns on `dishes`                         |
| `009b_add_refresh_materialized_views_function.sql` | Helper function to refresh materialized views                              |
| `010_create_ingredients_master_tables.sql`         | `ingredients_master`, `allergens`, `dietary_tags` reference tables         |
| `011a_link_dishes_to_ingredients.sql`              | `dish_ingredients` join table linking dishes to master ingredients         |
| `011b_remove_ingredients_columns.sql`              | Removes legacy free-text `ingredients` array from `dishes`                 |
| `012a_create_canonical_ingredient_system.sql`      | `canonical_ingredients` and alias system for ingredient normalisation      |
| `012b_user_swipe_tracking.sql`                     | `user_swipes` table for swipe-based preference learning                    |
| `013a_add_comprehensive_ingredients.sql`           | Seeds `ingredients_master` with a comprehensive ingredient list            |
| `013b_user_behavior_profiles.sql`                  | `user_behavior_profiles` for ML-ready preference aggregation               |
| `014a_dish_analytics.sql`                          | `dish_analytics` table for per-dish view/interaction counts                |
| `014b_fix_canonical_ingredients_mapping.sql`       | Fixes FK mapping between `dish_ingredients` and `canonical_ingredients`    |
| `015a_geospatial_functions.sql`                    | PostGIS `nearby_restaurants` Edge Function support                         |
| `015b_add_comprehensive_ingredient_aliases.sql`    | Seeds ingredient aliases (EN synonyms)                                     |
| `016a_fix_geospatial_functions.sql`                | Corrects `POINT(lng lat)` order and index on restaurants                   |
| `016b_restructure_menu_system.sql`                 | Adds `menu_categories` table; dishes now FK to category not menu           |
| `017a_multi_role_and_preferences.sql`              | Multi-role support; `user_preferences` for onboarding data                 |
| `017b_add_display_order_to_dishes.sql`             | `display_order` column on `dishes`                                         |
| `018_eat_together_feature.sql`                     | `eat_together_sessions`, `_members`, `_votes`, `_recommendations`          |
| `019_fix_eat_together_rls_recursion.sql`           | Fixes RLS infinite-recursion bug in `eat_together_members`                 |
| `020_fix_handle_new_user_trigger.sql`              | Robust `handle_new_user` trigger (handles missing metadata)                |
| `021_add_currency_support.sql`                     | `currency` column on `user_preferences`                                    |
| `022_add_user_preferences.sql`                     | Extended user preference columns (dietary, protein, allergies)             |
| `023_fix_profile_completion_function.sql`          | Fixes `calculate_profile_completion` Postgres function                     |
| `024_fix_array_length_for_user_preferences.sql`    | Corrects array-length constraint on preference columns                     |
| `025_add_dish_categories_and_menu_type.sql`        | `dish_categories` table; `menu_type` column on `menus`                     |
| `026_add_neighbourhood_state_to_restaurants.sql`   | `neighbourhood` and `state` columns on `restaurants`                       |
| `027_fix_missing_ingredient_aliases.sql`           | Patches gaps in the ingredient alias seed data                             |
| `028_add_extended_ingredients.sql`                 | Adds 200+ additional ingredients to `ingredients_master`                   |
| `029_add_ingredient_family_name.sql`               | `family_name` column on `canonical_ingredients`                            |
| `030_add_dish_visibility_settings.sql`             | `description_visibility` and `ingredients_visibility` on `dishes`          |
| `031_fix_dish_ingredients_fk.sql`                  | Fixes FK from `dish_ingredients` to use `canonical_ingredients.id`         |
| `032_clean_user_preferences.sql`                   | Removes deprecated columns from `user_preferences`                         |
| `033_live_restaurant_rating.sql`                   | `restaurant_ratings_summary` view + trigger to update `restaurants.rating` |
| `034_add_menu_scan_jobs.sql`                       | `menu_scan_jobs` table for async AI menu-scan job tracking                 |
| `035_add_language_to_ingredient_aliases.sql`       | `language` column on `ingredient_aliases`                                  |
| `036_add_spanish_ingredient_aliases.sql`           | Seeds Spanish (ES) ingredient aliases                                      |
| `037_add_latin_american_canonical_ingredients.sql` | Adds Latin American canonical ingredients                                  |
| `038_add_latin_american_aliases.sql`               | Seeds Latin American ingredient aliases (ES)                               |
| `039_add_polish_canonical_ingredients.sql`         | Adds Polish canonical ingredients                                          |
| `040_add_polish_aliases.sql`                       | Seeds Polish ingredient aliases (PL)                                       |
| `041_ensure_rls_enabled.sql`                       | Security audit: idempotent `ENABLE ROW LEVEL SECURITY` on all tables       |
| `045_remove_icon_from_allergens_and_dietary_tags.sql` | Drops `icon` column from `allergens` and `dietary_tags`; icons moved to client-side constants |

---

## How to Add a Migration

1. Name it `NNN_descriptive_name.sql` where `NNN` is the next number (`042`, `043`, …).
2. For two migrations at the same logical step, use `NNNa_` and `NNNb_` suffixes.
3. Write idempotent SQL (`IF NOT EXISTS`, `DO $$ BEGIN … END $$`, etc.) where possible.
4. Add a row to the table above.
5. Test in the Supabase Dashboard SQL Editor before committing.
6. After applying, run `pnpm --filter @eatme/database gen:types` to regenerate TypeScript types and update the "Last generated" date in `packages/database/src/types.ts`.

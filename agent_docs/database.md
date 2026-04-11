# Database

## Overview

EatMe uses Supabase (PostgreSQL 15) with PostGIS for geospatial queries and pgvector for embedding similarity search. The authoritative schema is `infra/supabase/migrations/database_schema.sql`.

## Key Tables

- **restaurants** — Restaurant profiles with location (PostGIS POINT), operating hours, cuisine types
- **menus** — Menu containers belonging to restaurants (one active menu per restaurant)
- **dishes** — Individual dishes with allergens, dietary tags, price, description, embeddings
- **ingredients_master** — Master ingredient list with allergen/dietary metadata
- **dish_ingredients** — Junction table linking dishes to ingredients
- **dish_opinions** — User ratings/opinions on dishes (liked/okay/disliked + tags)
- **visits** — User visit records for restaurants
- **profiles** — User profiles extending Supabase auth

## Row-Level Security (RLS)

Every table has RLS enabled. Default policy is deny-all. Patterns:
- **Owner tables** (restaurants, menus, dishes): `owner_id = auth.uid()` for write operations
- **Public read**: restaurants/dishes are readable by all authenticated users
- **User-specific**: opinions and visits filtered by `user_id = auth.uid()`

When creating new tables, always enable RLS and add appropriate policies.

## PostGIS

Location stored as `geography(POINT, 4326)`. Format: `POINT(longitude latitude)` — note the order. Proximity queries use `ST_DWithin` with distance in meters.

## Migrations

Migration files in `infra/supabase/migrations/` with timestamp prefixes. Use `supabase migration new <name>` to create new migrations.

## Ingredient System

Postgres triggers auto-calculate `dishes.allergens` and `dishes.dietary_tags` when dish ingredients change. The trigger fires on insert/update to `dish_ingredients`.

See `docs/project/06-database-schema.md` for the complete schema documentation.

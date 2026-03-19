# First Principles Review — Restaurant / Menu / Dish / Ingredients & Filters / Recommendations

**Created:** March 18, 2026  
**Status:** Draft — open for discussion  
**Purpose:** Audit the current data model and discovery pipeline from first principles before committing to further investment in the existing structure.

---

## How to Use This Document

This document takes a **First Principles** approach — that means we do NOT start from "how can we improve what we have". We start by asking: _"What problem are we actually solving, and what is the minimum structure needed to solve it cleanly?"_

The goal is to be honest about the current design — what works well, what evolved organically and may now be suboptimal, and where rebuilding would yield a better long-term foundation. The current implementation may well be right (or close to it), and reuse of working parts is desirable — but only when justified from first principles, not just because it already exists.

---

## Part 1 — Current Restaurant Structure

### 1.1 What Is a Restaurant?

The `restaurants` table is the root entity of the entire supply side. Every menu, dish, and piece of content is owned by a restaurant.

**Table: `restaurants`**

| Column                 | Type                      | Notes                                                                           |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `id`                   | UUID PK                   |                                                                                 |
| `owner_id`             | UUID FK → `auth.users`    | RLS owner — only the restaurant partner can write their own rows                |
| `name`                 | TEXT NOT NULL             |                                                                                 |
| `restaurant_type`      | TEXT                      | `cafe`, `restaurant`, `fine_dining`, `food_truck`, etc.                         |
| `description`          | TEXT                      |                                                                                 |
| `address`              | TEXT NOT NULL             |                                                                                 |
| `country_code`         | TEXT                      | ISO 2-letter code (`US`, `MX`, `PL`, etc.)                                      |
| `city`                 | TEXT                      |                                                                                 |
| `neighbourhood`        | TEXT                      | Added in migration 026                                                          |
| `state`                | TEXT                      | Added in migration 026                                                          |
| `postal_code`          | TEXT                      |                                                                                 |
| `phone`                | TEXT                      |                                                                                 |
| `website`              | TEXT                      |                                                                                 |
| `cuisine_types`        | TEXT[] (array)            | Multi-value — e.g. `["Italian", "Pizza"]`                                       |
| `open_hours`           | JSONB                     | Map of day → `{ open, close, closed }` objects                                  |
| `delivery_available`   | BOOLEAN DEFAULT true      |                                                                                 |
| `takeout_available`    | BOOLEAN DEFAULT true      |                                                                                 |
| `dine_in_available`    | BOOLEAN DEFAULT true      |                                                                                 |
| `accepts_reservations` | BOOLEAN DEFAULT false     |                                                                                 |
| `service_speed`        | TEXT CHECK                | `fast-food` or `regular`                                                        |
| `payment_methods`      | TEXT CHECK                | `cash_only`, `card_only`, `cash_and_card` — added in migration 044              |
| `rating`               | NUMERIC(3,2) DEFAULT 0.00 | Auto-updated by a trigger from `dish_opinions`                                  |
| `image_url`            | TEXT                      |                                                                                 |
| `is_active`            | BOOLEAN DEFAULT true      |                                                                                 |
| `suspended_at`         | TIMESTAMPTZ               | Admin soft-ban timestamp                                                        |
| `suspended_by`         | UUID FK → `auth.users`    |                                                                                 |
| `suspension_reason`    | TEXT                      |                                                                                 |
| `location`             | JSONB NOT NULL            | `{ "lat": number, "lng": number }` — stored as JSONB, not PostGIS               |
| `location_point`       | geography (computed)      | PostGIS `POINT(lng lat)` derived from `location` JSONB — for geospatial queries |
| `created_at`           | TIMESTAMPTZ DEFAULT now() |                                                                                 |
| `updated_at`           | TIMESTAMPTZ DEFAULT now() |                                                                                 |

**Why this approach was taken:**

- The **dual location format** (JSONB `location` + computed `location_point`) arose from a migration history issue: early versions stored location as raw JSONB (migration 007a changed it from a PostGIS column to JSONB). Later, a computed geography column was added back so that PostGIS functions like `ST_DWithin` could be used for radius queries without re-migrating the data format. This avoids a breaking change but introduces redundancy.
- `cuisine_types` as a TEXT[] array was chosen for flexibility — a restaurant can serve multiple cuisines without a join table. This trades normalisation for simplicity at a scale where cuisines per restaurant are small (2–5).
- `open_hours` as JSONB was chosen because the structure (day of week → open/close times + optional closed flag) does not benefit from a separate table at the current scale, and JSONB makes the web portal UI easy to read/write.
- `rating` is a denormalised aggregate, updated by a Postgres trigger whenever a `dish_opinion` is inserted/updated/deleted. This avoids a GROUP BY query on every restaurant read.

---

## Part 2 — Current Menu Structure

### 2.1 Menus

Menus are top-level groupings of dishes within a restaurant (e.g. "Breakfast Menu", "Drinks", "Dinner"). They have an availability time window so a restaurant can show different menus at different times of day.

**Table: `menus`**

| Column                 | Type                    | Notes                                          |
| ---------------------- | ----------------------- | ---------------------------------------------- |
| `id`                   | UUID PK                 |                                                |
| `restaurant_id`        | UUID FK → `restaurants` | CASCADE DELETE                                 |
| `name`                 | TEXT NOT NULL           |                                                |
| `description`          | TEXT                    |                                                |
| `display_order`        | INTEGER DEFAULT 0       | Controls sort order on the partner portal      |
| `is_active`            | BOOLEAN DEFAULT true    |                                                |
| `available_start_time` | TIME                    | Optional time-of-day availability window start |
| `available_end_time`   | TIME                    | Optional time-of-day availability window end   |
| `available_days`       | TEXT[]                  | Days of week this menu is active               |
| `menu_type`            | TEXT CHECK              | `food` or `drink` — added in migration 025     |
| `created_at`           | TIMESTAMPTZ             |                                                |
| `updated_at`           | TIMESTAMPTZ             |                                                |

### 2.2 Menu Categories

Menu categories are sub-groupings within a menu (e.g. "Starters", "Main Course", "Desserts"). The menu → category → dish hierarchy was introduced in migration 016b to give restaurant partners more control over dish organisation.

**Table: `menu_categories`**

| Column          | Type                    | Notes                                                         |
| --------------- | ----------------------- | ------------------------------------------------------------- |
| `id`            | UUID PK                 |                                                               |
| `menu_id`       | UUID FK → `menus`       | Added in 016b — was previously loose                          |
| `restaurant_id` | UUID FK → `restaurants` | Retained for direct ownership lookups                         |
| `name`          | TEXT NOT NULL           |                                                               |
| `description`   | TEXT                    |                                                               |
| `type`          | TEXT                    | Legacy field — partially superseded by `menu_type` on `menus` |
| `display_order` | INTEGER DEFAULT 0       |                                                               |
| `is_active`     | BOOLEAN DEFAULT true    |                                                               |
| `created_at`    | TIMESTAMPTZ             |                                                               |
| `updated_at`    | TIMESTAMPTZ             |                                                               |

**Why this approach was taken:**

- The three-level `menu → menu_category → dish` hierarchy was introduced because real restaurant menus have this structure (a "Dinner" menu has "Starters", "Mains", and "Desserts" sections). Before 016b, dishes linked directly to menus with no category subdivision.
- `menu_type: food | drink` was added (025) to let the UI render separate food and drink sections without relying on naming conventions.
- The `available_start_time / available_end_time / available_days` fields exist so that a "Happy Hour" menu or "Breakfast" menu can be shown only at relevant times. These are **not currently enforced by any trigger or the app** — they are stored for future use.

---

## Part 3 — Current Dish Structure

**Table: `dishes`**

| Column                   | Type                        | Notes                                                                                       |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------- |
| `id`                     | UUID PK                     |                                                                                             |
| `restaurant_id`          | UUID FK → `restaurants`     | CASCADE DELETE                                                                              |
| `menu_category_id`       | UUID FK → `menu_categories` | Nullable — dish can be "orphaned" from a category                                           |
| `dish_category_id`       | UUID FK → `dish_categories` | Global category (Burger, Salad, Pasta, etc.) — ON DELETE SET NULL                           |
| `name`                   | TEXT NOT NULL               |                                                                                             |
| `description`            | TEXT                        |                                                                                             |
| `price`                  | NUMERIC NOT NULL DEFAULT 0  |                                                                                             |
| `dietary_tags`           | TEXT[] DEFAULT `{}`         | Auto-populated by trigger from `dish_ingredients`                                           |
| `allergens`              | TEXT[] DEFAULT `{}`         | Auto-populated by trigger from `dish_ingredients`                                           |
| `ingredients`            | TEXT[] DEFAULT `{}`         | Legacy free-text ingredient list — superseded by `dish_ingredients` join table              |
| `calories`               | INTEGER                     |                                                                                             |
| `spice_level`            | SMALLINT CHECK 0–4          | `0` = none, `1` = mild, `3` = hot — note: only values 0, 1, and 3 are used (migration 041b) |
| `image_url`              | TEXT                        |                                                                                             |
| `is_available`           | BOOLEAN DEFAULT true        |                                                                                             |
| `description_visibility` | TEXT CHECK                  | `menu` (shown in list) or `detail` (shown only on dish detail page)                         |
| `ingredients_visibility` | TEXT CHECK                  | `menu`, `detail`, or `none` — controls where ingredient list is shown                       |
| `created_at`             | TIMESTAMPTZ                 |                                                                                             |
| `updated_at`             | TIMESTAMPTZ                 |                                                                                             |

### 3.1 Dish Categories

A global taxonomy of dish types — independent of any restaurant's own menu structure.

**Table: `dish_categories`**

| Column               | Type                       | Notes                                       |
| -------------------- | -------------------------- | ------------------------------------------- |
| `id`                 | UUID PK                    |                                             |
| `name`               | TEXT NOT NULL UNIQUE       | e.g. "Burger", "Salad", "Sushi", "Cocktail" |
| `parent_category_id` | UUID FK (self-referential) | Supports a two-level category tree          |
| `is_drink`           | BOOLEAN DEFAULT false      | Separates food from beverage categories     |
| `is_active`          | BOOLEAN DEFAULT true       |                                             |
| `created_at`         | TIMESTAMPTZ                |                                             |
| `updated_at`         | TIMESTAMPTZ                |                                             |

**Why this approach was taken:**

- `allergens` and `dietary_tags` on `dishes` are **denormalised computed fields** — they are never set by application code; a Postgres trigger recalculates them any time `dish_ingredients` changes. This means the mobile app reads pre-computed values from a single row rather than joining across five tables at query time. The trade-off is: these columns can fall out of sync if ingredients are modified in the DB directly without triggering the trigger.
- The legacy `ingredients` TEXT[] column was kept (migration 011b removed a previous `ingredients_raw` but this column remains) alongside the normalized `dish_ingredients` join table. This is a known dual-representation issue.
- `spice_level` as a SMALLINT with only 0/1/3 valid values is an artefact of migration 041b, which consolidated a wider range to three named levels. The constraint is `0 <= spice_level <= 4` in the DB, but only 0, 1, and 3 are intended.
- `description_visibility` and `ingredients_visibility` were added (migration 030) to give restaurant partners control over what the mobile app shows in list vs detail views, enabling menus where the description is a "surprise" until the user taps in.

---

## Part 4 — Current Ingredient & Allergen System

The ingredient system is the most architecturally complex part of the data model, having evolved through at least six major migrations (010–015, 027–040).

### 4.1 Two Parallel Ingredient Tables

There are currently **two separate ingredient storage systems** that exist side-by-side:

| System                  | Tables                                                                                                               | Purpose                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Legacy master table** | `ingredients_master`, `ingredient_allergens`, `ingredient_dietary_tags`                                              | Original ingredient catalogue from migration 010                       |
| **Canonical system**    | `canonical_ingredients`, `canonical_ingredient_allergens`, `canonical_ingredient_dietary_tags`, `ingredient_aliases` | Redesigned system from migration 012a, with multilingual alias support |

The `ingredient_aliases` table points to `canonical_ingredients`, not `ingredients_master`. The `dish_ingredients` join table also points to `canonical_ingredients`. This means **`ingredients_master` is legacy and no longer used in active workflows** — the canonical system is the live one.

### 4.2 Canonical Ingredients

**Table: `canonical_ingredients`**

| Column                   | Type                   | Notes                                                                           |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------- |
| `id`                     | UUID PK                |                                                                                 |
| `canonical_name`         | TEXT UNIQUE NOT NULL   | The "true" name, e.g. `"whole milk"`, `"wheat flour"`                           |
| `ingredient_family_name` | TEXT DEFAULT `'other'` | Grouping family, e.g. `"dairy"`, `"grain"`, `"vegetable"` — added migration 029 |
| `is_vegetarian`          | BOOLEAN DEFAULT true   |                                                                                 |
| `is_vegan`               | BOOLEAN DEFAULT false  |                                                                                 |
| `created_at`             | TIMESTAMPTZ            |                                                                                 |
| `updated_at`             | TIMESTAMPTZ            |                                                                                 |

### 4.3 Ingredient Aliases

**Table: `ingredient_aliases`**

| Column                    | Type                              | Notes                                                                                |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                      | UUID PK                           |                                                                                      |
| `canonical_ingredient_id` | UUID FK → `canonical_ingredients` |                                                                                      |
| `display_name`            | TEXT UNIQUE NOT NULL              | What users see and search by                                                         |
| `language`                | TEXT DEFAULT `'en'`               | ISO language code (`en`, `es`, `pl`)                                                 |
| `search_vector`           | TSVECTOR                          | Full-text search vector (not yet used in production queries — ILIKE is used instead) |
| `created_at`              | TIMESTAMPTZ                       |                                                                                      |
| `updated_at`              | TIMESTAMPTZ                       |                                                                                      |

Supported languages so far: English (en), Spanish (es), Polish (pl), Latin American Spanish — via migrations 035–040. Multiple aliases per canonical ingredient per language are supported.

### 4.4 Allergens & Dietary Tags

**Table: `allergens`**

| Column        | Type        | Notes                                                   |
| ------------- | ----------- | ------------------------------------------------------- |
| `id`          | UUID PK     |                                                         |
| `code`        | TEXT UNIQUE | e.g. `MILK`, `GLUTEN`, `NUTS`, `EGGS`, `SHELLFISH`      |
| `name`        | TEXT        | Human-readable e.g. "Milk", "Gluten-containing cereals" |
| `severity`    | TEXT CHECK  | `major` or `minor`                                      |
| `description` | TEXT        |                                                         |

**Table: `dietary_tags`**

| Column        | Type        | Notes                                         |
| ------------- | ----------- | --------------------------------------------- |
| `id`          | UUID PK     |                                               |
| `code`        | TEXT UNIQUE | e.g. `VEGETARIAN`, `VEGAN`, `HALAL`, `KOSHER` |
| `name`        | TEXT        | e.g. "Vegetarian", "Vegan"                    |
| `category`    | TEXT CHECK  | `diet`, `religious`, `lifestyle`, or `health` |
| `description` | TEXT        |                                               |

### 4.5 Junction Tables

**`canonical_ingredient_allergens`** — maps a canonical ingredient to the allergens it contains.  
**`canonical_ingredient_dietary_tags`** — maps a canonical ingredient to dietary classifications.  
**`dish_ingredients`** — links a dish to its canonical ingredients with optional quantity.

```
dish_ingredients
  dish_id                UUID FK → dishes.id
  ingredient_id          UUID FK → canonical_ingredients.id
  quantity               TEXT (optional, e.g. "100g", "2 tbsp")
  created_at             TIMESTAMPTZ
```

### 4.6 Allergen Auto-Calculation (Postgres Trigger)

When a row is inserted into `dish_ingredients`, a Postgres trigger fires:

```
INSERT INTO dish_ingredients (dish_id, ingredient_id)
  → TRIGGER: update_dish_allergens_and_tags()
    → SELECT all allergens linked to all canonical_ingredients for this dish
    → SELECT dietary tags, check is_vegetarian / is_vegan for all ingredients
    → UPDATE dishes SET
        allergens    = [...allergen codes...]   -- TEXT[] on the dishes row
        dietary_tags = [...tag codes...]        -- TEXT[] on the dishes row
      WHERE id = NEW.dish_id
```

The trigger also fires on `DELETE` from `dish_ingredients` (to recalculate when an ingredient is removed). This ensures `dishes.allergens` and `dishes.dietary_tags` are always accurate — the mobile app reads them as flat arrays with no join needed.

### 4.7 Ingredient Search (Web Portal)

`searchIngredients(query, limit)` in `apps/web-portal/lib/ingredients.ts`:

1. Queries `ingredient_aliases` with `ILIKE '%query%'` on `display_name`.
2. Joins to `canonical_ingredients` for `is_vegetarian`, `is_vegan`, `ingredient_family_name`.
3. Returns a flat `Ingredient[]` array used by `IngredientAutocomplete.tsx`.

> **Known gap:** The `search_vector` (tsvector) column on `ingredient_aliases` exists but is not used. All searching uses ILIKE, which degrades as the ingredient library grows.

**Why this approach was taken:**

- The canonical system (012a) was designed to solve the problem that early restaurant partners entered the same ingredient in different ways ("milk", "leche", "whole milk") — creating duplicate allergen entries. By normalising to a canonical name and mapping display names as aliases, the allergen calculation becomes deterministic.
- The multilingual alias approach (035–040) was added to support markets beyond English-speaking ones (Mexico, Poland), where restaurant partners enter ingredients in their native language.
- Allergen calculation by trigger (rather than application code) was chosen to ensure consistency — the DB is the single source of truth, and no application can accidentally skip the calculation.

---

## Part 5 — Current Filter System

### 5.1 Architecture Overview

The filter system has two tiers that serve different purposes:

| Tier                  | Scope        | Storage                                                        | Purpose                                                                                                                                         |
| --------------------- | ------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Daily filters**     | Session only | Zustand (in-memory)                                            | Quick mood-based choices for the current discovery session (always soft)                                                                        |
| **Permanent filters** | Profile      | Supabase `user_preferences` table + synced to Zustand on login | Persistent preferences — includes both hard constraints (allergies, diet, religious) and soft preferences (favourite cuisines, spice tolerance) |

Both tiers live in a single Zustand store: `apps/mobile/src/stores/filterStore.ts` (~1095 lines).

### 5.2 Daily Filter Fields

Managed in `filterStore` as transient in-memory state. Reset on demand via `filterStore.resetDailyFilters()`.

| Field            | Type                                         | Default                |
| ---------------- | -------------------------------------------- | ---------------------- |
| `priceRange`     | `{ min: number, max: number }`               | `{ min: 0, max: 100 }` |
| `cuisineTypes`   | `string[]`                                   | `[]` (all cuisines)    |
| `dietPreference` | `'all' \| 'vegetarian' \| 'vegan'`           | `'all'`                |
| `proteinTypes`   | `{ meat, fish, seafood, egg }`               | all false              |
| `meatTypes`      | `{ chicken, beef, pork, lamb, duck, other }` | all false              |
| `spiceLevel`     | `'noSpicy' \| 'eitherWay' \| 'iLikeSpicy'`   | `'eitherWay'`          |
| `calorieRange`   | `{ min, max, enabled }`                      | disabled               |
| `maxDistance`    | `number` (km)                                | `10`                   |
| `openNow`        | `boolean`                                    | `false`                |
| `sortBy`         | `'closest' \| 'bestMatch' \| 'highestRated'` | `'bestMatch'`          |

> **Removed:** `hungerLevel` and `meals` were removed from the codebase (March 2026). They were never wired into any filter or scoring logic.

### 5.3 Permanent Filter Fields

Synced to/from the `user_preferences` DB table on login/save.

| Field              | Type                               | DB column equivalent                                                                                    |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `dietType`         | `'all' \| 'vegetarian' \| 'vegan'` | `user_preferences.diet_preference`                                                                      |
| `allergies`        | `string[]`                         | `user_preferences.allergies` (JSONB)                                                                    |
| `excludedCuisines` | `string[]`                         | `user_preferences.exclude` (JSONB)                                                                      |
| `maxBudget`        | `number`                           | `user_preferences.default_max_distance` (note: budget is not a separate DB column — mapped imprecisely) |
| `currency`         | `SupportedCurrency`                | `user_preferences` (currency field)                                                                     |

### 5.4 `user_preferences` Table (DB)

This is the **current persisted representation** of permanent filters.

> **Target-state note:** Part 8 Q6 decides that `user_preferences.allergies` should migrate from JSONB boolean-map format to `TEXT[]` of allergen codes. The table below documents the current live schema; it is not the target schema for implementation.

| Column                   | Type                  | Notes                                                                                                                 |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `user_id`                | UUID PK FK            |                                                                                                                       |
| `diet_preference`        | TEXT CHECK            | `all`, `vegetarian`, `vegan`                                                                                          |
| `allergies`              | JSONB                 | `{ "soy": false, "nuts": true, "gluten": false, ... }` — boolean map                                                  |
| `exclude`                | JSONB                 | `{ "noEggs": false, "noFish": false, "noMeat": false, ... }`                                                          |
| `diet_types`             | JSONB                 | `{ "keto": false, "paleo": false, "lowCarb": false, ... }`                                                            |
| `religious_restrictions` | JSONB                 | `{ "halal": false, "kosher": false, ... }`                                                                            |
| `default_max_distance`   | INTEGER DEFAULT 5     | km radius default                                                                                                     |
| `protein_preferences`    | JSONB DEFAULT `[]`    | Array of preferred protein types                                                                                      |
| `favorite_cuisines`      | JSONB DEFAULT `[]`    |                                                                                                                       |
| `favorite_dishes`        | JSONB DEFAULT `[]`    |                                                                                                                       |
| `spice_tolerance`        | TEXT CHECK            | `none`, `mild`, `medium`, `spicy`, `very_spicy`                                                                       |
| `service_preferences`    | JSONB                 | `{ "dine_in": true, "takeout": true, "delivery": true }`                                                              |
| `meal_times`             | JSONB DEFAULT `[]`    | Preferred meal time slots                                                                                             |
| `dining_occasions`       | JSONB DEFAULT `[]`    | e.g. "date night", "business lunch"                                                                                   |
| `onboarding_completed`   | BOOLEAN DEFAULT false |                                                                                                                       |
| `ingredients_to_avoid`   | JSONB DEFAULT `[]`    | Specific canonical ingredient IDs to flag (added migration 046) — NOT a hard exclusion; shown as warnings in the feed |
| `created_at`             | TIMESTAMPTZ           |                                                                                                                       |
| `updated_at`             | TIMESTAMPTZ           |                                                                                                                       |

> **Notable asymmetry:** The `user_preferences` table stores many more fields than what `filterStore` currently syncs. Fields like `spice_tolerance`, `diet_types`, `religious_restrictions`, `meal_times`, and `dining_occasions` exist in the DB but are either not fully surfaced in the mobile UI or not fully wired into the feed algorithm.

### 5.5 Where Filters Are Applied

Filters currently operate in two different ways inside the active app:

| Surface                  | Method                         | Engine                            |
| ------------------------ | ------------------------------ | --------------------------------- |
| Map restaurant discovery | `filterService.applyFilters()` | Client-side JS                    |
| Map dish discovery       | `getFeed()`                    | Edge Function (Deno + PostgreSQL) |

> **Decision (see Q11): Client-side filtering will be killed.** Both surfaces will use the Edge Function. The client-side pipeline below is documented for context but will be removed during implementation.

**Client-side filter pipeline (map screen) — TO BE REMOVED:**

```
filterService.applyFilters(restaurants, dailyFilters, permanentFilters)
  → applyPermanentFilters(restaurants)   // hard exclusions first
      → diet type (vegetarian/vegan)
      → cuisine exclusions
      → allergen exclusions
  → applyDailyFilters(restaurants)       // soft preferences
      → price range
      → cuisine type preference
      → open now
      → max distance
      → meal type
      → protein/meat type
  → sortRestaurants(result, sortBy)
  → Returns { restaurants, totalCount, appliedFilters, filterSummary }
```

**Server-side filter pipeline (feed Edge Function — map dish view):**

```
POST /functions/v1/feed
  body: { location, radius, filters, userId, limit }

1. Scope to user's current country (only restaurants in same country)
2. Load user interaction history (liked/disliked dish IDs + cuisine preferences)
3. Find nearby restaurants via PostGIS RPC restaurants_within_radius()
   └─ Fallback: JS Haversine if PostGIS RPC unavailable
4. Fetch dishes from nearby restaurants (with analytics + dish_ingredients)
5. HARD filters applied in sequence (absolute exclusions — never show violating dishes):
   a. Exclude previously disliked dishes
   b. Diet preference (vegan/vegetarian) — excludes non-matching dishes
   c. Allergen exclusion (any dish with a user allergen is removed)
   d. Religious restrictions (halal/kosher) — excludes non-compliant dishes
6. SOFT signals applied as scoring boosts (never hide, only rank):
   a. Price range preference
   b. Cuisine preference (boost matching, do NOT exclude non-matching)
   c. Spice preference
   d. Protein preference
   e. Ingredient flagging (ingredients_to_avoid → annotate dish, do NOT exclude)
7. Score + rank via calculateScore()
8. Apply diversity cap (max 3 dishes per restaurant in results)
9. Return top N dishes (default 20) + metadata
```

> **Decision (see Q4/Q8):** The pipeline separates hard filters (permanent safety constraints: diet, allergens, religious) from soft signals (daily preferences + permanent soft preferences: cuisine, price, spice, protein). All daily filters are soft. Permanent filters are hard or soft depending on the field. Soft signals never produce empty results — if no matching dishes exist, other dishes are still shown.

### 5.6 Scoring Algorithm

`calculateScore(dish, filters, distance_km, userId, userLikes, userLikedCuisines)`

| Signal                              | Max points | Type                                               |
| ----------------------------------- | ---------- | -------------------------------------------------- |
| Base score                          | 50         | Always                                             |
| Restaurant rating (0–5 → 0–20 pts)  | 20         | Objective                                          |
| Dish popularity score               | 15         | Objective                                          |
| Distance (closer = more points)     | 15         | Contextual                                         |
| Has image                           | 5          | Content quality                                    |
| Has description (>20 chars)         | 3          | Content quality                                    |
| Calorie range proximity             | 5          | Soft preference                                    |
| Diet tag match boost                | 30         | Soft boost (hard exclusion is separate — see §5.5) |
| Cuisine preference boost            | 40         | Soft boost (never excludes)                        |
| User liked same cuisine before      | 20         | Personalisation                                    |
| Same restaurant as previously liked | up to 15   | Personalisation (not yet implemented)              |

**Why this approach was taken:**

- The two-tier filter model (daily vs permanent) arose from the product insight that users have a constant identity (allergies, core diet) but a changing mood (today I want spicy food, tomorrow something light). Mixing these caused UX confusion when users changed daily choices and accidentally lost their hard dietary constraints. Part 8 Q8 adds a hard/soft classification as an orthogonal property: all daily filters are soft (mood-based, never exclude), while permanent filters can be hard (allergies, diet, religious — absolute exclusion) or soft (favourite cuisines, spice tolerance — boost only).
- Client-side filtering on the map was the first approach — it was fast to implement and works well for a small dataset. It became a known bottleneck (documented in `EDGE_FUNCTIONS_ARCHITECTURE.md`) as dish count grows, which is why the feed Edge Function was introduced for the dish view.
- The `ingredients_to_avoid` flag (migration 046) was deliberately chosen as a **soft warning** (not a hard exclusion) because ingredient presence in a dish is probabilistic — the ingredient might be used in a sauce at trace amounts, or might be easy to request "without". The user is informed, not blocked.

---

## Part 6 — Current Recommendation Workflow

### 6.1 Data Captured About User Behaviour

Three tables form the input to the recommendation system:

**`user_swipes`** — event log for recording dish-level like/pass/super interactions. Schema exists in the DB; **not currently used — swipe feature is not part of the product.** The table is retained as infrastructure for potential future reintroduction.

| Column             | Type        | Notes                                                  |
| ------------------ | ----------- | ------------------------------------------------------ |
| `user_id`          | UUID FK     |                                                        |
| `dish_id`          | UUID FK     |                                                        |
| `action`           | TEXT CHECK  | `left`, `right`, `super`                               |
| `view_duration`    | INTEGER     | milliseconds the dish card was visible                 |
| `position_in_feed` | INTEGER     | Where in the feed this dish appeared (1st, 2nd, etc.)  |
| `session_id`       | TEXT        | Groups interactions within one usage session           |
| `context`          | JSONB       | Additional context (time of day, active filters, etc.) |
| `created_at`       | TIMESTAMPTZ |                                                        |

**`user_dish_interactions`** — higher-level interaction log (viewed, liked, disliked, saved).

**`user_behavior_profiles`** — aggregated behavioural profile (preferred cuisines, price range, interaction rate). Schema exists; aggregation pipeline design is described in Part 13.

**`dish_analytics`** — population-level engagement metrics per dish.

| Column             | Type        | Notes                                           |
| ------------------ | ----------- | ----------------------------------------------- |
| `dish_id`          | UUID PK     |                                                 |
| `view_count`       | INTEGER     | Number of times the dish detail was opened      |
| `like_count`       | INTEGER     | Number of explicit likes / positive opinions    |
| `dislike_count`    | INTEGER     | Number of explicit dislikes / negative opinions |
| `favorite_count`   | INTEGER     |                                                 |
| `engagement_rate`  | FLOAT       | Computed field                                  |
| `popularity_score` | FLOAT       | Normalised popularity 0–1                       |
| `is_trending`      | BOOLEAN     |                                                 |
| `last_updated_at`  | TIMESTAMPTZ |                                                 |

> **Note:** `order_count`, `right_swipe_count`, `left_swipe_count`, and `super_like_count` were removed. EatMe is a discovery app — users do not place orders through the app. The swipe feature is not currently part of the product. If swipe is re-introduced in the future, the analytics columns can be added back.

### 6.2 Feed Generation Workflow (Edge Function: `/functions/v1/feed`)

```
User opens map/dish view (BasicMapScreen)
  → Waits for GPS coordinates
  → edgeFunctionsService.getFeed(location, dailyFilters, permanentFilters, userId, radius=10)
    → POST to Supabase Edge Function /functions/v1/feed

Edge Function:
  1. Check Upstash Redis cache (key: feed:{userId}:{lat}:{lng}:{filterHash})
     └─ Cache hit → return cached result (5 min TTL)
     └─ Cache miss → proceed
  2. Scope to user's current country (only restaurants in same country)
  3. Load user's interaction history from user_dish_interactions
     → userLikes[], userDislikes[], userLikedCuisines[]
  4. Find nearby restaurants
     → PRIMARY: restaurants_within_radius() PostGIS RPC
     → FALLBACK: fetch all restaurants, apply Haversine in JS
  5. Fetch available dishes for those restaurant IDs
     (joined with restaurant info + dish_analytics + dish_ingredients)
  6. HARD filters (absolute exclusions):
     a. Remove previously disliked dishes
     b. Diet preference (vegan/vegetarian) — excludes non-matching dishes
     c. Allergen exclusion (any dish with a user allergen is removed)
     d. Religious restrictions (halal/kosher) — excludes non-compliant dishes
  7. SOFT signals (scoring boosts — never hide, only rank):
     a. Price range preference
     b. Cuisine preference (boost matching, do NOT exclude non-matching)
     c. Spice preference
     d. Protein preference
     e. Ingredient flagging (ingredients_to_avoid → annotate dish, do NOT exclude)
  8. Score each remaining dish via calculateScore()
  9. Sort by score descending
  10. Apply diversity cap (max 3 dishes per restaurant)
  11. Return top 20 (or configured limit)
  12. Cache result in Redis (if configured)

BasicMapScreen:
  → dishes[] populated, displayed as map markers / list
```

### 6.3 Group Recommendation Workflow (Edge Function: `/functions/v1/group-recommendations`)

For the "Eat Together" feature, when a group session enters the `recommending` state:

```
Multiple users join session via 6-digit code
  → All members marked as ready
  → Host triggers recommendation
  → group-recommendations Edge Function called
    → Loads all participants + their user_preferences
    → Finds restaurants at/near midpoint (or host location / max-radius mode)
    → Applies HARD constraints from all members:
        → union of allergens
        → union of diet/religious restrictions
        → exclude restaurants/dishes that violate any member's hard constraints
    → Computes group preference profile:
        → current implementation: overlap of explicit preferences
        → target implementation: average of member preference vectors (§9.10.4)
    → Scores each restaurant for group compatibility:
        → distance from each member
        → cuisine / preference overlap (current)
        → vector similarity to `restaurant_vector` (target)
    → Returns ranked restaurant list stored in eat_together_recommendations
  → Members vote on suggested restaurants
  → Winning restaurant stored in eat_together_sessions.selected_restaurant_id
```

---

## Part 7 — Why This Approach Was Taken (Summary)

> **Important:** This table describes the **current implementation state** and why it evolved that way. Several items below are intentionally superseded by the **target-state decisions** in Part 8. Use Part 8 as the source of truth for implementation planning.

| Decision                                       | Rationale                                                                                            | Trade-off                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSONB location + computed PostGIS column       | Avoid breaking migration of existing data; JSONB is flexible for the portal form                     | Redundancy; two representations of the same thing                                                                                                         |
| cuisine_types as TEXT[]                        | Restaurants serve 2–5 cuisines; join table would add complexity with little benefit at current scale | Hard to query cuisines independently; no cuisine master table                                                                                             |
| Canonical ingredient system with aliases       | Normalises multilingual ingredient entry; ensures allergen calculation is consistent                 | Complex — two parallel ingredient systems (master + canonical) coexist                                                                                    |
| Allergen auto-calculation via Postgres trigger | Single source of truth; no application code can skip it; consistent across all write paths           | Trigger silently fails if not tested — `dishes.allergens` can be stale if trigger breaks                                                                  |
| Legacy `ingredients` TEXT[] column on dishes   | Migration artefact — was the original approach before the canonical system                           | Dual representation; unclear which is authoritative                                                                                                       |
| Daily vs permanent filter two-tier model       | Separates identity (allergies, diet) from mood (today's cravings); prevents accidental override      | Two separate UIs + storage paths to maintain; augmented with hard/soft classification in Part 8 (daily = always soft; permanent = hard or soft per field) |
| Client-side filtering on map screen            | Fast to implement; works well for small datasets                                                     | Does not scale beyond ~1000 restaurants; wastes bandwidth                                                                                                 |
| Feed Edge Function for dish discovery          | Scalable; keeps ranking algorithm private; enables personalisation from user history                 | Two filter codebases (client + server) must stay in sync; adds ~200ms latency                                                                             |
| Score-based ranking with hard+soft filters     | Hard exclusions (allergens) ensure safety; soft boosts (cuisine preference) preserve discovery       | Score weights are manually tuned magic numbers — no ML training loop; superseded by two-stage vector pipeline in Part 9                                   |
| `user_behavior_profiles` aggregated table      | Avoids re-scanning the raw interaction log on every feed request                                     | Aggregation pipeline not yet running — profile is currently empty                                                                                         |
| 5-minute Redis cache on feed results           | Reduces DB load for users in the same area with similar filters                                      | Cache key includes userId + exact coordinates — personalised feeds are rarely cached                                                                      |
| Three-level hierarchy: menu → category → dish  | Mirrors real restaurant menu structure; gives partners control over dish grouping                    | The web portal UI doesn't always surface category management clearly                                                                                      |

---

## Part 8 — First Principles Challenge Questions

The following questions are starting points for the review — they are intentionally provocative, not conclusions. Each should be answered before committing to the current structure.

### On the Data Model

1. **Do we need both `menus` and `menu_categories`?**  
   A restaurant has a "Dinner" menu with "Starters" and "Mains" sections. Is this genuinely a two-level concept for our use case, or could a single `menu_sections` table with an optional `parent_id` serve both the flat and nested case?

   > **Decision: Keep both.** The three-level hierarchy mirrors real restaurant menu structure and is already working. The new option-groups feature (Part 10) attaches to both `dishes` and `menu_categories`, which validates the current hierarchy. No change needed.

2. **Is `dish_category` (global taxonomy) the right abstraction for dish discovery?**  
   The global `dish_categories` table (Burger, Salad, Sushi) exists but is not currently used in filtering or recommendation. Is this the right unit for user preference learning, or should we learn from cuisine types and ingredient families instead?

   > **Decision: Keep for web portal organisation, but do not use for recommendation.** Vector embeddings (Part 9) supersede category-based discovery. The `dish_category_id` remains useful for the partner portal ("what type of dish is this?") and for the AI enrichment system (§9.10.2) as a structured signal in `embedding_input`. It should not be wired into the feed scoring function directly.

3. **Should `spice_level` be an integer or a named enum?**  
   The current 0/1/3 scheme (migration 041b) maps to none/mild/hot. The gap at 2 exists because the original 0–4 range was consolidated. A proper enum (`none`, `mild`, `hot`) would be cleaner and self-documenting.

   > **Decision: Migrate to TEXT enum (`none`, `mild`, `hot`).** The integer values 0/1/3 correspond to the number of chilli pepper icons shown in the UI. The enum is self-documenting and removes the confusing gap. Migration: `ALTER TABLE dishes ALTER COLUMN spice_level TYPE TEXT USING CASE WHEN spice_level = 0 THEN 'none' WHEN spice_level = 1 THEN 'mild' WHEN spice_level = 3 THEN 'hot' ELSE 'none' END;` then add a CHECK constraint. UI continues to render 0/1/3 🌶️ icons by mapping from the enum value.

4. **Is the legacy `ingredients` TEXT[] column on `dishes` still needed?**  
   If `dish_ingredients` + the canonical system are the live path, the `ingredients` column is dead weight and a source of confusion. When should it be dropped?

   > **Decision: Drop it, following the four-phase deprecation plan.**
   >
   > - Phase 1 — Audit: search codebase for all references to `dishes.ingredients`, check DB query logs, verify no triggers/functions use it.
   > - Phase 2 — Shadow deprecation: stop writing to the column; keep reads if any still exist.
   > - Phase 3 — Migration: backfill any data only present in the TEXT[] column into `dish_ingredients` + canonical system; add NOT NULL constraints to the canonical path.
   > - Phase 4 — Drop: `ALTER TABLE dishes DROP COLUMN ingredients;`

5. **Do we need both `ingredients_master` and `canonical_ingredients`?**  
   The `ingredients_master` table is unused in active workflows. It adds schema complexity and may mislead future developers. When should it be removed?

   > **Decision: Drop `ingredients_master` and its junction tables (`ingredient_allergens`, `ingredient_dietary_tags`), following the same four-phase deprecation plan.**
   >
   > - Phase 1: Audit for any lingering references or triggers.
   > - Phase 2: Ensure no code path writes to or reads from these tables.
   > - Phase 3: Verify all data that was in `ingredients_master` has a canonical equivalent.
   > - Phase 4: `DROP TABLE ingredient_dietary_tags; DROP TABLE ingredient_allergens; DROP TABLE ingredients_master;`

6. **Is the JSONB boolean-map structure of `user_preferences.allergies` the right model?**  
   `{ "soy": false, "nuts": true, "gluten": false }` is a fixed schema baked into the application code. Adding a new allergen requires a code change. An array of allergen codes (TEXT[]) would be schema-free and more consistent with how `dishes.allergens` is stored.

   > **Decision: Migrate to TEXT[] of allergen codes.** Store `allergies` as `TEXT[] DEFAULT '{}'` containing codes like `['NUTS', 'GLUTEN']` — matching the format used in `dishes.allergens`. This makes the SQL exclusion filter a simple array overlap check (`dishes.allergens && user_preferences.allergies`), eliminates the need for application-side boolean-map parsing, and allows new allergens to be added to the `allergens` reference table without any code change. Migration: extract `true` keys from the existing JSONB map, uppercase them, insert as array; then alter column type.

7. **Should `user_preferences` map more directly to the filter store fields?**  
   The `user_preferences` table has more fields than `filterStore` syncs (e.g. `spice_tolerance`, `diet_types`, `religious_restrictions`, `dining_occasions` are stored but not fully wired). Is this intentional for future use, or is it creating false expectations?

   > **Decision: Keep the DB columns but wire them incrementally.** The extra fields (`spice_tolerance`, `diet_types`, `religious_restrictions`, `dining_occasions`) are forward-looking and should remain in the schema. The implementation plan should include wiring each one into the feed Edge Function as signals — hard filters for `religious_restrictions` (like `diet_preference`), soft boosts for `dining_occasions`, `spice_tolerance`, and `diet_types`. The `filterStore` sync should be extended to cover all persisted preference fields.

### On the Filter System

8. **Is a two-tier filter the right mental model for users?**  
   The daily vs permanent distinction requires users to understand the difference. Most food apps (Uber Eats, Deliveroo) use a single flat filter. What evidence do we have that two tiers improve the experience vs add cognitive load?

   > **Decision: Keep the daily/permanent two-tier model. Add a hard/soft classification as an orthogonal property.**
   >
   > The two tiers describe **when and where** a filter lives:
   >
   > - **Daily filters** = session-scoped, in-memory (Zustand). Reset between sessions. These are mood-based choices for the current discovery session.
   > - **Permanent filters** = profile-scoped, persisted in `user_preferences` (Supabase). Survive across sessions and devices.
   >
   > The hard/soft classification describes **exclusion behaviour** — how the filter affects results:
   >
   > - **Hard filters** = absolute exclusions. Violating dishes are never shown. Applied as SQL WHERE clauses. Examples: `allergies` (permanent + hard), `diet_preference` (permanent + hard), `religious_restrictions` (permanent + hard).
   > - **Soft filters** = preference signals that boost matching dishes but never hide non-matching ones. If no matching dishes exist, other dishes are still shown. Examples: `cuisine preference` (daily + soft), `spice preference` (daily + soft), `price range` (daily + soft), `favorite_cuisines` (permanent + soft).
   >
   > **Key rule: All daily filters are soft. Permanent filters can be hard or soft depending on the field.**
   >
   > | Filter field             | Tier      | Behaviour | Rationale                                         |
   > | ------------------------ | --------- | --------- | ------------------------------------------------- |
   > | `allergies`              | Permanent | Hard      | Medical safety — must never show violating dishes |
   > | `diet_preference`        | Permanent | Hard      | Core identity — vegan means no animal products    |
   > | `religious_restrictions` | Permanent | Hard      | Religious compliance — must be explicit and safe  |
   > | `favorite_cuisines`      | Permanent | Soft      | Preference, not safety — boost, don't exclude     |
   > | `spice_tolerance`        | Permanent | Soft      | Preference — boost matching spice levels          |
   > | `ingredients_to_avoid`   | Permanent | Soft      | Personal preference — warn, never exclude         |
   > | `cuisineTypes`           | Daily     | Soft      | Today's mood — boost Italian, don't hide others   |
   > | `priceRange`             | Daily     | Soft      | Session preference — rank by price proximity      |
   > | `spiceLevel`             | Daily     | Soft      | Session mood — boost matching spice               |
   > | `proteinTypes`           | Daily     | Soft      | Session mood — boost matching protein             |
   > | `maxDistance`            | Daily     | Soft      | Session scope — rank by proximity                 |
   >
   > This preserves the UX benefit of the two-tier model (users don't accidentally lose their allergy settings when changing today's mood) while making the exclusion behaviour predictable and consistent across all surfaces.

9. **Should cuisine preference be a filter or a pure recommendation signal?**  
   Cuisine type is currently exposed as both a filter (daily: hard exclusion option) and a recommendation boost in the scoring function. This creates inconsistency: selecting "Italian" in filters on the map shows only Italian; in the feed Edge Function, it boosts Italian without hiding others. Is this intentional?

   > **Decision: Cuisine preference is always a soft filter (boost, never exclude).** If a user selects "Italian" and there are Italian restaurants nearby, they are boosted to the top. If there are none, the user still sees other dishes — the feed does not return empty. This is correct for a discovery app: hiding everything that isn't Italian punishes exploration. The client-side hard-filter behaviour for cuisine on the map will be removed when client-side filtering is killed (see Q11).

10. **Should `hungerLevel` and `meals` affect what dishes are shown, or only how they are ranked?**  
    These daily filter fields exist in the store but do not appear to be wired into `filterService` or the Edge Function. Are they cosmetic placeholders, or should they drive filtering/scoring?

> **Decision: Removed.** Both `hungerLevel` and `meals` have been removed from the codebase. They were never wired into any filter or scoring logic and added no value.

11. **Is client-side filtering on the map worth maintaining long-term?**  
    The feed Edge Function already handles server-side filtering for dish discovery. Should the map restaurant list also migrate to server-side filtering to eliminate the dual filter codebases?

> **Decision: Kill client-side filtering. Move everything to the Edge Function.** The `filterService.applyFilters()` client-side pipeline and its duplicate filter logic will be removed. The map restaurant view will call the Edge Function for filtered results, just like the dish view already does. This eliminates the dual-codebase problem and ensures hard/soft filter behaviour is consistent across all surfaces. The `filterStore` remains as a UI state container that passes filter parameters to the Edge Function — it no longer applies filters itself.

### On the Recommendation System

12. **What problem does the recommendation engine actually solve right now?**  
    The system has a `user_swipes` schema, a behaviour profile table, and a scoring function — but no data is flowing into them yet. The current personalisation reads only the last N `user_dish_interactions`. At what point does personalisation meaningfully differ from "show popular dishes nearby"?

> **Decision: The recommendation system should use three signal sources, prioritised in order:** (1) Explicit user preferences from onboarding (diet, allergies, cuisine preferences, spice tolerance). (2) Dish opinions and likes (dishes the user has explicitly rated or liked). (3) Past filter usage patterns (what cuisine/price/distance the user consistently selects). The swipe feature is not currently part of the app and should not be relied upon. The `user_swipes` and `user_dish_interactions` schemas remain as infrastructure for when interaction tracking is implemented; the `user_behavior_profiles` aggregation pipeline should be designed and included in the implementation plan.

13. **Is score-based ranking the right mechanism, or should we think in terms of candidate generation + ranking stages?**  
    Large-scale recommendation systems (Netflix, TikTok) use a two-stage pipeline: a fast candidate generator (PostGIS + simple filters → 200 candidates) followed by a separate ranking model. Our current approach combines both in one place. Is this a problem at our expected scale?

> **Decision: Adopt the two-stage pipeline as described in §9.5.** Stage 1 (candidate generation): PostGIS radius → hard filters → vector ANN search (top 200). Stage 2 (ranking): score the 200 candidates using cosine similarity + rating + content quality + distance. This is the target architecture; the current combined approach is acceptable while dish count is < 500 but should be refactored to the two-stage model as the vector pipeline comes online.

14. **Should the `ingredients_to_avoid` field drive soft warnings or be available as a hard filter too?**  
    Currently `ingredients_to_avoid` only annotates (flags) dishes — it never excludes them. Some users with serious intolerances (not anaphylactic allergies, but strong preferences) may want hard exclusion. Should this be user-configurable per ingredient?

> **Decision: Soft warnings only.** `ingredients_to_avoid` annotates dishes with a visible warning but never excludes them. Users with true allergies should use the `allergies` field (which is a hard filter). The distinction: allergies = medical safety (hard exclude), ingredients_to_avoid = personal preference (soft warn). This avoids the complexity of per-ingredient hard/soft toggles.

15. **How does "Eat Together" group recommendation interact with individual personalisation?**  
    The group recommendation scores compatibility across all members' preferences. If one member has a hard allergen constraint, does that restaurant get removed from the group list? The current implementation uses member preferences for scoring but the hard exclusion logic is not yet verified in the group context.

> **Decision: Hard constraints from any member must be respected.** If any group member has a hard allergen or dietary constraint, restaurants that cannot accommodate it should be excluded or flagged. This means the group recommendation must union all members' hard filters before scoring. Soft preferences (cuisine, spice) are merged via the group vector approach described in §9.10.4. The implementation plan should verify this logic exists in the group-recommendations Edge Function.

---

## Part 9 — Should Dishes Use Vector Embeddings?

This is the most consequential open architectural question in the entire recommendation pipeline. It deserves its own section rather than a single bullet in Part 8.

---

### 9.1 The Problem with Structured Attributes for Ranking

The current dish representation is purely **structured and categorical**:

- `name`, `description` — free text, but treated as opaque strings (never analysed)
- `cuisine_types` — array of string labels on the restaurant, not the dish
- `dish_category_id` — a global taxonomy label (e.g. "Burger", "Salad")
- `dietary_tags`, `allergens` — computed arrays of codes
- `spice_level`, `calories`, `price` — scalar values

When the feed scoring function tries to personalise results, it has very little signal to work with:

```
User liked "Tacos al Pastor" → cuisine_types = ["Mexican"]
→ Score boost for other Mexican dishes
→ Does NOT surface "Shawarma" (same concept — marinated meat, flatbread, similar spice),
  "Döner Kebab", or "Korean BBQ Wrap" — cross-cuisine analogues are invisible
```

The scoring function can only boost dishes that share an explicit label with something the user liked. It has no way to understand that a user who consistently picks "flavourful, protein-heavy, slightly spicy, wrapped" dishes has a coherent preference that cuts across cuisines. Every new cuisine label is a cold-start problem.

---

### 9.2 What Vector Embeddings Capture

A vector embedding is a high-dimensional numerical representation of meaning. When you embed:

```
"Crispy fried chicken thigh in a soft brioche bun with chipotle mayo and pickled jalapeños — Mexican-inspired fried chicken sandwich"
```

...the resulting vector (typically 768–3072 dimensions) encodes semantic proximity: this dish will be geometrically close to other dishes that are:

- Also "fried chicken sandwiches" even if described differently
- Spicy-yet-approachable
- Brioche/soft bread formats
- Mexican or Tex-Mex flavour profiles

And further from:

- Light salads, sushi, or plain grilled fish — even if they're at Mexican restaurants

Critically, this works **across cuisine labels**. "Tacos al Pastor" and "Korean BBQ Wrap" will be near each other in vector space despite having completely different `cuisine_types`. A user's preference vector — the average of their liked dish embeddings — generalises to new dishes the system has never seen before.

---

### 9.3 What We Would Embed

> **Note:** This section describes the _enriched data preparation_ format — the full structured context available for a dish. The **actual embedding input** uses the short structured format defined in §9.10 Decision 2. This long format is used only during the AI enrichment pipeline (§11) to generate the structured fields that feed into the short format.

The full structured context for a dish includes:

```
"{name}. {description}. Ingredients: {ingredient canonical names, comma-separated}.
Cuisine: {restaurant.cuisine_types}. Category: {dish_category.name}.
Spice: {spice_level as text}. Dietary: {dietary_tags}."
```

Example:

```
"Tacos al Pastor. Slow-roasted pork marinated in achiote and pineapple, served in corn tortillas
with cilantro and onion. Ingredients: pork shoulder, pineapple, achiote paste, corn tortilla,
cilantro, white onion, lime. Cuisine: Mexican, Street Food. Category: Taco.
Spice: mild. Dietary: gluten_free."
```

The **canonical embedding input** sent to the embedding model is the short structured format (§9.10):

```
"Tacos al Pastor, taco, pork shoulder, pineapple, achiote paste, corn tortilla, cilantro, onion, lime"
```

This short format is stored in `dishes.embedding_input` and is what produces the 1536-dimensional vector stored in `dishes.embedding`, indexed with HNSW for sub-millisecond nearest-neighbour lookup.

---

### 9.4 How This Changes the Stack

#### Database

Supabase supports `pgvector` natively (available as an extension). The changes would be:

```sql
-- Enable the extension (if not already)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to dishes
ALTER TABLE dishes ADD COLUMN embedding vector(1536);

-- HNSW index for cosine similarity search
-- (much faster than exact search at >10k dishes)
CREATE INDEX ON dishes USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Dish embeddings are stored on `dishes`. Once the recommendation pipeline is enabled, user preference vectors are stored on `user_behavior_profiles` and reused by the feed:

```sql
-- Find dishes nearest to a user's stored preference vector
SELECT d.*, (d.embedding <=> $1::vector) AS distance
FROM dishes d
WHERE d.restaurant_id = ANY($2)   -- pre-filtered by PostGIS radius
  AND d.is_available = true
  AND NOT (d.allergens && $3)      -- hard allergen exclusion still applies
ORDER BY distance ASC
LIMIT 20;
```

`$1` is the user's stored preference vector from `user_behavior_profiles.preference_vector`.  
`$2` is the list of nearby restaurant IDs (still from PostGIS).  
`$3` is the user's allergen array.

#### Generation Pipeline

When a dish is created or its semantic content changes (name, ingredients, or options — see Part 12 for the full trigger list):

```
Dish saved (web portal or menu scan)
  → Enrichment system checks completeness (Part 11)
  → Generates embedding_input using short structured format (§9.10)
  → POST to OpenAI /embeddings (text-embedding-3-small)
  → Store vector in dishes.embedding + dishes.embedding_input
```

Enrichment and embedding generation run asynchronously — they do not block the partner UX. Cost is ~$0.0005 per dish (enrichment + embedding combined).

#### Feed Generation (modified)

```
User opens dish view
  → edgeFunctionsService.getFeed(...)
    → Load user_behavior_profiles.preference_vector
    → If no history: preference_vector = null → fall back to popularity ranking
    → PostGIS: find nearby restaurant IDs (unchanged)
    → Hard filters: allergens, diet type, religious restrictions (unchanged — vectors don't help here)
    → Soft signals: price, cuisine, spice, protein (applied as scoring boosts)
    → Vector search: ORDER BY embedding <=> preference_vector LIMIT 20
    → Diversity cap: max 3 per restaurant (unchanged)
    → Return results
```

---

### 9.5 Two-Stage Pipeline (Candidate Generation + Ranking)

This is where vectors enable a cleaner architecture than the current combined filter+rank approach.

**Stage 1 — Candidate generation (fast, broad)**

Goal: reduce ~10,000 nearby dishes to ~200 candidates.

```
PostGIS radius → ~500 restaurants
Hard filters (allergens, diet, religious restrictions) → ~300 restaurants → ~3,000 dishes
Vector ANN search (HNSW, top-200 by cosine similarity) → 200 candidates
```

This stage is a single SQL query. HNSW on pgvector runs in ~2–5ms at 100k rows.

**Stage 2 — Ranking (slower, precise)**

Goal: score and order the 200 candidates.

```
For each of 200 candidates:
  → distance score (1 - cosine_distance) — replaces cuisine/diet boosts
  → restaurant rating score
  → freshness / trending score from dish_analytics
  → content quality (has image, has description)
  → diversity cap applied after sort
→ Return top 20
```

Stage 2 replaces the current `calculateScore()` with weights that are meaningful (semantic similarity is a single principled score) rather than manually tuned magic numbers.

---

### 9.6 What Vectors Do NOT Replace

Hard filtering must remain structured — vectors cannot substitute for safety constraints:

| Constraint             | Method              | Why not vectors                                             |
| ---------------------- | ------------------- | ----------------------------------------------------------- |
| Allergen exclusion     | SQL `&&` array      | Semantically similar dishes may still trigger an allergy    |
| Diet type (vegan)      | SQL array check     | "Looks vegan" ≠ "is vegan" — requires explicit DB labelling |
| Religious restrictions | SQL / explicit tags | Religious compliance must be explicit and safe              |
| Geographic radius      | PostGIS             | Distance is not captured in dish text                       |
| Restaurant is active   | SQL boolean         | N/A                                                         |

Price remains a **soft preference signal** in the target architecture. It influences ranking, but does not exclude dishes outright. The **hybrid approach** — hard structured filters first, vector ranking second — is the correct architecture. Vectors only improve the soft preference layer.

---

### 9.7 Cold Start Problem

When a user has no interaction history, there is no preference vector to compute. Three fallback strategies, in order of effort:

1. **Onboarding-seeded vector** — During user onboarding, ask the user to pick 5–10 "example dishes" they like from a curated set. Average their embeddings as the initial preference vector. Zero extra interaction required.

2. **Popularity vector** — Compute an aggregate vector for the most-liked dishes in the user's area and use it as default. Equivalent to "show what most people here enjoy" — better than no signal.

3. **Random with recency bias** — No vector. Fall back to current scoring: popularity + distance + content quality. Indistinguishable from "cold start" for the user.

Option 1 is strongly preferable because it bootstraps personalisation before any real interaction, making the first session meaningfully personalised.

---

### 9.8 Cost Estimate

| Item                              | Cost                                            |
| --------------------------------- | ----------------------------------------------- |
| Embedding generation per dish     | ~$0.000020 (text-embedding-3-small, 500 tokens) |
| 10,000 dishes at launch           | ~$0.20 one-time                                 |
| 100 new dishes/day ongoing        | ~$0.002/day                                     |
| pgvector storage (1536 × 4 bytes) | ~6 KB per dish — 60 MB for 10,000 dishes        |
| HNSW index build (10k rows)       | < 1 second                                      |
| ANN query at 100k rows (HNSW)     | 2–5ms                                           |

Cost is not a concern at current or near-term scale.

---

### 9.9 Decision Framework

The question is not "should we ever use vectors" — the answer is clearly yes for a discovery product at scale. The question is **when** and **in what order**.

| Phase       | Dish count | Recommendation quality with current approach    | Recommended path                               |
| ----------- | ---------- | ----------------------------------------------- | ---------------------------------------------- |
| Now         | < 500      | Acceptable — popularity + distance is fine      | Add `embedding` column, start generating now   |
| Near-term   | 500–5,000  | Starts to degrade — cuisine boost is too coarse | Wire vectors into feed ranking as a soft score |
| Medium-term | 5,000–50k  | Clearly poor without vectors                    | Full two-stage pipeline: generate + rank       |
| At scale    | 50k+       | Unusable without vectors                        | Full pipeline + user preference vector updates |

**The single best action now** — before the dish count grows — is to add the `embedding vector(1536)` column to `dishes`, start generating embeddings for new dishes at creation time, and store them. This costs almost nothing and means the data asset is building up passively. The ranking logic can be wired in later.

---

### 9.10 Decisions

#### 1. Embedding model — ✅ `text-embedding-3-small`

`text-embedding-3-small` (1536 dims) is sufficient for food description similarity. `text-embedding-3-large` offers no meaningful quality gain for this domain at 5× the cost.

---

#### 2. What goes in the text block — ✅ Enriched structured format

The quality of embeddings depends heavily on the input text. Since restaurant menus vary in completeness, the system must **standardise and enrich input before embedding** — not embed raw user-entered text directly.

**Canonical input format:**

```
"{dish name}, {dish type}, {key ingredients}, {cuisine type (optional)}"
```

Example with full data:

```
"Tantan Men, ramen, pork, noodles, chili oil, sesame"
```

Example with only a dish name — the AI enrichment system (Part 11) generates structured fields, which are then composed into the short format:

```
Input:  "tacos de barbacoa"
AI output (§11.4):  { dish_type: "taco", ingredients: ["beef", "corn tortilla", "onion", "cilantro"], cuisine: "mexican" }
embedding_input:    "tacos de barbacoa, taco, beef, corn tortilla, onion, cilantro"
```

**Priority of fields:**

- **Ingredients + dish type** — highest weight, most important for cross-cuisine similarity
- **Cuisine type** — included lightly (optional), not the primary signal
- Free-form `description` — used as auxiliary input during initial AI enrichment (§11) only; not directly included in the canonical `embedding_input` string

This hybrid approach ensures embeddings are consistent across sparsely-entered menus while still capturing cross-cuisine relationships (e.g. ramen ↔ pho ↔ laksa will cluster correctly via ingredient overlap, even without a cuisine label).

**The enriched text string must be stored** in a `embedding_input` TEXT column on `dishes`. This avoids repeated API calls on re-indexing and makes the enrichment auditable.

**DB changes:** The full schema for embedding and enrichment columns is defined in §11.6. It includes `embedding_input`, `embedding`, `enrichment_status`, `enrichment_source`, `enrichment_confidence`, and `enrichment_payload`.

---

#### 3. User preference vectors — ✅ Weighted average, stored in `user_behavior_profiles`

User preference vectors represent a user's taste profile and are central to personalised recommendations. They should be **stored**, not computed on every feed request.

**Computation:**

$$\text{user\_vector} = \frac{\sum (\text{dish\_vector}_i \times w_i)}{\sum w_i}$$

**Interaction weights:**

| Interaction type  | Weight |
| ----------------- | ------ |
| Favorite          | 3.0    |
| Rating (positive) | 2.0    |
| Like              | 1.5    |
| View (>10s)       | 0.5    |

**Time decay:** recent interactions influence the vector more than older ones. Apply an exponential decay factor:

$$w_{\text{decayed}} = w \times e^{-\lambda \cdot \Delta t}$$

where $\Delta t$ is days since interaction and $\lambda \approx 0.01$ (half-life ~70 days).

**Multi-vector model (future):** Once sufficient interaction data exists, split into:

- `long_term_vector` — stable taste computed over all history
- `short_term_vector` — last 30 days of interactions

Combined for the final query:

$$\text{final\_vector} = 0.7 \times \text{long\_term} + 0.3 \times \text{short\_term}$$

**DB change required:**

```sql
ALTER TABLE user_behavior_profiles
  ADD COLUMN preference_vector vector(1536),
  ADD COLUMN preference_vector_updated_at TIMESTAMPTZ;
```

The vector is recomputed and stored whenever a new interaction is recorded. Feed requests read the stored vector — no per-request aggregation needed.

---

#### 4. Group recommendations (Eat Together) — ✅ Average user vectors → compare to restaurant vectors

Group recommendations benefit significantly from vector-based modelling. Rather than relying on explicit label overlap (shared cuisines), the system computes a **group preference vector** by averaging individual member vectors:

$$\text{group\_vector} = \frac{1}{n} \sum_{i=1}^{n} \text{user\_vector}_i$$

Each restaurant is represented by a **restaurant vector** — the average of its dish embeddings:

$$\text{restaurant\_vector} = \frac{1}{m} \sum_{j=1}^{m} \text{dish\_vector}_j$$

Recommendations are ranked by cosine similarity between `group_vector` and `restaurant_vector`. This finds restaurants that satisfy diverse tastes within a group (e.g. one member likes ramen, another likes tacos, another likes spicy food — a restaurant serving bold, flavourful dishes will score well for all three).

Hard constraints (allergens from any member) are still applied as SQL exclusions before the vector ranking.

**DB change required:**

```sql
ALTER TABLE restaurants ADD COLUMN restaurant_vector vector(1536);
```

Updated whenever dishes are added or their embeddings change. Computed as `avg(embedding)` over the restaurant's active dishes.

---

#### 5. Cold start for new dishes and restaurants — ✅ Embed at creation, weight similarity higher initially

New dishes and restaurants are not a cold-start problem for discovery — embeddings are generated at creation time, so every dish is immediately usable in similarity-based ranking. The only cold-start issue is the absence of rating and popularity signals.

**Initial scoring weight for new dishes:**

$$\text{score} = 0.6 \times \text{similarity} + 0.2 \times \text{rating} + 0.2 \times \text{popularity}$$

As ratings and interactions accumulate, `rating` and `popularity` naturally gain real signal. No special casing is needed — the weights can be fixed and the scoring function naturally transitions as data fills in.

This ensures new restaurants can be recommended meaningfully from day one.

---

## Part 10 — Flexible Menu Composition (Option Groups)

### 10.1 The Problem with the Current Flat Dish Model

The current structure treats every dish as a single, fixed item:

```
restaurants → menus → menu_categories → dishes
```

A `dish` has a fixed `name`, `price`, and `description`. There is no way to represent:

- "Choose beef, chicken, tofu, or shrimp — then choose green curry, pad thai, or drunken noodles"
- "Build your own burrito: base → protein → toppings → sauce"
- "Add an extra egg, chashu, or nori to your ramen"
- "Order salmon as nigiri, sashimi, or hand roll"
- "200g wagyu + 200g pork belly combo, with doneness preference for the wagyu"

Every restaurant that has one of these patterns either cannot be represented, or requires the partner to manually create a combinatorial explosion of dishes (`Chicken Green Curry`, `Chicken Pad Thai`, `Chicken Red Curry`, `Beef Green Curry`... × N proteins × M preparations). That becomes unmanageable and loses the semantic relationship between items.

---

### 10.2 The Core Patterns

Before designing a schema, it helps to understand what each pattern actually requires structurally. The first seven are the foundational composition patterns; the remaining ones are menu presentation patterns or experience-style items built on top of them.

#### Pattern A — Fixed dish (standard Western)

```
Margherita Pizza — $14
```

No choices. The dish is exactly what it says. The current model handles this perfectly. No change needed.

---

#### Pattern B — Dish + add-ons / toppings (ramen, burgers, pizza)

```
Tonkotsu Ramen — $16
  + Extra chashu     +$3
  + Soft-boiled egg  +$2
  + Extra nori       +$1
  + Spicy sauce      +$0
```

One or more **optional** groups of extras. The customer can pick zero or many. The base dish has a fixed price; each add-on has a price delta.

---

#### Pattern C — Base + preparation (Thai / Chinese / Indian)

```
Thai Main Course — from $13
  Choose protein (required, pick 1):
    Chicken $13 / Beef $15 / Tofu $13 / Shrimp $16
  Choose preparation (required, pick 1):
    Green Curry / Red Curry / Pad Thai / Drunken Noodles (+$0 each)
```

Two (or more) required single-choice groups. The dish itself is a template; the actual item delivered is defined by the combination of choices. Price may be driven by the protein choice, the preparation, or both.

---

#### Pattern D — Build your own (Chipotle, poke bowls, bánh mì)

```
Custom Bowl — from $12
  Base (required, pick 1): Rice / Salad / Half & Half
  Protein (required, pick 1): Chicken $0 / Steak +$2 / Tofu $0 / Veggie $0
  Extras (optional, pick up to 3): Guacamole +$2 / Cheese +$1 / Jalapeños $0 / ...
  Sauce (optional, pick 1): Hot / Medium / Mild
```

Multiple sequential option groups, some required and some optional, with per-option price deltas shown in the UI.

---

#### Pattern E — Grill selection (Korean BBQ, Brazilian churrasco)

```
Grill Items — order by portion
  Wagyu Ribeye (200g)       $28  [marination: unmarinated | soy | spicy]
  Pork Belly (300g)         $18  [marination: unmarinated | doenjang]
  Garlic Butter Shrimp      $16
```

Each cut is a separate dish (with its own price and image). Each dish may have a small sub-group for marination preference. The "grill experience" (charcoal, tongs, side dishes) is restaurant-level context, not menu structure. This pattern is Pattern A or B per cut — no new structure needed beyond what Pattern B provides.

---

#### Pattern F — Sets / combos (Japanese teishoku, fast food combos)

```
Teishoku Set — $22 (includes rice, miso soup, pickles)
  Main course (required, pick 1):
    Grilled salmon / Tonkatsu / Chicken karaage
  Soup upgrade (optional, pick 1):
    Keep miso (included) / Upgrade to clam chowder (+$3)
```

A combo is a dish whose "contents" are defined by one or more required single-choice groups (one per course component). Fixed-price or base-price-with-upgrades. Structurally the same as Pattern C, but semantically a "bundle" rather than a composed single item.

---

#### Pattern G — Shared ingredient matrix (sushi / sashimi)

```
Sushi Selection
  Fish (required, pick 1): Salmon / Tuna / Yellowtail / Scallop
  Style (required, pick 1): Nigiri ×2 / Sashimi ×3 / Hand Roll / Maki (6pc)

  Price = fish_price + style_price
```

Two required groups where each group represents one axis of a conceptual matrix. A customer ordering "Salmon Nigiri" is really selecting row=Salmon, column=Nigiri. This is structurally identical to Pattern C (two required single-choice groups). The difference is only in how the UI might choose to render it as a grid vs two dropdowns.

---

#### Pattern H — Experience dish (hot pot / fondue / tasting menu / buffet)

```
Hot Pot — from $25 per person
  Choose broth
  Choose meats
  Choose vegetables
  Choose noodles
```

Or:

```
Chef Tasting Menu — $85
Lunch Buffet — $24
```

These are not normal single plated dishes. They are best understood as **experience dishes**: one menu item representing a dining format or bundled experience. Some experience dishes have option groups (hot pot broth, meat selection); others are just fixed entries (buffet, tasting menu).

---

#### Pattern I — Many small dishes (dim sum / tapas / mezze)

```
Har Gow
Siu Mai
BBQ Pork Bun
Chicken Feet
```

There is no single main dish and no composition problem. The correct model is simply many individual dishes in one menu category. Dim sum is a presentation style, not a data-model exception.

---

#### Pattern J — Size + toppings (pizza / sandwiches / burgers)

```
Pizza — from $12
  Size: Small / Medium / Large
  Toppings: Pepperoni / Mushrooms / Olives / Extra cheese
```

This is a standard option-group case:

- required single-choice group for size
- optional multiple-choice group for toppings

---

#### Pattern K — Shared side dishes / upgrades

```
Any curry can add:
  Rice +$2
  Noodles +$3
  Soup +$4
```

These are category-level option groups. They should not be duplicated onto every dish.

---

#### Pattern L — Seasonal / special menus

```
Winter Specials
Summer Ramen
Chef's Specials
Daily Special
Drinks
Desserts
```

These are menu-organisation patterns, not dish-composition patterns. They are represented using existing `menus` and `menu_categories`:

- `menus` for broad collections like `Drinks`, `Desserts`, `Winter Specials`
- `menu_categories` for subsections inside them
- a normal `dish` row for entries like `Daily Special`

---

#### Pattern M — Alternative matrix decomposition (sushi ingredient-first)

Instead of one template dish called `Sushi Selection`, some restaurants conceptually organise the menu as:

```
Dish: Tuna
Variants:
  Nigiri
  Sashimi
  Temaki
```

This is still the same matrix pattern. It is simply the mirror image of Pattern G:

- Pattern G: one template dish + two option groups (`Fish`, `Style`)
- Pattern M: one dish per fish + one required option group (`Style`)

Both are valid. The correct choice depends on how the restaurant actually presents the menu to the customer.

---

### 10.3 The Core Abstraction: Option Groups and Options

All composable menu patterns can be expressed with a small additive extension centered on option groups and options.

To cover the additional cases above without distorting the model, the `dishes` table also needs two lightweight presentation fields:

| Field                  | Type       | Purpose                                                     |
| ---------------------- | ---------- | ----------------------------------------------------------- |
| `dish_kind`            | TEXT CHECK | `standard`, `experience`, `template`                        |
| `display_price_prefix` | TEXT CHECK | `exact`, `from`, `per_person`, `market_price`, `ask_server` |

- `standard` = fixed plated dish or ordinary menu item
- `template` = composable dish driven by option groups (Thai main, pizza, poke bowl, sushi matrix)
- `experience` = hot pot, buffet, tasting menu, grill set, or other dining format presented as one menu item

`display_price_prefix` exists purely for honest presentation in the UI. It lets the app show `from $13`, `$24 per person`, `market price`, or `ask server` without overloading `dishes.price` semantics.

#### `option_groups`

A named group of choices that belongs to a dish (or to an entire menu category).

| Column             | Type                        | Notes                                                                              |
| ------------------ | --------------------------- | ---------------------------------------------------------------------------------- |
| `id`               | UUID PK                     |                                                                                    |
| `restaurant_id`    | UUID FK → `restaurants`     | NOT NULL — denormalized for RLS; ownership checked via `restaurants.owner_id`      |
| `dish_id`          | UUID FK → `dishes`          | Nullable — if set, applies to this dish only                                       |
| `menu_category_id` | UUID FK → `menu_categories` | Nullable — if set, applies to ALL dishes in this category (category-level add-ons) |
| `name`             | TEXT NOT NULL               | e.g. "Choose protein", "Add extras", "Marination"                                  |
| `description`      | TEXT                        | Helper text shown to the customer                                                  |
| `selection_type`   | TEXT CHECK                  | `single` (radio), `multiple` (checkbox), `quantity` (counter per option; v2 only)  |
| `min_selections`   | INTEGER DEFAULT 0           | 0 = optional group; 1 = required (must pick at least one)                          |
| `max_selections`   | INTEGER                     | NULL = unlimited; 1 = pick exactly one; N = pick up to N                           |
| `display_order`    | INTEGER DEFAULT 0           | Controls display order within a dish                                               |
| `is_active`        | BOOLEAN DEFAULT true        |                                                                                    |
| `created_at`       | TIMESTAMPTZ                 |                                                                                    |
| `updated_at`       | TIMESTAMPTZ                 |                                                                                    |

> **Exactly one of `dish_id` or `menu_category_id` must be non-null.** A DB CHECK constraint enforces this.

#### `options`

A single selectable item within an option group.

| Column                    | Type                              | Notes                                                                                      |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| `id`                      | UUID PK                           |                                                                                            |
| `option_group_id`         | UUID FK → `option_groups`         | CASCADE DELETE                                                                             |
| `name`                    | TEXT NOT NULL                     | e.g. "Chicken", "Extra egg", "Spicy sauce"                                                 |
| `description`             | TEXT                              |                                                                                            |
| `price_delta`             | NUMERIC DEFAULT 0                 | Display delta relative to `dishes.price`. Used to show `+$2`, `included`, or `-$1`.        |
| `calories_delta`          | INTEGER                           | Added to base dish calories                                                                |
| `canonical_ingredient_id` | UUID FK → `canonical_ingredients` | Optional — links this option to the ingredient system for allergen/dietary tag propagation |
| `is_available`            | BOOLEAN DEFAULT true              |                                                                                            |
| `display_order`           | INTEGER DEFAULT 0                 |                                                                                            |
| `created_at`              | TIMESTAMPTZ                       |                                                                                            |
| `updated_at`              | TIMESTAMPTZ                       |                                                                                            |

---

### 10.4 How Each Pattern Maps to the Schema

#### Pattern A — Fixed dish

No option groups. Nothing changes.

#### Pattern B — Dish + add-ons (ramen)

```
dish: "Tonkotsu Ramen" price=16
  option_group: "Add extras" (selection_type=multiple, min=0, max=null)
    option: "Extra chashu"   price_delta=+3
    option: "Soft-boiled egg" price_delta=+2
    option: "Extra nori"     price_delta=+1
    option: "Spicy sauce"    price_delta=0
```

#### Pattern C — Base + preparation (Thai)

```
dish: "Thai Main Course" price=13 display_price_prefix=from
  option_group: "Choose protein" (single, min=1, max=1, display_order=1)
    option: "Chicken"  price_delta=0
    option: "Beef"     price_delta=2
    option: "Tofu"     price_delta=0
    option: "Shrimp"   price_delta=3
  option_group: "Choose preparation" (single, min=1, max=1, display_order=2)
    option: "Green Curry"     price_delta=0
    option: "Red Curry"       price_delta=0
    option: "Pad Thai"        price_delta=0
    option: "Drunken Noodles" price_delta=0
```

#### Pattern D — Build your own (Chipotle)

```
dish: "Custom Bowl" price=12
  option_group: "Base" (single, min=1, max=1, display_order=1)
    option: "Rice"     price_delta=0
    option: "Salad"    price_delta=0
    option: "Half & Half" price_delta=0
  option_group: "Protein" (single, min=1, max=1, display_order=2)
    option: "Chicken"  price_delta=0
    option: "Steak"    price_delta=2
    option: "Tofu"     price_delta=0
  option_group: "Extras" (multiple, min=0, max=3, display_order=3)
    option: "Guacamole" price_delta=2
    option: "Cheese"    price_delta=1
    option: "Jalapeños" price_delta=0
  option_group: "Sauce" (single, min=0, max=1, display_order=4)
    option: "Hot"    price_delta=0
    option: "Medium" price_delta=0
    option: "Mild"   price_delta=0
```

#### Pattern E — Grill selection (Korean BBQ)

Each cut is a separate dish. The marination preference is a dish-level single-choice group:

```
dish: "Wagyu Ribeye 200g" price=28
  option_group: "Marination" (single, min=1, max=1)
    option: "Unmarinated" price_delta=0
    option: "Soy glaze"   price_delta=0
    option: "Spicy"       price_delta=0
```

#### Pattern F — Set / combo (teishoku)

```
dish: "Teishoku Set" price=22
  option_group: "Main course" (single, min=1, max=1, display_order=1)
    option: "Grilled salmon"    price_delta=0
    option: "Tonkatsu"          price_delta=0
    option: "Chicken karaage"   price_delta=0
  option_group: "Soup upgrade" (single, min=0, max=1, display_order=2)
    option: "Keep miso soup"    price_delta=0
    option: "Clam chowder"      price_delta=3
```

#### Pattern G — Shared ingredient matrix (sushi)

```
dish: "Sushi Selection" price=8 display_price_prefix=from
  option_group: "Fish" (single, min=1, max=1, display_order=1)
    option: "Salmon"    price_delta=0
    option: "Tuna"      price_delta=2
    option: "Yellowtail" price_delta=1
    option: "Scallop"   price_delta=4
  option_group: "Style" (single, min=1, max=1, display_order=2)
    option: "Nigiri ×2"    price_delta=0
    option: "Sashimi ×3"   price_delta=2
    option: "Hand Roll"    price_delta=0
    option: "Maki (6pc)"   price_delta=3
```

The UI can render this as two dropdowns, or as a visual grid — the underlying data is identical.

#### Pattern H — Experience dish (hot pot / fondue)

```
dish: "Hot Pot" dish_kind=experience price=25 display_price_prefix=per_person
  option_group: "Broth" (single, min=1, max=1)
    option: "Spicy"
    option: "Mushroom"
    option: "Tomato"
  option_group: "Meats" (multiple, min=0, max=null)
    option: "Beef slices"
    option: "Lamb"
    option: "Pork belly"
  option_group: "Vegetables" (multiple, min=0, max=null)
  option_group: "Noodles" (single or multiple depending on menu)
```

The user sees one prominent menu item — `Hot Pot` — with structured sections underneath. This matches how the restaurant thinks about the meal: the customer is selecting a dining experience, not one atomic plate.

#### Pattern I — Dim sum / tapas / mezze

Each item is just a normal dish:

```
dish: "Har Gow"
dish: "Siu Mai"
dish: "BBQ Pork Bun"
dish: "Chicken Feet"
```

No extra abstraction is needed.

#### Pattern J — Pizza / sandwich / burger size + toppings

```
dish: "Pizza" dish_kind=template price=12 display_price_prefix=from
  option_group: "Size" (single, min=1, max=1)
    option: "Small"  price_delta=0
    option: "Medium" price_delta=4
    option: "Large"  price_delta=7
  option_group: "Toppings" (multiple, min=0, max=null)
    option: "Pepperoni" price_delta=2
    option: "Mushrooms" price_delta=1
```

#### Pattern K — Shared side dishes

Attach to `menu_category`:

```
menu_category: "Curries"
  option_group: "Shared sides" (multiple, min=0, max=null)
    option: "Rice"    price_delta=2
    option: "Noodles" price_delta=3
    option: "Soup"    price_delta=4
```

#### Pattern L — Buffet / tasting menu / daily special / drinks / desserts / seasonal menus

- `Lunch Buffet` → one `dish` with `dish_kind=experience`, `display_price_prefix=per_person`
- `Chef Tasting Menu` → one `dish` with `dish_kind=experience`
- `Daily Special` → one `dish` with `display_price_prefix=ask_server` or exact price if known
- `Drinks`, `Desserts`, `Winter Specials` → represented by `menus` / `menu_categories`, not special schema

#### Pattern M — Sushi ingredient-first decomposition

Some restaurants want:

```
dish: "Tuna" dish_kind=template price=8 display_price_prefix=from
  option_group: "Format" (single, min=1, max=1)
    option: "Nigiri"  price_delta=0
    option: "Sashimi" price_delta=2
    option: "Temaki"  price_delta=1
```

This is also valid. The app should support both this and Pattern G because different restaurants expose the matrix from different conceptual entry points.

---

### 10.5 Category-Level Option Groups

Some add-ons apply to every dish in a category rather than a specific dish. For example:

> _"Add extra toppings to any ramen: egg, nori, chashu, bamboo shoots"_

Rather than duplicating the option group across 8 ramen dishes, attach it to the `menu_category`:

```
menu_category: "Ramen" (id = abc-123)
  option_group: "Extra toppings" (menu_category_id=abc-123, dish_id=null)
    option: "Soft-boiled egg"  +$2
    option: "Extra chashu"     +$3
    option: "Nori (3 sheets)"  +$1
    option: "Bamboo shoots"    +$1
```

The app merges category-level groups with dish-level groups when rendering the dish detail view. Dish-level groups always appear first (they are more specific); category-level groups follow.

---

### 10.6 Conditional Option Groups (v2 scope)

Some menus require a group to appear only when a specific option is selected. Example:

> _"If you choose beef, also ask: how would you like it cooked?"_

This requires a **condition** linking a child option group to a trigger option:

```sql
CREATE TABLE option_group_conditions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_option_group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  trigger_option_id     UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

When a customer selects the `trigger_option_id`, the `child_option_group_id` becomes visible. This is intentionally deferred to v2 — it adds UI complexity and covers a minority of menus. Most conditional logic can be approximated by splitting dishes (e.g., "Beef Main Course" and "Chicken Main Course" as separate dishes, each with their own specific option groups).

---

### 10.7 Price Display

EatMe is a discovery app — users browse and understand menus, they do not place orders through the app. There is no price calculation. The goal is to display prices clearly and honestly so a user understands what a dish costs before visiting the restaurant.

**Display rules:**

| Dish structure                                    | What to show in feed / list       | What to show in dish detail                                                  |
| ------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| Fixed price (Pattern A)                           | `$14`                             | `$14`                                                                        |
| Add-ons available (Pattern B)                     | `$16` (base) + `+ extras from $1` | Base price, then itemised add-on list with prices                            |
| All price in options (Pattern C, G, M)            | `from $13`                        | Each option group shown with individual prices                               |
| Build your own (Pattern D)                        | `from $12`                        | Step-by-step groups with prices per option                                   |
| Grill (Pattern E)                                 | `$28` per dish                    | Per-dish price; marination options shown as free choices                     |
| Combo (Pattern F)                                 | `$22`                             | Set price shown; upgrade options shown with `+$X` delta                      |
| Experience dish (Pattern H, buffet, tasting menu) | `$25 per person` or `$85`         | One prominent experience card with grouped selections or included components |
| Daily special / market price                      | `Ask server` or `Market price`    | Same label, optionally with description                                      |

**Key rule:** `dishes.price` always holds the best single numeric anchor for display. For template-style dishes (Thai main, sushi matrix), it should usually be the **minimum possible price** across all required option combinations. The UI prefix is controlled separately by `display_price_prefix` (`exact`, `from`, `per_person`, `market_price`, `ask_server`).

The `price_delta` on each `option` is always relative to `dishes.price` and is shown as `+$X` or `included` in the UI. Negative deltas (discounts) are shown as `-$X`.

For v1, the app does not need a general quantity engine. If a restaurant shows `200g`, `300g`, `double portion`, or similar, that should usually be modeled as separate options or separate dishes rather than as arbitrary quantity-based pricing logic.

#### Currency & Country Scoping

EatMe operates across multiple countries (US, MX, PL). Currency and restaurant filtering are handled by geographic context:

- **Country detection:** The user's current country is detected from their GPS coordinates (already implemented).
- **Currency:** Automatically set based on the detected country (e.g. Mexico → MXN, Poland → PLN, US → USD). No manual currency selection needed.
- **Restaurant scoping:** Only restaurants in the user's current country are included in feed results. A user in Mexico never sees Polish restaurants.
- **Price filter:** Uses `dishes.price` as-is. For template dishes with `display_price_prefix = 'from'`, the price filter treats `dishes.price` as the minimum. This means a `from $13` dish passes a `$10–$20` price filter.
- **Price display in feed / map:** Template dishes show `from $13` using the `display_price_prefix` field. Fixed dishes show the exact price.

---

### 10.8 Allergen & Dietary Tag Display

When `option.canonical_ingredient_id` is set, the option links directly into the ingredient system. This enables the app to surface allergen warnings on the dish detail view when an option contains an ingredient that matches the user's allergen profile.

Examples:

- Cheese add-on → links to `canonical_ingredients` "cheddar" → allergen: Milk → app shows ⚠️ Milk next to the cheese option
- Shrimp option in a Thai main → allergen: Shellfish → app highlights it for users with shellfish avoidance

The existing allergen trigger on `dish_ingredients` covers the **base dish**. Option-level allergens are surfaced informatively in the dish detail UI — they do not retroactively alter `dishes.allergens`. This is correct: a Thai main dish is not inherently a shellfish dish just because shrimp is one of the available protein choices.

---

### 10.9 Embedding Implications

When a dish uses option groups (Pattern C, D, G), the `embedding_input` must include option names so the embedding captures the full semantic range of the dish — not just the template name. The short structured format (§9.10 Decision 2) is used:

```
"Thai Main Course, thai main, chicken, beef, tofu, shrimp, green curry, red curry, pad thai, drunken noodles"
```

A sushi selection dish would include all fish and style options:

```
"Sushi Selection, sushi, salmon, tuna, yellowtail, scallop, nigiri, sashimi, hand roll, maki"
```

The construction rule: start with `{dish name}, {dish type}`, then append all `option.name` values from every active option group. This ensures cross-cuisine similarity works correctly — a Thai curry template will cluster with Indian curries, and a sushi selection will cluster with other raw fish dishes.

---

### 10.10 DB Changes Required

```sql
ALTER TABLE dishes
  ADD COLUMN dish_kind TEXT NOT NULL DEFAULT 'standard'
    CHECK (dish_kind IN ('standard', 'template', 'experience')),
  ADD COLUMN display_price_prefix TEXT NOT NULL DEFAULT 'exact'
    CHECK (display_price_prefix IN ('exact', 'from', 'per_person', 'market_price', 'ask_server'));

-- Option groups (attached to a dish OR a menu category)
CREATE TABLE option_groups (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  dish_id            UUID REFERENCES dishes(id) ON DELETE CASCADE,
  menu_category_id   UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  selection_type     TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple', 'quantity')),
  min_selections     INTEGER NOT NULL DEFAULT 0,
  max_selections     INTEGER,               -- NULL = unlimited
  display_order      INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT option_groups_owner_check CHECK (
    (dish_id IS NOT NULL AND menu_category_id IS NULL) OR
    (dish_id IS NULL AND menu_category_id IS NOT NULL)
  )
);

-- Individual options within a group
CREATE TABLE options (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id           UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  description               TEXT,
  price_delta               NUMERIC NOT NULL DEFAULT 0,
  calories_delta            INTEGER,
  canonical_ingredient_id   UUID REFERENCES canonical_ingredients(id) ON DELETE SET NULL,
  is_available              BOOLEAN NOT NULL DEFAULT true,
  display_order             INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;

-- RLS policies (ownership via denormalized restaurant_id → restaurants.owner_id)
CREATE POLICY option_groups_owner ON option_groups
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  ))
  WITH CHECK (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  ));

CREATE POLICY options_owner ON options
  USING (option_group_id IN (
    SELECT og.id FROM option_groups og
    JOIN restaurants r ON r.id = og.restaurant_id
    WHERE r.owner_id = auth.uid()
  ))
  WITH CHECK (option_group_id IN (
    SELECT og.id FROM option_groups og
    JOIN restaurants r ON r.id = og.restaurant_id
    WHERE r.owner_id = auth.uid()
  ));

-- Indexes
CREATE INDEX option_groups_restaurant_id_idx ON option_groups(restaurant_id);
CREATE INDEX option_groups_dish_id_idx ON option_groups(dish_id);
CREATE INDEX option_groups_menu_category_id_idx ON option_groups(menu_category_id);
CREATE INDEX options_option_group_id_idx ON options(option_group_id);
CREATE INDEX options_ingredient_id_idx ON options(canonical_ingredient_id);
```

**Conditional groups (v2 only):**

```sql
CREATE TABLE option_group_conditions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_option_group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  trigger_option_id     UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

The `dishes` table gains two new columns (`dish_kind`, `display_price_prefix`). No changes to `restaurants`, `menus`, or `menu_categories`.

---

### 10.11 What Stays the Same

- The `dishes` table remains the canonical menu item. Every item on a menu is a dish.
- The three-level `menu → menu_category → dish` hierarchy is unchanged.
- `dishes.price` remains the primary numeric display value, but its UI meaning is clarified by `display_price_prefix`.
- `dishes.allergens` and `dishes.dietary_tags` reflect the base dish ingredients. Option-level allergens are shown as contextual warnings in the dish detail view, not stored on the dish row.
- The feed Edge Function ranks `dishes`, not option combinations. Options are a detail-view layer — they are not part of discovery or ranking.
- Drinks, desserts, seasonal menus, and specials continue to use existing `menus` and `menu_categories`; no new menu-level abstraction is needed.
- **Options do NOT affect recommendations.** The user sees option groups when they open a dish detail view. Likes, opinions, and preference vectors are always at the dish level, never at the option-combination level.
- **Future possibility (not v1):** A “show to waiter” feature where the user pre-selects options from the menu to streamline ordering at the restaurant. This would store selected options client-side and display them as a shareable summary. It does not affect the recommendation pipeline.

---

### 10.12 Open Questions

1. **`dishes.price` as minimum vs. typical price?**  
   §10.7 recommends minimum price ("from $X") for template dishes. However, if the most common choice is always the $15 beef option, showing "from $13" (tofu) may mislead. Should the partner be able to set a `display_price` override separate from the structural base price?

   > **Decision: Use minimum price as the default.** `dishes.price` holds the lowest possible configuration price. The `display_price_prefix = 'from'` makes this honest. A separate `display_price` override is not needed for v1 — the partner sets `dishes.price` manually and can choose any value they think is most representative. If the most common choice is $15, they can set `price = 15` and use `display_price_prefix = 'from'` or `'exact'` as they see fit.

2. **How should the web portal UI handle option group setup?**  
   The restaurant partner needs a way to add option groups and options to a dish from the `DishFormDialog`. The current dialog has no concept of options. This is a significant web portal UI task.

   > **Decision: Include in the implementation plan as a dedicated web portal phase.** The `DishFormDialog` must be extended with an "Options" section that appears when `dish_kind` is `template` or `experience`. This section allows adding/removing option groups and their options with inline editing. Design details belong in the implementation plan.

3. **Should menu templates be pre-configured for common patterns?**  
   When a partner creates a new dish, the portal could offer: "What type of dish is this?" → picks from Pattern A–G → pre-populates skeleton option groups. This reduces setup friction significantly.

   > **Decision: Yes, include dish-type presets.** When a partner selects `dish_kind`, the UI offers to pre-populate skeleton option groups based on common patterns. This is a v1 nicety that significantly reduces partner setup time.

   Recommended preset list:
   - Standard dish (no options)
   - Dish with extras (one optional multiple-choice group)
   - Base + preparation (two required single-choice groups)
   - Build your own (multiple sequential groups)
   - Combo / set (one required + one optional group)
   - Sushi matrix (two required single-choice groups, grid hint)
   - Experience dish (broth + meats + vegetables groups)

4. **How should option groups be rendered in the dish detail view on mobile?**

   > **Decision: Infer render style from `selection_type` + option count.** No explicit `display_hint` field for v1. Default inference rules:
   >
   > - `single` + ≤ 5 options → chips or radio list
   > - `multiple` + short labels → chips with check state
   > - two-axis pattern (two required single-choice groups) → potential grid layout
   > - \> 8 options → grouped list / accordion
   > - experience dishes → sectioned card layout
   >
   > If this proves insufficient, a `display_hint` field can be added to `option_groups` in v2.

5. **Should options participate in the embedding input?**  
   Answered in §10.9 — yes, option names and their values should be concatenated into the `embedding_input` so that a "Thai Main Course" dish embedding captures the full range of proteins and preparations, not just the template name.

---

## Part 11 — AI Enrichment System

### 11.1 Purpose

When a restaurant partner enters a dish with minimal information (e.g. only a name like "tacos de barbacoa"), the system needs to generate a structured representation for embedding. An AI enrichment pipeline fills this gap.

### 11.2 Core Constraints

1. **AI enrichment is advisory, not authoritative.** It is used only for embeddings, search, and optionally display.
2. **AI-generated ingredients must never affect allergen or dietary tag calculation.** Only canonical ingredients added by humans (or a verified pipeline) feed into the allergen trigger. If the AI hallucinates "peanuts" in "tacos de barbacoa", that must not create a false allergen flag.
3. **Enrichment must never block the partner UX.** Dish save returns immediately; enrichment runs asynchronously.
4. **Results must be observable, auditable, and correctable.** The raw AI output is stored alongside the final `embedding_input`.

### 11.3 Architecture

```
Partner saves dish (web portal)
  → INSERT INTO dishes (returns immediately)
  → System checks completeness:
      - Has canonical ingredients via dish_ingredients? → "complete"
      - Has description but no ingredients? → "partial"
      - Has only a name? → "sparse"
  → If sparse or partial:
      → Enqueue enrichment job (Supabase Edge Function or queue)
      → enrichment_status = 'pending'
  → Enrichment worker runs asynchronously:
      → Calls gpt-4o-mini with structured output prompt
      → Stores result in enrichment_payload (JSONB)
      → Evaluates confidence (high / medium / low)
      → Generates embedding_input based on confidence level
      → Calls OpenAI /embeddings with embedding_input
      → Stores embedding vector
      → enrichment_status = 'completed'
```

> **Description handling note:** A free-form `dishes.description` can be used as an auxiliary input during the **initial enrichment step** when a dish is sparse or partial. However, the canonical `embedding_input` is still the short structured format (`name`, `dish_type`, `ingredients`, optional `cuisine`). Once those structured fields exist, later edits to `dishes.description` alone do not trigger re-embedding.

### 11.4 Model & Prompt

**Model:** `gpt-4o-mini` — small, fast, structured-output capable. Not generating prose; normalizing a dish into structured signals.

**System prompt:**

> You are a food classification system. Given a dish name (and optionally a description), output a structured JSON object with the following fields:
>
> - `dish_type` (string): the general type of dish (e.g. "taco", "ramen", "salad", "burger")
> - `ingredients` (string[]): list only highly typical, well-known ingredients for this dish. Omit uncertain or unusual ingredients. Use generic names (e.g. "beef" not "grass-fed wagyu").
> - `cuisine` (string): the most likely cuisine (e.g. "mexican", "japanese", "italian")
> - `confidence` ("high" | "medium" | "low"): how certain you are about this classification
>
> Be conservative. If unsure about an ingredient, omit it. Prefer false negatives over false positives.

**Example input:** `"tacos de barbacoa"`

**Example output:**

```json
{
  "dish_type": "taco",
  "ingredients": ["beef", "corn tortilla", "onion", "cilantro"],
  "cuisine": "mexican",
  "confidence": "high"
}
```

### 11.5 Confidence-Based Embedding Input

| Confidence | Embedding input rule                                                   |
| ---------- | ---------------------------------------------------------------------- |
| High       | Use enriched structured format: `"{name}, {dish_type}, {ingredients}"` |
| Medium     | Use enriched format but mark as inferred in `enrichment_source`        |
| Low        | Fallback to minimal: `"{dish_name}, {dish_type}"`                      |

### 11.6 DB Schema Extensions

```sql
ALTER TABLE dishes
  ADD COLUMN enrichment_status     TEXT DEFAULT 'none'
    CHECK (enrichment_status IN ('none', 'pending', 'completed', 'failed')),
  ADD COLUMN enrichment_source     TEXT DEFAULT 'none'
    CHECK (enrichment_source IN ('none', 'ai', 'manual')),
  ADD COLUMN enrichment_confidence TEXT
    CHECK (enrichment_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN enrichment_payload    JSONB,
  ADD COLUMN embedding_input       TEXT,
  ADD COLUMN embedding             vector(1536);
```

### 11.7 Human Override

Partners can always edit ingredients manually. Once a partner edits ingredients:

- `enrichment_source` becomes `'manual'`
- AI enrichment does not override manual data
- `embedding_input` is regenerated from the manual ingredients

### 11.8 Failure Handling

If enrichment fails (API timeout, model error):

- `enrichment_status` = `'failed'`
- Fallback `embedding_input` = `"{dish_name}, {dish_type}"` (or just `"{dish_name}"` if type is unknown)
- The system continues to function — the dish is discoverable, just with a less precise embedding

### 11.9 Reprocessing

Because `embedding_input` and `enrichment_payload` are both stored:

- Batch re-enrichment is safe: re-run the prompt, compare output, update if improved
- Batch re-embedding is safe: regenerate vectors from stored `embedding_input`
- This supports model/prompt upgrades without data loss

### 11.10 Cost

| Item                       | Cost                                |
| -------------------------- | ----------------------------------- |
| Enrichment per dish        | ~$0.0005 (gpt-4o-mini, ~200 tokens) |
| Embedding per dish         | ~$0.00002 (text-embedding-3-small)  |
| 10,000 dishes at launch    | ~$5.20 one-time                     |
| 100 new dishes/day ongoing | ~$0.052/day                         |

Cost is not a concern at any foreseeable scale.

---

## Part 12 — Re-Embedding Trigger Rules

### 12.1 When to Re-Generate `embedding_input` and `embedding`

The embedding must be regenerated whenever the semantic content of a dish changes. The following events trigger re-embedding:

| Event                                                               | Action                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `dishes.name` changes                                               | Regenerate `embedding_input` → re-embed                                     |
| `dish_ingredients` row inserted or deleted                          | Regenerate `embedding_input` → re-embed                                     |
| `option_groups` or `options` inserted/updated/deleted for this dish | Regenerate `embedding_input` → re-embed                                     |
| `enrichment_payload` updated (re-enrichment)                        | Regenerate `embedding_input` → re-embed                                     |
| Partner manually edits ingredients                                  | Regenerate `embedding_input` → re-embed; set `enrichment_source = 'manual'` |

### 12.2 What Does NOT Trigger Re-Embedding

| Event                         | Reason                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `dishes.price` changes        | Price is not part of the embedding input                                                        |
| `dishes.is_available` changes | Availability is a filter, not semantic content                                                  |
| `dishes.image_url` changes    | Images are not embedded (text-only)                                                             |
| `dishes.description` changes  | Description is not used in the short embedding format — only name, type, and ingredients matter |
| `option.price_delta` changes  | Price deltas are display-only, not semantic                                                     |
| `option.is_available` changes | Availability is not semantic                                                                    |

This does **not** contradict Part 11: description may assist the _initial enrichment step_ for sparse dishes, but once the canonical structured fields have been generated, description is not part of the long-term `embedding_input` contract.

### 12.3 Implementation

Re-embedding should be asynchronous, triggered by a Postgres `NOTIFY` or a database webhook that enqueues a background job. The job:

1. Reads the current dish + ingredients + options
2. Constructs the `embedding_input` string using the short structured format (§9.10)
3. Calls OpenAI `/embeddings`
4. Updates `dishes.embedding` and `dishes.embedding_input`

If the dish also has `enrichment_source = 'ai'` and the trigger was a manual ingredient change, the `enrichment_source` flips to `'manual'`.

### 12.4 Restaurant Vector Update

When any dish embedding in a restaurant changes, the restaurant's `restaurant_vector` (§9.10.4) must also be recomputed:

$$\text{restaurant\_vector} = \frac{1}{m} \sum_{j=1}^{m} \text{dish\_embedding}_j$$

This can be done lazily (batch job every N minutes) rather than synchronously per-dish update.

---

## Part 13 — User Behaviour Profile Pipeline

### 13.1 Purpose

The `user_behavior_profiles` table exists in the schema but the aggregation pipeline that populates it is not yet running. This section defines what the pipeline should do.

### 13.2 Input Signals

The pipeline aggregates three sources of signal:

| Source                   | Signal type            | Current status                                                 |
| ------------------------ | ---------------------- | -------------------------------------------------------------- |
| `user_preferences`       | Explicit preferences   | ✅ Populated during onboarding                                 |
| `user_dish_interactions` | Explicit dish opinions | ⏳ Schema exists; interaction tracking not yet wired in mobile |
| Filter usage patterns    | Implicit preferences   | ⏳ Not yet tracked                                             |

### 13.3 Pipeline Output

The pipeline computes and stores on `user_behavior_profiles`:

| Field                             | Computation                                                                 |
| --------------------------------- | --------------------------------------------------------------------------- |
| `preferred_cuisines`              | Most common cuisine types among liked dishes + explicitly selected cuisines |
| `preferred_price_range`           | Median price range of liked dishes + filter usage                           |
| `interaction_rate`                | Engagement frequency (likes per session)                                    |
| `preference_vector` (vector 1536) | Weighted average of liked dish embeddings (§9.10.3)                         |
| `preference_vector_updated_at`    | Last update timestamp                                                       |

### 13.4 When the Pipeline Runs

- **On interaction:** When a user records a new dish interaction (like, opinion), recompute `preference_vector` and update aggregates.
- **On filter save:** When a user saves permanent filter changes, update `preferred_cuisines` and `preferred_price_range`.
- **Batch fallback:** A scheduled job (e.g. daily) recomputes all stale profiles (last update > 24h ago and new interactions exist).

### 13.5 Cold Start

Until a user has enough interactions to compute a meaningful profile:

- `preference_vector` = null → feed falls back to onboarding preferences + popularity ranking
- The onboarding-seeded vector approach (§9.7 Option 1) bootstraps personalisation immediately

### 13.6 Implementation Scope

The behaviour profile pipeline should be designed and included in the implementation plan. It is not a v1 launch blocker — the feed works without it using onboarding preferences + popularity — but it is the critical path to meaningful personalisation.

---

## Part 14 — Restaurant Menu View: Context-Aware Filter Application

**Added:** March 2026

### 14.1 The Problem

EatMe operates at dish level. A restaurant may serve both dishes that match a user's hard constraints and dishes that do not. For example:

- A restaurant offers both vegetarian and non-vegetarian dishes.
- A user with a permanent `dietPreference = vegetarian` filter opens that restaurant's menu.

In the **feed**, hard filters exclude non-matching dishes entirely — the user never sees a non-vegetarian dish in the swipe deck. This is correct for discovery.

In the **restaurant detail / menu view**, the user has explicitly chosen to open this restaurant. They deserve to see its full offering — but non-matching dishes should be clearly de-emphasised so the user isn't confused about what they can order.

### 14.2 Design Decision: Grey-out + Reorder (not hide)

**Decision:** In the restaurant menu view, dishes that fail the user's **permanent hard filters** are:

1. Rendered at **reduced opacity** (0.35) with a small "Not for you" pill label.
2. **Sorted to the end** of their menu category section, after all matching dishes.
3. **Never hidden** — the user may still tap them to read details (e.g. to order for a companion).

**Rationale:**
- Hiding dishes would make it look like the restaurant has a smaller menu than it does.
- The user consciously opened this restaurant — they have agency.
- A companion at the table may not share the user's restrictions.
- De-emphasising (not hiding) is the minimum-surprise approach.

**Which hard filters apply to greying-out:**

| Filter | Greyed out if... |
|---|---|
| `dietPreference = vegetarian` | dish lacks `vegetarian` or `vegan` dietary tag |
| `dietPreference = vegan` | dish lacks `vegan` dietary tag |
| `allergies` (any active) | dish's `allergens` array contains the active allergen code |
| `religiousRestrictions` (any active) | dish's `dietary_tags` array is missing the required tag |

**Soft filters (price, spice, cuisine) are NOT applied** — they only affect feed ranking, never menu view appearance.

### 14.3 Ingredient Flagging in the Menu View

For `ingredients_to_avoid` entries:

- Dishes containing one or more of the user's avoided ingredients show a **warning line** beneath the dish name: `⚠️ Contains: Peanuts, Sesame`.
- The dish is **NOT greyed out** and is **NOT moved** — this is a soft preference, not a hard constraint.
- Matching is done against `dish_ingredients.canonical_ingredient_id`.
- Display names come from the stored `IngredientToAvoid.displayName` in the filterStore (already pre-resolved at the time the user added the ingredient to their avoid list).

**Why not grey out avoided-ingredient dishes?**
The first-principles decision (Part 8 Q14) is that `ingredients_to_avoid` is always a soft warning. Users with true safety-critical intolerances should use `allergies` (which is a hard constraint, does apply greying). The distinction: allergies = medical safety, ingredients_to_avoid = personal preference.

### 14.4 Data Requirements

For this feature to work, the restaurant detail screen needs:

1. **User's permanent hard filters** — already in `filterStore.permanent` (Zustand, available anywhere).
2. **`dish.allergens`** — already included in the `*` select on `dishes`.
3. **`dish.dietary_tags`** — already included in the `*` select on `dishes`.
4. **`dish.dish_ingredients` with `ingredient_id`** — needs to be added to the existing Supabase query (currently not fetched).
5. **`filterStore.permanent.ingredientsToAvoid`** — array of `{ canonicalIngredientId, displayName }` already in the filterStore.

No new migrations, no new backend endpoints, no schema changes required.

### 14.5 Allergen Code Mapping

The filterStore `permanent.allergies` uses boolean keys (`soy`, `nuts`, etc.) which map to DB allergen codes via `ALLERGY_TO_DB` in `userPreferencesService.ts`. The menu view must apply the same mapping when comparing against `dish.allergens`.

```
filterStore key → DB allergen code
  lactose       → 'lactose'
  gluten        → 'gluten'
  peanuts       → 'peanuts'
  soy           → 'soybeans'
  sesame        → 'sesame'
  shellfish     → 'shellfish'
  nuts          → 'tree_nuts'
```

### 14.6 Implementation Location

- **Screen:** `apps/mobile/src/screens/RestaurantDetailScreen.tsx`
- **New utility:** `apps/mobile/src/utils/menuFilterUtils.ts` — `classifyDish(dish, permanentFilters)` returns `{ passesHardFilters: boolean, flaggedIngredientNames: string[] }`
- **No backend changes** required.
- **No new Supabase query** — only add `dish_ingredients(ingredient_id)` to the existing `dishes(*)` select.

---

_This document should be treated as a living design artefact. All challenge questions in Part 8 have been answered. The next step is to produce a concrete implementation plan with phases, migrations, and task breakdowns._

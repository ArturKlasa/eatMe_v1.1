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

| Tier                  | Scope        | Storage                                                        | Purpose                                                           |
| --------------------- | ------------ | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Daily filters**     | Session only | Zustand (in-memory)                                            | Quick mood-based choices for the current discovery session        |
| **Permanent filters** | Profile      | Supabase `user_preferences` table + synced to Zustand on login | Hard dietary constraints (allergies, diet type) that always apply |

Both tiers live in a single Zustand store: `apps/mobile/src/stores/filterStore.ts` (~1095 lines).

### 5.2 Daily Filter Fields

Managed in `filterStore` as transient in-memory state. Reset on demand via `filterStore.resetDailyFilters()`.

| Field            | Type                                         | Default                |
| ---------------- | -------------------------------------------- | ---------------------- |
| `priceRange`     | `{ min: number, max: number }`               | `{ min: 0, max: 100 }` |
| `cuisineTypes`   | `string[]`                                   | `[]` (all cuisines)    |
| `meals`          | `string[]`                                   | `[]`                   |
| `dietPreference` | `'all' \| 'vegetarian' \| 'vegan'`           | `'all'`                |
| `proteinTypes`   | `{ meat, fish, seafood, egg }`               | all false              |
| `meatTypes`      | `{ chicken, beef, pork, lamb, duck, other }` | all false              |
| `spiceLevel`     | `'noSpicy' \| 'eitherWay' \| 'iLikeSpicy'`   | `'eitherWay'`          |
| `hungerLevel`    | `'diet' \| 'normal' \| 'starving'`           | `'normal'`             |
| `calorieRange`   | `{ min, max, enabled }`                      | disabled               |
| `maxDistance`    | `number` (km)                                | `10`                   |
| `openNow`        | `boolean`                                    | `false`                |
| `sortBy`         | `'closest' \| 'bestMatch' \| 'highestRated'` | `'bestMatch'`          |

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

This is the persisted representation of permanent filters.

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

Filters operate in two different places depending on the screen:

| Screen       | Method                                       | Engine                          | Status                      |
| ------------ | -------------------------------------------- | ------------------------------- | --------------------------- |
| Map screen   | `filterService.applyFilters()` + `getFeed()` | Client-side JS + Edge Function  | ✅ Active                   |
| Swipe screen | `getFeed()` Edge Function                    | Server-side (Deno + PostgreSQL) | ⚠️ Shelved (March 13, 2026) |

**Client-side filter pipeline (map screen):**

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

1. Load user interaction history (liked/disliked dish IDs + cuisine preferences)
2. Find nearby restaurants via PostGIS RPC restaurants_within_radius()
   └─ Fallback: JS Haversine if PostGIS RPC unavailable
3. Fetch dishes from nearby restaurants (with analytics + dish_ingredients)
4. Hard filters applied in sequence:
   a. Exclude previously disliked dishes
   b. Price range (open-ended at slider extremes)
   c. Diet preference (HARD from permanent filters — excludes non-matching dishes)
   d. Calorie range (if enabled)
   e. Allergen exclusion (any dish with a user allergen is removed)
   f. Ingredient flagging (ingredients_to_avoid → annotate dish, do NOT exclude)
5. Score + rank via calculateScore()
6. Apply diversity cap (max 3 dishes per restaurant in results)
7. Return top N dishes (default 20) + metadata
```

### 5.6 Scoring Algorithm

`calculateScore(dish, filters, distance_km, userId, userLikes, userLikedCuisines)`

| Signal                              | Max points | Type                                  |
| ----------------------------------- | ---------- | ------------------------------------- |
| Base score                          | 50         | Always                                |
| Restaurant rating (0–5 → 0–20 pts)  | 20         | Objective                             |
| Dish popularity score               | 15         | Objective                             |
| Distance (closer = more points)     | 15         | Contextual                            |
| Has image                           | 5          | Content quality                       |
| Has description (>20 chars)         | 3          | Content quality                       |
| Calorie range proximity             | 5          | Daily filter                          |
| Daily diet preference boost         | 30         | Daily filter (soft, not exclusion)    |
| Cuisine preference boost            | 40         | Daily filter (soft, not exclusion)    |
| User liked same cuisine before      | 20         | Personalisation                       |
| Same restaurant as previously liked | up to 15   | Personalisation (not yet implemented) |

**Why this approach was taken:**

- The two-tier filter model (daily vs permanent) arose from the product insight that users have a constant identity (allergies, core diet) but a changing mood (today I want spicy food, tomorrow something light). Mixing these caused UX confusion when users changed daily choices and accidentally lost their hard dietary constraints.
- Client-side filtering on the map was the first approach — it was fast to implement and works well for a small dataset. It became a known bottleneck (documented in `EDGE_FUNCTIONS_ARCHITECTURE.md`) as dish count grows, which is why the feed Edge Function was introduced for the dish view.
- The `ingredients_to_avoid` flag (migration 046) was deliberately chosen as a **soft warning** (not a hard exclusion) because ingredient presence in a dish is probabilistic — the ingredient might be used in a sauce at trace amounts, or might be easy to request "without". The user is informed, not blocked.

---

## Part 6 — Current Recommendation Workflow

### 6.1 Data Captured About User Behaviour

Three tables form the input to the recommendation system:

**`user_swipes`** — event log for recording dish-level like/pass/super interactions. Schema exists in the DB; not yet populated by the current app.

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

**`user_dish_interactions`** — higher-level interaction log (viewed, liked, disliked, saved, ordered).

**`user_behavior_profiles`** — aggregated behavioural profile (preferred cuisines, price range, interaction rate). Schema exists; aggregation pipeline not yet running.

**`dish_analytics`** — population-level engagement metrics per dish.

| Column              | Type        | Notes                     |
| ------------------- | ----------- | ------------------------- |
| `dish_id`           | UUID PK     |                           |
| `view_count`        | INTEGER     |                           |
| `right_swipe_count` | INTEGER     |                           |
| `left_swipe_count`  | INTEGER     |                           |
| `super_like_count`  | INTEGER     |                           |
| `favorite_count`    | INTEGER     |                           |
| `order_count`       | INTEGER     |                           |
| `engagement_rate`   | FLOAT       | Computed field            |
| `popularity_score`  | FLOAT       | Normalised popularity 0–1 |
| `is_trending`       | BOOLEAN     |                           |
| `last_updated_at`   | TIMESTAMPTZ |                           |

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
  2. Load user's interaction history from user_dish_interactions
     → userLikes[], userDislikes[], userLikedCuisines[]
  3. Find nearby restaurants
     → PRIMARY: restaurants_within_radius() PostGIS RPC
     → FALLBACK: fetch all restaurants, apply Haversine in JS
  4. Fetch available dishes for those restaurant IDs
     (joined with restaurant info + dish_analytics + dish_ingredients)
  5. Hard exclusion filters (in order):
     a. Remove previously disliked dishes
     b. Price range filter
     c. Diet preference (vegetarian/vegan) — HARD exclusion from permanent filters
     d. Calorie range (if enabled)
     e. Allergen exclusion
     f. Ingredient flag annotation (soft — annotate only)
  6. Score each remaining dish via calculateScore()
  7. Sort by score descending
  8. Apply diversity cap (max 3 dishes per restaurant)
  9. Return top 20 (or configured limit)
  10. Cache result in Redis (if configured)

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
    → Scores each restaurant for group compatibility:
        → How many members' dietary constraints are satisfied
        → Distance from each member
        → Cuisine overlap across member preferences
    → Returns ranked restaurant list stored in eat_together_recommendations
  → Members vote on suggested restaurants
  → Winning restaurant stored in eat_together_sessions.selected_restaurant_id
```

---

## Part 7 — Why This Approach Was Taken (Summary)

| Decision                                       | Rationale                                                                                            | Trade-off                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| JSONB location + computed PostGIS column       | Avoid breaking migration of existing data; JSONB is flexible for the portal form                     | Redundancy; two representations of the same thing                                        |
| cuisine_types as TEXT[]                        | Restaurants serve 2–5 cuisines; join table would add complexity with little benefit at current scale | Hard to query cuisines independently; no cuisine master table                            |
| Canonical ingredient system with aliases       | Normalises multilingual ingredient entry; ensures allergen calculation is consistent                 | Complex — two parallel ingredient systems (master + canonical) coexist                   |
| Allergen auto-calculation via Postgres trigger | Single source of truth; no application code can skip it; consistent across all write paths           | Trigger silently fails if not tested — `dishes.allergens` can be stale if trigger breaks |
| Legacy `ingredients` TEXT[] column on dishes   | Migration artefact — was the original approach before the canonical system                           | Dual representation; unclear which is authoritative                                      |
| Daily vs permanent filter two-tier model       | Separates identity (allergies, diet) from mood (today's cravings); prevents accidental override      | Two separate UIs + storage paths to maintain                                             |
| Client-side filtering on map screen            | Fast to implement; works well for small datasets                                                     | Does not scale beyond ~1000 restaurants; wastes bandwidth                                |
| Feed Edge Function for dish discovery          | Scalable; keeps ranking algorithm private; enables personalisation from user history                 | Two filter codebases (client + server) must stay in sync; adds ~200ms latency            |
| Score-based ranking with hard+soft filters     | Hard exclusions (allergens) ensure safety; soft boosts (cuisine preference) preserve discovery       | Score weights are manually tuned magic numbers — no ML training loop                     |
| `user_behavior_profiles` aggregated table      | Avoids re-scanning the raw interaction log on every feed request                                     | Aggregation pipeline not yet running — profile is currently empty                        |
| 5-minute Redis cache on feed results           | Reduces DB load for users in the same area with similar filters                                      | Cache key includes userId + exact coordinates — personalised feeds are rarely cached     |
| Three-level hierarchy: menu → category → dish  | Mirrors real restaurant menu structure; gives partners control over dish grouping                    | The web portal UI doesn't always surface category management clearly                     |

---

## Part 8 — First Principles Challenge Questions

The following questions are starting points for the review — they are intentionally provocative, not conclusions. Each should be answered before committing to the current structure.

### On the Data Model

1. **Do we need both `menus` and `menu_categories`?**  
   A restaurant has a "Dinner" menu with "Starters" and "Mains" sections. Is this genuinely a two-level concept for our use case, or could a single `menu_sections` table with an optional `parent_id` serve both the flat and nested case?

2. **Is `dish_category` (global taxonomy) the right abstraction for dish discovery?**  
   The global `dish_categories` table (Burger, Salad, Sushi) exists but is not currently used in filtering or recommendation. Is this the right unit for user preference learning, or should we learn from cuisine types and ingredient families instead?

3. **Should `spice_level` be an integer or a named enum?**  
   The current 0/1/3 scheme (migration 041b) maps to none/mild/hot. The gap at 2 exists because the original 0–4 range was consolidated. A proper enum (`none`, `mild`, `hot`) would be cleaner and self-documenting.

4. **Is the legacy `ingredients` TEXT[] column on `dishes` still needed?**  
   If `dish_ingredients` + the canonical system are the live path, the `ingredients` column is dead weight and a source of confusion. When should it be dropped?

5. **Do we need both `ingredients_master` and `canonical_ingredients`?**  
   The `ingredients_master` table is unused in active workflows. It adds schema complexity and may mislead future developers. When should it be removed?

6. **Is the JSONB boolean-map structure of `user_preferences.allergies` the right model?**  
   `{ "soy": false, "nuts": true, "gluten": false }` is a fixed schema baked into the application code. Adding a new allergen requires a code change. An array of allergen codes (TEXT[]) would be schema-free and more consistent with how `dishes.allergens` is stored.

7. **Should `user_preferences` map more directly to the filter store fields?**  
   The `user_preferences` table has more fields than `filterStore` syncs (e.g. `spice_tolerance`, `diet_types`, `religious_restrictions`, `dining_occasions` are stored but not fully wired). Is this intentional for future use, or is it creating false expectations?

### On the Filter System

8. **Is a two-tier filter the right mental model for users?**  
   The daily vs permanent distinction requires users to understand the difference. Most food apps (Uber Eats, Deliveroo) use a single flat filter. What evidence do we have that two tiers improve the experience vs add cognitive load?

9. **Should cuisine preference be a filter or a pure recommendation signal?**  
   Cuisine type is currently exposed as both a filter (daily: hard exclusion option) and a recommendation boost in the scoring function. This creates inconsistency: selecting "Italian" in filters on the map shows only Italian; in the feed Edge Function, it boosts Italian without hiding others. Is this intentional?

10. **Should `hungerLevel` and `meals` affect what dishes are shown, or only how they are ranked?**  
    These daily filter fields exist in the store but do not appear to be wired into `filterService` or the Edge Function. Are they cosmetic placeholders, or should they drive filtering/scoring?

11. **Is client-side filtering on the map worth maintaining long-term?**  
    The feed Edge Function already handles server-side filtering for dish discovery. Should the map restaurant list also migrate to server-side filtering to eliminate the dual filter codebases?

### On the Recommendation System

12. **What problem does the recommendation engine actually solve right now?**  
    The system has a `user_swipes` schema, a behaviour profile table, and a scoring function — but no data is flowing into them yet. The current personalisation reads only the last N `user_dish_interactions`. At what point does personalisation meaningfully differ from "show popular dishes nearby"?

13. **Is score-based ranking the right mechanism, or should we think in terms of candidate generation + ranking stages?**  
    Large-scale recommendation systems (Netflix, TikTok) use a two-stage pipeline: a fast candidate generator (PostGIS + simple filters → 200 candidates) followed by a separate ranking model. Our current approach combines both in one place. Is this a problem at our expected scale?

14. **Should the `ingredients_to_avoid` field drive soft warnings or be available as a hard filter too?**  
    Currently `ingredients_to_avoid` only annotates (flags) dishes — it never excludes them. Some users with serious intolerances (not anaphylactic allergies, but strong preferences) may want hard exclusion. Should this be user-configurable per ingredient?

15. **How does "Eat Together" group recommendation interact with individual personalisation?**  
    The group recommendation scores compatibility across all members' preferences. If one member has a hard allergen constraint, does that restaurant get removed from the group list? The current implementation uses member preferences for scoring but the hard exclusion logic is not yet verified in the group context.

---

_This document should be treated as a living review artefact. Each challenge question above should be answered before the next major development sprint, even if the answer is "the current approach is correct because..."._

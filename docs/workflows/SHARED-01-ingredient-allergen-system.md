# SHARED-01 — Ingredient & Allergen System

## Overview

The ingredient system allows restaurant partners to associate dishes with canonical ingredients. When ingredients are linked to a dish, **Postgres triggers automatically calculate allergens and dietary tags** on the dish row. This means the mobile app never needs to compute allergens client-side — it reads the pre-calculated values directly from the `dishes` table.

---

## Key Files

| File                                                                   | Role                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web-portal/lib/ingredients.ts`                                   | API layer: ingredient search, linking ingredients to dishes |
| `apps/web-portal/components/IngredientAutocomplete.tsx`                | Searchable multi-select ingredient picker UI                |
| `apps/web-portal/components/AllergenWarnings.tsx`                      | Displays allergen warning icons (⚠️) for a dish             |
| `apps/web-portal/components/DietaryTagBadges.tsx`                      | Displays dietary tag badges (🌱 Vegetarian, 🌿 Vegan)       |
| `infra/supabase/migrations/010_create_ingredients_master_tables.sql`   | Initial ingredient tables                                   |
| `infra/supabase/migrations/012_create_canonical_ingredient_system.sql` | Canonical ingredient architecture                           |
| `infra/supabase/migrations/013_add_comprehensive_ingredients.sql`      | Seed data: initial ingredient library                       |
| `infra/supabase/migrations/029_add_ingredient_family_name.sql`         | Adds `ingredient_family_name` to canonical ingredients      |
| `infra/supabase/migrations/035–040`                                    | Multilingual aliases (Spanish, Polish, Latin American)      |

---

## Database Schema

### `canonical_ingredients`

The master list of ingredients. Each row is a unique real-world ingredient.

```sql
canonical_ingredients
  id                    UUID PK
  canonical_name        TEXT UNIQUE    -- e.g. "whole milk", "wheat flour"
  ingredient_family_name TEXT          -- e.g. "dairy", "grain"
  is_vegetarian         BOOLEAN
  is_vegan              BOOLEAN
  created_at            TIMESTAMP
```

### `ingredient_aliases`

Multiple display names per canonical ingredient, supporting multilingual search.

```sql
ingredient_aliases
  id                       UUID PK
  canonical_ingredient_id  UUID FK → canonical_ingredients.id
  display_name             TEXT       -- e.g. "milk", "leche", "mleko"
  language                 TEXT       -- 'en', 'es', 'pl'
  created_at               TIMESTAMP
```

### `allergens`

Lookup table of EU/global allergen categories.

```sql
allergens
  id    UUID PK
  code  TEXT    -- e.g. 'MILK', 'GLUTEN', 'NUTS'
  name  TEXT    -- 'Milk', 'Gluten-containing cereals', ...
  icon  TEXT    -- emoji or icon identifier
```

### `dietary_tags`

Lookup table of dietary classifications.

```sql
dietary_tags
  id       UUID PK
  code     TEXT    -- 'VEGETARIAN', 'VEGAN'
  name     TEXT
  icon     TEXT
  category TEXT
```

### `ingredient_allergens` (junction)

Maps canonical ingredients to allergens they contain.

### `dish_ingredients` (junction)

Links a dish to its canonical ingredients.

```sql
dish_ingredients
  dish_id                 UUID FK → dishes.id
  canonical_ingredient_id UUID FK → canonical_ingredients.id
  quantity                TEXT (optional)
```

---

## How Allergens Are Calculated

When a row is inserted into `dish_ingredients`, a Postgres trigger fires:

```
INSERT INTO dish_ingredients (dish_id, canonical_ingredient_id)
  → TRIGGER: update_dish_allergens_and_tags()
    → Queries: SELECT allergens linked to all canonical_ingredients for this dish
    → Queries: Is every ingredient vegetarian? Is every ingredient vegan?
    → UPDATE dishes SET
        allergens     = [...allergen codes...],   -- JSONB array
        dietary_tags  = [...tag codes...]          -- JSONB array
      WHERE id = NEW.dish_id
```

This means `dishes.allergens` and `dishes.dietary_tags` are always derived values — they are **never manually set by the application code**. The trigger keeps them in sync whenever ingredients change.

---

## Web Portal Workflow

### 1. Ingredient Search

`IngredientAutocomplete` performs a live search as the user types:

```typescript
searchIngredients(query, limit = 10)
  → supabase.from('ingredient_aliases')
      .select('id, display_name, canonical_ingredient_id, canonical_ingredient:canonical_ingredients(...)')
      .ilike('display_name', `%${query}%`)
  → Returns flat Ingredient[] with nested canonical data merged in
```

Results show the display name (alias) — e.g., "Milk" or "Leche" — while tracking the `canonical_ingredient_id` under the hood.

### 2. Selecting Ingredients

When the user picks an ingredient from the autocomplete dropdown, it is added to the dish's `ingredients` array (stored in form state). The component shows allergen warnings and dietary tags in real time by reading from the canonical ingredient's `is_vegetarian` / `is_vegan` flags and allergen mappings.

### 3. Linking on Save

When a dish is saved, `addDishIngredients(dishId, ingredientAliasIds)` is called:

```typescript
addDishIngredients(dishId, aliasIds)
  → For each aliasId:
    → SELECT canonical_ingredient_id FROM ingredient_aliases WHERE id = aliasId
    → INSERT INTO dish_ingredients (dish_id, canonical_ingredient_id)
  → Postgres trigger fires automatically after each INSERT
  → dishes.allergens and dishes.dietary_tags updated automatically
```

---

## Mobile App Read-Side

The mobile app simply reads `dishes.allergens` and `dishes.dietary_tags` (pre-calculated JSONB arrays) from the `dishes` table. No client-side computation is needed.

In `RestaurantDetailScreen`, dish cards display:

- Allergen icons from `dish.allergens`
- Dietary tag badges from `dish.dietary_tags`

---

## Multilingual Support

The alias system supports search in multiple languages. Aliases in different languages all point to the same `canonical_ingredient`. Migrations 035–040 add Spanish (es), Polish (pl), and Latin American Spanish aliases to the existing English (en) aliases.

When a restaurant partner searches for "leche", the Spanish alias maps to the same canonical ingredient as "milk", ensuring consistent allergen calculation regardless of the language used during data entry.

---

## Adding New Ingredients

New canonical ingredients are added by **admins only** via the admin panel (`/admin/ingredients`). Restaurant partners cannot create new canonical ingredients — they can only select from the existing library.

For batch additions, the `ingredient_aliases.csv` file in `infra/supabase/migrations/` can be used as a seed template.

---

## Known Gaps

- `addDishIngredients` is called in the menu page (`onboard/menu`) during in-page dish editing, but the final review/submit page (`onboard/review`) does not call it when it re-inserts dishes. Ingredients linked during menu-building may be lost on final submission. This needs to be verified and fixed.
- Ingredient search uses `ILIKE` (case-insensitive substring match). For large ingredient libraries, a full-text search index (`tsvector`) would be more performant.

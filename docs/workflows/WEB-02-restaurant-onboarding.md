# WEB-02 — Restaurant Onboarding (Multi-Step Wizard)

## Overview

New restaurant partners fill out a 3-step wizard to register their restaurant on the platform. Each step auto-saves to **localStorage** so progress is not lost if the user navigates away or the browser closes. The final step submits everything to Supabase in one operation.

---

## Key Files

| File                                                    | Role                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web-portal/app/onboard/page.tsx`                  | Landing/redirect page for the onboarding section                              |
| `apps/web-portal/app/onboard/basic-info/page.tsx`       | Step 1 — restaurant name, address, location, hours, services (~988 lines)     |
| `apps/web-portal/app/onboard/menu/page.tsx`             | Step 2 — create menus, add dishes with ingredients                            |
| `apps/web-portal/app/onboard/review/page.tsx`           | Step 3 — review all data, submit to Supabase                                  |
| `apps/web-portal/lib/storage.ts`                        | localStorage read/write helpers, keyed by `eatme_draft_{userId}`              |
| `apps/web-portal/lib/supabase.ts`                       | Supabase client + `formatLocationForSupabase()` helper                        |
| `apps/web-portal/lib/validation.ts`                     | Zod schemas for `basicInfoSchema`, `dishSchema`, `menuSchema`                 |
| `apps/web-portal/lib/ingredients.ts`                    | Ingredient search + `addDishIngredients()` for linking ingredients to dishes  |
| `apps/web-portal/components/forms/DishFormDialog.tsx`   | Dialog for creating/editing a single dish                                     |
| `apps/web-portal/components/forms/DishCard.tsx`         | Card display of a dish within a menu                                          |
| `apps/web-portal/components/IngredientAutocomplete.tsx` | Searchable ingredient picker using `ingredients_master`                       |
| `apps/web-portal/components/LocationPicker.tsx`         | Mapbox GL JS map for pin-drop location selection                              |
| `apps/web-portal/types/restaurant.ts`                   | TypeScript types: `Dish`, `Menu`, `FormProgress`, `RestaurantBasicInfo`, etc. |

---

## Step 1 — Basic Info (`/onboard/basic-info`)

### What the user fills in

- **Restaurant name** and **type** (restaurant, café, food truck, etc.)
- **Description**
- **Country**, city, neighbourhood, state, postal code
- **Address** (text field) + **location pin** on Mapbox map
- **Phone** and **website**
- **Cuisine types** (multi-select from a list of 40+ cuisines)
- **Operating hours** per day of week (open/close times + closed toggle)
- **Service options**: delivery, takeout, dine-in, reservations, service speed

### Data flow

```
User types in form
  → React Hook Form tracks field values
  → On any change: saveRestaurantData(userId, formData) written to localStorage
  → LocationPicker emits { lat, lng } on pin drop
    → stored in mapCoordinates state + synced to form values + localStorage
  → User clicks "Continue to Menu →"
    → Basic validation (name, address, location required)
    → saveRestaurantData(userId, { basicInfo, operations })
    → router.push('/onboard/menu')
```

### localStorage structure (key: `eatme_draft_{userId}`)

```json
{
  "basicInfo": {
    "name": "My Restaurant",
    "restaurant_type": "cafe",
    "description": "...",
    "country": "US",
    "city": "New York",
    "address": "123 Main St",
    "location": { "lat": 40.71, "lng": -74.0 },
    "phone": "+1...",
    "website": "https://...",
    "cuisines": ["Italian", "Pizza"]
  },
  "operations": {
    "operating_hours": {
      "monday": { "open": "09:00", "close": "21:00", "closed": false }
    },
    "delivery_available": true,
    "takeout_available": true,
    "dine_in_available": true,
    "accepts_reservations": false,
    "service_speed": "regular"
  },
  "lastSaved": "2026-03-01T10:00:00Z"
}
```

### Location picker

`LocationPicker` is dynamically imported (SSR disabled) since it uses Mapbox GL JS which requires the browser. The user clicks the map or enters an address to place a pin. The component emits coordinates and optionally parsed address fields via `ParsedLocationDetails`.

---

## Step 2 — Menu Builder (`/onboard/menu`)

### What the user does

1. Creates one or more **menus** (e.g. "Breakfast", "Dinner") with a name and type (food/drink).
2. Within each menu, adds **dishes** using the `DishFormDialog`.
3. Dishes include: name, description, price, calories, spice level, dietary tags, allergens, ingredient selection, and visibility settings.

### Data loading on mount

The menu page first tries to load from the **database** (if the restaurant already exists for this user). If nothing is found in the database, it falls back to **localStorage**. This handles both: new users drafting, and returning users who have already submitted.

### DishFormDialog

A modal dialog for creating or editing a dish. It contains:

- Basic fields (name, description, price, calories, spice level)
- Dietary tags multi-select
- Allergen multi-select
- `IngredientAutocomplete` — searches `ingredient_aliases` table; selected ingredients are stored in the dish's `ingredients` array

### Saving

Every change (add dish, edit dish, add menu) calls `saveRestaurantData(userId, { menus, dishes })` to persist the current state. The user can safely close the browser and return later.

```
User adds a dish → dialog closes
  → menus state updated
  → saveRestaurantData(userId, { basicInfo (from load), menus })
  → User clicks "Review & Submit →"
  → router.push('/onboard/review')
```

---

## Step 3 — Review & Submit (`/onboard/review`)

### What the user sees

A read-only summary of all data:

- Restaurant information (name, address, hours, cuisines)
- Each menu with its dishes

Edit buttons navigate back to Step 1 or Step 2.

### Submission flow

```
User clicks "Submit"
  → Validation: name, address, location, cuisines all present
  → Step 1: Check if restaurant already exists (by owner_id)
    → If YES: UPDATE restaurants SET ... WHERE id = existing
              DELETE all existing menus (dishes cascade-deleted)
    → If NO:  INSERT INTO restaurants (...)
  → Step 2: For each menu:
    → INSERT INTO menus (restaurant_id, name, ...)
    → INSERT INTO dishes (restaurant_id, menu_id, ...) — batch per menu
  → On success:
    → toast.success("Restaurant created!")
    → localStorage.removeItem(`eatme_draft_${userId}`)
    → setTimeout 2s → router.push('/')
  → On any error:
    → toast.error(errorMessage)
    → isSubmitting = false (user can retry)
```

### Location formatting

Before inserting, `formatLocationForSupabase(lat, lng)` converts `{ lat, lng }` to a JSONB `{ lat, lng }` object (the current schema uses JSONB, not PostGIS POINT). The helper in `lib/supabase.ts` supports both formats.

### Operating hours formatting

`formatOperatingHours()` (in `lib/supabase.ts`) strips out days marked as `closed: true`, producing only the open days object that the database expects.

---

## Resume / Draft Behaviour

- On any page load, if `loadRestaurantData(userId)` returns data, the form is pre-populated.
- If the user already has a submitted restaurant in the DB, that data is loaded instead of the draft.
- Draft is cleared only after a successful submission.

> ⚠️ **Known Gap**: Stale drafts (e.g., abandoned 30 days ago) are never cleaned up. See improvement item A7 in `CODEBASE_IMPROVEMENTS.md`.

---

## Ingredient Linking

After dishes are inserted, `addDishIngredients(dishId, ingredients)` in `lib/ingredients.ts` inserts rows into `dish_ingredients`, linking each dish to canonical ingredients. A **Postgres trigger** then fires to auto-calculate `allergens` and `dietary_tags` on the `dishes` row. See [SHARED-01-ingredient-allergen-system.md](SHARED-01-ingredient-allergen-system.md) for details.

> ⚠️ **Known Gap**: `addDishIngredients` is called in `menu/page.tsx` but the review/submit page also inserts dishes without calling it. Ingredients linked during menu building may need to be re-linked after submission. This flow needs a full audit.

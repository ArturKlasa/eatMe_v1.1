# WEB-03 — Restaurant Management (Edit Existing Restaurant)

## Overview

Once a restaurant has been submitted, the partner can return to the dashboard and edit their restaurant's details or manage their menu. This is separate from the initial onboarding wizard — it operates directly against the database without using localStorage drafts.

---

## Key Files

| File                                           | Role                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/web-portal/app/page.tsx`                 | Dashboard — entry point; shows restaurant status and navigation links                |
| `apps/web-portal/app/restaurant/edit/page.tsx` | Edit restaurant details: name, description, address, phone, website, operating hours |
| `apps/web-portal/app/menu/manage/page.tsx`     | Menu management: add/edit/delete menus and dishes                                    |

---

## Dashboard (`/`)

The dashboard is the home page for authenticated restaurant partners. On mount it fetches:

```
supabase
  .from('restaurants')
  .select('*, menus(*, dishes(*))')
  .eq('owner_id', user.id)
  .maybeSingle()
```

### States the dashboard handles

| State                             | What is shown                                                       |
| --------------------------------- | ------------------------------------------------------------------- |
| Loading                           | Spinner                                                             |
| No restaurant in DB, no draft     | "Get started" CTA → `/onboard/basic-info`                           |
| No restaurant in DB, draft exists | "Continue your draft" banner + draft summary                        |
| Restaurant exists in DB           | Full dashboard with stats (menu count, dish count) and action cards |

### Action cards on the dashboard

- **Restaurant Information** → `/restaurant/edit` (edit name, hours, etc.)
- **Manage Menu** → `/menu/manage` (add/edit/delete dishes)
- **Preview Profile** → future feature
- **Export Data** → triggers CSV/JSON download via `lib/export.ts`

---

## Edit Restaurant Details (`/restaurant/edit`)

Allows the partner to update: name, description, address, phone, website, and operating hours. Location/coordinates are **not** editable here (a separate map interaction would be needed — currently not implemented).

### Data flow

```
Page mounts
  → supabase.from('restaurants').select('*').eq('owner_id', user.id).single()
  → Pre-populates React Hook Form with existing values
  → User edits fields
  → Clicks "Save Changes"
    → handleSubmit() called
    → Validates with React Hook Form rules
    → supabase.from('restaurants').update({ name, description, ... }).eq('id', restaurantId)
    → toast.success('Restaurant updated')
    → router.push('/')
```

### Operating hours editing

Operating hours have their own state object (separate from the RHF-managed fields) because of their nested structure. `handleHoursChange(day, field, value)` updates the state. On submit, the hours object is included in the Supabase update payload.

---

## Manage Menu (`/menu/manage`)

> **Note**: As of March 2026 this page exists but its exact implementation may share logic with the onboarding menu page. The same `DishFormDialog` and `DishCard` components are used.

The page allows partners to:

1. Add new menus
2. Edit existing menu names/types
3. Delete menus (and their dishes, via CASCADE)
4. Add, edit, or delete individual dishes within a menu

### ⚠️ Current Limitations

- Editing a dish's ingredients after initial submission is not fully wired — ingredient-to-dish links in `dish_ingredients` may not be updated when a dish is edited via the management page.
- There is no drag-and-drop for reordering dishes (`display_order` column exists in the DB but is not surfaced in the UI).

---

## Export

From the dashboard, partners can export their restaurant data:

- **JSON export** (`lib/export.ts → exportAsJSON()`): Full restaurant + dishes data in a format mirroring the DB schema.
- **CSV export** (`lib/export.ts → exportAsCSV()`): Dish list only, with columns for name, description, price, dietary tags, allergens, ingredients.

Both functions create a temporary `<a>` element and programmatically click it to trigger a browser download. No server round-trip is needed.

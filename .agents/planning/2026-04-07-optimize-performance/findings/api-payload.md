# API Payload & Network Findings

## Investigation Date: 2026-04-07

---

### [Critical] RestaurantDetailScreen Fetches Vector Columns in Nested Query

**File(s):** `apps/mobile/src/screens/RestaurantDetailScreen.tsx:96-115`
**Severity:** Critical
**Effort:** Easy (< 1 day)

**Current behavior:**
The restaurant detail query uses `select('*')` at every level of the nested join:
```typescript
supabase.from('restaurants').select(`
  *,                              // includes restaurant_vector (1536 floats = ~12KB)
  menus (*,                       // includes all menu columns
    menu_categories (*,           // includes all category columns
      dishes (*,                  // includes embedding (12KB), embedding_input, enrichment_payload
        dish_ingredients (ingredient_id),
        option_groups (*, options (*))
      )
    )
  )
`)
```

For a restaurant with 50 dishes, the `embedding` column alone adds ~600KB to the response. Combined with `restaurant_vector`, `enrichment_payload` (JSONB with AI inference data), and `embedding_input`, the total payload can exceed 1MB.

**Root cause:**
Using `*` selects all columns including large binary/JSONB columns that are only used by backend processes (enrichment, feed scoring), never displayed in the UI.

**Proposed fix:**
```typescript
supabase.from('restaurants').select(`
  id, name, address, city, postal_code, cuisine_types, rating, phone, 
  website, open_hours, image_url, payment_methods, is_active,
  delivery_available, takeout_available, dine_in_available,
  menus (
    id, name, description, display_order, is_active, menu_type, schedule_type,
    menu_categories (
      id, name, description, display_order, is_active,
      dishes (
        id, name, description, price, dietary_tags, allergens, calories,
        spice_level, image_url, is_available, dish_kind, display_price_prefix,
        description_visibility, ingredients_visibility, parent_dish_id, is_parent,
        serves, price_per_person,
        dish_ingredients (ingredient_id),
        option_groups (
          id, name, description, selection_type, min_selections, max_selections,
          display_order, is_active,
          options (id, name, description, price_delta, calories_delta, 
                   canonical_ingredient_id, is_available, display_order)
        )
      )
    )
  )
`)
```

**Estimated impact:**
Reduces restaurant detail payload from ~1-2MB to ~50-100KB (10-20x reduction). Dramatically improves load time on mobile networks.

---

### [High] Feed Response Returns Unnecessary Fields

**File(s):** `infra/supabase/functions/feed/index.ts:673-695`
**Severity:** High
**Effort:** Easy (< 1 day)

**Current behavior:**
The feed response includes fields the mobile app doesn't use:
- `allergens` and `dietary_tags` arrays (not displayed in the feed card)
- `dish_kind` (only used for display formatting, could be derived)
- `is_available` (always true since filtered server-side)
- `flagged_ingredients` as empty array for most dishes (only populated when user has ingredients to avoid)

The restaurant object in each dish includes `cuisine_types` array — repeated for every dish from the same restaurant.

**Root cause:**
The feed was designed to return a comprehensive dish object. The mobile feed card only shows: name, price, restaurant name, image, distance, and score.

**Proposed fix:**
Create a "slim" response mode or reduce the default payload:
```typescript
const dishResult = dishPool.slice(0, limit).map(d => ({
  id: d.id,
  name: d.name,
  price: d.price,
  image_url: d.image_url,
  restaurant_id: d.restaurant_id,
  restaurant_name: d.restaurant_name,
  distance_km: d.distance_m / 1000,
  score: d.score,
  flagged_ingredients: d.flagged_ingredients?.length ? d.flagged_ingredients : undefined,
}));
```

**Estimated impact:**
Reduces feed dish payload by ~50% (from ~1KB/dish to ~500B/dish). For 20 dishes, saves ~10KB per request.

---

### [Medium] No Pagination on RestaurantDetailScreen Dish List

**File(s):** `apps/mobile/src/screens/RestaurantDetailScreen.tsx:96-115`
**Severity:** Medium
**Effort:** Medium (1–3 days)

**Current behavior:**
The restaurant detail query loads ALL menus, categories, and dishes in a single query with no `.range()` pagination. For restaurants with large menus (50-200 dishes), this is a heavy initial load.

**Root cause:**
The screen renders a scrollable menu with all items. Pagination would require redesigning the menu navigation UI.

**Proposed fix:**
1. Short-term: Add `.limit()` on the dishes sub-query (e.g., 30 most popular per category) with a "Show all" button
2. Long-term: Implement per-category lazy loading — only fetch dishes for the currently visible category

**Estimated impact:**
Reduces initial load for large menus from ~200 dishes to ~30. Saves 500KB+ for large restaurants.

---

### [Medium] viewHistoryService Makes Two Sequential Queries

**File(s):** `apps/mobile/src/services/viewHistoryService.ts:28-78`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
The service makes two sequential queries:
1. `session_views` → gets entity_ids (restaurant IDs)
2. `restaurants` → gets restaurant details for those IDs

This two-step pattern exists because `session_views.entity_id` is polymorphic (can be restaurant, dish, or menu) so PostgREST can't join it.

**Root cause:**
Polymorphic `entity_id` foreign key — a common pattern that prevents automatic joins.

**Proposed fix:**
Create a database view or RPC that joins session_views to restaurants for `entity_type = 'restaurant'`:
```sql
CREATE VIEW recent_viewed_restaurants AS
SELECT sv.viewed_at, r.id, r.name, r.cuisine_types, r.image_url
FROM session_views sv
JOIN restaurants r ON r.id = sv.entity_id
WHERE sv.entity_type = 'restaurant';
```

**Estimated impact:**
Eliminates one round-trip per view history load (~20ms). Minor but improves perceived speed of the history screen.

---

### [Low] Feed Fetch Debounce Is 300ms — Could Be Higher

**File(s):** `apps/mobile/src/screens/BasicMapScreen.tsx:317`
**Severity:** Low
**Effort:** Easy (< 1 day)

**Current behavior:**
```typescript
const timeoutId = setTimeout(async () => {
  // ... fetch feed
}, 300); // debounce rapid filter changes
```

The 300ms debounce means if a user adjusts multiple filters in quick succession, the Edge Function is called multiple times (each previous call is cancelled, but the network request may already be in flight).

**Root cause:**
300ms is a reasonable compromise but could be higher for filter adjustment scenarios.

**Proposed fix:**
Increase debounce to 500-800ms, or better yet, only fetch on "Apply" button press in the filter modal (the `replaceDailyFilters` already supports this pattern).

**Estimated impact:**
Reduces redundant Edge Function calls by ~50% during filter adjustment sessions.

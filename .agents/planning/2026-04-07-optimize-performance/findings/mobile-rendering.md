# Mobile App Rendering Findings

## Investigation Date: 2026-04-07

---

### [High] BasicMapScreen Re-renders on Every Filter Change — No Debounce on Store Selectors

**File(s):** `apps/mobile/src/screens/BasicMapScreen.tsx:126-128`
**Severity:** High
**Effort:** Easy (< 1 day)

**Current behavior:**
```typescript
const daily = useFilterStore(state => state.daily);
const permanent = useFilterStore(state => state.permanent);
const mode = useViewModeStore(state => state.mode);
```
The `daily` and `permanent` selectors return entire sub-objects. Every filter toggle (e.g., toggling a cuisine) creates a new object reference for `state.daily`, causing BasicMapScreen to re-render. This triggers re-computation of `restaurants`, `dishes`, `recommendedDishes`, `mapPinRestaurants`, and `mapPinDishes` useMemo blocks.

The feed fetch useEffect at line 289 depends on `daily` and `permanent`:
```typescript
useEffect(() => { ... }, [userLocation, daily, permanent]);
```
Every filter toggle triggers a new Edge Function call (debounced by 300ms, but still fires).

**Root cause:**
Zustand selectors return object references — when any nested property changes, the entire object reference changes. No shallow comparison is used.

**Proposed fix:**
1. Use Zustand's `useShallow` for object selectors:
```typescript
import { useShallow } from 'zustand/react/shallow';
const daily = useFilterStore(useShallow(state => state.daily));
```
2. For the feed fetch effect, extract only the specific filter values that affect the API call, not the entire `daily`/`permanent` objects. Use a stable hash of the relevant filter values as the dependency.
3. Alternatively, use `replaceDailyFilters()` pattern (already exists at line 586 of filterStore) where the Apply button in the modal sends all changes atomically, preventing intermediate re-renders.

**Estimated impact:**
Reduces BasicMapScreen re-renders from ~5-10 per filter interaction to 1. Eliminates redundant Edge Function calls during filter adjustment.

---

### [High] No Image Caching Library — Using Raw React Native Image

**File(s):** `apps/mobile/src/screens/ViewedHistoryScreen.tsx:8` (imports `Image` from react-native)
**Severity:** High
**Effort:** Medium (1–3 days)

**Current behavior:**
The app does not use `expo-image` (which provides built-in disk/memory caching). Grep shows only `expo-image-picker` is imported — no `expo-image` or `react-native-fast-image` in the dependency tree.

The `package.json` lists no image caching library. Restaurant and dish images are loaded via `Image` from `react-native`, which has no persistent disk cache on Android and limited caching on iOS.

**Root cause:**
`expo-image` was never added to the project. The standard `Image` component relies on HTTP cache headers (which Supabase Storage may or may not set optimally).

**Proposed fix:**
1. Install `expo-image`: `npx expo install expo-image`
2. Replace `Image` with `Image` from `expo-image` throughout the app
3. `expo-image` provides automatic disk caching, placeholder support, and blurhash transitions

**Estimated impact:**
Eliminates re-downloading of restaurant/dish images on every screen visit. Reduces data usage and improves perceived performance, especially for the restaurant detail screen which loads dish photos.

---

### [Medium] FlatList Missing getItemLayout in ViewedHistoryScreen

**File(s):** `apps/mobile/src/screens/ViewedHistoryScreen.tsx:112-118`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
```tsx
<FlatList
  data={restaurants}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  contentContainerStyle={styles.listContent}
  showsVerticalScrollIndicator={false}
/>
```
The FlatList has `keyExtractor` (good) but is missing:
- `getItemLayout` — forces FlatList to measure each item dynamically
- `removeClippedSubviews` — keeps offscreen items in memory

This is the only FlatList in the app. Most other lists use `ScrollView` (FavoritesScreen, EatTogetherScreen) which renders all items at once.

**Root cause:**
Only 15 items max (from `viewHistoryService.ts:24`), so the performance impact is limited. But it's a missed optimization.

**Proposed fix:**
```tsx
<FlatList
  data={restaurants}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
  removeClippedSubviews={true}
  contentContainerStyle={styles.listContent}
  showsVerticalScrollIndicator={false}
/>
```

**Estimated impact:**
Minor — only 15 items. But establishes the pattern for future lists.

---

### [Medium] RestaurantDetailScreen Loads Full Menu Tree with .select('*')

**File(s):** `apps/mobile/src/screens/RestaurantDetailScreen.tsx:96-115`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
```typescript
supabase.from('restaurants').select(`
  *,
  menus (
    *,
    menu_categories (
      *,
      dishes (
        *,
        dish_ingredients (ingredient_id),
        option_groups (
          *,
          options (*)
        )
      )
    )
  )
`)
```
This fetches the ENTIRE restaurant tree in a single query: all menus, all categories, ALL dishes with ALL option groups and ALL options. For a restaurant with 100 dishes and 200 options, this is a massive payload.

The `*` wildcards include every column: restaurants has 25+ columns (including `restaurant_vector` — 1536 floats!), dishes has 25+ columns (including `embedding` — 1536 floats!).

**Root cause:**
Convenience — loading everything upfront avoids pagination logic. The `*` includes vector columns that are never displayed.

**Proposed fix:**
1. Replace `*` with explicit columns, excluding `embedding`, `embedding_input`, `enrichment_payload`, `restaurant_vector`, `location_point`
2. Consider lazy-loading dish details (ingredients, option_groups) only when the user taps a dish, rather than loading all of them upfront

**Estimated impact:**
Excluding vector columns alone saves ~12KB per dish (1536 × 8 bytes). For 100 dishes, that's ~1.2MB saved. Could reduce initial load from ~2MB to ~200KB.

---

### [Medium] Zustand Store Selectors — filterStore Individual Toggles Trigger saveFilters()

**File(s):** `apps/mobile/src/stores/filterStore.ts:419-430`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
Every individual filter toggle (e.g., `setDailyPriceRange`, `toggleDailyCuisine`) immediately calls `get().saveFilters()` which writes to AsyncStorage:
```typescript
setDailyPriceRange: (min: number, max: number) => {
  set(state => ({ daily: { ...state.daily, priceRange: { min, max } } }));
  get().saveFilters();  // Writes to AsyncStorage on every slider tick
},
```
For the price range slider, this triggers AsyncStorage writes on every drag event.

**Root cause:**
The pattern was designed for simple toggles, not continuous controls like sliders.

**Proposed fix:**
1. Debounce `saveFilters()` with a 500ms delay
2. Or only save on "Apply" button press (the `replaceDailyFilters` method already exists for this)
3. Comment at line 590 already notes: "Intentionally NOT saved to AsyncStorage — daily filters are session-only"

**Estimated impact:**
Reduces AsyncStorage writes from ~50/session (during filter adjustment) to ~5. Minor but reduces main thread work during slider interactions.

---

### [Low] Realtime Subscriptions — Properly Scoped to Eat Together Only

**File(s):**
- `apps/mobile/src/services/eatTogetherService.ts:564`
- `apps/mobile/src/screens/eatTogether/SessionLobbyScreen.tsx:116`
- `apps/mobile/src/screens/eatTogether/RecommendationsScreen.tsx:111`

**Severity:** Low
**Effort:** N/A

**Current behavior:**
The app maintains realtime channels only during active Eat Together sessions:
- `session-${sessionId}` for session/member changes
- `session_${sessionId}` for lobby updates
- `votes_${sessionId}` for vote tracking

Channels are properly cleaned up via return functions in useEffect.

**Root cause:**
N/A — well-designed. No always-on channels.

**Proposed fix:**
No change needed. The subscription count is bounded (max 2-3 channels per user, only during active sessions).

**Estimated impact:**
N/A — confirming no overhead from realtime.

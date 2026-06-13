# Mobile Filters — Evaluation & Findings

**Date:** 2026-06-13
**Scope:** `apps/mobile/src` filter subsystem + the server-side filter consumption in `infra/supabase/functions/feed`.
**Status:** Read-only analysis. No code was changed. This document records findings only.
**Method:** Full read of the filter store, services, components, and the feed Edge Function. Load-bearing claims (e.g. `loadFilters` never called, server-side filter serialization) were independently verified against the source.

---

## 0. Executive summary

EatMe mobile has **two filter tiers** that share a single Zustand store (`filterStore.ts`, 963 lines):

| Tier | Purpose | Persistence | Primary UI | Where applied |
|------|---------|-------------|------------|---------------|
| **Daily** | "What am I in the mood for today" — mostly *soft* re-ranking signals + a few hard restaurant gates | **Session-only** (deliberately not persisted; stale key is actively deleted) | `DailyFilterModal.tsx` (on the map) | Mostly **server-side** (feed Edge Function); a little client-side |
| **Permanent** | Saved personal preferences — *hard* dish exclusions | AsyncStorage **+** Supabase `user_preferences` | `DrawerFilters.tsx` via `FiltersScreen.tsx` ("Personal filters" drawer) | **Server-side** (feed) for the map; **client-side** (`menuFilterUtils`) for restaurant-menu dimming/sort |

The single live path that sends filters to the backend is:

```
BasicMapScreen.tsx  →  getCombinedFeed()  →  buildFilters(daily, permanent)  →  POST /functions/v1/feed
```

**Headline findings:**

1. **`loadFilters()` is never called anywhere** → on cold start, an *unauthenticated* user's AsyncStorage-persisted permanent filters are never rehydrated. The store is effectively **write-only** for anon users. (Authenticated users are masked from this bug because login re-syncs from the DB.) — *Verified._
2. **Three whole files / subsystems are dead code:** `FilterComponents.tsx` (entire file, unimported), most of `filterService.ts` (~300 lines, only `estimateAvgPrice` is used), and `FilterFAB.tsx` (never mounted). The preset system is fully dead.
3. **Daily and permanent both carry `dietPreference` with deliberately opposite semantics** (permanent = hard exclude, daily = soft +0.50 boost). This is intentional but subtle and undocumented in-app.
4. **Large swaths of `PermanentFilters` state are collected in the UI but never used** — `facilities`, `defaultPriceRange`, `cuisinePreferences`, `defaultNutrition`, `notifications`. The "Restaurant Facilities" drawer section filters *nothing*.
5. **Abandoned-allergen leftovers** remain as stale comments and one legacy DB code (`noMeat` persisted as the literal string `'vegetarian'`).

---

## 1. Daily filters

### 1.1 State shape — `DailyFilters` (`filterStore.ts:36-95`)

| Field | Type | Meaning |
|-------|------|---------|
| `priceRange` | `{ min, max }` | Currency-aware default range |
| `cuisineTypes` | `string[]` | Multi-select cuisines |
| `meals` | `string[]` | Dish/meal keywords (e.g. "Pizza") |
| `dietPreference` | `'all' \| 'vegetarian' \| 'vegan'` | **SOFT** here — re-ranks, never excludes |
| `proteinTypes` | `{ meat, fish, seafood, egg: boolean }` | Soft protein boost |
| `meatTypes` | `{ chicken, beef, pork, lamb, goat, other: boolean }` | Only meaningful when `proteinTypes.meat` |
| `spiceLevel` | `'noSpicy' \| 'eitherWay' \| 'iLikeSpicy'` | Soft spice signal |
| `calorieRange` | `{ min, max, enabled }` | Soft calorie window |
| `maxDistance` | `number` (km, default 5) | Search radius (passed as the feed `radius` arg, not inside `filters`) |
| `openNow` | `boolean` | **Not sent to the feed** (see §3.1) |
| `sortBy` | `'closest' \| 'bestMatch' \| 'highestRated'` | Sort order |
| `groupMeals` | `boolean` | Serves ≥ 2 |
| `scheduleType` | `'daily' \| 'rotating' \| undefined` | Menu schedule gate |

**Defaults** (`getDefaultDailyFilters`, `filterStore.ts:255-261` over `defaultDailyFilters` `:213-246`): price `{10,50}` (currency-overridden), empty cuisines/meals, diet `all`, all protein/meat booleans `false`, spice `eitherWay`, calories `{200,800,enabled:false}`, distance `5`, `openNow false`, sort `bestMatch`, `groupMeals false`.

### 1.2 Persistence — session-only by design

- The constant `DAILY_STORAGE_KEY = '@eatme_daily_filters'` (`filterStore.ts:343`) exists but is **never written**. `saveFilters()` persists only `permanent` + `lastSyncedAt` (`:736-749`).
- `replaceDailyFilters()` — the modal's Apply path — is explicitly **not saved** (`:525-530`).
- `loadFilters()` actively **deletes** any stale `@eatme_daily_filters` key (`:683`) and resets daily to currency-aware defaults.
- **Net effect:** daily filters live in memory for the app session and reset on cold start. This is intentional ("mood today").

### 1.3 UI

- **Primary: `DailyFilterModal.tsx`** (mounted only by `BasicMapScreen.tsx:695`). Holds **local** state, re-seeded from `currentDaily` each open, commits via `replaceDailyFilters(localFilters)` on Apply.
  - Exposes: price dual-slider, diet + protein + meat sub-types, cuisine grid, meal grid.
  - **Does NOT expose:** `spiceLevel`, `calorieRange`, `maxDistance`, `openNow`, `sortBy`, `groupMeals`, `scheduleType`. **Those seven daily fields have no live UI to set them** — they sit at their defaults forever.
- `FilterComponents.tsx` exposes granular per-field setters but **is never imported** (dead — see §5).

### 1.4 What daily filters control

Mostly **soft re-ranking** in the feed (boosts, not filters). The hard daily gates are `groupMeals`, `scheduleType`, and the `maxDistance` radius. Everything else (cuisine, price, calories, spice, protein/meat, daily diet) only reorders the candidate pool server-side.

---

## 2. Permanent filters

### 2.1 State shape — `PermanentFilters` (`filterStore.ts:98-136`)

| Field | Type | Status |
|-------|------|--------|
| `dietPreference` | `DietPreference` | **HARD** filter — live |
| `exclude` | `{ noMeat, noFish, noSeafood, noEggs, noSpicy }` | **HARD** exclusions — live |
| `facilities` | `{ familyFriendly, wheelchairAccessible, petFriendly, lgbtAccessible, kidsMenu }` | **Collected in UI, enforced nowhere** |
| `defaultPriceRange` | `{ min, max }` | **Never read** |
| `cuisinePreferences` | `string[]` | **Never read** |
| `defaultNutrition` | `{ maxCalories, lowSodium, highProtein, enabled }` | **Never read** |
| `notifications` | `{ dailyMenuAlerts, nearbyPromos, newRestaurants }` | **Never read/synced** |

### 2.2 Persistence — AsyncStorage + Supabase

- **AsyncStorage:** key `@eatme_permanent_filters` (`filterStore.ts:344`), written debounced 500 ms by `saveFilters()`, read by `loadFilters()`.
- **Supabase:** `savePermanentFilters()` → `savePreferencesToDB()` → upsert into `user_preferences` (authenticated users only).
- **Hydration on login:** `storeBindings.initStoreBindings()` (`storeBindings.ts:35-89`, mounted at `RootNavigator.tsx:231`) subscribes to `authStore`; on a genuine login transition (with a >30-min debounce persisted across restarts) it calls `syncWithDatabase(userId)` → merges DB values into `permanent`.

### 2.3 DB round-trip — only diet + exclude survive

`UserPreferencesDB` (`userPreferencesService.ts:19-24`) has only `user_id`, `diet_preference`, `exclude string[]`, `default_max_distance`. So **only `dietPreference` + `exclude` round-trip**; facilities/nutrition/cuisine/notifications/price are dropped on the way to the DB. This matches the post-allergen-abandonment `user_preferences` schema.

> **Legacy quirk:** `noMeat` is persisted as the string `'vegetarian'` via `EXCLUDE_TO_DB` (`userPreferencesService.ts:7-13`) — a relic of the abandoned dietary-tag vocabulary, read back at `:96`. Confusing but intentional for row back-compat.

### 2.4 UI — `DrawerFilters.tsx` ("Personal filters" drawer)

Reached via `FiltersScreen.tsx` (route `'Filters'`), entered from `FloatingMenu.tsx`. Renders three sections: **Diet Preference**, **Exclude**, **Restaurant Facilities**. `isExcludeDisabled` (`:47-57`) greys out redundant exclusions (e.g. all exclusions disabled when diet = vegan). Read-only summary also shown in `ProfileScreen.tsx:103-120`.

> The drawer's **Restaurant Facilities** section is the most misleading UI in the filter system: it is fully interactive, but `facilities` is never sent to the feed and never DB-synced. It promises filtering that does nothing.

---

## 3. How filters are applied (the trace)

### 3.1 Map feed — SERVER-SIDE (the live path)

`BasicMapScreen.tsx:298-332` (debounced effect, deps `[userLocation, daily, permanent]`) calls `getCombinedFeed(...)` → `buildFilters(daily, permanent)` (`edgeFunctionsService.ts:180-237`), the canonical serializer:

| Feed param | Source | Hard / Soft |
|------------|--------|-------------|
| `priceRange` | `daily.priceRange` | soft |
| `dietPreference` | **`permanent.dietPreference`** | **HARD** (SQL `WHERE`) |
| `preferredDiet` | `daily.dietPreference` (if ≠ all) | soft (+0.50 boost) |
| `calorieRange` | `daily.calorieRange` (if enabled) | soft |
| `cuisines` | `daily.cuisineTypes` | soft (+0.20) |
| `spiceLevel` | `daily.spiceLevel` (if ≠ eitherWay) | soft |
| `dishNames` | `daily.meals` | soft (+0.25) |
| `proteinTypes` | `daily.proteinTypes` (active keys) | soft (+0.20) |
| `meatTypes` | `daily.meatTypes` (active keys) | soft (+0.10) |
| `excludeFamilies` | **`permanent.exclude`** → protein families | **HARD** exclude |
| `excludeSpicy` | **`permanent.exclude.noSpicy`** | **HARD** exclude |
| `groupMeals` | `daily.groupMeals` | hard |
| `scheduleType` | `daily.scheduleType` | hard |
| `currentTime` / `currentDayOfWeek` | computed now (HH:MM) | time-window gate |
| `sortBy` | `daily.sortBy` | sort |

**Deliberately omitted:** `openNow` is not sent (`:223-225`) — restaurants with null `open_hours` would be treated as closed and emptied from the pool. `maxDistance` is passed as the `radius` arg, not inside `filters`.

> ⚠️ **Cross-reference (performance doc §S1):** `currentTime` is serialized at **minute** granularity (`new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})`, verified `edgeFunctionsService.ts:228-232`) and embedded in the feed's Redis cache key. Because the key changes every minute but the cache TTL is 5 minutes, **the feed cache hit rate is near zero**. This is the single biggest cheap performance win and is detailed in the performance document.

### 3.2 Restaurant detail menu — CLIENT-SIDE (permanent only)

`useRestaurantDetail.ts:87` reads `permanent`. In `FoodTab.tsx`, `classifyDish(d, permanentFilters)` runs per dish to sort matching dishes first and dim/badge non-matching ones. `ModifierGroupsList.tsx:134` calls `classifyOption(option, daily)` to highlight options matching the daily meat-type pick.

`menuFilterUtils.classifyDish` (`menuFilterUtils.ts:44-84`) is **purely protein-derived** (no allergens): vegan = `primary_protein==='vegan'`; vegetarian = none of `MEAT_FAMILIES = ['meat','poultry','fish','shellfish']` (eggs allowed); then `exclude` families; then `noSpicy && spice_level==='hot'`.

### 3.3 Server vs client summary

- **Server-side (feed):** essentially all map filtering — both tiers, hard + soft.
- **Client-side (live):** only restaurant-detail menu dimming/sorting (permanent diet+exclude) and modifier-option highlighting (daily meat types).
- **Client-side (dead):** the legacy `nearby-restaurants` path (`geoService.ts`) and `filterService.applyFilters` — see §5.

---

## 4. Daily ↔ Permanent relationship

Both tiers carry `dietPreference: DietPreference`, **by design with opposite semantics**:

- **Permanent `dietPreference` = HARD** → `feed.dietPreference` → excludes non-matching dishes in SQL.
- **Daily `dietPreference` = SOFT** → `feed.preferredDiet` → +0.50 re-rank boost only.

They do **not merge** — both are sent independently and the feed resolves precedence (hard filters the pool, soft only reorders). Examples:

- permanent = vegan + daily = all → only vegan dishes shown.
- permanent = all + daily = vegan → everything shown, vegan boosted to the top.

**Contradictions are possible but safe:** daily `proteinTypes.meat = true` while permanent `exclude.noMeat = true` → the hard exclude wins (no meat dishes), and the soft meat-boost simply has nothing to boost. `validateFilters()` (`filterService.ts:246-275`) *detects* such conflicts but is **dead code**, so no user-facing warning fires. The drawer's `isExcludeDisabled` is the only live guard, and it only constrains *within* permanent filters.

Price / distance / cuisine never merge across tiers — the feed always uses the **daily** values; permanent `defaultPriceRange` / `cuisinePreferences` are never read.

---

## 5. Issues, dead code, and smells

### 5.1 Bugs / correctness

| # | Severity | Finding | Reference |
|---|----------|---------|-----------|
| B1 | **High** | **`loadFilters()` is never called.** Anon users' AsyncStorage-persisted permanent filters are never rehydrated on cold start → store is write-only for them. The Phase-A `ingredientsToAvoid` strip migration inside `loadFilters` (`:698`) also never runs. *(Verified: only the interface decl `:191` and impl `:679` exist; zero callers across `apps/mobile`.)* | `filterStore.ts:679` |
| B2 | Low | **Inconsistent permanent-save routing.** `dietPreference`/`exclude`/`facilities` save to AsyncStorage **+ DB**; `defaultPriceRange`/`cuisinePreferences`/`defaultNutrition`/`notifications` save to AsyncStorage **only**. Harmless today (those fields are unused) but a trap if revived. | `filterStore.ts:533-613` |
| B3 | Low | **`healthy` preset references a non-existent shape** `dietToggle: {…}` that doesn't match `DailyFilters` — would write a junk key if ever applied (it can't be, the preset system is dead). | `filterStore.ts:325-331` |

### 5.2 Dead code (confirmed by grep — no importers)

| # | What | Notes |
|---|------|-------|
| D1 | **`FilterComponents.tsx` — entire file** | Orphans `PriceRangeFilter`, `CuisineTypeFilter`, `DietToggleFilter`, `CalorieRangeFilter`, `QuickFilterPresets`, `FilterSummary`. Also ships a duplicate 70-item local `CUISINE_TYPES` list shadowing `@eatme/shared`'s `ALL_CUISINES`. |
| D2 | **`filterService.ts` — all but `estimateAvgPrice`** | ~300 lines: `applyFilters`, `applyPermanentFilters`, `applyDailyFilters`, `sortRestaurants`, `validateFilters`, `getFilterSuggestions`, the `FilterEngine` class. Also architecturally stale (filters client-side by `restaurant.cuisine`/`avgPrice`, which the server now owns). Only `estimateAvgPrice` is live (`BasicMapScreen.tsx:147`). |
| D3 | **`FilterFAB.tsx` — never mounted** | No JSX renders `<FilterFAB>`. Its `QuickFilterModal` export is a `return null` placeholder. So `getDailyFilterCount()` / `hasDailyFilters()` have no live UI consumer. |
| D4 | **Preset system** | `DAILY_FILTER_PRESETS` (`filterStore.ts:306-340`), `applyPreset`, `clearActivePreset`, `activePreset` — only reachable from dead `QuickFilterPresets`. |
| D5 | **Legacy `nearby-restaurants` client path** | `geoService.loadNearbyRestaurantsFromCurrentLocation` is imported in `BasicMapScreen.tsx:98` but **never invoked**; `restaurantStore.loadNearbyRestaurants*` only callable via this dead route. |

### 5.3 Vestigial / misleading state

| # | Finding |
|---|---------|
| V1 | **`facilities`** — interactive in `DrawerFilters`, counted in `getPermanentFilterCount`, but never sent to feed and never DB-synced. UI promises filtering that does nothing. |
| V2 | **`defaultPriceRange`, `cuisinePreferences`, `defaultNutrition`, `notifications`** — no reader anywhere. `notifications` defaults are dead. |
| V3 | **Seven daily fields have no UI** (`spiceLevel`, `calorieRange`, `maxDistance`, `openNow`, `sortBy`, `groupMeals`, `scheduleType`) — yet `getDailyFilterCount` (`:844-921`) counts several of them, so its badge math is partly unreachable. A second, *disagreeing* counter exists in `filterService.ts:188-223`. |

### 5.4 Abandoned-allergen leftovers

| # | Finding |
|---|---------|
| A1 | `EXCLUDE_TO_DB` persists `noMeat` → literal `'vegetarian'` (`userPreferencesService.ts:8`) — relic of the dietary-tag era kept for back-compat. |
| A2 | `FeedRequest` doc comment still references `noDairy → ['dairy']` (`edgeFunctionsService.ts:96-99`) — there is no `noDairy` key and no dairy family. Stale. |

### 5.5 Logic smells

| # | Finding |
|---|---------|
| S1 | **Daily diet ↔ protein coupling** (`DailyFilterModal.tsx:197-255`): selecting Vegetarian/Vegan flips `dietPreference`; selecting any protein force-resets `dietPreference` to `'all'`. You can't hold daily diet = vegetarian *and* a protein highlight simultaneously — non-obvious. |
| S2 | **Two diverging daily counters** (`filterStore.getDailyFilterCount` vs `filterService.getDailyFilterCount`) count different subsets. |

---

## 6. Suggested cleanup priorities (not implemented)

1. **Decide the anon-persistence contract (B1).** Either call `loadFilters()` on app boot (so anon users keep their drawer prefs), or accept that permanent filters are login-gated and remove the dead AsyncStorage write path. As-is, the code implies persistence that doesn't happen.
2. **Delete dead code (D1–D5).** ~600+ lines across `FilterComponents.tsx`, most of `filterService.ts`, `FilterFAB.tsx`, the preset system, and the legacy nearby-restaurants client path. This is pure risk/confusion reduction.
3. **Resolve the misleading "Restaurant Facilities" UI (V1)** — either wire `facilities` to the feed (requires schema + restaurant data that doesn't exist) or remove the section.
4. **Prune vestigial `PermanentFilters` fields (V2)** and the daily fields with no UI (V3), or build the UI if they're intended.
5. **Mop up allergen comments (A1–A2)** for clarity.

---

## Appendix — file map

| File | Role |
|------|------|
| `apps/mobile/src/stores/filterStore.ts` | Both tiers, persistence, counters (963 lines) |
| `apps/mobile/src/services/edgeFunctionsService.ts` | `buildFilters` — the real serializer (`:180-237`) + feed calls |
| `apps/mobile/src/screens/BasicMapScreen.tsx` | Only live feed call (`:298-332`) |
| `apps/mobile/src/utils/menuFilterUtils.ts` | Client-side protein-derived menu classification |
| `apps/mobile/src/services/userPreferencesService.ts` | DB round-trip (only diet + exclude survive) |
| `apps/mobile/src/stores/storeBindings.ts` | Login-time DB sync (`:74`) |
| `apps/mobile/src/components/DrawerFilters.tsx` | Permanent-filters drawer UI |
| `apps/mobile/src/components/map/DailyFilterModal.tsx` | Daily-filters modal UI |
| **Dead:** `filterService.ts` (minus `estimateAvgPrice`), `FilterComponents.tsx`, `FilterFAB.tsx`, `geoService.ts` nearby path | — |

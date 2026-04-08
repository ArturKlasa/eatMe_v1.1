# Idea Honing — Requirements Clarification

## Project: 2026-04-08-implement-performance-optimizations
## Date: 2026-04-08

---

## Q1: Which sprints should this implementation plan cover?

The findings define three sprints:
- **Sprint 1** (~2 days): 6 quick wins — RestaurantDetail column select, DB indexes, enrich-dish parallelization, feed payload slimming, BasicMapScreen `useShallow`, and replacing `.select('*')` in services
- **Sprint 2** (~3-5 days): Caching & network — `expo-image`, two-tier feed cache, client-side restaurant cache, RLS index for eat_together
- **Sprint 3** (future): Architecture improvements — deprecate nearby-restaurants, per-category lazy loading, response compression, cache invalidation

Should the implementation plan cover Sprint 1 only, Sprints 1+2, or all three?

**Answer:** All three sprints. Note: Sprint 3 item "deprecate nearby-restaurants" must be re-scoped — see Q2.

---

## Q2: Should the nearby-restaurants Edge Function be removed or just deprecated/disabled?

Sprint 3 includes retiring the `nearby-restaurants` Edge Function. The findings note it already has a telemetry log to confirm zero traffic. The options are:
- **Remove entirely** — delete the function from the registry and remove client-side calls in `geoService.ts`
- **Disable/stub** — return a 410 Gone or redirect to the `feed` endpoint, keeping the file for safety
- **Deprecate only** — leave it deployed but add a clear warning; remove in a follow-up

Which approach do you prefer?

**Answer:** Debounce all (500ms). One-line change to `saveFilters()`, covers all setters including future ones. "Save on Apply only" risks unsaved state on crash and requires auditing all call paths. "Debounce slider only" requires touching multiple setters individually.

---

## Q6: For the expo-image migration (Sprint 2), should all usages of `Image` from `react-native` be replaced, or only high-traffic screens?

`expo-image` needs to replace `Image` from `react-native` across the mobile app. The high-value targets are restaurant/dish images (loaded frequently). Options:
- **Replace all** — systematic find-and-replace across all screens and components
- **High-traffic only** — replace only in RestaurantDetailScreen, BasicMapScreen, feed cards, and dish photo displays; leave low-traffic screens (e.g. onboarding) for later

Which scope do you prefer?

**Answer:** Replace all. `expo-image` is nearly a drop-in replacement (primarily an import change). Partial migration creates a mixed codebase with no clear rule on which `Image` to use. Only caveat: verify `source` prop handling for static assets (`require()`) on a per-screen basis.

---

## Q7: For the user preferences cache (Sprint 2 — skip DB fetch if last sync < 30 min), should this apply to both permanent filters and onboarding preferences, or permanent filters only?

The finding covers `storeBindings.ts` which triggers both `syncWithDatabase` (permanent filters) and `loadUserPreferences` (onboarding store) on every auth event. Options:
- **Both** — add `lastSyncedAt` to both stores
- **Permanent filters only** — only debounce the `user_preferences` fetch; always reload onboarding preferences (they're lighter and rarely change)

Which scope?

**Answer:** Both stores. Onboarding preferences are equally stable (rarely change post-setup), auth events fire on every resume/foreground, and the code change is the same size either way.

**Answer:** Skip entirely — do not touch the `nearby-restaurants` Edge Function or anything related to it.

---

## Q3: For the two-tier feed cache (Sprint 2), should hard vs soft filter separation be implemented, or just hash the full filter object?

The findings propose splitting the cache key into two tiers:
- **Tier 1** (candidate pool): keyed only by location + hard filters (diet, allergens, religious_tags) — shared across users in same area
- **Tier 2** (scored result): keyed by user + candidate hash + soft filters

Alternatively, a simpler approach is to just hash the full filter object (as the findings' quick suggestion in the edge-functions.md), which still improves key stability without the full two-tier architecture.

Which approach do you prefer — full two-tier cache or simpler hash-based single-tier?

**Answer:** Skip entirely — do not implement feed cache changes.

---

## Q4: Should the client-side restaurant cache (Sprint 2) use Zustand or should we introduce TanStack Query?

The findings offer two options:
- **Zustand store** — add a `Map<restaurantId, { data, fetchedAt }>` to the existing `restaurantStore`, skip re-fetch if age < 5 min
- **TanStack Query** — install `@tanstack/react-query`, gain automatic stale-while-revalidate, background refetch, and deduplication across screens

Do you want to add TanStack Query to the project, or keep it Zustand-only?

**Answer:** Zustand-only. Introducing TanStack Query for one use case would be an inconsistent island. The Zustand `Map<restaurantId, { data, fetchedAt }>` approach is ~30 lines, fits existing patterns, and eliminates repeat heavy fetches. TanStack Query can be reconsidered as a future app-wide architectural decision.

---

## Q5: Should the filterStore AsyncStorage write debounce (Sprint 1) apply to all filter setters, or only continuous controls like the price range slider?

The finding notes that every `setDailyPriceRange` call immediately writes to AsyncStorage — problematic for slider drag events. Options:
- **Debounce all** — add a 500ms debounce to `saveFilters()` globally
- **Debounce slider only** — only `setDailyPriceRange` gets debounced; toggle-style setters remain immediate
- **Save on Apply only** — remove all auto-saves from individual setters; only persist when the user taps Apply (using the existing `replaceDailyFilters` method)

Which approach do you prefer?

# Implement Performance Optimizations

## Objective

Implement all 15 performance optimization steps defined in the implementation plan, spanning database indexes, Edge Function improvements, mobile app rendering fixes, image caching, and client-side caching. Each step must result in working, tested, demoable functionality before moving to the next.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo):
- **`apps/mobile`** — React Native + Expo (SDK 54), Zustand stores, Mapbox map, Supabase client
- **`apps/web-portal`** — Next.js, restaurant owner onboarding and admin dashboard
- **Backend** — Supabase (PostgreSQL + PostGIS + pgvector), Edge Functions (Deno/TypeScript), Upstash Redis

Performance investigation was completed on 2026-04-07 and identified 36 findings. Planning and design artifacts for this implementation task live at:

- **Rough idea:** `.agents/planning/2026-04-08-implement-performance-optimizations/rough-idea.md`
- **Requirements Q&A:** `.agents/planning/2026-04-08-implement-performance-optimizations/idea-honing.md`
- **Detailed design:** `.agents/planning/2026-04-08-implement-performance-optimizations/design/detailed-design.md`
- **Implementation plan:** `.agents/planning/2026-04-08-implement-performance-optimizations/implementation/plan.md`
- **Original findings:** `.agents/planning/2026-04-07-optimize-performance/findings/`

**Read the detailed design and implementation plan before starting.** Each step in `plan.md` includes objective, implementation guidance, test requirements, and a demo description.

## Requirements

Implement each step in order. Mark the checklist item in `implementation/plan.md` complete when the step is done and tested.

1. **Step 1 — DB Migration (indexes):** Create `infra/supabase/migrations/076_performance_indexes.sql` with 7 indexes: `idx_favorites_user_subject`, `idx_interactions_user_type`, `idx_eat_members_session_left`, `idx_session_views_user_type`, `idx_dish_ingredients_dish`, `idx_eat_votes_session`, `idx_eat_members_session_user_active` (partial WHERE left_at IS NULL)
2. **Step 2 — RestaurantDetailScreen explicit select:** Replace all `select('*')` in the nested Supabase query at `apps/mobile/src/screens/RestaurantDetailScreen.tsx:96-115` with explicit columns, excluding `embedding`, `embedding_input`, `enrichment_payload`, `restaurant_vector`, `location_point`
3. **Step 3 — enrich-dish Promise.all:** Wrap the 4 independent sequential `await` calls at `infra/supabase/functions/enrich-dish/index.ts:357-405` in a single `Promise.all`
4. **Step 4 — feed slim response + favorites join:** Remove `allergens`, `dietary_tags`, `is_available` from feed dish response; omit `flagged_ingredients` when empty; merge favorites cuisine lookup into the existing `Promise.all` at `infra/supabase/functions/feed/index.ts:473-484`
5. **Step 5 — BasicMapScreen useShallow:** Add `useShallow` from `zustand/react/shallow` to the `daily` and `permanent` selectors at `apps/mobile/src/screens/BasicMapScreen.tsx:126-128`
6. **Step 6 — Explicit selects in services:** Replace `select('*')` with explicit column lists in `apps/mobile/src/services/eatTogetherService.ts` (lines 127, 146, 185, 399, 529) and `apps/mobile/src/services/dishPhotoService.ts` (line 136)
7. **Step 7 — filterStore debounce:** Add 500 ms debounce to `saveFilters()` in `apps/mobile/src/stores/filterStore.ts`
8. **Step 8 — expo-image migration:** Install `expo-image` via `npx expo install expo-image`; replace all `Image` from `react-native` with `Image` from `expo-image` across all mobile screens and components; update `resizeMode` → `contentFit`
9. **Step 9 — Client-side restaurant cache:** Add `restaurantDetailCache: Map<string, { data, fetchedAt }>` and `fetchRestaurantDetail(id)` action to `restaurantStore`; update `RestaurantDetailScreen` to use it (5 min TTL, in-memory only)
10. **Step 10 — User preferences sync debounce:** Add `lastSyncedAt: number | null` to both `filterStore` and `onboardingStore`; skip `syncWithDatabase` / `loadUserPreferences` in `storeBindings.ts` if last sync < 30 minutes; reset on logout
11. **Step 11 — viewHistoryService DB view:** Create migration with `recent_viewed_restaurants` view joining `session_views` to `restaurants`; update `apps/mobile/src/services/viewHistoryService.ts` to query the view in one call
12. **Step 12 — FlatList getItemLayout:** Add `getItemLayout` and `removeClippedSubviews` to the FlatList in `apps/mobile/src/screens/ViewedHistoryScreen.tsx:112-118`
13. **Step 13 — Per-category lazy loading:** Restructure `RestaurantDetailScreen` to load restaurant metadata + menu structure first, then fetch per-category dishes lazily on tab/section activation
14. **Step 14 — feed response compression:** Add gzip compression via `CompressionStream` to the feed Edge Function; only compress when `Accept-Encoding: gzip` is present; fall back to uncompressed otherwise
15. **Step 15 — Cache invalidation webhook:** Create `infra/supabase/functions/invalidate-cache/index.ts`; register Supabase DB webhooks on `restaurants`, `menus`, `dishes` UPDATE events to delete relevant Redis keys

## Constraints

- **Do NOT touch `nearby-restaurants` Edge Function** — any file under `infra/supabase/functions/nearby-restaurants/` and the `geoService.ts` client calls are entirely out of scope
- **Do NOT implement two-tier feed cache key restructuring** — the feed cache key format (`feed:${userId}:${lat}:${lng}:${filters}`) must not be changed
- Implement steps sequentially — later steps build on earlier ones (Step 9 uses the explicit select from Step 2; Step 13 extends Step 9)
- Write tests alongside each step — do not create standalone testing-only steps
- Run `pnpm tsc --noEmit` from the repo root after each mobile/shared change to catch TypeScript errors early
- For Edge Function changes, verify with `supabase functions serve <name>` locally before marking complete
- Do not add new npm dependencies beyond `expo-image` (Step 8) — use existing utilities

## Success Criteria

The task is complete when:

- [ ] Step 1: Migration `076_performance_indexes.sql` exists and all 7 indexes are confirmed via `EXPLAIN ANALYZE` to produce Index Scans
- [ ] Step 2: RestaurantDetailScreen Supabase query contains no `*` wildcards; no `embedding` or `restaurant_vector` in network response
- [ ] Step 3: enrich-dish function uses `Promise.all` for the 4 independent DB queries; enrichment output is functionally identical
- [ ] Step 4: feed response omits `allergens`, `dietary_tags`, `is_available`; favorites cuisine resolved via join (no sequential post-Promise.all query)
- [ ] Step 5: BasicMapScreen `daily` and `permanent` selectors use `useShallow`; no TypeScript errors
- [ ] Step 6: All `select('*')` replaced in `eatTogetherService.ts` and `dishPhotoService.ts`; all eat_together flows work end-to-end
- [ ] Step 7: `saveFilters()` is debounced 500 ms; rapid slider movement triggers only one AsyncStorage write
- [ ] Step 8: `expo-image` installed; no remaining `import { Image } from 'react-native'` in mobile screens/components; no `resizeMode` prop warnings
- [ ] Step 9: Second navigation to same restaurant within 5 min produces no Supabase network request; cache invalidated after TTL
- [ ] Step 10: App foreground within 30 min skips `syncWithDatabase` and `loadUserPreferences`; logout resets `lastSyncedAt`
- [ ] Step 11: Migration with `recent_viewed_restaurants` view exists; `viewHistoryService` issues a single DB query; history screen renders correctly
- [ ] Step 12: `ViewedHistoryScreen` FlatList has `getItemLayout` and `removeClippedSubviews`; no layout jump on scroll
- [ ] Step 13: RestaurantDetailScreen initial load fetches only first category dishes; tapping a new category triggers a targeted fetch; loading state shown per category
- [ ] Step 14: feed Edge Function returns `Content-Encoding: gzip` when `Accept-Encoding: gzip` is present; falls back to plain JSON otherwise
- [ ] Step 15: `invalidate-cache` Edge Function deployed; after a restaurant UPDATE, relevant Redis keys are deleted

## Progress Log

- [ ] Step 1: DB Migration — Missing Indexes
- [ ] Step 2: RestaurantDetailScreen — Explicit Column Select
- [ ] Step 3: enrich-dish — Parallelize Sequential Queries
- [ ] Step 4: feed Edge Function — Slim Response + Favorites Join
- [ ] Step 5: BasicMapScreen — useShallow Selectors
- [ ] Step 6: Explicit Selects in eatTogetherService + dishPhotoService
- [ ] Step 7: filterStore — Debounce saveFilters()
- [ ] Step 8: expo-image — Install and Full Migration
- [ ] Step 9: Client-Side Restaurant Cache in Zustand
- [ ] Step 10: User Preferences Sync Debounce
- [ ] Step 11: viewHistoryService — Combined DB View
- [ ] Step 12: FlatList getItemLayout in ViewedHistoryScreen
- [ ] Step 13: Per-Category Lazy Loading in RestaurantDetailScreen
- [ ] Step 14: feed Edge Function — Response Compression
- [ ] Step 15: Cache Invalidation Webhook

## Notes

- The detailed design at `.agents/planning/2026-04-08-implement-performance-optimizations/design/detailed-design.md` contains interface definitions, SQL DDL, TypeScript snippets, and error handling guidance for each change — read it before implementing each step
- The implementation plan at `.agents/planning/2026-04-08-implement-performance-optimizations/implementation/plan.md` has step-by-step guidance including exact file paths, line numbers, and code examples
- Original performance findings (with root cause analysis and proposed fixes) are in `.agents/planning/2026-04-07-optimize-performance/findings/`
- Steps 1–7 are largely independent and fastest to implement; Steps 8–10 build on Step 2; Steps 11–15 are the architectural Sprint 3 items
- After completing all steps, write `LOOP_COMPLETE` to signal completion

---
The orchestrator will continue iterations until limits are reached.

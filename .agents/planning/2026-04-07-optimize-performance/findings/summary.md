# Optimization Findings Summary

## Investigation Date: 2026-04-07
## Platform: eatMe (React Native + Expo, Next.js, Supabase, Edge Functions)

---

## Top 10 Highest-Impact Findings (Ranked by Severity × Effort)

| # | Finding | Domain | Severity | Effort | Impact |
|---|---------|--------|----------|--------|--------|
| 1 | RestaurantDetail fetches vector columns (1MB+ payload) | API Payload | Critical | Easy | 10-20x payload reduction |
| 2 | enrich-dish: 4 sequential DB queries → Promise.all | Edge Functions | High | Easy | -60ms per enrichment |
| 3 | Missing indexes on 6 frequently filtered columns | Database | High | Easy | Seq scan → index scan |
| 4 | Feed cache key too specific — near-zero hit rate | Caching | High | Medium | 30-50% cache hit rate |
| 5 | No image caching library (expo-image) | Bundle/Rendering | High | Medium | Eliminates re-downloads |
| 6 | BasicMapScreen re-renders on every filter toggle | Mobile Rendering | High | Easy | 5-10x fewer re-renders |
| 7 | Restaurant metadata not cached client-side | Caching | High | Medium | Eliminates repeat 1MB fetches |
| 8 | Feed response includes unnecessary fields | API Payload | High | Easy | -50% feed payload |
| 9 | RLS overhead on eat_together tables (missing index) | Database | High | Medium | Faster RLS eval |
| 10 | Over-fetching with .select('*') across services | Database | Medium | Easy | -40-60% per query |

---

## Recommended Sprint Order

### Sprint 1: Quick Wins (Easy effort, High+ severity) — ~2 days

1. **RestaurantDetail select columns** — Replace `*` with explicit columns, excluding `embedding`, `restaurant_vector`, `enrichment_payload`. Single file change, biggest payload win.
   - File: `apps/mobile/src/screens/RestaurantDetailScreen.tsx:96-115`

2. **Add missing database indexes** — 6 CREATE INDEX statements. No code changes, immediate query performance improvement.
   - File: New migration

3. **enrich-dish Promise.all** — Parallelize 4 independent DB queries. ~10 lines changed.
   - File: `infra/supabase/functions/enrich-dish/index.ts:357-405`

4. **Feed response slimming** — Remove unnecessary fields from feed dish/restaurant response.
   - File: `infra/supabase/functions/feed/index.ts:673-695`

5. **BasicMapScreen selector optimization** — Use `useShallow` for Zustand selectors to prevent unnecessary re-renders.
   - File: `apps/mobile/src/screens/BasicMapScreen.tsx:126-128`

6. **Replace .select('*') in services** — Narrow column selection in `eatTogetherService.ts`, `nearby-restaurants`, and other services.
   - Files: Multiple service files

### Sprint 2: Caching & Network (Medium effort) — ~3-5 days

7. **Install expo-image** — Replace `Image` from `react-native` with `expo-image` for automatic disk/memory caching.
   - Files: `package.json` + all components using `Image`

8. **Two-tier feed cache** — Separate candidate pool cache from scored result cache. Cache candidates by hard filters only.
   - File: `infra/supabase/functions/feed/index.ts:396-409`

9. **Client-side restaurant cache** — Cache restaurant detail data in Zustand with 5-minute staleness. Prevents repeat heavy fetches.
   - File: New Zustand store or extending `restaurantStore.ts`

10. **RLS index for eat_together** — Add composite partial index on `eat_together_members(session_id, user_id) WHERE left_at IS NULL`.
    - File: New migration

### Sprint 3: Architecture Improvements (Hard effort) — future

- Migrate from `nearby-restaurants` Edge Function to feed-only (verify zero traffic first)
- Implement per-category lazy loading in RestaurantDetailScreen
- Add response compression to Edge Functions
- Implement cache invalidation on restaurant updates

---

## Domain Coverage Summary

| Domain | Findings | Critical | High | Medium | Low |
|--------|----------|----------|------|--------|-----|
| Database | 6 | 0 | 2 | 2 | 2 |
| Edge Functions | 7 | 0 | 2 | 3 | 2 |
| Mobile Rendering | 6 | 0 | 2 | 2 | 2 |
| API Payload | 5 | 1 | 1 | 2 | 1 |
| Caching | 6 | 0 | 2 | 2 | 2 |
| Bundle/Startup | 6 | 0 | 1 | 1 | 4 |
| **Total** | **36** | **1** | **10** | **12** | **13** |

---

## Key Patterns Observed

### Positive Patterns (Keep)
- Feed Edge Function uses `Promise.all` for user context loading (4 parallel queries)
- Group recommendations parallelizes preference + behavior profile loads
- Web portal uses `dynamic()` imports for heavy components (Leaflet)
- Realtime subscriptions are properly scoped and cleaned up
- RLS policies use `(SELECT ...)` wrapping for initPlan caching
- `get_vote_results()` performs in-DB aggregation (correct pattern)
- Feed response is already using a combined endpoint (dishes + restaurants in one call)

### Anti-Patterns (Fix)
- `.select('*')` on tables with vector/JSONB columns
- Sequential awaits on independent queries (enrich-dish)
- Cache keys that include volatile soft-filter parameters
- No client-side caching for stable data (restaurant metadata)
- No image caching library in the mobile app
- Zustand selectors returning entire objects without shallow comparison

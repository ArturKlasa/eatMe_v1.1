# Investigate Application Optimization Opportunities

## Objective

Systematically investigate and document all significant optimization opportunities across the eatMe platform — covering database performance, edge functions, mobile app rendering, API payload efficiency, caching, and startup/bundle size. Produce a prioritised, actionable findings report that a developer can use to plan an optimization sprint.

**Do NOT make any code changes.** This is a read-only investigation. All output goes to `.agents/planning/2026-04-07-optimize-performance/findings/`.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo):

- **`apps/mobile`** — React Native + Expo, map-based dish discovery, Zustand stores, recommendation feed, Eat Together group dining feature
- **`apps/web-portal`** — Next.js, restaurant owner onboarding, admin dashboard, AI menu scanning (GPT-4o Vision)
- **Backend** — Supabase (PostgreSQL + PostGIS + pgvector), Edge Functions (feed, enrich-dish, group-recommendations, daily-feed, etc.), Upstash Redis
- **Shared packages** — `packages/database` (Supabase client + auto-generated types)

## Investigation Domains

Work through all domains below. For each finding write a structured entry (see Output Format). Gather concrete evidence — file paths, line numbers, query patterns, payload examples — before recording a finding.

### 1. Database Performance
- **Indexes**: Check all `.select()` filter columns in services against `database_schema.sql`. Are PostGIS `ST_DWithin` calls covered by a spatial index? Are `embedding <=>` vector searches using an IVFFlat or HNSW index?
- **N+1 queries**: Look for service functions that call Supabase inside a loop (`.map()` + `await`).
- **RLS overhead**: Count security definer function calls in policy `USING` clauses. Are they wrapped in `(SELECT ...)` for initPlan caching? Look especially at eat_together policies and feed policies.
- **Over-fetching**: Find `.select('*')` calls on large tables (restaurants, dishes, eat_together_members). Could they select only needed columns?
- **Slow aggregations**: Look for `get_vote_results()`, `get_group_candidates()`, and similar RPCs — do they do in-DB aggregation or pull raw rows to the client?
- **pg_cron contention**: Is the expire-eat-together-sessions job scheduled frequently enough to matter, or could it conflict with write-heavy migrations?

### 2. Edge Function Performance
- **Bundle / cold start risk**: Check each function's `index.ts` for large imports (whole SDK vs named imports). Large bundles increase cold start latency.
- **Sequential vs parallel awaits**: Look for `await A; await B;` patterns where A and B are independent — these should be `await Promise.all([A, B])`.
- **Redis cache hit rate**: Check Upstash usage in `feed` and `enrich-dish` functions. Are TTLs set? Is the cache key granular enough to be useful?
- **Payload size**: What does each edge function return to the client? Are full restaurant objects returned where only IDs + display fields are needed?
- **Error handling latency**: Do functions retry on transient errors? Unbounded retries add latency in failure paths.

### 3. Mobile App Rendering
- **Unnecessary re-renders**: Look for components subscribed to large Zustand slices without selectors. `useStore()` without a selector re-renders on any store change.
- **FlatList / FlashList optimization**: Are `getItemLayout` and `keyExtractor` defined on lists? Is `removeClippedSubviews` set for long lists?
- **useMemo / useCallback**: Find expensive computations in render functions (sorting, filtering large arrays) that are not memoized.
- **Image loading**: Are restaurant/dish images loaded with caching headers? Is `expo-image` (with built-in cache) used, or the older `Image` from react-native?
- **Navigation performance**: Are heavy screens using `React.lazy` or conditional mounting to avoid rendering off-screen content?
- **Realtime subscriptions**: How many concurrent Supabase realtime channels does the app maintain? Each open channel adds overhead.

### 4. API Payload & Network
- **Over-fetching**: Find Supabase queries selecting more columns than the component displays.
- **Under-pagination**: Are large collections (restaurant lists, dish feeds) fetched without `.range()` pagination? What is the default page size?
- **Redundant requests**: Check if the same data is fetched on every navigation event vs. cached in Zustand or React Query.
- **Payload compression**: Do edge functions return gzip-compressed responses? Supabase edge functions support this.

### 5. Caching Strategy
- **What is cached**: Map all current Redis cache usages (key patterns, TTLs). Identify data fetched on every request that could be cached.
- **What should be cached**: Restaurant metadata, dish enrichments, embedding results — these change infrequently. Are they cached?
- **Client-side caching**: Is `stale-while-revalidate` or equivalent used in the mobile app for feed data?
- **Cache invalidation**: When a restaurant owner updates menu data, does the cache get invalidated? Or does stale data linger?

### 6. Bundle & Startup Time
- **JS bundle size**: Are there large dependencies imported at the top level that could be lazy-loaded (e.g., map libraries, PDF parsers)?
- **Expo/Metro config**: Is tree-shaking configured? Are source maps excluded from production builds?
- **Web portal bundle**: Does the Next.js app use dynamic imports for heavy components (map, chart, PDF viewer)?
- **Font/asset loading**: Are fonts and images preloaded efficiently, or do they block the initial render?

## Output Format

For each finding, use this structure in the relevant findings file:

```markdown
### [SEVERITY] Title of Finding

**File(s):** `path/to/file.ts:line`
**Severity:** Critical | High | Medium | Low
**Effort:** Easy (< 1 day) | Medium (1–3 days) | Hard (> 3 days)

**Current behavior:**
What happens now, with evidence (code snippet or query pattern).

**Root cause:**
Why this is slow / wasteful.

**Proposed fix:**
Concrete description or pseudocode of the change needed.

**Estimated impact:**
E.g., "Eliminates 3 extra round-trips per session join", "Reduces cold start by ~200ms", "Cuts feed payload by 60%".
```

## Output Files

Write findings to these files (create as needed):

- `.agents/planning/2026-04-07-optimize-performance/findings/database.md`
- `.agents/planning/2026-04-07-optimize-performance/findings/edge-functions.md`
- `.agents/planning/2026-04-07-optimize-performance/findings/mobile-rendering.md`
- `.agents/planning/2026-04-07-optimize-performance/findings/api-payload.md`
- `.agents/planning/2026-04-07-optimize-performance/findings/caching.md`
- `.agents/planning/2026-04-07-optimize-performance/findings/bundle-startup.md`
- `.agents/planning/2026-04-07-optimize-performance/findings/summary.md` — top 10 highest-impact findings ranked by Severity × Effort, with a recommended sprint order

## Key Source Files to Read

**Schema & migrations:**
- `infra/supabase/migrations/database_schema.sql` — full schema with indexes
- `infra/supabase/migrations/` — all migration files for index and policy history

**Edge functions:**
- `infra/supabase/functions/feed/index.ts`
- `infra/supabase/functions/enrich-dish/index.ts`
- `infra/supabase/functions/group-recommendations/index.ts`
- `infra/supabase/functions/daily-feed/index.ts`

**Mobile services (query patterns):**
- `apps/mobile/src/services/` — all service files
- `apps/mobile/src/stores/` — Zustand store definitions
- `apps/mobile/src/screens/` — component rendering patterns

**Web portal:**
- `apps/web-portal/src/` — Next.js pages and components

**Shared:**
- `packages/database/` — Supabase client setup and generated types

## Progress Log

- [x] Domain 1: Database performance investigation complete → `findings/database.md`
- [x] Domain 2: Edge function performance investigation complete → `findings/edge-functions.md`
- [x] Domain 3: Mobile app rendering investigation complete → `findings/mobile-rendering.md`
- [x] Domain 4: API payload & network investigation complete → `findings/api-payload.md`
- [x] Domain 5: Caching strategy investigation complete → `findings/caching.md`
- [x] Domain 6: Bundle & startup time investigation complete → `findings/bundle-startup.md`
- [x] Summary report written → `findings/summary.md` with top 10 ranked findings

---

The orchestrator will continue iterations until all domains are investigated and the summary is written.

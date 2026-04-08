# Database Performance Findings

## Investigation Date: 2026-04-07

---

### [High] Missing Indexes on Frequently Filtered Columns

**File(s):** `infra/supabase/migrations/database_schema.sql`
**Severity:** High
**Effort:** Easy (< 1 day)

**Current behavior:**
The database schema shows only 3 custom indexes (on `dishes.parent_dish_id`, `dishes.is_parent`, and `dishes.enrichment_review_status` from migrations 073/074). Key filtered columns lack indexes:
- `favorites.user_id` + `favorites.subject_type` — queried on every feed load (`feed/index.ts:449`) and favorites screen
- `user_dish_interactions.user_id` + `user_dish_interactions.interaction_type` — queried on every feed load (`feed/index.ts:432`)
- `eat_together_members.session_id` + `eat_together_members.left_at` — queried by every RLS policy check via `private.is_eat_together_participant()` (`075_fix_eat_together.sql:27`)
- `session_views.user_id` + `session_views.entity_type` — queried by `viewHistoryService.ts:29`
- `dish_ingredients.dish_id` — queried by `enrich-dish/index.ts:361` and `RestaurantDetailScreen.tsx:398`
- `eat_together_votes.session_id` — queried by `get_vote_results()` RPC

**Root cause:**
Migrations created the tables but didn't add composite indexes for the most common query patterns. PostgreSQL primary keys provide an index, but the query patterns use non-PK columns as filters.

**Proposed fix:**
```sql
CREATE INDEX idx_favorites_user_subject ON favorites(user_id, subject_type);
CREATE INDEX idx_interactions_user_type ON user_dish_interactions(user_id, interaction_type);
CREATE INDEX idx_eat_members_session_left ON eat_together_members(session_id, left_at);
CREATE INDEX idx_session_views_user_type ON session_views(user_id, entity_type);
CREATE INDEX idx_dish_ingredients_dish ON dish_ingredients(dish_id);
CREATE INDEX idx_eat_votes_session ON eat_together_votes(session_id);
```

**Estimated impact:**
Reduces sequential scan time on these tables from O(n) to O(log n). Most impactful on `eat_together_members` (called per-row by RLS) and `user_dish_interactions` (called every feed request).

---

### [High] RLS Policy Overhead on Eat Together Tables

**File(s):** `infra/supabase/migrations/075_fix_eat_together.sql:57-101`
**Severity:** High
**Effort:** Medium (1–3 days)

**Current behavior:**
All 4 eat_together tables have SELECT policies that call `private.is_eat_together_participant(session_id)` — a SECURITY DEFINER function that queries `eat_together_members` for every row. The function is correctly wrapped in `(SELECT ...)` for initPlan caching, and uses `(SELECT auth.uid())` for per-statement caching.

However, the `eat_together_members` policy at line 74 has a self-referential pattern:
```sql
USING (
  auth.uid() = user_id
  OR (SELECT private.is_eat_together_participant(session_id))
)
```
This means reading `eat_together_members` triggers an RLS check that reads `eat_together_members` again. PostgreSQL handles this without infinite recursion because the SECURITY DEFINER function bypasses RLS, but it still doubles the query work.

**Root cause:**
The participant check function scans `eat_together_members` without a composite index on `(session_id, user_id, left_at)`, and is called per-row during RLS evaluation.

**Proposed fix:**
1. Add the composite index: `CREATE INDEX idx_eat_members_session_user ON eat_together_members(session_id, user_id) WHERE left_at IS NULL;`
2. For `eat_together_members` itself, simplify the policy to avoid the double-read: rely on `auth.uid() = user_id` for own rows, and use a subquery against `eat_together_sessions` for session membership validation instead.

**Estimated impact:**
Eliminates the double-scan on `eat_together_members` during RLS evaluation. Critical for the Eat Together feature where realtime subscriptions trigger frequent reads.

---

### [Medium] Over-fetching with .select('*') on Large Tables

**File(s):**
- `apps/mobile/src/services/eatTogetherService.ts:127,146,185,399,529`
- `apps/mobile/src/screens/RestaurantDetailScreen.tsx:393`
- `apps/mobile/src/services/dishPhotoService.ts:136`
- `infra/supabase/functions/nearby-restaurants/index.ts:181-200`

**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
Multiple queries use `.select('*')` on tables with many columns:
- `eat_together_sessions` (10 columns) — queried 5 times with `*`
- `eat_together_members` (7 columns) — queried with `*`
- `dish_photos` (6 columns) — queried with `*`
- `nearby-restaurants` Edge Function fetches `restaurants.*` (25+ columns) with nested `menus.*` and `dishes.*`

**Root cause:**
Convenience-first development — `select('*')` was used during rapid feature development and never narrowed.

**Proposed fix:**
Replace `select('*')` with explicit column lists. For example in `eatTogetherService.ts:127`:
```typescript
.select('id, host_id, session_code, status, location_mode, created_at, expires_at')
```

**Estimated impact:**
Reduces payload size per query by ~40-60%. Most impactful on the `nearby-restaurants` function which returns full restaurant objects including `open_hours` (large JSONB) and `restaurant_vector` (1536-dim float array) — neither is needed by the mobile client.

---

### [Medium] nearby-restaurants Edge Function Fetches ALL Restaurants

**File(s):** `infra/supabase/functions/nearby-restaurants/index.ts:180-201`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
The `nearby-restaurants` Edge Function fetches ALL restaurants with `.select('*', menus(...))` then filters by distance in JavaScript using Haversine formula. There's no PostGIS spatial query — it loads the entire `restaurants` table.

```typescript
let query = supabase
  .from('restaurants')
  .select(`*, menus (id, name, is_active, dishes (...))`)
  .order('created_at', { ascending: false });
```

**Root cause:**
This was the original pre-Phase 5 implementation. The `feed` Edge Function now handles spatial queries via `generate_candidates` RPC with PostGIS. The `nearby-restaurants` function is noted as deprecated (line 143: "monitoring whether any client still calls this endpoint").

**Proposed fix:**
1. Verify no clients call `nearby-restaurants` (the telemetry log at line 145 should confirm this)
2. Remove the function from the registry, or redirect to the `feed` function
3. Remove `geoService.ts` calls to `nearby-restaurants` from the mobile app

**Estimated impact:**
Eliminates a full table scan + nested join that returns megabytes of data. Already mostly mitigated by the feed migration, but the function is still deployed and callable.

---

### [Low] pg_cron Session Expiry — Low Contention Risk

**File(s):** `infra/supabase/migrations/075_fix_eat_together.sql:192-201`
**Severity:** Low
**Effort:** N/A (no change needed)

**Current behavior:**
The `expire-eat-together-sessions` cron job runs every 5 minutes:
```sql
UPDATE public.eat_together_sessions
SET status = 'expired', closed_at = now()
WHERE status NOT IN ('decided', 'cancelled', 'expired')
  AND expires_at < now()
```

**Root cause:**
N/A — this is well-designed. The WHERE clause is narrow (only non-terminal + past-expiry), and eat_together_sessions is a small table. At 5-minute intervals, each run will affect very few rows.

**Proposed fix:**
No change needed. The contention risk is negligible. Consider adding an index on `(status, expires_at)` only if the table grows to >10K rows.

**Estimated impact:**
N/A — confirming no action required.

---

### [Medium] get_vote_results() RPC — Well-Designed In-DB Aggregation

**File(s):** `infra/supabase/migrations/075_fix_eat_together.sql:143-177`
**Severity:** Low
**Effort:** N/A

**Current behavior:**
`get_vote_results()` performs aggregation in the database (GROUP BY, COUNT, ARRAY_AGG) and returns summary rows — not raw vote data. This is the correct pattern.

**Root cause:**
N/A — this is well-implemented.

**Proposed fix:**
No change needed. The only minor improvement would be adding an index on `eat_together_votes(session_id)` (covered in the indexes finding above).

**Estimated impact:**
N/A — confirming good pattern.

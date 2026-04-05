# Code Review: EatMe Monorepo Audit — Initial Findings

## Files Reviewed (Primary Pass)
- [x] `infra/supabase/migrations/database_schema.sql` (authoritative schema snapshot)
- [x] `infra/supabase/migrations/041a_ensure_rls_enabled.sql` (RLS coverage)
- [x] `infra/supabase/migrations/008a_add_admin_role_with_security.sql` (RLS policies, partial)
- [x] `.env.local`, `.env.example`, `.gitignore`
- [x] `apps/web-portal/lib/supabase.ts`, `apps/web-portal/lib/supabase-server.ts`
- [x] `apps/web-portal/app/api/ingredients/route.ts`
- [x] `apps/web-portal/app/api/menu-scan/route.ts`
- [x] `.github/copilot-instructions.md`
- [x] Full file tree across `apps/mobile/src/`, `apps/web-portal/`, `packages/`, `infra/supabase/migrations/`

## Summary
COMMENT — Primary adversarial pass complete. Deep analysis needed.

## Critical Issues (Must Fix)

### C1. RLS Policies Missing for Many Tables (Security — High)
While `041a_ensure_rls_enabled.sql` correctly enables RLS on all tables, **many tables have RLS enabled but no SELECT/INSERT/UPDATE/DELETE policies defined** in the migration files. Tables with RLS enabled but no visible policies in migrations:
- `user_preferences` — no explicit policies found
- `user_sessions` — no policies found
- `user_visits` — no policies found
- `user_points` — no policies found
- `user_behavior_profiles` — no policies found
- `user_dish_interactions` — no policies found
- `dish_opinions` — no policies found
- `dish_analytics` — no policies found
- `dish_categories` — no policies found
- `menu_categories` — no policies found
- `option_groups`, `options` — no policies found (not even in 041a RLS list)
- `eat_together_sessions`, `eat_together_members`, `eat_together_votes`, `eat_together_recommendations` — no policies found
- `session_views` — no policies found
- `restaurant_experience_responses` — no policies found

**Impact**: With RLS enabled but no policies, these tables default to **deny all** for non-service-role connections. This means the mobile app (using anon key) likely cannot read/write these tables, making features non-functional unless all queries route through service-role.

### C2. `option_groups` and `options` Tables Missing from RLS Audit
Migration `041a_ensure_rls_enabled.sql` does not include `option_groups` or `options` tables. These were created in a later migration but never had RLS enabled.

## Suggestions (Should Consider)

### S1. Extensive `any` Usage in restaurantService.ts
`apps/web-portal/lib/restaurantService.ts` uses `any` type in at least 10 places for Supabase query result mapping (lines 110, 118, 119, 125, 126, 129, 135, 136, 161, 168, 85). This bypasses TypeScript safety on the most data-intensive service file.

### S2. Menu Scan API — No Request Body Size Limit
`/api/menu-scan` accepts up to 20 base64-encoded images with no size cap per image. A malicious admin could send extremely large payloads causing OOM.

### S3. `ilike` Pattern Injection in Ingredient Queries
`queryAlias()` in menu-scan route.ts uses `ilike('display_name', \`%${term}%\`)` where `term` comes from GPT output. While Supabase parameterizes this, the `%` wildcards mean a crafted ingredient name with `%` or `_` characters could produce unexpected matches.

### S4. Database Schema Snapshot Missing RLS Policies and Functions
The `database_schema.sql` file contains only CREATE TABLE statements — no RLS policies, triggers, or functions. This makes it incomplete as a ground-truth reference. The actual RLS state must be reconstructed from individual migration files.

## Highest-Risk Area for Deep Analysis
**Database schema + RLS policy completeness**: The gap between "RLS enabled on all tables" and "actual policies defined" is the single biggest security concern. A full reconciliation of every table → its RLS policies → what operations each role can perform is needed to produce accurate `database-schema.md` documentation and identify real security gaps.

---

# Deep Analysis: RLS Policy Reconciliation (2026-04-04)

Full migration-by-migration policy trace. Corrects the primary pass finding C1 — most tables DO have policies, but they were in migrations not yet reviewed. The real issues are worse: policy name mismatches causing stale permissive policies, a privilege escalation vector, and broken session visibility.

## Complete RLS Policy Map

### Tables WITH correct policies (no issues found)
| Table | Migration(s) | Operations covered |
|---|---|---|
| users | 006a | SELECT (public), UPDATE (own) |
| user_preferences | 017a, 022 | SELECT/INSERT/UPDATE/DELETE (own) |
| user_sessions | 007b | SELECT/INSERT/UPDATE (own) |
| user_swipes | 012b | INSERT/SELECT (own), ALL (service_role) |
| user_visits | 007b | SELECT/INSERT/UPDATE (own) |
| user_points | 007b | SELECT/INSERT (own) |
| user_behavior_profiles | 013b | SELECT/UPDATE (own), ALL (service_role) |
| user_dish_interactions | 017a | SELECT/INSERT (own) |
| dish_photos | 006b | Full CRUD (own) |
| dish_opinions | 007b | Full CRUD (own for write, public read) |
| dish_analytics | 014a | SELECT (public), ALL (service_role) |
| dish_ingredients | 011a | SELECT (public), manage (owner) |
| session_views | 007b | SELECT/INSERT (own) |
| restaurant_experience_responses | 007b | SELECT (public), INSERT (own) |
| ingredients_master | 010 | SELECT (public), CRUD (admin) |
| allergens | 010 | SELECT (public), CRUD (admin) |
| dietary_tags | 010 | SELECT (public), CRUD (admin) |
| ingredient_allergens | 010 | SELECT (public), INSERT/DELETE (admin) |
| ingredient_dietary_tags | 010 | SELECT (public), INSERT/DELETE (admin) |
| canonical_ingredients | 012a | SELECT (public), write (admin) |
| ingredient_aliases | 012a | SELECT (public), write (admin) |
| canonical_ingredient_allergens | 012a | SELECT (public), write (admin) |
| canonical_ingredient_dietary_tags | 012a | SELECT (public), write (admin) |
| menu_categories | 016b | SELECT (public), manage (owner) |
| admin_audit_log | 008a | SELECT (admin), no INSERT/UPDATE/DELETE |
| menu_scan_jobs | 042a | ALL (admin via is_admin()) |
| security_documentation | 042a | SELECT (authenticated) |
| option_groups | 053 | CRUD (owner), SELECT (public) |
| options | 053 | CRUD (owner via group), SELECT (public) |
| favorites | 064 | SELECT/INSERT/DELETE (own) |

### Tables WITH policy issues (see findings below)
| Table | Issue |
|---|---|
| restaurants | F-001: stale 005 policies + 008a accumulation |
| menus | F-001: stale 005 policies + 008a + 016b accumulation |
| dishes | F-001: stale 005 policies + 008a(broken) + 067(fix) accumulation |
| dish_categories | F-006: any authenticated user can manage |
| eat_together_sessions | F-003: non-host members can't view |
| eat_together_members | F-004: USING(true) leaks cross-session data |
| eat_together_votes | F-004: USING(true) leaks cross-session data |
| eat_together_recommendations | F-004: USING(true) leaks cross-session data |

## Critical Findings

### F-001 [CRITICAL] — Stale permissive policies from migration 005 never dropped

**Problem:** Migration `008a_add_admin_role_with_security.sql` attempts to drop old policies before creating stricter admin+owner ones. However, the DROP statements target **wrong policy names** that don't match what migration 005 created.

| 008a drops (wrong name) | 005 actually created |
|---|---|
| `"Users can only view own restaurant"` | `"Anyone can read restaurants"` |
| `"Users can only update own restaurant"` | `"Users can update own restaurants"` |
| `"Users can only delete own restaurant"` | `"Users can delete own restaurants"` |

**Impact — restaurants DELETE bypass:** 008a creates `"Only admins can delete restaurants"` intending to restrict deletion to admins. But 005's `"Users can delete own restaurants"` (USING `auth.uid() = owner_id`) is **never dropped**. PostgreSQL RLS uses OR semantics across policies — if *either* policy grants access, the operation proceeds. Any restaurant owner can delete their own restaurant, bypassing the admin-only intent.

**Same pattern affects menus:**
- 005 creates: `"Users can delete own restaurant menus"` — never dropped by 008a
- 008a creates: `"Only admins can delete menus"` — intended to restrict deletion
- Result: owners can still delete their own menus

**Same pattern affects dishes:**
- 005 creates: `"Users can delete own restaurant dishes"` — never dropped by 008a or 067
- 067 drops 008a's dish policies but not 005's
- Result: owners can still delete their own dishes despite `"Only admins can delete dishes"` from 067

**Affected files:** `infra/supabase/migrations/005_add_authentication.sql`, `008a_add_admin_role_with_security.sql`, `067_fix_dishes_rls_policies.sql`

**Suggested fix:** Create a new migration that explicitly drops all legacy 005 policies by their correct names:
```sql
DROP POLICY IF EXISTS "Anyone can read restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can update own restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can delete own restaurants" ON restaurants;
DROP POLICY IF EXISTS "Anyone can read menus" ON menus;
DROP POLICY IF EXISTS "Users can create menus for own restaurants" ON menus;
DROP POLICY IF EXISTS "Users can update own restaurant menus" ON menus;
DROP POLICY IF EXISTS "Users can delete own restaurant menus" ON menus;
DROP POLICY IF EXISTS "Anyone can read dishes" ON dishes;
DROP POLICY IF EXISTS "Users can create dishes for own restaurants" ON dishes;
DROP POLICY IF EXISTS "Users can update own restaurant dishes" ON dishes;
DROP POLICY IF EXISTS "Users can delete own restaurant dishes" ON dishes;
```
Note: The "Anyone can read" policies may be intentionally needed for consumer-facing reads. If so, re-create with clear naming after cleanup.

---

### F-002 [CRITICAL] — is_admin() retains user-editable raw_user_meta_data fallback

**Problem:** Migration `042a_fix_security_advisor_findings.sql` correctly identifies that `raw_user_meta_data` is editable by end-users via `supabase.auth.updateUser({ data: { role: 'admin' } })`. The fix migrates `is_admin()` to check `raw_app_meta_data` first, but retains a fallback to `raw_user_meta_data` during a "transition period."

**No subsequent migration removes this fallback.** The TODO comment in 042a (line 181) says to remove it once all admins are migrated — this was never done.

**Impact:** Any authenticated user can call `supabase.auth.updateUser({ data: { role: 'admin' } })` from a client to set `raw_user_meta_data->>'role' = 'admin'`, and `is_admin()` will return true. This grants admin access to:
- All restaurants (view/update/delete via 008a policies)
- All menus (view/update/delete via 008a policies)
- All dishes (view/update/insert/delete via 067 policies)
- Admin audit log (view via 008a)
- Menu scan jobs (full CRUD via 042a)
- Dish categories (manage via 025)
- Admin dashboard stats (view)

**Affected file:** `infra/supabase/migrations/042a_fix_security_advisor_findings.sql:175-186`

**Suggested fix:** New migration removing the `raw_user_meta_data` fallback:
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth AS $$
BEGIN
  RETURN COALESCE(
    (SELECT raw_app_meta_data->>'role' = 'admin' FROM auth.users WHERE id = auth.uid()),
    false
  );
END;
$$;
```

---

### F-003 [HIGH] — eat_together_sessions SELECT policy breaks non-host members

**Problem:** Migration `019_fix_eat_together_rls_recursion.sql` fixed infinite recursion by simplifying policies. The sessions SELECT policy was replaced with:
```sql
USING (auth.uid() = host_id)
```

The original policy from 018 (`"Users can view sessions they're member of"`) checked membership via a subquery to `eat_together_members`. Migration 019 dropped this and only kept the host check.

**Impact:** Non-host members of an eat-together session **cannot view the session** via the authenticated client. The feature is functionally broken for all participants except the host.

**Affected file:** `infra/supabase/migrations/019_fix_eat_together_rls_recursion.sql:32-35`

**Suggested fix:** Restore member-inclusive SELECT without recursion:
```sql
CREATE POLICY "Users can view sessions" ON eat_together_sessions
  FOR SELECT USING (
    auth.uid() = host_id
    OR id IN (SELECT session_id FROM eat_together_members WHERE user_id = auth.uid())
  );
```
This avoids recursion because `eat_together_members` SELECT now uses `USING (true)`.

---

### F-004 [MEDIUM] — Overly permissive eat_together read policies expose cross-session data

**Problem:** Migration 019 simplified read policies for `eat_together_members`, `eat_together_recommendations`, and `eat_together_votes` to `USING (true)`.

**Impact:** Any authenticated user can read **all** members, recommendations, and votes across **all** sessions, not just sessions they participate in.

**Information leaked:** User IDs of all session participants, all vote choices, all recommendation data.

**Affected file:** `infra/supabase/migrations/019_fix_eat_together_rls_recursion.sql:38-90`

---

### F-005 [MEDIUM] — Policy accumulation: 6+ overlapping policies per core table

**Problem:** Due to sequential migrations that don't fully clean up predecessors, the `restaurants` table likely has 7+ active policies simultaneously from migrations 005 and 008a. Similar accumulation on `menus` (005 + 008a + 016b) and `dishes` (005 + 067).

**Impact:** Makes security reasoning extremely difficult. The effective policy is the OR-union of all active policies, meaning the most permissive one always wins. Direct cause of F-001.

**Suggested fix:** Consolidation migration that drops ALL policies on core tables and recreates a clean, minimal set.

---

### F-006 [LOW] — dish_categories policy allows any authenticated user to manage

**Problem:** Migration `025_add_dish_categories_and_menu_type.sql:95` creates:
```sql
CREATE POLICY "Authenticated users can manage dish categories"
  ON dish_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**Impact:** Any authenticated user can INSERT, UPDATE, or DELETE dish categories for any restaurant. Should be scoped to restaurant ownership or admin role.

**Affected file:** `infra/supabase/migrations/025_add_dish_categories_and_menu_type.sql:95`

---

### Correction to Primary Pass Finding C1

The primary pass (C1) listed ~15 tables as "missing policies." This was incorrect — policies exist in migration files that hadn't been reviewed yet (007b, 010, 012a, 012b, 013b, 014a, 016b, 017a, 018/019, 022, 025, 053, 064). The corrected picture shows **all 35 tables with RLS have policies**, but 8 tables have **flawed** policies (F-001 through F-006).

### Correction to Primary Pass Finding C2

`option_groups` and `options` DO have RLS enabled — in migration `053_option_groups.sql:73-74` which was created after 041a. They also have proper owner + public-read policies. Not an issue.

---

# Step 3: Web Portal & Mobile App Feature Audit (2026-04-04)

Deep analysis of all web portal routes/components/services and mobile screens/stores/services. Adversarial focus on type safety, error handling, dead code, and feature completeness.

## F-007 [HIGH] — Pervasive `any` type usage defeats TypeScript safety (80+ occurrences)

**Problem:** Both apps use `any` extensively, concentrated in the highest-data-volume code paths:

**Web portal (30+ occurrences):**
- `restaurantService.ts` — 14 `any` casts on Supabase query results (lines 110, 118, 119, 125, 126, 129, 135, 136, 161, 168). Every menu/dish/category mapping is untyped.
- `DishFormDialog.tsx` — `zodResolver(dishSchema) as any` (line 103) silences Zod/RHF type mismatch; `(dish as any).description_visibility` (lines 155-156) accesses fields that should be in the Dish type.
- `DishCard.tsx` — `(dish as any).selectedIngredients` (lines 104, 108) casts through type system.
- `NewRestaurantForm.tsx` — `insertData as any` (lines 288, 293) and `catch (err: any)` (line 301).
- `ingredients.ts:85` — `(row: any)` on ingredient query results.

**Mobile app (55+ occurrences):**
- `RestaurantDetailScreen.tsx` — 20+ `any` casts: `(restaurant as any).payment_methods` (line 211), `handleDishPress(dish: any)` (line 277), `renderMenuItem(item: any)` (line 389), `(selectedDish as any).dish_kind` (line 771), menu/category iteration (lines 537, 541).
- `BasicMapScreen.tsx` — `(menu as any).dishes` (line 166), `dish as any` (line 220), `pointsEarned: any` (line 519).
- `eatTogether/` screens — `useState<any>(null)` (CreateSessionScreen:34), `data as any` (RecommendationsScreen:65), `(v: any)` throughout vote handling.
- `VotingResultsScreen.tsx` — `(winner as any).restaurant?.name` (lines 117-118, 126), `(result: any, index)` (line 142) — effectively all rendering is untyped.
- `geoService.ts` — `appliedFilters: any` (line 75), `filters: any` (line 82) in the API response/request types.
- `eatTogetherService.ts` — `dietary_compatibility: any` (line 39), `restaurant?: any` (line 41), return type `any[]` on getVoteResults (line 357).
- `userPreferencesService.ts:167` — `(supabase.from('user_preferences') as any).upsert(...)` — casts the entire Supabase query builder to bypass type checking on the upsert call.

**Impact:** Type errors are invisible at compile time. A renamed column, changed shape, or null field causes silent runtime failures. The `as any` casts on Supabase query builders specifically mean the generated types from the database schema are being thrown away exactly where they'd be most useful.

**Affected files:** `apps/web-portal/lib/restaurantService.ts`, `apps/web-portal/components/forms/DishFormDialog.tsx`, `apps/web-portal/components/forms/DishCard.tsx`, `apps/web-portal/components/admin/NewRestaurantForm.tsx`, `apps/web-portal/lib/ingredients.ts`, `apps/mobile/src/screens/RestaurantDetailScreen.tsx`, `apps/mobile/src/screens/BasicMapScreen.tsx`, `apps/mobile/src/screens/eatTogether/*.tsx`, `apps/mobile/src/services/geoService.ts`, `apps/mobile/src/services/eatTogetherService.ts`, `apps/mobile/src/services/userPreferencesService.ts`

**Suggested fix:** Generate Supabase types via `supabase gen types typescript` and use them as the source of truth. Replace `any` with derived types from the generated schema. For `restaurantService.ts`, define intermediate mapped types for menus/dishes/categories.

---

## F-008 [HIGH] — Unchecked Supabase errors on destructive operations

**Problem:** Multiple Supabase `.delete()` and `.insert()` calls ignore the returned `{ error }`:

1. **`restaurantService.ts:298`** — `saveMenus()` calls `supabase.from('menus').delete().eq('restaurant_id', restaurantId)` but never checks the error. If the delete fails, the subsequent insert creates duplicates with no recovery path.

2. **`restaurantService.ts:464`** — `saveOptionGroupsForDish()` calls `supabase.from('option_groups').delete().eq('dish_id', dishId)` without checking the error. If the delete fails silently, the loop below creates duplicate option groups.

3. **`eatTogetherService.ts:96-100`** — `createSession()` adds the host as a member after session creation but doesn't check the error from the insert: `await supabase.from('eat_together_members').insert({...})`. If this fails, the session exists but the host isn't a member, breaking the entire flow.

4. **`_deleteOldMenuData:521-529`** — Two delete operations on `dishes` table check no errors; only the final `menus` delete is checked.

**Impact:** Silent data corruption. The user sees "success" while the database is in an inconsistent state. Particularly dangerous for `saveMenus()` where a delete failure + successful insert = permanent menu duplication.

**Affected files:** `apps/web-portal/lib/restaurantService.ts:298,464,521-529`, `apps/mobile/src/services/eatTogetherService.ts:96-100`

**Suggested fix:** Check all `{ error }` returns from Supabase operations. For critical paths (saveMenus), throw on failure. For non-fatal paths (deleteOldMenuData), log but continue.

---

## F-009 [MEDIUM] — `searchUsersByProfileName` is vulnerable to ilike pattern injection

**Problem:** `eatTogetherService.ts:429-431` passes user-controlled `searchQuery` directly into an `ilike` filter:
```typescript
.ilike('profile_name', `%${searchQuery}%`)
```
If a user enters `%` or `_` characters in the search field, they can craft wildcard patterns that return all users or perform expensive pattern matching.

**Impact:** Information disclosure — a malicious user could enumerate all profiles by searching for `%`. Also potential for slow queries with pathological patterns like `%_%_%_%`.

**Affected file:** `apps/mobile/src/services/eatTogetherService.ts:431`

**Suggested fix:** Escape `%` and `_` characters in the search query before interpolation, or use Supabase's `.textSearch()` instead.

---

## F-010 [MEDIUM] — Dead/unwired code: export.ts, search/rewards stubs, commented-out geospatial loader

**Problem:** Several code paths are fully implemented but never called, or are placeholder stubs:

1. **`apps/web-portal/lib/export.ts`** — Complete JSON/CSV export with 157 lines of working code, explicitly documented as "NOT YET wired to any UI button" (line 4). Dead code.

2. **`apps/mobile/src/screens/BasicMapScreen.tsx:540-544`** — `handleSearchRestaurant()` and `handleViewRewards()` are stubs that show "Coming Soon" alerts. They're wired to the RatingFlowModal callbacks but do nothing useful.

3. **`apps/mobile/src/screens/BasicMapScreen.tsx:320-349`** — 30 lines of commented-out `loadNearbyDataStable` code with a `TODO: Fix edge function deployment and re-enable`. This is the geospatial restaurant loading via the restaurantStore — currently disabled, meaning `nearbyRestaurants` is always empty and the dishes extracted from it are always empty. The map relies entirely on the separate `getFilteredRestaurants` edge function call.

4. **`apps/mobile/src/screens/RestaurantDetailScreen.tsx:254-256`** — Review and Share menu options show "Coming Soon" alerts.

**Impact:** Increases bundle size and maintenance burden. The commented-out geospatial code means the `dishes` useMemo (line 161) and `restaurants` useMemo (line 133) produce empty arrays — dead computation on every render.

**Affected files:** `apps/web-portal/lib/export.ts`, `apps/mobile/src/screens/BasicMapScreen.tsx:320-349,540-544`, `apps/mobile/src/screens/RestaurantDetailScreen.tsx:254-256`

---

## F-011 [MEDIUM] — Navigation type safety bypassed with `as any` casts across mobile app

**Problem:** React Navigation's type system is being circumvented throughout the mobile app with `navigation.navigate('ScreenName' as any)`:
- `ProfileScreen.tsx:123,127` — `navigate('ProfileEdit' as any)`, `navigate('OnboardingStep1' as any)`
- `EatTogetherScreen.tsx:93,102` — `navigate('CreateSession' as any)`, `navigate('JoinSession' as any)`
- `SessionLobbyScreen.tsx:108,138` — `navigate('Recommendations' as any, { sessionId })`
- `CreateSessionScreen.tsx:70,121` — `navigate('SessionLobby' as any, { sessionId })`
- `RecommendationsScreen.tsx:120` — `navigate('VotingResults' as any, { sessionId })`
- `VotingResultsScreen.tsx:88,171` — `navigate('EatTogether' as any)`

**Impact:** If a screen is renamed or its params change, TypeScript cannot catch the error. Navigation crashes at runtime instead of at compile time. The `RootStackParamList` in `types/navigation.ts` likely doesn't include all these screen names, causing the cast to be required.

**Affected files:** `apps/mobile/src/screens/ProfileScreen.tsx`, `apps/mobile/src/screens/EatTogetherScreen.tsx`, `apps/mobile/src/screens/eatTogether/*.tsx`

**Suggested fix:** Add all screen names and their param types to `RootStackParamList` in `types/navigation.ts` so navigation is fully type-safe without `as any`.

---

## F-012 [MEDIUM] — `DishFormDialog` silences Zod resolver type mismatch

**Problem:** `apps/web-portal/components/forms/DishFormDialog.tsx:103` uses:
```typescript
resolver: zodResolver(dishSchema) as any
```
This `as any` hides a type mismatch between the Zod schema and the React Hook Form type parameter. If the form's field types don't match the schema, validation passes but data is silently the wrong type.

Additionally, lines 155-156 access `(dish as any).description_visibility` and `(dish as any).ingredients_visibility`, suggesting the Dish type definition doesn't include these fields even though they exist in the database schema.

**Impact:** Form validation may not catch invalid data. The `as any` on the resolver is especially dangerous because it's the last type-safety barrier before data hits the database.

**Affected file:** `apps/web-portal/components/forms/DishFormDialog.tsx:103,155-156`

---

## F-013 [LOW] — `eat_together` screens don't handle service errors shown to users

**Problem:** Multiple eat-together screens call service functions but ignore or poorly handle the `{ error }` return:

- `RecommendationsScreen.tsx:65` — `setRecommendations(data as any)` after `getRecommendations()` without checking `error`. If the RPC fails, `data` is null and the component crashes on `.map()`.
- `RecommendationsScreen.tsx:82` — `getVotes()` result used without null check on `data`.
- `VotingResultsScreen.tsx` — `getVoteResults()` called in useEffect but error handling only logs; if data is null, `voteResults.reduce(...)` on line 98 crashes.

**Impact:** Unhandled null references cause white-screen crashes in the eat-together flow.

**Affected files:** `apps/mobile/src/screens/eatTogether/RecommendationsScreen.tsx`, `apps/mobile/src/screens/eatTogether/VotingResultsScreen.tsx`

---

## Summary of Step 3 Findings

| ID | Severity | Category | Summary |
|---|---|---|---|
| F-007 | HIGH | Type Safety | 80+ `any` usages across both apps, concentrated in data-intensive paths |
| F-008 | HIGH | Error Handling | Unchecked Supabase errors on delete/insert in restaurantService and eatTogetherService |
| F-009 | MEDIUM | Security | ilike pattern injection in user search |
| F-010 | MEDIUM | Dead Code | Unwired export.ts, disabled geospatial loader, Coming Soon stubs |
| F-011 | MEDIUM | Type Safety | Navigation `as any` casts bypass React Navigation type checking |
| F-012 | MEDIUM | Type Safety | Zod resolver `as any` silences form validation type mismatch |
| F-013 | LOW | Error Handling | Eat-together screens crash on null service responses |

---

# Step 4: Documentation Staleness Audit (2026-04-04)

Adversarial cross-reference of every `docs/` file against actual codebase state. Each finding identifies a stale claim, the ground truth, and a suggested fix.

## D-001 — `supabase-integration-status.md`: Mobile Supabase marked "⏳ Planned" — actually implemented

**File:** `docs/supabase-integration-status.md:30-41`
**Stale claim:** Entire "⏳ Mobile App (In Progress)" section lists Supabase client setup, auth, nearby query, swipe feed, eat-together, preferences, and favorites as "⏳ Planned."
**Ground truth:** `apps/mobile/src/lib/supabase.ts` exists and is wired. Auth screens exist at `src/screens/auth/` and are connected to Supabase. The `feed` Edge Function is called from `edgeFunctionsService.ts`. Eat-together screens are wired to `eatTogetherService.ts`. Favorites service + table exist (migration 064). User preferences are persisted via `userPreferencesService.ts`.
**Suggested fix:** Update every row in the Mobile table to reflect actual implementation status (most are ✅ Live or partially live).

---

## D-002 — `supabase-integration-status.md`: Migration count "40" — actually 71

**File:** `docs/supabase-integration-status.md:2,9`
**Stale claim:** "40 migrations have been applied." Schema Groups table only covers migrations up to 040.
**Ground truth:** 71 migration files exist (001–071), including option groups (053), embedding foundation (054), enrich-dish webhook (055), generate_candidates RPC (056), favorites (064), RLS fixes (067), protein families (070), and more.
**Suggested fix:** Update count to 71 and add rows for post-040 migration groups.

---

## D-003 — `supabase-integration-status.md`: Edge Functions list incomplete

**File:** `docs/supabase-integration-status.md:92-98`
**Stale claim:** Lists only 4 Edge Functions: nearby-restaurants, feed, swipe, group-recommendations.
**Ground truth:** 3 additional Edge Functions exist: `enrich-dish`, `batch-update-preference-vectors`, `update-preference-vector`.
**Suggested fix:** Add the 3 missing functions to the table.

---

## D-004 — `supabase-integration-status.md`: Security section claims admin role in `raw_user_meta_data` and "cannot be self-assigned"

**File:** `docs/supabase-integration-status.md:149`
**Stale claim:** "Admin role stored in `auth.users.raw_user_meta_data->>'role'` — cannot be self-assigned."
**Ground truth:** Migration `043_remove_user_metadata_admin_fallback.sql` moved `is_admin()` to check only `raw_app_meta_data`. The `raw_user_meta_data` fallback was removed. The statement about `raw_user_meta_data` is incorrect for the current schema.
**Suggested fix:** Update to: "Admin role stored in `auth.users.raw_app_meta_data->>'role'` (migration 043). Set only via server-side admin operations."

---

## D-005 — `ADMIN_SECURITY.md`: Admin role mechanism outdated

**File:** `docs/ADMIN_SECURITY.md:23-37`
**Stale claim:** "Admin Role: Stored in `auth.users.raw_user_meta_data->>'role'`" and SQL example sets `raw_user_meta_data`.
**Ground truth:** Migration 043 hardened `is_admin()` to only use `raw_app_meta_data`. The SQL example would create an admin that `is_admin()` ignores.
**Suggested fix:** Replace with `raw_app_meta_data` and update the SQL example to use `ALTER USER ... SET raw_app_meta_data`.

---

## D-006 — `WEB-01-authentication.md`: Claims implicit flow — actually PKCE

**File:** `docs/workflows/WEB-01-authentication.md:72-73`
**Stale claim:** "The code uses `flowType: 'implicit'` (hash-based tokens)" and the callback page "parses hash params from window.location.hash."
**Ground truth:** `apps/web-portal/lib/supabase.ts` now uses `@supabase/ssr`'s `createBrowserClient` which defaults to PKCE flow. Comment in the file says "Uses PKCE flow by default (replaces deprecated implicit/hash flow)."
**Suggested fix:** Update the doc to describe PKCE flow. Remove the "Why implicit flow?" sidebar.

---

## D-007 — `MOB-03-map-discovery.md`: References deleted `useRestaurants.ts` hook

**File:** `docs/workflows/MOB-03-map-discovery.md:24,53-55`
**Stale claim:** Lists `useRestaurants.ts` as a key file and describes it as a "Direct table query, used if geo store has no data."
**Ground truth:** `CODEBASE_IMPROVEMENTS.md` (N1.6) confirms this file was deleted ("zero callers outside the hook itself"). The file does not exist in the codebase.
**Suggested fix:** Remove `useRestaurants.ts` from the key files table and update the Data Sources section to reflect the current architecture (feed Edge Function + restaurantStore only).

---

## D-008 — `MOB-04-swipe.md`: Edge Function names wrong, `trackSwipe()` shelved

**File:** `docs/workflows/MOB-04-swipe.md:35,82-86,112-117`
**Stale claim:** References endpoints `/functions/v1/get-feed` and `/functions/v1/track-swipe`. Lists Edge Functions as `get-feed` and `track-swipe`.
**Ground truth:** Actual function directory names are `feed` and `swipe`. Furthermore, `edgeFunctionsService.ts:247` comments: "trackSwipe(), SwipeRequest, and generateSessionId() have been shelved."
**Suggested fix:** Correct function names to `feed` and `swipe`. Note that `trackSwipe()` is shelved and swipe recording is not currently active.

---

## D-009 — `MOB-09-rating-system.md`: References non-existent tables

**File:** `docs/workflows/MOB-09-rating-system.md:25-30`
**Stale claim:** Lists tables `user_dish_opinions`, `user_restaurant_feedback`, and `rating_points`.
**Ground truth:** No migration creates `user_restaurant_feedback` or `rating_points`. The actual table is `dish_opinions` (not `user_dish_opinions`). The rating service code references `dish_opinions` as the real table. `user_restaurant_feedback` and `rating_points` appear in zero code files and zero migrations.
**Suggested fix:** Correct to actual tables: `dish_opinions` for dish-level ratings, `user_visits` for visit tracking. Remove references to non-existent `user_restaurant_feedback` and `rating_points` tables. Note that gamification/points are a future feature (see `future-features.md`).

---

## D-010 — `TODO_LIST.md`: Multiple completed items still marked as TODO

**File:** `docs/TODO_LIST.md:10-14,56-57`
**Stale claims:**
1. "Create `apps/mobile/src/lib/supabase.ts`" — file already exists.
2. "Wire auth screens (`src/screens/auth/`) to `supabase.auth.signInWithPassword` / `signUp`" — auth screens are wired (MOB-01 workflow describes the implementation).
3. "Remove unused `SupabaseTestScreen.tsx`" — file does not exist (already removed).
4. "Replace all mock restaurant/dish data" — the feed Edge Function is wired; map uses server data.
**Suggested fix:** Move completed items to the "✅ Recently Completed" section or remove.

---

## D-011 — `SHARED-02-database-and-migrations.md`: Incorrect migration filenames

**File:** `docs/workflows/SHARED-02-database-and-migrations.md:25-33`
**Stale claim:** Lists duplicate migration pairs without a/b suffixes: `006_add_dish_photos.sql`, `006_create_user_profiles.sql`, etc.
**Ground truth:** Migration files use a/b suffix convention: `006a_create_user_profiles.sql`, `006b_add_dish_photos.sql`, `007a_change_location_to_jsonb.sql`, `007b_add_rating_system.sql`, etc.
**Suggested fix:** Update all filenames to match the actual a/b suffix naming convention. Note that the "duplicate migration" problem was resolved by the suffix convention.

---

## D-012 — `schema-erd.md`: Says "reflects migrations 001–040"

**File:** `docs/schema-erd.md:3`
**Stale claim:** "reflects migrations 001–040."
**Ground truth:** 71 migrations exist. Missing tables: `favorites` (064), `option_groups`/`options` (053), and columns added by migrations 041-071.
**Suggested fix:** Update to reflect all current migrations. Add `option_groups`, `options`, `favorites` tables and new columns to the ERD.

---

## D-013 — `diagrams-index.md`: Shows mobile auth as "⏳" pending

**File:** `docs/diagrams-index.md:28`
**Stale claim:** `MOBILE_AUTH[Supabase Auth ⏳]` in the architecture Mermaid diagram.
**Ground truth:** Mobile auth is implemented — `apps/mobile/src/lib/supabase.ts` exists, auth screens are functional.
**Suggested fix:** Change to `MOBILE_AUTH[Supabase Auth ✅]`.

---

## D-014 — `EDGE_FUNCTIONS_ARCHITECTURE.md`: Claims mobile is NOT wired to Edge Functions

**File:** `docs/EDGE_FUNCTIONS_ARCHITECTURE.md:16`
**Stale claim:** "Mobile app is **not yet wired** to these functions."
**Ground truth:** `edgeFunctionsService.ts` contains `getFeed()` which calls the `feed` Edge Function. `BasicMapScreen.tsx` calls both `getFeed()` (dishes mode) and `getFilteredRestaurants()` (restaurants mode) via the service.
**Suggested fix:** Update to reflect that the mobile app IS wired to the feed, nearby-restaurants, and group-recommendations functions.

---

## D-015 — `restaurant-partner-portal.md`: Describes localStorage-only Phase 1 as current state

**File:** `docs/restaurant-partner-portal.md:1-40`
**Stale claim:** Describes the portal as a "data collection" tool using localStorage without backend, with manual export to Supabase.
**Ground truth:** The web portal is fully connected to Supabase (auth, restaurant CRUD, ingredient system, admin dashboard). The Phase 1 description was accurate during early development but is no longer the current state.
**Suggested fix:** Add a banner noting this document is historical. Reference `supabase-integration-status.md` or `WEB-02-restaurant-onboarding.md` for the current architecture.

---

## D-016 — `ADMIN_IMPLEMENTATION.md`: References migration "008" without suffix

**File:** `docs/ADMIN_IMPLEMENTATION.md:12`
**Stale claim:** References `008_add_admin_role_with_security.sql`.
**Ground truth:** Actual filename is `008a_add_admin_role_with_security.sql`.
**Suggested fix:** Add the `a` suffix.

---

## D-017 — `beta-environment-setup.md`: Migration count and schema filename wrong

**File:** `docs/todos/beta-environment-setup.md:25,32`
**Stale claims:** "Migrations (41 files)" and references `databa_schema.sql` (typo — should be `database_schema.sql`).
**Ground truth:** 71 migration files. Schema file is `database_schema.sql`.
**Suggested fix:** Update file count and fix the typo.

---

## D-018 — `implementation-plan.md` (todos): Migration numbering outdated

**File:** `docs/todos/implementation-plan.md:24`
**Stale claim:** "Current latest is `046_add_ingredients_to_avoid.sql`. New migrations start at `047`."
**Ground truth:** Latest migration is `071_generate_candidates_exclude_params.sql`. Many of the changes planned in this document (option groups, embeddings, allergen trigger fixes) have been implemented.
**Suggested fix:** Update the baseline and mark implemented phases as complete.

---

## D-019 — `future-features.md`: References non-existent `profiles` table

**File:** `docs/future-features.md:9-14`
**Stale claim:** Proposes `ALTER TABLE profiles ADD COLUMN reward_points`.
**Ground truth:** No `profiles` table exists in the schema. The actual table is `user_profiles` (created in migration 006a) or the `users` view. The `rating_points` concept also appears in MOB-09 but is not implemented.
**Suggested fix:** Update table name to `user_profiles` if this plan is still relevant.

---

## D-020 — `WEB-03-restaurant-management.md`: Says export is triggered from dashboard

**File:** `docs/workflows/WEB-03-restaurant-management.md:45`
**Stale claim:** "Export Data → triggers CSV/JSON download via `lib/export.ts`."
**Ground truth:** `export.ts` itself documents at line 4: "NOT YET wired to any UI button." The export functionality exists but no dashboard button triggers it.
**Suggested fix:** Mark Export Data as "planned" rather than an active action card.

---

## D-021 — `MOB-02-user-onboarding.md`: Migration attribution error

**File:** `docs/workflows/MOB-02-user-onboarding.md:97`
**Stale claim:** "The `handle_new_user` Postgres trigger (migration `020`) creates a `user_profiles` row automatically."
**Ground truth:** The `handle_new_user` trigger was created in migration `006a_create_user_profiles.sql`. Migration `020_fix_handle_new_user_trigger.sql` is a *fix* to that trigger, not the original creation.
**Suggested fix:** Change to "migration `006a`" for the creation, note that `020` fixed it.

---

## D-022 — `CODEBASE_IMPROVEMENTS.md`: Multiple items marked ✅ that may be re-stale

**File:** `docs/CODEBASE_IMPROVEMENTS.md` (N1.1–N1.8, N2.1–N2.6)
**Observation:** Items marked ✅ were fixed on March 5, 2026, but subsequent code changes may have re-introduced issues. For example, N1.7 says `parseLocation()` was deleted from `BasicMapScreen.tsx`, but the screen has been significantly modified since. These items should be verified against the current codebase state before being trusted.
**Suggested fix:** Re-verify all ✅ items against the current code, or add a "verified date" column.

---

## D-023 — Correction to prior review finding F-002

**File:** `.eval-sandbox/review/findings.md` (F-002)
**Stale claim (in our own findings):** F-002 states "No subsequent migration removes this fallback" regarding `raw_user_meta_data` in `is_admin()`.
**Ground truth:** Migration `043_remove_user_metadata_admin_fallback.sql` explicitly removes the fallback. The `is_admin()` function in 043 checks ONLY `raw_app_meta_data`. F-002 was correct at the time of migration 042a, but 043 is the fix.
**Impact on findings:** F-002 severity should be downgraded from CRITICAL to RESOLVED. The fix is already in the migration chain.

---

## Summary — Documentation Staleness Audit

| ID | File | Category | Severity |
|---|---|---|---|
| D-001 | supabase-integration-status.md | Outdated status | HIGH — entire mobile section wrong |
| D-002 | supabase-integration-status.md | Outdated count | MEDIUM |
| D-003 | supabase-integration-status.md | Incomplete list | LOW |
| D-004 | supabase-integration-status.md | Security claim wrong | HIGH — misleading security doc |
| D-005 | ADMIN_SECURITY.md | Security mechanism wrong | HIGH — SQL example creates non-functional admins |
| D-006 | WEB-01-authentication.md | Auth flow wrong | MEDIUM |
| D-007 | MOB-03-map-discovery.md | Deleted file referenced | MEDIUM |
| D-008 | MOB-04-swipe.md | Wrong function names, shelved feature | MEDIUM |
| D-009 | MOB-09-rating-system.md | Non-existent tables | HIGH — describes phantom schema |
| D-010 | TODO_LIST.md | Completed items not updated | MEDIUM |
| D-011 | SHARED-02-database-and-migrations.md | Wrong filenames | LOW |
| D-012 | schema-erd.md | Outdated coverage | MEDIUM |
| D-013 | diagrams-index.md | Stale status marker | LOW |
| D-014 | EDGE_FUNCTIONS_ARCHITECTURE.md | Wrong wiring claim | MEDIUM |
| D-015 | restaurant-partner-portal.md | Entirely outdated framing | HIGH — misleads new readers |
| D-016 | ADMIN_IMPLEMENTATION.md | Filename without suffix | LOW |
| D-017 | beta-environment-setup.md | Count + typo | LOW |
| D-018 | implementation-plan.md | Outdated baseline | MEDIUM |
| D-019 | future-features.md | Wrong table name | LOW |
| D-020 | WEB-03-restaurant-management.md | Unwired feature as active | MEDIUM |
| D-021 | MOB-02-user-onboarding.md | Migration misattribution | LOW |
| D-022 | CODEBASE_IMPROVEMENTS.md | ✅ items may be stale | LOW |
| D-023 | findings.md (F-002) | Own finding corrected | CRITICAL downgrade → RESOLVED |

**Totals:** 4 HIGH, 8 MEDIUM, 11 LOW (including 1 correction to our own findings)

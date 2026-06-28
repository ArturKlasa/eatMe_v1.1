# Frozen Surface Inventory — Web Portal v2

Compiled: 2026-04-23. Source of truth for what v2 **cannot change (or must change with care)** because the mobile app and/or live v1 portal depend on it.

Everything here is referenced by `file:line` or migration filename. Section 1 (mobile direct Supabase queries) and Section 5 (consumer-facing Edge Functions / RPC) are the critical-path sections; other sections are breadth-check inventories.

---

## 1. Mobile direct Supabase queries

Exhaustive scan of `apps/mobile/src/` for `.from(...)`, `.rpc(...)`, `.channel(...)`, `.functions.invoke(...)` and `.storage.from(...)`. Rule for the **"Needs v2 patch?"** column: **YES** iff the call targets `restaurants`, `menus`, or `dishes` without an explicit `.eq('status', 'published')`. Missing `is_template=false` is noted but is not v2-patch scope (owner feed never had it; RLS doesn't hide template rows).

| File:line | Tables / RPC / Function / Channel | Operation | Filters applied | Needs v2 patch? |
|---|---|---|---|---|
| `apps/mobile/src/stores/restaurantStore.ts:126` | `restaurants` (nested `menus → menu_categories → dishes`) | SELECT | `.order('created_at')` | **YES** (restaurants + nested dishes, no status filter) |
| `apps/mobile/src/stores/restaurantStore.ts:159` | `dishes` (nested `menu_category`, `restaurant`) | SELECT | `.eq('is_available', true)`, `.order('created_at')`, `.limit(100)` | **YES** (dishes; no `status='published'`; also missing `is_template=false` — flag, not v2 scope) |
| `apps/mobile/src/stores/restaurantStore.ts:269` | `restaurants` (nested `menus → menu_categories`) | SELECT | `.eq('id', id).single()` | **YES** (single-restaurant detail path; nested `menus` also unfiltered) |
| `apps/mobile/src/stores/restaurantStore.ts:312` | `menu_categories` (nested `dishes → dish_ingredients, option_groups → options`) | SELECT | `.eq('id', categoryId).single()` | **YES** (nested dishes — also missing `is_template=false`) |
| `apps/mobile/src/hooks/useDish.ts:41` | `dishes` (nested `menu_category`, `restaurant`) | SELECT | `.eq('id', dishId).single()` | **YES** (single-dish fetch; RLS will catch draft rows but rough-idea calls for explicit filter) |
| `apps/mobile/src/screens/BasicMapScreen.tsx:491` | `dishes` (`menu_categories!inner(restaurant_id)`) | SELECT | `.eq('menu_categories.restaurant_id', restaurantId)` | **YES** (dishes + nested `menu_categories!inner`; no status filter on either) |
| `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:292` | `dish_photos` | SELECT | `.eq('dish_id', dish.id)`, `.order('created_at')` | no |
| `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:300` (cast) | `dish_ingredients` (joined `ingredient_concepts`, `ingredient_variants`, `canonical_ingredients`) | SELECT | `.eq('dish_id', dish.id)` | no |
| `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:316` | `canonical_ingredient_allergens` | SELECT | `.in('canonical_ingredient_id', …)` | no |
| `apps/mobile/src/screens/eatTogether/RecommendationsScreen.tsx:95` | `eat_together_votes` | SELECT | session guard | no |
| `apps/mobile/src/screens/eatTogether/RecommendationsScreen.tsx:111` | Realtime **channel** `votes_${sessionId}` | subscribe | – | no |
| `apps/mobile/src/screens/eatTogether/SessionLobbyScreen.tsx:116` | Realtime **channel** `session_${sessionId}` | subscribe | – | no |
| `apps/mobile/src/services/geoService.ts:132` | Edge Function `nearby-restaurants` (**invoke**) | RPC | body: `latitude, longitude, radiusKm, limit, filters` | patched inside the Edge Function (see §5); no mobile patch required |
| `apps/mobile/src/services/eatTogetherService.ts:70` | `rpc('generate_session_code')` | RPC | – | no |
| `apps/mobile/src/services/eatTogetherService.ts:79` | `eat_together_sessions` | INSERT | – | no |
| `apps/mobile/src/services/eatTogetherService.ts:93` | `eat_together_members` | INSERT | – | no |
| `apps/mobile/src/services/eatTogetherService.ts:113` | `eat_together_sessions` | SELECT | `.eq('code', code).single()` | no |
| `apps/mobile/src/services/eatTogetherService.ts:142` | `eat_together_members` | SELECT | session + user guards | no |
| `apps/mobile/src/services/eatTogetherService.ts:155` | `eat_together_members` | INSERT | – | no |
| `apps/mobile/src/services/eatTogetherService.ts:178,201,240,262,281,304,331,377,398,452,497,508` | `eat_together_*` family | SELECT/INSERT/UPSERT/DELETE | session-scoped | no |
| `apps/mobile/src/services/eatTogetherService.ts:357` | `rpc('get_vote_results')` | RPC | – | no |
| `apps/mobile/src/services/eatTogetherService.ts:429` | Edge Function `group-recommendations` (**invoke**) | RPC | body: `sessionId, latitude, longitude, radiusKm` | patched inside function (see §5); no mobile patch |
| `apps/mobile/src/services/eatTogetherService.ts:475` | `users` | SELECT | `.in('id', memberUserIds)` | no |
| `apps/mobile/src/services/eatTogetherService.ts:531` | Realtime **channel** `session-${sessionId}` | subscribe | – | no |
| `apps/mobile/src/services/restaurantRatingService.ts:21,58` | `restaurant_ratings_summary` (view) | SELECT | `.eq('restaurant_id', …)` | no (view; review out-of-scope for v2) |
| `apps/mobile/src/services/dishRatingService.ts:25,60` | `dish_ratings_summary` (view) | SELECT | – | no |
| `apps/mobile/src/services/dishRatingService.ts:117` | `dish_opinions` | SELECT | – | no |
| `apps/mobile/src/services/dishPhotoService.ts:91,117` | `dish_photos` | INSERT, SELECT | – | no |
| `apps/mobile/src/services/favoritesService.ts:28,59,82,111` | `favorites` | SELECT/INSERT/DELETE | `.eq('user_id', …)` | no |
| `apps/mobile/src/services/userPreferencesService.ts:93,118,220,246` | `user_preferences`, `user_dish_interactions`, `users` | SELECT/UPSERT/INSERT | user-scoped | no |
| `apps/mobile/src/services/interactionService.ts:38` | `user_dish_interactions` | INSERT | – | no |
| `apps/mobile/src/services/interactionService.ts:18` | Edge Function `update-preference-vector` via raw `fetch` (not `.invoke`) | POST | – | no |
| `apps/mobile/src/services/ratingService.ts:32,44` | Storage bucket `photos` | upload / getPublicUrl | – | no |
| `apps/mobile/src/services/ratingService.ts:61,99,115,167,261,282,303,336,351,371,422` | `user_visits`, `dish_photos`, `dish_opinions`, `restaurant_experience_responses`, `user_points`, RPC `get_user_total_points` | mixed writes/reads | user-scoped | no |
| `apps/mobile/src/services/viewHistoryService.ts:27` | `recent_viewed_restaurants` (view, sec. invoker) | SELECT | `.eq('user_id', …)` | no (view; v2 may want to ensure underlying `restaurants` filter propagates — see §9) |
| `apps/mobile/src/services/gamificationService.ts:40,67,81,98,109,123,136` | `user_streaks`, `user_points`, `user_badges`, `dish_opinions` | SELECT/INSERT/UPSERT | user-scoped | no |
| `apps/mobile/src/stores/sessionStore.ts:93,109,135,176` | `user_sessions`, `session_views` | SELECT/UPSERT/INSERT | user-scoped | no |
| `apps/mobile/src/stores/onboardingStore.ts:183,234,338` | `user_preferences` | UPSERT/SELECT | – | no |
| `apps/mobile/src/services/edgeFunctionsService.ts:158` | Edge Function `feed` via raw `fetch` | POST | body filters | patched inside function (see §5); no mobile patch |

**Counts:** 6 entries flagged **YES** — all inside `restaurantStore.ts` (4), `useDish.ts` (1), and `BasicMapScreen.tsx` (1). Every other call is either user/owner-scoped, a view, an RPC, an Edge Function invocation, or a table that v2 isn't tightening.

`BasicMapScreen.tsx:491` is specifically the "recently-viewed restaurant dishes" lookup used after a rating flow — an oft-missed call site. Do not miss it.

The rough-idea mentioned patching only `restaurantStore.ts`; that undercounts by at least the `useDish.ts` and `BasicMapScreen.tsx` call sites, plus `fetchCategoryDishes`.

---

## 2. `@eatme/shared` public API surface

Root barrel: `packages/shared/src/index.ts` (re-exports `./constants`, `./types`, `./validation`, `./logic/protein`).

| Symbol | Source | Kind | Mobile uses? | Web uses? | Frozen shape? |
|---|---|---|---|---|---|
| `DAYS_OF_WEEK` | `constants/calendar.ts:1` | const (tuple) | — | yes | yes |
| `DayKey` | `constants/calendar.ts` | type | — | yes | yes |
| `POPULAR_CUISINES` | `constants/cuisine.ts` | const | `components/map/DailyFilterModal.tsx:21`, `constants/index.ts:10` | yes | **frozen** |
| `ALL_CUISINES` | `constants/cuisine.ts` | const | `DailyFilterModal.tsx:21`, `constants/index.ts:10` | yes | **frozen** |
| `CUISINES` (alias) | `constants/cuisine.ts` | const | — | yes | yes |
| `DIETARY_TAGS` | `constants/dietary.ts` | const | — | yes | yes |
| `DietaryTagCode` | `constants/dietary.ts` | type | — | yes | yes |
| `RELIGIOUS_REQUIREMENTS` | `constants/dietary.ts` | const | — | yes | yes |
| `ALLERGENS` | `constants/dietary.ts` | const | — | yes | yes |
| `AllergenCode` | `constants/dietary.ts` | type | — | yes | yes |
| `MENU_CATEGORIES` | `constants/menu.ts` | const | — | yes | yes |
| `MenuCategory` | `constants/menu.ts` | type | — | yes | yes |
| `DISH_KIND_META` | `constants/menu.ts` | const (5 keys) | — | yes | **frozen** (post-mig-115 shape) |
| `SELECTION_TYPES` | `constants/menu.ts` | const | — | yes | yes |
| `OPTION_PRESETS` | `constants/menu.ts` | const | — | yes | yes |
| `PRICE_RANGES` | `constants/pricing.ts` | const | — | yes | yes |
| `SPICE_LEVELS` | `constants/pricing.ts` | const | — | yes | yes |
| `SpiceLevel` | `constants/pricing.ts` | type | — | yes | yes |
| `DISPLAY_PRICE_PREFIXES` | `constants/pricing.ts` | const | — | yes | yes |
| `DisplayPricePrefixValue` | `constants/pricing.ts` | type | — | yes | yes |
| `RESTAURANT_TYPES` | `constants/restaurant.ts` | const | — | yes | yes |
| `SERVICE_SPEED_OPTIONS` | `constants/restaurant.ts` | const | — | yes | yes |
| `PAYMENT_METHOD_OPTIONS` | `constants/restaurant.ts` | const | — | yes | yes |
| `PaymentMethodValue` | `constants/restaurant.ts` | type | — | yes | yes |
| `COUNTRIES` | `constants/restaurant.ts` | const | — | yes | yes |
| `WIZARD_STEPS` | `constants/wizard.ts` | const | — | v1-only | v1-only — v2 can replace |
| `Location` … `FormProgress` (24 types) | `types/restaurant.ts` | types | — (see §3 – mobile uses generated `Tables<>`) | yes | **frozen shape for everything web+shared re-uses** |
| `DishKind` | `types/restaurant.ts` | type union `'standard' \| 'bundle' \| 'configurable' \| 'course_menu' \| 'buffet'` | — | yes | **frozen — mig 115 narrowed it** |
| `DishStatus` | `types/restaurant.ts` | type union `'published' \| 'draft' \| 'archived'` | — | yes | **frozen — mobile patch will reference string literal `'published'`** |
| `basicInfoSchema`, `operationsSchema`, `dishSchema`, `menuSchema`, `restaurantDataSchema` | `validation/restaurant.ts` | Zod schemas | — | yes | may evolve; v2 owns these |
| `BasicInfoFormData`…`RestaurantDataFormData` | `validation/restaurant.ts` | types | — | yes | same |
| `PRIMARY_PROTEINS` | `logic/protein.ts:1` | const tuple (11 values) | `components/DrawerFilters.tsx:35` | yes | **frozen** |
| `PrimaryProtein` | `logic/protein.ts:15` | type | — | yes | **frozen** |
| `DerivedProteinFields` | `logic/protein.ts:17` | type | — | yes | yes |
| `deriveProteinFields` | `logic/protein.ts:24` | fn | — | yes | **frozen signature** |

**Mobile-frozen via `@eatme/shared`** (only 3 symbols but cannot change shape): `POPULAR_CUISINES`, `ALL_CUISINES`, `PRIMARY_PROTEINS`.

v2 can freely **add** new exports (e.g. `RestaurantStatus`, `MenuStatus`, `MenuScanJobStatus` types). Per rough-idea §"Shared package additions", no removal/rename.

---

## 3. `@eatme/database` public API surface

Root barrel: `packages/database/src/index.ts`.

| Symbol | Source | Kind | Mobile uses? | Web uses? | Contract |
|---|---|---|---|---|---|
| `getWebClient(url, anonKey)` | `client.ts:49` | fn → `SupabaseClient<Database>` | no | **deprecated** (web now uses `createBrowserClient` from `@supabase/ssr` directly) | **frozen** signature; can stay deprecated |
| `getMobileClient(url, anonKey, storage)` | `client.ts:71` | fn → `SupabaseClient<Database>` | `apps/mobile/src/lib/supabase.ts:13` | no | **FROZEN** — signature `(url: string, anonKey: string, storage: { getItem, setItem, removeItem })`. Explicit-param contract is documented in the file's header: Next/Metro env replacement is literal-key only, so callers pass `process.env.EXPO_PUBLIC_*` in. Do not add required params, do not change tuple, do not swap positional for options-object. |
| `Database`, `Json` | `types.ts` | generated types | `lib/supabase.ts:2`, every mobile service via `Tables<…>` | yes | regenerated via `supabase gen types`. Adding columns only = safe. |
| `Tables<T>`, `TablesInsert<T>`, `TablesUpdate<T>`, `Enums<T>` | `types.ts` | generated helper types | mobile: `Tables<'restaurants'>`, `Tables<'menus'>`, `Tables<'menu_categories'>`, `Tables<'dishes'>`, `Tables<'eat_together_*'>`, `Tables<'favorites'>` (partially) | yes | grow-only |
| `Constants` | `types.ts` | runtime enum constants | no (no matches in mobile) | yes | grow-only |

No hooks are exported today from `packages/database/src/` (the `hooks/` directory exists but is not re-exported by `index.ts`). v2 may add, e.g. `useMenuScanJob(jobId)` without breaking anything.

**Mobile dependency depth:** mobile imports `getMobileClient` in exactly one place (`apps/mobile/src/lib/supabase.ts`) and `Tables<…>` type-only in a handful of services. Type regeneration after v2 migrations should be safe as long as new columns are additive.

---

## 4. `@eatme/tokens` public API surface

Root barrel: `packages/tokens/src/index.ts`.

Runtime exports: `colors`, `typography`, `spacing`, `borderRadius`, `shadows`, `layout`, `theme` (combined).
Type exports: `Colors`, `Typography`, `Spacing`, `BorderRadius`, `Shadows`, `Layout`, `Theme`.

Mobile usage is pervasive (35+ import sites grepped; see `apps/mobile/src/screens/`, `components/`, `styles/theme.ts`). Every export is **frozen-for-shape**. v2 can add new token keys but not rename existing ones. v2 portal can build its own extended theme on top.

---

## 5. Consumer-facing Edge Functions and RPCs

### 5.1 `nearby-restaurants` (`supabase/functions/nearby-restaurants/index.ts`)

**Current query shape** (`index.ts:180–201`):

```ts
let query = supabase
  .from('restaurants')
  .select(`
    *,
    menus (
      id, name, is_active,
      dishes (id, name, price, dietary_tags, allergens, spice_level, is_available)
    )
  `)
  .order('created_at', { ascending: false });
// plus optional .overlaps('cuisine_types', ...) and .gte('rating', ...)
```

No `.eq('status', 'published')` anywhere on restaurants/menus/dishes.

**v2 patch:**
- `restaurants`: add `.eq('status', 'published')` after `.select(...)`.
- Nested `menus`: cannot add via PostgREST nested filter on the current select syntax — need inline `!inner` or post-filter in JS. Simplest: keep the select as-is but also add `AND status='published'` inside the nested select, e.g. `menus!inner ( ... )` and include `status` / filter post-fetch. Practical patch: change `menus (...)` → `menus!inner ( ..., status )` and mirror for `dishes`, then post-filter in JS, OR wait for RLS to enforce it (RLS will, once tightened) and only add the top-level `.eq` at `restaurants`.
- Spatial filter is applied post-fetch via JS distance math — not PostgreSQL `ST_DWithin`. v2 may want to port to `generate_candidates`-style RPC but that is non-v2 scope.

**Mobile callers:** `apps/mobile/src/services/geoService.ts:132` (single call site, invoked via `supabase.functions.invoke('nearby-restaurants')`). Reached from `apps/mobile/src/stores/restaurantStore.ts:199,231` (`fetchNearbyRestaurants` / `fetchNearbyRestaurantsFromCurrentLocation`), ultimately from `apps/mobile/src/screens/BasicMapScreen.tsx`.

### 5.2 `feed` (`supabase/functions/feed/index.ts`)

**Core RPC call** (`index.ts:582`):

```ts
const { data: candidates, error } = await supabase.rpc('generate_candidates', {
  p_lat, p_lng, p_radius_m, p_preference_vector, p_disliked_dish_ids,
  p_allergens, p_diet_tag, p_religious_tags, p_exclude_families,
  p_exclude_spicy, p_limit, p_current_time, p_current_day, p_schedule_type,
  p_group_meals,
});
```

No `p_status` param today. Also an auxiliary `restaurants` read at `index.ts:694` (`.select('id, open_hours').in('id', allRids)`) which hits unpublished rows but only reads `open_hours` for dish-side filtering — RLS will hide drafts automatically after the tightening.

**v2 patch path:** add `AND r.status='published' AND m.status='published' AND d.status='published'` inside `generate_candidates()` WHERE clause (currently has `r.is_active = true` at migration 114:306 plus `d.is_template = false` at 114:318 and `d.is_available = true` at 114:312). No Edge-Function signature change needed — purely a SQL change.

**Auxiliary consumer queries to patch** inside `feed/index.ts`:
- Line 694: `.from('restaurants').select('id, open_hours').in('id', allRids)` — add `.eq('status', 'published')`.

**Mobile callers:** `apps/mobile/src/services/edgeFunctionsService.ts:158` — raw `fetch()` to `${EDGE_FUNCTIONS_URL}/feed`. Called by `callFeedFunction`, consumed by `getDishFeed` / `getRestaurantFeed` / `getCombinedFeed` (see `edgeFunctionsService.ts:253`+). Invoked from `apps/mobile/src/screens/BasicMapScreen.tsx` (the dish map pins).

### 5.3 `group-recommendations` (`supabase/functions/group-recommendations/index.ts`)

**Core RPC call** (`index.ts:326` and `index.ts:337`):

```ts
await serviceClient.rpc('get_group_candidates', {
  p_lat, p_lng, p_radius_m, p_group_vector,
  p_allergens, p_diet_tag, p_religious_tags, p_limit,
});
```

`get_group_candidates` is defined in `supabase/migrations/088_group_candidates_open_now.sql:58`. Its WHERE clause (at `088:106–142`) uses:
- `r.is_active = true`
- `public.is_restaurant_open_now(r.open_hours)`
- `ST_DWithin(...)`
- `EXISTS (SELECT 1 FROM dishes d JOIN menu_categories mc ... JOIN menus m ... WHERE d.is_available AND d.is_parent=false AND m.menu_type='food' AND …)` — **no status check on r, m, d; no `d.is_template=false` check either**.

**v2 patch:** rewrite `get_group_candidates` to add `AND r.status='published' AND m.status='published' AND d.status='published' AND d.is_template=false`. The function is invoked service-role (`serviceClient`, `index.ts:326`) so RLS won't save us — the filter must be added in SQL.

**Other reads in the function that do not need patching:** `eat_together_sessions`, `eat_together_members`, `user_preferences`, `user_behavior_profiles`, `eat_together_recommendations` — all user/session-scoped and out of v2 scope.

**Mobile callers:** `apps/mobile/src/services/eatTogetherService.ts:429` (`supabase.functions.invoke('group-recommendations', { body: { sessionId, latitude, longitude, radiusKm } })`). Triggered from the `RecommendationsScreen` flow.

### 5.4 RPC `generate_candidates`

Defined in **migration 114** (`supabase/migrations/114_ingestion_rework.sql:200–422`). Previous redefinitions trace through migrations 111, 088, 073, 071 — 114 is the current authoritative version.

Current WHERE clause (`114:305–316`):
```sql
WHERE
  r.is_active = true
  AND ST_DWithin(r.location_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_m)
  AND d.is_available = true
  AND d.is_parent = false
  AND d.is_template = false   -- added by migration 114
  AND (dc.id IS NULL OR dc.is_drink = false)
  AND (m.id IS NULL OR m.menu_type = 'food')
  AND (dc.id IS NULL OR lower(dc.name) <> 'dessert')
  …
```

Confirms the "already known" claim: **`generate_candidates()` already filters `is_parent=false AND is_template=false`**. ✓

**v2 patch:** add `AND r.status = 'published' AND (m.id IS NULL OR m.status='published') AND d.status='published'` to the WHERE clause. Delivered via a new migration (e.g. 116) that does `CREATE OR REPLACE FUNCTION generate_candidates(…)` with identical signature — no Edge Function code change required, no mobile change required.

### 5.5 One-line status of the other Edge Functions

| Function | Touches `restaurants/menus/dishes`? | v2 patch needed? |
|---|---|---|
| `enrich-dish` (`supabase/functions/enrich-dish/index.ts:350,384,499,547,553`) | Yes — reads/updates individual dishes by id (admin-triggered pipeline). Writes `enrichment_status` and embeds. | **No** — runs with service role, operates on specific dish ids (not a public feed). Authenticated admin-only callers. |
| `invalidate-cache` (`supabase/functions/invalidate-cache/index.ts:66`) | `.from('dishes').select('id').eq('id', dishId)` existence check only. | **No** — admin cache buster. |
| `batch-update-preference-vectors` (`supabase/functions/batch-update-preference-vectors/index.ts:53`) | Only `rpc('get_users_needing_vector_update')`; no restaurants/menus/dishes touched. | **No** |
| `update-preference-vector` (`supabase/functions/update-preference-vector/index.ts:141`) | Reads `dishes` by id list to build a preference vector from the user's interactions. | **Marginal** — arguably should also filter to `status='published'` to avoid embedding drafts, but drafts the user has never interacted with won't show up anyway (interactions are mobile-sourced). Leave as-is; revisit only if draft dishes start appearing in embeddings. |

---

## 6. Schema state — migrations 071 → 115 (+ key pre-071 already baked into `database_schema.sql`)

`supabase/migrations/database_schema.sql` is the live schema snapshot (what's currently in production). Migrations 071+ are incremental additions on top of it.

| # | File | Description (one line) |
|---|---|---|
| 071 | `071_generate_candidates_exclude_params.sql` | Adds `p_exclude_families`, `p_exclude_spicy` to `generate_candidates()`. |
| 072 | `072_remove_swipe_feature.sql` | Drops the dish-swipe Edge Function scaffolding + related tables. |
| 073 | `073_universal_dish_structure.sql` | Adds `parent_dish_id`, `is_parent`, `serves`, `price_per_person` to `dishes`; adds `'combo'` to `dish_kind` CHECK; adds `schedule_type` to `menus`. |
| 074 | `074_enrichment_review_status.sql` | Adds `dishes.enrichment_review_status` for staged AI review. |
| 075 | `075_fix_eat_together.sql` | Eat-together RLS hardening + `generate_session_code()` + `get_vote_results()` RPCs + pg_cron expiry. |
| 076 | `076_performance_indexes.sql` | 7 feed/favorites indexes. |
| 077 | `077_recent_viewed_restaurants_view.sql` | `recent_viewed_restaurants` view (security_invoker). |
| 078 | `078_fix_stale_rls_policies.sql` | Drops overlapping legacy policies; installs `USING (true)` SELECT on `restaurants`, `menus`, `dishes`. |
| 079 | `079_rating_system_redesign.sql` | Rating redesign (streaks, badges, user_points). |
| 080 | `080_restaurant_import.sql` | Adds `restaurants.google_place_id`, creates `restaurant_import_jobs`, `google_api_usage`. |
| 081 | `081_create_user_preferences.sql` | Creates `user_preferences` (for signup trigger). |
| 082 | `082_wire_signup_triggers.sql` | Binds `user_preferences` trigger. |
| 083 | `083_signup_user_profile_trigger.sql` | Signup auto-creates `public.users` + `user_behavior_profiles`. |
| 084 | `084_fix_user_fk_cascades.sql` | Adds `ON DELETE CASCADE` on user-owned FKs. |
| 085 | `085_grant_auth_admin_delete_permissions.sql` | `supabase_auth_admin` grants for user deletion. |
| 086 | `086_preserve_ugc_on_user_delete.sql` | Switches UGC tables to `ON DELETE SET NULL`. |
| 087 | `087_fix_remaining_user_fk_actions.sql` | Last FK cleanups incl. `menu_scan_jobs.created_by` → SET NULL. |
| 088 | `088_group_candidates_open_now.sql` | Adds `is_restaurant_open_now()`, rewrites `get_group_candidates()` to exclude closed venues. |
| 089 | `089_add_extraction_telemetry.sql` | Adds `menu_scan_jobs.extraction_model`, `extraction_prompt_tokens`, `extraction_completion_tokens`. |
| 090 | `090_expand_dietary_tags.sql` | Seeds canonical `dietary_tags` rows matching the shared constants. |
| 091 | `091_content_rls_owner_writes.sql` | **Restores RLS owner-write chain** on restaurants/menus/menu_categories/dishes/dish_ingredients/option_groups/options. |
| 092 | `092_dish_allergen_trigger.sql` | `dish_ingredients` → `dishes.allergens`/`dietary_tags` trigger (single source of truth). |
| 093 | `093_unify_allergen_codes.sql` | Unifies `soy`/`nuts` code drift; updates allergens table. |
| 094 | `094_dish_scoped_option_groups.sql` | Locks `option_groups.dish_id` to NOT NULL; drops `menu_category_id`. |
| 095 | `095_add_buddhist_dietary_tag.sql` | Seeds `'buddhist'` dietary_tag. |
| 096 | `096_drop_orphan_option_groups.sql` | Drops the `_orphan_option_groups_094` quarantine snapshot (empty). |
| 097 | `097_add_eggs_fish_allergens.sql` | Adds `eggs`, `fish` to allergens. |
| 098 | `098_add_skip_menu_scan.sql` | Adds `restaurants.skip_menu_scan boolean NOT NULL DEFAULT false` (admin workflow flag only — **NOT** a consumer visibility flag; v2 must not confuse it with `status`). |
| 099 | `099_new_ingredients_schema.sql` | Creates `ingredient_concepts`, `ingredient_variants`, `concept_translations`, `variant_translations`, `ingredient_aliases_v2` (Phase 1; un-wired). |
| 100 | `100_backfill_ingredient_concepts.sql` | Phase 2: backfills the new ingredient tables from legacy. |
| 101 | `101_cleanup_dish_contamination.sql` | Phase 2b: removes mis-seeded dishes from `ingredient_concepts`. |
| 102 | `102_dish_ingredients_concept_variant.sql` | Adds `dish_ingredients.concept_id`, `.variant_id` (nullable). |
| 103 | `103_mirror_canonical_ingredients.sql` | Creates mirror `canonical_ingredients` rows for the new-only concepts. |
| 104 | `104_backfill_dish_ingredients_concept_id.sql` | Backfills `dish_ingredients.concept_id`. |
| 104b | `104b_drop_unresolvable_dish_ingredients.sql` | Drops unresolvable rows before NOT NULL flip. |
| 105 | `105_allergen_trigger_on_concepts.sql` | Rewrites allergen/dietary trigger to read `ingredient_concepts`. |
| 106 | `106_dish_ingredients_concept_id_not_null.sql` | Sets `dish_ingredients.concept_id` NOT NULL. |
| 107 | `107_enforce_alias_variant_concept_match.sql` | Composite FK: `(concept_id, variant_id)` in `ingredient_aliases_v2`. |
| 110 | `110_primary_protein.sql` | **Adds `dishes.primary_protein text` with CHECK (11 values)** + index. |
| 111 | `111_primary_protein_user_prefs_and_feed.sql` | Adds `user_preferences.primary_protein` + updates `generate_candidates()` to return it. |
| 112 | `112_seed_dish_categories.sql` | Seeds canonical `dish_categories`. |
| 113 | `113_add_non_alcoholic_dietary_tag.sql` | Adds `'non_alcoholic'` dietary tag. |
| 114 | `114_ingestion_rework.sql` | **Adds `dishes.status text NOT NULL DEFAULT 'published'`** + `is_template boolean` + `source_image_index` + `source_region`. Renames `combo→bundle`, `template→configurable+is_template=true`. Relaxes `dish_kind` CHECK. Cascades FK on `dish_ingredients`. Creates `dish_courses`, `dish_course_items` (+ RLS). Extends `menu_scan_jobs` with `saved_dish_ids jsonb`, `saved_at timestamptz`. Updates `generate_candidates()` to exclude templates. |
| 115 | `115_tighten_dish_kind_check.sql` | Tightens `dish_kind` CHECK to 5 canonical values after triage. |

### Verifications of "already known" claims

- `dishes.status` — introduced by **migration 114** (line 22–24), `text NOT NULL DEFAULT 'published'` CHECK `('published','draft','archived')`. ✓
- `generate_candidates()` filters `is_parent=false AND is_template=false` — confirmed in `114:315,318`. ✓
- `menu_scan_jobs` table with `saved_dish_ids` + `saved_at` added by mig 114 — confirmed at `114:166–168`. ✓
- `restaurants.status` / `menus.status` **do not exist** — grep across migrations finds no `ALTER TABLE public.restaurants ADD COLUMN status` and no `ALTER TABLE public.menus ADD COLUMN status`. ✓
- **Surprise:** `restaurants.is_active boolean` and `restaurants.suspended_at`/`suspended_by`/`suspension_reason` already exist (see `database_schema.sql:361–364`). Live consumer-facing SQL paths gate on `r.is_active = true` (see `generate_candidates`, `get_group_candidates`). v2's new `restaurants.status` column **must not replace or conflict with** `is_active`/`suspended_at`. Suggest keeping both: `is_active` = admin suspension, `status` = owner draft/publish.

### Ingredient pipeline tables — current state (v2 must NOT touch)

Confirmed to exist, populated, and wired:
- `ingredients` — legacy alias/search table (still used for backward-compat resolution).
- `canonical_ingredients` (`database_schema.sql:43`) — mirror rows maintained by migration 103.
- `canonical_ingredient_allergens` (`database_schema.sql:29`) — read by `useRestaurantDetail.ts:316`.
- `canonical_ingredient_dietary_tags` (`database_schema.sql:36`) — fed by allergen trigger.
- `ingredient_concepts` / `ingredient_variants` / `concept_translations` / `variant_translations` / `ingredient_aliases_v2` — created mig 099, backfilled 100, NOT-NULL enforced on `dish_ingredients.concept_id` by mig 106.
- `dish_ingredients` (`database_schema.sql:89`) — FK to both legacy `canonical_ingredients` (via `ingredient_id`) and new concepts/variants. Cascade on dish delete per mig 114:68.
- `dishes.allergens`, `dishes.dietary_tags`, `*_override` — trigger-maintained (mig 092, 105). **Keep as-is.**

---

## 7. Current RLS on `restaurants`, `menus`, `dishes`, `menu_scan_jobs`

### Enablement
- `restaurants`, `menus`, `menu_categories`, `dishes`, `dish_ingredients`, `option_groups`, `options` — all enabled at `091_content_rls_owner_writes.sql:39–45`.
- `menu_scan_jobs` — grep finds **no `ALTER TABLE public.menu_scan_jobs ENABLE ROW LEVEL SECURITY`** anywhere. **Flag**: The table is present in `database_schema.sql` but appears to have RLS disabled (or was enabled via dashboard outside migrations). v2 **must** enable RLS explicitly and add owner-scoped `SELECT/INSERT/UPDATE` policies (owner-of-restaurant + admin + service-role). This is additive and non-breaking.

### Policies (from grep of `CREATE POLICY` on these four tables)

#### `restaurants`

| Policy | Operation | Clause |
|---|---|---|
| `"Public read restaurants"` (mig 078:27) | SELECT | `USING (true)` — **this is the target for v2 tightening** → `USING (status = 'published')`. |
| `"Owners can insert own restaurants"` (mig 091:67) | INSERT (authenticated) | `WITH CHECK (owner_id = auth.uid() OR public.is_admin())` — **keep** |
| `"Owners can update own restaurants"` (mig 091:72) | UPDATE (authenticated) | `USING (owner_id = auth.uid() OR public.is_admin()) WITH CHECK (same)` — **keep** |
| `"Owners can delete own restaurants"` (mig 091:78) | DELETE (authenticated) | `USING (owner_id = auth.uid() OR public.is_admin())` — **keep** |

**Gap for v2:** anon SELECT is `USING (true)`. Owners need to still see their own drafts. The cleanest shape is to drop the single `USING (true)` and split into two SELECT policies: `FOR SELECT USING (status = 'published')` (anon + authenticated) plus `FOR SELECT USING (owner_id = auth.uid() OR public.is_admin())` (owner/admin sees everything).

#### `menus`

| Policy | Operation | Clause |
|---|---|---|
| `"Public read menus"` (mig 078:28) | SELECT | `USING (true)` — **tighten to** `USING (status = 'published' AND EXISTS (SELECT 1 FROM restaurants r WHERE r.id = menus.restaurant_id AND r.status = 'published'))`. |
| `"Owners can write own menus"` (mig 091:86) | ALL (authenticated) | `USING/WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM restaurants r WHERE r.id = menus.restaurant_id AND r.owner_id = auth.uid()))` — **keep** |

Note: this `FOR ALL` policy currently covers SELECT too for authenticated owners. That's why the `USING (true)` SELECT policy is anon-facing in practice.

#### `dishes`

| Policy | Operation | Clause |
|---|---|---|
| `"Public read dishes"` (mig 078:29) | SELECT | `USING (true)` — **tighten** |
| `"Owners can write own dishes"` (mig 091:126) | ALL (authenticated) | `USING/WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM restaurants r WHERE r.id = dishes.restaurant_id AND r.owner_id = auth.uid()))` — **keep** |

v2 target on `dishes`: `USING (status = 'published' AND EXISTS (SELECT 1 FROM restaurants r WHERE r.id = dishes.restaurant_id AND r.status = 'published'))` (belt-and-braces against a stray restaurant draft with published child rows).

#### `menu_scan_jobs`

No CREATE POLICY found in any migration. RLS appears disabled (no `ENABLE ROW LEVEL SECURITY` found). **v2 must add**:
- `ALTER TABLE public.menu_scan_jobs ENABLE ROW LEVEL SECURITY;`
- Owner/admin SELECT + INSERT + UPDATE policies keyed via `created_by = auth.uid()` OR `EXISTS (restaurants r WHERE r.id = menu_scan_jobs.restaurant_id AND r.owner_id = auth.uid())`.
- Service-role policy (or implicit bypass) for the confirm/worker path.

This is additive and does not affect mobile (mobile does not read `menu_scan_jobs`).

---

## 8. `menu_scan_jobs` — current shape vs v2 target

Current columns (from `supabase/migrations/database_schema.sql:253–271` + mig 089 + mig 114):

```
id              uuid NOT NULL DEFAULT uuid_generate_v4()
restaurant_id   uuid NOT NULL  FK → restaurants(id)
created_by      uuid            FK → auth.users(id)  (ON DELETE SET NULL after mig 087)
image_count     smallint NOT NULL DEFAULT 1
image_filenames       text[]
image_storage_paths   text[]
status          text NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing','needs_review','completed','failed'))
result_json     jsonb
error_message   text
dishes_found    integer DEFAULT 0
dishes_saved    integer DEFAULT 0
processing_ms   integer
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
-- added by mig 089:
extraction_model             text
extraction_prompt_tokens     integer
extraction_completion_tokens integer
-- added by mig 114:
saved_dish_ids jsonb
saved_at       timestamptz
```

v2 target columns (per rough-idea §"DB migrations"): `(id, owner_id, restaurant_id, status, input, result, attempts, created_at, updated_at, locked_until)`.

| v2 target column | Current state | Recommendation |
|---|---|---|
| `id` | exists (uuid) | keep as-is |
| `owner_id` | **absent** — `created_by` exists instead (uuid → auth.users, SET NULL on delete) | **Repurpose `created_by` as owner_id** (it already is); add a generated view / alias or just adopt `created_by` as the canonical owner. Adding a new `owner_id` column would duplicate semantics. Alternative: add `owner_id uuid` NOT NULL with backfill from `created_by`, but this breaks the SET NULL semantics after user deletion. Prefer keeping `created_by` and documenting it as the owner reference. |
| `restaurant_id` | exists, NOT NULL | keep |
| `status` | exists, CHECK values `('processing','needs_review','completed','failed')` | v2 may need different values (e.g. `'queued','running','completed','failed'`). If the target enum differs, **relax/expand** the CHECK additively — do not drop/rename the existing values (existing rows use them). Preferred: ADD new values via a new CHECK, keep old ones. |
| `input` | **absent** — `image_filenames text[]` + `image_storage_paths text[]` + `image_count smallint` together serve as input metadata | Add `input jsonb` new column; backfill as `{ filenames, storage_paths, image_count }` if needed, or leave NULL for existing rows. Keep legacy columns. |
| `result` | `result_json jsonb` exists | **Repurpose** — either add a `GENERATED ALWAYS AS (result_json) STORED` column named `result`, or just rename the reader to use `result_json`. Cleanest path: add a VIEW that aliases, or document `result_json` as the canonical name. **Do not drop** `result_json`. |
| `attempts` | **absent** | add `attempts integer NOT NULL DEFAULT 0` |
| `created_at` | exists | keep |
| `updated_at` | exists | keep |
| `locked_until` | **absent** | add `locked_until timestamptz` for worker-lease pattern |

**Columns v2 should leave alone (keep) even though they aren't in the target spec**: `image_count`, `image_filenames`, `image_storage_paths`, `error_message`, `dishes_found`, `dishes_saved`, `processing_ms`, `extraction_model`, `extraction_prompt_tokens`, `extraction_completion_tokens`, `saved_dish_ids`, `saved_at`. All are populated by the v1 scan path (`apps/web-portal/app/api/menu-scan/route.ts`, `/confirm/route.ts`, `/undo/route.ts`) and/or the admin scan hook (`apps/web-portal/app/admin/menu-scan/hooks/useJobQueue.ts`). They're additive debt, not v2 blockers.

**Required additions** (net): `input jsonb`, `attempts integer`, `locked_until timestamptz`. Optional but advisable: enable RLS (§7) and add to the Realtime publication (§9).

---

## 9. Draft-state + job-realtime scaffolding

### Realtime publication (`ALTER PUBLICATION supabase_realtime ADD TABLE …`)

**Grep of `supabase/migrations/*.sql` for `publication` / `supabase_realtime` / `pg_publication` returns zero hits.** No migration adds any table to the Realtime publication.

Implication for v2:
- `menu_scan_jobs` is **not** currently in the Realtime publication (at least not via migrations — it may have been toggled from the Supabase dashboard, in which case it's untracked and fragile). v2 **must** add explicitly:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_scan_jobs;
  ```
- `dishes`, `restaurants`, `menus` are likewise not tracked as publication members via migrations. Mobile doesn't rely on these being realtime-streamed (it pulls via Edge Functions / direct queries) so adding them is not required by mobile. v2 may add them only if the new portal UI needs realtime restaurant/menu updates; not a compatibility requirement.

### Existing realtime channels used by mobile

From `apps/mobile/src/services/eatTogetherService.ts:531`, `apps/mobile/src/screens/eatTogether/RecommendationsScreen.tsx:111`, `apps/mobile/src/screens/eatTogether/SessionLobbyScreen.tsx:116` — all use presence/broadcast channels keyed by session id (`session-${sessionId}`, `votes_${sessionId}`, `session_${sessionId}`), not `postgres_changes` subscriptions. They therefore don't depend on publication membership. Eat-together tables (`eat_together_*`) are out of v2 scope.

### Draft-state persistence today

- v1 web portal stashes onboarding state in `localStorage` under `restaurant-draft` and `onboarding-step` (per `CLAUDE.md` common pitfalls + rough-idea §"Why rebuild?"). **No DB-side draft flag** today; everything is persisted as rows with `is_active=true` (default) once written.
- Mobile has `onboardingStore.ts` persisting per-user preferences to `user_preferences` (not restaurant drafts). No mobile-side coupling to the draft model v2 introduces.

### Bottom line for §9

v2 needs to:
1. `ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_scan_jobs;` — required for the Realtime scan-status UX.
2. Enable RLS on `menu_scan_jobs` (§7) before publishing it to the anon Realtime channel.
3. Leave other publication membership alone unless a concrete v2 UI requirement shows up.

---

## Appendix — files cited

- `apps/mobile/src/stores/restaurantStore.ts`
- `apps/mobile/src/stores/sessionStore.ts`, `onboardingStore.ts`
- `apps/mobile/src/hooks/useDish.ts`
- `apps/mobile/src/screens/BasicMapScreen.tsx`
- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts`
- `apps/mobile/src/services/geoService.ts`
- `apps/mobile/src/services/edgeFunctionsService.ts`
- `apps/mobile/src/services/eatTogetherService.ts` (+ siblings)
- `apps/mobile/src/lib/supabase.ts`
- `packages/shared/src/index.ts` + `constants/*.ts`, `types/restaurant.ts`, `validation/restaurant.ts`, `logic/protein.ts`
- `packages/database/src/index.ts`, `client.ts`
- `packages/tokens/src/index.ts`
- `supabase/functions/nearby-restaurants/index.ts`, `feed/index.ts`, `group-recommendations/index.ts`, `enrich-dish/index.ts`, `invalidate-cache/index.ts`, `batch-update-preference-vectors/index.ts`, `update-preference-vector/index.ts`
- `supabase/migrations/database_schema.sql`
- `supabase/migrations/078_fix_stale_rls_policies.sql`, `088_group_candidates_open_now.sql`, `089_add_extraction_telemetry.sql`, `091_content_rls_owner_writes.sql`, `098_add_skip_menu_scan.sql`, `110_primary_protein.sql`, `111_primary_protein_user_prefs_and_feed.sql`, `114_ingestion_rework.sql`, `115_tighten_dish_kind_check.sql`

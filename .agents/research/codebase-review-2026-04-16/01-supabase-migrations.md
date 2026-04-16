# REV-01: Supabase migrations — RLS, FK cascades, indexes (071–097)

## Scope reviewed

Files read in full (unless noted):

- `infra/supabase/migrations/071_generate_candidates_exclude_params.sql` (1-203)
- `infra/supabase/migrations/072_remove_swipe_feature.sql` (1-219)
- `infra/supabase/migrations/073_universal_dish_structure.sql` (1-416)
- `infra/supabase/migrations/074_enrichment_review_status.sql` (1-18)
- `infra/supabase/migrations/075_fix_eat_together.sql` (1-218)
- `infra/supabase/migrations/076_performance_indexes.sql` (1-32)
- `infra/supabase/migrations/077_recent_viewed_restaurants_view.sql` (1-20)
- `infra/supabase/migrations/078_fix_stale_rls_policies.sql` (1-30)
- `infra/supabase/migrations/079_rating_system_redesign.sql` (1-195)
- `infra/supabase/migrations/080_restaurant_import.sql` (1-84)
- `infra/supabase/migrations/081_create_user_preferences.sql` (1-75)
- `infra/supabase/migrations/082_wire_signup_triggers.sql` (1-13)
- `infra/supabase/migrations/083_signup_user_profile_trigger.sql` (1-60)
- `infra/supabase/migrations/084_fix_user_fk_cascades.sql` (1-110)
- `infra/supabase/migrations/085_grant_auth_admin_delete_permissions.sql` (1-37)
- `infra/supabase/migrations/086_preserve_ugc_on_user_delete.sql` (1-45)
- `infra/supabase/migrations/087_fix_remaining_user_fk_actions.sql` (1-54)
- `infra/supabase/migrations/088_group_candidates_open_now.sql` (1-159)
- `infra/supabase/migrations/089_add_extraction_telemetry.sql` (1-17)
- `infra/supabase/migrations/090_expand_dietary_tags.sql` (1-21)
- `infra/supabase/migrations/091_content_rls_owner_writes.sql` (1-201)
- `infra/supabase/migrations/092_dish_allergen_trigger.sql` (1-174)
- `infra/supabase/migrations/093_unify_allergen_codes.sql` (1-108)
- `infra/supabase/migrations/094_dish_scoped_option_groups.sql` (1-59)
- `infra/supabase/migrations/095_add_buddhist_dietary_tag.sql` (1-17)
- `infra/supabase/migrations/096_drop_orphan_option_groups.sql` (1-10)
- `infra/supabase/migrations/097_add_eggs_fish_allergens.sql` (1-15)
- `infra/supabase/migrations/database_schema.sql` (grep-verified for absence of `user_badges` FK action)

## Findings

### REV-01-a: `user_badges.user_id` FK has no ON DELETE action; user deletion will fail

- Severity: **high**
- Category: correctness
- Location: `infra/supabase/migrations/079_rating_system_redesign.sql:45-51`
- Observation: `user_badges` is created with `user_id uuid NOT NULL REFERENCES auth.users(id)` (line 47) — no `ON DELETE` clause, so the default `NO ACTION` applies. Migrations 084, 086, 087 patch ON DELETE actions for every other user-owned table but omit `user_badges`. Grep across `infra/supabase/migrations/` confirms no `ALTER TABLE public.user_badges` touching the FK ever lands.
- Why it matters: when a user is deleted via the Supabase Auth API, Postgres checks all FKs to `auth.users`; any row in `user_badges` referencing the user blocks the delete with a FK violation — reproducing the class of bug 084 set out to fix. The intent is already clear from `085_grant_auth_admin_delete_permissions.sql:30` (`GRANT SELECT, DELETE ON public.user_badges TO supabase_auth_admin`), which is grouped under the "CASCADE DELETE tables" heading (line 22) — but the cascade itself was never added.
- Suggested direction: new migration drops and re-adds `user_badges_user_id_fkey` with `ON DELETE CASCADE` (badges are per-user achievements, no UGC preservation argument). Gated by `DROP CONSTRAINT IF EXISTS` so it's idempotent.
- Confidence: confirmed
- Evidence: `Grep "user_badges" infra/supabase/migrations/` returned only `079` (table creation) and `085` (grant). No FK re-definition anywhere. `database_schema.sql` has no `user_badges` row.

### REV-01-b: `option_groups_dish_restaurant_match` check constraint does not assert what its comment claims

- Severity: medium
- Category: correctness
- Location: `infra/supabase/migrations/094_dish_scoped_option_groups.sql:43-58`
- Observation: The comment (lines 43-45) says "assert dish→restaurant consistency so the RLS policy in migration 091 keyed on restaurant_id stays accurate even if a buggy caller ever inserts mismatched rows." The constraint body (lines 51-53) is `CHECK (restaurant_id IS NOT NULL AND dish_id IS NOT NULL)` — it only asserts both columns are non-null, which is already enforced by their individual `NOT NULL` definitions. It does not verify that `dish.restaurant_id = option_groups.restaurant_id`.
- Why it matters: a buggy caller can still insert an `option_groups` row whose `restaurant_id` points at restaurant A while its `dish_id` points at a dish owned by restaurant B. The RLS policy in `091:166-179` keys on `option_groups.restaurant_id` only — so restaurant A's owner gets write access to option groups logically belonging to restaurant B's dish. The constraint was meant to prevent this; as written it provides no protection.
- Suggested direction: replace the constraint with a trigger (or a subquery CHECK via a helper function) that loads the dish and compares `restaurant_id`. Or normalise by dropping `option_groups.restaurant_id` and computing it through the `dishes` join for RLS.
- Confidence: confirmed
- Evidence: see quoted check body on line 52.

### REV-01-c: SECURITY DEFINER trigger functions lack `SET search_path`

- Severity: medium
- Category: security
- Location:
  - `infra/supabase/migrations/081_create_user_preferences.sql:52-64` (`create_user_preferences_on_signup`)
  - `infra/supabase/migrations/083_signup_user_profile_trigger.sql:4-21` (`create_user_profile_on_signup`)
  - `infra/supabase/migrations/083_signup_user_profile_trigger.sql:30-42` (`create_behavior_profile_on_signup`)
- Observation: all three functions declare `LANGUAGE plpgsql SECURITY DEFINER` but do NOT pin `search_path`. Contrast with `075_fix_eat_together.sql:17-34`, which hardens every definer function via `SET search_path = ''`, and `088_group_candidates_open_now.sql:82-83` which uses `SET search_path = extensions, public`.
- Why it matters: these functions run with owner privileges on every new auth signup and resolve `public.user_preferences` / `public.users` / `public.user_behavior_profiles` using the caller's effective search_path. If any role whose search_path includes a writable schema invokes (or causes invocation of) the trigger, an attacker holding CREATE on that schema could shadow a function, cast, or operator called during the INSERT. In hosted Supabase the blast radius is small, but it's an unnecessary attack surface given the project's own prior pattern.
- Suggested direction: new migration re-creates each function with an explicit `SET search_path = public, pg_temp` (empty `''` is fine for 081/083 since they only touch `public.*`).
- Confidence: confirmed
- Evidence: diff visible between 081/083 (no `SET search_path`) and 075 (hardened).

### REV-01-d: `generate_session_code` and `is_restaurant_open_now` grant EXECUTE to `anon`

- Severity: medium
- Category: security
- Location:
  - `infra/supabase/migrations/075_fix_eat_together.sql:181` — `GRANT EXECUTE ON FUNCTION public.generate_session_code() TO anon, authenticated, service_role;`
  - `infra/supabase/migrations/088_group_candidates_open_now.sql:53-54` — `GRANT EXECUTE ON FUNCTION public.is_restaurant_open_now(jsonb, timestamptz) TO anon, authenticated, service_role;`
- Observation: `generate_session_code` runs a loop that may retry (line 120-135 of 075) and SELECTs `public.eat_together_sessions`. Anon exposure lets an unauthenticated client burn CPU by invoking it in a tight loop, with no owner check and no rate limiting. `is_restaurant_open_now` is read-only and safer but is also callable by `anon`. The `get_vote_results` RPC (075:183) correctly limits to `authenticated, service_role` — so the pattern of locking session mutations behind auth is established but not applied consistently to `generate_session_code`.
- Why it matters: low-grade DoS / resource-exhaustion vector — unauthenticated callers trigger writes (well, reads + allocations) against a hot table. Code collisions are astronomically rare but the loop's worst case is unbounded if the random source degrades.
- Suggested direction: drop the `anon` grant on `generate_session_code` — the session-creation flow is already authenticated (mobile's `eatTogetherService.ts` is a signed-in user). Leave `is_restaurant_open_now` as-is or drop anon for symmetry (low priority; it's deterministic and read-only, and is called from the SECURITY DEFINER `get_group_candidates` which has anon access by design).
- Confidence: likely
- Evidence: function bodies + grants quoted above; `get_vote_results` precedent on 075:183.

### REV-01-e: `is_restaurant_open_now` is declared IMMUTABLE but its default argument resolves `now()`

- Severity: low
- Category: correctness
- Location: `infra/supabase/migrations/088_group_candidates_open_now.sql:10-51`
- Observation: line 16 marks the function `IMMUTABLE`, but the signature `p_now timestamptz DEFAULT now()` means when callers omit `p_now`, `now()` resolves per-call. IMMUTABLE promises the output depends only on arguments — which, strictly, still holds — but the intent of IMMUTABLE is also "result would be identical if evaluated at any time," and a function whose defaulted-parameter form is time-dependent is misleading.
- Why it matters: no observable bug today because callers in `get_group_candidates` (088:108) pass `r.open_hours` with no `p_now`, and Postgres resolves the default at query start. If someone later creates a functional/expression index on `is_restaurant_open_now(col)`, the planner would cache the wrong value because IMMUTABLE is treated as safely memoisable. Also blocks future safe use of the function in generated columns.
- Suggested direction: mark as `STABLE` (matches the behaviour) and keep the default. Callers that want a true IMMUTABLE shape can pass an explicit timestamp.
- Confidence: likely
- Evidence: lines 12-16 of 088 — function declares `IMMUTABLE` while the default path calls `now()`.

### REV-01-f: `restaurants.owner_id` SET NULL orphans ownership with no audit trail

- Severity: medium
- Category: correctness
- Location: `infra/supabase/migrations/087_fix_remaining_user_fk_actions.sql:18-21`
- Observation: the FK is rewritten with `ON DELETE SET NULL`. A deleted owner means the restaurant row stays but `owner_id` is NULL forever — there is no separate `deleted_owner_id`, `archived_at`, or audit row. Migration 086 applied the same SET NULL pattern to UGC (photos, opinions, experience responses) which is appropriate for "anonymous content." For a *business account ownership* link, losing the owner reference entirely leaves the restaurant un-owned and unrecoverable.
- Why it matters: regulatory / dispute scenarios (chargebacks, lawful deletion requests) may require knowing who *used to* own a restaurant. More importantly, a support flow to reassign restaurants after owner deletion must scan by other fields (email, phone) rather than by FK. RLS policies in `091_content_rls_owner_writes.sql:67-99` treat `owner_id = auth.uid()` as the sole ownership predicate — an orphaned restaurant has no writer except `public.is_admin()`.
- Suggested direction: soft-delete pattern — add `owner_deleted_at timestamptz`, `deleted_owner_id uuid` columns and a BEFORE-NULL trigger that captures the old value. Alternatively, move restaurants to a separate `restaurant_owners` junction so historical ownership records survive.
- Confidence: confirmed
- Evidence: 087 body; 091 RLS predicate `owner_id = auth.uid()`.

### REV-01-g: `user_streaks` and `user_badges` allow self-insert but no RLS predicate prevents user spoofing at update time for streaks

- Severity: low
- Category: security
- Location:
  - `infra/supabase/migrations/079_rating_system_redesign.sql:31-43` — `user_streaks` policies
- Observation: the UPDATE policy (37-39) checks `USING (auth.uid() = user_id)` but has **no `WITH CHECK`** clause. Postgres falls back to allowing any new column values so long as the row being updated passes `USING`. That means a user could UPDATE their own `user_streaks` row and set `current_streak = 9999` or `longest_streak = 9999`, bypassing the server-side `gamificationService.updateStreak` logic. Same applies for INSERT — the INSERT policy (41-43) *does* have `WITH CHECK (auth.uid() = user_id)`, so it at least binds the row to the caller, but the user can freely self-award whatever streak values they want.
- Why it matters: gamification abuse (fake "N-week streak" awards and associated milestone point bonuses). Impact is cosmetic on the leaderboard side but feeds back into `user_points` via `updateStreak`'s milestone-bonus path; combined with the Trusted Taster badge check that reads `user_badges`, a client that bypasses the service can manufacture progression state.
- Suggested direction: either revoke direct UPDATE/INSERT on `user_streaks` and `user_badges` from `authenticated` (let the service role or a SECURITY DEFINER RPC own writes), or add trigger validation that recomputes streak values from `dish_opinions`. Parallel hardening for `user_badges` — currently policy allows the user to insert any `badge_type` matching their own `user_id`.
- Confidence: likely
- Evidence: quoted policy definitions.

### REV-01-h: `generate_candidates` / `get_group_candidates` `SET search_path = extensions, public` is wider than necessary

- Severity: low
- Category: security
- Location:
  - `infra/supabase/migrations/071_generate_candidates_exclude_params.sql:80`
  - `infra/supabase/migrations/072_remove_swipe_feature.sql:97`
  - `infra/supabase/migrations/073_universal_dish_structure.sql:133, 335`
  - `infra/supabase/migrations/088_group_candidates_open_now.sql:83`
- Observation: all major public feed / candidate RPCs are SECURITY DEFINER and include `extensions` first in `search_path` (`SET search_path = extensions, public`). Including `extensions` is required for PostGIS operators (`<=>`, `ST_Distance`, `ST_MakePoint`, `ST_DWithin`) — correct intent. But `public` after `extensions` means a user-created function in `public` would still be resolved from `public` when a schema-unqualified call is made. Standard Supabase hardening pattern is to fully qualify every call inside the function body and pin `search_path = pg_catalog, pg_temp` — or at minimum put `pg_temp` last so temp objects can't be used to shadow built-ins.
- Why it matters: small surface, but this is a definer function with broad grants (`TO anon, authenticated, service_role` on 071:202, 073:301). An attacker who can create a function in `public` (unlikely under Supabase's default grants; possible if grants drift) could shadow a function called during execution.
- Suggested direction: add `pg_temp` (last) to the search_path and audit that every operator / function reference inside the body is either explicitly schema-qualified or a built-in (`SELECT`, `COALESCE`, `CASE`, `unnest`, `array_length` — all in pg_catalog).
- Confidence: needs-verification — depends on current `CREATE`/`USAGE` grants on `public` in production.

### REV-01-i: RLS policies on content-write tables do nested EXISTS without supporting indexes

- Severity: medium
- Category: performance
- Location: `infra/supabase/migrations/091_content_rls_owner_writes.sql:85-200`
- Observation: every write policy for `menus`, `menu_categories`, `dishes`, `dish_ingredients`, `option_groups`, `options` contains `EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = … AND r.owner_id = auth.uid())` (and for 2-hop tables a second JOIN). `restaurants.owner_id` is not listed as indexed in `076_performance_indexes.sql` or later. `dishes.restaurant_id`, `menus.restaurant_id`, `option_groups.restaurant_id`, `options.option_group_id` — index status similarly unverified from the migrations tree (expect the PK on `restaurants.id` and `dishes.id` to carry the JOIN but `owner_id` filter needs its own index).
- Why it matters: every INSERT / UPDATE / DELETE on these tables triggers a plan that scans `restaurants` (or `menus → restaurants`) to resolve the ownership predicate. At ~100s of restaurants per owner this is fine; at 10k+ it becomes a per-row overhead. Especially relevant for bulk imports (`restaurant_import_jobs` flow) and AI menu-scan confirm writes.
- Suggested direction: add indexes on `restaurants.owner_id`, `menus.restaurant_id`, `option_groups.restaurant_id` via a new migration. Needs-verification whether these already exist from earlier schema — 076 only covers seven specific indexes and the repo does not include a full catalog of pre-071 indexes here.
- Confidence: likely (needs-verification for which indexes already existed before 071).

### REV-01-j: `public.users` FK to `auth.users` relies on the `public.users.id` column being the PK *and* the FK — safe but brittle

- Severity: info
- Category: correctness
- Location: `infra/supabase/migrations/084_fix_user_fk_cascades.sql:27-31`
- Observation: migration 084 re-adds `users_id_fkey` as `ON DELETE CASCADE`. The trigger in `083:4-21` then inserts a row into `public.users` on every `auth.users` insert. `create_behavior_profile_on_signup` in 083 inserts into `public.user_behavior_profiles`, which itself has `user_id` pointing at `auth.users(id)` directly (per 084:52-55). There's no FK from `user_behavior_profiles.user_id → public.users.id`, so `public.users` and `user_behavior_profiles` are parallel extensions of `auth.users`. If the profile table grows to include columns that gate behavior (cadence, streaks), downstream code cannot assume a matching `public.users` row exists.
- Why it matters: purely a modeling observation — no immediate defect. But the double-tree pattern (some tables FK `auth.users`, others FK `public.users`) is a frequent source of later drift.
- Suggested direction: document in `agent_docs/database.md` which child tables FK which side, or centralise on `public.users` where profile metadata is used.
- Confidence: confirmed
- Evidence: FK definitions in 084.

### REV-01-k: `restaurant_import_jobs` and `google_api_usage` enable RLS but define zero policies — service-role-only by design, but undocumented at the policy layer

- Severity: info
- Category: security
- Location: `infra/supabase/migrations/080_restaurant_import.sql:47, 63`
- Observation: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is called on both tables with no policies attached. The in-file comment (lines 65-67) explains: "tables are accessed exclusively through server-side API routes using the service role key." Default-deny is the correct posture and service_role bypasses RLS — so behavior is actually secure. This is not a bug.
- Why it matters: future maintainers reading the migration see "RLS enabled" and may assume policies exist. Making the deny-all explicit (e.g., `CREATE POLICY "deny_all" ... USING (false) WITH CHECK (false)`) improves self-documentation and prevents accidental policy addition from loosening the default.
- Suggested direction: optional — add explicit deny-all policies with a comment, or leave as-is and update `agent_docs/` to document the service-role-only table convention.
- Confidence: confirmed

### REV-01-l: Migration 094 backfill uses `DELETE FROM option_groups WHERE dish_id IS NULL` after snapshotting — irreversible in prod if `dish_id` column was wrong

- Severity: info
- Category: correctness
- Location: `infra/supabase/migrations/094_dish_scoped_option_groups.sql:20-29`
- Observation: rows with `dish_id IS NULL` are snapshotted to `_orphan_option_groups_094` and then deleted. Migration 096 later drops the quarantine table (audit-confirmed empty per its comment). If the table had not been empty, the original rows would be unrecoverable after 096 runs, but the intent was clear.
- Why it matters: standard "quarantine-then-delete" pattern. Worth noting that 096 should have checked `SELECT COUNT(*) = 0` before dropping, even though the comment asserts the audit happened.
- Suggested direction: future similar migrations should guard the drop with an explicit count check (e.g., `DO $$ BEGIN IF EXISTS(…) THEN RAISE EXCEPTION … END IF; END $$;`) so rerunning the drop migration after an unexpected row lands fails loudly.
- Confidence: confirmed

## No issues found in

- PostGIS POINT argument order: every `ST_MakePoint` / `ST_SetSRID` call in 071, 072, 073, 088 uses `ST_MakePoint(p_lng, p_lat)` — matches CLAUDE.md pitfall #1. No swapped calls.
- Migrations 089, 090, 095, 097: pure additive changes (columns, reference-table rows), no RLS / FK concerns.
- Migration 078: only drops stale policies and re-creates the three intended "Public read" SELECT policies. No regression.
- `recent_viewed_restaurants` view (077): explicitly `WITH (security_invoker = true)`, meaning the view honors caller's RLS — correct.
- `dish_opinions`, `dish_photos`, `restaurant_experience_responses` FK actions: correctly set to SET NULL in 086 (UGC preservation) with corresponding `DROP NOT NULL`. Pattern is coherent.
- Private schema creation in 075 (`CREATE SCHEMA private`) and its SECURITY DEFINER participant check with empty search_path — correctly hardened.
- `refresh_materialized_views()` refresh order (079:188-194): `dish_ratings_summary` refreshed before `restaurant_ratings_summary`, matching the FROM dependency.
- CHECK constraints on `dish_opinions.note` (079:10 — `char_length(note) <= 47`) and `source` enum (079:11) — match the mobile UI's 47-char counter.
- `generate_candidates` dish-availability predicates (`d.is_parent = false`, `d.is_available = true`) correctly exclude variant parents from the feed after 073.
- Index coverage for Eat Together flow (076: `idx_eat_members_session_left`, `idx_eat_members_session_user_active`, `idx_eat_votes_session`) matches the policies in 075.

## Follow-up questions

1. Does `public.restaurants.owner_id` have a dedicated index in a pre-071 migration? The review only covers 071-097; an index may exist in the baseline schema — confirm from a live `\di public.restaurants*` or an earlier migration file.
2. What is the production `CREATE`/`USAGE` grant configuration on the `public` schema? Needed to resolve REV-01-h from `likely` to `confirmed` / `cleared`.
3. Are `user_streaks` / `user_badges` ever written by the service role directly (bypassing RLS) from `apps/mobile/src/services/gamificationService.ts`? If yes, REV-01-g's proposed "lock writes to SECURITY DEFINER RPC" is straightforward; if the mobile client writes directly, refactor cost is higher.
4. Has the Supabase project enabled `supabase_auth_admin` to cascade across schemas other than `public`? Migrations 085/087 grant explicitly on `public.*` — confirm no auth.users FK elsewhere (`storage.objects` owner, for example).
5. For REV-01-a (user_badges FK): was the absence intentional (e.g., to retain the badge earned-at record as an audit trail)? If so, it should mirror the UGC pattern (SET NULL + `DROP NOT NULL`) rather than stay as NO ACTION, since the current state blocks user deletion.

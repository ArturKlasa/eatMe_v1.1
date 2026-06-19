# Phase 3: RLS Hardening - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Per Phase 1 FINDINGS (**F-11**), all **11 behavioral tables already have RLS enabled with owner policies in prod** (operator probe 2026-06-19; catch-all: only `spatial_ref_sys` — a PostGIS system table — is unprotected). There is **no prod security gap**. The SEC-02 "enable RLS" work has nothing to enable.

This phase delivers **ONE staged, dry-run-only migration that CODIFIES the existing prod RLS into version control**, closing the **migrations↔prod drift**: the repo baseline currently has ZERO `ENABLE ROW LEVEL SECURITY` for these tables (prod was configured out-of-band via the Supabase dashboard or untracked migrations). The codified migration makes the canonical RLS state live in the repo.

**Authored + dry-run only — never applied to prod (prod is already protected).** The operator validates it on a Supabase branch/shadow DB. This phase writes no mobile/edge code; `pnpm check-types` is the only app-side gate (the migration doesn't change generated types).

**The 11 behavioral tables (all mobile-direct):** `dish_analytics`, `dish_opinions`, `dish_photos`, `favorites`, `restaurant_experience_responses`, `session_views`, `user_behavior_profiles`, `user_dish_interactions`, `user_points`, `user_sessions`, `user_visits`.

**Out of this phase's boundary:**
- **`dish_analytics`** is dish-keyed (PK `dish_id`, no `user_id`) → public-read + service-role only, **NOT a per-user owner policy** (F-11 critical correction).
- **Schema-baseline reconstruction** — the 11 tables' `CREATE TABLE` DDL is NOT in any repo migration (history starts at 071; the original table-creation migrations are missing). This phase codifies *RLS only* and documents the table-precondition; reconstructing the missing table DDL is a separate deferred drift item.
- Any RLS change to **non-behavioral** tables (restaurant-content chain already codified in 091; `menu_scan_jobs` in 119).

</domain>

<decisions>
## Implementation Decisions

### Codification fidelity (Area 1)
- **D-01:** **Functional re-creation from the F-11 probe.** Author policies that reproduce the access *semantics* the F-11 probe documented (per-table `cmd → role → predicate`). **No new prod probe needed** — the F-11 table is the source of truth. Policy *names* and exact predicate text may differ from prod's literal DDL; they will be functionally identical. We are NOT targeting a byte-exact `supabase db diff == 0` (that would require a fresh `pg_policies`/`pg_get_expr` dump — explicitly rejected).

### Policy shape (Area 2)
- **D-02:** **InitPlan form mandatory (SC#2):** every owner predicate is `(select auth.uid()) = user_id`, NOT bare `auth.uid()`. This intentionally *improves on* prod (and the existing 079/091/119 migrations, which all use bare `auth.uid()`) — functionally identical, avoids per-row re-evaluation. This is the one deliberate divergence from prod's literal form, and it's required by SC#2.
- **D-03:** **No admin override.** Behavioral-table policies stay **pure own-row** — do NOT add `OR public.is_admin()` (the 091/119 convention for restaurant-content tables). Prod's behavioral-table policies have no admin clause; these 10 tables hold user-private data (favorites, opinions, visits, behavior profiles). Adding admin-read would be an access *expansion* not present in prod. Service-role (which bypasses RLS) already covers any backend need.
- **D-04:** **Normalize own-row policies to `TO authenticated`.** Prod inconsistently targets some own-row policies at `public` (e.g. `favorites`, `user_dish_interactions`) and others at `authenticated`. Author all own-row read/write policies as `TO authenticated` (intent-revealing; with `(select auth.uid())` an anon caller's uid is NULL so own-row fails regardless — functionally equivalent to prod).
- **D-05:** **Preserve genuine public-read.** Keep `FOR SELECT USING (true)` (open to `public`) exactly where prod has a real public read: `dish_opinions`, `dish_photos`, `dish_analytics` (per the F-11 probe table). Do not collapse these to own-row.
- **D-06:** **Reproduce each table's documented command coverage from the F-11 probe verbatim** (the CRUD verbs per table — see the per-table map in `<code_context>`). E.g. `favorites` = SELECT/INSERT/DELETE own (no UPDATE); `restaurant_experience_responses` = public SELECT + INSERT-only own; `session_views` = SELECT/INSERT own. Don't add commands prod doesn't grant.

### `dish_analytics` (locked from F-11)
- **D-07:** `dish_analytics` gets `FOR SELECT USING (true)` (public-read) + an explicit `ALL TO service_role USING (true)` policy — matching its prod shape. **No owner policy, no `user_id` index** (it has no `user_id` column).

### Owner-column index (Area 3)
- **D-08:** `CREATE INDEX IF NOT EXISTS idx_<table>_user_id ON public.<table>(user_id)` for the **7 owner tables with no tracked leading-`user_id` index**: `dish_opinions`, `dish_photos`, `restaurant_experience_responses`, `user_behavior_profiles`, `user_points`, `user_sessions`, `user_visits`.
- **D-09:** **Rely on `076_performance_indexes.sql`'s existing leading-`user_id` composite indexes** for `favorites` (`idx_favorites_user_subject`), `user_dish_interactions` (`idx_interactions_user_type`), and `session_views` (`idx_session_views_user_type`) — a composite btree leading with `user_id` already serves the policy's equality lookup. Add an in-file comment noting these 3 are already covered (no redundant single-column index).

### Migration safety & structure (Area 4)
- **D-10:** **One migration file** `170_codify_behavioral_rls.sql` (next free number) — atomic `ENABLE RLS` + policy + index per table in the same file (SC#1). Plus a `170_REVERSE_ONLY_codify_behavioral_rls.sql` pair (disable RLS + drop the policies/indexes this migration created).
- **D-11:** **Defensive + idempotent**, following repo convention: `DROP POLICY IF EXISTS` before every `CREATE POLICY` (091 pattern), idempotent `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, `CREATE INDEX IF NOT EXISTS`, all wrapped in `BEGIN; … COMMIT;` (119 pattern). Safe to re-run; would not collide if ever run against prod (which already has the policies).
- **D-12:** **Document the table-precondition in the file header:** the migration assumes the 11 tables already exist (created pre-071 / out-of-band). Its `ALTER TABLE`/`CREATE POLICY`/`CREATE INDEX` are no-ops-or-errors on a DB where the tables are absent — by design, this phase codifies *protection on existing tables*, not table creation.

### Validation (Area 4 / SC#4)
- **D-13:** **Operator validates on a Supabase branch/shadow DB** (or prod-clone) — mirrors the Phase 1/2 stage-don't-apply model (operator owns any DB touch). Locally: author + careful **static SQL self-review** (valid DDL, correct table/column names cross-checked against the F-11 probe + `database_schema.sql`, idempotency guards present). `pnpm check-types` covers the app/type side (no type regen expected — RLS doesn't change generated types).

### Claude's Discretion
- Exact policy names (functional fidelity per D-01 means names need only be clear/consistent, e.g. `"<table>: owner select"`).
- Whether to include the explicit `ALL TO service_role` policies that prod has on `user_behavior_profiles` (and `dish_analytics`, D-07). Service-role bypasses RLS so they're technically redundant — lean **include for fidelity** (harmless, explicit, matches the codified prod truth) unless it complicates the file.
- Comment/section layout within the single migration file.
- Exact REVERSE-pair ordering (drop indexes/policies, then disable RLS).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirement
- `.planning/ROADMAP.md` → "Phase 3: RLS Hardening" — goal, the 4 success criteria, and the **Scope note (per FINDINGS)** that repurposes the phase from "enable RLS" to "CODIFY existing prod RLS into a tracked migration."
- `.planning/REQUIREMENTS.md` — **SEC-02** (line 19): owner policy on every user-owned behavioral table, `(select auth.uid())` form, index on owner column, enable+policy atomic in one migration. (SEC-02 stays open until the codifying migration is authored.)

### Source of truth for the RLS to codify (READ FIRST)
- `.planning/codebase/FINDINGS.md` §**F-11** ("dish_analytics / User Behavioral Tables RLS Audit Gap", ~lines 136–165) — **the per-table `rowsecurity` + caller + policies (cmd → role → predicate) table from the operator prod probe.** This is the exact spec the codifying migration reproduces functionally. Includes the catch-all (only `spatial_ref_sys` unprotected) and the `dish_analytics`-is-not-user-owned correction.
- `infra/scripts/assess-live-state.sql` — the read-only probe (Blocks 1 / 1b / 4) that produced the F-11 data; reference for what was actually queried on prod.

### Existing RLS migration conventions (pattern to match)
- `infra/supabase/migrations/091_content_rls_owner_writes.sql` — `DROP POLICY IF EXISTS` → `CREATE POLICY` idempotency pattern; `is_admin()` helper definition (NOT used here per D-03); per-table policy layout. **Note:** uses bare `auth.uid()` — D-02 upgrades to the InitPlan form.
- `infra/supabase/migrations/119_menu_scan_jobs_rls.sql` — `BEGIN; … COMMIT;` wrapping; owner-scoped SELECT/INSERT/UPDATE policy style; the `_REVERSE_ONLY_` pairing convention.
- `infra/supabase/migrations/079_rating_system_redesign.sql` — own-row `auth.uid() = user_id` policy examples on user tables (`user_streaks`, `user_badges`).

### Index baseline
- `infra/supabase/migrations/076_performance_indexes.sql` (lines 5–18) — existing leading-`user_id` composite indexes: `idx_favorites_user_subject`, `idx_interactions_user_type`, `idx_session_views_user_type` (the 3 tables D-09 relies on instead of adding new indexes).

### Schema reference (owner-column names; context-only)
- `infra/supabase/migrations/database_schema.sql` — **WARNING: "for context only, not meant to be run"** (zero RLS/policies/indexes). Use ONLY to confirm table/column names (e.g. `favorites.user_id`, `dish_analytics_pkey PRIMARY KEY (dish_id)`). Not the migration baseline.

### Constraints & prior workflow
- `.planning/PROJECT.md` — Constraints: **stage-don't-apply** (operator deploys/validates prod; author + dry-run only); "RLS: every table needs RLS enabled with an `owner_id` FK to `auth.users`; default deny-all."
- `.planning/phases/01-assessment-findings-register/01-CONTEXT.md` and `.planning/phases/02-cors-lockdown/02-CONTEXT.md` — establish the operator-runs-prod / authored-and-validated workflow this phase inherits for the branch-validation step.

</canonical_refs>

<code_context>
## Existing Code Insights

### Per-table policy map to author (from F-11 probe — the spec)

| Table | RLS | Policies to codify (functional) | Owner index |
|-------|-----|--------------------------------|-------------|
| `dish_analytics` | enable | SELECT `USING (true)` public-read; `ALL TO service_role USING (true)` | **none** (no `user_id`) |
| `dish_opinions` | enable | SELECT `USING (true)` public; INSERT/UPDATE/DELETE `TO authenticated` own-row | add `(user_id)` |
| `dish_photos` | enable | SELECT `USING (true)` public; INSERT/UPDATE/DELETE `TO authenticated` own-row | add `(user_id)` |
| `favorites` | enable | SELECT/INSERT/DELETE `TO authenticated` own-row (no UPDATE) | **use 076 composite** |
| `restaurant_experience_responses` | enable | SELECT `USING (true)` public; INSERT `TO authenticated` own-row | add `(user_id)` |
| `session_views` | enable | SELECT/INSERT `TO authenticated` own-row | **use 076 composite** |
| `user_behavior_profiles` | enable | SELECT/UPDATE `TO authenticated` own-row; `ALL TO service_role USING (true)` | add `(user_id)` |
| `user_dish_interactions` | enable | SELECT/INSERT `TO authenticated` own-row | **use 076 composite** |
| `user_points` | enable | SELECT/INSERT `TO authenticated` own-row | add `(user_id)` |
| `user_sessions` | enable | SELECT/INSERT/UPDATE `TO authenticated` own-row | add `(user_id)` |
| `user_visits` | enable | SELECT/INSERT/UPDATE `TO authenticated` own-row | add `(user_id)` |

Own-row predicate everywhere = `(select auth.uid()) = user_id` (USING for SELECT/UPDATE/DELETE; WITH CHECK for INSERT/UPDATE). Public-read = `USING (true)`. **Cross-check the exact command coverage per table against F-11 before authoring** — the table above is the planning summary, F-11 is authoritative.

### Reusable Assets
- **Idempotency pattern** from 091: `DROP POLICY IF EXISTS "<name>" ON public.<t>;` then `CREATE POLICY …`.
- **Transaction wrap + REVERSE pairing** from 119: `BEGIN; … COMMIT;` and a sibling `170_REVERSE_ONLY_*.sql`.
- **`076` composite indexes** already cover the owner-lookup for `favorites` / `user_dish_interactions` / `session_views`.

### Established Patterns
- **Migrations are SQL files, not applied locally** — no psql/Docker in the agent loop; the operator deploys/validates on prod or a branch (stage-don't-apply).
- **`(select auth.uid())` is a deliberate upgrade** over the repo's existing bare-`auth.uid()` migrations — required by SC#2, functionally identical, InitPlan-optimized.
- Service-role bypasses RLS — no service-role policy is *required* for correctness (D-03); explicit ones are codified only for prod-fidelity (Claude's discretion).

### Integration Points
- **Migration number:** next free is **170** (last is `169_generate_candidates_pushdown.sql`).
- **No app/edge coupling** — this is a DB-only migration; mobile/admin/edge code is untouched. `pnpm check-types` is a formality (no type regen).
- **Phase 6 (Schema Teardown Spine)** also authors migrations — 170 here is independent and lower-numbered work; no ordering conflict (Phase 6's drops target the ingredient pipeline, not these behavioral tables).

</code_context>

<specifics>
## Specific Ideas

- The migration is **codification, not change** — it makes version control reflect what prod already enforces. The guiding principle: reproduce prod's *protection semantics* faithfully, with exactly two deliberate improvements (the `(select auth.uid())` InitPlan form per SC#2, and role-target normalization to `authenticated`) and exactly zero access *expansions* (no admin override, no extra commands, no new public reads).
- "Faithful where it's real, cleaner where it's free": preserve prod's genuine public reads and per-table command coverage; normalize only the cosmetic inconsistencies that don't change who-can-do-what.
- Verification mirrors SC#1–4: (1) one file, enable+policy+index atomic per table; (2) InitPlan form + owner index present; (3) `dish_analytics` left as public/service-role, no owner policy; (4) operator branch-validate + `pnpm check-types`.

</specifics>

<deferred>
## Deferred Ideas

- **Pre-071 table-DDL drift** — the 11 behavioral tables' `CREATE TABLE` statements are absent from the repo's numbered migrations (history starts at 071; the original creation migrations were never committed or were truncated). A truly fresh DB built from `infra/supabase/migrations/` alone would not create these tables. Reconstructing that DDL (from prod) is a **separate drift-closure item for a future cycle** — out of scope for Phase 3, which codifies RLS only. Document the precondition (D-12); don't fix it here.
- **Byte-exact prod parity (`db diff == 0`)** — would require a fresh `pg_policies` + `pg_get_expr` dump and reproducing prod's literal names/predicates/role inconsistencies. Rejected (D-01) in favor of functional fidelity. Revisit only if a drift-detection-by-diff workflow is ever adopted.
- **Automated RLS regression test suite** (anon-deny pattern) — already tracked as **QUAL-V2-01** (REQUIREMENTS v2), deliberately deferred to keep this cycle minimal-test.
- **Codifying the `076` composite indexes' assumed prod deployment** — D-09 relies on those composites existing in prod; since pre-071 history is incomplete, their prod deployment isn't guaranteed. Not blocking (the policies are correct regardless of index presence; index only affects perf). Operator can confirm during branch validation if desired.

</deferred>

---

*Phase: 03-rls-hardening*
*Context gathered: 2026-06-19*

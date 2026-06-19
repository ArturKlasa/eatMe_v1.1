# Phase 3: RLS Hardening - Research

**Researched:** 2026-06-19
**Domain:** PostgreSQL / Supabase Row-Level Security (RLS) policy codification; SQL migration authoring (dry-run-only, stage-don't-apply)
**Confidence:** HIGH

> This was a **focused verification + validation-architecture pass**, not open-ended discovery. CONTEXT.md already contains a full locked spec (13 decisions, a per-table policy map, migration patterns, migration 170 reserved). Every claim below is cross-checked against the actual repo files — no external/web research was required or performed. All findings are `[VERIFIED: codebase]` unless noted.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Functional re-creation from the F-11 probe. Author policies reproducing the access *semantics* the F-11 probe documented (per-table `cmd → role → predicate`). No new prod probe. Policy *names* and exact predicate text may differ from prod's literal DDL; functionally identical. NOT targeting byte-exact `supabase db diff == 0`.
- **D-02:** InitPlan form mandatory (SC#2): every owner predicate is `(select auth.uid()) = user_id`, NOT bare `auth.uid()`. Deliberate improvement over prod and over the existing 079/091/119 migrations (all use bare `auth.uid()`) — functionally identical, avoids per-row re-evaluation.
- **D-03:** No admin override. Behavioral-table policies stay pure own-row — do NOT add `OR public.is_admin()`. Service-role (bypasses RLS) covers backend need.
- **D-04:** Normalize own-row policies to `TO authenticated`. (Prod inconsistently targets some at `public`, some at `authenticated`; with `(select auth.uid())` an anon caller's uid is NULL so own-row fails regardless — functionally equivalent.)
- **D-05:** Preserve genuine public-read. Keep `FOR SELECT USING (true)` (open to `public`) where prod has a real public read: `dish_opinions`, `dish_photos`, `dish_analytics`. Do not collapse to own-row.
- **D-06:** Reproduce each table's documented command coverage from F-11 verbatim (CRUD verbs per table). Don't add commands prod doesn't grant.
- **D-07:** `dish_analytics` gets `FOR SELECT USING (true)` (public-read) + explicit `ALL TO service_role USING (true)`. NO owner policy, NO `user_id` index (no `user_id` column).
- **D-08:** `CREATE INDEX IF NOT EXISTS idx_<table>_user_id ON public.<table>(user_id)` for the 7 owner tables with no tracked leading-`user_id` index: `dish_opinions`, `dish_photos`, `restaurant_experience_responses`, `user_behavior_profiles`, `user_points`, `user_sessions`, `user_visits`.
- **D-09:** Rely on `076_performance_indexes.sql`'s existing leading-`user_id` composites for `favorites` (`idx_favorites_user_subject`), `user_dish_interactions` (`idx_interactions_user_type`), `session_views` (`idx_session_views_user_type`). Add an in-file comment noting these 3 are already covered (no redundant single-column index).
- **D-10:** One migration file `170_codify_behavioral_rls.sql` (next free) — atomic `ENABLE RLS` + policy + index per table in the same file (SC#1). Plus `170_REVERSE_ONLY_codify_behavioral_rls.sql` pair.
- **D-11:** Defensive + idempotent: `DROP POLICY IF EXISTS` before every `CREATE POLICY` (091 pattern), idempotent `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, `CREATE INDEX IF NOT EXISTS`, all wrapped in `BEGIN; … COMMIT;` (119 pattern).
- **D-12:** Document the table-precondition in the file header: migration assumes the 11 tables already exist (created pre-071 / out-of-band).
- **D-13:** Operator validates on a Supabase branch/shadow DB (stage-don't-apply). Locally: author + static SQL self-review + `pnpm check-types`.

### Claude's Discretion

- Exact policy names (functional fidelity per D-01 → names need only be clear/consistent, e.g. `"<table>: owner select"`).
- Whether to include explicit `ALL TO service_role` policies on `user_behavior_profiles` (and `dish_analytics`, D-07). Service-role bypasses RLS so they're technically redundant — lean **include for fidelity** unless it complicates the file.
- Comment/section layout within the single migration file.
- Exact REVERSE-pair ordering (drop indexes/policies, then disable RLS).

### Deferred Ideas (OUT OF SCOPE)

- **Pre-071 table-DDL drift** — the 11 tables' `CREATE TABLE` DDL is absent from numbered migrations (history starts at 071). Reconstructing it is a separate future drift-closure item. Document the precondition (D-12); don't fix here.
- **Byte-exact prod parity (`db diff == 0`)** — rejected (D-01) in favor of functional fidelity.
- **Automated RLS regression test suite** (anon-deny pattern) — tracked as QUAL-V2-01, deferred.
- **Codifying the 076 composite indexes' prod deployment** — D-09 relies on them existing in prod; not blocking (index only affects perf). Operator can confirm during branch validation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-02 | RLS enabled with an owner policy on every user-owned behavioral table; policies use `(select auth.uid())` with an index on the owner column; enable + policy land atomically in the same migration. (Repurposed per F-11: prod already enforces RLS — SEC-02 is satisfied by CODIFYING that prod RLS into ONE tracked, dry-run-only migration #170, closing the migrations↔prod drift.) | Verified all 11 tables + 10 `user_id` columns exist (schema cross-check below); confirmed zero tracked RLS for these tables (the drift); confirmed migration 170 is free; confirmed the 3 existing 076 composites and the 7 missing-index tables; documented the InitPlan-form + `TO authenticated`/anon-NULL semantics; built the SC#1–4 Validation Architecture. |
</phase_requirements>

## Summary

This phase authors **one staged, dry-run-only SQL migration** (`170_codify_behavioral_rls.sql` + its `_REVERSE_ONLY_` pair) that **codifies the RLS already enforced in prod** for 11 mobile-direct behavioral tables. Prod already has `rowsecurity=true` + owner/public policies on every one of them (operator probe 2026-06-19, F-11) — there is **no prod security gap**. The repo migration baseline, however, contains **zero** `ENABLE ROW LEVEL SECURITY` for these tables (verified — see below), meaning prod was configured out-of-band. The migration closes that **migrations↔prod drift** so the canonical RLS state lives in version control.

The independent cross-check of the F-11 per-table policy map against `database_schema.sql` came back **clean with zero mismatches**: all 11 tables exist; the 10 owner tables each have a column literally named `user_id` (`uuid NOT NULL`, FK → `auth.users(id)`); `dish_analytics` has PK `dish_id` and **no `user_id` column** (confirmed at `database_schema.sql:63–77`). No blocking finding. The migration is therefore safe to author exactly as the CONTEXT spec describes.

This is DB-only work: no mobile/edge/app code changes, no generated-type regen. The local gate is **static SQL self-review** (DDL validity, table/column name cross-check, idempotency guards, BEGIN/COMMIT wrap, REVERSE pairing) plus `pnpm check-types`. Real apply-and-prove validation is an **operator handoff** on a Supabase branch / shadow DB (stage-don't-apply, inherited from Phases 1–2).

**Primary recommendation:** Author migration 170 reproducing the F-11 probe semantics verbatim, with exactly two deliberate divergences — the `(select auth.uid())` InitPlan form (D-02, required by SC#2) and role-target normalization to `TO authenticated` (D-04) — and zero access expansions (no admin override, no extra commands, no new public reads). Follow the 091 idempotency pattern + 119 transaction/REVERSE pattern. Add single-column owner indexes for the 7 tables lacking a tracked leading-`user_id` index; comment (don't duplicate) the 3 covered by 076 composites.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Row-ownership enforcement (own-row read/write) | Database (Postgres RLS) | — | RLS is enforced by Postgres on every query regardless of caller; the mobile anon/authed REST client is the direct caller, so DB-tier policy is the only correct enforcement point. |
| Public-read exposure (`dish_*` aggregates) | Database (Postgres RLS) | — | `USING (true)` SELECT policies are DB-tier; no app logic involved. |
| Service-role backend access | Database (RLS bypass) | — | Service-role bypasses RLS entirely; explicit `ALL TO service_role` policies are codified for fidelity only (D-07, discretion), not for correctness. |
| Owner-lookup index performance | Database (btree index) | — | Index supports the `user_id =` equality in each policy predicate; pure DB concern. |
| Type-contract stability | Shared package (`@eatme/database` types) | — | RLS changes do not alter generated types; `pnpm check-types` is a no-regression formality only. |

**Every capability in this phase is Database-tier.** There is no app/edge/client work. This is the expected shape for an RLS-codification migration.

## Standard Stack

This phase introduces **no new dependencies, libraries, or tools.** It authors a `.sql` file using the existing repo migration conventions and Postgres/Supabase built-ins.

### Core (existing, in-repo)
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL | 15 (+ PostGIS, pgvector 0.8.0) | RLS engine, DDL target | EatMe's Supabase backend (CLAUDE.md). `[VERIFIED: codebase + F-13 live probe]` |
| Supabase Auth | n/a | Provides `auth.uid()` SQL function used in policy predicates | Existing convention across 079/091/119. `[VERIFIED: codebase]` |
| Repo migration convention | n/a | `NNN_<descriptor>.sql` forward + `NNN_REVERSE_ONLY_<descriptor>.sql` reverse | Established pattern through migration 169. `[VERIFIED: codebase — ls of migrations dir]` |

### Supporting (existing patterns to replicate)
| Pattern Source | Purpose | When to Use |
|----------------|---------|-------------|
| `091_content_rls_owner_writes.sql` | `DROP POLICY IF EXISTS` → `CREATE POLICY` idempotency; per-table layout; `ENABLE ROW LEVEL SECURITY` (idempotent) | Every policy block in 170. `[VERIFIED: codebase]` |
| `119_menu_scan_jobs_rls.sql` | `BEGIN; … COMMIT;` transaction wrap; owner-scoped SELECT/INSERT/UPDATE policy style; `_REVERSE_ONLY_` sibling reference in header | File-level structure of 170. `[VERIFIED: codebase]` |
| `079_rating_system_redesign.sql` | Own-row `auth.uid() = user_id` policy examples on user tables (`user_streaks`, `user_badges`); separate SELECT/INSERT/UPDATE policies | Per-command policy shape (upgrade bare `auth.uid()` → `(select auth.uid())`). `[VERIFIED: codebase]` |
| `076_performance_indexes.sql` (lines 5–18) | The 3 existing leading-`user_id` composite indexes D-09 relies on | Comment reference in 170; do not duplicate. `[VERIFIED: codebase]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Functional re-creation (D-01) | Byte-exact prod dump (`pg_policies` + `pg_get_expr`) → `db diff == 0` | Rejected (D-01 / deferred): requires a fresh prod policy dump and reproducing prod's literal names + role inconsistencies; offers no security benefit over functional fidelity. |
| `(select auth.uid())` InitPlan form | Bare `auth.uid()` (what prod + 079/091/119 use) | Bare form re-evaluates the function per row; InitPlan form evaluates once. SC#2 mandates the InitPlan form. Functionally identical results. |
| Single-column `(user_id)` index (D-08) | Multi-column composite | The policy predicate is a single-column `user_id =` equality; a leading-`user_id` btree (single or composite) serves it. The 3 tables already covered by 076 composites need no new index (D-09). |

**Installation:** None. No `npm install` / `pip install`. The deliverable is two `.sql` files plus a `pnpm check-types` run.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. The deliverable is two SQL migration files using in-repo conventions and Postgres/Supabase built-ins. No npm/PyPI/crates dependency is added or modified.

## F-11 Cross-Check: Per-Table Verification (Objective #1)

> Independent cross-check of the F-11 per-table policy map (CONTEXT `<code_context>`, sourced from FINDINGS.md §F-11) against the actual table/column names in `infra/supabase/migrations/database_schema.sql`. **Result: CLEAN — zero mismatches, zero blocking findings.** `[VERIFIED: codebase]`

| # | Table | (a) Exists in schema ref? | (b) Owner column literally `user_id`? | Column line | Notes |
|---|-------|--------------------------|---------------------------------------|-------------|-------|
| 1 | `dish_analytics` | ✅ `database_schema.sql:63` | **N/A — no `user_id`** (PK `dish_id`) | `dish_id uuid NOT NULL` (line 64); `dish_analytics_pkey PRIMARY KEY (dish_id)` (line 75) | (c) **CONFIRMED**: PK is `dish_id`, FK → `dishes(id)`; **no `user_id` column present**. Public-read + service-role only (D-07). |
| 2 | `dish_opinions` | ✅ line 98 | ✅ `user_id uuid NOT NULL` (line 100) | FK → `auth.users(id)` (line 109) | Has genuine public-read (D-05). |
| 3 | `dish_photos` | ✅ line 114 | ✅ `user_id uuid NOT NULL` (line 117) | FK → `auth.users(id)` (line 123) | Has genuine public-read (D-05). |
| 4 | `favorites` | ✅ line 218 | ✅ `user_id uuid NOT NULL` (line 220) | FK → `auth.users(id)` (line 225) | Index covered by 076 composite (D-09). |
| 5 | `restaurant_experience_responses` | ✅ line 324 | ✅ `user_id uuid NOT NULL` (line 326) | FK → `auth.users(id)` (line 333) | Has genuine public-read (D-05); INSERT-only own (no UPDATE/DELETE). |
| 6 | `session_views` | ✅ line 381 | ✅ `user_id uuid NOT NULL` (line 384) | FK → `auth.users(id)` (line 392) | Index covered by 076 composite (D-09). |
| 7 | `user_behavior_profiles` | ✅ line 402 | ✅ `user_id uuid NOT NULL` (line 403) | **`user_id` is the PK** (line 417); FK → `auth.users(id)` (line 418) | PK = `user_id` (1 row/user). SELECT/UPDATE own + `ALL service_role`. |
| 8 | `user_dish_interactions` | ✅ line 420 | ✅ `user_id uuid NOT NULL` (line 422) | FK → `auth.users(id)` (line 428) | Index covered by 076 composite (D-09). |
| 9 | `user_points` | ✅ line 431 | ✅ `user_id uuid NOT NULL` (line 433) | FK → `auth.users(id)` (line 440) | SELECT/INSERT own. |
| 10 | `user_sessions` | ✅ line 464 | ✅ `user_id uuid NOT NULL` (line 466) | FK → `auth.users(id)` (line 472) | SELECT/INSERT/UPDATE own. |
| 11 | `user_visits` | ✅ line 474 | ✅ `user_id uuid NOT NULL` (line 476) | FK → `auth.users(id)` (line 483) | SELECT/INSERT/UPDATE own. |

**Verdict:** Every table named in the F-11 map exists in the schema reference under the exact name used. Every one of the 10 owner tables uses the literal column name `user_id` — there is **no table whose owner column is named differently** (e.g. no `owner_id`, no `uid`, no `account_id`). `dish_analytics` is confirmed dish-keyed with no `user_id`. **The CONTEXT spec's column references are all correct; authoring the migration as specified will not ship a broken security migration on a wrong column name.**

> **Owner-column nuance for the planner:** the CLAUDE.md "RLS on new tables" pitfall says new tables get `owner_id` FK to `auth.users`. These 11 tables are **pre-existing** and use `user_id` (not `owner_id`) — which is exactly what the F-11 probe and policy map specify. Do **not** rename or "normalize" to `owner_id`; that would break the predicate. The restaurant-content chain (091) uses `owner_id`; the behavioral chain uses `user_id`. Both are correct for their respective tables.

## Migration Conventions to Replicate (Objective #2)

All conventions verified by reading the cited analog migrations. `[VERIFIED: codebase]`

### Idempotency pattern (from 091)
```sql
-- Source: infra/supabase/migrations/091_content_rls_owner_writes.sql:51-52
DROP POLICY IF EXISTS "Public read menu_categories"  ON public.menu_categories;
CREATE POLICY "Public read menu_categories"  ON public.menu_categories  FOR SELECT USING (true);
```
- `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;` is used unconditionally and is idempotent in Postgres (091:39–45). No `IF NOT EXISTS` needed for `ENABLE RLS`.
- **091 uses `OR public.is_admin()`** on its restaurant-content write policies. **D-03 explicitly forbids this** for behavioral tables — do NOT copy the `is_admin()` clause. (The `is_admin()` helper itself is defined in 091:25–34; 170 does not need to redefine it and must not call it.)
- **091 uses bare `auth.uid()`** — D-02 upgrades 170 to `(select auth.uid())`.

### Transaction wrap + REVERSE pairing (from 119)
```sql
-- Source: infra/supabase/migrations/119_menu_scan_jobs_rls.sql:15-19,63
-- Reverse: 119_REVERSE_ONLY_menu_scan_jobs_rls.sql
BEGIN;
ALTER TABLE public.menu_scan_jobs ENABLE ROW LEVEL SECURITY;
-- … CREATE POLICY blocks …
COMMIT;
```
- Header references its reverse sibling by name (`119:15`). 170's header should do the same: `-- Reverse: 170_REVERSE_ONLY_codify_behavioral_rls.sql`.
- 119 uses `TO authenticated` + `WITH CHECK` on INSERT and `USING` on SELECT/UPDATE — the exact own-row shape 170 needs (minus the admin/restaurant-owner joins, which are 119-specific).

### Own-row policy examples (from 079)
```sql
-- Source: infra/supabase/migrations/079_rating_system_redesign.sql:31-43
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streaks"
  ON public.user_streaks FOR SELECT
  USING (auth.uid() = user_id);                  -- 170: (select auth.uid()) = user_id

CREATE POLICY "Users can update own streaks"
  ON public.user_streaks FOR UPDATE
  USING (auth.uid() = user_id);                  -- 170: USING + WITH CHECK both

CREATE POLICY "Service can insert streaks"
  ON public.user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);             -- 170: TO authenticated, (select auth.uid())
```
- 079 demonstrates **separate per-command policies** (SELECT / UPDATE / INSERT) on a `user_id`-owned table — the model for 170's per-command coverage (D-06).
- **Gotcha 079 reveals:** its UPDATE policy has only `USING`, no `WITH CHECK`. For 170, UPDATE policies should include **both** `USING` (which rows you may update) and `WITH CHECK` (the post-image must still be own-row) so a user cannot reassign `user_id` to another user. The CONTEXT map already says "WITH CHECK for INSERT/UPDATE."

### 076 composite indexes (Objective #2 / D-09)
```sql
-- Source: infra/supabase/migrations/076_performance_indexes.sql:5-18
CREATE INDEX IF NOT EXISTS idx_favorites_user_subject     ON favorites(user_id, subject_type);          -- line 5
CREATE INDEX IF NOT EXISTS idx_interactions_user_type     ON user_dish_interactions(user_id, interaction_type); -- line 9
CREATE INDEX IF NOT EXISTS idx_session_views_user_type    ON session_views(user_id, entity_type);        -- line 17
```
- **CONFIRMED**: all three exist and **lead with `user_id`** — a leading-`user_id` btree serves the policy's `user_id =` equality lookup, so `favorites`, `user_dish_interactions`, `session_views` need **no new index** (D-09). 170 adds an in-file comment pointing here.

### Migration-number landscape (Objective #3)
- **Last migration: `169_generate_candidates_pushdown.sql`** (+ its `169_REVERSE_ONLY_…`). `[VERIFIED: ls — no 170+ exists]`
- **170 is free.** Next forward number = `170`.
- **REVERSE_ONLY naming convention** (165–169 pairs all confirmed): `NNN_REVERSE_ONLY_<same_descriptor>.sql` — e.g. `169_generate_candidates_pushdown.sql` ↔ `169_REVERSE_ONLY_generate_candidates_pushdown.sql`. 170's pair: `170_codify_behavioral_rls.sql` ↔ `170_REVERSE_ONLY_codify_behavioral_rls.sql`.
- Phase 6 also authors migrations but targets the ingredient pipeline; 170 is independent and lower-numbered — **no ordering conflict.**

### Drift confirmation (the reason this phase exists)
```
grep "ENABLE ROW LEVEL|CREATE POLICY" on the 11 behavioral tables across all migrations →
ZERO tracked RLS/policy statements.   [VERIFIED: codebase grep]
```
This proves the migrations↔prod drift: prod enforces RLS on all 11 (F-11 live probe), the repo baseline has none. Migration 170 closes it.

## RLS Semantics: InitPlan Form & Anon-NULL (Objective #4)

`[VERIFIED: codebase + CITED: Supabase RLS performance guidance]` — these are well-established Postgres/Supabase semantics, corroborated by the existing migrations.

### Why `(select auth.uid()) = user_id` over bare `auth.uid() = user_id`
- **Bare `auth.uid()`** is treated by the Postgres planner as a volatile/per-row reference in the policy predicate, so it can be **re-evaluated once per scanned row**. On a large table this is measurable overhead.
- **`(select auth.uid())`** wraps the call in a scalar subquery. The planner evaluates it **once** as an *InitPlan* and reuses the cached result for every row — same logical result, far cheaper on row-heavy scans.
- This is Supabase's documented RLS performance recommendation and is the SC#2 requirement (D-02). It is the **one functional-form improvement** 170 makes over prod's literal DDL and over 079/091/119 (which all use the bare form). Results are identical; only evaluation count differs.

### Why `TO authenticated` normalization (D-04) is functionally equivalent to prod's mixed targeting
- Prod targets some own-row policies at `public` (e.g. `favorites`, `user_dish_interactions`) and others at `authenticated` (F-11 probe).
- **Anon-NULL semantics:** an anonymous (unauthenticated) caller has `auth.uid()` → **NULL**. The own-row predicate becomes `(select NULL) = user_id`, which evaluates to `NULL` (treated as **false** in a USING/WITH CHECK gate). So an anon caller is denied own-row access **regardless** of whether the policy targets `public` or `authenticated`.
- Therefore normalizing all own-row read/write policies to `TO authenticated` is **intent-revealing** (the policy obviously concerns logged-in users) and **changes no actual access** — a `public`-targeted own-row policy already excludes anon callers via the NULL comparison. This is why D-04 is a cosmetic normalization, not an access change.
- **Caveat for the planner:** `TO authenticated` is correct **only** for the own-row (private) policies. The genuine public-read SELECTs (D-05: `dish_opinions`, `dish_photos`, `dish_analytics`) must stay **open to `public`** with `USING (true)` so anonymous discovery reads keep working. Do not move those to `TO authenticated` — that would break anon read access the mobile app relies on. (The mobile client reads the feed/discovery surface; some reads are anon.)

## Architecture Patterns

### System Architecture Diagram (enforcement data flow)
```
                          ┌─────────────────────────────────────────┐
  Mobile app (anon or     │              PostgreSQL (Supabase)        │
  authenticated JWT)      │                                           │
        │ REST/PostgREST   │   per query:                              │
        │  + JWT ─────────────► auth.uid() resolved from JWT           │
        │                  │        │ (NULL if anon)                   │
        ▼                  │        ▼                                  │
   SELECT/INSERT/          │   RLS policy check on target table:       │
   UPDATE/DELETE ──────────►   • own-row?  (select auth.uid()) = user_id│──► allow only own rows
                           │   • public-read?  USING (true)            │──► allow all (dish_* aggregates)
                           │   • anon + own-row?  NULL = user_id → deny │──► 0 rows (safe)
                           └───────────────┬───────────────────────────┘
                                           │ index: idx_<table>_user_id (or 076 composite)
                                           ▼  serves the user_id = equality
  Backend / worker ────────► service_role key ──► RLS BYPASSED (explicit ALL service_role policy = fidelity only)
```
*Migration 170 authors the policies + indexes in the DB tier above. It writes nothing in the app/edge tier. The arrows show what the policies enforce at query time — not a file layout.*

### Recommended File Structure
```
infra/supabase/migrations/
├── 170_codify_behavioral_rls.sql               # forward: BEGIN; per-table {ENABLE RLS; DROP+CREATE policies; CREATE INDEX}; COMMIT;
└── 170_REVERSE_ONLY_codify_behavioral_rls.sql  # reverse: BEGIN; per-table {DROP INDEX; DROP POLICY; DISABLE RLS}; COMMIT;
```

### Pattern 1: Per-table atomic block (forward 170)
**What:** For each table, in one place: enable RLS, drop-then-create each policy, create the owner index (or comment that 076 covers it).
**When to use:** Every one of the 11 tables (SC#1 — enable+policy+index atomic per table).
**Example (own-row table, e.g. `user_points`):**
```sql
-- Source pattern: 119 (BEGIN/COMMIT, TO authenticated) + 091 (DROP IF EXISTS) + D-02 (InitPlan form)
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_points: owner select" ON public.user_points;
CREATE POLICY "user_points: owner select"
  ON public.user_points FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_points: owner insert" ON public.user_points;
CREATE POLICY "user_points: owner insert"
  ON public.user_points FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);
```

### Pattern 2: Public-read + service-role table (`dish_analytics`, D-07)
**What:** No owner policy, no owner index. Public SELECT + explicit service-role ALL.
**Example:**
```sql
ALTER TABLE public.dish_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dish_analytics: public read" ON public.dish_analytics;
CREATE POLICY "dish_analytics: public read"
  ON public.dish_analytics FOR SELECT USING (true);          -- open to public (anon discovery)

DROP POLICY IF EXISTS "dish_analytics: service role manage" ON public.dish_analytics;
CREATE POLICY "dish_analytics: service role manage"
  ON public.dish_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
-- NO owner policy, NO idx_dish_analytics_user_id (no user_id column — verified line 63-77)
```

### Pattern 3: Mixed public-read + own-write table (`dish_opinions`, `dish_photos`, `restaurant_experience_responses`)
**What:** Public SELECT (D-05) PLUS own-row write policies (D-06 command coverage).
```sql
ALTER TABLE public.dish_opinions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dish_opinions: public read" ON public.dish_opinions;
CREATE POLICY "dish_opinions: public read"
  ON public.dish_opinions FOR SELECT USING (true);           -- stays public (D-05)

DROP POLICY IF EXISTS "dish_opinions: owner insert" ON public.dish_opinions;
CREATE POLICY "dish_opinions: owner insert"
  ON public.dish_opinions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
-- + owner UPDATE (USING + WITH CHECK) + owner DELETE (USING) per F-11
CREATE INDEX IF NOT EXISTS idx_dish_opinions_user_id ON public.dish_opinions(user_id);
```

### Pattern 4: REVERSE_ONLY pair (drop everything 170 creates, reverse order)
```sql
-- 170_REVERSE_ONLY_codify_behavioral_rls.sql
BEGIN;
-- For each table (reverse of forward): drop new indexes, drop policies, then DISABLE RLS.
DROP INDEX IF EXISTS public.idx_user_points_user_id;
DROP POLICY IF EXISTS "user_points: owner insert" ON public.user_points;
DROP POLICY IF EXISTS "user_points: owner select" ON public.user_points;
ALTER TABLE public.user_points DISABLE ROW LEVEL SECURITY;
-- … all 11 tables … (do NOT drop the 3 pre-existing 076 composite indexes — 170 didn't create them)
COMMIT;
```

### Anti-Patterns to Avoid
- **Adding `OR public.is_admin()`** to behavioral-table policies — an access *expansion* not in prod (D-03). The 091 convention does NOT apply here.
- **Collapsing the public-read SELECTs to own-row** — breaks anon discovery reads on `dish_opinions`/`dish_photos`/`dish_analytics` (D-05).
- **Adding an owner policy or `user_id` index to `dish_analytics`** — it has no `user_id` column (verified); the migration would fail or be nonsensical (D-07).
- **Using bare `auth.uid()`** — violates SC#2 / D-02.
- **Adding CRUD commands prod doesn't grant** (e.g. UPDATE on `favorites`, DELETE on `session_views`) — D-06 says reproduce the documented coverage verbatim.
- **REVERSE pair dropping the 076 composite indexes** — 170 didn't create them; dropping them would regress feed performance.
- **Omitting `WITH CHECK` on UPDATE policies** — lets a user reassign `user_id` to another account (the 079 UPDATE example omits it; 170 must not).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Caller identity in policy | Custom JWT parsing / session lookup | `(select auth.uid())` | Supabase-provided, planner-optimized as InitPlan; the established repo convention. |
| Admin detection | Re-deriving role from JWT inline | (n/a — D-03 forbids admin override here) | Behavioral tables are pure own-row; service-role bypass covers backend. |
| Owner-lookup speed | Bespoke partial/expression index | Plain `(user_id)` btree (D-08) or existing 076 composite (D-09) | The predicate is a simple equality; a leading-`user_id` btree is the canonical, sufficient structure. |
| Idempotency | Bespoke "exists?" guards before each statement | `DROP POLICY IF EXISTS`, `CREATE INDEX IF NOT EXISTS`, idempotent `ENABLE RLS` | Repo convention (091/119); re-runnable and collision-safe against prod's existing policies. |

**Key insight:** RLS correctness lives entirely in declarative Postgres policy DDL. There is nothing to "build" — the risk is in *fidelity* (matching the F-11 semantics) and *safety* (idempotency, transaction wrap, reverse pairing), not in custom logic.

## Runtime State Inventory

> This is a **codification** migration (it makes version control reflect already-enforced prod state), not a rename/refactor/data-migration. There is **no stored-string rename**, no data mutation, no service reconfiguration. The inventory below confirms nothing is silently left behind.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — migration changes no row data; it only attaches RLS policies + indexes to existing tables. No `user_id` values are read, rewritten, or migrated. | None. |
| Live service config | **The drift itself**: prod's RLS for these 11 tables was configured out-of-band (Supabase dashboard / untracked migration), so it lives in prod's `pg_policies`, NOT in git. This migration codifies it into git. It is **NOT applied to prod** (prod already has it) — author + dry-run only (D-13). | Operator validates on a branch/shadow DB; prod is untouched (already protected). |
| OS-registered state | **None** — no cron, no Task Scheduler, no pm2/systemd registration involved. | None. |
| Secrets/env vars | **None** — no SOPS keys, no env var names reference these tables/policies. `auth.uid()` reads the request JWT at runtime; nothing is keyed by name. | None. |
| Build artifacts | **None expected** — RLS does not change generated types. `packages/database/src/types.ts` is unaffected (F-07 regen is a Phase 6 concern, not triggered by RLS). `pnpm check-types` is a no-regression formality. | Run `pnpm check-types` to confirm no type drift; expect no diff. |

**Pre-071 table-DDL drift (separate, deferred):** the 11 tables' `CREATE TABLE` statements are absent from numbered migrations (history starts at 071). A fresh DB built from `migrations/` alone would **not create these tables**, so 170's `ALTER TABLE`/`CREATE POLICY` would error on an empty DB. This is **by design** (D-12 — codify protection on existing tables) and documented in the file header. Reconstructing the table DDL is out of scope (deferred). The operator's branch/shadow DB must be a **prod clone** (tables present), not a from-scratch-migrations build.

## Common Pitfalls

### Pitfall 1: Wrong owner column name silently ships a broken policy
**What goes wrong:** A policy authored as `(select auth.uid()) = owner_id` (or `uid`, `account_id`) on a table whose column is `user_id` fails to create (column doesn't exist) or, worse, references the wrong column.
**Why it happens:** CLAUDE.md's "RLS on new tables" pitfall says new tables use `owner_id`; the restaurant-content chain (091) uses `owner_id`. A planner could over-generalize.
**How to avoid:** All 11 behavioral tables use **`user_id`** (verified, F-11 cross-check table above). Use `user_id` everywhere here. Cross-check each `CREATE POLICY` column against the verification table before finalizing.
**Warning signs:** `ERROR: column "owner_id" does not exist` on a branch dry-run.

### Pitfall 2: `dish_analytics` treated as user-owned
**What goes wrong:** Adding an owner policy or `idx_dish_analytics_user_id` → migration error (`column "user_id" does not exist`) or a nonsensical policy.
**Why it happens:** CONCERNS.md (line 174, per F-11) historically mislisted `dish_analytics` among user-owned tables.
**How to avoid:** `dish_analytics` PK is `dish_id`, no `user_id` (verified line 63–77). Public-read + service-role only (D-07).
**Warning signs:** any reference to `user_id` in a `dish_analytics` block.

### Pitfall 3: Breaking anon discovery by over-restricting public reads
**What goes wrong:** Normalizing the public-read SELECT policies to `TO authenticated` denies anonymous mobile reads of `dish_opinions`/`dish_photos`/`dish_analytics`.
**Why it happens:** Over-applying the D-04 `TO authenticated` normalization (which is for own-row policies only).
**How to avoid:** Keep public reads as `FOR SELECT USING (true)` open to `public` (D-05). Apply `TO authenticated` only to own-row read/write policies.
**Warning signs:** a public-read table's SELECT policy has `TO authenticated`.

### Pitfall 4: Reverse migration drops the wrong indexes
**What goes wrong:** The REVERSE pair drops the 3 pre-existing 076 composite indexes (`idx_favorites_user_subject`, etc.), regressing feed performance.
**Why it happens:** Treating "all owner indexes" uniformly in the reverse.
**How to avoid:** REVERSE drops **only** the 7 single-column indexes 170 created (`idx_<table>_user_id` for the D-08 set). Never touch the 076 composites.
**Warning signs:** `DROP INDEX … idx_favorites_user_subject` in the reverse file.

### Pitfall 5: Missing `WITH CHECK` on UPDATE → user_id reassignment
**What goes wrong:** An UPDATE policy with only `USING` lets a user change a row's `user_id` to another user's id (the post-image isn't gated).
**Why it happens:** Copying the 079 UPDATE example (which omits `WITH CHECK`).
**How to avoid:** Every UPDATE policy gets both `USING ((select auth.uid()) = user_id)` and `WITH CHECK ((select auth.uid()) = user_id)`.
**Warning signs:** an UPDATE `CREATE POLICY` with no `WITH CHECK`.

## Code Examples

(See Architecture Patterns 1–4 above — all examples are derived from verified in-repo migrations 079/091/119/076. No external code sources were needed.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bare `auth.uid() = user_id` in policies (079/091/119) | `(select auth.uid()) = user_id` (InitPlan form) | Supabase RLS perf guidance (current) | Once-per-query eval vs per-row; required by SC#2 / D-02. 170 adopts it; older migrations keep their bare form (not retrofitted this phase). |
| RLS configured out-of-band (dashboard / untracked) | RLS codified in a tracked migration | This phase (170) | Closes migrations↔prod drift; baseline now reproduces prod protection. |

**Deprecated/outdated for this phase:**
- The `is_admin()` admin-override convention (091/119) is **not** used on behavioral tables (D-03) — it would expand access beyond prod.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 3 leading-`user_id` composite indexes from 076 (`idx_favorites_user_subject`, `idx_interactions_user_type`, `idx_session_views_user_type`) are actually deployed in prod, so D-09's "no new index needed" holds there. | Migration Conventions / D-09 | LOW — pre-071 history is incomplete, so prod deployment of 076 isn't git-guaranteed. **Not blocking**: policies are correct regardless of index presence; an absent index only affects perf (a seq-scan on `user_id =`, recoverable). Operator can confirm/`CREATE IF NOT EXISTS` on the branch. Deferred item already notes this. |
| A2 | The InitPlan `(select auth.uid())` form is functionally identical to bare `auth.uid()` for these predicates and is the current Supabase-recommended form. | RLS Semantics | LOW — well-established Postgres planner behavior + Supabase docs; corroborated by D-02 being the stated SC#2 requirement. No correctness risk; if the planner did not optimize it, the result is still correct, just no faster than bare. |
| A3 | The operator's validation environment will be a **prod clone** (tables present), since 170 assumes the 11 tables already exist (D-12). | Runtime State Inventory | MEDIUM — running 170 against a from-scratch-`migrations/` DB would error (tables absent). The header precondition (D-12) and the Validation Architecture operator step both call this out; risk is mitigated by documentation, but the planner should make the "prod-clone, not empty DB" requirement explicit in the operator-handoff task. |

**Note:** All *factual* claims (table existence, column names, `dish_analytics` shape, migration number, 076 indexes, zero tracked RLS) are `[VERIFIED: codebase]` — not assumed. The three items above are the only residual assumptions, all LOW/MEDIUM and already flagged in CONTEXT's deferred items.

## Open Questions

1. **Are the 076 composite indexes deployed in prod?** (= A1)
   - What we know: They exist in the tracked migration 076 and lead with `user_id`; D-09 relies on them.
   - What's unclear: Pre-071 history is incomplete, so prod deployment isn't git-provable.
   - Recommendation: Non-blocking. Operator confirms during branch validation; if absent, the operator can add `CREATE INDEX IF NOT EXISTS` (or accept the perf-only gap). Do not block 170 on this.

2. **Should the explicit `ALL TO service_role` policies be included on `user_behavior_profiles`?** (Claude's discretion per CONTEXT)
   - What we know: Service-role bypasses RLS, so they're technically redundant; prod has them (fidelity).
   - What's unclear: Purely a style/fidelity call.
   - Recommendation: **Include** for prod-fidelity (harmless, explicit, matches codified prod truth) per the CONTEXT lean — unless it clutters the file.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pnpm` + Turborepo | `pnpm check-types` local gate | ✓ (repo standard) | per repo | — |
| Postgres / `psql` (local) | Applying the migration locally | ✗ (by design) | — | Stage-don't-apply: operator validates on Supabase branch/shadow DB. No local apply needed (D-13). |
| Supabase branch / shadow DB (prod clone) | Operator validation step | operator-owned | — | None — this IS the validation path; the agent does not touch any DB. |

**Missing dependencies with no fallback:** None for the agent's deliverable (authoring + static review + `pnpm check-types` need only the repo toolchain).
**Missing dependencies with fallback:** Local Postgres is intentionally absent — replaced by the operator branch-validation handoff (stage-don't-apply, inherited from Phases 1–2).

## Validation Architecture

> Nyquist validation is ENABLED. This is a **dry-run-only SQL migration** — no app/runtime code, no automated test harness this cycle (the automated RLS regression suite is deferred as QUAL-V2-01). The validation strategy is therefore **static self-review + per-SC checks + operator branch-validation handoff**, not unit tests.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None** (SQL DDL migration; no executable test suite this phase) |
| Config file | none — see Wave 0 (no test config needed) |
| Quick run command | `pnpm check-types` (type no-regression gate; expect no diff) |
| Full suite command | `pnpm check-types` + manual static SQL self-review checklist (below) |
| Real validation | Operator applies 170 on a Supabase branch / shadow DB (prod clone) and runs the anon/own-row probes below |

### Static SQL Self-Review Checklist (local, agent-runnable by inspection)
- [ ] **Valid DDL:** every statement parses; correct `public.<table>` qualification.
- [ ] **Table/column names cross-checked** against the F-11 cross-check table + `database_schema.sql` (all 11 tables; `user_id` on the 10 owner tables; `dish_analytics` has none).
- [ ] **Idempotency guards present:** `DROP POLICY IF EXISTS` before every `CREATE POLICY`; `CREATE INDEX IF NOT EXISTS`; idempotent `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.
- [ ] **Transaction wrap:** forward + reverse both wrapped in `BEGIN; … COMMIT;`.
- [ ] **InitPlan form:** every own-row predicate is `(select auth.uid()) = user_id` (zero bare `auth.uid()`).
- [ ] **Role targeting:** own-row policies `TO authenticated`; public reads stay `USING (true)` open to `public`.
- [ ] **Command coverage** per table matches F-11 verbatim (no extra/missing verbs).
- [ ] **UPDATE policies** have both `USING` and `WITH CHECK`.
- [ ] **No `is_admin()` clause** anywhere (D-03).
- [ ] **`dish_analytics`:** public-read + service-role only; no owner policy; no `user_id` index.
- [ ] **REVERSE pair** drops exactly what forward creates (7 new indexes + all new policies + DISABLE RLS) and **does NOT** drop the 3 pre-existing 076 composites.
- [ ] **Header documents** the table-precondition (D-12) and names the reverse sibling.

### Phase Requirements → Validation Map (samples SC#1–4)
| SC | Behavior | Validation Type | Concrete Check | Automatable now? |
|----|----------|-----------------|----------------|------------------|
| SC#1 | One migration file; `ENABLE RLS` + policy + index atomic per table | static review | Single `170_codify_behavioral_rls.sql`; each table's enable/policies/index in one contiguous block inside one `BEGIN/COMMIT`. | ✅ inspection |
| SC#2 | InitPlan form + owner index for all owner tables | static review | `grep "(select auth.uid())"` present, `grep -c "auth.uid()" ` with no bare form; `idx_<table>_user_id` present for the 7 D-08 tables; comment cites 076 for the other 3. | ✅ inspection / grep |
| SC#3 | `dish_analytics` = public/service-role, no owner policy; owner column names verified | static review | No `user_id` reference in the `dish_analytics` block; `USING (true)` SELECT + `ALL TO service_role`; all 10 owner blocks reference `user_id`. | ✅ inspection (backed by F-11 cross-check) |
| SC#4 | `pnpm check-types` passes; operator branch/shadow-DB dry-run validates | type gate + operator | `pnpm check-types` exits 0 (no type regen expected); operator applies 170 on prod-clone branch with the probes below. | partial (types now; DB apply = operator) |

### Operator-Handoff Validation (the real "pass") — Supabase branch / shadow DB
The operator runs on a **prod-clone** branch/shadow DB (tables must exist — D-12 precondition):
1. **Apply cleanly:** `170_codify_behavioral_rls.sql` applies with no error; **re-run** it → still succeeds (idempotency proven). Apply `170_REVERSE_ONLY_…` → all 170-created policies/indexes gone, RLS disabled on the 11; the 3 076 composites still present.
2. **Anon cannot read another user's private rows:** as an anon session, `SELECT * FROM favorites` (and other own-row tables) returns **0 rows** (own-row predicate with NULL uid).
3. **Authenticated reads only own rows:** as user A's JWT, `SELECT … FROM user_visits` returns only A's rows; attempting to `INSERT`/`UPDATE` a row with `user_id = <userB>` is **rejected** (WITH CHECK).
4. **Public reads still work:** anon `SELECT … FROM dish_opinions / dish_photos / dish_analytics` returns rows (public-read preserved).
5. **No prod apply:** prod is **not** touched (already protected); this is dry-run/branch validation only.

**"Pass" =** clean idempotent apply + reverse on the prod-clone, anon-deny on private tables, own-only on authenticated reads, public-read intact, and `pnpm check-types` green with no type diff.

### Wave 0 Gaps
- None — **no test infrastructure is created** this phase (automated RLS regression suite is QUAL-V2-01, deferred). The validation is static review + operator handoff; no framework install, no fixtures, no test files.

## Security Domain

> `security_enforcement` is not disabled in config (workflow toggles present, no `security_enforcement: false`) → included. This phase IS a security hardening phase (SEC-02), so the domain is central.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | indirect | Supabase Auth issues the JWT that `auth.uid()` resolves; not modified here. |
| V3 Session Management | no | Not touched. |
| V4 Access Control | **yes (core)** | RLS own-row policies `(select auth.uid()) = user_id` enforce per-user data isolation at the DB tier; public-read policies scope non-private aggregates; service-role bypass for backend. This is the entire phase. |
| V5 Input Validation | no | No app input handled; predicate is identity comparison, not user-supplied input. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for Postgres RLS / Supabase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Horizontal privilege escalation (reading another user's rows) | Information Disclosure | Own-row `USING ((select auth.uid()) = user_id)` on SELECT/UPDATE/DELETE. |
| Row ownership reassignment (changing `user_id` on UPDATE/INSERT to another user) | Tampering / Elevation | `WITH CHECK ((select auth.uid()) = user_id)` on INSERT and UPDATE. |
| Anon access to private tables | Information Disclosure | Anon `auth.uid()` → NULL → own-row predicate denies; own-row policies `TO authenticated` make intent explicit. |
| Silent deny-all regression (enabling RLS with no/incorrect policy) | Denial of Service (to legit users) | Enable + correct policy land **atomically** in the same migration (SC#1); operator branch-validation confirms authenticated reads still work. |
| Over-broad admin override on private data | Elevation / Information Disclosure | **No `is_admin()` clause** on behavioral tables (D-03) — service-role (bypass) covers backend; no human-admin read of private user data. |

## Sources

### Primary (HIGH confidence) — all in-repo, verified this session
- `infra/supabase/migrations/database_schema.sql` (lines 1–2 warning; 63–77 dish_analytics; 98–124, 218–226, 324–336, 381–486 the 11 tables) — table/column cross-check.
- `infra/supabase/migrations/091_content_rls_owner_writes.sql` — DROP-IF-EXISTS/CREATE idempotency, ENABLE RLS, is_admin() (not used here).
- `infra/supabase/migrations/119_menu_scan_jobs_rls.sql` — BEGIN/COMMIT wrap, TO authenticated own-row, REVERSE pairing.
- `infra/supabase/migrations/079_rating_system_redesign.sql` — own-row per-command policy examples.
- `infra/supabase/migrations/076_performance_indexes.sql` (lines 5–18) — the 3 leading-user_id composites.
- `.planning/codebase/FINDINGS.md` §F-11 (lines 136–165) — the prod RLS probe (source of truth).
- `.planning/phases/03-rls-hardening/03-CONTEXT.md` — the 13 locked decisions.
- `.planning/REQUIREMENTS.md` (SEC-02, line 19); `.planning/STATE.md` — scope/history.
- Migration directory listing — confirmed 169 is last, 170 free, REVERSE_ONLY naming.
- grep over migrations — confirmed zero tracked RLS for the 11 tables (the drift) and no tracked leading-user_id index on the 7 D-08 tables.

### Secondary (MEDIUM confidence)
- Supabase RLS performance guidance — `(select auth.uid())` InitPlan optimization (corroborated by D-02 / SC#2). `[CITED: Supabase RLS docs — well-established]`

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- F-11 cross-check (table/column names): **HIGH** — every claim verified line-by-line against `database_schema.sql`; zero mismatches.
- Migration conventions: **HIGH** — read all four analog migrations directly; patterns confirmed.
- Migration-number landscape: **HIGH** — directory listing confirms 169 last / 170 free / REVERSE naming.
- RLS semantics (InitPlan, anon-NULL): **HIGH** — established Postgres/Supabase behavior, corroborated by repo + SC#2.
- Validation architecture: **HIGH** — derived directly from SC#1–4 and the stage-don't-apply model.
- 076 prod deployment (A1): **LOW** — not git-provable; non-blocking, operator-confirmable.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable; DB schema + migration conventions change slowly. Re-verify the "last migration is 169 / 170 free" claim if any migration lands before planning.)

## RESEARCH COMPLETE

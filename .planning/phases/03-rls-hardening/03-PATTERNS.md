# Phase 3: RLS Hardening - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 2 (both NEW SQL migrations)
**Analogs found:** 2 / 2 (both fully covered by in-repo analogs)

## File Classification

| New File | Role | Data Flow | Closest Analog(s) | Match Quality |
|----------|------|-----------|-------------------|---------------|
| `infra/supabase/migrations/170_codify_behavioral_rls.sql` | DB migration (forward) | DDL applied to live DB (RLS policies + indexes; dry-run/stage-don't-apply) | `119` (structure) + `091` (idempotency) + `079` (own-row policy shape) + `076` (index style) | exact (composite) |
| `infra/supabase/migrations/170_REVERSE_ONLY_codify_behavioral_rls.sql` | DB migration (reverse) | DDL rollback (drop policies/indexes, disable RLS) | `119_REVERSE_ONLY_menu_scan_jobs_rls.sql` | exact |

Both files are pure Database-tier DDL. No app/edge/type coupling. `pnpm check-types` is a no-regression formality (RLS does not change generated types).

---

## Pattern Assignments

### `170_codify_behavioral_rls.sql` (forward migration)

This file composes four analogs. Each contributes a distinct structural piece; the planner embeds the excerpt then applies the listed adaptation.

#### Piece A — Transaction wrap + header + reverse-sibling reference (analog: `119`)

**Source verbatim** — `119_menu_scan_jobs_rls.sql:1-19` (header block + BEGIN + first ENABLE):
```sql
-- 119_menu_scan_jobs_rls.sql
-- Created: 2026-04-23
-- ...
-- Reverse: 119_REVERSE_ONLY_menu_scan_jobs_rls.sql

BEGIN;

ALTER TABLE public.menu_scan_jobs ENABLE ROW LEVEL SECURITY;
```
and the close — `119:63`:
```sql
COMMIT;
```

**Adaptation:**
- Header must name the reverse sibling: `-- Reverse: 170_REVERSE_ONLY_codify_behavioral_rls.sql`.
- Header must document the table-precondition (D-12): the 11 tables are assumed to already exist (created pre-071 / out-of-band); this migration codifies *protection on existing tables*, not table creation. State that the operator's validation DB must be a **prod clone**, not a from-scratch-`migrations/` build.
- Wrap the entire body in one `BEGIN; … COMMIT;` (SC#1 atomicity).
- DO NOT copy the `ALTER PUBLICATION supabase_realtime ADD TABLE …` line (`119:61`) — that is 119-specific; behavioral tables are not realtime-published.

#### Piece B — Idempotent ENABLE RLS + DROP-then-CREATE policy (analog: `091`)

**Source verbatim** — `091_content_rls_owner_writes.sql:39-45` (idempotent ENABLE, no `IF NOT EXISTS` needed):
```sql
ALTER TABLE public.restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus             ENABLE ROW LEVEL SECURITY;
-- ...
```
**Source verbatim** — `091:51-52` (the DROP-IF-EXISTS → CREATE idempotency unit + the public-read shape):
```sql
DROP POLICY IF EXISTS "Public read menu_categories"  ON public.menu_categories;
CREATE POLICY "Public read menu_categories"  ON public.menu_categories  FOR SELECT USING (true);
```

**Adaptation (two DELIBERATE divergences from 091 — flag in plan):**
1. **Drop the `OR public.is_admin()` clause.** 091's write policies (e.g. `091:69`, `091:74-75`) all append `OR public.is_admin()`. D-03 FORBIDS this on behavioral tables — it is an access expansion not present in prod. Behavioral policies are pure own-row. DO NOT redefine or call `is_admin()` (defined `091:25-34`).
2. **Replace bare `auth.uid()` with `(select auth.uid())`** (D-02 / SC#2 InitPlan form). 091 uses bare `auth.uid()` throughout.
- KEEP the `FOR SELECT USING (true)` public-read shape verbatim for the genuine public reads (`dish_opinions`, `dish_photos`, `dish_analytics` — D-05). These stay open to `public` (no `TO authenticated`).
- Use the `DROP POLICY IF EXISTS "<name>" ON public.<t>;` then `CREATE POLICY` unit before EVERY policy (D-11).

#### Piece C — Own-row per-command policies (analog: `079`)

**Source verbatim** — `079_rating_system_redesign.sql:31-43`:
```sql
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streaks"
  ON public.user_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON public.user_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert streaks"
  ON public.user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Adaptation (079 is the per-command model BUT has two flaws 170 must fix):**
1. **`auth.uid()` → `(select auth.uid())`** (D-02).
2. **GOTCHA — 079's UPDATE policy (`079:37-39`) has only `USING`, no `WITH CHECK`.** 170's UPDATE policies MUST include BOTH `USING ((select auth.uid()) = user_id)` AND `WITH CHECK ((select auth.uid()) = user_id)` — otherwise a user can reassign `user_id` to another account (Pitfall 5).
3. Add `TO authenticated` to every own-row policy (D-04) — 079 omits it.
4. Add a `DROP POLICY IF EXISTS` before each `CREATE POLICY` — 079 omits it (170 needs it for idempotency, D-11).

**Target per-command coverage is the F-11 map in 03-CONTEXT.md lines 95-109** — reproduce verbatim, no extra/missing verbs (D-06). E.g. `favorites` = SELECT/INSERT/DELETE (no UPDATE); `restaurant_experience_responses` = public SELECT + INSERT-only own; `session_views` = SELECT/INSERT own.

**Canonical assembled per-table block (own-row table, from 03-RESEARCH.md Pattern 1, `user_points` example) — copy-paste-ready:**
```sql
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

**`dish_analytics` block (D-07 — public-read + service-role, NO owner policy, NO user_id index):**
```sql
ALTER TABLE public.dish_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dish_analytics: public read" ON public.dish_analytics;
CREATE POLICY "dish_analytics: public read"
  ON public.dish_analytics FOR SELECT USING (true);

DROP POLICY IF EXISTS "dish_analytics: service role manage" ON public.dish_analytics;
CREATE POLICY "dish_analytics: service role manage"
  ON public.dish_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
-- NO owner policy, NO idx_dish_analytics_user_id (no user_id column)
```

#### Piece D — Owner-column indexes (analog: `076`)

**Source verbatim** — `076_performance_indexes.sql:5-18` (the 3 leading-`user_id` composites D-09 relies on):
```sql
CREATE INDEX IF NOT EXISTS idx_favorites_user_subject
  ON favorites(user_id, subject_type);
CREATE INDEX IF NOT EXISTS idx_interactions_user_type
  ON user_dish_interactions(user_id, interaction_type);
CREATE INDEX IF NOT EXISTS idx_session_views_user_type
  ON session_views(user_id, entity_type);
```

**Adaptation:**
- For the **7 D-08 tables** (`dish_opinions`, `dish_photos`, `restaurant_experience_responses`, `user_behavior_profiles`, `user_points`, `user_sessions`, `user_visits`): add `CREATE INDEX IF NOT EXISTS idx_<table>_user_id ON public.<table>(user_id);` inside that table's block (use the `IF NOT EXISTS` + `public.` qualification style).
- For the **3 D-09 tables** (`favorites`, `user_dish_interactions`, `session_views`): add NO new index — only an in-file comment pointing to the 076 composites by name. The leading-`user_id` btree already serves the `user_id =` equality.

---

### `170_REVERSE_ONLY_codify_behavioral_rls.sql` (reverse migration)

**Analog:** `119_REVERSE_ONLY_menu_scan_jobs_rls.sql` (full file — exact structural match).

**Source verbatim** — `119_REVERSE_ONLY_menu_scan_jobs_rls.sql:1-17`:
```sql
-- 119_REVERSE_ONLY_menu_scan_jobs_rls.sql
-- Reverse migration for 119_menu_scan_jobs_rls.sql
--
-- WARNING (security): DISABLE ROW LEVEL SECURITY re-opens the table to anon reads.
-- Only run this during a controlled rollback — never in production while v2 is live.

BEGIN;

DROP POLICY IF EXISTS "menu_scan_jobs: owner or admin select" ON public.menu_scan_jobs;
DROP POLICY IF EXISTS "menu_scan_jobs: owner insert"          ON public.menu_scan_jobs;
DROP POLICY IF EXISTS "menu_scan_jobs: owner or admin update" ON public.menu_scan_jobs;

ALTER PUBLICATION supabase_realtime DROP TABLE public.menu_scan_jobs;

ALTER TABLE public.menu_scan_jobs DISABLE ROW LEVEL SECURITY;

COMMIT;
```

**Adaptation:**
- Keep the header rename (`-- Reverse migration for 170_codify_behavioral_rls.sql`) and the security WARNING comment (DISABLE RLS re-opens tables to anon — controlled-rollback only).
- DO NOT copy the `ALTER PUBLICATION supabase_realtime DROP TABLE` line — 170 never added any table to a publication.
- For each of the 11 tables, in reverse order of the forward block: `DROP INDEX IF EXISTS public.idx_<table>_user_id;` (only the 7 created indexes), `DROP POLICY IF EXISTS "<name>" ON public.<t>;` (every policy 170 created), then `ALTER TABLE public.<t> DISABLE ROW LEVEL SECURITY;`.
- **CRITICAL (Pitfall 4 / SC):** DO NOT drop the 3 pre-existing 076 composites (`idx_favorites_user_subject`, `idx_interactions_user_type`, `idx_session_views_user_type`) — 170 did not create them; dropping them regresses feed performance.
- Wrap in `BEGIN; … COMMIT;`.
- Reference 03-RESEARCH.md Pattern 4 (lines 293-304) for the per-table reverse-block template.

---

## Shared Patterns

### Idempotency guards
**Source:** `091:51-52` (`DROP POLICY IF EXISTS` → `CREATE POLICY`); `076:5` (`CREATE INDEX IF NOT EXISTS`); `091:39-45` (idempotent `ENABLE ROW LEVEL SECURITY`, no guard needed).
**Apply to:** Every policy and index in 170 (forward). `DROP POLICY IF EXISTS` in 170 (reverse).
Makes the migration re-runnable and collision-safe against prod's already-present policies (D-11).

### Transaction wrap
**Source:** `119:17` (`BEGIN;`) + `119:63` (`COMMIT;`).
**Apply to:** Both 170 files — entire body wrapped (D-11).

### Own-row predicate (InitPlan form)
**Source:** Upgrade of `079:35` `auth.uid() = user_id` → `(select auth.uid()) = user_id`.
**Apply to:** Every own-row policy across all 10 owner tables. USING for SELECT/UPDATE/DELETE; WITH CHECK for INSERT/UPDATE; UPDATE gets BOTH (D-02, Pitfall 5).

### Role targeting
**Source:** `119:25` (`TO authenticated`).
**Apply to:** All own-row policies → `TO authenticated` (D-04). Public reads (`dish_opinions`/`dish_photos`/`dish_analytics`) stay `USING (true)` open to `public` — DO NOT add `TO authenticated` (Pitfall 3, D-05).

---

## No Analog Found

None. All required patterns are fully covered by in-repo analogs (091, 119, 079, 076).

## Deliberate Divergences from Analogs (planner must enforce)

| Divergence | Analogs that do it the "old" way | Driver |
|------------|----------------------------------|--------|
| `(select auth.uid())` not bare `auth.uid()` | 079, 091, 119 | D-02 / SC#2 |
| NO `OR public.is_admin()` clause | 091, 119 | D-03 |
| `TO authenticated` on all own-row policies | 079 (omits), 091 mixed | D-04 |
| UPDATE policies get BOTH `USING` + `WITH CHECK` | 079 (UPDATE has only `USING`) | Pitfall 5 |
| No realtime publication line | 119 (adds + drops) | not applicable to behavioral tables |

## Metadata

**Analog search scope:** `infra/supabase/migrations/` (091, 119, 119_REVERSE_ONLY, 079, 076 read directly).
**Files scanned:** 5 migration files + 03-CONTEXT.md + 03-RESEARCH.md.
**Pattern extraction date:** 2026-06-19

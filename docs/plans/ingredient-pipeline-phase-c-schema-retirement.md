# Ingredient pipeline — Phase C schema retirement

**Status:** Proposed
**Last updated:** 2026-05-17
**Scope:** Drop the entire ingredient-side schema — `dish_ingredients`, `canonical_ingredients`, `canonical_ingredient_allergens`, `ingredient_aliases`, `ingredient_aliases_v2`, `ingredient_concepts`, `ingredient_variants`, `concept_translations`, `variant_translations` — plus dead columns on `dishes` and `options`. Take a one-time backup snapshot before dropping. Regenerate `@eatme/database` types.
**Out of scope:** Re-implementing any ingredient-level user feature on the new modifier model. If "Ingredients to Avoid" is ever revived, it gets built fresh on `option.adds_allergens` (introduced by the dish-model rewrite).
**Sequencing:** Run **4–6 weeks after Phase B has been stable in production**. Specifically: not before mobile + admin + feed have observed normal operation since the trigger drops, and not before the dish-model rewrite Phase 7 cleanup is fully merged (which introduces `option.adds_allergens` as the replacement for the per-option allergen lookup that survives Phase A).

---

## 1. When to implement

**Earliest start: 4–6 weeks after Phase B ships.**

Three gating conditions:

1. **Phase B must be stable.** Triggers gone for at least 4 weeks with no allergen-accuracy regression in production. `dishes.allergens` writes coming only from the worker / admin, never from a trigger.
2. **Dish-model rewrite Phase 7 must be complete.** Specifically, `option.adds_allergens` must be live, populated for new dishes by the worker, and consumed by mobile (`useRestaurantDetail.ts`) as the replacement for the surviving `canonical_ingredient_allergens` lookup. Phase A explicitly preserved that lookup; Phase C only drops it once a successor is in place.
3. **`apps/web-portal` retirement decision finalized.** Web-portal has the most extensive ingredient-table footprint (CRUD APIs for `ingredient_concepts`, `ingredient_variants`, `ingredient_aliases`, etc.). If web-portal is fully retired before Phase C, dropping these tables is clean. If web-portal is still receiving traffic, this needs coordination — see §2.3.

The 4–6-week observation period after Phase B is real, not ceremonial. The trigger drop in Phase B is the last reversible step in the ingredient retirement. Phase C is hard to reverse without restoring from snapshot. The observation window is insurance: if anything in production turns out to rely on the trigger-computed allergens (legacy webhook? unknown analytics consumer?), it surfaces during Phase B's stable period. Skipping that window risks discovering the dependency only after the table is gone.

**Not before:** the mobile force-upgrade penetration has hit ≥95% on the dish-model rewrite version. If any client is still calling the older feed shape that expected `flagged_ingredients`, the table drops will not affect them (Phase A already removed the read path), but the override columns and `option.canonical_ingredient_id` removal would. Belt-and-suspenders.

---

## 2. Background

After Phase A (read paths gone) and Phase B (triggers gone), the entire ingredient stack consists of:

- **9 tables** holding ~5–15 ingredient names per legacy dish + the half-done `ingredient_concepts` curation work.
- **3 columns** on `dishes` / `options` that point into this stack (`allergens_override`, `dietary_tags_override`, `options.canonical_ingredient_id`).
- **Migrations 099–106** that introduced the never-completed `ingredient_concepts` / `ingredient_variants` refactor.

Nothing reads or writes any of it for new dishes. For legacy dishes, the only surviving read path was `useRestaurantDetail.ts:314–322` (per-option allergens via `canonical_ingredient_allergens`), and that is supplanted by `option.adds_allergens` from the dish-model rewrite.

Phase C is the final retirement step: schema + types + remaining application traces.

### 2.1 What's in the data worth preserving?

| Table | Approximate row count | Curation value | Reproducibility |
|---|---|---|---|
| `canonical_ingredients` | ~100s | High (allergen + family mappings) | Low — manual curation |
| `ingredient_aliases` | ~1000s | High (multi-language display names) | Low — multi-language work |
| `canonical_ingredient_allergens` | ~100s | High (allergen lookups) | Medium — re-derivable from a fresh ingredient ontology |
| `ingredient_concepts` | ~100s | Medium (in-flight, partially curated) | Low — represents the stalled Phase 6 refactor |
| `ingredient_variants` | ~100s–1000s | Medium | Low |
| `concept_translations`, `variant_translations` | ~1000s | High | Low |
| `dish_ingredients` | Variable, ~5–15 per legacy dish | Low (per-dish; recomputable from menu re-scan) | High |
| `ingredient_aliases_v2` | ~1000s | High (the modernized alias table) | Low |

**Worth snapshotting before drop:** all of them. The drop is a one-way action; the snapshot is the only restoration path. Cheap insurance.

### 2.2 What survives in `dishes` and `options`?

- `dishes.allergens` (direct-write column) — **kept**. This is the new authoritative allergen field.
- `dishes.dietary_tags` (direct-write column) — **kept**. New authoritative dietary-tag field.
- `dishes.allergens_override` — **dropped**. Made obsolete by Phase B; no readers.
- `dishes.dietary_tags_override` — **dropped**.
- `dishes.protein_canonical_names` — **investigate before dropping** (see §5.4). The feed scoring path uses it; the dish-model rewrite preserved it.
- `options.canonical_ingredient_id` — **dropped** (assuming the dish-model rewrite has migrated to `option.adds_allergens`). See §5.3 for the precondition check.

### 2.3 `apps/web-portal` coordination

Web-portal has an extensive ingredient-admin UI: `/admin/ingredients/*` pages, multiple `/api/admin/ingredient-*` route handlers, and `lib/ingredient-resolver.ts`. These are NOT touched by Phase A or Phase B because they were treated as legacy.

Two compatible end states:

- **End state W1 — web-portal fully retired before Phase C.** Cleanest. The tables drop and web-portal's gone, so no broken endpoints.
- **End state W2 — web-portal still serving, Phase C runs first.** Then web-portal's ingredient admin pages start 500-erroring on every request. Acceptable only if the pages are confirmed unused (no internal traffic, no team workflow depending on them) — verify via web-portal access logs over a 2-week window.

**Decision required before kickoff:** which end state are we in? Default assumption: W1 (web-portal retired). If W2, Phase C must include either deleting the affected web-portal route handlers and admin pages, or gating them with a "this feature has been retired" page.

---

## 3. End state (after Phase C)

```
Tables (dropped)                        Tables (untouched)
────────────────                        ──────────────────
dish_ingredients              ❌        dishes              ✓
canonical_ingredients         ❌        options             ✓
canonical_ingredient_allergens❌        option_groups       ✓
ingredient_aliases            ❌        restaurants         ✓
ingredient_aliases_v2         ❌        menus               ✓
ingredient_concepts           ❌        menu_categories     ✓
ingredient_variants           ❌        dish_categories     ✓
concept_translations          ❌        (all non-ingredient tables)
variant_translations          ❌

Columns (dropped)                       Columns (kept)
─────────────────                       ──────────────
dishes.allergens_override     ❌        dishes.allergens               ✓
dishes.dietary_tags_override  ❌        dishes.dietary_tags            ✓
options.canonical_ingredient_id ❌      dishes.primary_protein         ✓
                                        options.primary_protein        ✓
                                        options.adds_allergens         ✓
                                        options.removes_dietary_tags   ✓
```

After Phase C, the ingredient-as-an-entity model is fully retired. Allergens and dietary information live directly on `dishes` and `options`, written explicitly by the worker / admin, never derived.

---

## 4. Decisions needed before kickoff

### 4.1 Backup retention

The pre-drop snapshot (§5.1) preserves all 9 tables. How long do we keep it?

| Option | Retention | Justification |
|---|---|---|
| **R1 — 6 months** | Default | Long enough to cover unknown-consumer surprises + product re-think of ingredient-level features. |
| **R2 — 18 months** | Conservative | Multi-year roadmap visibility; storage cost is negligible. |
| **R3 — Indefinite** | Maximum insurance | Snapshot is dust-cheap; pay the maintenance once. |

**Recommendation: R2 (18 months).** Cheap, covers the realistic worst-case (someone wants to revive ingredient-level UX 12 months later). After 18 months, downgrade to R3 by moving to cold storage or just delete.

### 4.2 `protein_canonical_names` on `dishes`

Currently used by `feed/index.ts` for fine-grained protein subtype matches (e.g., `chicken_thigh` vs bare `chicken`). The dish-model rewrite kept it. The column is **derived from `primary_protein` via `deriveProteinFields()`** in `packages/shared/src/logic/protein.ts` — not from `dish_ingredients`. It's safe with respect to Phase C, but worth confirming whether it remains useful or becomes recomputable on the fly.

**Recommendation: leave it alone in Phase C.** It's not part of the ingredient pipeline; it just shares ancestry. Touching it expands Phase C's scope without payoff.

### 4.3 Web-portal end state (§2.3)

See §2.3 above. **Decision required: W1 or W2.**

---

## 5. Concrete changes

### 5.1 Pre-migration: snapshot the data

**File:** `infra/snapshots/ingredient-tables-pre-phase-c.sql` (committed to git, but the actual dump goes to cold storage)

```bash
# Run from a machine with prod read access.
# Outputs a compressed SQL dump.
pg_dump \
  --host=<prod-host> \
  --username=<service-role> \
  --dbname=<db> \
  --schema=public \
  --data-only \
  --table=dish_ingredients \
  --table=canonical_ingredients \
  --table=canonical_ingredient_allergens \
  --table=ingredient_aliases \
  --table=ingredient_aliases_v2 \
  --table=ingredient_concepts \
  --table=ingredient_variants \
  --table=concept_translations \
  --table=variant_translations \
  --file=ingredient-tables-snapshot-$(date +%Y%m%d).sql

gzip ingredient-tables-snapshot-*.sql
# Upload to S3 / GCS / equivalent cold storage.
# Document the storage URI and retention policy in this file's commit message.
```

**Acceptance for snapshot:** the dump file is in cold storage, accessible by the on-call team, and the URI is recorded in a way that survives engineer turnover.

### 5.2 Migration: drop the tables

**File:** `infra/supabase/migrations/NNN_drop_ingredient_pipeline.sql`

```sql
-- Phase C: retire the ingredient-as-entity schema.
-- Prerequisites:
--   - Phase A merged (no application reads)
--   - Phase B merged + ≥4 weeks stable (no DB triggers)
--   - option.adds_allergens populated for new dishes (dish-model rewrite Phase 5)
--   - Mobile useRestaurantDetail.ts migrated to read from option.adds_allergens
--     instead of canonical_ingredient_allergens
--   - Snapshot taken and stored in cold storage (see infra/snapshots/)

BEGIN;

-- Drop tables in dependency order.
-- All FKs are within this set; nothing outside the ingredient pipeline references these tables.

DROP TABLE IF EXISTS public.variant_translations           CASCADE;
DROP TABLE IF EXISTS public.concept_translations           CASCADE;
DROP TABLE IF EXISTS public.ingredient_variants            CASCADE;
DROP TABLE IF EXISTS public.canonical_ingredient_allergens CASCADE;
DROP TABLE IF EXISTS public.dish_ingredients               CASCADE;
DROP TABLE IF EXISTS public.ingredient_aliases             CASCADE;
DROP TABLE IF EXISTS public.ingredient_aliases_v2          CASCADE;
DROP TABLE IF EXISTS public.ingredient_concepts            CASCADE;
DROP TABLE IF EXISTS public.canonical_ingredients          CASCADE;

COMMIT;
```

**Why `CASCADE`:** there should be no external dependencies (verified by §5.3 precondition check), but CASCADE is defensive against any policy / view / index that snuck in via a migration outside this set.

**Why explicit BEGIN/COMMIT:** all-or-nothing. Either every table is gone, or the migration rolls back.

### 5.3 Migration: drop dead columns

**File:** `infra/supabase/migrations/NNN_drop_ingredient_columns.sql`

**Prerequisite check (run manually before applying):**

```sql
-- Confirm no production code still queries the canonical_ingredient_id column.
-- Run after Phase B is stable and dish-model rewrite Phase 7 is in.
SELECT pg_relation_filenode('options'::regclass);  -- sanity check

-- Use pg_stat_user_tables to confirm options table is being read normally;
-- compare to baseline before the migration.
```

Application-side audit:
```bash
# Should return zero hits across apps/ and infra/supabase/functions/
git grep "canonical_ingredient_id"
git grep "allergens_override\|dietary_tags_override"
```

If grep returns any hits, fix them first before running this migration.

```sql
BEGIN;

ALTER TABLE public.dishes
  DROP COLUMN IF EXISTS allergens_override,
  DROP COLUMN IF EXISTS dietary_tags_override;

ALTER TABLE public.options
  DROP COLUMN IF EXISTS canonical_ingredient_id;

COMMIT;
```

**Note on `options.canonical_ingredient_id`:** this column existed before the dish-model rewrite. The rewrite added `option.adds_allergens` as the new explicit allergen source. By the time Phase C runs, mobile + feed should have moved to read `adds_allergens` directly. The grep above is the verification gate.

### 5.4 Application-code cleanup

After the migrations apply, audit and remove:

- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts` — the `canonical_ingredient_allergens` lookup (lines 314–322 in the pre-Phase-A version). If it wasn't already migrated to use `option.adds_allergens` during the dish-model rewrite Phase 5, do that now and drop the canonical_ingredient_allergens path.
- `packages/shared/src/types/restaurant.ts:145` — "canonical ingredients selected via autocomplete; not persisted on this object" — drop the entire field if any.
- `@eatme/database/src/types.ts` — regenerate after the migration. The dropped tables disappear from the types automatically.

### 5.5 Regenerate `@eatme/database` types

```bash
supabase gen types typescript --linked > packages/database/src/types.ts
```

Verify `pnpm typecheck` passes across the workspace. The dropped tables and columns are now absent from the generated `Database` type; any leftover application reference surfaces as a compile error.

### 5.6 Web-portal disposition

Per §4.3 decision:

- **W1 (web-portal retired):** no action; the dead route handlers go away when web-portal is removed from the deployment.
- **W2 (web-portal still serving):**
  - Delete: `apps/web-portal/app/api/admin/ingredient-*/`, `apps/web-portal/app/admin/ingredients/`, `apps/web-portal/lib/ingredient-resolver.ts`, `apps/web-portal/app/api/menu-scan/suggest-ingredients/route.ts`.
  - Delete: ingredient-related sections of `apps/web-portal/app/api/menu-scan/confirm/route.ts` (the legacy `dish_ingredients` insertion path).
  - Confirm: `apps/web-portal/test/menu-scan-confirm.test.ts` and `apps/web-portal/lib/hooks/useDishFormData.ts` test/mock updates.

---

## 6. Verification

### 6.1 Staging

1. Restore a recent prod backup onto staging.
2. Apply the §5.2 migration. Confirm:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'dish_ingredients','canonical_ingredients','canonical_ingredient_allergens',
       'ingredient_aliases','ingredient_aliases_v2','ingredient_concepts',
       'ingredient_variants','concept_translations','variant_translations'
     );
   -- Expected: zero rows
   ```
3. Apply the §5.3 migration. Confirm:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'dishes'
     AND column_name IN ('allergens_override', 'dietary_tags_override');
   -- Expected: zero rows
   
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'options'
     AND column_name = 'canonical_ingredient_id';
   -- Expected: zero rows
   ```
4. Regenerate `@eatme/database` types; run `pnpm build` + `pnpm typecheck` across the workspace; both pass.
5. Smoke-test admin flow: scan a menu, confirm, dish appears with correct allergens.
6. Smoke-test mobile flow: feed loads, restaurant detail loads, per-option allergen badges render (via the new `option.adds_allergens` path).

### 6.2 Production deployment plan

1. Apply snapshot (§5.1). Verify the file lands in cold storage.
2. Apply §5.2 migration during a low-traffic window.
3. Apply §5.3 migration immediately after, same window.
4. Deploy regenerated types in the next normal application release.
5. Watch for 7 days:
   - Application error logs for any reference to dropped tables/columns (should be zero).
   - Feed P95 latency (should be unchanged).
   - Mobile crash-free session rate (should be unchanged).
   - Allergen badge rendering on restaurant detail (sample 10 dishes daily).

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Unknown consumer of `canonical_ingredients` table starts failing | High | The pre-migration grep + 7-day observation after the snapshot. Application errors are visible within minutes. Restoration from snapshot is the contingency. |
| Mobile clients on a version that still expects `option.canonical_ingredient_id` | Medium | Force-upgrade gate from the dish-model rewrite. Confirm penetration ≥95% before applying. |
| The `option.adds_allergens` migration of useRestaurantDetail was never actually done | High | §5.3 prerequisite check (grep returns zero hits for `canonical_ingredient_allergens`). Hard-gate Phase C on this. |
| Web-portal in W2 starts erroring on `/admin/ingredients/*` requests | Medium | §5.6 covers either retiring the routes or returning a "feature retired" page. Decision required at §4.3. |
| Snapshot location is forgotten / inaccessible when someone needs it | Medium | Document storage URI in the migration's commit message + in this doc's commit message + in `infra/snapshots/` README. Cross-link from `CLAUDE.md`. |
| FK from a non-ingredient table we don't know about | Low | `CASCADE` in the DROP statements is the catch-all. Pre-migration, run `SELECT * FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_name NOT IN (<the 9 tables>) AND...` to find any FK pointing into the ingredient set from outside. Expected: zero. |
| Embedding-vector drift after re-enrichment without ingredient context | Low | New dishes already had no ingredient context. Legacy dishes already lost ingredient context in Phase A. Phase C is invisible to the embedding pipeline. |
| Translation work in `concept_translations` / `variant_translations` is irreversibly lost | Low (only if R1 retention + a multi-year resurrection) | Snapshot preserves it. R2 retention (18 months) is comfortable. |

---

## 8. Rollback

**Phase C is hard to reverse without the snapshot.** Once tables are dropped, the only restoration path is replaying the snapshot SQL dump.

Concrete rollback steps if a problem surfaces post-deploy:
1. Take the system into a maintenance window.
2. Re-create the table structures by replaying migrations 099–106 (or the most recent versions).
3. Restore the data from the §5.1 snapshot.
4. Re-create the triggers from Phase B's rollback procedure if you need the trigger system back too.
5. Revert the application-code changes that depended on the dropped columns.

Expected rollback time: ~30 minutes if the snapshot is accessible. ~2 hours if the snapshot has to be downloaded from cold storage.

For column drops (§5.3): rolling back individual columns is `ALTER TABLE ... ADD COLUMN ...` plus repopulating from the snapshot. The snapshot includes data for the dropped columns via `pg_dump --data-only` if the tables they reference are also restored — but for `options.canonical_ingredient_id` you'll need to re-derive from the worker outputs, which is harder.

**Recommendation: in the 7-day production observation window, do NOT delete the snapshot.** Tighten retention to R2 only after the window passes cleanly.

---

## 9. Sequencing

```
[Phase A merged]
       ↓
[Dish-model rewrite Phases 1-7 fully shipped + ≥95% mobile upgrade]
       ↓
[Phase B merged + 1-2 weeks stable]
       ↓
[4-6 weeks observation under Phase B]
       ↓
[option.adds_allergens migrated in mobile useRestaurantDetail.ts]
       ↓
[Snapshot taken + cold-storage verified]
       ↓
[Phase C migrations applied]   ← this doc
       ↓
[7-day production observation]
       ↓
[Snapshot retention downgraded to R2 / R3]
```

Phase C is the most-gated step of the whole ingredient retirement. The cumulative observation windows (1-2 weeks for Phase B stability + 4-6 weeks Phase C wait) total **6-8 weeks** from Phase B merge to Phase C apply. That's the right cadence for a one-way schema drop.

---

## 10. Acceptance criteria

- All 9 ingredient tables absent from `information_schema.tables` (§6.1 query returns zero).
- All 3 dead columns absent from `information_schema.columns` (§6.1 queries return zero).
- Snapshot is in cold storage with URI documented in 3+ places.
- `pnpm build` + `pnpm typecheck` pass across the workspace after type regeneration.
- 7-day production smoke check (§6.2) passes.
- No customer-visible regression in allergen accuracy or feed quality.
- §4 decisions all explicitly recorded (in commit messages or this doc's edit history).

---

## 11. Appendix — change summary

### New migrations
- `infra/supabase/migrations/NNN_drop_ingredient_pipeline.sql`
- `infra/supabase/migrations/NNN+1_drop_ingredient_columns.sql`

### New artifacts
- `infra/snapshots/ingredient-tables-pre-phase-c.sql` (committed to git as the snapshot procedure; actual data dump goes to cold storage)

### Dropped tables (via §5.2 migration)
- `dish_ingredients`
- `canonical_ingredients`
- `canonical_ingredient_allergens`
- `ingredient_aliases`
- `ingredient_aliases_v2`
- `ingredient_concepts`
- `ingredient_variants`
- `concept_translations`
- `variant_translations`

### Dropped columns (via §5.3 migration)
- `dishes.allergens_override`
- `dishes.dietary_tags_override`
- `options.canonical_ingredient_id`

### Modified files (mobile, if not already done during the dish-model rewrite)
- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts` — replace the `canonical_ingredient_allergens` lookup with reads from `option.adds_allergens`.

### Modified files (shared)
- `packages/database/src/types.ts` (regenerated)
- `packages/shared/src/types/restaurant.ts` (audit and drop any residual ingredient field references)

### Modified files (web-portal, W2 only)
- Delete: `apps/web-portal/app/api/admin/ingredient-*/route.ts` (all variants)
- Delete: `apps/web-portal/app/admin/ingredients/page.tsx`
- Delete: `apps/web-portal/lib/ingredient-resolver.ts`
- Delete: `apps/web-portal/app/api/menu-scan/suggest-ingredients/route.ts`
- Modify: `apps/web-portal/app/api/menu-scan/confirm/route.ts` (drop the dish_ingredients insertion branch)
- Modify: `apps/web-portal/test/menu-scan-confirm.test.ts` (drop the related test cases)

### Documentation
- `CLAUDE.md` — drop any remaining references to `NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED` or the ingredient pipeline.
- `agent_docs/terminology.md` — drop `dish_ingredients`, `canonical_ingredients`, `ingredient_concepts` entries.
- `docs/project/06-database-schema.md` — drop ingredient-table sections.

---

## 12. Open questions

1. **§4.1 snapshot retention.** R1 (6 months), R2 (18 months), R3 (indefinite)? Default: R2.
2. **§4.3 web-portal end state.** W1 (retired) or W2 (still serving)? Determines §5.6 scope.
3. **Is `dishes.protein_canonical_names` still needed?** §4.2 recommends leaving it. Re-evaluate if it surfaces as a candidate during the audit.
4. **Migration numbering.** Two migrations in §5.2 and §5.3. Exact numbers depend on what's merged by the time Phase C runs.
5. **Cold-storage destination.** S3? GCS? Supabase storage bucket? Whatever the org's existing convention is — record it.
6. **Is there a release-notes / customer-facing announcement?** If "Ingredients to Avoid" was ever marketed as a feature, somebody should write a one-line note ("ingredient-level filtering retired; allergen filtering remains"). Probably nothing public, but worth confirming with product.

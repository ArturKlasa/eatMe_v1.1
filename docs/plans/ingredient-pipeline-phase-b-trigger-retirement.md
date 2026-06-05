# Ingredient pipeline — Phase B trigger retirement

**Status:** Proposed
**Last updated:** 2026-05-17
**Scope:** Drop the three DB triggers (and their backing functions) that fire on `dish_ingredients` changes and on `dishes.{allergens,dietary_tags}_override` updates. No table drops. No application-code changes.
**Out of scope:** Schema retirement (Phase C). Application-code cleanup (Phase A — must be merged first).
**Sequencing:** Run **after the dish-model rewrite has shipped AND been stable in production for 1–2 weeks**. Specifically: not before migration 150 of the dish-model rewrite has applied and feed quality has been observed normal for at least one full week.

---

## 1. When to implement

**Earliest start: 1–2 weeks after dish-model rewrite Phase 7 ships.**

Two gating conditions:

1. **Phase A must be merged.** Phase A removes the application-level read paths. Phase B retires the DB-level triggers that were the only remaining consumers of those reads. Running Phase B without Phase A leaves application code calling tables whose state is no longer maintained.
2. **Dish-model rewrite must be fully shipped, including Phase 7 cleanup.** During Phase 6 (data migration) of the rewrite, configurable parent rows get their variants deleted and new option rows inserted. If legacy `dish_ingredients` rows still pointed at any of those deleted variants, the `dish_ingredients_refresh` trigger would fire on the CASCADE DELETE and try to recompute allergens for a row that's about to disappear — harmless but noisy. Keeping the trigger alive through Phase 6 makes the migration self-cleaning. After Phase 7 stabilizes, the trigger is genuinely useless.

The 1–2-week observation window after Phase 7 isn't load-bearing; it's just confirmation that no surprise consumers of `dishes.allergens` / `dietary_tags` are relying on trigger-derived values for new dishes. Concretely: monitor that `dishes.allergens` columns aren't unexpectedly mutating without an explicit application-side UPDATE.

**Not before:** dish-model rewrite Phase 6 has completed and stabilized. Doing Phase B during Phase 6 is the worst case — it removes a safety net during the only destructive migration in the rewrite.

---

## 2. Background

After Phase A, runtime application code no longer reads or writes `dish_ingredients`. Three triggers remain:

1. **`dish_ingredients_refresh`** (mig 092) — fires on `dish_ingredients` INSERT/UPDATE/DELETE. Calls `refresh_dish_dietary(dish_id)` which recomputes `dishes.allergens` and `dishes.dietary_tags` from current ingredient rows. **No-op since Phase A:** nothing writes to `dish_ingredients`.
2. **`dishes_override_refresh`** (mig 092) — fires on `dishes` UPDATE of `allergens_override` or `dietary_tags_override`. Calls `refresh_dish_dietary()` to merge the override into the computed value. **Functionally inert since admin no longer uses override columns** — `dishes.allergens` is written directly by the worker / admin.
3. **`trg_enrich_on_ingredient_change`** (mig 135) — fires on `dish_ingredients` INSERT/DELETE. Notifies the `enrich-dish` edge function to recompute embedding. **No-op since Phase A:** nothing writes to `dish_ingredients`.

All three triggers are firing zero times per day in production (verifiable via `pg_stat_user_functions` after merge of Phase A). Phase B drops them and their backing functions.

The override columns themselves (`allergens_override`, `dietary_tags_override`) stay until Phase C. They're dead but harmless; bundling their drop with a destructive schema migration is the cleaner ordering.

---

## 3. End state (after Phase B)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Triggers on dish_ingredients / dishes (allergen-related)             │
├──────────────────────────────────────────────────────────────────────┤
│  dish_ingredients_refresh            ─── DROPPED                      │
│  dishes_override_refresh             ─── DROPPED                      │
│  trg_enrich_on_ingredient_change     ─── DROPPED                      │
│                                                                       │
│  Other triggers on dishes:                                            │
│  trg_enrich_on_dish_change           ─── PRESERVED (dish-side)        │
│  after_dish_embedded                 ─── PRESERVED (embedding hook)   │
│  trg_enrich_on_option_group_change   ─── PRESERVED (option-side)      │
│                                                                       │
│  Functions:                                                           │
│  trg_dish_ingredients_refresh()      ─── DROPPED                      │
│  trg_dishes_override_refresh()       ─── DROPPED                      │
│  refresh_dish_dietary()              ─── DROPPED                      │
│  compute_dish_allergens()            ─── DROPPED                      │
│  compute_dish_dietary_tags()         ─── DROPPED                      │
│                                                                       │
│  Columns / Tables:                                                    │
│  dishes.allergens_override           ─── PRESERVED (Phase C drops)    │
│  dishes.dietary_tags_override        ─── PRESERVED (Phase C drops)    │
│  dish_ingredients (table)            ─── PRESERVED (Phase C drops)    │
│  canonical_ingredients (table)       ─── PRESERVED (Phase C drops)    │
└──────────────────────────────────────────────────────────────────────┘
```

After Phase B:
- `dishes.allergens` and `dishes.dietary_tags` become **direct-write** columns. The worker, admin app, and any future writer set them explicitly; no trigger overrides.
- `dish_ingredients` table is fully orphaned — no readers (after Phase A), no triggers (after Phase B), only Phase C drops the table itself.

---

## 4. Effort: ~0.5 day

One migration file, no application changes, ~30 minutes of staging verification.

---

## 5. Concrete changes

### 5.1 New migration: drop the triggers and functions

**File:** `infra/supabase/migrations/NNN_retire_ingredient_triggers.sql` (NNN = next available number when Phase B runs)

```sql
-- Retire the dish_ingredients-driven trigger system.
-- After this migration:
--   - dishes.allergens / dietary_tags are direct-write only
--   - dishes.{allergens,dietary_tags}_override are dead columns (Phase C drops)
--   - dish_ingredients changes do not trigger enrich-dish (Phase C drops the table)

BEGIN;

-- Drop triggers first (must come before the functions they call).
DROP TRIGGER IF EXISTS dish_ingredients_refresh        ON public.dish_ingredients;
DROP TRIGGER IF EXISTS dishes_override_refresh         ON public.dishes;
DROP TRIGGER IF EXISTS trg_enrich_on_ingredient_change ON public.dish_ingredients;

-- Drop the trigger functions.
DROP FUNCTION IF EXISTS public.trg_dish_ingredients_refresh();
DROP FUNCTION IF EXISTS public.trg_dishes_override_refresh();

-- Drop the helper functions used by refresh_dish_dietary.
-- refresh_dish_dietary calls compute_dish_allergens + compute_dish_dietary_tags,
-- so drop refresh_dish_dietary first then the computes.
DROP FUNCTION IF EXISTS public.refresh_dish_dietary(uuid);
DROP FUNCTION IF EXISTS public.compute_dish_allergens(uuid);
DROP FUNCTION IF EXISTS public.compute_dish_dietary_tags(uuid);

COMMIT;
```

**Why the explicit BEGIN/COMMIT:** the migration is all-or-nothing. Either every trigger and function is dropped, or the migration rolls back and the legacy system stays intact. No partial state.

**Why drop `compute_dish_allergens` / `compute_dish_dietary_tags`:** they're only called by `refresh_dish_dietary`, which is being dropped. The mig 105 refactor moved them to read from `ingredient_concepts` instead of `canonical_ingredients`, but no other caller exists. Verify with `pg_proc` if any other migration introduced a caller (none expected).

### 5.2 No application-code changes

Phase A already removed all application reads of `dish_ingredients`. Application writes were already absent before Phase A. Phase B touches DB-only.

### 5.3 No `@eatme/database` regeneration

Generated types pin to columns/tables, not triggers or functions. Phase B is invisible to the type system.

---

## 6. Verification

### 6.1 Pre-deploy on staging

1. Apply the migration on staging.
2. Confirm zero rows in `pg_trigger` matching `dish_ingredients_refresh`, `dishes_override_refresh`, `trg_enrich_on_ingredient_change`:
   ```sql
   SELECT tgname FROM pg_trigger WHERE tgname IN (
     'dish_ingredients_refresh',
     'dishes_override_refresh',
     'trg_enrich_on_ingredient_change'
   );
   -- Expected: zero rows
   ```
3. Confirm zero rows in `pg_proc` matching the dropped function names.
4. Smoke-test admin flow: scan a menu, confirm, dishes appear with correct allergens. (Worker writes `dishes.allergens` directly; trigger absence is invisible.)
5. Smoke-test mobile flow: feed returns dishes with correct allergens; restaurant detail shows correct per-option allergen badges (the surviving `canonical_ingredient_allergens` lookup is independent of these triggers).

### 6.2 Post-deploy in production

24-hour smoke check:
- `dishes.allergens` column hasn't unexpectedly mutated for any new dish (sample 20 newly-created rows + their audit-log entries, confirm `allergens` reflects exactly what the worker / admin wrote).
- `enrich-dish` invocation count unchanged from baseline (the dropped `trg_enrich_on_ingredient_change` shouldn't have been firing anyway).
- No new error rows in `pg_stat_user_functions` for trigger-related functions (since they no longer exist).

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Some legacy dish still has trigger-derived `dishes.allergens` that we don't realize | Low | Trigger drops don't reset the column. `dishes.allergens` retains whatever value was last written by the trigger. The data is preserved; only the recomputation is dropped. |
| A surprise consumer reads `allergens_override` | Low | Column preserved; Phase B is pure trigger-drop. The column simply stops being merged into the computed allergens (which itself isn't being computed anymore). |
| Phase B applied while Phase A still has stale write paths somewhere | Low | Phase A's acceptance criteria (grep returns zero hits) catches this. If a writer slipped through, the trigger absence means writes are silently incorrect — caught on the 24-hour smoke check by the audit-log spot-check. |
| The dropped functions are called by another trigger or RPC we don't know about | Low | Pre-migration: `SELECT * FROM pg_proc WHERE prosrc LIKE '%refresh_dish_dietary%'` should return only the functions we're about to drop. If it returns anything else, abort and investigate. |
| Web-portal still writes `dish_ingredients` rows via its (gated) confirm route | Low | Phase A documented this; web-portal is being retired. If `NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED` is somehow on in a deployed environment, the writes will succeed but the trigger no longer fires — `dishes.allergens` stays whatever the worker wrote, ignoring the ingredient rows. This is the same de-facto behavior the new admin already produces. |

---

## 8. Rollback

If any of §6.1 / §6.2 verification fails, revert is straightforward:

```sql
-- Re-create from migrations 092 and 105. Simplest: run a single rollback migration
-- that re-installs the functions and triggers by copying the bodies from 092/105.
```

Phase B doesn't drop data. Rollback restores the trigger system to its pre-Phase-B state with no data loss. The functions can be re-created from migrations 092 (and 105's refactor) verbatim.

In practice: keep a rollback SQL file ready before applying Phase B's migration, even if the chance of needing it is low.

---

## 9. Sequencing

```
[Phase A merged]   →   [Dish-model rewrite Phases 1-7 shipped]
                                          ↓
                            [1-2 weeks stable observation]
                                          ↓
                                     [Phase B]   ← this doc
                                          ↓
                            [4-6 weeks stable observation]
                                          ↓
                                     [Phase C]   ← schema retirement
```

Phase B is gated on the dish-model rewrite, NOT on Phase A directly. Phase A is a prerequisite of the dish-model rewrite (recommended ordering, not enforced). Phase B is the first thing that needs both upstreams to be done.

---

## 10. Acceptance criteria

- New migration applies cleanly on staging.
- `pg_trigger` query in §6.1 returns zero rows for the three dropped triggers.
- `pg_proc` query returns zero rows for the five dropped functions.
- Admin menu scan + confirm flow produces dishes with correct allergens.
- Mobile feed + restaurant-detail screens render correctly with allergen badges intact.
- 24-hour production smoke check (§6.2) passes.
- No customer-visible regression in allergen accuracy.

---

## 11. Appendix — change summary

### New migration
- `infra/supabase/migrations/NNN_retire_ingredient_triggers.sql`

### Dropped via migration
- Triggers: `dish_ingredients_refresh`, `dishes_override_refresh`, `trg_enrich_on_ingredient_change`
- Functions: `trg_dish_ingredients_refresh()`, `trg_dishes_override_refresh()`, `refresh_dish_dietary(uuid)`, `compute_dish_allergens(uuid)`, `compute_dish_dietary_tags(uuid)`

### Preserved (Phase C drops)
- Columns: `dishes.allergens_override`, `dishes.dietary_tags_override`
- Tables: `dish_ingredients`, `canonical_ingredients`, `canonical_ingredient_allergens`, `ingredient_aliases`, `ingredient_aliases_v2`, `ingredient_concepts`, `ingredient_variants`, `concept_translations`, `variant_translations`

### Not touched
- `@eatme/database` types (generated; tables/columns unchanged).
- `@eatme/shared` types.
- Application code in `apps/admin`, `apps/mobile`, `infra/supabase/functions/*`.

---

## 12. Open questions

1. **Migration number.** Depends on what's been merged before Phase B runs. The dish-model rewrite reserves 140–150; allow a buffer beyond that.
2. **Override-column drop timing.** Phase B keeps `allergens_override` / `dietary_tags_override`; Phase C drops them. Alternative: drop them in Phase B to consolidate "allergen-related schema retirement" in a single step. Trade-off: Phase B becomes mildly destructive (column drop is harder to reverse than trigger drop). Default: defer to Phase C.
3. **Is the 24-hour smoke check long enough?** For a trigger drop with no application impact, probably yes. If a stakeholder wants a 1-week observation before unlocking Phase C scheduling, that's a low-cost concession.

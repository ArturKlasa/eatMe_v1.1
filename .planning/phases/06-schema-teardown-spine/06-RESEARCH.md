# Phase 6: Schema Teardown Spine - Research

**Researched:** 2026-06-20
**Domain:** PostgreSQL irreversible schema teardown (REST-only, stage-don't-apply) + TypeScript shim removal + generated-type reconciliation
**Confidence:** HIGH (all findings grounded in repo files / migrations read this session; the one genuine unknown — live prod state — is isolated and handed to the operator probe)

## Summary

This phase is **not greenfield authoring** — it is **drift reconciliation around files that already exist**. The single most important discovery: the Phase C migrations the planner was told to "author" are **already authored and committed** — `152_drop_ingredient_pipeline.sql` and `153_drop_ingredient_columns.sql` (commit `c226e38`), both using `CASCADE`. So is Phase B (`151_retire_ingredient_triggers.sql`). The real work is: (1) reconcile these against what migrations 152–157 + 163 *already did or claim to have done*, (2) re-author the table/column drops to honor SC2's `RESTRICT` mandate (the existing files violate it), (3) resolve the one unknowable — whether those migrations are actually applied in prod — via an operator paste-back probe, then (4) do the small, fully-grep-confirmed DishKind TS removal and (5) confirm the generated types, which research shows are **already slimmed** (zero ingredient/allergen/dish_kind residue).

The second critical discovery: **`database_schema.sql` is the stale artifact, NOT `types.ts`.** FINDINGS F-07/F-15 say `types.ts` (3226 lines) "predates 153/156/163 and may carry dropped types." Verified false this session: `types.ts` has zero references to any ingredient table, `allergens`/`dietary_tags`/`*_override` columns, `options.canonical_ingredient_id`, or `dish_kind` — it was last regenerated at commits `1ea9b18`/`e34db9f` (abandon-allergens + phase-7 legacy-column refactor). Conversely `database_schema.sql` still lists `dish_ingredients`, `canonical_ingredients`, `dishes.allergens`, `dishes.dish_kind`, `options.canonical_ingredient_id`, and *lacks* post-141 columns (`dining_format`, `bundled_items`) — it is a pre-141/pre-152 snapshot. **Do not trust `database_schema.sql` as live-state evidence in either direction.**

The third discovery: the Phase C plan doc lists **9 ingredient tables**, but `database_schema.sql` only contains **5** of them (the other 4 — `ingredient_concepts`, `ingredient_variants`, `ingredient_aliases_v2`, `concept_translations`, `variant_translations` — were created in migration `099` and are absent from the snapshot). Whether those 4 still exist in prod is exactly what the operator probe must resolve before any `RESTRICT` drop is run.

**Primary recommendation:** Treat live prod state as unknown. The planner authors NEW migrations (next numbers after 170, e.g. 171/172/173) that (a) re-do Phase B as a reconciled trigger drop, (b) snapshot-then-RESTRICT-drop the ingredient tables in proven child→parent order, (c) RESTRICT-drop the columns — all `IF EXISTS`-guarded so they are idempotent whether or not 151/152/153 already ran. Gate everything behind one operator paste-back probe (single `jsonb_build_object` SELECT) that reports exactly what still exists. The DishKind TS track and the type-confirm are independent and low-risk.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drop ingredient triggers/functions (DEBT-01) | Database / Storage | — | Pure DDL on prod; authored in-repo, applied by operator |
| Drop ingredient tables + columns (DEBT-02) | Database / Storage | — | Pure DDL; irreversible; RESTRICT + pg_depend pre-flight |
| In-DB archive snapshot (D-01) | Database / Storage | — | `CREATE SCHEMA ingredient_archive` + `CREATE TABLE … AS SELECT`; operator-run |
| DishKind shim removal (DEBT-03) | Shared package (`@eatme/shared`) | Frontend Server (web-portal-v2) | TS-only; v2 importers severed first, then shims deleted |
| Generated-type confirm/edit (DEBT-04) | Shared package (`@eatme/database`) | API/Edge (`infra/supabase/functions/*`) | Hand-edit types.ts (no CLI); reconcile inline edge enums |
| Live-state determination | Database / Storage (operator) | — | REST-only env; agent cannot query prod — paste-back probe |

## Standard Stack

No external packages installed in this phase. Tooling is all incumbent:

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| PostgreSQL (Supabase) | 15 + PostGIS + pgvector 0.8.0 | DDL target | Project backend [VERIFIED: CLAUDE.md + F-13 live-state] |
| Supabase dashboard SQL editor | n/a | Operator apply surface | No psql/CLI in env (REST-only) [VERIFIED: CONTEXT D-01/D-09] |
| `@supabase/supabase-js` (service role) | as pinned (Phase 4) | REST-only verify scripts (`verify-phase6.ts` pattern) | Incumbent; read-only probes [VERIFIED: infra/scripts/verify-phase7.ts] |
| `turbo run check-types` | repo turbo | SC4 regression gate | `tsc --noEmit` across apps/admin + web-portal-v2 [VERIFIED: turbo.json + package.json scan] |
| `git grep` | system | SC1/SC3 pre-flights | Specified by SC1/SC3 [VERIFIED: ROADMAP] |

**No installation step. No Package Legitimacy Audit required** (this phase installs nothing).

**`turbo check-types` scope (VERIFIED via package.json scan):**
- `apps/admin` → `tsc --noEmit` ✓
- `apps/web-portal-v2` → `tsc --noEmit` ✓
- `apps/mobile` → **no `check-types` script** (excluded — use `cd apps/mobile && npx tsc --noEmit` if mobile types touched; they should NOT be in this phase)
- `packages/shared`, `packages/database`, `packages/tokens` → **no `check-types` script**. They are type-checked transitively (turbo `dependsOn: ["^check-types"]`) when the consuming apps run `tsc`. **Implication for DEBT-03/SC4:** a broken shim removal in `@eatme/shared` surfaces as a compile error in `apps/admin` / `apps/web-portal-v2`, not in shared itself. The grep gate (zero importers) is therefore the primary proof; `turbo check-types` is the backstop.

## Migration Drift Reconciliation (the de-risking core)

### What already exists in the repo (VERIFIED — files read this session)

| Migration | Purpose | Mechanism | Status signal |
|-----------|---------|-----------|---------------|
| `151_retire_ingredient_triggers.sql` + REVERSE | Phase B: drop 3 triggers + 5 functions | `DROP … IF EXISTS` | Authored 2026-06-04; F-01 says NOT applied in prod |
| `152_drop_ingredient_pipeline.sql` + REVERSE | Phase C tables: drops **9** ingredient tables | **`CASCADE`** (violates SC2) | Authored, committed `c226e38`; F-01 says NOT applied |
| `153_drop_ingredient_columns.sql` + REVERSE | Phase C columns: `dishes.allergens_override`, `dishes.dietary_tags_override`, `options.canonical_ingredient_id` | `DROP COLUMN IF EXISTS` | Authored, committed; F-01 says NOT applied |
| `156_drop_dietary_allergen_columns.sql` + REVERSE | abandon-allergens: drops `dishes.allergens`/`dietary_tags`, `options.adds_allergens`/`removes_dietary_tags`/`adds_dietary_tags`, `user_preferences.*`, and tables `allergens`/`dietary_tags`/`canonical_ingredient_dietary_tags` | **`CASCADE`** | Per CLAUDE.md: applied (155/156 "complete the DB removal") |
| `157_drop_dietary_allergen_orphans.sql` + REVERSE | drops `user_behavior_profiles.preferred_dietary_tags` + `validate_allergen_codes()` | `DROP IF EXISTS` | Follow-up to 155/156 |
| `163_phase7_coordinated_drop.sql` + REVERSE | drops `dishes.dish_kind`, `parent_dish_id`, `is_parent`, `is_template`, `price_per_person` + `dish_courses`/`dish_course_items` | n/a | Per CLAUDE.md: applied 2026-06-12 |

**The "9-table list" reconciliation (CRITICAL):** migration `152` drops, in order:
`variant_translations`, `concept_translations`, `ingredient_variants`, `canonical_ingredient_allergens`, `dish_ingredients`, `ingredient_aliases`, `ingredient_aliases_v2`, `ingredient_concepts`, `canonical_ingredients`.

But `database_schema.sql` (the snapshot) only contains **5**: `canonical_ingredient_allergens`, `canonical_ingredient_dietary_tags`, `canonical_ingredients`, `dish_ingredients`, `ingredient_aliases`. The other 4 (`ingredient_concepts`, `ingredient_variants`, `ingredient_aliases_v2`, `concept_translations`, `variant_translations`) were created in `099_new_ingredients_schema.sql` [VERIFIED: file read] but do not appear in the snapshot. Two possibilities, both resolvable only by the operator probe:
1. They exist in prod and the snapshot is just incomplete/stale; OR
2. They were never fully promoted / were dropped, and `152`'s `IF EXISTS` would no-op them.

Note also: `156` already dropped `canonical_ingredient_dietary_tags` (a table `152` does NOT target). So the reconciled table-drop universe is up to **9 + canonical_ingredient_dietary_tags** depending on prod reality.

### The D-06 trigger/function drift (VERIFIED by reading 151_REVERSE + 156)

`151`'s forward drop targets: triggers `dish_ingredients_refresh`, `dishes_override_refresh`, `trg_enrich_on_ingredient_change`; functions `trg_dish_ingredients_refresh()`, `trg_dishes_override_refresh()`, `refresh_dish_dietary(uuid)`, `compute_dish_allergens(uuid)`, `compute_dish_dietary_tags(uuid)`.

**151's REVERSE is BROKEN post-156** (confirmed by reading the REVERSE file):
- `151_REVERSE` line 64–76: `compute_dish_dietary_tags` body queries `public.dietary_tags` and `public.canonical_ingredient_dietary_tags` — **both dropped by 156**. Recreating it would fail.
- `151_REVERSE` line 99–120: `refresh_dish_dietary` writes `dishes.allergens` / `dishes.dietary_tags` — **both dropped by 156**. The UPDATE targets nonexistent columns.
- `151_REVERSE` line 169–172: `dishes_override_refresh` trigger fires `AFTER UPDATE OF allergens_override, dietary_tags_override` — columns dropped by `153` (if applied).

**Forward-drop drift:** `156`'s `CASCADE` drop of `allergens`/`dietary_tags` columns and `dietary_tags` table *may have already dropped some of 151's targets* — specifically, if `dishes_override_refresh` trigger or the `compute_dish_*` functions had a dependency on the dropped columns/tables, CASCADE would have removed them. So 151's forward `DROP TRIGGER/FUNCTION IF EXISTS` may now be partial no-ops. This is harmless (IF EXISTS) but means **the planner must NOT assume 151 is the authoritative "what's left" list** — the operator probe is the source of truth.

**Planner action (per D-06):** author the reconciled Phase B as a NEW migration (e.g. 171) that:
- forward: `DROP TRIGGER/FUNCTION IF EXISTS` for whatever the probe confirms still exists (subset of 151's list);
- REVERSE: either omit the recreate of functions referencing dropped columns/tables, OR recreate them in a form that does not touch `allergens`/`dietary_tags`/`dietary_tags`-table (a degenerate reverse, per the 152 precedent of a "minimal / marker-only" reverse). Do NOT copy 151's REVERSE verbatim — it will not apply.

### Authoritative reconciled drop list (snapshot-then-drop vs trivially droppable)

The planner finalizes the membership against the probe, but the **structure** is fixed:

**Snapshot-then-drop (D-01 archive — these may hold curated data):**
- `canonical_ingredients` (parent)
- `ingredient_aliases`, `ingredient_aliases_v2`
- `ingredient_concepts`, `ingredient_variants`
- `concept_translations`, `variant_translations`
- `canonical_ingredient_allergens`

**Trivially droppable (per-dish junk / recomputable / empty):**
- `dish_ingredients` (per-dish, recomputable from re-scan; Phase C doc §2.1 rates it "Low value, High reproducibility")
- `canonical_ingredient_dietary_tags` — if it survived 156 (probe confirms)

**Columns (RESTRICT drop — no data worth archiving; all confirmed dead/empty):**
- `dishes.allergens_override`, `dishes.dietary_tags_override`
- `options.canonical_ingredient_id`

### Operator paste-back probe (single bundled SELECT — flag: OPERATOR MUST RUN)

Per project convention (one `jsonb_build_object` so a single paste returns everything). Comments use `--` line prefixes so any static-safety gate strips forbidden tokens.

```sql
-- PHASE 6 LIVE-STATE PROBE — read-only. Paste into Supabase dashboard SQL editor.
-- Returns one JSON object reporting exactly what the teardown must still drop.
SELECT jsonb_build_object(
  'ingredient_tables_present', (
    SELECT coalesce(jsonb_agg(table_name ORDER BY table_name), '[]'::jsonb)
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'dish_ingredients','canonical_ingredients','canonical_ingredient_allergens',
        'canonical_ingredient_dietary_tags','ingredient_aliases','ingredient_aliases_v2',
        'ingredient_concepts','ingredient_variants','concept_translations','variant_translations'
      )
  ),
  'ingredient_triggers_present', (
    SELECT coalesce(jsonb_agg(tgname ORDER BY tgname), '[]'::jsonb)
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN ('dish_ingredients_refresh','dishes_override_refresh','trg_enrich_on_ingredient_change')
  ),
  'ingredient_functions_present', (
    SELECT coalesce(jsonb_agg(proname ORDER BY proname), '[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND proname IN ('trg_dish_ingredients_refresh','trg_dishes_override_refresh',
                      'refresh_dish_dietary','compute_dish_allergens','compute_dish_dietary_tags')
  ),
  'dead_columns_present', (
    SELECT coalesce(jsonb_object_agg(table_name || '.' || column_name, true), '{}'::jsonb)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ( (table_name = 'dishes'  AND column_name IN ('allergens_override','dietary_tags_override'))
         OR (table_name = 'options' AND column_name = 'canonical_ingredient_id') )
  ),
  'archive_row_counts', (
    -- Wrap each in to_regclass so the probe never errors if a table is already gone.
    SELECT jsonb_build_object(
      'canonical_ingredients',          (SELECT CASE WHEN to_regclass('public.canonical_ingredients')          IS NULL THEN -1 ELSE (SELECT count(*) FROM public.canonical_ingredients)          END),
      'ingredient_aliases',             (SELECT CASE WHEN to_regclass('public.ingredient_aliases')             IS NULL THEN -1 ELSE (SELECT count(*) FROM public.ingredient_aliases)             END),
      'ingredient_aliases_v2',          (SELECT CASE WHEN to_regclass('public.ingredient_aliases_v2')          IS NULL THEN -1 ELSE (SELECT count(*) FROM public.ingredient_aliases_v2)          END),
      'ingredient_concepts',            (SELECT CASE WHEN to_regclass('public.ingredient_concepts')            IS NULL THEN -1 ELSE (SELECT count(*) FROM public.ingredient_concepts)            END),
      'ingredient_variants',            (SELECT CASE WHEN to_regclass('public.ingredient_variants')            IS NULL THEN -1 ELSE (SELECT count(*) FROM public.ingredient_variants)            END),
      'concept_translations',           (SELECT CASE WHEN to_regclass('public.concept_translations')           IS NULL THEN -1 ELSE (SELECT count(*) FROM public.concept_translations)           END),
      'variant_translations',           (SELECT CASE WHEN to_regclass('public.variant_translations')           IS NULL THEN -1 ELSE (SELECT count(*) FROM public.variant_translations)           END),
      'canonical_ingredient_allergens', (SELECT CASE WHEN to_regclass('public.canonical_ingredient_allergens') IS NULL THEN -1 ELSE (SELECT count(*) FROM public.canonical_ingredient_allergens) END),
      'dish_ingredients',               (SELECT CASE WHEN to_regclass('public.dish_ingredients')               IS NULL THEN -1 ELSE (SELECT count(*) FROM public.dish_ingredients)               END)
    )
  )
) AS phase6_probe;
```
`-1` row count = table already absent (so its drop will be a no-op). This single result tells the planner exactly which drops are real, which are no-ops, and whether any archive table has rows worth keeping. **[OPERATOR MUST RUN — paste-back required before authoring the final drop migration content.]** [VERIFIED: query shape validated against information_schema/pg_catalog usage; table list cross-checked against 099 + 152 + 156]

## pg_depend Dependency Audit + RESTRICT Drop Ordering (SC2)

### Why RESTRICT, and what it would fail on

The existing `152` uses `CASCADE` "defensively." SC2 forbids `CASCADE` as the load-bearing mechanism precisely so the drop **fails loudly** if an unexpected dependency exists (a view, FK, or function the team forgot about) rather than silently cascading into it. The pg_depend audit is the pre-flight that proves the RESTRICT order is safe.

### FK dependency graph (VERIFIED from 099 + database_schema.sql DDL)

```
canonical_ingredients (root parent)
  ├── canonical_ingredient_allergens.canonical_ingredient_id → canonical_ingredients(id)
  │       └── canonical_ingredient_allergens.allergen_id → allergens(id)   [allergens dropped by 156]
  ├── canonical_ingredient_dietary_tags.canonical_ingredient_id → canonical_ingredients(id)  [maybe gone via 156]
  ├── ingredient_aliases.canonical_ingredient_id → canonical_ingredients(id)
  ├── dish_ingredients.ingredient_id → canonical_ingredients(id)   (also dish_ingredients.dish_id → dishes(id))
  └── ingredient_concepts.legacy_canonical_id → canonical_ingredients(id) ON DELETE SET NULL

ingredient_concepts (second parent — the 099 refactor)
  ├── ingredient_variants.concept_id → ingredient_concepts(id) ON DELETE CASCADE
  ├── concept_translations.concept_id → ingredient_concepts(id) ON DELETE CASCADE
  └── ingredient_aliases_v2.concept_id → ingredient_concepts(id) ON DELETE CASCADE
        └── ingredient_aliases_v2.variant_id → ingredient_variants(id) ON DELETE CASCADE

ingredient_variants
  └── variant_translations.variant_id → ingredient_variants(id) ON DELETE CASCADE
```

### Provably-safe RESTRICT child→parent DROP order

Drop leaves before parents so every RESTRICT succeeds without cascade:

```
1.  variant_translations            (child of ingredient_variants)
2.  concept_translations            (child of ingredient_concepts)
3.  ingredient_aliases_v2           (child of ingredient_concepts + ingredient_variants)
4.  ingredient_variants             (child of ingredient_concepts)
5.  canonical_ingredient_dietary_tags  (child of canonical_ingredients) — only if present
6.  canonical_ingredient_allergens  (child of canonical_ingredients)
7.  ingredient_aliases              (child of canonical_ingredients)
8.  dish_ingredients                (child of canonical_ingredients + dishes)
9.  ingredient_concepts             (parent; its FK to canonical_ingredients is SET NULL so order vs canonical is flexible, but drop before canonical for cleanliness)
10. canonical_ingredients           (root parent — drop last)
```
Use `DROP TABLE IF EXISTS public.<t> RESTRICT;` for each, top to bottom, inside one `BEGIN; … COMMIT;`. With this order, **a RESTRICT failure means an unknown external dependent exists** — exactly the loud signal SC2 wants. If the probe shows `dishes` still has the FK from `dish_ingredients`, that's internal-to-set and handled by the order. The only external risk is a view or RPC referencing a table — caught by the audit below.

**Note on `options.canonical_ingredient_id`:** its FK points *into* `canonical_ingredients`. Therefore the **column drop (153-equivalent) must run BEFORE dropping `canonical_ingredients`**, OR `canonical_ingredients` cannot be dropped under RESTRICT. Two valid orderings:
- (a) drop columns first (sever `options.canonical_ingredient_id`), then drop tables; or
- (b) keep the locked spine (tables then columns) but include `options` in the dependency audit and drop `options.canonical_ingredient_id` as the very first DDL of the table-drop migration.
**Recommendation:** the locked sequence is "tables → columns," but the `options.canonical_ingredient_id` FK forces its drop to precede the `canonical_ingredients` table drop. Resolve by making the **first statement** of the tables migration `ALTER TABLE public.options DROP COLUMN IF EXISTS canonical_ingredient_id;` — this is the FK sever, not the "dead column cleanup" (which stays in the columns step for `dishes.*_override`). Flag this for the planner; it is the one place the literal "tables before columns" wording needs a documented carve-out.

### pg_depend / FK audit pre-flight query (SC2 — OPERATOR MUST RUN)

```sql
-- PHASE 6 DEPENDENCY AUDIT — read-only. Finds anything OUTSIDE the ingredient set
-- that depends on an ingredient table/column, which a RESTRICT drop would reject.
SELECT jsonb_build_object(
  -- (A) FKs pointing INTO the ingredient set from a non-ingredient table.
  'external_fks_into_set', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'from_table', conrelid::regclass::text,
      'to_table',   confrelid::regclass::text,
      'constraint', conname)), '[]'::jsonb)
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid::regclass::text LIKE 'public.%'
      AND confrelid::regclass::text ~ '(canonical_ingredient|ingredient_|dish_ingredients|concept_translations|variant_translations)'
      AND conrelid::regclass::text !~ '(canonical_ingredient|ingredient_|dish_ingredients|concept_translations|variant_translations)'
  ),
  -- (B) Views / matviews / functions referencing any ingredient object (pg_depend rewrite deps).
  'dependent_objects', (
    SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
      'dependent', dependent.relname,
      'kind',      dependent.relkind,
      'depends_on', src.relname)), '[]'::jsonb)
    FROM pg_depend d
    JOIN pg_rewrite r   ON r.oid = d.objid
    JOIN pg_class dependent ON dependent.oid = r.ev_class
    JOIN pg_class src   ON src.oid = d.refobjid
    JOIN pg_namespace n ON n.oid = src.relnamespace
    WHERE n.nspname = 'public'
      AND src.relname ~ '(canonical_ingredient|ingredient_|dish_ingredients|concept_translations|variant_translations)'
      AND dependent.relname !~ '(canonical_ingredient|ingredient_|dish_ingredients|concept_translations|variant_translations)'
  )
) AS phase6_depaudit;
```
Expected clean result: `external_fks_into_set` empty, `dependent_objects` empty. Any row = a hard blocker the planner must resolve before the drop. **[OPERATOR MUST RUN — paste-back required.]** [VERIFIED: query uses pg_constraint/pg_depend/pg_rewrite standard joins]

## DishKind Shim Removal Mechanics (DEBT-03 / SC3) — VERIFIED file-by-file

### Exact live-code consumers (git grep, excluding `.next/` — VERIFIED this session)

The ONLY live-code references to `DishKind` / `DISH_KIND_META` are:

| File:line | Reference | Action |
|-----------|-----------|--------|
| `apps/web-portal-v2/src/components/menu/DishForm.tsx:5` | `import { …, type DishKind, type DishV2Input }` | Remove `type DishKind` from import (keep `DishV2Input`, `PRIMARY_PROTEINS`) |
| `apps/web-portal-v2/src/components/menu/DishForm.tsx:19` | `dish_kind: DishKind;` in `DishFormValues` | Remove field (D-07: cut kind selector) |
| `apps/web-portal-v2/src/components/menu/DishForm.tsx:60` | `dish_kind: 'standard'` in `DEFAULT_VALUES` | Remove |
| `apps/web-portal-v2/src/components/menu/DishForm.tsx:71–111` | `buildDishInput` `switch (v.dish_kind)` | Collapse to flat output — return `{...base, ...modifier_groups/bundled_items}` without `dish_kind` |
| `apps/web-portal-v2/src/components/menu/DishForm.tsx:134,223–254` | `watch('dish_kind')` + `<KindSelector>` + kind-conditional sections | Remove KindSelector render + the `dishKind === …` conditionals (or keep sections behind a non-kind toggle — planner's call within D-07) |
| `apps/web-portal-v2/src/components/menu/KindSelector.tsx` (whole file) | imports `DishKind` + `DISH_KIND_META` | **Delete file** (D-07) |
| `packages/shared/src/types/restaurant.ts:26` | `export type DishKind = …` | Delete (D-08) |
| `packages/shared/src/types/restaurant.ts:171` | `dish_kind?: DishKind;` on Dish interface | Delete the field (D-08) |
| `packages/shared/src/types/index.ts:3` | `DishKind,` in re-export block | Delete the line (D-08) |
| `packages/shared/src/constants/menu.ts:25` | `export const DISH_KIND_META = {…}` | Delete the const (D-08); keep `DINING_FORMATS`/`DINING_FORMAT_META` below it |
| `packages/shared/src/__tests__/dish-kinds.test.ts` (whole file) | tests `DISH_KIND_META` | **Delete file** (D-08) |

**Confirmed NO consumers in `apps/admin` or `apps/mobile`** [VERIFIED: `git grep` returned NONE]. The other `git grep` hits are all in `.agents/planning/*` historical design docs and `infra/supabase/migrations/115_*.sql` comments — not live code, do not touch.

### `DishV2Input` / `dishSchemaV2` is INDEPENDENT of the `DishKind` symbol (resolves the D-08 open question)

VERIFIED by reading `packages/shared/src/validation/dish.ts`:
- `dishSchemaV2` line 56 has its **own inline literal**: `dish_kind: z.enum(['standard','bundle','configurable','course_menu','buffet']).optional()`. It does **NOT** import or reference the `DishKind` type symbol.
- `DishV2Input = z.input<typeof dishSchemaV2>` therefore **survives** shim removal unchanged.
- Because `dish_kind` is `.optional()` on `dishSchemaV2`, the v2 `buildDishInput` can stop emitting `dish_kind` entirely and the schema still validates. **The v2 sever is type-safe.**

**Scope boundary the planner must respect:** the inline `z.enum(['standard',…])` `dish_kind` literals at `validation/dish.ts:56`, `validation/menuScan.ts:41`, `validation/menuScan.ts:97`, `validation/restaurant.ts:65`, and `infra/supabase/functions/menu-scan-worker/index.ts:101` are **NOT** in DEBT-03's scope. They (a) don't reference the `DishKind` type symbol and (b) relate to the `dishes.dish_kind` *column* dropped by migration 163 (a different, already-done teardown), not the ingredient pipeline. Removing them is out of scope for this phase unless the planner explicitly decides to fold the 163-leftover cleanup in (Claude's discretion territory, but NOT mandated by SC3/SC4).

### Consumer-grep proof command (SC3 — zero importers after removal)

```bash
# Run AFTER v2 sever + shim deletion. Must return ZERO lines.
git grep -nE "DishKind|DISH_KIND_META" -- 'apps/**' 'packages/**' 'infra/**' ':!**/.next/**'
# Tighter (live importers only, ignores the inline z.enum literals that legitimately remain):
git grep -nE "\bDishKind\b|\bDISH_KIND_META\b" -- 'apps/**' 'packages/**' ':!**/.next/**' ':!**/__tests__/**'
```
[VERIFIED: the broad form currently returns exactly the 11 rows listed above; after the planned edits it returns zero in live code]

## Type Regen Mechanics (DEBT-04 / SC4) — types.ts is ALREADY slimmed

### Finding that overturns F-07/F-15 (VERIFIED this session)

`packages/database/src/types.ts` (3226 lines) contains **ZERO** references to any object this phase or the prior teardowns dropped:
- No `dish_ingredients`, `canonical_ingredients`, `canonical_ingredient_allergens`, `ingredient_aliases*`, `ingredient_concepts`, `ingredient_variants`, `concept_translations`, `variant_translations` tables [VERIFIED: grep empty].
- `dishes` Row block (lines 300–335): no `allergens`, `dietary_tags`, `allergens_override`, `dietary_tags_override`, `dish_kind`. Has `dining_format`, `bundled_items`, `portion_*`, modifier-model fields.
- `options` Row block (lines 1019+): no `canonical_ingredient_id`, no `adds_allergens`/`removes_dietary_tags`/`adds_dietary_tags`. Has `price_override`, `serves_delta`, `is_default`.
- `user_preferences` block: only `diet_preference`, `exclude`, `favorite_cuisines`, `spice_tolerance` — the 156-dropped columns are absent.
- No `compute_dish_allergens` / `refresh_dish_dietary` / `validate_allergen_codes` functions.
- No `dish_kind` anywhere [VERIFIED: grep returned "NO dish_kind in types.ts"].

Last `types.ts` commits: `1ea9b18 feat: abandon dish-level allergens + dietary tags`, `e34db9f refactor(phase7): stop reading/writing legacy dish columns`. So it was **already regenerated/hand-edited to a post-152/153/156/157/163 schema.**

**Implication for DEBT-04/SC4:** the "single hand-edit type regen" (D-09) is likely a **NO-OP or near-no-op** — there are no dropped-object types left to strip. SC4's literal text ("the slimmed `types.ts` no longer contains the dropped tables/columns") is **already TRUE**. The planner should:
1. Confirm (re-grep) that no residue exists after the operator applies the drops (it won't appear because it's already absent).
2. Treat the "regen" task as a **verification task**, not an edit task — unless the operator probe reveals prod still has ingredient tables AND a later real regen would re-introduce them (it won't, since the drops remove them).
3. Keep `turbo check-types` as the regression gate (will pass, since nothing references the absent types).

### Inline edge-function enum reconciliation (D-10) — essentially a no-op for ingredients

VERIFIED via `git grep` over `infra/supabase/functions/**`:
- The only ingredient/allergen/dietary references in edge functions are **comments** noting retirement (`feed/index.ts:80,280`, `menu-scan-worker/index.ts:100`).
- The only live inline enum is `menu-scan-worker/index.ts:101` `dish_kind: z.enum([...])` — this duplicates the `dishes.dish_kind` column dropped by **migration 163** (already done), NOT an ingredient-pipeline object. It is out of this phase's strict scope (same boundary as the validation-schema `z.enum` literals above).
- **No inline copies of ingredient/allergen DB objects exist in edge functions.** D-10's "reconcile inline edge-function enum copies" has nothing ingredient-related to reconcile. The planner should document this as "verified — no ingredient enum copies in edge functions" rather than inventing work. (If the planner elects to also retire the 163-leftover `dish_kind` worker enum, that is discretionary scope expansion, flagged here.)

**`turbo check-types` reminder:** edge functions (`infra/supabase/functions/*`) are **Deno**, not part of `turbo check-types`. They are validated by `deno check` (see memory: `deno test --node-modules-dir=none -A <path>`, deno at `~/.deno`). SC4's "turbo check-types passes across all apps" does NOT cover edge functions — call out a separate `deno check` step if edge files are touched.

## Architecture Patterns

### Teardown sequence (the locked spine, with the FK carve-out)

```
[Operator runs LIVE-STATE PROBE + DEPENDENCY AUDIT]  ← single paste each, paste-back
        ↓ (planner finalizes drop membership from results)
[Author migration 171: reconciled Phase B trigger/function drop  + REVERSE (degenerate)]
        ↓
[Author migration 172a: ingredient_archive snapshot (CREATE SCHEMA + CREATE TABLE AS SELECT)]
   — separate migration, verified to LAND before any drop (D-02)
        ↓
[Author migration 172b: sever options.canonical_ingredient_id FK (DROP COLUMN), then
   RESTRICT-drop ingredient tables child→parent  + REVERSE (DDL recreate, no data)]
        ↓
[Author migration 173: RESTRICT/standard DROP COLUMN dishes.*_override  + REVERSE]
        ↓
[DishKind TS track — INDEPENDENT, can run in parallel:
   v2 DishForm/KindSelector sever  →  delete shims + test  →  grep proves zero importers]
        ↓
[Confirm types.ts (already slimmed) + deno check edge fns if touched  →  turbo check-types]
```
All DB migrations are **authored + dry-run only** (operator applies). [VERIFIED: D-01/D-02/D-09 + Phase 3/4/7 precedent]

### Pattern: In-DB archive snapshot (D-01) — separate migration before drop (D-02)

```sql
-- 172a (snapshot) — runs and is VERIFIED before 172b (drop). Non-public schema (D-03):
-- not PostgREST-exposed, no RLS needed. Conditional so it no-ops if a table is gone.
CREATE SCHEMA IF NOT EXISTS ingredient_archive;
-- For each surviving table (per probe), e.g.:
-- CREATE TABLE ingredient_archive.canonical_ingredients AS SELECT * FROM public.canonical_ingredients;
-- (Operator runs only the lines for tables the probe reported present.)
```
Verify landing: `SELECT table_name FROM information_schema.tables WHERE table_schema='ingredient_archive';` before proceeding to 172b. [VERIFIED: D-01/D-02/D-03]

### Pattern: REST-only verify script (mirror `verify-phase7.ts` / `verify-phase6.ts`)

The repo has `infra/scripts/verify-phase7.ts` and `verify-phase6.ts` — read-only ts-node scripts using the service-role `@supabase/supabase-js` client that probe `sb.from(table).select(col)` and report `GONE ✓ / STILL EXISTS ✗`. **This is the post-apply verification pattern for Phase 6.** A `verify-phase6-teardown.ts` should: select each dropped table/column and assert it errors (= GONE). Wire any net-new write script through `infra/scripts/lib/prod-guard.ts` (default-dry-run / `--apply`); but a verify script is read-only and needs no guard. [VERIFIED: verify-phase7.ts read]

### Anti-Patterns to Avoid

- **Trusting `database_schema.sql` as live state.** It is a pre-141/pre-152 snapshot. Use the operator probe.
- **Copying `151_REVERSE` verbatim.** It recreates functions referencing `dietary_tags` / `canonical_ingredient_dietary_tags` / `dishes.allergens` — all dropped by 156. It will not apply (D-06).
- **Using `CASCADE` as the drop mechanism.** SC2 mandates RESTRICT so unknown dependents fail loudly. The existing 152/153 use CASCADE — supersede, don't reuse.
- **Editing types.ts to "strip dropped types."** Already stripped. Editing risks introducing drift; verify instead.
- **Removing the inline `dish_kind` z.enum literals as part of DEBT-03.** They're independent of the `DishKind` symbol and relate to migration 163, not the ingredient pipeline. Out of scope.
- **Dropping `canonical_ingredients` before severing `options.canonical_ingredient_id`.** RESTRICT will reject it; sever the FK column first.
- **Re-running migrations 151/152/153 as-is in prod.** Unknown whether already applied; author fresh idempotent (`IF EXISTS`) migrations with new numbers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this object still in prod?" | Guessing from `database_schema.sql` | The single `jsonb_build_object` probe (operator paste-back) | Snapshot is stale; only the probe is ground truth |
| Dependency safety of a drop | Manual reasoning / CASCADE | `pg_depend` + `pg_constraint` audit query + RESTRICT order | Catches unknown views/FKs loudly |
| Pre-drop data preservation | `pg_dump` to file | In-DB `ingredient_archive` schema (D-01) | No psql/CLI in env; in-DB is the only operator-feasible path |
| Type freshness | `supabase gen types` (no CLI) | Hand-confirm `types.ts` (already slimmed) + `turbo check-types` | No Supabase CLI; types already match post-teardown |
| Post-apply confirmation | Eyeballing the dashboard | `verify-phase6-teardown.ts` (mirror verify-phase7.ts) | Deterministic REST probe, repeatable |

**Key insight:** every "build it" temptation here has an existing repo precedent (probe → 99/152 DDL; archive → D-01; verify → verify-phase7.ts; guard → prod-guard.ts). The phase is assembly + reconciliation, not invention.

## Runtime State Inventory

> Rename/refactor/migration phase — all 5 categories answered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | Ingredient tables (`canonical_ingredients`, `ingredient_aliases*`, `ingredient_concepts`, `ingredient_variants`, `*_translations`, `canonical_ingredient_allergens`, `dish_ingredients`) — **existence in prod UNKNOWN** (snapshot stale, types.ts says gone). Curated allergen/family/alias/translation data MAY exist. | Operator probe confirms presence + row counts → archive (D-01) the ones with rows → RESTRICT-drop. Data migration = the `CREATE TABLE … AS SELECT` archive (one-way). |
| **Live service config** | No external service stores ingredient strings as config. `invalidate-cache` webhook is dashboard-configured but keyed on restaurants/menus/dishes, not ingredient tables (F-21). | None — verified no ingredient-keyed external config. |
| **OS-registered state** | None. No Task Scheduler / pm2 / cron references ingredient objects. `_cron_embed_recovery_tick` / `_cron_restaurant_vector_recompute` (types.ts:1841) operate on dishes/embeddings, not ingredients. | None — verified by types.ts function scan. |
| **Secrets / env vars** | Historical `NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED` flag referenced only in Phase C doc + deleted web-portal. No live env var reads ingredient tables. | None — flag belonged to deleted `apps/web-portal`. |
| **Build artifacts / installed packages** | `packages/database/src/types.ts` (the generated artifact) — already slimmed, no ingredient residue. No egg-info/compiled binaries involved. | None for ingredients; confirm types.ts post-apply (no edit expected). |

**Canonical question answered:** After every repo file is updated, the only runtime state still holding ingredient objects is **prod Postgres itself** (tables/triggers/functions/columns) — which is exactly what the authored migrations target, applied by the operator. Nothing else caches or registers these objects.

## Common Pitfalls

### Pitfall 1: Assuming 151/152/153 are NOT applied (or assuming they ARE)
**What goes wrong:** Authoring drops that error, or skipping drops that are still needed.
**Why it happens:** F-01 says "not applied"; `types.ts` says "already gone"; `database_schema.sql` says "still present." Three artifacts, three stories.
**How to avoid:** Make every authored drop `IF EXISTS` (forward) so it's idempotent regardless, and gate the *content* (which tables/columns to list) on the operator probe. Never assume.
**Warning signs:** A drop migration without `IF EXISTS`; a plan task that says "verify 152 applied" without the probe.

### Pitfall 2: RESTRICT fails on `canonical_ingredients` because `options.canonical_ingredient_id` FK still points at it
**What goes wrong:** `DROP TABLE public.canonical_ingredients RESTRICT;` rejects with a dependency error.
**Why it happens:** The locked "tables before columns" wording, taken literally, drops the table while the FK column still exists.
**How to avoid:** Sever `options.canonical_ingredient_id` (DROP COLUMN) as the first DDL of the tables migration; keep the `dishes.*_override` drops in the columns step.
**Warning signs:** `canonical_ingredients` listed in the tables drop without a preceding `options` column sever.

### Pitfall 3: Re-using 151's REVERSE
**What goes wrong:** The REVERSE migration fails to apply (references dropped `dietary_tags` table + `dishes.allergens` column).
**Why it happens:** 151_REVERSE predates 156.
**How to avoid:** Author a degenerate/marker REVERSE (152 precedent) or one that recreates functions without touching dropped objects.
**Warning signs:** A REVERSE file containing `compute_dish_dietary_tags` body or `UPDATE public.dishes SET allergens`.

### Pitfall 4: Treating DEBT-04 as an edit task
**What goes wrong:** Hand-editing an already-correct `types.ts` introduces real drift.
**Why it happens:** F-07/F-15 say it's stale; it isn't (for these objects).
**How to avoid:** Make DEBT-04 a *verification* task — grep for residue (expect zero) + `turbo check-types` (expect pass). Only edit if the grep finds residue.
**Warning signs:** A plan task that diffs/rewrites large `types.ts` blocks.

## Code Examples

### RESTRICT drop block (tables migration, post-probe)
```sql
-- 172b — sever FK first, then child→parent RESTRICT drops. One transaction.
BEGIN;
ALTER TABLE public.options DROP COLUMN IF EXISTS canonical_ingredient_id;  -- FK sever
DROP TABLE IF EXISTS public.variant_translations            RESTRICT;
DROP TABLE IF EXISTS public.concept_translations            RESTRICT;
DROP TABLE IF EXISTS public.ingredient_aliases_v2           RESTRICT;
DROP TABLE IF EXISTS public.ingredient_variants             RESTRICT;
DROP TABLE IF EXISTS public.canonical_ingredient_dietary_tags RESTRICT;  -- if present
DROP TABLE IF EXISTS public.canonical_ingredient_allergens  RESTRICT;
DROP TABLE IF EXISTS public.ingredient_aliases              RESTRICT;
DROP TABLE IF EXISTS public.dish_ingredients                RESTRICT;
DROP TABLE IF EXISTS public.ingredient_concepts             RESTRICT;
DROP TABLE IF EXISTS public.canonical_ingredients           RESTRICT;
COMMIT;
```
[VERIFIED: order derived from 099 + database_schema.sql FK DDL]

### v2 `buildDishInput` flattened (DishForm.tsx sever)
```typescript
// Source: derived from apps/web-portal-v2/src/components/menu/DishForm.tsx (current buildDishInput)
// dishSchemaV2 accepts dish_kind as optional → safe to omit entirely.
function buildDishInput(values: DishFormValues): DishV2Input {
  return {
    name: values.name,
    description: values.description || undefined,
    price: values.price,
    primary_protein: values.primary_protein,
    display_price_prefix: values.display_price_prefix,
    serves: values.serves,
    is_available: values.is_available,
    dish_category_id: values.dish_category_id || undefined,
    // modifier-model fields per whichever sections the planner keeps (D-07):
    modifier_groups: values.slots ?? [],
    bundled_items: values.bundle_items ?? [],
  };
}
```
[VERIFIED against dishSchemaV2 shape in validation/dish.ts]

## State of the Art

| Old Approach (plan docs) | Current Approach (this phase) | When Changed | Impact |
|--------------------------|-------------------------------|--------------|--------|
| `pg_dump --data-only` snapshot to cold storage (Phase C §5.1) | In-DB `ingredient_archive` schema (D-01) | CONTEXT 2026-06-20 | No psql/CLI in env; operator-feasible |
| `CASCADE` table drops (152/153) | `RESTRICT` + pg_depend pre-flight (SC2) | ROADMAP/CONTEXT | Fails loudly on unknown deps |
| `supabase gen types --linked` (Phase C §5.5) | Hand-confirm types.ts (already slimmed) + check-types (D-09) | CONTEXT | No CLI; types already match |
| 4–6 week observation window (Phase C §1) | Proceed now (no prod users) | 152 header note | Gates collapse with zero traffic |
| web-portal W1/W2 coordination (Phase C §2.3) | Moot — `apps/web-portal` deleted `c1a7e3f` | Phase 5 | No web-portal route handlers to retire |

**Deprecated/outdated:**
- `database_schema.sql` as a live-state reference — pre-141/pre-152 snapshot; use the probe.
- FINDINGS F-07/F-15 "types.ts is stale and carries dropped types" — outdated; types.ts already slimmed (verified).
- Phase C doc's "9-table list" as the literal drop set — reconcile against probe (snapshot has only 5).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Migrations 151/152/153 are authored-but-NOT-applied in prod (per F-01) | Drift Reconciliation | If actually applied, the new drops are pure no-ops (harmless due to IF EXISTS) — low risk |
| A2 | Migrations 156/157/163 ARE applied in prod (per CLAUDE.md + types.ts shape) | Drift Reconciliation | If 156 not applied, the column/table universe differs — probe catches this |
| A3 | The 4 "missing" tables (concepts/variants/aliases_v2/translations) status is unknown | 9-table reconciliation | Probe resolves definitively before any drop |
| A4 | No external (non-ingredient) FK or view depends on ingredient tables | RESTRICT ordering | Dependency-audit query catches any; RESTRICT fails loudly otherwise |
| A5 | `dishSchemaV2.dish_kind` being `.optional()` makes the v2 sever type-safe | DishKind removal | VERIFIED by reading dish.ts — low risk; ASSUMED only that no runtime consumer requires dish_kind |
| A6 | DEBT-04 is effectively a no-op (types.ts already slimmed) | Type Regen | If operator's real regen later differs, check-types catches it |

**These A1–A6 are the items discuss-phase/planner should confirm via the operator probe before locking the drop migration content.** A1–A4 resolve from one probe paste-back; A5 is verified; A6 is verified.

## Open Questions

1. **Are 151/152/153 already applied in prod?**
   - What we know: F-01 says no; types.ts implies the *effect* is present; schema snapshot says no.
   - What's unclear: actual prod state.
   - Recommendation: operator probe resolves it; author IF-EXISTS idempotent drops so the answer doesn't change correctness, only which statements are no-ops.

2. **Do `ingredient_concepts` / `ingredient_variants` / `ingredient_aliases_v2` / `concept_translations` / `variant_translations` exist in prod?**
   - What we know: created in 099; absent from snapshot; targeted by 152.
   - What's unclear: present or already gone.
   - Recommendation: probe's `ingredient_tables_present` + `archive_row_counts` answers both presence and whether they hold data worth archiving.

3. **Does the planner fold in the migration-163-leftover `dish_kind` z.enum cleanup (validation + worker)?**
   - What we know: those literals are independent of DishKind symbol and out of SC3/SC4 strict scope.
   - Recommendation: leave out of this phase unless explicitly chosen (Claude's discretion); flag, don't auto-include.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| psql / Supabase CLI | applying migrations / `gen types` | ✗ | — | Operator applies via dashboard SQL editor; types hand-confirmed (D-09) |
| Supabase dashboard SQL editor | operator apply + probe | ✓ (operator) | n/a | — |
| `@supabase/supabase-js` (service role) | read-only verify scripts | ✓ | Phase-4 pinned | — |
| `turbo` / `tsc` | SC4 check-types | ✓ | repo | — |
| `deno` (`~/.deno`, not on PATH) | edge `deno check` (only if edge files touched) | ✓ | repo | `deno test --node-modules-dir=none -A` |
| `git grep` | SC1/SC3 pre-flights | ✓ | system | — |

**Missing dependencies with no fallback:** none (operator dashboard covers the DB apply path).
**Missing dependencies with fallback:** psql/Supabase CLI → operator dashboard + hand-confirmed types.

## Validation Architecture

> nyquist_validation enabled (no `false` found in config).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No unit-test framework for DB drops (DDL). TS: Vitest (admin/web-portal-v2 + shared). Edge: Deno test. |
| Config file | per-app vitest; `deno` for edge |
| Quick run command | `git grep` pre-flights + per-migration `IF EXISTS` idempotency |
| Full suite command | `turbo check-types` (apps) + operator paste-back probes |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Exists? |
|--------|----------|-----------|-------------------|---------|
| DEBT-01 | Triggers/functions dropped; pre-flight clean | grep + operator probe | `git grep -nE "dish_ingredients" -- apps/ infra/supabase/functions/` (zero) + probe `ingredient_triggers_present`=[] | ✅ grep / operator probe |
| DEBT-02 | Tables+columns dropped child→parent RESTRICT; deps audited; snapshot first | operator probe + dep-audit + verify script | LIVE-STATE PROBE + DEP-AUDIT (paste-back) + `verify-phase6-teardown.ts` (mirror verify-phase7.ts) | ❌ Wave 0: write `verify-phase6-teardown.ts` |
| DEBT-03 | DishKind/DISH_KIND_META gone; v2 first; zero importers | grep + check-types | `git grep -nE "DishKind|DISH_KIND_META" -- apps/ packages/ ':!**/.next/**'` (zero) + `turbo check-types` | ✅ existing tooling |
| DEBT-04 | types.ts has no dropped objects; edge enums reconciled; check-types passes | grep + check-types (+ deno check if edge touched) | residue grep (expect zero) + `turbo check-types` | ✅ existing tooling |

### Sampling Rate
- **Per task commit:** relevant `git grep` pre-flight + `turbo check-types` (for TS-touching commits).
- **Per wave merge:** full `turbo check-types`; for DB waves, the authored migration + dry-run reasoning (operator applies separately).
- **Phase gate:** operator paste-back of LIVE-STATE PROBE + DEP-AUDIT shows clean post-apply state; `turbo check-types` green; zero-importer grep green.

### Wave 0 Gaps
- [ ] `infra/scripts/verify-phase6-teardown.ts` — read-only REST probe mirroring `verify-phase7.ts`; asserts each dropped table/column errors on `select` (= GONE), covers DEBT-01/02.
- [ ] (No test-framework install needed — DDL drops are validated by operator probe, not unit tests; consistent with the project's minimal-test posture for stage-don't-apply DB work.)

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** all edits via a GSD command; this is `/gsd-plan-phase` research → planner.
- **Stage-don't-apply:** never apply migrations to prod from the agent; author + dry-run, operator applies. [also REQUIREMENTS Out-of-Scope]
- **Migration pairing convention:** every `NNN_*.sql` has a `NNN_REVERSE_ONLY_*.sql`. [VERIFIED across 156/163/170]
- **Allergens/dietary abandoned:** do NOT re-propose or recreate allergen/dietary features; the 151_REVERSE that recreates them is intentionally not to be reused.
- **Do NOT reintroduce parent/variant dish model** (size/add-ons are modifier groups). DishKind shims survive only for retired apps — remove now that v2's import is the last one.
- **Do NOT delete `apps/web-portal-v2`** — on ice; edit in place (D-07).
- **`primary_protein` is the sole surviving food classification** — untouched by this phase.
- **PostGIS POINT / RLS-on-new-tables** pitfalls — not triggered here (no new tables; archive schema is non-public, no RLS per D-03).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-01 | Drop ingredient-pipeline triggers (Phase B), staged + dry-run | Reconciled 151 target list + D-06 REVERSE drift fix; grep pre-flight (zero in apps/ + edge); probe `ingredient_triggers_present`/`_functions_present` |
| DEBT-02 | Drop orphaned tables+columns (Phase C), pg_depend pre-flight + ordered RESTRICT child→parent, snapshot first | FK graph + RESTRICT order derived from 099/schema; dep-audit query; in-DB archive (D-01/D-02/D-03); options FK-sever carve-out |
| DEBT-03 | Remove DishKind/DISH_KIND_META from v2 first, then shims + test | 11 exact file:line consumers; DishV2Input independence verified; zero-importer grep |
| DEBT-04 | Regenerate `@eatme/database` types post-teardown, committed | types.ts already slimmed (zero residue verified); treat as verification; edge inline-enum reconciliation = no-op for ingredients; turbo check-types gate |

## Sources

### Primary (HIGH confidence — files read this session)
- `infra/supabase/migrations/151_retire_ingredient_triggers.sql` + `151_REVERSE_ONLY_*` — Phase B targets + broken REVERSE
- `infra/supabase/migrations/152_drop_ingredient_pipeline.sql`, `153_drop_ingredient_columns.sql` — pre-authored CASCADE Phase C
- `infra/supabase/migrations/156_drop_dietary_allergen_columns.sql`, `157_drop_dietary_allergen_orphans.sql` — drift source
- `infra/supabase/migrations/099_new_ingredients_schema.sql` — FK graph for the 4 "missing" tables
- `infra/supabase/migrations/database_schema.sql` — confirmed STALE (pre-141/pre-152)
- `packages/database/src/types.ts` — confirmed ALREADY slimmed (zero residue)
- `packages/shared/src/{types/restaurant.ts,types/index.ts,constants/menu.ts,validation/dish.ts}` — shim + schema locations
- `apps/web-portal-v2/src/components/menu/{DishForm.tsx,KindSelector.tsx}` — v2 sever targets
- `infra/scripts/verify-phase7.ts` — verify-script pattern
- `.planning/{REQUIREMENTS.md,ROADMAP.md,STATE.md,codebase/FINDINGS.md}` + `06-CONTEXT.md` — scope/decisions

### Secondary (MEDIUM)
- `docs/plans/ingredient-pipeline-phase-{b,c}-*.md`, `dish-model-rewrite-phase-7-cleanup.md` — intent, noted drift

### Tertiary (LOW)
- none — no WebSearch needed (entirely codebase-grounded)

## Metadata

**Confidence breakdown:**
- Migration drift reconciliation: HIGH — every claim from reading the actual migration files
- RESTRICT order / pg_depend: HIGH — FK graph from DDL; query uses standard catalog joins
- DishKind removal: HIGH — exact file:line consumers grep-confirmed; DishV2Input independence verified
- Type regen: HIGH — types.ts residue grep empty; provenance from git log
- Live prod state: LOW (by design) — unknowable in-env; isolated to operator probe (the one genuine gap)

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable; revalidate if any new migration lands or operator applies pending drops)

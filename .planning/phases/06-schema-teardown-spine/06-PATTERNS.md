# Phase 6: Schema Teardown Spine - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 12 (5 create, 7 modify/verify)
**Analogs found:** 12 / 12

> Read with `06-RESEARCH.md` — research already pins exact file:line targets, the operator probe SQL, the RESTRICT drop order, and the DishKind consumer list. This map adds the **concrete code excerpts to copy from** per file. Where research and this map overlap, research is authoritative on *content membership* (gated on the operator probe); this map is authoritative on *form / convention*.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `<N>_retire_ingredient_triggers_reconciled.sql` + REVERSE | migration (DDL) | batch / transform (drop) | `151_retire_ingredient_triggers.sql` | exact (reconcile, don't copy) |
| `<N>_snapshot_ingredient_archive.sql` | migration (DDL) | file-I/O (CREATE TABLE AS SELECT) | none (new pattern) — DDL style from `156` | role-match |
| `<N>_drop_ingredient_tables_restrict.sql` + REVERSE | migration (DDL) | batch (drop) | `152_drop_ingredient_pipeline.sql` (SUPERSEDE — CASCADE→RESTRICT) | exact (contrast) |
| `<N>_drop_ingredient_columns_restrict.sql` + REVERSE | migration (DDL) | batch (drop) | `153` + `156` / `156_REVERSE` | exact |
| `infra/scripts/verify-phase6-teardown.ts` | utility (script) | request-response (REST probe) | `infra/scripts/verify-phase7.ts` | exact |
| `apps/web-portal-v2/.../KindSelector.tsx` | component | — | DELETE (no analog) | n/a |
| `apps/web-portal-v2/.../DishForm.tsx` | component | transform (form→DishV2Input) | self (sever in place) | n/a |
| `packages/shared/src/types/restaurant.ts` | model (types) | — | self (delete lines 26, 171) | n/a |
| `packages/shared/src/constants/menu.ts` | config (constants) | — | self (delete DISH_KIND_META :25) | n/a |
| `packages/shared/src/types/index.ts` | model (barrel) | — | self (delete re-export line) | n/a |
| `packages/shared/src/__tests__/dish-kinds.test.ts` | test | — | DELETE (no analog) | n/a |
| `packages/database/src/types.ts` | model (generated) | — | self — VERIFY only (already slimmed) | n/a |

---

## Pattern Assignments

### Migration header + pairing convention (ALL migrations)

**Source:** `infra/supabase/migrations/156_drop_dietary_allergen_columns.sql` (lines 1-42) and `163_phase7_coordinated_drop.sql` (lines 1-32).

Every forward file opens with a `-- NNN_name.sql` line, `-- Created: <date>`, a prose block stating **what it drops + why it is safe**, a **Pre-apply checklist**, and a **Reverse:** note clarifying schema-only restoration. Body is wrapped `BEGIN; … COMMIT;` with `── (n) section ──` comment banners. Every `NNN_*.sql` has a paired `NNN_REVERSE_ONLY_*.sql` (verified across 156/163/170). Copy this header skeleton verbatim into each Phase 6 forward + reverse file.

---

### `<N>_retire_ingredient_triggers_reconciled.sql` (Phase B — DEBT-01)

**Analog:** `151_retire_ingredient_triggers.sql` — **reconcile, do NOT copy** (D-06; its REVERSE is broken post-156).

**Forward drop pattern to retain** (151 lines 56-74) — triggers before functions, `IF EXISTS` throughout, drop dependency-deep functions before their callees:
```sql
BEGIN;
-- Triggers first (must come before the functions they call).
DROP TRIGGER IF EXISTS dish_ingredients_refresh        ON public.dish_ingredients;
DROP TRIGGER IF EXISTS dishes_override_refresh          ON public.dishes;
DROP TRIGGER IF EXISTS trg_enrich_on_ingredient_change ON public.dish_ingredients;
DROP FUNCTION IF EXISTS public.trg_dish_ingredients_refresh();
DROP FUNCTION IF EXISTS public.trg_dishes_override_refresh();
DROP FUNCTION IF EXISTS public.refresh_dish_dietary(uuid);
DROP FUNCTION IF EXISTS public.compute_dish_allergens(uuid);
DROP FUNCTION IF EXISTS public.compute_dish_dietary_tags(uuid);
COMMIT;
```
**Reconciliation (D-06):** forward set is whatever the operator probe's `ingredient_triggers_present` / `ingredient_functions_present` confirms still exists — a subset of the above (156's CASCADE may have already removed some). `IF EXISTS` makes the full list harmless/idempotent regardless.

**REVERSE — use the 152 "minimal/degenerate reverse" precedent, NOT 151's.** 151's REVERSE recreates `compute_dish_dietary_tags` (queries dropped `dietary_tags`/`canonical_ingredient_dietary_tags`) and `refresh_dish_dietary` (writes dropped `dishes.allergens`/`dietary_tags`) — it will fail to apply. The degenerate-reverse pattern (from `152_REVERSE`, described in 152 header lines 27-30): a marker-only reverse that documents irreversibility rather than recreating objects that reference dropped columns/tables.

---

### `<N>_snapshot_ingredient_archive.sql` (D-01/D-02/D-03)

**Analog:** no direct precedent; DDL style from `156`. Separate migration, **verified to land BEFORE** the drop (D-02), into a non-`public` schema (D-03, no RLS, no PostgREST exposure).

```sql
CREATE SCHEMA IF NOT EXISTS ingredient_archive;
-- One CREATE TABLE AS SELECT per table the probe reported present, e.g.:
-- CREATE TABLE ingredient_archive.canonical_ingredients AS SELECT * FROM public.canonical_ingredients;
```
Landing-check (operator runs before the drop migration):
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'ingredient_archive';
```
Membership = the "snapshot-then-drop" list in RESEARCH.md §"Authoritative reconciled drop list", filtered to tables the probe shows present with rows > 0.

---

### `<N>_drop_ingredient_tables_restrict.sql` + REVERSE (Phase C tables — DEBT-02)

**Analog to SUPERSEDE:** `152_drop_ingredient_pipeline.sql` — same table set + ordering instinct, but **152 uses `CASCADE` (lines 39-47); SC2 mandates `RESTRICT`.** The contrast:
```sql
-- 152 (DO NOT REUSE — CASCADE):
DROP TABLE IF EXISTS public.variant_translations CASCADE;
-- Phase 6 (RESTRICT — fails loudly on unknown dependents):
DROP TABLE IF EXISTS public.variant_translations RESTRICT;
```
**FK-sever carve-out (research Pitfall 2):** the FIRST statement must sever `options.canonical_ingredient_id` or `canonical_ingredients` can't drop under RESTRICT:
```sql
BEGIN;
ALTER TABLE public.options DROP COLUMN IF EXISTS canonical_ingredient_id;  -- FK sever, first
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
(Full ordering rationale: RESEARCH.md §"Provably-safe RESTRICT child→parent DROP order".)

**Pre-flight guard precedent** (from `163` lines 36-67): a `DO $guard$ … RAISE EXCEPTION` block aborts loudly if state is unexpected. For Phase 6 the equivalent loud-failure mechanism is the operator-run pg_depend audit + RESTRICT itself (no in-migration row-count guard needed since tables are being dropped, not converted).

**REVERSE — DDL recreate, no data** (D-05). Mirror `156_REVERSE_ONLY` (lines 14-44): `CREATE TABLE IF NOT EXISTS public.<t> ( … )` recreating structure verbatim, FKs to surviving parents only (156_REVERSE lines 8-12 show the pattern of dropping an FK whose parent is gone). Data restoration is a separate manual `INSERT … SELECT FROM ingredient_archive` — never baked into the reverse.

---

### `<N>_drop_ingredient_columns_restrict.sql` + REVERSE (Phase C columns — DEBT-02)

**Analog:** `153_drop_ingredient_columns.sql` (forward) + `156_REVERSE_ONLY` (reverse form). Note `options.canonical_ingredient_id` moves to the *tables* migration's first statement (FK sever); this migration handles the remaining dead `dishes.*_override` columns.

Forward (153 lines 21-29 pattern, scoped to what survives):
```sql
BEGIN;
ALTER TABLE public.dishes
  DROP COLUMN IF EXISTS allergens_override,
  DROP COLUMN IF EXISTS dietary_tags_override;
COMMIT;
```
Reverse — `ADD COLUMN IF NOT EXISTS` with original defaults (156_REVERSE lines 46-62):
```sql
ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS allergens_override    text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS dietary_tags_override text[] DEFAULT ARRAY[]::text[];
```

---

### `infra/scripts/verify-phase6-teardown.ts` (DEBT-02 post-apply check)

**Analog:** `infra/scripts/verify-phase7.ts` — copy structure directly. Read-only, **no prod-guard needed** (guard is for write scripts only).

Header + client (verify-phase7 lines 1-16):
```typescript
#!/usr/bin/env ts-node
/** verify-phase6-teardown.ts — READ-ONLY. Confirms the ingredient teardown is live. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;
```
Column-gone probe (verify-phase7 lines 22-32) — selecting a dropped column must error:
```typescript
for (const col of ['allergens_override', 'dietary_tags_override']) {
  const { error } = await sb.from('dishes').select(col).limit(1);
  console.log(`dishes.${col.padEnd(20)}: ${error ? 'GONE ✓' : 'STILL EXISTS ✗'}`);
}
const { error: optErr } = await sb.from('options').select('canonical_ingredient_id').limit(1);
```
Table-gone probe (verify-phase7 lines 35-39):
```typescript
for (const t of ['dish_ingredients','canonical_ingredients','ingredient_aliases',
                 'ingredient_aliases_v2','ingredient_concepts','ingredient_variants',
                 'concept_translations','variant_translations','canonical_ingredient_allergens']) {
  const { error } = await sb.from(t).select('id').limit(1);
  console.log(`table ${t.padEnd(32)}: ${error ? 'GONE ✓' : 'STILL EXISTS ✗'}`);
}
```
Close with the `(read-only — nothing written)` banner (verify-phase7 line 110). Run via `cd infra/scripts && pnpm exec ts-node verify-phase6-teardown.ts`.

---

### DishKind shim removal (DEBT-03 / SC3) — v2 importers FIRST, then `@eatme/shared`

**Order is locked (D-08):** sever v2, then delete shims, then grep proves zero importers.

**`apps/web-portal-v2/src/components/menu/KindSelector.tsx`** — DELETE whole file (D-07).

**`apps/web-portal-v2/src/components/menu/DishForm.tsx`** — sever per RESEARCH.md exact-consumer table (lines 5, 19, 60, 71-111, 134, 223-254). Target `buildDishInput` shape (RESEARCH.md §"v2 buildDishInput flattened"):
```typescript
function buildDishInput(values: DishFormValues): DishV2Input {
  return { name: values.name, description: values.description || undefined,
    price: values.price, primary_protein: values.primary_protein,
    display_price_prefix: values.display_price_prefix, serves: values.serves,
    is_available: values.is_available,
    dish_category_id: values.dish_category_id || undefined,
    modifier_groups: values.slots ?? [], bundled_items: values.bundle_items ?? [] };
}
```
Safe because `dishSchemaV2.dish_kind` is `.optional()` (verified `validation/dish.ts:56`) — omitting it still validates. Keep `DishV2Input` / `PRIMARY_PROTEINS` imports; drop only `type DishKind`.

**`packages/shared/src/types/restaurant.ts`** — delete `export type DishKind = …` (line 26, with its `@deprecated` JSDoc lines 18-25) and the legacy `dish_kind?: DishKind;` field (line 171).

**`packages/shared/src/constants/menu.ts`** — delete `export const DISH_KIND_META = {…}` (lines 25-31, with `@deprecated` JSDoc lines 14-24). **Keep** `DINING_FORMATS` / `DINING_FORMAT_META` directly below (lines 33+).

**`packages/shared/src/types/index.ts`** — delete the `DishKind,` line from the re-export block (research: line 3).

**`packages/shared/src/__tests__/dish-kinds.test.ts`** — DELETE whole file.

**Proof (SC3):** `git grep -nE "\bDishKind\b|\bDISH_KIND_META\b" -- 'apps/**' 'packages/**' ':!**/.next/**' ':!**/__tests__/**'` returns ZERO.

**Out of scope (do NOT touch):** inline `dish_kind: z.enum([...])` literals at `validation/dish.ts:56`, `validation/menuScan.ts:41/97`, `validation/restaurant.ts:65`, `functions/menu-scan-worker/index.ts:101` — independent of the `DishKind` symbol, relate to migration 163, not this phase.

---

### `packages/database/src/types.ts` (DEBT-04) — VERIFY, do NOT edit

**Analog:** self. Research verified zero residue (no ingredient tables, no `*_override`, no `canonical_ingredient_id`, no `dish_kind`). Treat as a **verification task** (research Pitfall 4):
```bash
grep -nE "dish_ingredients|canonical_ingredient|ingredient_aliases|ingredient_concepts|ingredient_variants|allergens_override|dietary_tags_override|canonical_ingredient_id|dish_kind" packages/database/src/types.ts
# expect ZERO
turbo check-types   # backstop gate (SC4)
```
Only edit if the grep finds residue (it won't). `@eatme/shared`/`@eatme/database` have no `check-types` script — a broken edit surfaces in `apps/admin` / `apps/web-portal-v2` `tsc`.

---

## Shared Patterns

### Migration pairing + header
**Source:** `156` (lines 1-42), `163` (lines 1-32). **Apply to:** every Phase 6 migration. `NNN_*.sql` + `NNN_REVERSE_ONLY_*.sql`; prose "what/why-safe" + "Pre-apply checklist" + "Reverse:" note; `BEGIN; … COMMIT;`; `── (n) ──` banners.

### Idempotent forward drops
**Source:** `151`/`152`/`153`/`156` (all use `IF EXISTS`). **Apply to:** every forward drop. `DROP {TABLE|TRIGGER|FUNCTION|COLUMN} IF EXISTS` so the migration is correct whether or not 151/152/153 were already applied (the central A1 unknown).

### Schema-only REVERSE
**Source:** `156_REVERSE_ONLY` (lines 14-62), `152_REVERSE` (marker-only, header lines 27-30). **Apply to:** every Phase 6 reverse. Recreate structure (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`); never recreate functions referencing dropped objects; data restoration is a separate manual `INSERT … SELECT` step.

### Read-only REST verify script
**Source:** `verify-phase7.ts`. **Apply to:** `verify-phase6-teardown.ts`. `sb.from(x).select(col).limit(1)` → `error ? 'GONE ✓' : 'STILL EXISTS ✗'`. No prod-guard (read-only).

### prod-guard (reference only)
**Source:** `infra/scripts/lib/prod-guard.ts` (`parseGuard` lines 67-91, `announceTarget` lines 99-107). **Apply to:** any net-new WRITE script (none planned this phase — all DB writes are operator-applied). Listed so the planner does not wire it into the read-only verify script by mistake.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `<N>_snapshot_ingredient_archive.sql` | migration | file-I/O | No prior `CREATE SCHEMA` / archive migration in repo; uses plain DDL style from `156` + the D-01 `CREATE TABLE AS SELECT` shape from RESEARCH.md |

---

## Metadata

**Analog search scope:** `infra/supabase/migrations/`, `infra/scripts/` (+ `lib/`), `packages/shared/src/`, `packages/database/src/`, `apps/web-portal-v2/src/components/menu/`
**Files scanned (read this session):** 151, 152, 153, 156, 156_REVERSE, 163, verify-phase7.ts, prod-guard.ts, constants/menu.ts, types/restaurant.ts; migration directory listing
**Pattern extraction date:** 2026-06-20

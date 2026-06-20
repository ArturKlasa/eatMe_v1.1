# Phase 6: Schema Teardown Spine - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute the one strictly-ordered, irreversible-aware teardown of the orphaned ingredient pipeline and the now-isolated `DishKind` shims, then regenerate the DB types exactly once to match the slimmed schema. The sequence is fixed and must not be reordered:

**Phase B (triggers)** → **Phase C (tables)** → **Phase C (columns)** → **DishKind shim removal (v2 first, then `@eatme/shared`)** → **single type regen**.

All DB work is **authored + dry-run only** (stage-don't-apply); the operator applies in prod via the Supabase dashboard SQL editor. Discussion clarifies *how* each step is executed and handed off — it does not change the locked sequence or the four success criteria.

**In scope:** DEBT-01 (drop triggers, Phase B), DEBT-02 (drop tables then columns, Phase C), DEBT-03 (`DishKind`/`DISH_KIND_META` shim removal), DEBT-04 (single post-teardown type regen).
**Out of scope:** deleting `apps/web-portal-v2` (on-ice, edit in place only); reviving any ingredient-level feature on the modifier model; touching `dishes.protein_canonical_names` (not part of the ingredient pipeline).

</domain>

<decisions>
## Implementation Decisions

### Snapshot mechanism (Phase C pre-drop)
- **D-01:** The required pre-drop data snapshot is an **in-DB archive schema**, not a `pg_dump`/file export. The operator runs one SQL block in the dashboard editor: `CREATE SCHEMA ingredient_archive;` then `CREATE TABLE ingredient_archive.<t> AS SELECT * FROM public.<t>;` for all archived ingredient tables. Chosen because the operator is dashboard/REST-only (no psql/prod shell) and the data is low-value abandoned-pipeline curation work with no production users.
- **D-02:** The archive runs as a **separate snapshot migration**, executed and verified to exist **before** the drop migration — never inside the same transaction as the `DROP` (so a failed drop can't roll back the archive, and the archive landing is confirmed first).
- **D-03:** The `ingredient_archive` schema lives in a **non-`public` schema**, so it is not PostgREST-exposed — no API surface, no RLS policy needed on the archive tables.
- **D-04:** Retention: **keep the archive schema indefinitely in-DB**, no scheduled cleanup in this phase (in-DB storage is negligible; a later cleanup phase can drop it).

### Phase C reversibility
- **D-05:** Each Phase C drop migration gets a paired **`_REVERSE_ONLY_` file that recreates the dropped table/column structure (DDL only)** — keeping the repo's every-migration-has-a-reverse convention (the 163 precedent). Data restoration is a **separate manual step** from `ingredient_archive` (`INSERT ... SELECT`), not baked into the reverse file. Phase C is still treated as effectively one-way for planning purposes (data is not auto-restored).
- **D-06:** The existing **migration 151** (authored Phase B) and its REVERSE must be **reconciled against actual post-156 prod state**, not taken as-is. Migration 156 (abandon-allergens, applied) dropped `dietary_tags` / `canonical_ingredient_dietary_tags` / `allergens` and the override columns — so 151's REVERSE currently recreates functions referencing now-dropped objects (stale/broken), and 156's CASCADE may have already removed some of 151's forward targets. Phase B must verify live trigger/function state (git-grep pre-flight + a prod-state check) and correct 151 + its reverse accordingly.

### web-portal-v2 DishKind shim removal
- **D-07:** **Cut the kind selector entirely** from v2 (it is on-ice; `dish_kind` is a documented legacy affordance that "no longer drives shape" post the Phase-3 flat-schema collapse). Concretely: delete `apps/web-portal-v2/src/components/menu/KindSelector.tsx`, and remove the `dish_kind` field + the kind-switch transform from `apps/web-portal-v2/src/components/menu/DishForm.tsx` so the form produces a flat dish matching the real post-163 model. Minimal sever that also aligns paused code with reality (less code than inlining a local constant; leaves v2 cleaner for revival).
- **D-08:** Removal order per SC3: **v2 importers first**, then delete the shims from `@eatme/shared` — `DishKind` (`packages/shared/src/types/restaurant.ts:26`), `DISH_KIND_META` (`packages/shared/src/constants/menu.ts:25`), the legacy `dish_kind?: DishKind` shim field (`packages/shared/src/types/restaurant.ts:171`), the re-export in `packages/shared/src/types/index.ts`, and `packages/shared/src/__tests__/dish-kinds.test.ts`. Verify with a consumer grep showing zero remaining importers (ignore `.next/` build artifacts). Note: `DishV2Input` is Zod-derived (`validation/dish.ts`) and does not reference the `DishKind` type symbol — confirm `dishSchemaV2`'s handling of any `dish_kind` field during planning.

### Type regen (DEBT-04)
- **D-09:** **Hand-edit `packages/database/src/types.ts` in-repo** to strip the dropped tables + columns, staged with the migrations in this phase (Phase 7 precedent — there is no Supabase CLI in this env). Deterministic and reviewable in the diff; `turbo check-types` (SC4) is the gate that catches any dangling reference. Not gated on the operator running `supabase gen types`.
- **D-10:** Reconcile **inline edge-function enum copies** as part of the type pass (SC4) — locate hardcoded enum/type duplications of dropped DB objects in `infra/supabase/functions/*` and update them so they match the slimmed schema.

### Claude's Discretion
- Commit / sequencing structure within the locked spine (e.g., code-first-then-SQL per the Phase 7 precedent; one logical change per atomic commit). The DishKind track (TS-only, no DB) is independent of the schema track and may be committed separately.
- Exact `pg_depend` dependency-audit query shape and the git-grep pre-flight commands (SC1/SC2 mandate them; form is Claude's).
- Which specific tables land in the `ingredient_archive` snapshot vs. are trivially droppable (the planner reconciles the Phase C doc's 9-table list against what 156's CASCADE already removed).
- Exact migration numbers (next available after 170).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 scope + success criteria
- `.planning/ROADMAP.md` § "Phase 6: Schema Teardown Spine" — the 4 success criteria (SC1 triggers+grep, SC2 tables→columns RESTRICT + pg_depend + snapshot one-way, SC3 v2-first shim removal, SC4 single type regen + check-types).
- `.planning/REQUIREMENTS.md` — DEBT-01, DEBT-02, DEBT-03, DEBT-04.
- `.planning/codebase/FINDINGS.md` — F-01 (ingredient orphaned schema, confirmed), F-02 (DishKind shims, last importer is v2 KindSelector), F-05 (v2 on-ice, do NOT delete), F-07/F-15 (types.ts stale, regen ONCE post-teardown).

### Ingredient teardown plans (read for scope, but note drift)
- `docs/plans/ingredient-pipeline-phase-b-trigger-retirement.md` — Phase B: which triggers/functions to drop. **Drift:** pre-dates the abandon-allergens removal; reconcile against migration 156.
- `docs/plans/ingredient-pipeline-phase-c-schema-retirement.md` — Phase C: table/column drop list, snapshot, verification. **Drift (important):** its `CASCADE` drops are overridden by SC2 (`RESTRICT`); the W1/W2 web-portal coordination (§2.3/§4.3/§5.6) is **moot** — `apps/web-portal` is already deleted; its "what survives" list (§3) is **stale** — 156 already dropped `options.adds_allergens`/`removes_dietary_tags` and the dishes allergen/dietary columns; its `pg_dump` snapshot (§5.1) is superseded by D-01 (in-DB archive).
- `docs/plans/dish-model-rewrite-phase-7-cleanup.md` — DishKind shim context + the code-first / SQL-second migration pattern precedent (and the prior decision to defer shim removal to "web-portal retirement," which is now reachable).

### Existing authored migrations (reconcile, don't assume)
- `infra/supabase/migrations/151_retire_ingredient_triggers.sql` + `151_REVERSE_ONLY_*` — the authored Phase B; REVERSE is stale post-156 (see D-06).
- `infra/supabase/migrations/156_drop_dietary_allergen_columns.sql` + REVERSE — what the abandon-allergens work already dropped (the drift source).
- `infra/supabase/migrations/database_schema.sql` — current schema snapshot (still lists `dish_ingredients`, `canonical_ingredients`, `canonical_ingredient_allergens`, `ingredient_aliases`, etc.); cross-check against live prod, not just this file.

### Project conventions
- `CLAUDE.md` § "Dish Classification" / "Allergens & Dietary Tags — Abandoned" / "Dish Model — Modifier Groups" — establishes the ingredient pipeline + DishKind as retired, and that shims survive "only for the retired apps; remove when that app is deleted."

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets / Patterns
- **Migration pairing convention:** every migration has `NNN_*.sql` + `NNN_REVERSE_ONLY_*.sql` (see 156, 163, 170). Phase 6 follows this (D-05).
- **Stage-don't-apply handoff:** Phases 3/4/7 authored migrations + dry-run, then handed the operator a dashboard-apply + verify checklist. Phase 6 reuses this; `infra/scripts` verify-style read-only scripts (e.g. `verify-phase7.ts`) are the post-apply check pattern.
- **`infra/scripts/lib/prod-guard.ts`** (Phase 4) — default-dry-run / `--apply` / announce-ref guard; any net-new script in this phase should wire through it.

### Integration Points
- `packages/database/src/types.ts` (3226 lines) — hand-edited target for D-09.
- `packages/shared/src/types/restaurant.ts` (DishKind def + legacy field), `packages/shared/src/constants/menu.ts` (DISH_KIND_META), `packages/shared/src/types/index.ts` (re-export), `packages/shared/src/__tests__/dish-kinds.test.ts` — shim removal targets (D-08).
- `apps/web-portal-v2/src/components/menu/{KindSelector,DishForm}.tsx` — v2 import severance (D-07), edited in place (do NOT delete the app).
- `infra/supabase/functions/*` — inline enum copies to reconcile (D-10).

### Constraints
- No psql / Supabase CLI in this env (REST-only); operator applies migrations via dashboard SQL editor. Drives D-01 (in-DB archive) and D-09 (hand-edit types).
- `turbo check-types` is the cross-app regression gate (SC4). Note: `apps/mobile` is excluded from `turbo check-types` — use `cd apps/mobile && npx tsc --noEmit` if mobile types are touched (they shouldn't be in this phase).

</code_context>

<specifics>
## Specific Ideas

- Honor SC2's `RESTRICT` over the Phase C doc's `CASCADE` — drops must fail loudly on an unexpected dependency, with the `pg_depend` audit run first; `CASCADE` is not the load-bearing mechanism.
- The `ingredient_archive` schema name is the intended snapshot target (D-01); recreate-structure REVERSE files restore into `public`, data flows back from `ingredient_archive` manually.

</specifics>

<deferred>
## Deferred Ideas

- Dropping the `ingredient_archive` schema itself — a future cleanup once the teardown is confirmed stable (D-04 keeps it indefinitely for now).
- Any revival of ingredient-level UX — explicitly out of scope and abandoned (would be rebuilt fresh on the modifier model, not restored).
- `dishes.protein_canonical_names` — left untouched; it is derived from `primary_protein`, not the ingredient pipeline (Phase C doc §4.2).

</deferred>

---

*Phase: 06-schema-teardown-spine*
*Context gathered: 2026-06-20*

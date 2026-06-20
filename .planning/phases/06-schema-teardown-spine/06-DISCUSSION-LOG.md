# Phase 6: Schema Teardown Spine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 6-schema-teardown-spine
**Areas discussed:** Snapshot mechanism, Phase C reversibility, web-portal-v2 shim removal, Type regen mechanism

---

## Snapshot mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| In-DB archive schema | `CREATE SCHEMA ingredient_archive` + `CREATE TABLE AS SELECT` ×9 in dashboard editor, run+verified before the drop. Dashboard-native, satisfies SC2, no external tooling. | ✓ |
| ts-node REST export to file | Self-contained infra/scripts export (service-role + prod-guard) to committed JSON/SQL. Off-box, version-controlled. | |
| Both: archive + export | In-DB archive + committed file export. Maximum insurance. | |
| Skip real snapshot | Accept data-loss (abandoned pipeline, no users); rely on git-tracked schema recreate. | |

**User's choice:** In-DB archive schema
**Notes:** Operator is dashboard/REST-only; data is low-value abandoned curation work with no production users. Archive in a non-public schema (not PostgREST-exposed → no RLS). Runs as a separate snapshot migration, verified before the drop. Retention: keep indefinitely in-DB, no cleanup this phase.

---

## Phase C reversibility

| Option | Description | Selected |
|--------|-------------|----------|
| Author REVERSE_ONLY (schema only) | Each Phase C migration gets a `_REVERSE_ONLY_` recreating structure (DDL only); data restore is a separate manual step from the archive. Matches 163 precedent. | ✓ |
| REVERSE_ONLY that restores from archive | Reverse recreates structure AND re-populates via `INSERT ... SELECT FROM ingredient_archive`. Couples reverse to the snapshot. | |
| Genuinely no reverse | No reverse file; the archive is the sole restore path. Breaks the every-migration-has-a-reverse convention. | |

**User's choice:** Author REVERSE_ONLY (schema only)
**Notes:** Surfaced that migration 151's existing REVERSE is now stale post-156 (references dropped `dietary_tags`/`canonical_ingredient_dietary_tags`); Phase B must reconcile 151 + its reverse against actual prod state rather than taking it as-is.

---

## web-portal-v2 shim removal

| Option | Description | Selected |
|--------|-------------|----------|
| Cut the selector entirely | Delete KindSelector.tsx; remove `dish_kind` field + kind-switch from DishForm.tsx → flat dish matching post-163 model. Minimal sever, aligns paused code with reality. | ✓ |
| Inline a v2-local constant | Keep the selector UI; move kind labels/values into a v2-local const. Preserves v2 behavior; duplicates a dead constant. | |
| Full modifier-group refactor | Properly migrate v2 off dish_kind. Real v2 product work; out of scope for teardown. | |

**User's choice:** Cut the selector entirely
**Notes:** v2 is on-ice; in-file comment says `dish_kind` "no longer drives shape." Scope confirmed tight: DishKind/DISH_KIND_META defined only in @eatme/shared; only app consumer is v2 KindSelector + DishForm; DishV2Input is Zod-derived (no DishKind type symbol). Order: v2 importers first, then delete shims + test from @eatme/shared.

---

## Type regen mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-edit types.ts in-repo | Manually strip dropped tables/columns from packages/database/src/types.ts, staged with the migrations (Phase 7 precedent). `turbo check-types` is the gate. | ✓ |
| Operator runs supabase gen types | Operator runs `supabase gen types --linked` post-apply and pastes back. Authoritative but lags the prod apply; needs operator CLI. | |
| Hand-edit now + operator reconcile | Stage hand-edit now; operator optionally reconciles via CLI post-apply. | |

**User's choice:** Hand-edit types.ts in-repo
**Notes:** No Supabase CLI in this env; matches stage-don't-apply. Also reconcile inline edge-function enum copies as part of the same type pass (SC4).

---

## Claude's Discretion

- Commit/sequencing structure within the locked spine (code-first-then-SQL per Phase 7; DishKind TS track independent of the schema track).
- `pg_depend` audit + git-grep pre-flight command shapes.
- Which tables land in the archive vs. trivially droppable (reconcile Phase C doc's 9-table list against what 156 already removed).
- Exact migration numbers (next available after 170).

## Deferred Ideas

- Dropping the `ingredient_archive` schema itself — future cleanup once teardown is stable.
- Reviving ingredient-level UX — out of scope / abandoned.
- `dishes.protein_canonical_names` — left untouched (derived from primary_protein, not the ingredient pipeline).

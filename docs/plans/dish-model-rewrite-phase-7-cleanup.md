# Phase 7 — Cleanup

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Proposed — ⚠ this doc predates the 2026-06-05 Phase 6 reconciliation and is partially stale. The authoritative scope for the column drop + DB-function rewrites is **`dish-model-rewrite-phase-6-data-migration.md` §6** (coordinated cutover: `generate_candidates` DROP+CREATE, `admin_confirm_menu_scan` legacy-branch removal, `get_group_candidates` + `embed_recovery_cron` filter cuts, feed/mobile/admin consumer swaps, then the table/column drops — all in one migration, numbered 161+). The `price_per_person` item below is obsolete: it is a never-rendered generated column; callers were already removed in Phase 6 §5 with **no replacement** (`effective_serves` does not exist). ⚠ `admin_confirm_menu_scan` is under active change in the menu-scan work lane — author its rewrite from the live function body at cutover time.
**Last updated:** 2026-06-11 (status note only; list below unedited)
**Estimated wall time:** 1 day
**Reversibility:** Safe after Phase 6 monitoring window (4–6 weeks). All removals target code paths no longer exercised after the destructive cutover.

Run 4–6 weeks after Phase 6, once stability is confirmed.

---

## 1. Code removals

- Delete `apps/admin/src/app/(admin)/menu-scan/[jobId]/VariantEditor.tsx`.
- Delete `apps/admin/src/app/(admin)/menu-scan/[jobId]/CourseEditor.tsx`.
- Delete `apps/mobile/src/screens/restaurant-detail/DishGrouping.ts`.
- Delete `apps/mobile/src/screens/restaurant-detail/VariantPickerSheet.tsx` (or repurpose as a generic "configuration sheet" if useful).
- Remove `@deprecated` shims from `packages/shared`: `DISH_KIND_META`, `DISH_KINDS`, `DishKind` type, `parent_dish_id` / `is_parent` / `is_template` on `Dish` interface.
- Remove legacy filter clauses in `generate_candidates` (`is_parent = false`, `is_template = false`).
- Remove `parent_dish_id` special-case from `applyDiversity` in `infra/supabase/functions/feed/index.ts` (kept during Phases 2–6 transition per `phase-2-backend.md` §3; references a column that no longer exists after migration 150).
- Audit + replace all callers of `price_per_person` (grep across repo, replace with `effective_price / effective_serves` at point of use).
- Regenerate `@eatme/database` types.

## 2. Effort: 1 day

# Phase 7 — Cleanup

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Proposed
**Last updated:** 2026-05-17
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

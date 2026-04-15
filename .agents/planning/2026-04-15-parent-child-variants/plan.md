# Parent-Child Variant UI — Implementation Plan

**Scope**: Close the gap between DB schema (migration 073) and end-user functionality. DB + menu-scan create parent-child dish trees; admin form and mobile app treat dishes as flat.

**Context**: See `/home/art/Documents/eatMe_v1/CLAUDE.md` for stack. Migration 073 added `dishes.parent_dish_id`, `is_parent`, `serves`, `price_per_person`. `generate_candidates()` excludes parents (`is_parent=false`). Menu-scan confirm (`apps/web-portal/app/api/menu-scan/confirm/route.ts:128–198`) already persists parent-child correctly.

---

## Deliverables

### A. Web admin: manual variant CRUD

**Files**
- `apps/web-portal/components/forms/dish/DishVariantsSection.tsx` (new) — editable list of child variants when `dish_kind ∈ {template, combo, experience}` or `serves > 1`. Name, price, serves, display_price_prefix per variant.
- `apps/web-portal/components/forms/DishFormDialog.tsx` — render `DishVariantsSection` after `DishKindSelector`; pass `variants[]` state through.
- `apps/web-portal/lib/hooks/useDishFormData.ts` — on submit, if `is_parent=true`:
  - Insert/update parent with `is_parent=true`, `price=0`
  - Delete removed variants, upsert remaining with `parent_dish_id = parent.id`, `is_parent=false`
  - Reuse the existing `dish_ingredients`/`option_groups` sync logic per variant
- `apps/web-portal/app/admin/restaurants/[id]/menus/page.tsx` — dish list: render parent with expanded variants row (use existing `parent_dish_id`/`is_parent` columns already in the query).

**Tests** (`apps/web-portal/test/`)
- `DishVariantsSection.test.tsx` — add/remove variants; wizard-mode round-trip
- `useDishFormData.variants.test.ts` — parent save inserts children correctly; edit deletes removed variants

### B. Mobile: variant picker

**Files**
- `apps/mobile/src/components/VariantPickerSheet.tsx` (new) — bottom sheet listing variants with price diffs; selected variant flows to caller via `onSelect`.
- `apps/mobile/src/services/geoService.ts` — `NearbyRestaurant.dishes` query already returns all dishes. Add a client-side grouping helper (extend existing `DishGrouping.ts:32–62`).
- Feed entry points (wherever a dish card handles tap): if tapped dish `is_parent=true`, open `VariantPickerSheet` before triggering the rating/eat-together/detail flow. Resolve to the picked child dish id for all downstream state.
- `apps/mobile/src/screens/restaurant-detail/RestaurantDetailScreen.tsx` — menu list groups parent+children using existing `groupDishesByParent`; tapping parent opens picker, tapping standalone works as today.

### C. Feed surfacing of parent dishes

**Decision needed**: either
- **(1)** Keep `generate_candidates()` filtering parents; surface a "representative" child (cheapest) with badge `from $X`. Simpler query — one child per parent visible in feed.
- **(2)** Include parents in the query and let the client pick the cheapest variant for display. More complex SQL, but consistent with "parent is the user-facing concept".

Recommend (1). Changes needed: new `generate_candidates_with_variants()` (or extend current) that returns `{dish, parent_id, min_variant_price, variant_count}`. Or, simpler: no SQL change, mobile joins the query result with a second lookup for variant counts on the client.

### D. Attribute inheritance for variants

Currently each variant stores its own allergens/dietary_tags/ingredients independently — so a parent's "has sesame" allergen doesn't flow to children. Options:

- **(i)** Application-level merge at write time — web form copies parent's selected ingredients into each variant on save. Simple, mirrors current mental model.
- **(ii)** DB view `effective_dish_ingredients` that unions parent's `dish_ingredients` with child's; allergen trigger (migration 092) reads from the view. Cleaner, zero duplication.

Recommend (ii) as a follow-up migration (096). Requires extending `compute_dish_allergens` / `compute_dish_dietary_tags` to walk `parent_dish_id` if present. 20 LOC of SQL.

---

## Sequencing

1. **A** web admin variant CRUD — ~350 LOC new code, ~100 LOC edits. Self-contained; ship first so admins regain full control over anything menu-scan produces.
2. **B** mobile variant picker — ~200 LOC. Ship second with a feature flag (`EXPO_PUBLIC_VARIANT_PICKER_ENABLED`) so regression risk is contained.
3. **C** feed surfacing — small SQL change OR client-side join. Ship third.
4. **D** inheritance via view — opt-in migration. Ship fourth, possibly later; can live without it if each variant stores its own attributes.

Total realistic estimate: 2–3 focused sessions.

---

## Open questions

- Should `serves` on a parent override each variant's `serves`, or can each variant serve a different number?
  → Recommend variants have their own `serves`; parent's `serves` is ignored when `is_parent=true`.
- Should `price_per_person` be computed across variants?
  → No — `price_per_person` is already a generated column per-dish. Parent with `price=0` gives `price_per_person=0`, which is correct (don't display for parents).
- Are variants allowed to have different `dish_kind` than the parent?
  → No. On save, child's `dish_kind` is always `'standard'`.

---

## Risks

- Menu-scan confirm already creates parent-child trees; admin editing must round-trip without data loss. Test: scan a menu → confirm → edit a parent in DishFormDialog → save → re-open → all variants intact with correct prices/ingredients.
- `generate_candidates()` RPC is consumed by the feed Edge Function; any signature change requires coordinated deploy with mobile release. Prefer the client-side join in (C) to avoid this.
- Feature-flag mobile changes so a partial rollout is safe.

# Phase 6 — Data migration

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Proposed
**Last updated:** 2026-05-17
**Estimated wall time:** 4 days
**Reversibility:** ⚠ Destructive cutover. Run only after all readers (admin + mobile) are confirmed on the new shape and ≥95% mobile penetration.

Convert legacy parent/variant rows into modifier groups, fold bundle children into `bundled_items` JSONB, convert `dish_courses` into `option_groups`, then drop the legacy columns + tables.

---

## 1. Migration 145: variants → modifier options (configurable only)

**Design note: this heuristic is a one-time data conversion tool, NOT part of the going-forward system.** The greenfield model is "data carries truth" — the worker extracts `removes_dietary_tags` / `adds_allergens` explicitly per option, and the admin verifies in the editor. The heuristic only exists to bridge legacy parent/variant data.

The key insight that makes this heuristic correct: in current data, parents have `dietary_tags=[]` (empty — they're display containers, not eaten dishes). The signal lives on the VARIANT rows themselves. So the heuristic compares each variant's own tags to its siblings'.

To do that reliably, we capture each new option's source variant via a temporary tracking column dropped at end of migration.

```sql
-- Step 1: Add temporary tracking column on options
ALTER TABLE options ADD COLUMN _mig145_source_variant_id uuid;

-- Step 2: Insert one option_group per configurable parent
INSERT INTO option_groups (id, restaurant_id, dish_id, name, selection_type, min_selections, max_selections, display_order, is_active)
SELECT
  gen_random_uuid(),
  d.restaurant_id,
  d.id,
  'Choose your option',
  'single',
  1, 1, 0, true
FROM dishes d
WHERE d.is_parent = true AND d.dish_kind = 'configurable';

-- Step 3: Compute deltas relative to MIN(variant.price) and capture source variant id
WITH variant_minimums AS (
  SELECT parent_dish_id, MIN(price) AS min_price
  FROM dishes
  WHERE parent_dish_id IS NOT NULL
    AND parent_dish_id IN (SELECT id FROM dishes WHERE dish_kind = 'configurable')
  GROUP BY parent_dish_id
)
INSERT INTO options (
  id, option_group_id, name, price_delta, primary_protein,
  is_default, display_order, is_available,
  _mig145_source_variant_id
)
SELECT
  gen_random_uuid(),
  g.id,
  v.name,
  v.price - vm.min_price,
  v.primary_protein,
  (ROW_NUMBER() OVER (PARTITION BY v.parent_dish_id ORDER BY v.price ASC) = 1),
  ROW_NUMBER() OVER (PARTITION BY v.parent_dish_id ORDER BY v.price ASC) - 1,
  true,
  v.id    -- track source variant for the heuristic below
FROM dishes v
JOIN variant_minimums vm ON vm.parent_dish_id = v.parent_dish_id
JOIN option_groups g ON g.dish_id = v.parent_dish_id;

-- Step 4: Set parent base price to the cheapest variant price (AFTER computing deltas)
UPDATE dishes p
SET price = vm.min_price,
    display_price_prefix = 'from'
FROM (
  SELECT parent_dish_id, MIN(price) AS min_price
  FROM dishes
  WHERE parent_dish_id IS NOT NULL
  GROUP BY parent_dish_id
) vm
WHERE p.id = vm.parent_dish_id
  AND p.is_parent = true
  AND p.dish_kind = 'configurable';

-- Step 5: Variant-derived heuristic for removes_dietary_tags
-- Rule: option strips veg-ness when its source variant lacks 'vegetarian'
-- AND at least one sibling variant HAS 'vegetarian'.
WITH parents_with_veg_variant AS (
  SELECT DISTINCT parent_dish_id
  FROM dishes
  WHERE parent_dish_id IS NOT NULL
    AND 'vegetarian' = ANY(dietary_tags)
)
UPDATE options o
SET removes_dietary_tags = ARRAY['vegetarian','vegan']
FROM dishes v
WHERE o._mig145_source_variant_id = v.id
  AND v.parent_dish_id IN (SELECT parent_dish_id FROM parents_with_veg_variant)
  AND NOT ('vegetarian' = ANY(v.dietary_tags));

-- Step 6: Variant-derived heuristic for adds_allergens
-- Rule: an option adds an allergen if its source variant carries it
-- but at least one sibling does NOT (i.e. the allergen is option-specific, not shared by all).
UPDATE options o
SET adds_allergens = (
  SELECT array_agg(DISTINCT a)
  FROM unnest(v.allergens) a
  WHERE EXISTS (
    SELECT 1 FROM dishes v_sibling
    WHERE v_sibling.parent_dish_id = v.parent_dish_id
      AND v_sibling.id != v.id
      AND NOT (a = ANY(COALESCE(v_sibling.allergens, '{}')))
  )
)
FROM dishes v
WHERE o._mig145_source_variant_id = v.id
  AND v.allergens IS NOT NULL
  AND array_length(v.allergens, 1) > 0;

-- Step 7: Flag migrated dishes for admin review
-- Reuses existing enrichment_status field — admin filters by this to triage.
UPDATE dishes d
SET enrichment_status = 'needs_review'
WHERE d.is_parent = true
  AND d.dish_kind = 'configurable'
  AND EXISTS (SELECT 1 FROM option_groups g WHERE g.dish_id = d.id);

-- Step 8: Delete variant child rows (data is now in options)
DELETE FROM dishes
WHERE parent_dish_id IS NOT NULL
  AND parent_dish_id IN (SELECT id FROM dishes WHERE dish_kind = 'configurable');

-- Step 9: Drop tracking column
ALTER TABLE options DROP COLUMN _mig145_source_variant_id;
```

**Why this approach is safer than my first draft:**
- Original draft keyed off `parent.dietary_tags`, which is always empty for configurable parents → heuristic never fired → veg filter post-migration would over-recommend chicken options to veg users.
- Revised heuristic keys off the *variant's own* tags + sibling comparison. This is the actual signal — a variant strips veg-ness only when sibling(s) preserve it.
- Allergen heuristic mirrors the same logic: an allergen is option-specific when not shared by all siblings.
- Migrated dishes get flagged `enrichment_status='needs_review'` so admins can triage by filtering on this in the restaurant detail page.

**Dry-run protocol:**
1. Run on a snapshot of staging.
2. Export CSV: `dish_name, original_parent_price, cheapest_variant, derived_base_price, options_with_deltas, options_with_removes_dietary_tags, options_with_adds_allergens`.
3. Manually audit top 20 restaurants for sanity. Spot-check Caesar Salad, Pad Thai, Pizza Margherita patterns.
4. Run on production only after audit clears.

## 2. Migration 146: bundle variants → bundled_items JSONB

```sql
-- Bundle children become informational items, not modifier options
UPDATE dishes p
SET bundled_items = (
  SELECT jsonb_agg(
    jsonb_build_object('name', v.name) ORDER BY v.created_at
  )
  FROM dishes v
  WHERE v.parent_dish_id = p.id
)
WHERE p.is_parent = true AND p.dish_kind = 'bundle';

DELETE FROM dishes
WHERE parent_dish_id IS NOT NULL
  AND parent_dish_id IN (SELECT id FROM dishes WHERE dish_kind = 'bundle');
```

## 3. Migration 147: dish_courses → option_groups + options

```sql
-- One option_group per course
INSERT INTO option_groups (id, restaurant_id, dish_id, name, selection_type, min_selections, max_selections, display_order, is_active)
SELECT
  gen_random_uuid(),
  p.restaurant_id,
  dc.parent_dish_id,
  COALESCE(dc.course_name, 'Course ' || dc.course_number),
  CASE dc.choice_type WHEN 'one_of' THEN 'single' ELSE 'single' END,
  dc.required_count,
  dc.required_count,
  dc.course_number,
  true
FROM dish_courses dc
JOIN dishes p ON p.id = dc.parent_dish_id;

-- One option per course item
INSERT INTO options (id, option_group_id, name, price_delta, is_default, display_order, is_available)
SELECT
  gen_random_uuid(),
  g.id,
  ci.option_label,
  ci.price_delta,
  (ROW_NUMBER() OVER (PARTITION BY ci.course_id ORDER BY ci.sort_order ASC) = 1) AS is_default,
  ci.sort_order,
  true
FROM dish_course_items ci
JOIN dish_courses dc ON dc.id = ci.course_id
JOIN option_groups g
  ON g.dish_id = dc.parent_dish_id
  AND g.display_order = dc.course_number;

-- Mark course_menu parents with dining_format
UPDATE dishes SET dining_format = 'course_menu' WHERE dish_kind = 'course_menu';
```

## 4. Migration 148: buffet → dining_format

```sql
UPDATE dishes SET dining_format = 'buffet' WHERE dish_kind = 'buffet';
```

## 5. Migration 149: re-enrichment trigger

```sql
-- All dishes that now have modifier groups need fresh embeddings
UPDATE dishes
SET enrichment_status = 'pending'
WHERE id IN (
  SELECT DISTINCT dish_id FROM option_groups WHERE is_active
);
```

Then trigger `enrich-dish` for each pending dish. Could be a one-off cron sweep or manual `pg_cron` schedule for the migration window.

## 6. Migration 150: drop legacy columns + tables

**ONLY after mobile force-upgrade penetration ≥ 95% AND all admin flows verified:**

```sql
DROP TABLE dish_course_items;
DROP TABLE dish_courses;

ALTER TABLE dishes
  DROP COLUMN dish_kind,
  DROP COLUMN parent_dish_id,
  DROP COLUMN is_parent,
  DROP COLUMN is_template,
  DROP COLUMN price_per_person;  -- generated column; recompute at query time if needed
```

Update `generate_candidates` to remove the `is_parent = false` and `is_template = false` filters.

## 7. Documentation updates (concurrent with this phase)

Docs are updated **in Phase 6**, not Phase 7, because the code reflects the new model the moment Phase 6 completes. Keeping docs aligned avoids a multi-week window where the docs lie. Update each of:

- `/CLAUDE.md` — replace "Dish Kind — Composition Type" section with new "Dishes + Modifier Groups + Dining Format" section.
- `/agent_docs/architecture.md` — model diagrams.
- `/agent_docs/database.md` — schema overview.
- `/agent_docs/terminology.md` — drop `dish_kind` terms, add `dining_format`, `modifier_groups`, `bundled_items`.
- `/docs/project/06-database-schema.md` — schema documentation.
- `/docs/project/04-web-portal.md` and `/docs/project/05-mobile-app.md` — update model references.
- Mobile + admin README files.

Add a "this section was rewritten on YYYY-MM-DD as part of the dish-model rewrite" note at the top of each updated file for traceability.

## 8. Acceptance criteria

- Pre-migration row counts: total dishes, total option_groups, total dish_courses, total dish_course_items.
- Post-migration row counts: total dishes (reduced by deleted variants), total option_groups (increased by converted variants + courses), total options (increased by converted variants + course items).
- No orphan rows: `SELECT COUNT(*) FROM options WHERE option_group_id NOT IN (SELECT id FROM option_groups)` returns 0.
- No data loss: every original variant's name appears in an option row; every course item's option_label appears in an option row.
- Feed quality: shadow comparison of feed responses pre- vs post-migration (same user, same location) — top 20 recommendations stable.
- All `enrichment_status='needs_review'` dishes triaged by admin (or batch-cleared if no edits needed).
- Docs updated (see §7).

## 9. Effort: 4 days

1d migration SQL + dry-run setup, 1d staging audit + production execution, 1d re-enrichment + monitoring, 1d doc updates.

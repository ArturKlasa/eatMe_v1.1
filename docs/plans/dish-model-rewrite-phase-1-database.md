# Phase 1 — Database foundation

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Shipped 2026-05-18
**Last updated:** 2026-05-18
**Estimated wall time:** 2.5 days
**Reversibility:** Pure additive — every migration adds columns/tables only; existing readers continue working unchanged.

**Ship log:**
- Migrations 140 + 141 + 141a applied + committed (commits `11bfb29`, `2d0a4e1`).
- Migrations 142 + 143 applied + committed (commit `0495c01`). Verified against live data: chicken → `['meat','poultry']`, vegetarian/vegan → `[]`, beef → `['meat']`.
- `app-config` edge function deployed + committed (commit `fceec7d`).
- Mobile `useAppVersionGate` + `ForceUpdateScreen` + i18n + `App.tsx` wiring committed (commit `386c17d`).
- **Open items (non-blocking):** mobile gate end-to-end smoke test (set `min_supported_mobile_version='99.0.0'` → reload app → see modal); performance benchmark of `generate_candidates` vs migration 122 baseline (deferred until modifier data exists in Phase 4).

Migrations 140–143 extend `options`/`option_groups`/`dishes` with the new modifier model, rewrite the `generate_candidates` and `get_group_candidates` RPCs to surface the new shape, and add an `app_config` table + edge function + mobile hook for the Phase 6 force-upgrade gate.

---

## 1. Migration 140: extend `option_groups` and `options`

```sql
-- Extend option_groups: display flag for feed card composition
ALTER TABLE public.option_groups
  ADD COLUMN display_in_card boolean NOT NULL DEFAULT false;

-- Tighten selection_type CHECK: drop the unused 'quantity' value.
-- Verified 2026-05-17: zero prod rows have selection_type='quantity'; no
-- rendering branches exist anywhere in admin/mobile/edge code (the value was
-- declared in Zod enums + TS types only). Safe to remove.
ALTER TABLE public.option_groups
  DROP CONSTRAINT IF EXISTS option_groups_selection_type_check;
ALTER TABLE public.option_groups
  ADD CONSTRAINT option_groups_selection_type_check
  CHECK (selection_type IN ('single','multiple'));

COMMENT ON COLUMN public.option_groups.display_in_card IS
  'When true, applied options from this group surface in the feed-card dish-name suffix '
  '("Pad Thai with chicken"). When false, the group exists for menu-view rendering but '
  'doesn''t contribute to the card descriptor. Worker / admin sets this; defaults to false '
  'because the hybrid display rule (see phase-5-mobile §4) falls back to "options with primary_protein set".';

-- Extend options: new columns for modifier semantics
-- NOTE: existing column `calories_delta` (plural) stays; no new calorie column added.
-- NOTE: spice_delta intentionally NOT added (conflicts with categorical spice_level text enum;
--       deferred to v2 if needed).
ALTER TABLE public.options
  ADD COLUMN price_override          numeric(10,2) NULL,
  ADD COLUMN primary_protein         text NULL,
  ADD COLUMN adds_dietary_tags       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN removes_dietary_tags    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN adds_allergens          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN serves_delta            int    NOT NULL DEFAULT 0,
  ADD COLUMN is_default              boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.options.price_override IS
  'Absolute price for non-linear pricing (e.g. "12 wings for $45"). When set, effective_price = price_override; ignores base + delta.';
COMMENT ON COLUMN public.options.primary_protein IS
  'When set, applying this option replaces the base dish primary_protein. Used by feed scoring + variant selection.';
COMMENT ON COLUMN public.options.removes_dietary_tags IS
  'Tags this option strips from the dish (e.g. chicken on a veg salad removes ["vegetarian","vegan"]).';
COMMENT ON COLUMN public.options.adds_allergens IS
  'Allergens introduced by this option (supplements canonical_ingredient_allergens lookup).';
```

## 2. Migration 141: extend `dishes` table

```sql
ALTER TABLE public.dishes
  ADD COLUMN dining_format text NULL CHECK (
    dining_format IS NULL OR dining_format IN (
      'buffet','course_menu','interactive_table','shared_plates','sampler'
    )
  ),
  ADD COLUMN bundled_items        jsonb NULL,
  ADD COLUMN available_days       text[] NULL,
  ADD COLUMN available_hours_start time NULL,
  ADD COLUMN available_hours_end   time NULL,
  ADD COLUMN available_from        date NULL,
  ADD COLUMN available_until       date NULL;

-- jsonb shape validation: array of {name, note?}
ALTER TABLE public.dishes
  ADD CONSTRAINT bundled_items_is_array
  CHECK (bundled_items IS NULL OR jsonb_typeof(bundled_items) = 'array');

COMMENT ON COLUMN public.dishes.dining_format IS
  'UX presentation hint. Switches mobile layout flavor. NULL = normal dish row.';
COMMENT ON COLUMN public.dishes.bundled_items IS
  'Informational "comes with" list. Pure description, never relationally queried.';
```

## 3. Migration 142: `generate_candidates` modifier-aware rewrite

Rewrite to:
1. Aggregate per-dish modifier metadata via LATERAL subquery (avoids correlated-subquery cost).
2. Return modifier groups + options as JSON in the row so feed JS gets everything in one round trip.
3. Add `available_*` time-window clauses.
4. Add `required_modifier_groups_safe` boolean for hard-filter pre-check.
5. Update `serves`/`groupMeals` filter to consider `serves_delta`.

**Protein matching design decision (Option A — coarsened):**

Modifier options carry only `primary_protein text` (single value), not the rich `protein_canonical_names text[]` that base dishes derive from `dish_ingredients`. Two implications:

- **Base-dish subtype matching preserved.** `dishes.protein_canonical_names` (e.g. `['chicken','chicken_thigh']`) keeps fueling fine-grained daily `meatTypes` matches today.
- **Option-level matches coarsen to family-level.** `meatTypes.chicken` filter against an option only checks `option.primary_protein = 'chicken'`. Subtype precision is lost on the modifier side. This is acceptable because (a) modifiers rarely express subtypes; (b) the daily `meatTypes` filter is a soft +0.10 boost, not a hard filter; (c) zero schema work.

Therefore `reachable_protein_canonicals` is NOT added. `reachable_protein_families` is derived via a small CASE expression mapping `primary_protein` → family ('chicken'→'poultry', 'beef'/'pork'/'lamb'/'goat'/'other_meat'→'meat', 'fish'→'fish', 'shellfish'→'shellfish', etc.).

New `RETURNS TABLE` columns (in addition to existing 29):

```sql
reachable_proteins             text[],     -- base.primary_protein + all option.primary_protein
reachable_protein_families     text[],     -- mapped via CASE from reachable_proteins
required_groups_safe           boolean,    -- pre-computed for this user's filter set
dining_format                  text,
bundled_items                  jsonb,
modifier_groups                jsonb       -- aggregated [{group, options[]}] for variant-selection JS
```

Implementation sketch (key clauses only):

```sql
WITH dish_modifiers AS (
  SELECT
    g.dish_id,
    jsonb_agg(
      jsonb_build_object(
        'id', g.id, 'name', g.name,
        'selection_type', g.selection_type,
        'min_selections', g.min_selections,
        'max_selections', g.max_selections,
        'display_order', g.display_order,
        'display_in_card', g.display_in_card,
        'options', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', o.id, 'name', o.name,
              'price_delta', o.price_delta,
              'price_override', o.price_override,
              'primary_protein', o.primary_protein,
              'adds_dietary_tags', o.adds_dietary_tags,
              'removes_dietary_tags', o.removes_dietary_tags,
              'adds_allergens', o.adds_allergens,
              'serves_delta', o.serves_delta,
              'is_default', o.is_default,
              'display_order', o.display_order
            ) ORDER BY o.display_order
          )
          FROM options o
          WHERE o.option_group_id = g.id AND o.is_available
        )
      ) ORDER BY g.display_order
    ) AS modifier_groups,
    array_agg(DISTINCT o.primary_protein) FILTER (WHERE o.primary_protein IS NOT NULL) AS option_proteins
  FROM option_groups g
  JOIN options o ON o.option_group_id = g.id
  WHERE g.is_active
  GROUP BY g.dish_id
)
SELECT
  d.*,
  ARRAY(SELECT unnest(ARRAY[d.primary_protein]) UNION SELECT unnest(COALESCE(dm.option_proteins, '{}')))
    AS reachable_proteins,
  -- reachable_protein_families derived via CASE mapping primary_protein → family:
  --   'chicken' → 'poultry'
  --   'beef'|'pork'|'lamb'|'goat'|'other_meat' → 'meat'
  --   'fish' → 'fish'
  --   'shellfish' → 'shellfish'
  --   'eggs' → 'eggs'
  --   'vegetarian'|'vegan' → 'vegetarian'
  (SELECT array_agg(DISTINCT
    CASE p
      WHEN 'chicken' THEN 'poultry'
      WHEN 'beef' THEN 'meat' WHEN 'pork' THEN 'meat' WHEN 'lamb' THEN 'meat'
      WHEN 'goat' THEN 'meat' WHEN 'other_meat' THEN 'meat'
      WHEN 'fish' THEN 'fish'
      WHEN 'shellfish' THEN 'shellfish'
      WHEN 'eggs' THEN 'eggs'
      ELSE 'vegetarian'
    END
   ) FROM unnest(
     ARRAY(SELECT unnest(ARRAY[d.primary_protein]) UNION SELECT unnest(COALESCE(dm.option_proteins, '{}')))
   ) AS p
  ) AS reachable_protein_families,
  NOT EXISTS (
    SELECT 1 FROM option_groups g
    WHERE g.dish_id = d.id
      AND g.is_active
      AND g.min_selections >= 1   -- "required" by min_selections semantics
      AND NOT EXISTS (
        SELECT 1 FROM options o
        WHERE o.option_group_id = g.id
          AND o.is_available
          AND NOT (o.adds_allergens && COALESCE(p_allergens, '{}'))
          AND NOT (
            p_diet_tag IS NOT NULL
            AND p_diet_tag = ANY(o.removes_dietary_tags)
          )
      )
  ) AS required_groups_safe,
  dm.modifier_groups
FROM dishes d
LEFT JOIN dish_modifiers dm ON dm.dish_id = d.id
WHERE
  required_groups_safe = true
  -- ... existing clauses ...
  -- availability windows:
  AND (d.available_from IS NULL OR CURRENT_DATE >= d.available_from)
  AND (d.available_until IS NULL OR CURRENT_DATE <= d.available_until)
  AND (
    d.available_days IS NULL
    OR lower(to_char(CURRENT_DATE, 'dy')) = ANY(d.available_days)
  )
  AND (d.available_hours_start IS NULL OR CURRENT_TIME >= d.available_hours_start)
  AND (d.available_hours_end IS NULL OR CURRENT_TIME <= d.available_hours_end)
  -- serves filter accounting for serves_delta on optional sizes:
  AND (
    NOT p_group_meals
    OR d.serves >= 2
    OR EXISTS (
      SELECT 1 FROM options o
      JOIN option_groups g ON g.id = o.option_group_id
      WHERE g.dish_id = d.id AND (d.serves + o.serves_delta) >= 2
    )
  )
  -- Keep during transition (drop in Phase 6):
  AND d.is_parent = false
  AND d.is_template = false
```

## 4. Migration 143: same treatment for `get_group_candidates`

Identical pattern, applied to the group-recommendations RPC.

## 5. RLS

`option_groups` and `options` already have RLS policies (migrations 091, 094). New columns inherit existing policies — no new RLS work needed in Phase 1.

For new `dishes` columns: existing dish RLS applies. No new policies.

## 6. App version gate (Phase 6 prerequisite)

Phase 6 (destructive cutover) requires ≥95% of active mobile sessions to be on a Phase-5-or-later build. That gate doesn't exist yet, so we build it here in Phase 1 so it has time to bake before Phase 6 needs it.

**Migration 141a — `app_config` table:**

```sql
CREATE TABLE public.app_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),   -- single-row table
  min_supported_mobile_version text NOT NULL,
  latest_mobile_version        text NOT NULL,
  update_url_ios               text NOT NULL,
  update_url_android           text NOT NULL,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_config_read_all ON public.app_config FOR SELECT USING (true);
-- Service-role retains implicit write; no public-write policy.

INSERT INTO public.app_config (
  min_supported_mobile_version, latest_mobile_version,
  update_url_ios, update_url_android
) VALUES (
  '0.0.0', '0.0.0',                                 -- bump at Phase 5 release
  'https://apps.apple.com/app/idTBD',
  'https://play.google.com/store/apps/details?id=TBD'
);
```

**New edge function** `infra/supabase/functions/app-config/index.ts` (~30 LOC):

```ts
serve(async () => {
  const { data, error } = await supabase
    .from('app_config').select('*').limit(1).single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
});
```

Anonymous-readable (RLS policy allows). One-hour CDN cache; client also caches the last successful response in AsyncStorage for offline survival.

**Mobile integration** — new hook called from `apps/mobile/App.tsx` (root provider), runs on app startup and on resume:

```ts
// apps/mobile/src/hooks/useAppVersionGate.ts
import * as Application from 'expo-application';

export function useAppVersionGate() {
  const [gate, setGate] = useState<AppConfig | null>(null);
  useEffect(() => {
    fetchAppConfig().then(cfg => {
      const installed = Application.nativeApplicationVersion ?? '0.0.0';
      if (semverLt(installed, cfg.min_supported_mobile_version)) setGate(cfg);
    });
  }, []);
  return gate;
}
```

When `gate !== null`, render a blocking modal with platform-aware update URL. No "skip" button — this is a hard wall.

**Operational note:** at Phase 5 mobile release, bump `latest_mobile_version` to the new build. Leave `min_supported_mobile_version` alone until ≥4 weeks later when analytics confirm penetration — then raise it to the Phase 5 build number to harden the floor before Phase 6.

## 7. Acceptance criteria

- Migrations 140–143 apply cleanly to staging.
- `SELECT * FROM dishes LIMIT 1` returns new columns as NULL/empty defaults.
- `generate_candidates(...)` returns existing 29 columns + 7 new columns (NULL/empty for dishes with no modifier groups).
- Existing feed function continues working unchanged (ignores new fields).
- Performance benchmark: candidate query latency at p95 within 20% of pre-migration baseline. If worse, optimize the LATERAL aggregation.
- `app-config` edge function returns the seed row; mobile dev build calling it logs the expected payload; setting `min_supported_mobile_version='99.0.0'` in staging triggers the blocking modal.
- `option_groups.selection_type` CHECK constraint accepts only `'single'`/`'multiple'`; inserting `'quantity'` fails.

## 8. Effort: 2.5 days

1d migrations + 1d benchmarking + index tuning + 0.5d app-config table/function/mobile-hook.

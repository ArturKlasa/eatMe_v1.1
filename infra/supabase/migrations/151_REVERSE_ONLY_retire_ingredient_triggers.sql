-- 151_REVERSE_ONLY_retire_ingredient_triggers.sql
-- Reverses 151_retire_ingredient_triggers.sql by recreating the three
-- triggers + five helper / trigger functions.
--
-- Function bodies are taken from:
--   - migration 105 (compute_dish_allergens, compute_dish_dietary_tags)
--     — the ingredient_concepts version, which was the production state at
--     the time of Phase B.
--   - migration 092 (refresh_dish_dietary, trg_dish_ingredients_refresh,
--     trg_dishes_override_refresh, dish_ingredients_refresh trigger,
--     dishes_override_refresh trigger).
--   - migration 135 (trg_enrich_on_ingredient_change trigger).
--
-- The backfill DO blocks from migrations 092 and 105 are intentionally NOT
-- re-run: they were one-shot column-populate operations. Reversing Phase B
-- only restores the trigger system; existing dishes.allergens / dietary_tags
-- values are preserved as-is.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- Helper functions (from migration 105 — ingredient_concepts version)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_dish_allergens(p_dish_id uuid)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    array_agg(DISTINCT allergen_code ORDER BY allergen_code),
    ARRAY[]::text[]
  )
  FROM public.dish_ingredients di
  JOIN public.ingredient_concepts ic ON ic.id = di.concept_id
  CROSS JOIN LATERAL unnest(ic.allergens) AS allergen_code
  WHERE di.dish_id = p_dish_id;
$$;

CREATE OR REPLACE FUNCTION public.compute_dish_dietary_tags(p_dish_id uuid)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  WITH concept_tags AS (
    SELECT 'vegetarian'::text AS code
    WHERE EXISTS (SELECT 1 FROM public.dish_ingredients WHERE dish_id = p_dish_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.dish_ingredients di
        JOIN public.ingredient_concepts ic ON ic.id = di.concept_id
        WHERE di.dish_id = p_dish_id AND ic.is_vegetarian = false
      )
    UNION ALL
    SELECT 'vegan'::text AS code
    WHERE EXISTS (SELECT 1 FROM public.dish_ingredients WHERE dish_id = p_dish_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.dish_ingredients di
        JOIN public.ingredient_concepts ic ON ic.id = di.concept_id
        WHERE di.dish_id = p_dish_id AND ic.is_vegan = false
      )
  ),
  legacy_tags AS (
    SELECT dt.code
    FROM public.dietary_tags dt
    WHERE dt.code NOT IN ('vegetarian', 'vegan')
      AND EXISTS (SELECT 1 FROM public.dish_ingredients WHERE dish_id = p_dish_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.dish_ingredients di
        WHERE di.dish_id = p_dish_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.canonical_ingredient_dietary_tags cidt
            WHERE cidt.canonical_ingredient_id = di.ingredient_id
              AND cidt.dietary_tag_id = dt.id
          )
      )
  )
  SELECT coalesce(array_agg(DISTINCT code ORDER BY code), ARRAY[]::text[])
  FROM (
    SELECT code FROM concept_tags
    UNION
    SELECT code FROM legacy_tags
  ) all_tags;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- refresh_dish_dietary (from migration 092)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_dish_dietary(p_dish_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_allergens    text[];
  v_dietary_tags text[];
  v_a_override   text[];
  v_d_override   text[];
BEGIN
  SELECT allergens_override, dietary_tags_override
    INTO v_a_override, v_d_override
  FROM public.dishes
  WHERE id = p_dish_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_allergens    := coalesce(v_a_override, public.compute_dish_allergens(p_dish_id));
  v_dietary_tags := coalesce(v_d_override, public.compute_dish_dietary_tags(p_dish_id));

  IF 'vegan' = ANY(v_dietary_tags) AND NOT ('vegetarian' = ANY(v_dietary_tags)) THEN
    v_dietary_tags := v_dietary_tags || ARRAY['vegetarian'];
  END IF;

  UPDATE public.dishes
  SET allergens    = v_allergens,
      dietary_tags = v_dietary_tags
  WHERE id = p_dish_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Trigger function: dish_ingredients changes (from migration 092)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_dish_ingredients_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_dish_dietary(NEW.dish_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_dish_dietary(OLD.dish_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.refresh_dish_dietary(NEW.dish_id);
    IF NEW.dish_id IS DISTINCT FROM OLD.dish_id THEN
      PERFORM public.refresh_dish_dietary(OLD.dish_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS dish_ingredients_refresh ON public.dish_ingredients;
CREATE TRIGGER dish_ingredients_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.dish_ingredients
FOR EACH ROW EXECUTE FUNCTION public.trg_dish_ingredients_refresh();

-- ──────────────────────────────────────────────────────────────────────────
-- Trigger function: dishes override columns (from migration 092)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_dishes_override_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.allergens_override    IS DISTINCT FROM OLD.allergens_override
  OR NEW.dietary_tags_override IS DISTINCT FROM OLD.dietary_tags_override THEN
    PERFORM public.refresh_dish_dietary(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS dishes_override_refresh ON public.dishes;
CREATE TRIGGER dishes_override_refresh
AFTER UPDATE OF allergens_override, dietary_tags_override ON public.dishes
FOR EACH ROW EXECUTE FUNCTION public.trg_dishes_override_refresh();

-- ──────────────────────────────────────────────────────────────────────────
-- Enrich-on-ingredient-change trigger (from migration 135)
-- ──────────────────────────────────────────────────────────────────────────
-- _trg_notify_enrich_dish() is defined in migration 132 and was not dropped
-- by Phase B, so this trigger can reattach to it directly.

DROP TRIGGER IF EXISTS trg_enrich_on_ingredient_change ON public.dish_ingredients;
CREATE TRIGGER trg_enrich_on_ingredient_change
AFTER INSERT OR DELETE ON public.dish_ingredients
FOR EACH ROW EXECUTE FUNCTION public._trg_notify_enrich_dish();

COMMIT;

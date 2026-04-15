-- 092_dish_allergen_trigger.sql
-- Establishes dish_ingredients as the single source of truth for
-- dishes.allergens and dishes.dietary_tags.
--
-- Previously, three unsynced sources wrote these columns:
--   a) AI extraction at menu-scan confirm time (written, never refreshed)
--   b) Manual admin form input
--   c) Ingredient links (computed in UI only, never persisted)
--
-- After this migration:
--   - Adding/removing/changing dish_ingredients automatically recomputes
--     dishes.allergens and dishes.dietary_tags.
--   - Admins can still override via new *_override columns (NULL = use computed).
--   - Mobile clients continue reading dishes.allergens / dietary_tags as before.

-- ---------------------------------------------------------------------------
-- Override columns — NULL means "use trigger-computed value".
-- ---------------------------------------------------------------------------
ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS allergens_override     text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dietary_tags_override  text[] DEFAULT NULL;

COMMENT ON COLUMN public.dishes.allergens_override IS
  'Admin override for allergens. NULL = use value computed from dish_ingredients. Set by admin form escape hatch only.';
COMMENT ON COLUMN public.dishes.dietary_tags_override IS
  'Admin override for dietary_tags. NULL = use value computed from dish_ingredients.';

-- ---------------------------------------------------------------------------
-- Compute helpers — pure functions, return the set of codes the cascade
-- produces for a given dish.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_dish_allergens(p_dish_id uuid)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(array_agg(DISTINCT a.code ORDER BY a.code), ARRAY[]::text[])
  FROM public.dish_ingredients di
  JOIN public.canonical_ingredient_allergens cia ON cia.canonical_ingredient_id = di.ingredient_id
  JOIN public.allergens a ON a.id = cia.allergen_id
  WHERE di.dish_id = p_dish_id;
$$;

CREATE OR REPLACE FUNCTION public.compute_dish_dietary_tags(p_dish_id uuid)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(array_agg(DISTINCT dt.code ORDER BY dt.code), ARRAY[]::text[])
  FROM public.dish_ingredients di
  JOIN public.canonical_ingredient_dietary_tags cidt ON cidt.canonical_ingredient_id = di.ingredient_id
  JOIN public.dietary_tags dt ON dt.id = cidt.dietary_tag_id
  WHERE di.dish_id = p_dish_id;
$$;

-- ---------------------------------------------------------------------------
-- Refresh a single dish's effective allergens and dietary_tags.
-- Writes coalesce(override, computed). Does nothing if the dish was deleted.
-- ---------------------------------------------------------------------------
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

  -- Vegan implies vegetarian — preserved here so the invariant holds regardless
  -- of whether the tags came from override or cascade.
  IF 'vegan' = ANY(v_dietary_tags) AND NOT ('vegetarian' = ANY(v_dietary_tags)) THEN
    v_dietary_tags := v_dietary_tags || ARRAY['vegetarian'];
  END IF;

  UPDATE public.dishes
  SET allergens    = v_allergens,
      dietary_tags = v_dietary_tags
  WHERE id = p_dish_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: when dish_ingredients changes, refresh the affected dish(es).
-- Handles INSERT/UPDATE/DELETE and the rare case where UPDATE changes dish_id.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Trigger: when a dish's override columns change, refresh the effective value.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Preserve existing AI-suggested values as overrides for dishes that have
-- no dish_ingredients rows yet (otherwise the backfill below would wipe them).
-- Dishes *with* ingredients will be recomputed cleanly from the cascade.
-- ---------------------------------------------------------------------------
UPDATE public.dishes d
SET allergens_override = d.allergens
WHERE d.allergens IS NOT NULL
  AND array_length(d.allergens, 1) > 0
  AND d.allergens_override IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.dish_ingredients di WHERE di.dish_id = d.id);

UPDATE public.dishes d
SET dietary_tags_override = d.dietary_tags
WHERE d.dietary_tags IS NOT NULL
  AND array_length(d.dietary_tags, 1) > 0
  AND d.dietary_tags_override IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.dish_ingredients di WHERE di.dish_id = d.id);

-- ---------------------------------------------------------------------------
-- Backfill: refresh every existing dish so the column values reflect the
-- cascade (or preserved override) today.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.dishes LOOP
    PERFORM public.refresh_dish_dietary(r.id);
  END LOOP;
END;
$$;

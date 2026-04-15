-- 093_unify_allergen_codes.sql
-- Reconciles allergen codes across the DB so they match the canonical list in
-- packages/shared/src/constants/dietary.ts (ALLERGENS). The mobile service
-- had a hidden remap (soy↔soybeans, nuts↔tree_nuts) that obscured code drift.
--
-- After this migration:
--   allergens.code uses the short canonical names: soy, nuts
--   user_preferences.allergies[] uses the same names
--   dishes.allergens[] / dishes.allergens_override[] use the same names
--
-- Idempotent: uses ON CONFLICT and checks for existence before renaming.

-- ---------------------------------------------------------------------------
-- 1. Ensure canonical allergens exist.
-- ---------------------------------------------------------------------------
INSERT INTO public.allergens (code, name, severity, description) VALUES
  ('lactose',   'Lactose',   'major', 'Milk and dairy products.'),
  ('gluten',    'Gluten',    'major', 'Wheat, barley, rye, and derivatives.'),
  ('peanuts',   'Peanuts',   'major', 'Peanuts and peanut-derived ingredients.'),
  ('soy',       'Soy',       'major', 'Soybeans and soy-derived ingredients.'),
  ('sesame',    'Sesame',    'major', 'Sesame seeds and oil.'),
  ('shellfish', 'Shellfish', 'major', 'Crustaceans and molluscs.'),
  ('nuts',      'Tree Nuts', 'major', 'Almonds, walnuts, hazelnuts, pecans, cashews, etc.')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Merge legacy long-form codes into canonical.
--    Any canonical_ingredient_allergens rows that reference the legacy allergen
--    get retargeted to the canonical one, then the legacy row is removed.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  legacy_id uuid;
  canonical_id uuid;
BEGIN
  FOR legacy_id, canonical_id IN
    SELECT l.id, c.id
    FROM public.allergens l
    JOIN public.allergens c ON c.code = CASE l.code
        WHEN 'soybeans'  THEN 'soy'
        WHEN 'tree_nuts' THEN 'nuts'
      END
    WHERE l.code IN ('soybeans', 'tree_nuts')
  LOOP
    -- Retarget cascade links; duplicates become no-ops thanks to the PK
    -- on (canonical_ingredient_id, allergen_id).
    INSERT INTO public.canonical_ingredient_allergens (canonical_ingredient_id, allergen_id)
    SELECT canonical_ingredient_id, canonical_id
    FROM public.canonical_ingredient_allergens
    WHERE allergen_id = legacy_id
    ON CONFLICT DO NOTHING;

    DELETE FROM public.canonical_ingredient_allergens WHERE allergen_id = legacy_id;
    DELETE FROM public.allergens WHERE id = legacy_id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Rewrite text[] columns that store allergen codes directly.
-- ---------------------------------------------------------------------------
UPDATE public.dishes
SET allergens = ARRAY(
  SELECT CASE code
    WHEN 'soybeans'  THEN 'soy'
    WHEN 'tree_nuts' THEN 'nuts'
    ELSE code
  END
  FROM unnest(allergens) AS code
)
WHERE allergens && ARRAY['soybeans', 'tree_nuts']::text[];

UPDATE public.dishes
SET allergens_override = ARRAY(
  SELECT CASE code
    WHEN 'soybeans'  THEN 'soy'
    WHEN 'tree_nuts' THEN 'nuts'
    ELSE code
  END
  FROM unnest(allergens_override) AS code
)
WHERE allergens_override && ARRAY['soybeans', 'tree_nuts']::text[];

UPDATE public.user_preferences
SET allergies = ARRAY(
  SELECT CASE code
    WHEN 'soybeans'  THEN 'soy'
    WHEN 'tree_nuts' THEN 'nuts'
    ELSE code
  END
  FROM unnest(allergies) AS code
)
WHERE allergies && ARRAY['soybeans', 'tree_nuts']::text[];

-- ---------------------------------------------------------------------------
-- 4. Validation helper — call from app code or future migrations to assert
--    that a given array contains only canonical allergen codes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_allergen_codes(codes text[])
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT codes IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(codes) AS c
    WHERE c NOT IN (SELECT code FROM public.allergens)
  );
$$;

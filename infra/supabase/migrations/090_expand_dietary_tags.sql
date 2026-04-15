-- 090_expand_dietary_tags.sql
-- Aligns the dietary_tags table with the canonical list in
-- packages/shared/src/constants/dietary.ts.
--
-- Adds codes that the menu-scan DIETARY_HINT_MAP was already producing but
-- had no row in the DB (orphan mappings — previously silently dropped when
-- stored in dishes.dietary_tags because the code had no referent).
--
-- Idempotent: uses ON CONFLICT (code) DO NOTHING.

INSERT INTO public.dietary_tags (code, name, category, description) VALUES
  ('pescatarian',       'Pescatarian',       'diet',      'Excludes meat and poultry; includes fish and seafood.'),
  ('low_sodium',        'Low-Sodium',        'health',    'Dish prepared with reduced salt/sodium content.'),
  ('organic',           'Organic',           'lifestyle', 'Dish made with certified organic ingredients.'),
  ('gluten_free',       'Gluten-Free',       'health',    'Dish contains no gluten-bearing ingredients.'),
  ('dairy_free',        'Dairy-Free',        'health',    'Dish contains no dairy/lactose ingredients.'),
  ('nut_free',          'Nut-Free',          'health',    'Dish contains no tree nuts or peanuts.'),
  ('egg_free',          'Egg-Free',          'health',    'Dish contains no eggs.'),
  ('soy_free',          'Soy-Free',          'health',    'Dish contains no soy-derived ingredients.')
ON CONFLICT (code) DO NOTHING;

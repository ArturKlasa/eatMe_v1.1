-- 113_add_non_alcoholic_dietary_tag.sql
-- Adds 'non_alcoholic' to the canonical dietary_tags table.
--
-- Menu scan was reading "Sin alcohol" / "non-alcoholic" beers and mocktails
-- from menu images and emitting non_alcoholic as a dietary hint, but the code
-- had no row in dietary_tags so it was being dropped with an "unmapped hint"
-- warning. This category is meaningful (pregnancy, recovery, designated
-- drivers, religious abstainers, kids' menus, NA beer trend).
--
-- Idempotent: ON CONFLICT (code) DO NOTHING.

INSERT INTO public.dietary_tags (code, name, category, description) VALUES
  ('non_alcoholic', 'Non-Alcoholic', 'lifestyle',
   'Drink contains no alcohol — covers mocktails, NA beer, virgin cocktails, and dealcoholised wine.')
ON CONFLICT (code) DO NOTHING;

-- 097_add_eggs_fish_allergens.sql
-- Adds 'eggs' and 'fish' to the canonical allergens table.
--
-- These are among the most common real-world allergens on restaurant menus
-- (egg wash on pastries, fish sauce in Asian cuisine, eggs in Caesar dressing)
-- but were missing from the canonical list — forcing AI extraction to either
-- drop them or misclassify them as 'shellfish'.
--
-- Idempotent: ON CONFLICT (code) DO NOTHING.

INSERT INTO public.allergens (code, name, severity, description) VALUES
  ('eggs', 'Eggs',  'major', 'Eggs and egg-derived ingredients (mayonnaise, egg wash, meringue, custard).'),
  ('fish', 'Fish',  'major', 'Finfish — salmon, tuna, cod, anchovy, etc. Distinct from shellfish.')
ON CONFLICT (code) DO NOTHING;

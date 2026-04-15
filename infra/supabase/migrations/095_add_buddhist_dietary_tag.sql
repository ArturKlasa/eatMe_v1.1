-- 095_add_buddhist_dietary_tag.sql
-- Adds 'buddhist' to the canonical dietary_tags table.
--
-- The mobile filterStore has always listed buddhist alongside
-- halal/hindu/kosher/jain in permanentFilters.religiousRestrictions, but
-- there was no corresponding row in dietary_tags. The
-- permanentFiltersToDb() conversion mapped the selection straight to the
-- code, so "buddhist" was being written to user_preferences.religious_restrictions
-- without ever matching anything in generate_candidates().
--
-- Idempotent: ON CONFLICT (code) DO NOTHING.

INSERT INTO public.dietary_tags (code, name, category, description) VALUES
  ('buddhist', 'Buddhist', 'religious',
   'Buddhist dietary practice — commonly vegetarian, avoids the five pungent roots (garlic, onion, leek, chives, shallot) in some traditions.')
ON CONFLICT (code) DO NOTHING;

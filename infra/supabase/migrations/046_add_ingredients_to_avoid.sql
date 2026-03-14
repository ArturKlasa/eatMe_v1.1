-- Migration 046: add ingredients_to_avoid to user_preferences
--
-- Stores the list of canonical ingredients a user wants to avoid.
-- Each element is {canonicalIngredientId: uuid, displayName: text} so the
-- mobile app can render names without an extra join on every load.
--
-- Using JSONB (not uuid[]) because:
--  • We need to store a display name alongside the ID for offline rendering.
--  • JSONB allows schema-free evolution (e.g. adding a `quantity` field later).

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS ingredients_to_avoid jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_preferences.ingredients_to_avoid IS
  'Array of {canonicalIngredientId: uuid, displayName: text} objects. '
  'References canonical_ingredients.id. Populated by the mobile permanent-filter picker.';

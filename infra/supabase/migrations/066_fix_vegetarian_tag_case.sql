-- 066_fix_vegetarian_tag_case.sql
-- Fixes capitalization of 'Vegetarian' dietary tag to 'vegetarian' everywhere in dishes.dietary_tags

UPDATE dishes
SET dietary_tags = array_replace(dietary_tags, 'Vegetarian', 'vegetarian')
WHERE 'Vegetarian' = ANY(dietary_tags);

-- Migration 077: recent_viewed_restaurants view
-- Combines session_views + restaurants into a single queryable view,
-- eliminating the two-query pattern in viewHistoryService.ts

CREATE VIEW recent_viewed_restaurants
WITH (security_invoker = true)
AS
SELECT
  sv.user_id,
  sv.viewed_at,
  r.id,
  r.name,
  r.cuisine_types,
  r.image_url,
  r.address,
  r.rating
FROM session_views sv
JOIN restaurants r ON r.id = sv.entity_id::uuid
WHERE sv.entity_type = 'restaurant';

-- Migration 076: Performance Indexes
-- Adds 7 missing indexes to eliminate sequential scans on frequently queried columns

-- Feed load: favorites lookup
CREATE INDEX IF NOT EXISTS idx_favorites_user_subject
  ON favorites(user_id, subject_type);

-- Feed load: interaction history
CREATE INDEX IF NOT EXISTS idx_interactions_user_type
  ON user_dish_interactions(user_id, interaction_type);

-- RLS: eat_together participant check (general)
CREATE INDEX IF NOT EXISTS idx_eat_members_session_left
  ON eat_together_members(session_id, left_at);

-- View history screen
CREATE INDEX IF NOT EXISTS idx_session_views_user_type
  ON session_views(user_id, entity_type);

-- enrich-dish + RestaurantDetailScreen ingredient load
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish
  ON dish_ingredients(dish_id);

-- get_vote_results() RPC
CREATE INDEX IF NOT EXISTS idx_eat_votes_session
  ON eat_together_votes(session_id);

-- RLS self-referential policy on eat_together_members (partial index)
CREATE INDEX IF NOT EXISTS idx_eat_members_session_user_active
  ON eat_together_members(session_id, user_id)
  WHERE left_at IS NULL;

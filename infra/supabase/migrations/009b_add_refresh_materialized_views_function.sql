-- Create function to refresh all materialized views
-- This should be called after deleting restaurants to update rating summaries

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Refresh dish ratings summary
  REFRESH MATERIALIZED VIEW CONCURRENTLY dish_ratings_summary;
  
  -- Refresh restaurant ratings summary
  REFRESH MATERIALIZED VIEW CONCURRENTLY restaurant_ratings_summary;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO authenticated;

COMMENT ON FUNCTION refresh_materialized_views() IS 'Refreshes all materialized views (dish_ratings_summary and restaurant_ratings_summary). Call this after bulk operations like deleting restaurants.';

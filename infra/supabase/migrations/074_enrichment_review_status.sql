-- Migration 074: Add enrichment_review_status column to dishes
-- Supports staged AI suggestion approval: AI-inferred data is stored
-- in enrichment_payload and requires admin review before applying.

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS enrichment_review_status text
  CHECK (enrichment_review_status IS NULL OR enrichment_review_status = ANY(
    ARRAY['pending_review', 'accepted', 'rejected']
  ));

COMMENT ON COLUMN dishes.enrichment_review_status IS
  'Staged AI enrichment review: pending_review | accepted | rejected | NULL (no AI data)';

-- Partial index for admin dashboard queries filtering by review status.
-- Only indexes rows with AI-enriched data (status IS NOT NULL) to keep it small.
CREATE INDEX IF NOT EXISTS dishes_enrichment_review_status_idx
  ON dishes(enrichment_review_status)
  WHERE enrichment_review_status IS NOT NULL;

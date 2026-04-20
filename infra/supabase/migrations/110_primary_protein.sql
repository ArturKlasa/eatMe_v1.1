-- Add primary_protein column to dishes table.
-- Single nullable text field representing the dominant protein (or diet classification).
-- Drives protein_families, protein_canonical_names, and dietary_tags_override via application logic.

ALTER TABLE dishes
  ADD COLUMN primary_protein text
  CHECK (
    primary_protein IS NULL OR primary_protein IN (
      'chicken', 'beef', 'pork', 'lamb', 'duck', 'other_meat',
      'fish', 'shellfish', 'eggs',
      'vegetarian', 'vegan'
    )
  );

CREATE INDEX idx_dishes_primary_protein
  ON dishes (primary_protein)
  WHERE primary_protein IS NOT NULL;

COMMENT ON COLUMN dishes.primary_protein IS
  'Dominant protein or diet classification. Drives protein_families / protein_canonical_names / dietary_tags_override. NULL = unspecified (shows banner in admin UI).';

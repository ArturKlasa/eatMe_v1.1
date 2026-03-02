-- Add language column to ingredient_aliases
-- All existing rows default to 'en'. New Spanish aliases use 'es'.
-- The ilike search in the API and UI works without language filtering —
-- this column is for future language-aware UI and analytics only.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ingredient_aliases'
      AND column_name  = 'language'
  ) THEN
    ALTER TABLE public.ingredient_aliases
      ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
  END IF;
END $$;

-- Index for language-filtered queries
CREATE INDEX IF NOT EXISTS ingredient_aliases_language_idx
  ON public.ingredient_aliases (language);

CREATE INDEX IF NOT EXISTS ingredient_aliases_display_language_idx
  ON public.ingredient_aliases (LOWER(display_name), language);

COMMENT ON COLUMN ingredient_aliases.language IS
  'BCP-47 language tag for the alias (e.g. ''en'', ''es''). Used for language-aware search in future.';

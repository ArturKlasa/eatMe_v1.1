-- 156_REVERSE_ONLY_drop_dietary_allergen_columns.sql
-- Reverse of 156_drop_dietary_allergen_columns.sql.
--
-- Restores SCHEMA only. The dropped data (all empty/default arrays in practice)
-- is NOT recoverable. Run 155_REVERSE_ONLY AFTER this one if you also need the
-- old RPC bodies back (the old RPCs reference these columns).
--
-- Caveat: canonical_ingredient_dietary_tags originally also had an FK to
-- public.canonical_ingredients, but that table was dropped by migration 152.
-- This reverse recreates the junction WITHOUT that FK (the dietary_tags FK is
-- restored). The junction is dead either way — both its purpose and its other
-- parent are gone.

BEGIN;

-- ── (1) Recreate lookup/vocabulary tables (verbatim from database_schema.sql) ─
CREATE TABLE IF NOT EXISTS public.allergens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  severity text CHECK (severity = ANY (ARRAY['major'::text, 'minor'::text])),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT allergens_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.dietary_tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text CHECK (category = ANY (ARRAY['diet'::text, 'religious'::text, 'lifestyle'::text, 'health'::text])),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dietary_tags_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.canonical_ingredient_dietary_tags (
  canonical_ingredient_id uuid NOT NULL,
  dietary_tag_id uuid NOT NULL,
  CONSTRAINT canonical_ingredient_dietary_tags_pkey PRIMARY KEY (canonical_ingredient_id, dietary_tag_id),
  CONSTRAINT canonical_ingredient_dietary_tags_dietary_tag_id_fkey FOREIGN KEY (dietary_tag_id) REFERENCES public.dietary_tags(id)
);

-- ── (2) Re-add user_preferences columns ────────────────────────────────────
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS allergies              text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS diet_types             text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS religious_restrictions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_dietary_tags text[] DEFAULT ARRAY[]::text[];

-- ── (3) Re-add option-level modifier columns ───────────────────────────────
ALTER TABLE public.options
  ADD COLUMN IF NOT EXISTS adds_allergens       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS removes_dietary_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS adds_dietary_tags    text[] NOT NULL DEFAULT '{}';

-- ── (4) Re-add dish-level columns ──────────────────────────────────────────
ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS allergens    text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS dietary_tags text[] DEFAULT ARRAY[]::text[];

COMMIT;

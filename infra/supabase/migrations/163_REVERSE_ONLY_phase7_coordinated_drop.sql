-- 163_REVERSE_ONLY_phase7_coordinated_drop.sql
-- Reverse of 163_phase7_coordinated_drop.sql.
--
-- Restores SCHEMA only. Column data is NOT recoverable — but nothing
-- meaningful was lost: migration 158 converted all parent/variant structure
-- into modifier groups before the drop (verified + operator-triaged
-- 2026-06-11). After this reverse, every dish reads dish_kind='standard',
-- is_parent=false, is_template=false, parent_dish_id=NULL — which is the
-- true state of the post-158 data anyway.
--
-- Function bodies: this file does NOT restore the pre-163 function bodies.
-- The rewritten functions (163 versions) keep working against the restored
-- schema — they simply never read the restored columns. If you genuinely
-- need the old bodies back, re-run, in order:
--   159_add_turkey_protein.sql §3–4   (generate_candidates, get_group_candidates)
--   155_retire_dietary_allergen_rpcs.sql §3 (admin_confirm_menu_scan)
--   160_admin_copy_restaurant_menu.sql      (admin_copy_restaurant_menu)
--   133_embed_recovery_cron.sql             (_cron_embed_recovery_tick)
--   121_confirm_menu_scan.sql               (confirm_menu_scan — dropped by 163)
--
-- Partial indexes idx_dishes_parent_dish_id / idx_dishes_is_parent (073) and
-- the dish_kind CHECK (115) are restored below with the columns.

BEGIN;

-- ── (1) dishes columns ────────────────────────────────────────────────────────

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS dish_kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS parent_dish_id uuid
    REFERENCES public.dishes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_per_person numeric
    GENERATED ALWAYS AS (
      CASE WHEN serves > 0 THEN ROUND(price / serves, 2) ELSE price END
    ) STORED;

-- dish_kind CHECK (verbatim from migration 115)
ALTER TABLE public.dishes
  DROP CONSTRAINT IF EXISTS dishes_dish_kind_check;
ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_dish_kind_check
  CHECK (dish_kind IN ('standard', 'bundle', 'configurable', 'course_menu', 'buffet'));

-- Partial indexes (verbatim from migration 073)
CREATE INDEX IF NOT EXISTS idx_dishes_parent_dish_id
  ON public.dishes (parent_dish_id) WHERE parent_dish_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dishes_is_parent
  ON public.dishes (is_parent) WHERE is_parent = false;

-- ── (2) dish_courses + dish_course_items (verbatim from migration 114) ───────

CREATE TABLE IF NOT EXISTS public.dish_courses (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_dish_id uuid    NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  course_number  int     NOT NULL CHECK (course_number >= 1),
  course_name    text,
  required_count int     NOT NULL DEFAULT 1,
  choice_type    text    NOT NULL CHECK (choice_type IN ('fixed', 'one_of')),
  created_at     timestamptz DEFAULT now(),
  UNIQUE (parent_dish_id, course_number)
);

COMMENT ON TABLE public.dish_courses IS
  'Ordered courses within a course_menu dish. Each course groups one or more selectable items.';

CREATE TABLE IF NOT EXISTS public.dish_course_items (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid    NOT NULL REFERENCES public.dish_courses(id) ON DELETE CASCADE,
  option_label      text    NOT NULL,
  price_delta       numeric NOT NULL DEFAULT 0,
  links_to_dish_id  uuid    REFERENCES public.dishes(id) ON DELETE SET NULL,
  sort_order        int     NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

COMMENT ON TABLE public.dish_course_items IS
  'Items within a dish_course. For fixed courses there is one item; for one_of courses there are multiple.';

CREATE INDEX IF NOT EXISTS idx_dish_courses_parent
  ON public.dish_courses (parent_dish_id, course_number);

CREATE INDEX IF NOT EXISTS idx_dish_course_items_course
  ON public.dish_course_items (course_id, sort_order);

ALTER TABLE public.dish_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read dish_courses" ON public.dish_courses;
CREATE POLICY "Public read dish_courses"
  ON public.dish_courses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can write own dish_courses" ON public.dish_courses;
CREATE POLICY "Owners can write own dish_courses"
  ON public.dish_courses FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dishes d
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE d.id = dish_courses.parent_dish_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dishes d
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE d.id = dish_courses.parent_dish_id AND r.owner_id = auth.uid()
    )
  );

ALTER TABLE public.dish_course_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read dish_course_items" ON public.dish_course_items;
CREATE POLICY "Public read dish_course_items"
  ON public.dish_course_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can write own dish_course_items" ON public.dish_course_items;
CREATE POLICY "Owners can write own dish_course_items"
  ON public.dish_course_items FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dish_courses dc
      JOIN public.dishes d ON d.id = dc.parent_dish_id
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE dc.id = dish_course_items.course_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dish_courses dc
      JOIN public.dishes d ON d.id = dc.parent_dish_id
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE dc.id = dish_course_items.course_id AND r.owner_id = auth.uid()
    )
  );

COMMIT;

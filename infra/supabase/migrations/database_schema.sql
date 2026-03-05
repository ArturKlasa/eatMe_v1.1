-- =============================================================================
-- EATME DATABASE SCHEMA — REFERENCE SNAPSHOT
-- =============================================================================
-- Purpose  : Ground-truth reference for the live Supabase database.
--            Use this file to understand the actual schema instead of reading
--            the individual migrations (many are duplicated/superseded).
-- Usage    : Read-only. Do NOT run this file. Apply changes via numbered
--            migration files in this directory.
-- Updated  : 2026-03-05
-- WARNING  : Table order and constraints may not be valid for direct execution.
--
-- KEY RELATIONSHIPS (simplified)
-- --------------------------------
-- restaurants
--   └─ menus              (restaurant_id FK)
--       └─ menu_categories  (menu_id FK, ON DELETE CASCADE from menus)
--           └─ dishes       (menu_category_id FK, NO CASCADE — delete manually)
--
-- dishes.menu_category_id  → menu_categories.id   (nullable, NO ON DELETE CASCADE)
-- dishes.restaurant_id     → restaurants.id       (ON DELETE CASCADE)
-- dishes.dish_category_id  → dish_categories.id   (ON DELETE SET NULL)
--
-- restaurants.location is JSONB { lat, lng } — NOT a PostGIS POINT column.
-- A computed column location_point (geography) is derived from it automatically.
--
-- user_preferences stores mobile consumer dietary settings.
-- users mirrors auth.users with extra profile fields.
-- =============================================================================

CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id)
);
CREATE TABLE public.allergens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  severity text CHECK (severity = ANY (ARRAY['major'::text, 'minor'::text])),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT allergens_pkey PRIMARY KEY (id)
);
CREATE TABLE public.canonical_ingredient_allergens (
  canonical_ingredient_id uuid NOT NULL,
  allergen_id uuid NOT NULL,
  CONSTRAINT canonical_ingredient_allergens_pkey PRIMARY KEY (canonical_ingredient_id, allergen_id),
  CONSTRAINT canonical_ingredient_allergens_canonical_ingredient_id_fkey FOREIGN KEY (canonical_ingredient_id) REFERENCES public.canonical_ingredients(id),
  CONSTRAINT canonical_ingredient_allergens_allergen_id_fkey FOREIGN KEY (allergen_id) REFERENCES public.allergens(id)
);
CREATE TABLE public.canonical_ingredient_dietary_tags (
  canonical_ingredient_id uuid NOT NULL,
  dietary_tag_id uuid NOT NULL,
  CONSTRAINT canonical_ingredient_dietary_tags_pkey PRIMARY KEY (canonical_ingredient_id, dietary_tag_id),
  CONSTRAINT canonical_ingredient_dietary_tags_canonical_ingredient_id_fkey FOREIGN KEY (canonical_ingredient_id) REFERENCES public.canonical_ingredients(id),
  CONSTRAINT canonical_ingredient_dietary_tags_dietary_tag_id_fkey FOREIGN KEY (dietary_tag_id) REFERENCES public.dietary_tags(id)
);
CREATE TABLE public.canonical_ingredients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  canonical_name text NOT NULL UNIQUE,
  is_vegetarian boolean DEFAULT true,
  is_vegan boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ingredient_family_name text NOT NULL DEFAULT 'other'::text,
  CONSTRAINT canonical_ingredients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dietary_tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  category text CHECK (category = ANY (ARRAY['diet'::text, 'religious'::text, 'lifestyle'::text, 'health'::text])),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dietary_tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dish_analytics (
  dish_id uuid NOT NULL,
  view_count integer DEFAULT 0,
  right_swipe_count integer DEFAULT 0,
  left_swipe_count integer DEFAULT 0,
  super_like_count integer DEFAULT 0,
  favorite_count integer DEFAULT 0,
  order_count integer DEFAULT 0,
  engagement_rate double precision,
  popularity_score double precision,
  recent_views_24h integer DEFAULT 0,
  recent_swipes_24h integer DEFAULT 0,
  is_trending boolean DEFAULT false,
  last_updated_at timestamp with time zone DEFAULT now(),
  first_tracked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dish_analytics_pkey PRIMARY KEY (dish_id),
  CONSTRAINT dish_analytics_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id)
);
CREATE TABLE public.dish_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  parent_category_id uuid,
  is_drink boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dish_categories_pkey PRIMARY KEY (id),
  CONSTRAINT dish_categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.dish_categories(id)
);
CREATE TABLE public.dish_ingredients (
  dish_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dish_ingredients_pkey PRIMARY KEY (dish_id, ingredient_id),
  CONSTRAINT dish_ingredients_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id),
  CONSTRAINT dish_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.canonical_ingredients(id)
);
CREATE TABLE public.dish_opinions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dish_id uuid NOT NULL,
  visit_id uuid,
  opinion text NOT NULL CHECK (opinion = ANY (ARRAY['liked'::text, 'okay'::text, 'disliked'::text])),
  tags ARRAY DEFAULT '{}'::text[],
  photo_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dish_opinions_pkey PRIMARY KEY (id),
  CONSTRAINT dish_opinions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT dish_opinions_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id),
  CONSTRAINT dish_opinions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.user_visits(id),
  CONSTRAINT dish_opinions_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.dish_photos(id)
);
CREATE TABLE public.dish_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL,
  user_id uuid NOT NULL,
  photo_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dish_photos_pkey PRIMARY KEY (id),
  CONSTRAINT dish_photos_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id),
  CONSTRAINT dish_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.dishes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  menu_category_id uuid,
  name text NOT NULL DEFAULT ''::text,
  description text,
  price numeric NOT NULL DEFAULT 0,
  dietary_tags ARRAY DEFAULT ARRAY[]::text[],
  allergens ARRAY DEFAULT ARRAY[]::text[],
  ingredients ARRAY DEFAULT ARRAY[]::text[],
  calories integer,
  spice_level smallint CHECK (spice_level >= 0 AND spice_level <= 4),
  image_url text,
  is_available boolean DEFAULT true,
  dish_category_id uuid,
  description_visibility text NOT NULL DEFAULT 'menu'::text CHECK (description_visibility = ANY (ARRAY['menu'::text, 'detail'::text])),
  ingredients_visibility text NOT NULL DEFAULT 'detail'::text CHECK (ingredients_visibility = ANY (ARRAY['menu'::text, 'detail'::text, 'none'::text])),
  CONSTRAINT dishes_pkey PRIMARY KEY (id),
  CONSTRAINT dishes_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT dishes_menu_id_fkey FOREIGN KEY (menu_category_id) REFERENCES public.menu_categories(id),
  CONSTRAINT dishes_dish_category_id_fkey FOREIGN KEY (dish_category_id) REFERENCES public.dish_categories(id)
);
CREATE TABLE public.eat_together_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_host boolean DEFAULT false,
  current_location USER-DEFINED,
  joined_at timestamp with time zone DEFAULT now(),
  left_at timestamp with time zone,
  CONSTRAINT eat_together_members_pkey PRIMARY KEY (id),
  CONSTRAINT eat_together_members_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.eat_together_sessions(id),
  CONSTRAINT eat_together_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.eat_together_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  compatibility_score integer NOT NULL,
  distance_from_center double precision,
  members_satisfied integer NOT NULL,
  total_members integer NOT NULL,
  dietary_compatibility jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT eat_together_recommendations_pkey PRIMARY KEY (id),
  CONSTRAINT eat_together_recommendations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.eat_together_sessions(id),
  CONSTRAINT eat_together_recommendations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.eat_together_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  session_code text NOT NULL UNIQUE CHECK (length(session_code) = 6),
  status USER-DEFINED DEFAULT 'waiting'::session_status,
  location_mode USER-DEFINED DEFAULT 'host_location'::location_mode,
  selected_restaurant_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '03:00:00'::interval),
  closed_at timestamp with time zone,
  CONSTRAINT eat_together_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT eat_together_sessions_host_id_fkey FOREIGN KEY (host_id) REFERENCES auth.users(id),
  CONSTRAINT eat_together_sessions_selected_restaurant_id_fkey FOREIGN KEY (selected_restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.eat_together_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT eat_together_votes_pkey PRIMARY KEY (id),
  CONSTRAINT eat_together_votes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.eat_together_sessions(id),
  CONSTRAINT eat_together_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT eat_together_votes_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.ingredient_aliases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  display_name text NOT NULL UNIQUE,
  canonical_ingredient_id uuid NOT NULL,
  search_vector tsvector,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  language text NOT NULL DEFAULT 'en'::text,
  CONSTRAINT ingredient_aliases_pkey PRIMARY KEY (id),
  CONSTRAINT ingredient_aliases_canonical_ingredient_id_fkey FOREIGN KEY (canonical_ingredient_id) REFERENCES public.canonical_ingredients(id)
);
CREATE TABLE public.ingredient_allergens (
  ingredient_id uuid NOT NULL,
  allergen_id uuid NOT NULL,
  confidence text DEFAULT 'confirmed'::text CHECK (confidence = ANY (ARRAY['confirmed'::text, 'possible'::text, 'trace'::text])),
  CONSTRAINT ingredient_allergens_pkey PRIMARY KEY (ingredient_id, allergen_id),
  CONSTRAINT ingredient_allergens_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients_master(id),
  CONSTRAINT ingredient_allergens_allergen_id_fkey FOREIGN KEY (allergen_id) REFERENCES public.allergens(id)
);
CREATE TABLE public.ingredient_dietary_tags (
  ingredient_id uuid NOT NULL,
  dietary_tag_id uuid NOT NULL,
  CONSTRAINT ingredient_dietary_tags_pkey PRIMARY KEY (ingredient_id, dietary_tag_id),
  CONSTRAINT ingredient_dietary_tags_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients_master(id),
  CONSTRAINT ingredient_dietary_tags_dietary_tag_id_fkey FOREIGN KEY (dietary_tag_id) REFERENCES public.dietary_tags(id)
);
CREATE TABLE public.ingredients_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  is_vegetarian boolean DEFAULT true,
  is_vegan boolean DEFAULT false,
  search_vector tsvector,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ingredients_master_pkey PRIMARY KEY (id)
);
CREATE TABLE public.menu_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text NOT NULL DEFAULT ''::text,
  description text,
  type text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  menu_id uuid,
  CONSTRAINT menu_categories_pkey PRIMARY KEY (id),
  CONSTRAINT menu_categories_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menus(id),
  CONSTRAINT menus_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.menu_scan_jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  created_by uuid,
  image_count smallint NOT NULL DEFAULT 1,
  image_filenames ARRAY DEFAULT ARRAY[]::text[],
  image_storage_paths ARRAY DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'processing'::text CHECK (status = ANY (ARRAY['processing'::text, 'needs_review'::text, 'completed'::text, 'failed'::text])),
  result_json jsonb,
  error_message text,
  dishes_found integer DEFAULT 0,
  dishes_saved integer DEFAULT 0,
  processing_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT menu_scan_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT menu_scan_jobs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT menu_scan_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.menus (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  available_start_time time without time zone,
  available_end_time time without time zone,
  available_days ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  menu_type text NOT NULL DEFAULT 'food'::text CHECK (menu_type = ANY (ARRAY['food'::text, 'drink'::text])),
  CONSTRAINT menus_pkey PRIMARY KEY (id),
  CONSTRAINT menus_new_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_experience_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  visit_id uuid,
  question_type text NOT NULL CHECK (question_type = ANY (ARRAY['service_friendly'::text, 'clean'::text, 'wait_time_reasonable'::text, 'would_recommend'::text, 'good_value'::text])),
  response boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_experience_responses_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_experience_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT restaurant_experience_responses_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_experience_responses_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.user_visits(id)
);
CREATE TABLE public.restaurants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  restaurant_type text,
  country_code text,
  city text,
  postal_code text,
  phone text,
  website text,
  cuisine_types ARRAY DEFAULT ARRAY[]::text[],
  open_hours jsonb DEFAULT '{}'::jsonb,
  delivery_available boolean DEFAULT true,
  takeout_available boolean DEFAULT true,
  dine_in_available boolean DEFAULT true,
  accepts_reservations boolean DEFAULT false,
  service_speed text CHECK (service_speed = ANY (ARRAY['fast-food'::text, 'regular'::text])),
  rating numeric DEFAULT 0.00,
  image_url text,
  description text,
  owner_id uuid,
  location jsonb NOT NULL,
  is_active boolean DEFAULT true,
  suspended_at timestamp with time zone,
  suspended_by uuid,
  suspension_reason text,
  location_point USER-DEFINED DEFAULT (st_setsrid(st_makepoint(((location ->> 'lng'::text))::double precision, ((location ->> 'lat'::text))::double precision), 4326))::geography,
  neighbourhood text,
  state text,
  CONSTRAINT restaurants_pkey PRIMARY KEY (id),
  CONSTRAINT restaurants_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id),
  CONSTRAINT restaurants_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES auth.users(id)
);
CREATE TABLE public.security_documentation (
  id integer NOT NULL DEFAULT nextval('security_documentation_id_seq'::regclass),
  category text NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT security_documentation_pkey PRIMARY KEY (id)
);
CREATE TABLE public.session_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['restaurant'::text, 'dish'::text, 'menu'::text])),
  entity_id uuid NOT NULL,
  viewed_at timestamp with time zone DEFAULT now(),
  duration_seconds integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT session_views_pkey PRIMARY KEY (id),
  CONSTRAINT session_views_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_sessions(id),
  CONSTRAINT session_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.user_behavior_profiles (
  user_id uuid NOT NULL,
  total_swipes integer DEFAULT 0,
  right_swipes integer DEFAULT 0,
  left_swipes integer DEFAULT 0,
  super_swipes integer DEFAULT 0,
  right_swipe_rate double precision DEFAULT 
CASE
    WHEN (total_swipes > 0) THEN ((right_swipes)::double precision / (total_swipes)::double precision)
    ELSE (0)::double precision
END,
  preferred_cuisines ARRAY DEFAULT ARRAY[]::text[],
  preferred_dish_types ARRAY DEFAULT ARRAY[]::text[],
  preferred_price_range ARRAY,
  avg_calories_viewed integer,
  preferred_dietary_tags ARRAY DEFAULT ARRAY[]::text[],
  avg_view_duration integer,
  most_active_time_of_day text,
  favorite_dish_ids ARRAY DEFAULT ARRAY[]::uuid[],
  last_active_at timestamp with time zone DEFAULT now(),
  profile_updated_at timestamp with time zone DEFAULT now(),
  profile_version integer DEFAULT 1,
  CONSTRAINT user_behavior_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_behavior_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_dish_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dish_id uuid NOT NULL,
  interaction_type text NOT NULL CHECK (interaction_type = ANY (ARRAY['viewed'::text, 'liked'::text, 'disliked'::text, 'ordered'::text, 'saved'::text])),
  session_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_dish_interactions_pkey PRIMARY KEY (id),
  CONSTRAINT user_dish_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_dish_interactions_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id)
);
CREATE TABLE public.user_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['dish_rating'::text, 'dish_tags'::text, 'dish_photo'::text, 'restaurant_question'::text, 'first_rating_bonus'::text, 'weekly_streak_bonus'::text, 'photo_views_milestone'::text])),
  reference_id uuid,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_points_pkey PRIMARY KEY (id),
  CONSTRAINT user_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL,
  diet_preference text DEFAULT 'all'::text CHECK (diet_preference = ANY (ARRAY['all'::text, 'vegetarian'::text, 'vegan'::text])),
  allergies jsonb DEFAULT '{"soy": false, "nuts": false, "gluten": false, "sesame": false, "lactose": false, "peanuts": false, "shellfish": false}'::jsonb,
  exclude jsonb DEFAULT '{"noEggs": false, "noFish": false, "noMeat": false, "noDairy": false, "noSpicy": false, "noSeafood": false}'::jsonb,
  diet_types jsonb DEFAULT '{"keto": false, "paleo": false, "lowCarb": false, "diabetic": false, "pescatarian": false}'::jsonb,
  religious_restrictions jsonb DEFAULT '{"jain": false, "halal": false, "hindu": false, "kosher": false, "buddhist": false}'::jsonb,
  default_max_distance integer DEFAULT 5,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  protein_preferences jsonb DEFAULT '[]'::jsonb,
  favorite_cuisines jsonb DEFAULT '[]'::jsonb,
  favorite_dishes jsonb DEFAULT '[]'::jsonb,
  spice_tolerance text DEFAULT 'medium'::text CHECK (spice_tolerance = ANY (ARRAY['none'::text, 'mild'::text, 'medium'::text, 'spicy'::text, 'very_spicy'::text])),
  service_preferences jsonb DEFAULT '{"dine_in": true, "takeout": true, "delivery": true}'::jsonb,
  meal_times jsonb DEFAULT '[]'::jsonb,
  dining_occasions jsonb DEFAULT '[]'::jsonb,
  onboarding_completed boolean DEFAULT false,
  onboarding_completed_at timestamp with time zone,
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_swipes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  dish_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['left'::text, 'right'::text, 'super'::text])),
  view_duration integer,
  position_in_feed integer,
  session_id text,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_swipes_pkey PRIMARY KEY (id),
  CONSTRAINT user_swipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_swipes_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id)
);
CREATE TABLE public.user_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  session_id uuid,
  visited_at timestamp with time zone DEFAULT now(),
  confirmed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_visits_pkey PRIMARY KEY (id),
  CONSTRAINT user_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_visits_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT user_visits_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_sessions(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  roles ARRAY DEFAULT ARRAY['consumer'::user_roles],
  profile_name text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
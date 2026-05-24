import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { menuScanJobInputSchema } from '@eatme/shared';
import { createServerClient, createAdminServiceClient } from '@/lib/supabase/server';

export const verifySession = cache(async () => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect('/signin');
  return { userId: data!.claims.sub, claims: data!.claims };
});

export const verifyAdminSession = cache(async () => {
  const session = await verifySession();
  if (session.claims.app_metadata?.role !== 'admin') redirect('/signin?forbidden=1');
  return session;
});

export function isAdmin(user: User): boolean {
  return user.app_metadata?.role === 'admin';
}

export type AdminRestaurantRow = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  is_active: boolean;
  owner_id: string | null;
  owner_email: string;
  created_at: string | null;
  total_count: number;
};

type AdminRestaurantsRpc = {
  rpc: (
    name: 'get_admin_restaurants',
    args: {
      p_search: string | null;
      p_status: string | null;
      p_is_active: boolean | null;
      p_city: string | null;
      p_limit: number;
      p_offset: number;
    }
  ) => Promise<{ data: AdminRestaurantRow[] | null; error: unknown }>;
};

export async function getAdminRestaurants(params: {
  search?: string;
  status?: string;
  is_active?: boolean;
  city?: string;
  page?: number;
  limit?: number;
}): Promise<{ rows: AdminRestaurantRow[]; total: number }> {
  const supabase = await createServerClient();
  const { search, status, is_active, city, page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  const { data, error } = await (supabase as unknown as AdminRestaurantsRpc).rpc(
    'get_admin_restaurants',
    {
      p_search: search ?? null,
      p_status: status ?? null,
      p_is_active: is_active ?? null,
      p_city: city ?? null,
      p_limit: limit,
      p_offset: offset,
    }
  );

  if (error) {
    console.error('[getAdminRestaurants] RPC error:', error);
    return { rows: [], total: 0 };
  }
  if (!data) return { rows: [], total: 0 };
  const total = Number(data[0]?.total_count ?? 0);
  return { rows: data, total };
}

export type AdminRestaurantDetail = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string | null;
  state: string | null;
  country_code: string | null;
  postal_code: string | null;
  neighbourhood: string | null;
  location: unknown;
  phone: string | null;
  website: string | null;
  cuisine_types: string[] | null;
  restaurant_type: string | null;
  open_hours: unknown | null;
  delivery_available: boolean | null;
  takeout_available: boolean | null;
  dine_in_available: boolean | null;
  accepts_reservations: boolean | null;
  status: string;
  is_active: boolean;
  suspended_at: string | null;
  suspended_by: string | null;
  suspension_reason: string | null;
  owner_id: string | null;
  image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const RESTAURANT_DETAIL_COLS = [
  'id',
  'name',
  'description',
  'address',
  'city',
  'state',
  'country_code',
  'postal_code',
  'neighbourhood',
  'location',
  'phone',
  'website',
  'cuisine_types',
  'restaurant_type',
  'open_hours',
  'delivery_available',
  'takeout_available',
  'dine_in_available',
  'accepts_reservations',
  'status',
  'is_active',
  'suspended_at',
  'suspended_by',
  'suspension_reason',
  'owner_id',
  'image_url',
  'created_at',
  'updated_at',
].join(', ');

export async function getAdminRestaurantById(id: string): Promise<AdminRestaurantDetail | null> {
  const supabase = createAdminServiceClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select(RESTAURANT_DETAIL_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as AdminRestaurantDetail;
}

// ── Menu Scan Jobs ─────────────────────────────────────────────────────────────

export type AdminMenuScanJobRow = {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  created_by: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminMenuScanJobDetail = AdminMenuScanJobRow & {
  input: unknown;
  result_json: unknown;
  locked_until: string | null;
  saved_dish_ids: unknown;
  saved_at: string | null;
  restaurant_country_code: string | null;
};

export type CanonicalCategoryOption = {
  id: string;
  slug: string;
  names: Record<string, string>;
};

export type RestaurantCategoryOption = {
  id: string;
  name: string;
  description: string | null;
  canonical_category_id: string | null;
  name_translations: Record<string, string>;
  description_translations: Record<string, string>;
};

export type DishCategoryOption = {
  id: string;
  name: string;
  is_drink: boolean;
};

export type MenuScanReviewContext = {
  existingCategories: RestaurantCategoryOption[];
  canonicalCategories: CanonicalCategoryOption[];
  dishCategories: DishCategoryOption[];
};

// Per-input fuzzy-match result. score is null when no match cleared the
// 0.7 threshold — caller treats as "AI suggested but unmatched" and surfaces
// it in the review UI.
export type DishCategoryMatch = {
  query: string;
  matched_id: string | null;
  matched_name: string | null;
  score: number | null;
};

export async function getAdminMenuScanJobs(params: {
  restaurantId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ rows: AdminMenuScanJobRow[]; total: number }> {
  const supabase = createAdminServiceClient();
  const { restaurantId, status, page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('menu_scan_jobs')
    .select(
      'id, restaurant_id, created_by, status, attempts, last_error, created_at, updated_at, restaurants!left(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (status) query = query.eq('status', status as any);

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };

  const rows: AdminMenuScanJobRow[] = data.map((row: Record<string, unknown>) => {
    const restaurant = row.restaurants as { name: string } | null;
    return {
      id: row.id as string,
      restaurant_id: row.restaurant_id as string,
      restaurant_name: restaurant?.name ?? null,
      created_by: row.created_by as string,
      status: row.status as string,
      attempts: row.attempts as number,
      last_error: (row.last_error as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      updated_at: (row.updated_at as string | null) ?? null,
    };
  });

  return { rows, total: count ?? 0 };
}

export async function getAdminMenuScanJobById(id: string): Promise<AdminMenuScanJobDetail | null> {
  const supabase = createAdminServiceClient();
  const { data, error } = await supabase
    .from('menu_scan_jobs')
    .select(
      'id, restaurant_id, created_by, status, attempts, last_error, created_at, updated_at, input, result_json, locked_until, saved_dish_ids, saved_at, restaurants!left(name, country_code)'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const restaurant = row.restaurants as { name: string; country_code: string | null } | null;

  return {
    id: row.id as string,
    restaurant_id: row.restaurant_id as string,
    restaurant_name: restaurant?.name ?? null,
    restaurant_country_code: restaurant?.country_code ?? null,
    created_by: row.created_by as string,
    status: row.status as string,
    attempts: row.attempts as number,
    last_error: (row.last_error as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
    input: row.input,
    result_json: row.result_json,
    locked_until: (row.locked_until as string | null) ?? null,
    saved_dish_ids: row.saved_dish_ids,
    saved_at: (row.saved_at as string | null) ?? null,
  };
}

// Loads everything the review UI needs for category resolution: this restaurant's
// existing menu_categories + the full active canonical_menu_categories taxonomy.
//
// canonical_menu_categories + new menu_categories columns aren't yet in the
// generated Database types — regenerate after applying migration 124. Cast to
// `any` here so the loose-typed queries don't break the rest of the file.
export async function getMenuScanReviewContext(
  restaurantId: string
): Promise<MenuScanReviewContext> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createAdminServiceClient() as any;

  const [existingRes, canonicalRes, dishCategoriesRes] = await Promise.all([
    svc
      .from('menu_categories')
      .select(
        'id, name, description, canonical_category_id, name_translations, description_translations'
      )
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    svc
      .from('canonical_menu_categories')
      .select('id, slug, names')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    svc
      .from('dish_categories')
      .select('id, name, is_drink')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  const existingCategories: RestaurantCategoryOption[] = (existingRes.data ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      canonical_category_id: (r.canonical_category_id as string | null) ?? null,
      name_translations: (r.name_translations as Record<string, string> | null) ?? {},
      description_translations: (r.description_translations as Record<string, string> | null) ?? {},
    })
  );

  const canonicalCategories: CanonicalCategoryOption[] = (canonicalRes.data ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      slug: r.slug as string,
      names: (r.names as Record<string, string> | null) ?? {},
    })
  );

  const dishCategories: DishCategoryOption[] = (dishCategoriesRes.data ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      is_drink: (r.is_drink as boolean | null) ?? false,
    })
  );

  return { existingCategories, canonicalCategories, dishCategories };
}

// getMenuScanJobImageUrls: signs the storage paths for a job's input.images
// so the admin review UI can show thumbnails of what was actually scanned.
// Used both for needs_review jobs (diagnose what the AI saw) and for
// completed/failed/processing jobs (post-mortem on partial extractions).
//
// 1h TTL is plenty for a review session. URLs aren't broadcast over Realtime
// — if admin leaves the page open past expiry, a hard refresh re-signs them.
//
// Returns [] if the job has no recorded input (pre-mig-118 rows or rows
// where input failed to validate against the schema).
export type MenuScanImageUrl = {
  page: number;
  url: string;
  path: string;
};

export async function getMenuScanJobImageUrls(jobId: string): Promise<MenuScanImageUrl[]> {
  const svc = createAdminServiceClient();

  const { data: job } = await svc
    .from('menu_scan_jobs')
    .select('input')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) return [];
  const parsed = menuScanJobInputSchema.safeParse((job as { input: unknown }).input);
  if (!parsed.success) return [];

  // Sign in parallel — for a typical job (≤20 pages, UI cap in
  // AdminBatchUploadForm) this stays comfortably under one round-trip's
  // worth of latency. Drop any image we can't sign rather than failing the
  // whole strip.
  const settled = await Promise.all(
    parsed.data.images.map(async img => {
      const { data, error } = await svc.storage.from(img.bucket).createSignedUrl(img.path, 3600);
      if (error || !data) return null;
      return { page: img.page, url: data.signedUrl, path: img.path };
    })
  );
  const results = settled.filter((r): r is MenuScanImageUrl => r !== null);
  results.sort((a, b) => a.page - b.page);
  return results;
}

// getCanonicalMenuCategoryOptions: standalone fetch of the active canonical
// taxonomy. Used by the restaurant-detail "+ Add category" surface, which
// doesn't need the rest of the review context. Mirrors the canonical fetch
// inside getMenuScanReviewContext above (kept as a separate function to
// avoid pulling in the unrelated existingCategories/dishCategories queries).
export async function getCanonicalMenuCategoryOptions(): Promise<CanonicalCategoryOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createAdminServiceClient() as any;
  const { data, error } = await svc
    .from('canonical_menu_categories')
    .select('id, slug, names')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(r => ({
    id: r.id as string,
    slug: r.slug as string,
    names: (r.names as Record<string, string> | null) ?? {},
  }));
}

// Resolves a list of free-text dish-category suggestions (from the worker's
// suggested_dish_category field) to dish_categories rows via the
// fuzzy_match_dish_category RPC. One RPC call per unique query — typical scans
// have ~10-30 unique values, so the round-trip cost is small.
export async function fuzzyMatchDishCategories(queries: string[]): Promise<DishCategoryMatch[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createAdminServiceClient() as any;

  const unique = Array.from(new Set(queries.map(q => q.trim()).filter(Boolean)));
  if (unique.length === 0) return [];

  const matches = await Promise.all(
    unique.map(async query => {
      const { data, error } = await svc.rpc('fuzzy_match_dish_category', { p_query: query });
      if (error || !data || data.length === 0) {
        return { query, matched_id: null, matched_name: null, score: null };
      }
      const row = data[0] as { id: string; name: string; score: number };
      return {
        query,
        matched_id: row.id,
        matched_name: row.name,
        score: row.score,
      };
    })
  );

  return matches;
}

export type RestaurantOption = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
};

export async function getAdminRestaurantOptions(): Promise<RestaurantOption[]> {
  const supabase = createAdminServiceClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, city, address')
    .eq('skip_menu_scan', false)
    .neq('status', 'published')
    .order('name')
    .limit(200);
  if (error || !data) return [];
  return data as RestaurantOption[];
}

// ── Restaurant Menus (admin verifier view) ────────────────────────────────────

export type AdminMenuCourseItem = {
  id: string;
  option_label: string;
  price_delta: number;
  sort_order: number;
};

export type AdminMenuCourse = {
  id: string;
  course_number: number;
  course_name: string | null;
  choice_type: 'fixed' | 'one_of';
  required_count: number;
  items: AdminMenuCourseItem[];
};

export type AdminMenuModifierOption = {
  id: string;
  name: string;
  price_delta: number;
  price_override: number | null;
  primary_protein: string | null;
  removes_dietary_tags: string[];
  adds_allergens: string[];
  serves_delta: number;
  is_default: boolean;
};

export type AdminMenuModifierGroup = {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections: number;
  max_selections: number;
  display_in_card: boolean;
  options: AdminMenuModifierOption[];
};

export type AdminMenuDish = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  status: string;
  is_available: boolean | null;
  is_template: boolean;
  // dish_kind retained through Phase 7. New rows default to 'standard'; the
  // dining_format field below is the source of truth for new code.
  dish_kind: string;
  primary_protein: string | null;
  menu_category_id: string | null;
  dish_category_id: string | null;
  dish_category_name: string | null;
  source_image_index: number | null;
  serves: number | null;
  is_parent: boolean;
  parent_dish_id: string | null;
  display_price_prefix: string;
  // New flat model (Phase 4):
  dining_format: string | null;
  bundled_items: Array<{ name: string; note?: string | null }> | null;
  modifier_groups: AdminMenuModifierGroup[];
  // Legacy variants/courses kept for display until Phase 7 drops the tables.
  variants: AdminMenuDish[];
  courses: AdminMenuCourse[];
};

export type AdminMenuCategory = {
  id: string;
  menu_id: string | null;
  name: string;
  description: string | null;
  display_order: number | null;
  is_active: boolean;
  canonical_category_id: string | null;
  source_language_code: string | null;
  name_translations: Record<string, string>;
  description_translations: Record<string, string>;
  dishes: AdminMenuDish[];
};

export type AdminMenu = {
  id: string;
  name: string;
  description: string | null;
  menu_type: string;
  status: string;
  is_active: boolean;
  display_order: number | null;
  categories: AdminMenuCategory[];
};

export type AdminRestaurantMenus = {
  menus: AdminMenu[];
  // Dishes whose menu_category_id is NULL — they have no link to any menu in
  // the schema, so we surface them as a top-level orphan list rather than
  // attaching them to an arbitrary menu (which would mislead the admin).
  uncategorizedDishes: AdminMenuDish[];
};

// Loads the full menus → categories → dishes hierarchy for the admin verifier
// view. Unlike the owner-portal fetcher, this includes draft/archived rows and
// is_active=false rows — admins need to see the full state, not just what
// consumers see.
export async function getAdminRestaurantMenus(restaurantId: string): Promise<AdminRestaurantMenus> {
  // canonical_menu_categories columns + status on menus aren't always in the
  // generated Database types depending on when they were last regenerated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createAdminServiceClient() as any;

  // Three independent queries; cheaper to issue in parallel than to nest.
  // Dishes query no longer filters out parents — multi-kind dishes (bundle,
  // configurable, course_menu) need their parent rows surfaced so admins can
  // see + edit the full structure. Variant children are nested under parents
  // post-fetch; courses are loaded in a follow-up query keyed by parent ids.
  const [menusRes, categoriesRes, dishesRes] = await Promise.all([
    svc
      .from('menus')
      .select('id, name, description, menu_type, status, is_active, display_order')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    svc
      .from('menu_categories')
      .select(
        'id, menu_id, name, description, display_order, is_active, canonical_category_id, source_language_code, name_translations, description_translations'
      )
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    svc
      .from('dishes')
      .select(
        'id, name, description, price, status, is_available, is_template, dish_kind, primary_protein, menu_category_id, dish_category_id, source_image_index, serves, is_parent, parent_dish_id, display_price_prefix, dining_format, bundled_items, dish_categories!left(id, name)'
      )
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true }),
  ]);

  const rawDishes: AdminMenuDish[] = (dishesRes.data ?? []).map((r: Record<string, unknown>) => {
    const dc = r.dish_categories as { id: string; name: string } | null;
    return {
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      price: (r.price as number | null) ?? null,
      status: r.status as string,
      is_available: (r.is_available as boolean | null) ?? null,
      is_template: (r.is_template as boolean | null) ?? false,
      dish_kind: r.dish_kind as string,
      primary_protein: (r.primary_protein as string | null) ?? null,
      menu_category_id: (r.menu_category_id as string | null) ?? null,
      dish_category_id: (r.dish_category_id as string | null) ?? null,
      dish_category_name: dc?.name ?? null,
      source_image_index: (r.source_image_index as number | null) ?? null,
      serves: (r.serves as number | null) ?? null,
      is_parent: (r.is_parent as boolean | null) ?? false,
      parent_dish_id: (r.parent_dish_id as string | null) ?? null,
      display_price_prefix: (r.display_price_prefix as string | null) ?? 'exact',
      dining_format: (r.dining_format as string | null) ?? null,
      bundled_items:
        (r.bundled_items as Array<{ name: string; note?: string | null }> | null) ?? null,
      modifier_groups: [],
      variants: [],
      courses: [],
    };
  });

  // Load modifier groups + options for all dishes in this restaurant. One
  // batched query keyed by dish_id IN (...). Empty when there are no dishes.
  if (rawDishes.length > 0) {
    const dishIds = rawDishes.map(d => d.id);
    const { data: groupRows, error: groupError } = await svc
      .from('option_groups')
      .select(
        'id, dish_id, name, selection_type, min_selections, max_selections, display_in_card, display_order, options(id, name, price_delta, price_override, primary_protein, removes_dietary_tags, adds_allergens, serves_delta, is_default, display_order)'
      )
      .in('dish_id', dishIds)
      .order('display_order', { ascending: true });

    if (groupError) {
      console.error('[getAdminRestaurantMenus] option_groups load failed:', groupError);
    }

    const groupsByDish = new Map<string, AdminMenuModifierGroup[]>();
    for (const g of (groupRows ?? []) as Array<Record<string, unknown>>) {
      const dishId = g.dish_id as string;
      const opts = (
        ((g.options as Array<Record<string, unknown>>) ?? []).map(o => ({
          id: o.id as string,
          name: o.name as string,
          price_delta: (o.price_delta as number | null) ?? 0,
          price_override: (o.price_override as number | null) ?? null,
          primary_protein: (o.primary_protein as string | null) ?? null,
          removes_dietary_tags: (o.removes_dietary_tags as string[] | null) ?? [],
          adds_allergens: (o.adds_allergens as string[] | null) ?? [],
          serves_delta: (o.serves_delta as number | null) ?? 0,
          is_default: (o.is_default as boolean | null) ?? false,
          display_order: (o.display_order as number | null) ?? 0,
        })) as Array<AdminMenuModifierOption & { display_order: number }>
      ).sort((a, b) => a.display_order - b.display_order);
      const arr = groupsByDish.get(dishId) ?? [];
      arr.push({
        id: g.id as string,
        name: g.name as string,
        selection_type: g.selection_type as 'single' | 'multiple',
        min_selections: (g.min_selections as number | null) ?? 0,
        max_selections: (g.max_selections as number | null) ?? 1,
        display_in_card: (g.display_in_card as boolean | null) ?? false,
        options: opts.map(({ display_order: _drop, ...rest }) => rest),
      });
      groupsByDish.set(dishId, arr);
    }
    for (const d of rawDishes) {
      d.modifier_groups = groupsByDish.get(d.id) ?? [];
    }
  }

  // Load courses + items for course_menu parents in a separate batched query.
  // Scoping by parent_dish_id IN (...) avoids fetching course rows for
  // restaurants the admin isn't viewing.
  const courseMenuParentIds = rawDishes
    .filter(d => d.is_parent && d.dish_kind === 'course_menu')
    .map(d => d.id);

  const coursesByParent = new Map<string, AdminMenuCourse[]>();
  if (courseMenuParentIds.length > 0) {
    const { data: courseRows } = await svc
      .from('dish_courses')
      .select(
        'id, parent_dish_id, course_number, course_name, choice_type, required_count, dish_course_items(id, option_label, price_delta, sort_order)'
      )
      .in('parent_dish_id', courseMenuParentIds)
      .order('course_number', { ascending: true });

    for (const c of (courseRows ?? []) as Array<Record<string, unknown>>) {
      const items = ((c.dish_course_items as Array<Record<string, unknown>>) ?? [])
        .map(it => ({
          id: it.id as string,
          option_label: it.option_label as string,
          price_delta: (it.price_delta as number | null) ?? 0,
          sort_order: (it.sort_order as number | null) ?? 0,
        }))
        .sort((a, b) => a.sort_order - b.sort_order);
      const parentId = c.parent_dish_id as string;
      const arr = coursesByParent.get(parentId) ?? [];
      arr.push({
        id: c.id as string,
        course_number: c.course_number as number,
        course_name: (c.course_name as string | null) ?? null,
        choice_type: c.choice_type as 'fixed' | 'one_of',
        required_count: (c.required_count as number | null) ?? 1,
        items,
      });
      coursesByParent.set(parentId, arr);
    }
  }

  // Group variant children under their parent. Top-level dishes (no parent)
  // keep an empty variants[]; parents collect their children via parent_dish_id.
  const variantsByParent = new Map<string, AdminMenuDish[]>();
  for (const d of rawDishes) {
    if (d.parent_dish_id == null) continue;
    const arr = variantsByParent.get(d.parent_dish_id) ?? [];
    arr.push(d);
    variantsByParent.set(d.parent_dish_id, arr);
  }

  for (const d of rawDishes) {
    if (d.is_parent) {
      d.variants = variantsByParent.get(d.id) ?? [];
      d.courses = coursesByParent.get(d.id) ?? [];
    }
  }

  // Top-level dishes only — variant children render through their parent.
  const topLevelDishes = rawDishes.filter(d => d.parent_dish_id == null);

  // Bucket dishes by menu_category_id; orphans (NULL) go to a separate list.
  const dishesByCategory = new Map<string, AdminMenuDish[]>();
  const uncategorizedDishes: AdminMenuDish[] = [];
  for (const d of topLevelDishes) {
    if (d.menu_category_id == null) {
      uncategorizedDishes.push(d);
    } else {
      const arr = dishesByCategory.get(d.menu_category_id) ?? [];
      arr.push(d);
      dishesByCategory.set(d.menu_category_id, arr);
    }
  }

  const categoryRows: AdminMenuCategory[] = (categoriesRes.data ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      menu_id: (r.menu_id as string | null) ?? null,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      display_order: (r.display_order as number | null) ?? null,
      is_active: (r.is_active as boolean | null) ?? true,
      canonical_category_id: (r.canonical_category_id as string | null) ?? null,
      source_language_code: (r.source_language_code as string | null) ?? null,
      name_translations: (r.name_translations as Record<string, string> | null) ?? {},
      description_translations: (r.description_translations as Record<string, string> | null) ?? {},
      dishes: dishesByCategory.get(r.id as string) ?? [],
    })
  );

  // Bucket categories by menu_id.
  const categoriesByMenu = new Map<string, AdminMenuCategory[]>();
  for (const c of categoryRows) {
    if (c.menu_id == null) continue;
    const arr = categoriesByMenu.get(c.menu_id) ?? [];
    arr.push(c);
    categoriesByMenu.set(c.menu_id, arr);
  }

  const menus: AdminMenu[] = (menusRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    menu_type: r.menu_type as string,
    status: r.status as string,
    is_active: (r.is_active as boolean | null) ?? true,
    display_order: (r.display_order as number | null) ?? null,
    categories: categoriesByMenu.get(r.id as string) ?? [],
  }));

  return { menus, uncategorizedDishes };
}

// All dish_categories for the global filter taxonomy. Used to populate the
// dish-category dropdown in the admin menu editor. Returns active rows only —
// inactive categories aren't valid choices for an edit.
export async function getAllDishCategoryOptions(): Promise<DishCategoryOption[]> {
  const supabase = createAdminServiceClient();
  const { data, error } = await supabase
    .from('dish_categories')
    .select('id, name, is_drink')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data.map(r => ({
    id: r.id as string,
    name: r.name as string,
    is_drink: (r.is_drink as boolean | null) ?? false,
  }));
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export type AdminAuditLogRow = {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
};

export async function getAdminAuditLog(params: {
  actorEmail?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<{ rows: AdminAuditLogRow[]; total: number }> {
  const supabase = createAdminServiceClient();
  const { actorEmail, action, dateFrom, dateTo, page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('admin_audit_log')
    .select(
      'id, admin_id, admin_email, action, resource_type, resource_id, old_data, new_data, created_at',
      {
        count: 'exact',
      }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorEmail) query = query.eq('admin_email', actorEmail);
  if (action) query = query.eq('action', action);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) {
    // inclusive end: add one day so that dateTo is included
    const endDate = new Date(dateTo);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt('created_at', endDate.toISOString());
  }

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };

  return { rows: data as AdminAuditLogRow[], total: count ?? 0 };
}

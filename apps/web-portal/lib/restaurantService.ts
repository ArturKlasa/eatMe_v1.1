/**
 * Restaurant Service
 *
 * All Supabase data operations for the restaurant partner portal.
 * Page components should import from here rather than calling supabase directly,
 * keeping pages thin (UI only) and DB logic testable in isolation.
 */

import {
  supabase,
  formatLocationForSupabase,
  formatOperatingHours,
  type RestaurantInsert,
} from './supabase';
import { addDishIngredients } from './ingredients';
import type {
  FormProgress,
  Menu as AppMenu,
  RestaurantType,
  Location as AppLocation,
  SelectedIngredient,
} from '@/types/restaurant';

// ─── Shared types ──────────────────────────────────────────────────────────────

/** Minimal restaurant shape used by the dashboard stats panel. */
export type DashboardRestaurant = {
  id: string;
  name: string;
  address: string | null;
  cuisine_types: string[] | null;
  menus?: Array<{
    id: string;
    name: string;
    menu_categories?: Array<{ id: string; dishes?: Array<{ id: string }> }>;
  }>;
};

/** Flat restaurant row used by the Edit Restaurant form. */
export type EditableRestaurant = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  open_hours: Record<string, { open: string; close: string }> | null;
};

// ─── Read operations ───────────────────────────────────────────────────────────

/**
 * Dashboard: minimal restaurant row with menu/dish counts.
 * Throws on unexpected DB error; returns null if the user has no restaurant yet.
 */
export async function getRestaurantSummary(ownerId: string): Promise<DashboardRestaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, address, cuisine_types, menus(id, name, menu_categories(id, dishes(id)))')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load restaurant: ${error.message}`);
  }
  return data as DashboardRestaurant | null;
}

/**
 * Review page: full restaurant + menus + categories + dishes, mapped to
 * the FormProgress shape the review UI expects.
 * Throws on unexpected DB error; returns null if no restaurant exists yet.
 */
export async function getRestaurantFull(ownerId: string): Promise<FormProgress | null> {
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*, menus(*, menu_categories(*, dishes(*)))')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load restaurant: ${error.message}`);
  }
  if (!restaurant) return null;

  return {
    restaurant_id: restaurant.id,
    basicInfo: {
      name: restaurant.name,
      restaurant_type: (restaurant.restaurant_type as RestaurantType) ?? undefined,
      description: restaurant.description ?? undefined,
      country: restaurant.country_code ?? undefined,
      address: restaurant.address,
      location: restaurant.location as unknown as AppLocation | undefined,
      phone: restaurant.phone ?? undefined,
      website: restaurant.website ?? undefined,
      cuisines: restaurant.cuisine_types || [],
    },
    operations: {
      operating_hours:
        (restaurant.open_hours as Record<string, { open: string; close: string }>) ?? undefined,
      delivery_available: restaurant.delivery_available ?? undefined,
      takeout_available: restaurant.takeout_available ?? undefined,
      dine_in_available: restaurant.dine_in_available ?? undefined,
      service_speed: (restaurant.service_speed as 'fast-food' | 'regular') ?? undefined,
      accepts_reservations: restaurant.accepts_reservations ?? undefined,
      payment_methods:
        (restaurant.payment_methods as 'cash_only' | 'card_only' | 'cash_and_card') ?? undefined,
    },
    menus: (restaurant.menus ?? []).map((menu: any) => ({
      id: menu.id,
      name: menu.name,
      description: menu.description ?? undefined,
      menu_type: (menu.menu_type ?? 'food') as 'food' | 'drink',
      is_active: menu.is_active ?? true,
      display_order: menu.display_order ?? 0,
      // Flatten dishes from menu_categories onto the menu (portal UI has no category level)
      dishes: (menu.menu_categories ?? []).flatMap((cat: any) => cat.dishes ?? []),
    })),
    dishes: (restaurant.menus ?? []).flatMap((m: any) =>
      (m.menu_categories ?? []).flatMap((cat: any) => cat.dishes ?? [])
    ),
    currentStep: 3,
  };
}

/**
 * Menu page: restaurant ID + menus with categories + dishes, mapped to the
 * AppMenu shape the menu editor expects.
 * Throws on unexpected DB error; returns null if no restaurant exists yet.
 */
export async function getRestaurantWithMenus(
  ownerId: string
): Promise<{ id: string; menus: AppMenu[] } | null> {
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, menus(*, menu_categories(*, dishes(*)))')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load restaurant menus: ${error.message}`);
  }
  if (!restaurant) return null;

  const menus: AppMenu[] = (restaurant.menus ?? []).map((menu: any) => ({
    id: menu.id,
    name: menu.name,
    description: menu.description ?? undefined,
    menu_type: (menu.menu_type ?? 'food') as 'food' | 'drink',
    is_active: menu.is_active ?? true,
    display_order: menu.display_order ?? 0,
    dishes: (menu.menu_categories ?? []).flatMap((cat: any) => cat.dishes ?? []),
  }));

  return { id: restaurant.id, menus };
}

/**
 * Edit page: flat restaurant row for the basic-info edit form.
 * Throws if the user has no restaurant (single() errors on no row).
 */
export async function getRestaurantForEdit(ownerId: string): Promise<EditableRestaurant> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, description, address, phone, website, open_hours')
    .eq('owner_id', ownerId)
    .single();

  if (error) throw new Error(`Failed to load restaurant: ${error.message}`);
  return data as EditableRestaurant;
}

// ─── Write operations ──────────────────────────────────────────────────────────

/**
 * Review page submit: upsert the restaurant record then replace all menus/dishes.
 *
 * Insert order is intentionally non-atomic on the delete step — new data is
 * created first, old data removed after. If the delete step fails the restaurant
 * temporarily shows duplicate menus, but all correct data is intact;
 * resubmitting will clean it up.
 *
 * Callers should validate `formData.basicInfo` with basicInfoSchema BEFORE
 * calling this (validation is a UI concern; this function is pure DB logic).
 *
 * Throws a descriptive Error on any DB failure.
 */
export async function submitRestaurantProfile(
  formData: FormProgress,
  ownerId: string
): Promise<{ restaurantId: string }> {
  const basicInfo = formData.basicInfo;
  if (!basicInfo?.name || !basicInfo?.address || !basicInfo?.location) {
    throw new Error('Missing required restaurant fields (name, address, location)');
  }

  const restaurantPayload: RestaurantInsert & { owner_id: string } = {
    owner_id: ownerId,
    name: basicInfo.name,
    location: formatLocationForSupabase(basicInfo.location.lat, basicInfo.location.lng),
    address: basicInfo.address,
    cuisine_types: basicInfo.cuisines ?? [],
    restaurant_type: basicInfo.restaurant_type,
    country_code: basicInfo.country,
    city: basicInfo.city,
    neighbourhood: basicInfo.neighbourhood,
    state: basicInfo.state,
    postal_code: basicInfo.postal_code,
    phone: basicInfo.phone,
    website: basicInfo.website,
    open_hours: formData.operations?.operating_hours
      ? formatOperatingHours(
          formData.operations.operating_hours as Record<
            string,
            { open: string; close: string; closed: boolean }
          >
        )
      : {},
    delivery_available: formData.operations?.delivery_available ?? true,
    takeout_available: formData.operations?.takeout_available ?? true,
    dine_in_available: formData.operations?.dine_in_available ?? true,
    accepts_reservations: formData.operations?.accepts_reservations ?? false,
    service_speed: formData.operations?.service_speed as 'fast-food' | 'regular' | undefined,
    payment_methods: (formData.operations?.payment_methods as string) ?? null,
    description: basicInfo.description,
  };

  const existingId = formData.restaurant_id;
  let restaurant: { id: string };
  let oldMenuIds: string[] = [];

  if (existingId) {
    // Capture old menu IDs BEFORE inserting new data (ensures we never leave
    // the restaurant with zero menus if a later step fails).
    const { data: existingMenus } = await supabase
      .from('menus')
      .select('id')
      .eq('restaurant_id', existingId);
    oldMenuIds = existingMenus?.map(m => m.id) ?? [];

    const { data, error } = await supabase
      .from('restaurants')
      .update(restaurantPayload)
      .eq('id', existingId)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    restaurant = data;
  } else {
    const { data, error } = await supabase
      .from('restaurants')
      .insert(restaurantPayload)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    restaurant = data;
  }

  // Insert new menus → default category per menu → dishes (with ingredient links)
  await _insertMenusAndDishes(restaurant.id, formData.menus ?? []);

  // Delete old menus (update path only) — non-fatal, logged as warning
  if (existingId && oldMenuIds.length > 0) {
    await _deleteOldMenuData(restaurant.id, oldMenuIds);
  }

  return { restaurantId: restaurant.id };
}

/**
 * Menu page save: atomically replace all menus/dishes for a restaurant.
 *
 * Fixes a pre-existing bug where the menu page inserted dishes with `menu_id`
 * instead of `menu_category_id` (the actual FK on the dishes table). The
 * canonical path now always goes through a default menu_category per menu.
 *
 * Throws a descriptive Error on any DB failure.
 */
export async function saveMenus(restaurantId: string, menus: AppMenu[]): Promise<void> {
  // Delete all current menus. Dishes/categories cascade or are handled by
  // _deleteOldMenuData within _insertMenusAndDishes context.
  await supabase.from('menus').delete().eq('restaurant_id', restaurantId);
  await _insertMenusAndDishes(restaurantId, menus);
}

/**
 * Edit page save: update flat restaurant fields and operating hours.
 *
 * Uses `open_hours` (the correct DB column). Note: the previous direct
 * implementation was inadvertently using `operating_hours` which is not a DB
 * column, so operating hours were silently never saved.
 *
 * Throws a descriptive Error on DB failure.
 */
export async function updateRestaurantInfo(
  restaurantId: string,
  fields: { name: string; description: string; address: string; phone: string; website: string },
  operatingHours: Record<string, { open: string; close: string; closed: boolean }>
): Promise<void> {
  const open_hours: Record<string, { open: string; close: string }> = {};
  Object.entries(operatingHours).forEach(([day, schedule]) => {
    if (!schedule.closed) {
      open_hours[day] = { open: schedule.open, close: schedule.close };
    }
  });

  const { error } = await supabase
    .from('restaurants')
    .update({
      name: fields.name,
      description: fields.description,
      address: fields.address,
      phone: fields.phone,
      website: fields.website,
      open_hours,
      updated_at: new Date().toISOString(),
    })
    .eq('id', restaurantId);

  if (error) throw new Error(`Failed to update restaurant: ${error.message}`);
}

// ─── Private helpers ───────────────────────────────────────────────────────────

/**
 * Insert menus → one default category per menu → dishes (with ingredient links).
 * This is the single canonical write path shared by the create and update flows.
 *
 * Dishes FK to `menu_categories.id` (not to `menus.id` directly), so we always
 * create an intermediate default category even though the portal UI has no
 * category-level concept.
 */
async function _insertMenusAndDishes(restaurantId: string, menus: AppMenu[]): Promise<void> {
  if (!menus.length) return;

  // ── Step 1: Batch insert all menus in a single round-trip ─────────────────
  const { data: insertedMenus, error: menuError } = await supabase
    .from('menus')
    .insert(
      menus.map(menu => ({
        restaurant_id: restaurantId,
        name: menu.name,
        description: menu.description || null,
        menu_type: menu.menu_type || 'food',
        display_order: menu.display_order || 0,
        is_active: menu.is_active !== undefined ? menu.is_active : true,
      }))
    )
    .select('id');
  if (menuError) throw new Error(`Failed to insert menus: ${menuError.message}`);

  // ── Step 2: Batch insert one default category per menu ─────────────────────
  // Supabase batch INSERT preserves insertion order, so insertedMenus[i] ↔ menus[i].
  const { data: insertedCategories, error: categoryError } = await supabase
    .from('menu_categories')
    .insert(
      insertedMenus.map((insertedMenu, i) => ({
        restaurant_id: restaurantId,
        menu_id: insertedMenu.id,
        name: menus[i].name,
        display_order: 0,
        is_active: true,
      }))
    )
    .select('id');
  if (categoryError) throw new Error(`Failed to insert menu categories: ${categoryError.message}`);

  // ── Step 3: Batch insert all dishes across all menus ───────────────────────
  // Build a flat list preserving the dish → category mapping via index.
  type DishWithCategoryId = { dish: AppMenu['dishes'][number]; categoryId: string };
  const allDishes: DishWithCategoryId[] = [];

  for (let i = 0; i < menus.length; i++) {
    const categoryId = insertedCategories[i].id;
    for (const dish of menus[i].dishes ?? []) {
      allDishes.push({ dish, categoryId });
    }
  }

  if (!allDishes.length) return;

  const { data: insertedDishes, error: dishesError } = await supabase
    .from('dishes')
    .insert(
      allDishes.map(({ dish, categoryId }) => ({
        restaurant_id: restaurantId,
        menu_category_id: categoryId, // correct FK — not menu_id
        name: dish.name,
        description: dish.description || null,
        price: dish.price,
        dietary_tags: dish.dietary_tags || [],
        allergens: dish.allergens || [],
        ingredients: dish.ingredients || [],
        calories: dish.calories || null,
        spice_level: dish.spice_level || null,
        image_url: dish.photo_url || null,
        is_available: dish.is_available !== undefined ? dish.is_available : true,
        description_visibility: dish.description_visibility ?? 'menu',
        ingredients_visibility: dish.ingredients_visibility ?? 'detail',
      }))
    )
    .select('id');
  if (dishesError) throw new Error(`Failed to insert dishes: ${dishesError.message}`);

  // ── Step 4: Link canonical ingredients in parallel (non-fatal) ────────────
  await Promise.all(
    insertedDishes.map(async (insertedDish, i) => {
      const { dish } = allDishes[i];
      if (!dish.selectedIngredients?.length) return;
      const { error: ingError } = await addDishIngredients(
        insertedDish.id,
        dish.selectedIngredients.map((ing: SelectedIngredient) => ({
          ingredient_id: ing.id,
          quantity: ing.quantity || null,
        }))
      );
      if (ingError) {
        console.error(
          `[RestaurantService] Failed to link ingredients for dish "${dish.name}":`,
          ingError
        );
      }
    })
  );
}

/**
 * Delete old menu data in dependency order: dishes → categories → menus.
 * Non-fatal — logs a warning if the final menu delete fails but doesn't throw
 * (the restaurant has correct new data; resubmitting will clean up duplicates).
 */
async function _deleteOldMenuData(restaurantId: string, oldMenuIds: string[]): Promise<void> {
  const { data: oldCategoryRows } = await supabase
    .from('menu_categories')
    .select('id')
    .in('menu_id', oldMenuIds);
  const oldCategoryIds = oldCategoryRows?.map(c => c.id) ?? [];

  if (oldCategoryIds.length > 0) {
    await supabase.from('dishes').delete().in('menu_category_id', oldCategoryIds);
  }

  // Clean up legacy dishes with no category (pre-schema-fix data)
  await supabase
    .from('dishes')
    .delete()
    .eq('restaurant_id', restaurantId)
    .is('menu_category_id', null);

  if (oldCategoryIds.length > 0) {
    await supabase.from('menu_categories').delete().in('id', oldCategoryIds);
  }

  const { error: deleteMenusError } = await supabase.from('menus').delete().in('id', oldMenuIds);

  if (deleteMenusError) {
    console.warn(
      '[RestaurantService] Could not fully remove old menus. ' +
        'The restaurant may show duplicate menus; resubmitting will fix this.',
      deleteMenusError
    );
  }
}

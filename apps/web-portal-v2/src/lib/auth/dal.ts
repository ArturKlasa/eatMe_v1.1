import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export const verifySession = cache(async () => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect('/signin');
  return { userId: data!.claims.sub, claims: data!.claims };
});

export async function getRestaurant(id: string, userId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('restaurants')
    .select(
      'id, name, description, restaurant_type, address, city, state, country_code, postal_code, neighbourhood, location, phone, website, cuisine_types, open_hours, delivery_available, takeout_available, dine_in_available, accepts_reservations, status, is_active, owner_id'
    )
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle();
  return data;
}

export async function getMenusWithCategoriesAndDishes(restaurantId: string, userId: string) {
  const supabase = await createServerClient();

  // Verify ownership first
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (!restaurant) return null;

  const { data: menus } = await supabase
    .from('menus')
    .select('id, name, description, menu_type, status, display_order')
    .eq('restaurant_id', restaurantId)
    .neq('status', 'archived')
    .order('display_order', { ascending: true });

  if (!menus) return [];

  const menuIds = menus.map(m => m.id);
  if (menuIds.length === 0) return menus.map(m => ({ ...m, categories: [] }));

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, menu_id, name, description, display_order')
    .in('menu_id', menuIds)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  const categoryIds = (categories ?? []).map(c => c.id);
  const { data: dishes } =
    categoryIds.length > 0
      ? await supabase
          .from('dishes')
          .select(
            'id, name, description, price, dish_kind, primary_protein, status, is_available, is_template, image_url, menu_category_id, dish_category_id, display_price_prefix, serves'
          )
          .in('menu_category_id', categoryIds)
          .neq('status', 'archived')
          .eq('is_parent', false)
          .order('name', { ascending: true })
      : { data: [] };

  type CategoryRow = NonNullable<typeof categories>[number];
  type DishRow = NonNullable<typeof dishes>[number];

  const dishesByCategory = ((dishes ?? []) as DishRow[]).reduce(
    (acc, dish) => {
      const key = dish.menu_category_id as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(dish);
      return acc;
    },
    {} as Record<string, DishRow[]>
  );

  const categoriesWithDishes = ((categories ?? []) as CategoryRow[]).map(cat => ({
    ...cat,
    dishes: dishesByCategory[cat.id] ?? [],
  }));

  const categoriesByMenu = categoriesWithDishes.reduce(
    (acc, cat) => {
      const key = cat.menu_id as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(cat);
      return acc;
    },
    {} as Record<string, typeof categoriesWithDishes>
  );

  return menus.map(menu => ({
    ...menu,
    categories: categoriesByMenu[menu.id] ?? [],
  }));
}

export async function getMenuScanJobs(restaurantId: string, userId: string) {
  const supabase = await createServerClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (!restaurant) return null;

  const { data } = await supabase
    .from('menu_scan_jobs')
    .select('id, status, created_at, attempts')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getMenuScanJob(jobId: string, userId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('menu_scan_jobs')
    .select('id, restaurant_id, status, result_json, attempts, created_at, last_error')
    .eq('id', jobId)
    .eq('created_by', userId)
    .maybeSingle();
  return data;
}

export async function getRestaurantMenuCategories(restaurantId: string, userId: string) {
  const supabase = await createServerClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (!restaurant) return null;

  const { data: menus } = await supabase
    .from('menus')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .neq('status', 'archived')
    .order('display_order', { ascending: true });

  const menuIds = (menus ?? []).map(m => m.id);
  if (menuIds.length === 0) return { menus: menus ?? [], categories: [] };

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name, menu_id')
    .in('menu_id', menuIds)
    .eq('is_active', true)
    .order('name', { ascending: true });

  return { menus: menus ?? [], categories: categories ?? [] };
}

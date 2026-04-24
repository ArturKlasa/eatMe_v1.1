import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
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

  if (error || !data) return { rows: [], total: 0 };
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
      'id, restaurant_id, created_by, status, attempts, last_error, created_at, updated_at, input, result_json, locked_until, saved_dish_ids, saved_at, restaurants!left(name)'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
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
    input: row.input,
    result_json: row.result_json,
    locked_until: (row.locked_until as string | null) ?? null,
    saved_dish_ids: row.saved_dish_ids,
    saved_at: (row.saved_at as string | null) ?? null,
  };
}

export type RestaurantOption = { id: string; name: string };

export async function getAdminRestaurantOptions(): Promise<RestaurantOption[]> {
  const supabase = createAdminServiceClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name')
    .order('name')
    .limit(200);
  if (error || !data) return [];
  return data as RestaurantOption[];
}

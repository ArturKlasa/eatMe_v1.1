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

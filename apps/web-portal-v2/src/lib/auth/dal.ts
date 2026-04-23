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

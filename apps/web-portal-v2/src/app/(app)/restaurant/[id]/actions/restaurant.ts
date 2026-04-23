'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAuth, type ActionResult } from '@/lib/auth/wrappers';
import { restaurantBasicsSchema, type RestaurantBasicsInput } from '@eatme/shared';

export type UpdateBasicsInput = RestaurantBasicsInput;

const createDraftSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
});

export const createRestaurantDraft = withAuth(
  async (ctx, input: { name: string }): Promise<ActionResult<{ id: string }>> => {
    const parsed = createDraftSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { data: restaurant, error } = await ctx.supabase
      .from('restaurants')
      .insert({
        name: parsed.data.name,
        status: 'draft',
        owner_id: ctx.userId,
        address: '',
        location: 'POINT(0 0)',
      })
      .select('id')
      .single();

    if (error || !restaurant) {
      return { ok: false, formError: 'CREATE_FAILED' };
    }

    revalidatePath('/onboard');
    return { ok: true, data: { id: restaurant.id } };
  }
);

export const updateRestaurantBasics = withAuth(
  async (ctx, id: string, input: UpdateBasicsInput): Promise<ActionResult<void>> => {
    const parsed = restaurantBasicsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const d = parsed.data;
    const updatePayload: Record<string, unknown> = {
      name: d.name,
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.restaurant_type !== undefined ? { restaurant_type: d.restaurant_type || null } : {}),
      ...(d.country !== undefined ? { country_code: d.country || null } : {}),
      ...(d.city !== undefined ? { city: d.city || null } : {}),
      ...(d.postal_code !== undefined ? { postal_code: d.postal_code || null } : {}),
      ...(d.neighbourhood !== undefined ? { neighbourhood: d.neighbourhood || null } : {}),
      ...(d.state !== undefined ? { state: d.state || null } : {}),
      ...(d.address !== undefined ? { address: d.address || '' } : {}),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.website !== undefined ? { website: d.website || null } : {}),
      ...(d.cuisines !== undefined ? { cuisine_types: d.cuisines } : {}),
    };

    const { data, error } = await ctx.supabase
      .from('restaurants')
      .update(updatePayload)
      .eq('id', id)
      .eq('owner_id', ctx.userId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return { ok: false, formError: 'NOT_FOUND' };
    }

    revalidatePath(`/restaurant/${id}`, 'page');
    return { ok: true, data: undefined };
  }
);

export const archiveRestaurant = withAuth(async (ctx, id: string): Promise<ActionResult<void>> => {
  const { data, error } = await ctx.supabase
    .from('restaurants')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('owner_id', ctx.userId)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return { ok: false, formError: 'NOT_FOUND' };
  }

  revalidatePath(`/restaurant/${id}`, 'page');
  return { ok: true, data: undefined };
});

export const unpublishRestaurant = withAuth(
  async (ctx, id: string): Promise<ActionResult<void>> => {
    const { data, error } = await ctx.supabase
      .from('restaurants')
      .update({ status: 'draft' })
      .eq('id', id)
      .eq('owner_id', ctx.userId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return { ok: false, formError: 'NOT_FOUND' };
    }

    revalidatePath(`/restaurant/${id}`, 'page');
    return { ok: true, data: undefined };
  }
);

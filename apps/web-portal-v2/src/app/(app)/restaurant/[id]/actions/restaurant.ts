'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAuth, type ActionResult } from '@/lib/auth/wrappers';
import {
  restaurantBasicsSchema,
  restaurantLocationSchema,
  restaurantHoursSchema,
  type RestaurantBasicsInput,
  type RestaurantLocationInput,
  type RestaurantHoursInput,
} from '@eatme/shared';

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

export const updateRestaurantLocation = withAuth(
  async (ctx, id: string, input: RestaurantLocationInput): Promise<ActionResult<void>> => {
    const parsed = restaurantLocationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const { lat, lng, address } = parsed.data;
    const { data, error } = await ctx.supabase
      .from('restaurants')
      .update({ location: `POINT(${lng} ${lat})`, address })
      .eq('id', id)
      .eq('owner_id', ctx.userId)
      .select('id')
      .maybeSingle();
    if (error || !data) return { ok: false, formError: 'NOT_FOUND' };
    revalidatePath(`/restaurant/${id}`, 'page');
    return { ok: true, data: undefined };
  }
);

export const updateRestaurantHours = withAuth(
  async (ctx, id: string, input: RestaurantHoursInput): Promise<ActionResult<void>> => {
    const parsed = restaurantHoursSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const d = parsed.data;
    const { data, error } = await ctx.supabase
      .from('restaurants')
      .update({
        open_hours: d.operating_hours,
        delivery_available: d.delivery_available,
        takeout_available: d.takeout_available,
        dine_in_available: d.dine_in_available,
        accepts_reservations: d.accepts_reservations,
      })
      .eq('id', id)
      .eq('owner_id', ctx.userId)
      .select('id')
      .maybeSingle();
    if (error || !data) return { ok: false, formError: 'NOT_FOUND' };
    revalidatePath(`/restaurant/${id}`, 'page');
    return { ok: true, data: undefined };
  }
);

export const updateRestaurantPhoto = withAuth(
  async (ctx, id: string, photoPath: string): Promise<ActionResult<void>> => {
    const { data, error } = await ctx.supabase
      .from('restaurants')
      .update({ image_url: photoPath })
      .eq('id', id)
      .eq('owner_id', ctx.userId)
      .select('id')
      .maybeSingle();
    if (error || !data) return { ok: false, formError: 'NOT_FOUND' };
    revalidatePath(`/restaurant/${id}`, 'page');
    return { ok: true, data: undefined };
  }
);

export const publishRestaurant = withAuth(async (ctx, id: string): Promise<ActionResult<void>> => {
  const { error } = await ctx.supabase.rpc('publish_restaurant_draft', {
    p_restaurant_id: id,
  });

  if (error) {
    if (error.code === 'insufficient_privilege') {
      return { ok: false, formError: 'FORBIDDEN' };
    }
    if (error.code === 'NO_DATA_FOUND') {
      return { ok: false, formError: 'NOT_FOUND' };
    }
    if (error.code?.startsWith('23')) {
      return { ok: false, formError: 'VALIDATION' };
    }
    console.error('[publishRestaurant] unexpected error', {
      restaurantId: id,
      code: error.code,
      message: error.message,
    });
    return { ok: false, formError: 'UNKNOWN_ERROR' };
  }

  // Non-fatal cross-tab broadcast so other open tabs refresh automatically.
  try {
    const ch = ctx.supabase.channel(`user-${ctx.userId}`);
    await ch.send({
      type: 'broadcast',
      event: 'restaurant.published',
      payload: { restaurantId: id },
    });
    await ctx.supabase.removeChannel(ch);
  } catch {
    // Intentionally swallowed — revalidatePath covers the submitting tab.
  }

  revalidatePath(`/restaurant/${id}`, 'page');
  revalidatePath('/onboard', 'page');
  return { ok: true, data: undefined };
});

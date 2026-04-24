'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

const suspendSchema = z
  .object({
    is_active: z.boolean(),
    reason: z.string().optional(),
  })
  .refine(d => d.is_active || (!!d.reason && d.reason.trim().length > 0), {
    message: 'Suspension reason is required',
    path: ['reason'],
  });

export const suspendRestaurant = withAdminAuth(
  async (
    ctx,
    id: string,
    input: { is_active: boolean; reason?: string }
  ): Promise<ActionResult<void>> => {
    const parsed = suspendSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('is_active, suspended_at, suspended_by, suspension_reason')
      .eq('id', id)
      .maybeSingle();

    const { is_active, reason } = parsed.data;
    const updatePayload = is_active
      ? { is_active: true, suspended_at: null, suspended_by: null, suspension_reason: null }
      : {
          is_active: false,
          suspended_at: new Date().toISOString(),
          suspended_by: ctx.userId,
          suspension_reason: reason ?? null,
        };

    const { error } = await service.from('restaurants').update(updatePayload).eq('id', id);

    if (error) return { ok: false, formError: 'UPDATE_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      is_active ? 'unsuspend_restaurant' : 'suspend_restaurant',
      'restaurant',
      id,
      current
        ? {
            is_active: current.is_active,
            suspended_at: current.suspended_at,
          }
        : null,
      { is_active: updatePayload.is_active, suspended_at: updatePayload.suspended_at ?? null }
    );

    revalidatePath(`/restaurants/${id}`, 'page');
    revalidatePath('/restaurants', 'page');
    return { ok: true, data: undefined };
  }
);

const adminBasicsSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
});

export const updateAdminRestaurantBasics = withAdminAuth(
  async (
    ctx,
    id: string,
    input: z.infer<typeof adminBasicsSchema>
  ): Promise<ActionResult<void>> => {
    const parsed = adminBasicsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('name, description, city, phone, website, address')
      .eq('id', id)
      .maybeSingle();

    const d = parsed.data;
    const updatePayload: Record<string, unknown> = {
      name: d.name,
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.city !== undefined ? { city: d.city || null } : {}),
      ...(d.address !== undefined ? { address: d.address || '' } : {}),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.website !== undefined ? { website: d.website || null } : {}),
    };

    const { error } = await service
      .from('restaurants')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updatePayload as any)
      .eq('id', id);

    if (error) return { ok: false, formError: 'UPDATE_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'update_restaurant_basics',
      'restaurant',
      id,
      current as Record<string, unknown> | null,
      updatePayload
    );

    revalidatePath(`/restaurants/${id}`, 'page');
    return { ok: true, data: undefined };
  }
);

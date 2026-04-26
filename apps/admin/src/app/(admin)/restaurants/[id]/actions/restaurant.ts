'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

// adminPublishRestaurant: admin-side counterpart to publish_restaurant_draft.
//
// publish_restaurant_draft (migration 120) is SECURITY DEFINER but its auth
// check (auth.uid() = owner_id OR is_admin()) reads the JWT, which is empty
// under the service-role client we use everywhere in admin. So admin replicates
// the same multi-table flip directly via service-role UPDATEs and audit-logs it.
//
// Idempotent: WHERE status = 'draft' so a second call is a no-op once the
// restaurant is already published.
export const adminPublishRestaurant = withAdminAuth(
  async (
    ctx,
    restaurantId: string
  ): Promise<
    ActionResult<{
      restaurantPublished: boolean;
      menusPublished: number;
      dishesPublished: number;
    }>
  > => {
    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('id, status')
      .eq('id', restaurantId)
      .maybeSingle();

    if (!current) return { ok: false, formError: 'NOT_FOUND' };
    const wasDraft = (current as Record<string, unknown>).status === 'draft';

    // Restaurant
    if (wasDraft) {
      const { error } = await service
        .from('restaurants')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', restaurantId)
        .eq('status', 'draft');
      if (error) return { ok: false, formError: error.message };
    }

    // Menus
    const { data: menusUpdated, error: menusErr } = await service
      .from('menus')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'draft')
      .select('id');
    if (menusErr) return { ok: false, formError: menusErr.message };
    const menusPublished = (menusUpdated ?? []).length;

    // Dishes
    const { data: dishesUpdated, error: dishesErr } = await service
      .from('dishes')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'draft')
      .select('id');
    if (dishesErr) return { ok: false, formError: dishesErr.message };
    const dishesPublished = (dishesUpdated ?? []).length;

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'publish_restaurant',
      'restaurant',
      restaurantId,
      { status: (current as Record<string, unknown>).status as string },
      {
        status: 'published',
        menus_published: menusPublished,
        dishes_published: dishesPublished,
      }
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    revalidatePath('/restaurants', 'page');
    return {
      ok: true,
      data: { restaurantPublished: wasDraft, menusPublished, dishesPublished },
    };
  }
);

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

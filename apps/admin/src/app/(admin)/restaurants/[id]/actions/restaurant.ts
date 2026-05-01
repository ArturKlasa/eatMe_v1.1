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

// adminDeleteRestaurant: hard delete. Cascade is performed by the
// admin_delete_restaurant(uuid) Postgres function (migration 130) so the whole
// thing is one transaction. After the row is gone we best-effort clean the
// menu-scan-uploads bucket; the photos bucket (dish_photos.photo_url etc.)
// is NOT cleaned — those files use user-scoped paths and become orphans.
//
// Confirmation: the caller must pass the restaurant's exact name. We re-check
// it server-side as defense in depth on top of the modal's typed-confirm.
export type AdminDeleteRestaurantCounts = {
  dishes_deleted: number;
  menu_categories_deleted: number;
  menus_deleted: number;
  opinions_deleted: number;
  photos_deleted: number;
  visits_deleted: number;
  favorites_deleted: number;
  scan_jobs_deleted: number;
  option_groups_deleted: number;
  options_deleted: number;
  analytics_deleted: number;
  interactions_deleted: number;
  session_views_deleted: number;
  sessions_unset: number;
  recommendations_deleted: number;
  votes_deleted: number;
  responses_deleted: number;
  storage_paths: string[];
};

type AdminDeleteRestaurantRpc = {
  rpc: (
    name: 'admin_delete_restaurant',
    args: { p_restaurant_id: string }
  ) => Promise<{ data: AdminDeleteRestaurantCounts | null; error: unknown }>;
};

export const adminDeleteRestaurant = withAdminAuth(
  async (
    ctx,
    restaurantId: string,
    opts: { confirmName: string }
  ): Promise<ActionResult<AdminDeleteRestaurantCounts>> => {
    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('id, name, status')
      .eq('id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    const currentRow = current as { id: string; name: string; status: string };
    if (currentRow.name !== opts.confirmName) {
      return { ok: false, formError: 'CONFIRM_MISMATCH' };
    }

    const { data, error } = await (service as unknown as AdminDeleteRestaurantRpc).rpc(
      'admin_delete_restaurant',
      { p_restaurant_id: restaurantId }
    );
    if (error) {
      const msg = (error as { message?: string }).message ?? 'DELETE_FAILED';
      return { ok: false, formError: msg };
    }
    if (!data) return { ok: false, formError: 'DELETE_FAILED' };

    // Best-effort storage cleanup. Failures here don't roll back the DB delete.
    try {
      const paths = data.storage_paths ?? [];
      if (paths.length > 0) {
        await service.storage.from('menu-scan-uploads').remove(paths);
      }
      const { data: leftovers } = await service.storage
        .from('menu-scan-uploads')
        .list(restaurantId);
      if (leftovers && leftovers.length > 0) {
        await service.storage
          .from('menu-scan-uploads')
          .remove(leftovers.map(f => `${restaurantId}/${f.name}`));
      }
    } catch (e) {
      console.error('[adminDeleteRestaurant] storage cleanup failed:', e);
    }

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'delete_restaurant',
      'restaurant',
      restaurantId,
      { name: currentRow.name, status: currentRow.status },
      data as unknown as Record<string, unknown>
    );

    revalidatePath('/restaurants', 'page');
    return { ok: true, data };
  }
);

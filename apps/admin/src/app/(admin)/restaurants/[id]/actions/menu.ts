'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

const MENU_TYPES = ['food', 'drink'] as const;
const MENU_STATUSES = ['draft', 'published', 'archived'] as const;

const adminMenuCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  menu_type: z.enum(MENU_TYPES).optional(),
});

// adminCreateMenu: create a new menu under a restaurant. Lands as status='draft'
// (mig 117 flipped the column default to 'published' — same explicit-draft
// pattern as adminConfirmMenuScan), with display_order one past the current
// max so the new menu appears at the bottom of the list.
export const adminCreateMenu = withAdminAuth(
  async (
    ctx,
    restaurantId: string,
    input: z.infer<typeof adminMenuCreateSchema>
  ): Promise<ActionResult<{ menuId: string }>> => {
    const parsed = adminMenuCreateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    const { data: restaurant } = await service
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .maybeSingle();
    if (!restaurant) return { ok: false, formError: 'RESTAURANT_NOT_FOUND' };

    const { data: maxRow } = await service
      .from('menus')
      .select('display_order')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder =
      ((maxRow as { display_order: number | null } | null)?.display_order ?? -1) + 1;

    const m = parsed.data;
    const insertPayload = {
      restaurant_id: restaurantId,
      name: m.name,
      description: m.description ?? null,
      menu_type: m.menu_type ?? 'food',
      display_order: nextOrder,
      is_active: true,
      status: 'draft' as const,
    };

    const { data: created, error } = await service
      .from('menus')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select('id')
      .single();

    if (error || !created) {
      return { ok: false, formError: error?.message ?? 'CREATE_FAILED' };
    }

    const menuId = (created as { id: string }).id;

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'create_menu',
      'menu',
      menuId,
      null,
      insertPayload
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: { menuId } };
  }
);

const adminMenuUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  menu_type: z.enum(MENU_TYPES).optional(),
  status: z.enum(MENU_STATUSES).optional(),
  is_active: z.boolean().optional(),
});

// adminUpdateMenu: edit a menu's basic fields. Note that flipping menu.status
// does NOT cascade to its categories or dishes — they have their own status
// columns and the admin manages them independently. This matches how
// adminPublishRestaurant works (separate concerns per entity).
export const adminUpdateMenu = withAdminAuth(
  async (
    ctx,
    menuId: string,
    restaurantId: string,
    input: z.infer<typeof adminMenuUpdateSchema>
  ): Promise<ActionResult<void>> => {
    const parsed = adminMenuUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('menus')
      .select('id, restaurant_id, name, description, menu_type, status, is_active')
      .eq('id', menuId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    const m = parsed.data;
    const updatePayload: Record<string, unknown> = {};
    if (m.name !== undefined) updatePayload.name = m.name;
    if (m.description !== undefined) updatePayload.description = m.description;
    if (m.menu_type !== undefined) updatePayload.menu_type = m.menu_type;
    if (m.status !== undefined) updatePayload.status = m.status;
    if (m.is_active !== undefined) updatePayload.is_active = m.is_active;

    if (Object.keys(updatePayload).length === 0) {
      return { ok: true, data: undefined };
    }

    const { error } = await service
      .from('menus')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updatePayload as any)
      .eq('id', menuId)
      .eq('restaurant_id', restaurantId);

    if (error) return { ok: false, formError: error.message };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'update_menu',
      'menu',
      menuId,
      current as Record<string, unknown>,
      updatePayload
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: undefined };
  }
);

// adminDeleteMenu: soft-delete by default — sets status='archived'. Children
// (categories + dishes) are NOT cascaded; admin handles them separately. The
// returned counts are informational so the confirm dialog can warn the admin
// about what stays alive.
export const adminDeleteMenu = withAdminAuth(
  async (
    ctx,
    menuId: string,
    restaurantId: string,
    opts: { hard: boolean }
  ): Promise<ActionResult<{ categoriesRemaining: number; dishesRemaining: number }>> => {
    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('menus')
      .select('id, restaurant_id, name, status')
      .eq('id', menuId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    const { count: categoriesRemaining } = await service
      .from('menu_categories')
      .select('id', { count: 'exact', head: true })
      .eq('menu_id', menuId)
      .eq('restaurant_id', restaurantId);

    const { data: catIds } = await service
      .from('menu_categories')
      .select('id')
      .eq('menu_id', menuId)
      .eq('restaurant_id', restaurantId);
    let dishesRemaining = 0;
    if (catIds && catIds.length > 0) {
      const ids = (catIds as Array<{ id: string }>).map(r => r.id);
      const { count } = await service
        .from('dishes')
        .select('id', { count: 'exact', head: true })
        .in('menu_category_id', ids);
      dishesRemaining = count ?? 0;
    }

    if (opts.hard) {
      const { error } = await service
        .from('menus')
        .delete()
        .eq('id', menuId)
        .eq('restaurant_id', restaurantId);
      if (error) return { ok: false, formError: error.message };
    } else {
      const { error } = await service
        .from('menus')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ status: 'archived' } as any)
        .eq('id', menuId)
        .eq('restaurant_id', restaurantId);
      if (error) return { ok: false, formError: error.message };
    }

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      opts.hard ? 'delete_menu' : 'archive_menu',
      'menu',
      menuId,
      current as Record<string, unknown>,
      opts.hard
        ? {
            deleted: true,
            categories_remaining: categoriesRemaining ?? 0,
            dishes_remaining: dishesRemaining,
          }
        : {
            status: 'archived',
            categories_remaining: categoriesRemaining ?? 0,
            dishes_remaining: dishesRemaining,
          }
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return {
      ok: true,
      data: {
        categoriesRemaining: categoriesRemaining ?? 0,
        dishesRemaining,
      },
    };
  }
);

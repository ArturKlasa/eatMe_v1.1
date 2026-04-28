'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

const MENU_TYPES = ['food', 'drink'] as const;
const MENU_STATUSES = ['draft', 'published', 'archived'] as const;

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

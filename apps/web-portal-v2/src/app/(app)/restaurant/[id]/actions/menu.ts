'use server';

import { revalidatePath } from 'next/cache';
import { withAuth, type ActionResult } from '@/lib/auth/wrappers';
import {
  menuCreateSchemaV2,
  menuUpdateSchemaV2,
  type MenuCreateInput,
  type MenuUpdateInput,
} from '@eatme/shared';

export const createMenu = withAuth(
  async (
    ctx,
    restaurantId: string,
    input: MenuCreateInput
  ): Promise<ActionResult<{ id: string }>> => {
    const parsed = menuCreateSchemaV2.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { data: menu, error } = await ctx.supabase
      .from('menus')
      .insert({
        restaurant_id: restaurantId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        menu_type: parsed.data.menu_type,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error || !menu) {
      return { ok: false, formError: 'CREATE_FAILED' };
    }

    revalidatePath(`/restaurant/${restaurantId}/menu`, 'page');
    return { ok: true, data: { id: menu.id } };
  }
);

export const updateMenu = withAuth(
  async (
    ctx,
    menuId: string,
    restaurantId: string,
    input: MenuUpdateInput
  ): Promise<ActionResult<void>> => {
    const parsed = menuUpdateSchemaV2.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      updatePayload.description = parsed.data.description || null;
    if (parsed.data.menu_type !== undefined) updatePayload.menu_type = parsed.data.menu_type;

    const { data, error } = await ctx.supabase
      .from('menus')
      .update(updatePayload)
      .eq('id', menuId)
      .eq('restaurant_id', restaurantId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return { ok: false, formError: 'NOT_FOUND' };
    }

    revalidatePath(`/restaurant/${restaurantId}/menu`, 'page');
    return { ok: true, data: undefined };
  }
);

export const archiveMenu = withAuth(
  async (ctx, menuId: string, restaurantId: string): Promise<ActionResult<void>> => {
    const { data, error } = await ctx.supabase
      .from('menus')
      .update({ status: 'archived' })
      .eq('id', menuId)
      .eq('restaurant_id', restaurantId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return { ok: false, formError: 'NOT_FOUND' };
    }

    revalidatePath(`/restaurant/${restaurantId}/menu`, 'page');
    return { ok: true, data: undefined };
  }
);

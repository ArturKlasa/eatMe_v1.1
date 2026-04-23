'use server';

import { revalidatePath } from 'next/cache';
import { withAuth, type ActionResult } from '@/lib/auth/wrappers';
import {
  menuCategoryCreateSchemaV2,
  menuCategoryUpdateSchemaV2,
  type MenuCategoryCreateInput,
  type MenuCategoryUpdateInput,
} from '@eatme/shared';

export const createCategory = withAuth(
  async (
    ctx,
    restaurantId: string,
    input: MenuCategoryCreateInput
  ): Promise<ActionResult<{ id: string }>> => {
    const parsed = menuCategoryCreateSchemaV2.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { data: category, error } = await ctx.supabase
      .from('menu_categories')
      .insert({
        menu_id: parsed.data.menu_id,
        restaurant_id: restaurantId,
        name: parsed.data.name,
        description: parsed.data.description || null,
      })
      .select('id')
      .single();

    if (error || !category) {
      return { ok: false, formError: 'CREATE_FAILED' };
    }

    revalidatePath(`/restaurant/${restaurantId}/menu`, 'page');
    return { ok: true, data: { id: category.id } };
  }
);

export const updateCategory = withAuth(
  async (
    ctx,
    categoryId: string,
    restaurantId: string,
    input: MenuCategoryUpdateInput
  ): Promise<ActionResult<void>> => {
    const parsed = menuCategoryUpdateSchemaV2.safeParse(input);
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

    const { data, error } = await ctx.supabase
      .from('menu_categories')
      .update(updatePayload)
      .eq('id', categoryId)
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

export const deleteCategory = withAuth(
  async (ctx, categoryId: string, restaurantId: string): Promise<ActionResult<void>> => {
    const { data, error } = await ctx.supabase
      .from('menu_categories')
      .delete()
      .eq('id', categoryId)
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

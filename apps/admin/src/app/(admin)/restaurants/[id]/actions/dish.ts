'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';
import { PRIMARY_PROTEINS } from '@eatme/shared';

const DISH_KINDS = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;
const DISH_STATUSES = ['draft', 'published', 'archived'] as const;

const adminDishUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  status: z.enum(DISH_STATUSES).optional(),
  is_available: z.boolean().optional(),
  primary_protein: z.enum(PRIMARY_PROTEINS).optional(),
  dish_kind: z.enum(DISH_KINDS).optional(),
  menu_category_id: z.string().uuid().nullable().optional(),
  dish_category_id: z.string().uuid().nullable().optional(),
});

export const adminUpdateDish = withAdminAuth(
  async (
    ctx,
    dishId: string,
    restaurantId: string,
    input: z.infer<typeof adminDishUpdateSchema>
  ): Promise<ActionResult<void>> => {
    const parsed = adminDishUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    // Restaurant-id guard: confirm the dish actually belongs to this restaurant.
    // Prevents a stale URL or cross-tab race from editing the wrong row.
    const { data: current } = await service
      .from('dishes')
      .select(
        'id, restaurant_id, name, description, price, status, is_available, primary_protein, dish_kind, menu_category_id, dish_category_id'
      )
      .eq('id', dishId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    const d = parsed.data;

    // Validate menu_category_id belongs to same restaurant when provided.
    if (d.menu_category_id) {
      const { data: cat } = await service
        .from('menu_categories')
        .select('id')
        .eq('id', d.menu_category_id)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (!cat) return { ok: false, formError: 'INVALID_MENU_CATEGORY_ID' };
    }

    // Validate dish_category_id exists when provided.
    if (d.dish_category_id) {
      const { data: dc } = await service
        .from('dish_categories')
        .select('id')
        .eq('id', d.dish_category_id)
        .maybeSingle();
      if (!dc) return { ok: false, formError: 'INVALID_DISH_CATEGORY_ID' };
    }

    // Build update payload — only set keys that were actually passed in.
    const updatePayload: Record<string, unknown> = {};
    if (d.name !== undefined) updatePayload.name = d.name;
    if (d.description !== undefined) updatePayload.description = d.description;
    if (d.price !== undefined) updatePayload.price = d.price;
    if (d.status !== undefined) updatePayload.status = d.status;
    if (d.is_available !== undefined) updatePayload.is_available = d.is_available;
    if (d.primary_protein !== undefined) updatePayload.primary_protein = d.primary_protein;
    if (d.dish_kind !== undefined) updatePayload.dish_kind = d.dish_kind;
    if (d.menu_category_id !== undefined) updatePayload.menu_category_id = d.menu_category_id;
    if (d.dish_category_id !== undefined) updatePayload.dish_category_id = d.dish_category_id;

    if (Object.keys(updatePayload).length === 0) {
      return { ok: true, data: undefined };
    }

    const { error } = await service
      .from('dishes')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updatePayload as any)
      .eq('id', dishId)
      .eq('restaurant_id', restaurantId);

    if (error) return { ok: false, formError: error.message };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'update_dish',
      'dish',
      dishId,
      current as Record<string, unknown>,
      updatePayload
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: undefined };
  }
);

// adminDeleteDish: soft-delete by default — sets status='archived' and
// is_available=false so the dish disappears from the consumer feed but
// rows referencing it (dish_analytics, dish_opinions, dish_photos,
// user_dish_interactions, etc — most of which are no-cascade FKs per
// database_schema.sql) stay intact.
//
// hard: true does a real DELETE. The current admin UI never sets it; the
// flag is reserved for a future force-delete affordance gated behind a
// typed-confirm modal.
export const adminDeleteDish = withAdminAuth(
  async (
    ctx,
    dishId: string,
    restaurantId: string,
    opts: { hard: boolean }
  ): Promise<ActionResult<void>> => {
    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('dishes')
      .select('id, restaurant_id, name, status, is_available')
      .eq('id', dishId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    if (opts.hard) {
      const { error } = await service
        .from('dishes')
        .delete()
        .eq('id', dishId)
        .eq('restaurant_id', restaurantId);
      if (error) return { ok: false, formError: error.message };
    } else {
      const { error } = await service
        .from('dishes')
        .update({ status: 'archived', is_available: false })
        .eq('id', dishId)
        .eq('restaurant_id', restaurantId);
      if (error) return { ok: false, formError: error.message };
    }

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      opts.hard ? 'delete_dish' : 'archive_dish',
      'dish',
      dishId,
      current as Record<string, unknown>,
      opts.hard ? { deleted: true } : { status: 'archived', is_available: false }
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: undefined };
  }
);

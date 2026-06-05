'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';
import { PRIMARY_PROTEINS, DINING_FORMATS } from '@eatme/shared';
import { modifierGroupSchema } from '@/lib/modifiers/schemas';

// dish_kind is deprecated post-Phase-4 (Phase 7 drops the column). Kept here as
// an optional field on create/update so callers that haven't migrated yet still
// work. New code should set dining_format instead.
const DISH_KINDS = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;
const DISH_STATUSES = ['draft', 'published', 'archived'] as const;

const bundledItemSchema = z.object({
  name: z.string().min(1).max(200),
  note: z.string().max(500).nullable().optional(),
});

// modifierOptionSchema and modifierGroupSchema moved to @/lib/modifiers/schemas
// so the adapter unit test (and the soon-to-land restaurant-detail editor) can
// import them too. adminDishModifiersReplaceSchema below wraps the imported
// modifierGroupSchema — no behavior change.

const adminDishCreateSchema = z.object({
  menu_category_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  primary_protein: z.enum(PRIMARY_PROTEINS),
  dish_kind: z.enum(DISH_KINDS).optional(),
  dish_category_id: z.string().uuid().nullable().optional(),
  dining_format: z.enum(DINING_FORMATS).nullable().optional(),
  bundled_items: z.array(bundledItemSchema).max(50).nullable().optional(),
  // Portion size (migration 145). Always-paired or both null — DB CHECK
  // enforces; callers either send both or omit both. We collapse the pair
  // at the payload-build step below so a partial input fails fast.
  portion_amount: z.number().int().positive().nullable().optional(),
  portion_unit: z.enum(['g', 'ml', 'pcs', 'oz']).nullable().optional(),
});

// adminCreateDish: create a new dish under a restaurant. Lands as status='draft',
// is_available=true, is_template=false.
//
// menu_category_id may be null — that creates an "uncategorized" dish that
// surfaces in the orphan section on the restaurant detail page.
export const adminCreateDish = withAdminAuth(
  async (
    ctx,
    restaurantId: string,
    input: z.infer<typeof adminDishCreateSchema>
  ): Promise<ActionResult<{ dishId: string }>> => {
    const parsed = adminDishCreateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();
    const d = parsed.data;

    const { data: restaurant } = await service
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .maybeSingle();
    if (!restaurant) return { ok: false, formError: 'RESTAURANT_NOT_FOUND' };

    if (d.menu_category_id) {
      const { data: cat } = await service
        .from('menu_categories')
        .select('id')
        .eq('id', d.menu_category_id)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (!cat) return { ok: false, formError: 'INVALID_MENU_CATEGORY_ID' };
    }

    if (d.dish_category_id) {
      const { data: dc } = await service
        .from('dish_categories')
        .select('id')
        .eq('id', d.dish_category_id)
        .maybeSingle();
      if (!dc) return { ok: false, formError: 'INVALID_DISH_CATEGORY_ID' };
    }

    const insertPayload: Record<string, unknown> = {
      restaurant_id: restaurantId,
      menu_category_id: d.menu_category_id,
      name: d.name,
      description: d.description ?? null,
      price: d.price ?? 0,
      primary_protein: d.primary_protein,
      dish_kind: d.dish_kind ?? 'standard',
      dish_category_id: d.dish_category_id ?? null,
      status: 'draft' as const,
      is_available: true,
      is_template: false,
      dining_format: d.dining_format ?? null,
      bundled_items: d.bundled_items ?? null,
      portion_amount: d.portion_amount ?? null,
      portion_unit: d.portion_unit ?? null,
    };

    const { data: created, error } = await service
      .from('dishes')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select('id')
      .single();

    if (error || !created) {
      return { ok: false, formError: error?.message ?? 'CREATE_FAILED' };
    }

    const dishId = (created as { id: string }).id;

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'create_dish',
      'dish',
      dishId,
      null,
      insertPayload
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: { dishId } };
  }
);

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
  dining_format: z.enum(DINING_FORMATS).nullable().optional(),
  bundled_items: z.array(bundledItemSchema).max(50).nullable().optional(),
  // Portion size (migration 145). Emitted together by the editor's patch
  // builder so the DB's both-set-or-both-null CHECK never sees a half-write.
  portion_amount: z.number().int().positive().nullable().optional(),
  portion_unit: z.enum(['g', 'ml', 'pcs', 'oz']).nullable().optional(),
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
        'id, restaurant_id, name, description, price, status, is_available, primary_protein, dish_kind, menu_category_id, dish_category_id, dining_format, bundled_items, portion_amount, portion_unit'
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
    if (d.dining_format !== undefined) updatePayload.dining_format = d.dining_format;
    if (d.bundled_items !== undefined) updatePayload.bundled_items = d.bundled_items;
    // Portion fields move as a pair — emit both whenever either was supplied.
    // Caller can pass {portion_amount: null, portion_unit: null} to clear.
    if (d.portion_amount !== undefined || d.portion_unit !== undefined) {
      updatePayload.portion_amount = d.portion_amount ?? null;
      updatePayload.portion_unit = d.portion_unit ?? null;
    }

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

const adminDishModifiersReplaceSchema = z.object({
  groups: z.array(modifierGroupSchema).max(20),
});

// adminUpdateDishModifiers: atomically replace a dish's full modifier_groups
// set. Wraps the `admin_replace_dish_modifiers` Postgres function (migration
// 144) — deletes all existing option_groups + options for the dish and
// re-inserts the supplied list in a single transaction.
//
// Use when an admin edits modifier groups outside the menu-scan review flow
// (e.g. directly on the restaurant detail page). The menu-scan confirm path
// keeps using `admin_confirm_menu_scan` because it also touches dishes +
// menu_categories + the job row.
export const adminUpdateDishModifiers = withAdminAuth(
  async (
    ctx,
    dishId: string,
    restaurantId: string,
    input: z.infer<typeof adminDishModifiersReplaceSchema>
  ): Promise<ActionResult<{ groupCount: number }>> => {
    const parsed = adminDishModifiersReplaceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    // Restaurant-id guard — keeps a stale URL from rewriting modifiers on the
    // wrong dish.
    const { data: current } = await service
      .from('dishes')
      .select('id, restaurant_id, name')
      .eq('id', dishId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = service as any;
    const { data: result, error } = await svc.rpc('admin_replace_dish_modifiers', {
      p_dish_id: dishId,
      p_groups: parsed.data.groups,
    });

    if (error) {
      return { ok: false, formError: error.message ?? 'REPLACE_FAILED' };
    }

    const groupCount =
      (result as { group_count?: number } | null)?.group_count ?? parsed.data.groups.length;

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'replace_dish_modifiers',
      'dish',
      dishId,
      null,
      { group_count: groupCount }
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: { groupCount } };
  }
);

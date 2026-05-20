'use server';

import { revalidatePath } from 'next/cache';
import { withAuth, type ActionResult, type AuthCtx } from '@/lib/auth/wrappers';
import { dishSchemaV2, type DishV2Input } from '@eatme/shared';

type Sb = AuthCtx['supabase'];
type ModifierGroupInput = NonNullable<DishV2Input['modifier_groups']>[number];

// Atomically replace a dish's modifier groups + options. v2 hasn't been wired
// to call the admin_replace_dish_modifiers RPC yet (that's an apps/admin/ path
// today); when v2 revival picks this up, switch to the RPC for transactional
// safety. For now this is a delete-then-insert pair, which has a brief window
// where the dish has no groups — acceptable for owner-side edits on draft
// menus but should not be the production code path post-revival.
async function upsertModifierGroups(
  sb: Sb,
  dishId: string,
  restaurantId: string,
  groups: ModifierGroupInput[]
) {
  await sb.from('option_groups').delete().eq('dish_id', dishId);
  if (groups.length === 0) return;

  const { data: groupRows, error } = await sb
    .from('option_groups')
    .insert(
      groups.map((g, i) => ({
        dish_id: dishId,
        restaurant_id: restaurantId,
        name: g.name,
        selection_type: g.selection_type,
        min_selections: g.min_selections,
        max_selections: g.max_selections,
        display_in_card: g.display_in_card,
        display_order: i,
        is_active: true,
      }))
    )
    .select('id');

  if (error || !groupRows) return;

  const optionRows = groups
    .flatMap((g, i) =>
      (g.options ?? []).map((opt, j) => ({
        option_group_id: (groupRows as { id: string }[])[i]?.id,
        name: opt.name,
        price_delta: opt.price_delta,
        price_override: opt.price_override,
        primary_protein: opt.primary_protein,
        removes_dietary_tags: opt.removes_dietary_tags,
        adds_allergens: opt.adds_allergens,
        serves_delta: opt.serves_delta,
        is_default: opt.is_default,
        display_order: j,
        is_available: true,
      }))
    )
    .filter(r => !!r.option_group_id);

  if (optionRows.length > 0) {
    await sb.from('options').insert(optionRows);
  }
}

export const createDish = withAuth(
  async (
    ctx,
    restaurantId: string,
    menuCategoryId: string,
    input: DishV2Input
  ): Promise<ActionResult<{ id: string }>> => {
    const parsed = dishSchemaV2.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const d = parsed.data;

    const { data: dish, error } = await ctx.supabase
      .from('dishes')
      .insert({
        restaurant_id: restaurantId,
        menu_category_id: menuCategoryId,
        ...(d.dish_category_id ? { dish_category_id: d.dish_category_id } : {}),
        name: d.name,
        description: d.description || null,
        price: d.price,
        primary_protein: d.primary_protein,
        dish_kind: d.dish_kind,
        status: 'draft',
        dietary_tags: [],
        allergens: [],
        is_template: d.dish_kind === 'configurable' ? (d.is_template ?? false) : false,
        display_price_prefix: d.display_price_prefix ?? 'exact',
        serves: d.serves ?? 1,
        is_available: d.is_available ?? true,
        ...(d.photo_url ? { image_url: d.photo_url } : {}),
      })
      .select('id')
      .single();

    if (error || !dish) {
      return { ok: false, formError: 'CREATE_FAILED' };
    }

    if (d.modifier_groups.length > 0) {
      await upsertModifierGroups(ctx.supabase, dish.id, restaurantId, d.modifier_groups);
    }

    revalidatePath(`/restaurant/${restaurantId}/menu`, 'page');
    return { ok: true, data: { id: dish.id } };
  }
);

export const updateDish = withAuth(
  async (
    ctx,
    dishId: string,
    restaurantId: string,
    input: DishV2Input & { menu_category_id?: string }
  ): Promise<ActionResult<void>> => {
    const { menu_category_id, ...rest } = input;
    const parsed = dishSchemaV2.safeParse(rest);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const d = parsed.data;

    const updatePayload: Record<string, unknown> = {
      name: d.name,
      description: d.description || null,
      price: d.price,
      primary_protein: d.primary_protein,
      dish_kind: d.dish_kind,
      is_template: d.dish_kind === 'configurable' ? (d.is_template ?? false) : false,
      display_price_prefix: d.display_price_prefix ?? 'exact',
      serves: d.serves ?? 1,
      is_available: d.is_available ?? true,
    };
    if (d.dish_category_id !== undefined) updatePayload.dish_category_id = d.dish_category_id;
    if (d.photo_url !== undefined) updatePayload.image_url = d.photo_url;
    if (menu_category_id !== undefined) updatePayload.menu_category_id = menu_category_id;

    const { data, error } = await ctx.supabase
      .from('dishes')
      .update(updatePayload)
      .eq('id', dishId)
      .eq('restaurant_id', restaurantId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return { ok: false, formError: 'NOT_FOUND' };
    }

    // Always call — empty array means "delete all groups for this dish".
    await upsertModifierGroups(ctx.supabase, dishId, restaurantId, d.modifier_groups);

    revalidatePath(`/restaurant/${restaurantId}/menu`, 'page');
    return { ok: true, data: undefined };
  }
);

export const archiveDish = withAuth(
  async (ctx, dishId: string, restaurantId: string): Promise<ActionResult<void>> => {
    const { data, error } = await ctx.supabase
      .from('dishes')
      .update({ status: 'archived' })
      .eq('id', dishId)
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

export const unpublishDish = withAuth(
  async (ctx, dishId: string, restaurantId: string): Promise<ActionResult<void>> => {
    const { data, error } = await ctx.supabase
      .from('dishes')
      .update({ status: 'draft' })
      .eq('id', dishId)
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

export const updateDishPhotoPath = withAuth(
  async (
    ctx,
    dishId: string,
    restaurantId: string,
    photoPath: string
  ): Promise<ActionResult<void>> => {
    const { data, error } = await ctx.supabase
      .from('dishes')
      .update({ image_url: photoPath })
      .eq('id', dishId)
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

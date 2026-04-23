'use server';

import { revalidatePath } from 'next/cache';
import { withAuth, type ActionResult, type AuthCtx } from '@/lib/auth/wrappers';
import { dishSchemaV2, type DishV2Input } from '@eatme/shared';

type Sb = AuthCtx['supabase'];
type SlotInput = Extract<DishV2Input, { dish_kind: 'configurable' }>['slots'][number];
type CourseInput = Extract<DishV2Input, { dish_kind: 'course_menu' }>['courses'][number];

async function upsertSlots(sb: Sb, dishId: string, restaurantId: string, slots: SlotInput[]) {
  // Delete then re-insert for simplicity; slot ids are optional in v2 schema
  await sb.from('option_groups').delete().eq('dish_id', dishId);
  if (slots.length === 0) return;

  const { data: groups, error } = await sb
    .from('option_groups')
    .insert(
      slots.map((slot, i) => ({
        dish_id: dishId,
        restaurant_id: restaurantId,
        name: slot.name,
        description: slot.description ?? null,
        selection_type: slot.selection_type,
        min_selections: slot.min_selections ?? 0,
        max_selections: slot.max_selections ?? null,
        display_order: i,
        is_active: true,
      }))
    )
    .select('id');

  if (error || !groups) return;

  const optionRows = slots
    .flatMap((slot, i) =>
      (slot.options ?? []).map((opt, j) => ({
        option_group_id: (groups as { id: string }[])[i]?.id,
        name: opt.name,
        price_delta: opt.price_delta ?? 0,
        display_order: j,
        is_available: true,
      }))
    )
    .filter(r => !!r.option_group_id);

  if (optionRows.length > 0) {
    await sb.from('options').insert(optionRows);
  }
}

async function upsertCourses(sb: Sb, dishId: string, courses: CourseInput[]) {
  await sb.from('dish_courses').delete().eq('dish_id', dishId);
  if (courses.length === 0) return;

  const { data: courseRows, error } = await sb
    .from('dish_courses')
    .insert(
      courses.map(c => ({
        dish_id: dishId,
        course_number: c.course_number,
        course_name: c.course_name ?? null,
        required_count: c.required_count ?? 1,
        choice_type: c.choice_type,
      }))
    )
    .select('id');

  if (error || !courseRows) return;

  const itemRows = courses
    .flatMap((c, i) =>
      (c.items ?? []).map((item, j) => ({
        course_id: (courseRows as { id: string }[])[i]?.id,
        option_label: item.option_label,
        price_delta: item.price_delta ?? 0,
        links_to_dish_id: item.links_to_dish_id ?? null,
        sort_order: item.sort_order ?? j,
      }))
    )
    .filter(r => !!r.course_id);

  if (itemRows.length > 0) {
    await sb.from('dish_course_items').insert(itemRows);
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

    if (d.dish_kind === 'configurable') {
      await upsertSlots(ctx.supabase, dish.id, restaurantId, d.slots);
    } else if (d.dish_kind === 'course_menu') {
      await upsertCourses(ctx.supabase, dish.id, d.courses);
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

    if (d.dish_kind === 'configurable') {
      await upsertSlots(ctx.supabase, dishId, restaurantId, d.slots);
    } else if (d.dish_kind === 'course_menu') {
      await upsertCourses(ctx.supabase, dishId, d.courses);
    }

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

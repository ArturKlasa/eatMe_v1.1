'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

const adminCategoryCreateSchema = z.object({
  menu_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  canonical_category_id: z.string().uuid().nullable().optional(),
  source_language_code: z.string().min(2).max(10).nullable().optional(),
});

// adminCreateMenuCategory: create a new menu_category under (restaurant, menu).
// Pre-checks the partial unique indexes from migration 124:
//   - canonical: one (restaurant, menu, canonical_category) row
//   - custom:    one (restaurant, menu, lower(name)) row when canonical_category_id IS NULL
// On a 23505 race we surface the same friendly error so the UI can react
// consistently regardless of whether the dup was caught here or by the DB.
//
// When source_language_code is set, name (and description, when present) are
// mirrored into name_translations[lang] / description_translations[lang] so
// mobile reads the translated value via the COALESCE chain from migration 124.
export const adminCreateMenuCategory = withAdminAuth(
  async (
    ctx,
    restaurantId: string,
    input: z.infer<typeof adminCategoryCreateSchema>
  ): Promise<ActionResult<{ categoryId: string }>> => {
    const parsed = adminCategoryCreateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // canonical_menu_categories + new menu_categories columns aren't always in
    // the generated types — same loose-typed alias as adminUpdateMenuCategory.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = createAdminServiceClient() as any;
    const c = parsed.data;

    const { data: menu } = await svc
      .from('menus')
      .select('id')
      .eq('id', c.menu_id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!menu) return { ok: false, formError: 'INVALID_MENU_ID' };

    if (c.canonical_category_id) {
      const { data: canon } = await svc
        .from('canonical_menu_categories')
        .select('id')
        .eq('id', c.canonical_category_id)
        .maybeSingle();
      if (!canon) return { ok: false, formError: 'INVALID_CANONICAL_CATEGORY_ID' };

      const { data: collision } = await svc
        .from('menu_categories')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('menu_id', c.menu_id)
        .eq('canonical_category_id', c.canonical_category_id)
        .maybeSingle();
      if (collision) return { ok: false, formError: 'CATEGORY_ALREADY_LINKED' };
    } else {
      const { data: collision } = await svc
        .from('menu_categories')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('menu_id', c.menu_id)
        .is('canonical_category_id', null)
        .ilike('name', c.name)
        .maybeSingle();
      if (collision) return { ok: false, formError: 'CATEGORY_NAME_COLLISION' };
    }

    const { data: maxRow } = await svc
      .from('menu_categories')
      .select('display_order')
      .eq('menu_id', c.menu_id)
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder =
      ((maxRow as { display_order: number | null } | null)?.display_order ?? -1) + 1;

    const lang = c.source_language_code ?? null;
    const insertPayload: Record<string, unknown> = {
      restaurant_id: restaurantId,
      menu_id: c.menu_id,
      name: c.name,
      description: c.description ?? null,
      canonical_category_id: c.canonical_category_id ?? null,
      source_language_code: lang,
      display_order: nextOrder,
      is_active: true,
    };
    if (lang) {
      insertPayload.name_translations = { [lang]: c.name };
      if (c.description) {
        insertPayload.description_translations = { [lang]: c.description };
      }
    }

    const { data: created, error } = await svc
      .from('menu_categories')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      if (typeof error.message === 'string' && error.message.includes('23505')) {
        return {
          ok: false,
          formError: c.canonical_category_id
            ? 'CATEGORY_ALREADY_LINKED'
            : 'CATEGORY_NAME_COLLISION',
        };
      }
      return { ok: false, formError: error.message };
    }
    if (!created) return { ok: false, formError: 'CREATE_FAILED' };

    const categoryId = (created as { id: string }).id;

    await logAdminAction(
      svc,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'create_menu_category',
      'menu_category',
      categoryId,
      null,
      insertPayload
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: { categoryId } };
  }
);

const adminCategoryUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const adminUpdateMenuCategory = withAdminAuth(
  async (
    ctx,
    categoryId: string,
    restaurantId: string,
    input: z.infer<typeof adminCategoryUpdateSchema>
  ): Promise<ActionResult<void>> => {
    const parsed = adminCategoryUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // canonical/translation columns aren't always in the generated types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = createAdminServiceClient() as any;

    // Restaurant-id guard + load current state for collision check + audit diff.
    const { data: current } = await svc
      .from('menu_categories')
      .select(
        'id, restaurant_id, menu_id, name, description, is_active, canonical_category_id, source_language_code, name_translations, description_translations'
      )
      .eq('id', categoryId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    const c = parsed.data;

    // Pre-check name collision against migration 124's partial unique indexes.
    // Custom rows: (restaurant_id, menu_id, lower(name)) where canonical_category_id IS NULL.
    // Canonical rows: indexed on canonical_category_id, not name — rename is always safe.
    if (c.name && c.name !== current.name && current.canonical_category_id == null) {
      const { data: collision } = await svc
        .from('menu_categories')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('menu_id', current.menu_id)
        .is('canonical_category_id', null)
        .ilike('name', c.name)
        .neq('id', categoryId)
        .maybeSingle();
      if (collision) return { ok: false, formError: 'CATEGORY_NAME_COLLISION' };
    }

    const updatePayload: Record<string, unknown> = {};
    if (c.name !== undefined) updatePayload.name = c.name;
    if (c.description !== undefined) updatePayload.description = c.description;
    if (c.is_active !== undefined) updatePayload.is_active = c.is_active;

    // Symmetric translation sync: when source_language_code is set, mirror
    // name and description into their translation maps. Mobile reads the
    // translation map first (per migration 124/125 contract) — leaving them
    // out of sync would render stale text.
    const lang = current.source_language_code as string | null;
    if (lang) {
      const currentNameTranslations =
        (current.name_translations as Record<string, string> | null) ?? {};
      const currentDescTranslations =
        (current.description_translations as Record<string, string> | null) ?? {};

      if (c.name !== undefined) {
        updatePayload.name_translations = { ...currentNameTranslations, [lang]: c.name };
      }
      if (c.description !== undefined) {
        if (c.description == null || c.description === '') {
          // Remove the key when blanking the description.
          const next = { ...currentDescTranslations };
          delete next[lang];
          updatePayload.description_translations = next;
        } else {
          updatePayload.description_translations = {
            ...currentDescTranslations,
            [lang]: c.description,
          };
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return { ok: true, data: undefined };
    }

    const { error } = await svc
      .from('menu_categories')
      .update(updatePayload)
      .eq('id', categoryId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      // The DB still throws 23505 if a concurrent writer raced past our
      // pre-check. Surface the same friendly error so the UI can show it
      // consistently.
      if (typeof error.message === 'string' && error.message.includes('23505')) {
        return { ok: false, formError: 'CATEGORY_NAME_COLLISION' };
      }
      return { ok: false, formError: error.message };
    }

    await logAdminAction(
      svc,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'update_menu_category',
      'menu_category',
      categoryId,
      current as Record<string, unknown>,
      updatePayload
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: undefined };
  }
);

// adminDeleteMenuCategory: soft-delete by default — flips is_active=false.
// menu_categories has no `status` column (per schema), so we use the existing
// is_active boolean to mean "hidden". Dishes still pointing at it keep their
// menu_category_id intact; nothing breaks. Hard delete is reserved.
export const adminDeleteMenuCategory = withAdminAuth(
  async (
    ctx,
    categoryId: string,
    restaurantId: string,
    opts: { hard: boolean }
  ): Promise<ActionResult<{ dishesAffected: number }>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = createAdminServiceClient() as any;

    const { data: current } = await svc
      .from('menu_categories')
      .select('id, restaurant_id, name, is_active')
      .eq('id', categoryId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    // Count dishes that currently reference this category (informational).
    const { count: dishesAffected } = await svc
      .from('dishes')
      .select('id', { count: 'exact', head: true })
      .eq('menu_category_id', categoryId)
      .eq('restaurant_id', restaurantId);

    if (opts.hard) {
      const { error } = await svc
        .from('menu_categories')
        .delete()
        .eq('id', categoryId)
        .eq('restaurant_id', restaurantId);
      if (error) return { ok: false, formError: error.message };
    } else {
      const { error } = await svc
        .from('menu_categories')
        .update({ is_active: false })
        .eq('id', categoryId)
        .eq('restaurant_id', restaurantId);
      if (error) return { ok: false, formError: error.message };
    }

    await logAdminAction(
      svc,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      opts.hard ? 'delete_menu_category' : 'archive_menu_category',
      'menu_category',
      categoryId,
      current as Record<string, unknown>,
      opts.hard
        ? { deleted: true, dishes_affected: dishesAffected ?? 0 }
        : { is_active: false, dishes_affected: dishesAffected ?? 0 }
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: { dishesAffected: dishesAffected ?? 0 } };
  }
);

// adminReorderMenuCategories: rewrite display_order for every category under a
// menu to match the submitted order. The submitted id list must be exactly the
// menu's current category set — a mismatch means the page is stale, so we bail
// and let the client refresh rather than persisting a partial order.
export const adminReorderMenuCategories = withAdminAuth(
  async (
    ctx,
    restaurantId: string,
    menuId: string,
    orderedCategoryIds: string[]
  ): Promise<ActionResult<void>> => {
    const parsed = z.array(z.string().uuid()).min(1).safeParse(orderedCategoryIds);
    if (!parsed.success) return { ok: false, formError: 'INVALID_INPUT' };
    const ids = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = createAdminServiceClient() as any;

    const { data: existing, error: loadError } = await svc
      .from('menu_categories')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('menu_id', menuId);
    if (loadError) return { ok: false, formError: loadError.message };
    if (!existing || existing.length === 0) return { ok: false, formError: 'NOT_FOUND' };

    const existingIds = new Set((existing as { id: string }[]).map(r => r.id));
    const sameMembership = existingIds.size === ids.length && ids.every(id => existingIds.has(id));
    if (!sameMembership) return { ok: false, formError: 'STALE_ORDER' };

    // No unique index on (menu_id, display_order), so sequential per-row
    // updates can't transiently collide.
    for (let i = 0; i < ids.length; i++) {
      const { error } = await svc
        .from('menu_categories')
        .update({ display_order: i })
        .eq('id', ids[i])
        .eq('restaurant_id', restaurantId)
        .eq('menu_id', menuId);
      if (error) return { ok: false, formError: error.message };
    }

    await logAdminAction(
      svc,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'reorder_menu_categories',
      'menu',
      menuId,
      null,
      { ordered_category_ids: ids }
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    return { ok: true, data: undefined };
  }
);

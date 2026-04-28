'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

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

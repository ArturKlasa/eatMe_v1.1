'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

const createDishCategorySchema = z.object({
  name: z.string().min(1).max(100),
  is_drink: z.boolean().optional(),
});

// adminCreateDishCategory: append a new entry to the global dish_categories
// taxonomy. Lets admins extend the seeded baseline (~800 entries) when the AI
// emits something not yet in the taxonomy.
//
// Idempotent on the (lowercased) name: if a row already exists with the same
// case-insensitive name, return its id instead of inserting a duplicate.
export const adminCreateDishCategory = withAdminAuth(
  async (
    ctx,
    input: { name: string; is_drink?: boolean }
  ): Promise<ActionResult<{ id: string; name: string; is_drink: boolean; created: boolean }>> => {
    const parsed = createDishCategorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();
    const name = parsed.data.name.trim();
    const isDrink = parsed.data.is_drink ?? false;

    // Case-insensitive lookup first (dish_categories.name has UNIQUE on the
    // raw string but admins may type "Pizza" vs "pizza" — treat as same).
    const { data: existing } = await service
      .from('dish_categories')
      .select('id, name, is_drink')
      .ilike('name', name)
      .maybeSingle();

    if (existing) {
      const row = existing as { id: string; name: string; is_drink: boolean | null };
      return {
        ok: true,
        data: {
          id: row.id,
          name: row.name,
          is_drink: row.is_drink ?? false,
          created: false,
        },
      };
    }

    const { data: created, error } = await service
      .from('dish_categories')
      .insert({ name, is_drink: isDrink, is_active: true })
      .select('id, name, is_drink')
      .single();

    if (error || !created) {
      return { ok: false, formError: error?.message ?? 'CREATE_FAILED' };
    }

    const row = created as { id: string; name: string; is_drink: boolean | null };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'create_dish_category',
      'dish_category',
      row.id,
      null,
      { name: row.name, is_drink: row.is_drink ?? false }
    );

    // Revalidate any open menu-scan review page so the new category shows in
    // the dropdown without a manual refresh.
    revalidatePath('/menu-scan', 'layout');

    return {
      ok: true,
      data: {
        id: row.id,
        name: row.name,
        is_drink: row.is_drink ?? false,
        created: true,
      },
    };
  }
);

'use server';

import { revalidatePath } from 'next/cache';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

// Copy-menu actions (operator issue #16): one-time deep copy of another
// restaurant's menu tree into this (fresh) restaurant. The heavy lifting is
// admin_copy_restaurant_menu (migration 160) — a single transaction cloning
// menus → menu_categories → dishes → option_groups → options as drafts.

export type CopySourceCandidate = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  dish_count: number;
};

export const searchCopySourceRestaurants = withAdminAuth(
  async (
    _ctx,
    targetRestaurantId: string,
    query: string
  ): Promise<ActionResult<CopySourceCandidate[]>> => {
    const q = query.trim();
    if (q.length < 2) return { ok: true, data: [] };

    const service = createAdminServiceClient();
    const { data, error } = await service
      .from('restaurants')
      .select('id, name, city, status, dishes(count)')
      .ilike('name', `%${q}%`)
      .neq('id', targetRestaurantId)
      .order('name')
      .limit(10);

    if (error) return { ok: false, formError: error.message };

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      name: string;
      city: string | null;
      status: string;
      dishes: Array<{ count: number }>;
    }>;
    return {
      ok: true,
      data: rows.map(r => ({
        id: r.id,
        name: r.name,
        city: r.city,
        status: r.status,
        dish_count: r.dishes?.[0]?.count ?? 0,
      })),
    };
  }
);

type SuggestRpc = {
  rpc: (
    name: 'suggest_copy_source_restaurants',
    args: { p_target_restaurant_id: string; p_limit?: number }
  ) => Promise<{
    data: Array<{
      id: string;
      name: string;
      city: string | null;
      status: string;
      dish_count: number;
    }> | null;
    error: { message?: string } | null;
  }>;
};

// Proactive branch suggestions (operator issue #1): trigram-ranked restaurants
// whose name is similar to the (empty) target's, so the operator doesn't have
// to blind-search for a sucursal to copy from. Discovery only — selecting a
// suggestion reuses adminCopyRestaurantMenu below. Backed by the
// suggest_copy_source_restaurants RPC (migration 179).
export const suggestCopySourceRestaurants = withAdminAuth(
  async (_ctx, targetRestaurantId: string): Promise<ActionResult<CopySourceCandidate[]>> => {
    const service = createAdminServiceClient();
    const { data, error } = await (service as unknown as SuggestRpc).rpc(
      'suggest_copy_source_restaurants',
      { p_target_restaurant_id: targetRestaurantId, p_limit: 3 }
    );
    if (error) return { ok: false, formError: error.message };
    return {
      ok: true,
      data: (data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        city: r.city,
        status: r.status,
        dish_count: r.dish_count,
      })),
    };
  }
);

export type CopyMenuCounts = {
  menus_copied: number;
  categories_copied: number;
  dishes_copied: number;
  option_groups_copied: number;
  options_copied: number;
};

type CopyMenuRpc = {
  rpc: (
    name: 'admin_copy_restaurant_menu',
    args: { p_source_restaurant_id: string; p_target_restaurant_id: string }
  ) => Promise<{ data: CopyMenuCounts | null; error: { message?: string } | null }>;
};

// RAISE EXCEPTION codes from the RPC, surfaced as readable formErrors.
const RPC_ERRORS: Record<string, string> = {
  SOURCE_IS_TARGET: 'Source and target are the same restaurant.',
  SOURCE_NOT_FOUND: 'Source restaurant no longer exists.',
  TARGET_NOT_FOUND: 'Target restaurant no longer exists.',
  TARGET_HAS_MENUS:
    'This restaurant already has menus — the copy tool only fills empty restaurants to avoid duplicates.',
  SOURCE_HAS_COURSE_MENUS:
    'The source restaurant has course menus, which the copy tool does not support yet.',
};

export const adminCopyRestaurantMenu = withAdminAuth(
  async (
    ctx,
    targetRestaurantId: string,
    sourceRestaurantId: string
  ): Promise<ActionResult<CopyMenuCounts>> => {
    const service = createAdminServiceClient();

    const { data, error } = await (service as unknown as CopyMenuRpc).rpc(
      'admin_copy_restaurant_menu',
      {
        p_source_restaurant_id: sourceRestaurantId,
        p_target_restaurant_id: targetRestaurantId,
      }
    );

    if (error) {
      const code = Object.keys(RPC_ERRORS).find(k => error.message?.includes(k));
      return { ok: false, formError: code ? RPC_ERRORS[code] : (error.message ?? 'COPY_FAILED') };
    }
    if (!data) return { ok: false, formError: 'COPY_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'copy_restaurant_menu',
      'restaurant',
      targetRestaurantId,
      null,
      { source_restaurant_id: sourceRestaurantId, ...data }
    );

    revalidatePath(`/restaurants/${targetRestaurantId}`, 'page');
    return { ok: true, data };
  }
);

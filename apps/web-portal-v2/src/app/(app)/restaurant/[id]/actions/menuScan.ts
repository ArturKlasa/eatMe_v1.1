'use server';

import { revalidatePath } from 'next/cache';
import { withAuth, type ActionResult } from '@/lib/auth/wrappers';
import {
  menuScanJobInputSchema,
  type MenuScanJobInput,
  confirmMenuScanPayloadSchema,
  type ConfirmMenuScanPayload,
} from '@eatme/shared';

export const createMenuScanJob = withAuth(
  async (
    ctx,
    restaurantId: string,
    input: MenuScanJobInput
  ): Promise<ActionResult<{ jobId: string }>> => {
    const { data: restaurant } = await ctx.supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', ctx.userId)
      .maybeSingle();

    if (!restaurant) return { ok: false, formError: 'FORBIDDEN' };

    const parsed = menuScanJobInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { data: job, error } = await ctx.supabase
      .from('menu_scan_jobs')
      .insert({
        restaurant_id: restaurantId,
        created_by: ctx.userId,
        status: 'pending',
        input: parsed.data,
      })
      .select('id')
      .single();

    if (error || !job) return { ok: false, formError: 'CREATE_FAILED' };

    revalidatePath(`/restaurant/${restaurantId}/menu-scan`);
    return { ok: true, data: { jobId: job.id } };
  }
);

export const confirmMenuScan = withAuth(
  async (ctx, payload: ConfirmMenuScanPayload): Promise<ActionResult<{ dishIds: string[] }>> => {
    const parsed = confirmMenuScanPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // Verify job ownership
    const { data: job } = await ctx.supabase
      .from('menu_scan_jobs')
      .select('restaurant_id, created_by, status')
      .eq('id', parsed.data.job_id)
      .maybeSingle();

    if (!job || job.created_by !== ctx.userId) {
      return { ok: false, formError: 'FORBIDDEN' };
    }

    // Server-side: verify all menu_category_ids belong to this restaurant
    const categoryIds = [...new Set(parsed.data.dishes.map(d => d.menu_category_id))];
    if (categoryIds.length > 0) {
      const { data: validMenus } = await ctx.supabase
        .from('menus')
        .select('id')
        .eq('restaurant_id', job.restaurant_id);

      const validMenuIds = (validMenus ?? []).map(m => m.id);

      const { data: validCategories } = await ctx.supabase
        .from('menu_categories')
        .select('id')
        .in('id', categoryIds)
        .in('menu_id', validMenuIds);

      const validCategoryIdSet = new Set((validCategories ?? []).map(c => c.id));
      if (!categoryIds.every(id => validCategoryIdSet.has(id))) {
        return { ok: false, formError: 'FORBIDDEN' };
      }
    }

    const { data, error } = await (
      ctx.supabase as unknown as {
        rpc: (
          name: string,
          args: unknown
        ) => Promise<{ data: unknown; error: { code?: string } | null }>;
      }
    ).rpc('confirm_menu_scan', {
      p_job_id: parsed.data.job_id,
      p_payload: { dishes: parsed.data.dishes },
      p_idempotency_key: parsed.data.idempotency_key,
    });

    if (error) {
      const e = error as { code?: string };
      if (e.code === 'insufficient_privilege') return { ok: false, formError: 'FORBIDDEN' };
      return { ok: false, formError: 'UNKNOWN_ERROR' };
    }

    const result = data as { confirmed: boolean; inserted_dish_ids: string[] } | null;
    revalidatePath(`/restaurant/${job.restaurant_id}/menu`);
    revalidatePath(`/restaurant/${job.restaurant_id}/menu-scan`);
    return { ok: true, data: { dishIds: result?.inserted_dish_ids ?? [] } };
  }
);

export const retryMenuScan = withAuth(async (ctx, jobId: string): Promise<ActionResult<void>> => {
  const { data: job } = await ctx.supabase
    .from('menu_scan_jobs')
    .select('id, created_by, restaurant_id')
    .eq('id', jobId)
    .maybeSingle();

  if (!job || job.created_by !== ctx.userId) {
    return { ok: false, formError: 'FORBIDDEN' };
  }

  const { error } = await ctx.supabase
    .from('menu_scan_jobs')
    .update({ status: 'pending', attempts: 0, last_error: null, locked_until: null })
    .eq('id', jobId);

  if (error) return { ok: false, formError: 'UPDATE_FAILED' };

  revalidatePath(`/restaurant/${job.restaurant_id}/menu-scan/${jobId}`);
  return { ok: true, data: undefined };
});

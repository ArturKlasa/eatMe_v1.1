'use server';

import { revalidatePath } from 'next/cache';
import { withAuth, type ActionResult } from '@/lib/auth/wrappers';
import { menuScanJobInputSchema, type MenuScanJobInput } from '@eatme/shared';

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

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';
import { menuScanJobInputSchema } from '@eatme/shared';

const VALID_REPLAY_MODELS = ['gpt-4o-2024-11-20', 'gpt-4o-mini'] as const;
type ReplayModel = (typeof VALID_REPLAY_MODELS)[number];

// replayMenuScan: duplicates an existing job's input into a new pending job,
// then fires a direct POST to the Edge Function to kick off processing immediately.
export const replayMenuScan = withAdminAuth(
  async (
    ctx,
    jobId: string,
    opts: { model: ReplayModel }
  ): Promise<ActionResult<{ newJobId: string }>> => {
    if (!VALID_REPLAY_MODELS.includes(opts.model)) {
      return { ok: false, formError: 'INVALID_MODEL' };
    }

    const service = createAdminServiceClient();

    const { data: job } = await service
      .from('menu_scan_jobs')
      .select('id, restaurant_id, input, status')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return { ok: false, formError: 'NOT_FOUND' };

    const parsedInput = menuScanJobInputSchema.safeParse(job.input);
    if (!parsedInput.success) return { ok: false, formError: 'INVALID_INPUT' };

    const { data: newJob, error: insertError } = await service
      .from('menu_scan_jobs')
      .insert({
        restaurant_id: (job as Record<string, unknown>).restaurant_id as string,
        created_by: ctx.userId,
        status: 'pending',
        input: { ...parsedInput.data, model_hint: opts.model },
      })
      .select('id')
      .single();

    if (insertError || !newJob) return { ok: false, formError: 'CREATE_FAILED' };

    // fire worker directly (non-blocking, best-effort)
    const workerUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/menu-scan-worker`;
    await fetch(workerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => {}); // best-effort; cron will pick it up if direct call fails

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'replay_menu_scan',
      'menu_scan_job',
      jobId,
      { status: (job as Record<string, unknown>).status as string },
      { new_job_id: (newJob as Record<string, unknown>).id, model: opts.model }
    );

    revalidatePath('/menu-scan');
    return {
      ok: true,
      data: { newJobId: (newJob as Record<string, unknown>).id as string },
    };
  }
);

const updateStatusSchema = z.object({
  status: z.enum(['needs_review', 'failed']),
});

// adminUpdateJobStatus: flip a job status (for debugging). Only needs_review <-> failed.
export const adminUpdateJobStatus = withAdminAuth(
  async (
    ctx,
    jobId: string,
    input: { status: 'needs_review' | 'failed' }
  ): Promise<ActionResult<void>> => {
    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('menu_scan_jobs')
      .select('status')
      .eq('id', jobId)
      .maybeSingle();

    if (!current) return { ok: false, formError: 'NOT_FOUND' };
    if ((current as Record<string, unknown>).status === parsed.data.status) {
      return { ok: true, data: undefined };
    }

    const { error } = await service
      .from('menu_scan_jobs')
      .update({ status: parsed.data.status })
      .eq('id', jobId);

    if (error) return { ok: false, formError: 'UPDATE_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'update_job_status',
      'menu_scan_job',
      jobId,
      { status: (current as Record<string, unknown>).status as string },
      { status: parsed.data.status }
    );

    revalidatePath(`/menu-scan/${jobId}`);
    return { ok: true, data: undefined };
  }
);

// adminCreateMenuScanJob: create a job for any restaurant (admin bypass)
export const adminCreateMenuScanJob = withAdminAuth(
  async (
    ctx,
    restaurantId: string,
    input: { images: Array<{ bucket: 'menu-scan-uploads'; path: string; page: number }> }
  ): Promise<ActionResult<{ jobId: string }>> => {
    const parsed = menuScanJobInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    const { data: job, error } = await service
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

    // fire worker best-effort
    const workerUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/menu-scan-worker`;
    await fetch(workerUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    }).catch(() => {});

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'create_menu_scan_job',
      'menu_scan_job',
      (job as Record<string, unknown>).id as string,
      null,
      { restaurant_id: restaurantId, images_count: parsed.data.images.length }
    );

    revalidatePath('/menu-scan');
    return { ok: true, data: { jobId: (job as Record<string, unknown>).id as string } };
  }
);

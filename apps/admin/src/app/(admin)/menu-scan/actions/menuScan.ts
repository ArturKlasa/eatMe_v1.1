'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';
import {
  menuScanJobInputSchema,
  countryToLanguage,
  DEFAULT_LANGUAGE,
  type SupportedLanguage,
} from '@eatme/shared';
import { confirmPayloadSchema } from './confirmSchema';

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

// adminConfirmMenuScan: persist edited dishes from the review UI.
//
// Phase 4.2 (2026-05-19): the entire confirm pipeline (menu_categories upserts,
// multi-pass dish/variant/course inserts, modifier-group inserts, audit log,
// job state transition) is wrapped in the `admin_confirm_menu_scan` Postgres
// function (migration 144). The TS action is now a thin wrapper that resolves
// source_language_code from the restaurant's country_code (kept TS-side so we
// keep the rich `countryToLanguage` map in one place), then calls the RPC.
//
// Error contract: RPC raises stable-text exceptions (NOT_FOUND, ALREADY_COMPLETED,
// RESTAURANT_NOT_FOUND, INVALID_CATEGORY_ID, INVALID_DISH_CATEGORY_ID). We map
// to ActionResult error shapes here. PostgreSQL transaction wrapping guarantees
// no partial state on any exception path — that's the whole point of this RPC.
export const adminConfirmMenuScan = withAdminAuth(
  async (
    ctx,
    jobId: string,
    payload: unknown
  ): Promise<
    ActionResult<{
      insertedCount: number;
      menuCreated: boolean;
      categoriesCreated: number;
      categoriesLinked: number;
    }>
  > => {
    const parsed = confirmPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    // Pre-resolve the source language client-side using the country→language
    // map (kept in @eatme/shared rather than re-implementing in PL/pgSQL). The
    // RPC trusts whatever language code is in the payload.
    let sourceLanguage: SupportedLanguage =
      (parsed.data.source_language_code as SupportedLanguage | null) ?? DEFAULT_LANGUAGE;
    if (!parsed.data.source_language_code) {
      const { data: jobRow } = await service
        .from('menu_scan_jobs')
        .select('restaurant_id')
        .eq('id', jobId)
        .maybeSingle();
      const restaurantId = (jobRow as Record<string, unknown> | null)?.restaurant_id as
        | string
        | undefined;
      if (restaurantId) {
        const { data: restaurant } = await service
          .from('restaurants')
          .select('country_code')
          .eq('id', restaurantId)
          .maybeSingle();
        const countryCode = (restaurant as Record<string, unknown> | null)?.country_code as
          | string
          | null
          | undefined;
        sourceLanguage = countryToLanguage(countryCode ?? null);
      }
    }

    const rpcPayload = {
      ...parsed.data,
      source_language_code: sourceLanguage,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = service as any;
    const { data: result, error } = await svc.rpc('admin_confirm_menu_scan', {
      p_job_id: jobId,
      p_admin_id: ctx.userId,
      p_admin_email: ctx.user.email ?? '',
      p_payload: rpcPayload,
    });

    if (error) {
      // RPC raises stable-text exceptions; the message text is what we surface
      // to the client. Anything else is an unexpected Postgres error.
      return { ok: false, formError: error.message ?? 'CONFIRM_FAILED' };
    }

    const summary = (result ?? {}) as {
      inserted_count?: number;
      menu_created?: boolean;
      categories_created?: number;
      categories_linked?: number;
    };

    revalidatePath(`/menu-scan/${jobId}`);
    revalidatePath('/menu-scan');
    return {
      ok: true,
      data: {
        insertedCount: summary.inserted_count ?? 0,
        menuCreated: summary.menu_created ?? false,
        categoriesCreated: summary.categories_created ?? 0,
        categoriesLinked: summary.categories_linked ?? 0,
      },
    };
  }
);

// skipMenuScanRestaurant: mark a restaurant as not needing a menu scan.
// Mirrors v1's skipRestaurantFromMenuScan behaviour; removes it from the
// "restaurants that still need menus" queue so it stops showing in the picker.
export const skipMenuScanRestaurant = withAdminAuth(
  async (ctx, restaurantId: string): Promise<ActionResult<void>> => {
    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('id, name, skip_menu_scan')
      .eq('id', restaurantId)
      .maybeSingle();

    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    const { error } = await service
      .from('restaurants')
      .update({ skip_menu_scan: true })
      .eq('id', restaurantId);

    if (error) return { ok: false, formError: 'UPDATE_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'skip_menu_scan',
      'restaurant',
      restaurantId,
      { skip_menu_scan: (current as Record<string, unknown>).skip_menu_scan as boolean },
      { skip_menu_scan: true }
    );

    revalidatePath('/menu-scan');
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

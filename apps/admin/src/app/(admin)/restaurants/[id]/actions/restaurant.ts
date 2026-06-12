'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { SUPPORTED_CURRENCIES } from '@eatme/shared';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';

// adminPublishRestaurant: admin-side counterpart to publish_restaurant_draft.
//
// publish_restaurant_draft (migration 120) is SECURITY DEFINER but its auth
// check (auth.uid() = owner_id OR is_admin()) reads the JWT, which is empty
// under the service-role client we use everywhere in admin. So admin replicates
// the same multi-table flip directly via service-role UPDATEs and audit-logs it.
//
// Idempotent: WHERE status = 'draft' so a second call is a no-op once the
// restaurant is already published.
export const adminPublishRestaurant = withAdminAuth(
  async (
    ctx,
    restaurantId: string
  ): Promise<
    ActionResult<{
      restaurantPublished: boolean;
      menusPublished: number;
      dishesPublished: number;
    }>
  > => {
    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('id, status')
      .eq('id', restaurantId)
      .maybeSingle();

    if (!current) return { ok: false, formError: 'NOT_FOUND' };
    const wasDraft = (current as Record<string, unknown>).status === 'draft';

    // Restaurant
    if (wasDraft) {
      const { error } = await service
        .from('restaurants')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', restaurantId)
        .eq('status', 'draft');
      if (error) return { ok: false, formError: error.message };
    }

    // Menus
    const { data: menusUpdated, error: menusErr } = await service
      .from('menus')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'draft')
      .select('id');
    if (menusErr) return { ok: false, formError: menusErr.message };
    const menusPublished = (menusUpdated ?? []).length;

    // Dishes
    const { data: dishesUpdated, error: dishesErr } = await service
      .from('dishes')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'draft')
      .select('id');
    if (dishesErr) return { ok: false, formError: dishesErr.message };
    const dishesPublished = (dishesUpdated ?? []).length;

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'publish_restaurant',
      'restaurant',
      restaurantId,
      { status: (current as Record<string, unknown>).status as string },
      {
        status: 'published',
        menus_published: menusPublished,
        dishes_published: dishesPublished,
      }
    );

    revalidatePath(`/restaurants/${restaurantId}`, 'page');
    revalidatePath('/restaurants', 'page');
    return {
      ok: true,
      data: { restaurantPublished: wasDraft, menusPublished, dishesPublished },
    };
  }
);

const suspendSchema = z
  .object({
    is_active: z.boolean(),
    reason: z.string().optional(),
  })
  .refine(d => d.is_active || (!!d.reason && d.reason.trim().length > 0), {
    message: 'Suspension reason is required',
    path: ['reason'],
  });

export const suspendRestaurant = withAdminAuth(
  async (
    ctx,
    id: string,
    input: { is_active: boolean; reason?: string }
  ): Promise<ActionResult<void>> => {
    const parsed = suspendSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('is_active, suspended_at, suspended_by, suspension_reason')
      .eq('id', id)
      .maybeSingle();

    const { is_active, reason } = parsed.data;
    const updatePayload = is_active
      ? { is_active: true, suspended_at: null, suspended_by: null, suspension_reason: null }
      : {
          is_active: false,
          suspended_at: new Date().toISOString(),
          suspended_by: ctx.userId,
          suspension_reason: reason ?? null,
        };

    const { error } = await service.from('restaurants').update(updatePayload).eq('id', id);

    if (error) return { ok: false, formError: 'UPDATE_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      is_active ? 'unsuspend_restaurant' : 'suspend_restaurant',
      'restaurant',
      id,
      current
        ? {
            is_active: current.is_active,
            suspended_at: current.suspended_at,
          }
        : null,
      { is_active: updatePayload.is_active, suspended_at: updatePayload.suspended_at ?? null }
    );

    revalidatePath(`/restaurants/${id}`, 'page');
    revalidatePath('/restaurants', 'page');
    return { ok: true, data: undefined };
  }
);

// setRestaurantNeedsRedo: toggle the operator's "needs redoing" flag
// (migration 162) — set during scan review when something is slightly off,
// cleared once the restaurant has been revisited. Surfaced as a filter +
// badge in the admin restaurants list.
export const setRestaurantNeedsRedo = withAdminAuth(
  async (ctx, id: string, needsRedo: boolean): Promise<ActionResult<{ needs_redo: boolean }>> => {
    if (typeof needsRedo !== 'boolean') return { ok: false, formError: 'VALIDATION' };

    // needs_redo isn't in the generated Database types yet — regenerate after
    // applying migration 162. Loose cast keeps the rest of the file typed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createAdminServiceClient() as any;

    const { data: current } = await service
      .from('restaurants')
      .select('id, needs_redo')
      .eq('id', id)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    const { error } = await service
      .from('restaurants')
      .update({ needs_redo: needsRedo, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { ok: false, formError: 'UPDATE_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      needsRedo ? 'flag_restaurant_needs_redo' : 'clear_restaurant_needs_redo',
      'restaurant',
      id,
      { needs_redo: (current as { needs_redo: boolean | null }).needs_redo ?? false },
      { needs_redo: needsRedo }
    );

    revalidatePath(`/restaurants/${id}`, 'page');
    revalidatePath('/restaurants', 'page');
    return { ok: true, data: { needs_redo: needsRedo } };
  }
);

const adminBasicsSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  // country_code: ISO 3166-1 alpha-2, uppercase. Free-text empty string allowed
  // so admin can clear it. When set, currency_code should track in the UI but
  // the admin can override (see plan: locked decision 3).
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/, 'Country code must be ISO alpha-2 uppercase (e.g. MX)')
    .optional()
    .or(z.literal('')),
  currency_code: z.enum(SUPPORTED_CURRENCIES).optional(),
});

export const updateAdminRestaurantBasics = withAdminAuth(
  async (
    ctx,
    id: string,
    input: z.infer<typeof adminBasicsSchema>
  ): Promise<ActionResult<void>> => {
    const parsed = adminBasicsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('name, description, city, phone, website, address, country_code, currency_code')
      .eq('id', id)
      .maybeSingle();

    const d = parsed.data;
    const updatePayload: Record<string, unknown> = {
      name: d.name,
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.city !== undefined ? { city: d.city || null } : {}),
      ...(d.address !== undefined ? { address: d.address || '' } : {}),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.website !== undefined ? { website: d.website || null } : {}),
      ...(d.country_code !== undefined ? { country_code: d.country_code || null } : {}),
      // currency_code is NOT NULL on the DB — only include in the payload when
      // explicitly set so callers that only edit name/description don't accidentally
      // wipe it. Empty string is never valid (Zod enum rejects).
      ...(d.currency_code !== undefined ? { currency_code: d.currency_code } : {}),
    };

    const { error } = await service
      .from('restaurants')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updatePayload as any)
      .eq('id', id);

    if (error) return { ok: false, formError: 'UPDATE_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'update_restaurant_basics',
      'restaurant',
      id,
      current as Record<string, unknown> | null,
      updatePayload
    );

    revalidatePath(`/restaurants/${id}`, 'page');
    return { ok: true, data: undefined };
  }
);

// updateAdminRestaurantOpeningHours: edit the restaurants.open_hours jsonb.
//
// Shape we persist (matches mapGoogleOpeningHours and what the feed
// isOpenNow() reads): Record<lowercase-day, { open: 'HH:MM', close: 'HH:MM' }>.
// A missing day key = closed that day. Passing null clears the column entirely
// (treated as "no hours on record" — the feed will filter the restaurant out
// of "open now" results, same as before the importer was fixed in 1cec0c4).
//
// Overnight close (close < open) is allowed — the Google mapper documents that
// it preserves overnight spans, and isOpenNow() handles wraparound.
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const dayHoursSchema = z.object({
  open: z.string().regex(HHMM_RE, 'Use 24h HH:MM (e.g. 09:00)'),
  close: z.string().regex(HHMM_RE, 'Use 24h HH:MM (e.g. 22:00)'),
});
const openHoursSchema = z
  .object({
    monday: dayHoursSchema.optional(),
    tuesday: dayHoursSchema.optional(),
    wednesday: dayHoursSchema.optional(),
    thursday: dayHoursSchema.optional(),
    friday: dayHoursSchema.optional(),
    saturday: dayHoursSchema.optional(),
    sunday: dayHoursSchema.optional(),
  })
  .strict();

export const updateAdminRestaurantOpeningHours = withAdminAuth(
  async (
    ctx,
    id: string,
    input: { open_hours: Record<string, { open: string; close: string }> | null }
  ): Promise<ActionResult<void>> => {
    let normalised: z.infer<typeof openHoursSchema> | null;
    if (input.open_hours === null) {
      normalised = null;
    } else {
      const parsed = openHoursSchema.safeParse(input.open_hours);
      if (!parsed.success) {
        return {
          ok: false,
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }
      // Drop keys with no span — empty object means "no hours", which is what
      // the importer wrote pre-fix and the UI now renders as "no hours on
      // record". Keeping empty keys would confuse isOpenNow() the same way.
      const cleaned: Record<string, { open: string; close: string }> = {};
      for (const [day, span] of Object.entries(parsed.data)) {
        if (span) cleaned[day] = span;
      }
      normalised = Object.keys(cleaned).length > 0 ? cleaned : null;
    }

    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('open_hours')
      .eq('id', id)
      .maybeSingle();

    const { error } = await service
      .from('restaurants')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ open_hours: normalised as any })
      .eq('id', id);

    if (error) return { ok: false, formError: 'UPDATE_FAILED' };

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'update_restaurant_open_hours',
      'restaurant',
      id,
      current ? { open_hours: (current as { open_hours: unknown }).open_hours } : null,
      { open_hours: normalised }
    );

    revalidatePath(`/restaurants/${id}`, 'page');
    return { ok: true, data: undefined };
  }
);

// adminDeleteRestaurant: hard delete. Cascade is performed by the
// admin_delete_restaurant(uuid) Postgres function (migration 130) so the whole
// thing is one transaction. After the row is gone we best-effort clean the
// menu-scan-uploads bucket; the photos bucket (dish_photos.photo_url etc.)
// is NOT cleaned — those files use user-scoped paths and become orphans.
//
// Confirmation: the caller must pass the restaurant's exact name. We re-check
// it server-side as defense in depth on top of the modal's typed-confirm.
export type AdminDeleteRestaurantCounts = {
  dishes_deleted: number;
  menu_categories_deleted: number;
  menus_deleted: number;
  opinions_deleted: number;
  photos_deleted: number;
  visits_deleted: number;
  favorites_deleted: number;
  scan_jobs_deleted: number;
  option_groups_deleted: number;
  options_deleted: number;
  analytics_deleted: number;
  interactions_deleted: number;
  session_views_deleted: number;
  sessions_unset: number;
  recommendations_deleted: number;
  votes_deleted: number;
  responses_deleted: number;
  storage_paths: string[];
};

type AdminDeleteRestaurantRpc = {
  rpc: (
    name: 'admin_delete_restaurant',
    args: { p_restaurant_id: string }
  ) => Promise<{ data: AdminDeleteRestaurantCounts | null; error: unknown }>;
};

export const adminDeleteRestaurant = withAdminAuth(
  async (
    ctx,
    restaurantId: string,
    opts: { confirmName: string }
  ): Promise<ActionResult<AdminDeleteRestaurantCounts>> => {
    const service = createAdminServiceClient();

    const { data: current } = await service
      .from('restaurants')
      .select('id, name, status')
      .eq('id', restaurantId)
      .maybeSingle();
    if (!current) return { ok: false, formError: 'NOT_FOUND' };

    const currentRow = current as { id: string; name: string; status: string };
    if (currentRow.name !== opts.confirmName) {
      return { ok: false, formError: 'CONFIRM_MISMATCH' };
    }

    const { data, error } = await (service as unknown as AdminDeleteRestaurantRpc).rpc(
      'admin_delete_restaurant',
      { p_restaurant_id: restaurantId }
    );
    if (error) {
      const msg = (error as { message?: string }).message ?? 'DELETE_FAILED';
      return { ok: false, formError: msg };
    }
    if (!data) return { ok: false, formError: 'DELETE_FAILED' };

    // Best-effort storage cleanup. Failures here don't roll back the DB delete.
    try {
      const paths = data.storage_paths ?? [];
      if (paths.length > 0) {
        await service.storage.from('menu-scan-uploads').remove(paths);
      }
      const { data: leftovers } = await service.storage
        .from('menu-scan-uploads')
        .list(restaurantId);
      if (leftovers && leftovers.length > 0) {
        await service.storage
          .from('menu-scan-uploads')
          .remove(leftovers.map(f => `${restaurantId}/${f.name}`));
      }
    } catch (e) {
      console.error('[adminDeleteRestaurant] storage cleanup failed:', e);
    }

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'delete_restaurant',
      'restaurant',
      restaurantId,
      { name: currentRow.name, status: currentRow.status },
      data as unknown as Record<string, unknown>
    );

    revalidatePath('/restaurants', 'page');
    return { ok: true, data };
  }
);

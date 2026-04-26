'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';
import { logAdminAction } from '@/lib/audit';
import { createAdminServiceClient } from '@/lib/supabase/server';
import {
  menuScanJobInputSchema,
  PRIMARY_PROTEINS,
  countryToLanguage,
  DEFAULT_LANGUAGE,
  type SupportedLanguage,
} from '@eatme/shared';

const DISH_KINDS = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;

// Per-dish category resolution. Exactly one of the three category_* fields is
// expected to be set (or all null for "no category"). Validation below enforces
// that — the admin UI dropdown produces this shape directly.
const reviewedDishSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  price: z.number().nonnegative().nullable(),
  dish_kind: z.enum(DISH_KINDS),
  primary_protein: z.enum(PRIMARY_PROTEINS),
  source_image_index: z.number().int().min(0).nullable(),
  category_existing_id: z.string().uuid().nullable(),
  category_canonical_slug: z.string().min(1).max(100).nullable(),
  category_custom_name: z.string().min(1).max(200).nullable(),
});

// One per unique category referenced by dishes in this scan. Carries the
// admin-edited section description (in source language). Exactly one of
// canonical_slug / custom_name / existing_id must match a category referenced
// by at least one dish in the same payload.
const reviewedCategoryDescriptionSchema = z.object({
  canonical_slug: z.string().min(1).max(100).nullable(),
  custom_name: z.string().min(1).max(200).nullable(),
  existing_id: z.string().uuid().nullable(),
  description: z.string().max(2000).nullable(),
});

const confirmPayloadSchema = z.object({
  dishes: z.array(reviewedDishSchema).min(1).max(200),
  // Source language for any custom categories created in this scan. Admin sets
  // this in the review UI based on the language banner (country-derived default,
  // overridable when AI-detected language differs).
  source_language_code: z.string().min(2).max(10).nullable(),
  // Optional descriptions per unique category. Empty/missing entries are skipped.
  category_descriptions: z.array(reviewedCategoryDescriptionSchema).max(200).optional(),
});

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
// Pipeline:
//   1. Validate payload + load job/restaurant; reject if already completed.
//   2. Resolve source language (payload override → country-derived default).
//   3. Ensure restaurant has a menu — auto-create "Main Menu" if none exists.
//   4. Resolve canonical slugs (look up canonical_menu_categories rows once).
//   5. Validate any existing-id categories actually belong to this restaurant.
//   6. Dedupe + upsert menu_categories rows (one per unique canonical slug or
//      custom name across all dishes). Build a tuple → menu_category_id map.
//   7. Insert dishes (status='draft') with menu_category_id resolved from map.
//   8. Mark job 'completed' with saved_dish_ids + audit log.
//
// Partial unique indexes on menu_categories (migration 124) protect against
// duplicate category creation if the function crashes mid-way and admin retries.
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
    // canonical_menu_categories + new menu_categories columns
    // (canonical_category_id, source_language_code, name_translations) are not
    // yet in the generated Database types — regenerate after applying
    // migration 124. Using a loose-typed alias for those queries keeps the rest
    // of this function fully typed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = service as any;

    // ── (1) Load job + restaurant ──────────────────────────────────────────
    const { data: job } = await service
      .from('menu_scan_jobs')
      .select('id, restaurant_id, status')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return { ok: false, formError: 'NOT_FOUND' };
    const status = (job as Record<string, unknown>).status as string;
    if (status === 'completed') return { ok: false, formError: 'ALREADY_COMPLETED' };

    const restaurantId = (job as Record<string, unknown>).restaurant_id as string;

    const { data: restaurant } = await service
      .from('restaurants')
      .select('id, country_code')
      .eq('id', restaurantId)
      .maybeSingle();

    if (!restaurant) return { ok: false, formError: 'RESTAURANT_NOT_FOUND' };
    const countryCode = (restaurant as Record<string, unknown>).country_code as string | null;

    // ── (2) Resolve source language ────────────────────────────────────────
    const sourceLanguage: SupportedLanguage =
      (parsed.data.source_language_code as SupportedLanguage | null) ??
      countryToLanguage(countryCode);

    // ── (3) Ensure menu exists ─────────────────────────────────────────────
    const { data: existingMenus } = await service
      .from('menus')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('menu_type', 'food')
      .order('display_order', { ascending: true })
      .limit(1);

    let menuId: string;
    let menuCreated = false;
    if (existingMenus && existingMenus.length > 0) {
      menuId = (existingMenus[0] as { id: string }).id;
    } else {
      const { data: newMenu, error: menuError } = await service
        .from('menus')
        .insert({
          restaurant_id: restaurantId,
          name: 'Main Menu',
          menu_type: 'food',
          display_order: 0,
          is_active: true,
        })
        .select('id')
        .single();
      if (menuError || !newMenu) {
        return { ok: false, formError: menuError?.message ?? 'MENU_CREATE_FAILED' };
      }
      menuId = (newMenu as { id: string }).id;
      menuCreated = true;
    }

    // ── (4) Resolve canonical slugs from payload ───────────────────────────
    const canonicalSlugs = Array.from(
      new Set(
        parsed.data.dishes.map(d => d.category_canonical_slug).filter((s): s is string => !!s)
      )
    );

    type CanonicalRow = { id: string; slug: string; names: Record<string, string> };
    let canonicalRows: CanonicalRow[] = [];
    if (canonicalSlugs.length > 0) {
      const { data, error } = await svc
        .from('canonical_menu_categories')
        .select('id, slug, names')
        .in('slug', canonicalSlugs);
      if (error) return { ok: false, formError: error.message };
      canonicalRows = (data ?? []) as CanonicalRow[];
    }
    const canonicalBySlug = new Map(canonicalRows.map(r => [r.slug, r]));

    // ── (5) Validate existing-id categories belong to this restaurant ──────
    const existingIds = Array.from(
      new Set(
        parsed.data.dishes.map(d => d.category_existing_id).filter((id): id is string => !!id)
      )
    );
    if (existingIds.length > 0) {
      const { data: validRows, error } = await service
        .from('menu_categories')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .in('id', existingIds);
      if (error) return { ok: false, formError: error.message };
      const validSet = new Set((validRows ?? []).map(r => (r as { id: string }).id));
      const invalid = existingIds.filter(id => !validSet.has(id));
      if (invalid.length > 0) {
        return { ok: false, formError: `INVALID_CATEGORY_IDS:${invalid.join(',')}` };
      }
    }

    // ── (6) Dedupe + upsert menu_categories ────────────────────────────────
    // Build the unique set of "needed" categories. Key shape:
    //   `c:<canonical_slug>` for canonical-linked
    //   `n:<lower(custom_name)>` for custom-named
    //   `e:<existing_id>`     for admin-selected existing rows (no upsert; only
    //                          considered for fill-if-empty description writes)
    type NeededCategory = { kind: 'canonical'; slug: string } | { kind: 'custom'; name: string };

    const neededByKey = new Map<string, NeededCategory>();
    for (const d of parsed.data.dishes) {
      if (d.category_canonical_slug && canonicalBySlug.has(d.category_canonical_slug)) {
        neededByKey.set(`c:${d.category_canonical_slug}`, {
          kind: 'canonical',
          slug: d.category_canonical_slug,
        });
      } else if (d.category_custom_name) {
        neededByKey.set(`n:${d.category_custom_name.toLowerCase()}`, {
          kind: 'custom',
          name: d.category_custom_name,
        });
      }
    }

    // Build the description lookup keyed by the same tuple shape. Skip blank
    // descriptions entirely so we never overwrite a real value with empty.
    const descriptionByKey = new Map<string, string>();
    for (const c of parsed.data.category_descriptions ?? []) {
      const desc = c.description?.trim();
      if (!desc) continue;
      const key = c.canonical_slug
        ? `c:${c.canonical_slug}`
        : c.custom_name
          ? `n:${c.custom_name.toLowerCase()}`
          : c.existing_id
            ? `e:${c.existing_id}`
            : null;
      if (key) descriptionByKey.set(key, desc);
    }

    // Resolve each unique tuple → menu_category_id. Use SELECT-then-INSERT
    // (ON CONFLICT DO NOTHING + re-SELECT) to handle the race where the row
    // already exists from a prior partial run.
    const tupleToMenuCategoryId = new Map<string, string>();
    let categoriesCreated = 0;
    let categoriesLinked = 0;

    for (const [key, need] of neededByKey) {
      let row: { id: string } | null = null;

      const desc = descriptionByKey.get(key) ?? null;

      // All lookups are scoped to (restaurant_id, menu_id) — matches the
      // partial unique indexes on menu_categories. A category in a different
      // menu of the same restaurant is treated as distinct.
      let existingDescription: string | null = null;
      let wasJustCreated = false;

      if (need.kind === 'canonical') {
        const canon = canonicalBySlug.get(need.slug)!;
        const { data: existing } = await svc
          .from('menu_categories')
          .select('id, description')
          .eq('restaurant_id', restaurantId)
          .eq('menu_id', menuId)
          .eq('canonical_category_id', canon.id)
          .maybeSingle();

        if (existing) {
          row = existing as { id: string };
          existingDescription = (existing as { description: string | null }).description ?? null;
        } else {
          // Snapshot canonical name in source language (fall back to en)
          const displayName =
            canon.names[sourceLanguage] ?? canon.names[DEFAULT_LANGUAGE] ?? canon.slug;
          const { data: created, error: createErr } = await svc
            .from('menu_categories')
            .insert({
              restaurant_id: restaurantId,
              menu_id: menuId,
              name: displayName,
              canonical_category_id: canon.id,
              source_language_code: sourceLanguage,
              is_active: true,
              ...(desc
                ? {
                    description: desc,
                    description_translations: { [sourceLanguage]: desc },
                  }
                : {}),
            })
            .select('id')
            .single();
          if (createErr || !created) {
            // Race: another writer created it between our SELECT and INSERT.
            // Re-SELECT and continue.
            const { data: refetched } = await svc
              .from('menu_categories')
              .select('id, description')
              .eq('restaurant_id', restaurantId)
              .eq('menu_id', menuId)
              .eq('canonical_category_id', canon.id)
              .maybeSingle();
            if (!refetched) {
              return { ok: false, formError: createErr?.message ?? 'CATEGORY_UPSERT_FAILED' };
            }
            row = refetched as { id: string };
            existingDescription = (refetched as { description: string | null }).description ?? null;
          } else {
            row = created as { id: string };
            categoriesCreated++;
            wasJustCreated = true;
          }
        }
        categoriesLinked++;
      } else {
        // Custom: dedupe by lower(name) within (restaurant, menu).
        const { data: existing } = await svc
          .from('menu_categories')
          .select('id, description')
          .eq('restaurant_id', restaurantId)
          .eq('menu_id', menuId)
          .is('canonical_category_id', null)
          .ilike('name', need.name)
          .maybeSingle();

        if (existing) {
          row = existing as { id: string };
          existingDescription = (existing as { description: string | null }).description ?? null;
        } else {
          const { data: created, error: createErr } = await svc
            .from('menu_categories')
            .insert({
              restaurant_id: restaurantId,
              menu_id: menuId,
              name: need.name,
              canonical_category_id: null,
              source_language_code: sourceLanguage,
              name_translations: { [sourceLanguage]: need.name },
              is_active: true,
              ...(desc
                ? {
                    description: desc,
                    description_translations: { [sourceLanguage]: desc },
                  }
                : {}),
            })
            .select('id')
            .single();
          if (createErr || !created) {
            const { data: refetched } = await svc
              .from('menu_categories')
              .select('id, description')
              .eq('restaurant_id', restaurantId)
              .eq('menu_id', menuId)
              .is('canonical_category_id', null)
              .ilike('name', need.name)
              .maybeSingle();
            if (!refetched) {
              return { ok: false, formError: createErr?.message ?? 'CATEGORY_UPSERT_FAILED' };
            }
            row = refetched as { id: string };
            existingDescription = (refetched as { description: string | null }).description ?? null;
          } else {
            row = created as { id: string };
            categoriesCreated++;
            wasJustCreated = true;
          }
        }
      }

      // Fill-if-empty: never overwrite an admin's manual description with one
      // from a re-scan. Only update when the existing row had nothing.
      if (!wasJustCreated && desc && (!existingDescription || existingDescription.trim() === '')) {
        await svc
          .from('menu_categories')
          .update({
            description: desc,
            description_translations: { [sourceLanguage]: desc },
          })
          .eq('id', row.id);
      }

      tupleToMenuCategoryId.set(key, row.id);
    }

    // Fill-if-empty for existing-id categories selected by the admin (these
    // weren't part of the upsert loop). Same rule: only fill when empty.
    for (const existingId of existingIds) {
      const desc = descriptionByKey.get(`e:${existingId}`);
      if (!desc) continue;
      const { data: row } = await svc
        .from('menu_categories')
        .select('description')
        .eq('id', existingId)
        .maybeSingle();
      const current = (row as { description: string | null } | null)?.description ?? null;
      if (current && current.trim() !== '') continue;
      await svc
        .from('menu_categories')
        .update({
          description: desc,
          description_translations: { [sourceLanguage]: desc },
        })
        .eq('id', existingId);
    }

    // ── (7) Insert dishes with resolved menu_category_id ───────────────────
    const rows = parsed.data.dishes.map(d => {
      let menuCategoryId: string | null = null;
      if (d.category_existing_id) {
        menuCategoryId = d.category_existing_id;
      } else if (d.category_canonical_slug && canonicalBySlug.has(d.category_canonical_slug)) {
        menuCategoryId = tupleToMenuCategoryId.get(`c:${d.category_canonical_slug}`) ?? null;
      } else if (d.category_custom_name) {
        menuCategoryId =
          tupleToMenuCategoryId.get(`n:${d.category_custom_name.toLowerCase()}`) ?? null;
      }

      return {
        restaurant_id: restaurantId,
        menu_category_id: menuCategoryId,
        name: d.name,
        description: d.description,
        price: d.price,
        dish_kind: d.dish_kind,
        primary_protein: d.primary_protein,
        is_template: false,
        status: 'draft' as const,
        allergens: [] as string[],
        dietary_tags: [] as string[],
        source_image_index: d.source_image_index,
      };
    });

    const { data: inserted, error: insertError } = await service
      .from('dishes')
      .insert(rows)
      .select('id');

    if (insertError || !inserted) {
      return { ok: false, formError: insertError?.message ?? 'INSERT_FAILED' };
    }

    const insertedIds = (inserted as Array<{ id: string }>).map(r => r.id);
    const nowIso = new Date().toISOString();

    // ── (8) Mark job completed + audit ─────────────────────────────────────
    const { error: updateError } = await service
      .from('menu_scan_jobs')
      .update({
        status: 'completed',
        saved_dish_ids: insertedIds,
        saved_at: nowIso,
      })
      .eq('id', jobId);

    if (updateError) {
      return { ok: false, formError: updateError.message };
    }

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'confirm_menu_scan',
      'menu_scan_job',
      jobId,
      { status },
      {
        status: 'completed',
        inserted_count: insertedIds.length,
        restaurant_id: restaurantId,
        menu_id: menuId,
        menu_created: menuCreated,
        categories_created: categoriesCreated,
        categories_linked: categoriesLinked,
        source_language_code: sourceLanguage,
      }
    );

    revalidatePath(`/menu-scan/${jobId}`);
    revalidatePath('/menu-scan');
    return {
      ok: true,
      data: {
        insertedCount: insertedIds.length,
        menuCreated,
        categoriesCreated,
        categoriesLinked,
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

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
import { confirmPayloadSchema, type ReviewedDish } from './confirmSchema';

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
      // Explicit status='draft'. menus.status defaults to 'published' (migration
      // 117) which would make adminPublishRestaurant report "0 menus" because
      // the menu was already live the moment it was created.
      const { data: newMenu, error: menuError } = await service
        .from('menus')
        .insert({
          restaurant_id: restaurantId,
          name: 'Main Menu',
          menu_type: 'food',
          display_order: 0,
          is_active: true,
          status: 'draft',
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

    // ── (5b) Validate dish_category_id values exist in dish_categories ─────
    const dishCategoryIds = Array.from(
      new Set(parsed.data.dishes.map(d => d.dish_category_id).filter((id): id is string => !!id))
    );
    if (dishCategoryIds.length > 0) {
      const { data: validRows, error } = await service
        .from('dish_categories')
        .select('id')
        .in('id', dishCategoryIds);
      if (error) return { ok: false, formError: error.message };
      const validSet = new Set((validRows ?? []).map(r => (r as { id: string }).id));
      const invalid = dishCategoryIds.filter(id => !validSet.has(id));
      if (invalid.length > 0) {
        return { ok: false, formError: `INVALID_DISH_CATEGORY_IDS:${invalid.join(',')}` };
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
    // Verbatim section name for canonical-mode groups only (e.g. "Starters" when
    // AI matched it to canonical "appetizers"). Used below to override the
    // canonical English label on row creation, preserving the restaurant's voice.
    const verbatimByKey = new Map<string, string>();
    for (const c of parsed.data.category_descriptions ?? []) {
      const key = c.canonical_slug
        ? `c:${c.canonical_slug}`
        : c.custom_name
          ? `n:${c.custom_name.toLowerCase()}`
          : c.existing_id
            ? `e:${c.existing_id}`
            : null;
      if (!key) continue;

      const desc = c.description?.trim();
      if (desc) descriptionByKey.set(key, desc);

      const verbatim = c.verbatim_name?.trim();
      if (verbatim && c.canonical_slug) verbatimByKey.set(key, verbatim);
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
          // Prefer the restaurant's verbatim wording (e.g. "Starters") over the
          // canonical English label ("Appetizers") when the AI captured one and
          // it differs case-insensitively. The canonical link itself stays
          // intact, so cross-locale fallback (canonical.names[locale]) and
          // dedup on canonical_category_id keep working — only the source-
          // language display name reflects the restaurant's voice. When verbatim
          // is missing or matches the canonical label, fall back to the
          // canonical-derived display name.
          const canonicalDisplay =
            canon.names[sourceLanguage] ?? canon.names[DEFAULT_LANGUAGE] ?? canon.slug;
          const verbatim = verbatimByKey.get(key);
          const useVerbatim =
            !!verbatim && verbatim.toLowerCase() !== canonicalDisplay.toLowerCase();
          const displayName = useVerbatim ? verbatim! : canonicalDisplay;

          const { data: created, error: createErr } = await svc
            .from('menu_categories')
            .insert({
              restaurant_id: restaurantId,
              menu_id: menuId,
              name: displayName,
              canonical_category_id: canon.id,
              source_language_code: sourceLanguage,
              is_active: true,
              ...(useVerbatim ? { name_translations: { [sourceLanguage]: verbatim! } } : {}),
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

    // ── (7) Multi-pass dish insert ─────────────────────────────────────────
    // Order: parents → variant children → courses + items → standalones.
    // bundle/course_menu/buffet parents carry the menu price; configurable +
    // standard parents (size variants) are display-only containers and have
    // their price forced to 0 — children carry the actual prices.
    // Multi-pass without a transaction can leave orphans on partial failure;
    // surfaced via formError. RPC-based transactional save is a Phase-6+ item.
    function resolveMenuCategoryId(d: ReviewedDish): string | null {
      if (d.category_existing_id) return d.category_existing_id;
      if (d.category_canonical_slug && canonicalBySlug.has(d.category_canonical_slug)) {
        return tupleToMenuCategoryId.get(`c:${d.category_canonical_slug}`) ?? null;
      }
      if (d.category_custom_name) {
        return tupleToMenuCategoryId.get(`n:${d.category_custom_name.toLowerCase()}`) ?? null;
      }
      return null;
    }

    function buildDishRow(
      d: ReviewedDish,
      opts: {
        menuCategoryId: string | null;
        isParent: boolean;
        parentDishId: string | null;
        forcePriceZero?: boolean;
      }
    ) {
      return {
        restaurant_id: restaurantId,
        menu_category_id: opts.menuCategoryId,
        dish_category_id: d.dish_category_id,
        name: d.name,
        description: d.description,
        price: opts.forcePriceZero ? 0 : (d.price ?? 0),
        dish_kind: d.dish_kind,
        primary_protein: d.primary_protein,
        is_parent: opts.isParent,
        parent_dish_id: opts.parentDishId,
        display_price_prefix: d.display_price_prefix,
        serves: d.serves ?? 1,
        is_template: false,
        status: 'draft' as const,
        allergens: [] as string[],
        dietary_tags: [] as string[],
        source_image_index: d.source_image_index,
      };
    }

    const parents = parsed.data.dishes.filter(d => d.is_parent);
    const standalones = parsed.data.dishes.filter(d => !d.is_parent);

    const insertedIds: string[] = [];
    let variantsInserted = 0;
    let coursesInserted = 0;
    let courseItemsInserted = 0;

    // Pass 1: parents
    const parentDbIds: string[] = [];
    if (parents.length > 0) {
      const parentRows = parents.map(d => {
        const forcePriceZero = d.dish_kind === 'configurable' || d.dish_kind === 'standard';
        return buildDishRow(d, {
          menuCategoryId: resolveMenuCategoryId(d),
          isParent: true,
          parentDishId: null,
          forcePriceZero,
        });
      });
      const { data: insertedParents, error: parentErr } = await service
        .from('dishes')
        .insert(parentRows)
        .select('id');
      if (parentErr || !insertedParents) {
        return { ok: false, formError: parentErr?.message ?? 'PARENT_INSERT_FAILED' };
      }
      for (const r of insertedParents as Array<{ id: string }>) {
        parentDbIds.push(r.id);
        insertedIds.push(r.id);
      }
    }

    // Pass 2: variant children
    const childRows: ReturnType<typeof buildDishRow>[] = [];
    for (let pIdx = 0; pIdx < parents.length; pIdx++) {
      const parent = parents[pIdx];
      const parentDbId = parentDbIds[pIdx];
      const parentMenuCategoryId = resolveMenuCategoryId(parent);
      for (const child of parent.variant_dishes) {
        childRows.push(
          buildDishRow(child, {
            menuCategoryId: parentMenuCategoryId,
            isParent: false,
            parentDishId: parentDbId,
          })
        );
      }
    }
    if (childRows.length > 0) {
      const { data: insertedChildren, error: childErr } = await service
        .from('dishes')
        .insert(childRows)
        .select('id');
      if (childErr || !insertedChildren) {
        return { ok: false, formError: childErr?.message ?? 'VARIANT_INSERT_FAILED' };
      }
      for (const r of insertedChildren as Array<{ id: string }>) {
        insertedIds.push(r.id);
      }
      variantsInserted = insertedChildren.length;
    }

    // Pass 3: courses + items for course_menu parents
    for (let pIdx = 0; pIdx < parents.length; pIdx++) {
      const parent = parents[pIdx];
      if (parent.dish_kind !== 'course_menu' || parent.courses.length === 0) continue;
      const parentDbId = parentDbIds[pIdx];

      for (const course of parent.courses) {
        const { data: courseRow, error: courseErr } = await svc
          .from('dish_courses')
          .insert({
            parent_dish_id: parentDbId,
            course_number: course.course_number,
            course_name: course.course_name,
            choice_type: course.choice_type,
            required_count: course.required_count,
          })
          .select('id')
          .single();
        if (courseErr || !courseRow) {
          return { ok: false, formError: courseErr?.message ?? 'COURSE_INSERT_FAILED' };
        }
        coursesInserted++;
        if (course.items.length > 0) {
          const itemRows = course.items.map((it, idx) => ({
            course_id: (courseRow as { id: string }).id,
            option_label: it.option_label,
            price_delta: it.price_delta,
            sort_order: idx,
          }));
          const { error: itemErr } = await svc.from('dish_course_items').insert(itemRows);
          if (itemErr) {
            return { ok: false, formError: itemErr.message };
          }
          courseItemsInserted += itemRows.length;
        }
      }
    }

    // Pass 4: standalone dishes
    if (standalones.length > 0) {
      const standaloneRows = standalones.map(d =>
        buildDishRow(d, {
          menuCategoryId: resolveMenuCategoryId(d),
          isParent: false,
          parentDishId: null,
        })
      );
      const { data: insertedStandalone, error: standaloneErr } = await service
        .from('dishes')
        .insert(standaloneRows)
        .select('id');
      if (standaloneErr || !insertedStandalone) {
        return { ok: false, formError: standaloneErr?.message ?? 'STANDALONE_INSERT_FAILED' };
      }
      for (const r of insertedStandalone as Array<{ id: string }>) {
        insertedIds.push(r.id);
      }
    }

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
        parents_count: parents.length,
        variants_count: variantsInserted,
        courses_count: coursesInserted,
        course_items_count: courseItemsInserted,
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

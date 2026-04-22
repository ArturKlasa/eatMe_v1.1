import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import { deriveProteinFields, type PrimaryProtein } from '@eatme/shared';
import { ingredientEntryEnabled } from '@/lib/featureFlags';
import type { ConfirmPayload, ConfirmDish, ConfirmCourse } from '@/lib/menu-scan';

/** Vegan always implies vegetarian — ensure both tags are present. */
function normalizeDietaryTags(tags: string[]): string[] {
  if (tags.includes('vegan') && !tags.includes('vegetarian')) {
    return [...tags, 'vegetarian'];
  }
  return tags;
}

// Allow up to 60 s on Vercel — needed for large menus (300+ dishes).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // 1. Verify admin
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // 2. Parse body
  let payload: ConfirmPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { job_id, restaurant_id, menus } = payload;

  if (!job_id || !restaurant_id || !Array.isArray(menus)) {
    return NextResponse.json(
      { error: 'job_id, restaurant_id, and menus are required' },
      { status: 400 }
    );
  }

  // Count total dishes in the payload for early diagnostics.
  const payloadDishCount = countPayloadDishes(menus);

  if (payloadDishCount === 0) {
    return NextResponse.json(
      { error: 'Payload contains no dishes. Nothing was saved.' },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  // 3. Verify job exists and belongs to this restaurant
  const { data: job, error: jobLookupError } = await supabase
    .from('menu_scan_jobs')
    .select('id, status')
    .eq('id', job_id)
    .eq('restaurant_id', restaurant_id)
    .single();

  if (jobLookupError || !job) {
    return NextResponse.json({ error: 'Scan job not found' }, { status: 404 });
  }

  if (job.status === 'completed') {
    return NextResponse.json(
      { error: 'This scan job has already been committed' },
      { status: 409 }
    );
  }

  let totalDishesInserted = 0;
  let totalDishesFailed = 0;
  let dishesWithMissingIngredients = 0;
  const errors: string[] = [];
  const allInsertedIds: string[] = [];

  // Preload canonical_ingredient_id → concept_id once up front. Without this,
  // insertIngredientsAndOptions would issue one SELECT per dish, adding N
  // round-trips to the save path on a large menu.
  const conceptByCanonical = await loadConceptMap(supabase, menus);

  try {
    for (let menuIdx = 0; menuIdx < menus.length; menuIdx++) {
      const menuData = menus[menuIdx];

      // Skip empty menus
      const hasAnyDish = menuData.categories.some(c => c.dishes.length > 0);
      if (!hasAnyDish) continue;

      // 4. Insert menu
      const { data: newMenu, error: menuError } = await supabase
        .from('menus')
        .insert({
          restaurant_id,
          name: menuData.name || 'Menu',
          menu_type: menuData.menu_type ?? 'food',
          display_order: menuIdx,
          is_active: true,
        })
        .select('id')
        .single();

      if (menuError || !newMenu) {
        errors.push(`Failed to insert menu "${menuData.name}": ${menuError?.message}`);
        console.error('[MenuScan/confirm] Menu insert error:', menuError);
        continue;
      }

      for (let catIdx = 0; catIdx < menuData.categories.length; catIdx++) {
        const catData = menuData.categories[catIdx];

        const validDishes = catData.dishes.filter(d => d.name?.trim());
        if (validDishes.length === 0) continue;

        // 5. Insert menu_category
        const { data: newCat, error: catError } = await supabase
          .from('menu_categories')
          .insert({
            restaurant_id,
            menu_id: newMenu.id,
            name: catData.name || 'General',
            display_order: catIdx,
          })
          .select('id')
          .single();

        if (catError || !newCat) {
          errors.push(`Failed to insert category "${catData.name}": ${catError?.message}`);
          console.error('[MenuScan/confirm] Category insert error:', catError);
          continue;
        }

        // Separate parents from standalone dishes
        const parentDishes = validDishes.filter(d => d.is_parent);
        const standaloneDishes = validDishes.filter(d => !d.is_parent);

        // ---- Pass 1: Insert parent dishes ----
        for (const parentDish of parentDishes) {
          const parentId = randomUUID();
          // bundle/combo/course_menu/buffet carry the price on the parent.
          // configurable/standard/template are display-only containers → force price: 0.
          const carriesParentPrice = ['bundle', 'combo', 'course_menu', 'buffet'].includes(
            parentDish.dish_kind
          );
          const parentRow = buildDishRow(parentDish, parentId, restaurant_id, newCat.id, {
            is_parent: true,
            ...(carriesParentPrice ? {} : { price: 0 }),
          });

          const { error: parentError } = await supabase.from('dishes').insert(parentRow);

          if (parentError) {
            errors.push(
              `Failed to insert parent dish "${parentDish.name}": ${parentError.message}`
            );
            totalDishesFailed += 1 + (parentDish.variant_dishes?.length ?? 0);
            console.error('[MenuScan/confirm] Parent dish insert error:', parentError);
            continue; // Skip children if parent fails (prevents orphans)
          }

          totalDishesInserted++;
          allInsertedIds.push(parentId);
          const parentIngFailed = await insertIngredientsAndOptions(
            supabase,
            parentId,
            parentDish,
            restaurant_id,
            conceptByCanonical
          );
          if (parentIngFailed) dishesWithMissingIngredients++;

          // ---- Pass 2: Insert child variant dishes ----
          if (parentDish.variant_dishes && parentDish.variant_dishes.length > 0) {
            const childRows = parentDish.variant_dishes.map(child => {
              const childId = randomUUID();
              return {
                row: buildDishRow(child, childId, restaurant_id, newCat.id, {
                  is_parent: false,
                  parent_dish_id: parentId,
                }),
                dish: child,
                id: childId,
              };
            });

            const { error: childBatchError } = await supabase
              .from('dishes')
              .insert(childRows.map(c => c.row));

            if (childBatchError) {
              errors.push(
                `Failed to insert variants for "${parentDish.name}": ${childBatchError.message}`
              );
              totalDishesFailed += childRows.length;
              console.error('[MenuScan/confirm] Child batch insert error:', childBatchError);
            } else {
              totalDishesInserted += childRows.length;
              for (const child of childRows) {
                allInsertedIds.push(child.id);
              }
              // Insert ingredients/options for each child
              for (const child of childRows) {
                const childIngFailed = await insertIngredientsAndOptions(
                  supabase,
                  child.id,
                  child.dish,
                  restaurant_id,
                  conceptByCanonical
                );
                if (childIngFailed) dishesWithMissingIngredients++;
              }
            }
          }

          // ---- Pass 3: Insert courses for course_menu parents ----
          if (parentDish.dish_kind === 'course_menu' && parentDish.courses?.length) {
            await insertCourses(supabase, parentId, parentDish.courses, errors);
          }
        }

        // ---- Pass 3: Insert standalone dishes (not parents, not children) ----
        if (standaloneDishes.length > 0) {
          const standaloneRows = standaloneDishes.map(d => ({
            row: buildDishRow(d, randomUUID(), restaurant_id, newCat.id),
            dish: d,
            id: '', // will be set
          }));
          // Set IDs from the generated rows
          for (const s of standaloneRows) {
            s.id = s.row.id;
          }

          const { error: standaloneBatchError } = await supabase
            .from('dishes')
            .insert(standaloneRows.map(s => s.row));

          if (standaloneBatchError) {
            errors.push(
              `Failed to insert dishes for category "${catData.name}": ${standaloneBatchError.message}`
            );
            totalDishesFailed += standaloneRows.length;
            console.error(
              '[MenuScan/confirm] Standalone batch insert error:',
              standaloneBatchError
            );
          } else {
            totalDishesInserted += standaloneRows.length;
            for (const s of standaloneRows) {
              allInsertedIds.push(s.id);
            }
            // Insert ingredients/options for each standalone dish
            for (const s of standaloneRows) {
              const standaloneIngFailed = await insertIngredientsAndOptions(
                supabase,
                s.id,
                s.dish,
                restaurant_id,
                conceptByCanonical
              );
              if (standaloneIngFailed) dishesWithMissingIngredients++;
            }
          }
        }
      }
    }

    // 8. Mark job status
    const finalStatus = totalDishesInserted === 0 && errors.length > 0 ? 'failed' : 'completed';
    await supabase
      .from('menu_scan_jobs')
      .update({
        status: finalStatus,
        dishes_saved: totalDishesInserted,
        saved_dish_ids: allInsertedIds.length > 0 ? allInsertedIds : null,
        saved_at: allInsertedIds.length > 0 ? new Date().toISOString() : null,
      })
      .eq('id', job_id);

    console.log(
      `[MenuScan/confirm] Job ${job_id}: inserted ${totalDishesInserted} / ${payloadDishCount} dishes. Failed: ${totalDishesFailed}. Errors: ${errors.length}`
    );

    if (totalDishesInserted === 0) {
      return NextResponse.json(
        {
          status: 'failed',
          error: `All dish inserts failed. First error: ${errors[0] ?? 'unknown'}`,
          dishes_saved: 0,
          dishes_failed: totalDishesFailed,
          errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status:
        errors.length > 0 || dishesWithMissingIngredients > 0
          ? 'completed_with_warnings'
          : 'completed',
      dishes_saved: totalDishesInserted,
      dishes_failed: totalDishesFailed,
      dishes_with_missing_ingredients:
        dishesWithMissingIngredients > 0 ? dishesWithMissingIngredients : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error('[MenuScan/confirm] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Commit failed unexpectedly' },
      { status: 500 }
    );
  }
}

function countPayloadDishes(menus: ConfirmPayload['menus']): number {
  let count = 0;
  for (const menu of menus) {
    for (const cat of menu.categories ?? []) {
      for (const dish of cat.dishes ?? []) {
        count++;
        count += dish.variant_dishes?.length ?? 0;
      }
    }
  }
  return count;
}

function buildDishRow(
  dish: ConfirmDish,
  id: string,
  restaurantId: string,
  menuCategoryId: string,
  overrides?: Partial<Record<string, unknown>>
) {
  const conf = dish.confidence;
  const enrichmentConfidence =
    conf !== undefined ? (conf >= 0.7 ? 'high' : conf >= 0.5 ? 'medium' : 'low') : null;

  const derived = deriveProteinFields(dish.primary_protein as PrimaryProtein | null);

  return {
    id,
    restaurant_id: restaurantId,
    menu_category_id: menuCategoryId,
    dish_category_id: dish.dish_category_id ?? null,
    name: dish.name.trim(),
    description: dish.description?.trim() || null,
    price: overrides?.price ?? dish.price ?? 0,
    // Populate *_override so AI-suggested values survive the trigger that
    // recomputes dishes.allergens/dietary_tags from dish_ingredients cascades
    // (migration 092). If dish_ingredients cover everything, admins can clear
    // the override and let the cascade take over.
    dietary_tags_override:
      derived.dietary_tags_override ??
      (dish.dietary_tags && dish.dietary_tags.length > 0
        ? normalizeDietaryTags(dish.dietary_tags)
        : null),
    spice_level: dish.spice_level ?? null,
    calories: dish.calories ?? null,
    is_available: true,
    dish_kind: dish.dish_kind ?? 'standard',
    is_parent: overrides?.is_parent ?? dish.is_parent ?? false,
    serves: dish.serves ?? 1,
    display_price_prefix: dish.display_price_prefix ?? 'exact',
    parent_dish_id: (overrides?.parent_dish_id as string) ?? null,
    allergens_override: dish.allergens && dish.allergens.length > 0 ? dish.allergens : null,
    primary_protein: dish.primary_protein ?? null,
    protein_families: derived.protein_families,
    protein_canonical_names: derived.protein_canonical_names,
    enrichment_status: 'pending',
    enrichment_source: 'ai',
    enrichment_confidence: enrichmentConfidence,
    is_template: dish.is_template ?? false,
    status: dish.status ?? 'published',
    source_image_index: dish.source_image_index ?? null,
  };
}

async function insertCourses(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  parentDishId: string,
  courses: ConfirmCourse[],
  errors: string[]
): Promise<void> {
  for (const course of courses) {
    const courseId = randomUUID();
    const { error: courseError } = await supabase.from('dish_courses').insert({
      id: courseId,
      parent_dish_id: parentDishId,
      course_number: course.course_number,
      course_name: course.course_name ?? null,
      required_count: 1,
      choice_type: course.choice_type,
    });

    if (courseError) {
      errors.push(
        `Failed to insert course ${course.course_number} for dish ${parentDishId}: ${courseError.message}`
      );
      continue;
    }

    if (course.items && course.items.length > 0) {
      const itemRows = course.items.map((item, idx) => ({
        id: randomUUID(),
        course_id: courseId,
        option_label: item.option_label,
        price_delta: item.price_delta ?? 0,
        links_to_dish_id: null,
        sort_order: idx,
      }));

      const { error: itemsError } = await supabase.from('dish_course_items').insert(itemRows);
      if (itemsError) {
        errors.push(
          `Failed to insert course items for course ${course.course_number}: ${itemsError.message}`
        );
      }
    }
  }
}

/**
 * Walk every dish in the payload (parents, variant children, standalones) and
 * fetch canonical_ingredient_id → concept_id mappings in one bulk query.
 * Returns an empty map when no ingredients are referenced.
 */
async function loadConceptMap(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  menus: ConfirmPayload['menus']
): Promise<Map<string, string>> {
  const canonicalIds = new Set<string>();
  for (const menu of menus) {
    for (const cat of menu.categories ?? []) {
      for (const dish of cat.dishes ?? []) {
        for (const cid of dish.canonical_ingredient_ids ?? []) {
          if (cid) canonicalIds.add(cid);
        }
        for (const child of dish.variant_dishes ?? []) {
          for (const cid of child.canonical_ingredient_ids ?? []) {
            if (cid) canonicalIds.add(cid);
          }
        }
      }
    }
  }
  const map = new Map<string, string>();
  if (canonicalIds.size === 0) return map;

  const { data } = await supabase
    .from('ingredient_concepts')
    .select('id, legacy_canonical_id')
    .in('legacy_canonical_id', [...canonicalIds]);
  for (const row of (data ?? []) as Array<{ id: string; legacy_canonical_id: string }>) {
    map.set(row.legacy_canonical_id, row.id);
  }
  return map;
}

/** Returns true if any ingredient or option insert failed for this dish. */
async function insertIngredientsAndOptions(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  dishId: string,
  dish: ConfirmDish,
  restaurantId: string,
  conceptByCanonical: Map<string, string>
): Promise<boolean> {
  let hadFailure = false;

  // Insert ingredients — populate concept_id / variant_id alongside the legacy
  // ingredient_id so downstream code (enrich-dish, allergen trigger) keeps
  // working until Phase 6 cutover retires the legacy column.
  const seen = new Set<string>();
  const uniqueCanonicalIds = (dish.canonical_ingredient_ids ?? []).filter((cid): cid is string => {
    if (!cid || seen.has(cid)) return false;
    seen.add(cid);
    return true;
  });

  if (ingredientEntryEnabled() && uniqueCanonicalIds.length > 0) {
    const variantOverrides = dish.variant_id_by_canonical ?? {};

    const ingredientRows = uniqueCanonicalIds.map(cid => ({
      dish_id: dishId,
      ingredient_id: cid,
      concept_id: conceptByCanonical.get(cid) ?? null,
      variant_id: variantOverrides[cid] ?? null,
    }));

    const { error: ingError } = await supabase.from('dish_ingredients').insert(ingredientRows);

    if (ingError) {
      hadFailure = true;
      console.warn(
        `[MenuScan/confirm] Ingredient batch insert failed for dish "${dish.name}":`,
        ingError
      );
    }
  }

  // Insert option groups and options
  const groups = dish.option_groups;
  if (!groups?.length) return hadFailure;

  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const group = groups[gIdx];
    const { data: newGroup, error: groupError } = await supabase
      .from('option_groups')
      .insert({
        restaurant_id: restaurantId,
        dish_id: dishId,
        name: group.name,
        selection_type: group.selection_type,
        min_selections: group.min_selections ?? (group.selection_type === 'single' ? 1 : 0),
        max_selections: group.max_selections ?? (group.selection_type === 'single' ? 1 : null),
        display_order: gIdx,
        is_active: true,
      })
      .select('id')
      .single();

    if (groupError || !newGroup) {
      hadFailure = true;
      console.warn(
        `[MenuScan/confirm] Option group insert failed for dish "${dish.name}":`,
        groupError?.message
      );
      continue;
    }

    const optionRows = group.options.map((opt, oIdx) => ({
      option_group_id: newGroup.id,
      name: opt.name,
      canonical_ingredient_id: opt.canonical_ingredient_id || null,
      price_delta: 0,
      display_order: oIdx,
      is_available: true,
    }));

    if (optionRows.length > 0) {
      const { error: optError } = await supabase.from('options').insert(optionRows);
      if (optError) {
        hadFailure = true;
        console.warn(
          `[MenuScan/confirm] Options insert failed for group "${group.name}":`,
          optError.message
        );
      }
    }
  }

  return hadFailure;
}

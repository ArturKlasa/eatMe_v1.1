/**
 * POST /api/menu-scan/confirm
 *
 * Persists the reviewed menu-scan results to the database. Writes menus,
 * categories, dishes, and option groups in a single transaction-like sequence.
 * Called after the admin has reviewed and approved the AI extraction output.
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import type { ConfirmPayload, ConfirmDish } from '@/lib/menu-scan';

/** Vegan always implies vegetarian — ensure both tags are present. */
function normalizeDietaryTags(tags: string[]): string[] {
  if (tags.includes('vegan') && !tags.includes('vegetarian')) {
    return [...tags, 'vegetarian'];
  }
  return tags;
}

// ---------------------------------------------------------------------------
// POST /api/menu-scan/confirm
// Commits the admin-reviewed extraction results to the database.
//
// Body: ConfirmPayload {
//   job_id, restaurant_id,
//   menus: [{ name, menu_type, categories: [{ name, dishes: [{ ... }] }] }]
// }
//
// Three-pass insertion: parents → children (with parent_dish_id) → standalone.
// Returns completed_with_warnings for partial failures.
// ---------------------------------------------------------------------------

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
  const errors: string[] = [];

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
          const parentRow = buildDishRow(parentDish, parentId, restaurant_id, newCat.id, {
            is_parent: true,
            price: 0, // parents are display-only containers
          });

          const { error: parentError } = await supabase.from('dishes').insert(parentRow);

          if (parentError) {
            errors.push(`Failed to insert parent dish "${parentDish.name}": ${parentError.message}`);
            totalDishesFailed += 1 + (parentDish.variant_dishes?.length ?? 0);
            console.error('[MenuScan/confirm] Parent dish insert error:', parentError);
            continue; // Skip children if parent fails (prevents orphans)
          }

          totalDishesInserted++;
          await insertIngredientsAndOptions(supabase, parentId, parentDish, restaurant_id);

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
              // Insert ingredients/options for each child
              for (const child of childRows) {
                await insertIngredientsAndOptions(supabase, child.id, child.dish, restaurant_id);
              }
            }
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
            console.error('[MenuScan/confirm] Standalone batch insert error:', standaloneBatchError);
          } else {
            totalDishesInserted += standaloneRows.length;
            // Insert ingredients/options for each standalone dish
            for (const s of standaloneRows) {
              await insertIngredientsAndOptions(supabase, s.id, s.dish, restaurant_id);
            }
          }
        }
      }
    }

    // 8. Mark job status
    const finalStatus =
      totalDishesInserted === 0 && errors.length > 0 ? 'failed' : 'completed';
    await supabase
      .from('menu_scan_jobs')
      .update({ status: finalStatus, dishes_saved: totalDishesInserted })
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
      status: errors.length > 0 ? 'completed_with_warnings' : 'completed',
      dishes_saved: totalDishesInserted,
      dishes_failed: totalDishesFailed,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  return {
    id,
    restaurant_id: restaurantId,
    menu_category_id: menuCategoryId,
    dish_category_id: dish.dish_category_id ?? null,
    name: dish.name.trim(),
    description: dish.description?.trim() || null,
    price: overrides?.price ?? dish.price ?? 0,
    dietary_tags: normalizeDietaryTags(dish.dietary_tags ?? []),
    spice_level: dish.spice_level ?? null,
    calories: dish.calories ?? null,
    is_available: true,
    dish_kind: dish.dish_kind ?? 'standard',
    is_parent: overrides?.is_parent ?? dish.is_parent ?? false,
    serves: dish.serves ?? 1,
    display_price_prefix: dish.display_price_prefix ?? 'exact',
    parent_dish_id: (overrides?.parent_dish_id as string) ?? null,
  };
}

async function insertIngredientsAndOptions(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  dishId: string,
  dish: ConfirmDish,
  restaurantId: string
): Promise<void> {
  // Insert ingredients
  const seen = new Set<string>();
  const ingredientRows: { dish_id: string; ingredient_id: string }[] = [];
  for (const cid of (dish.canonical_ingredient_ids ?? []).filter(Boolean)) {
    if (!seen.has(cid)) {
      seen.add(cid);
      ingredientRows.push({ dish_id: dishId, ingredient_id: cid });
    }
  }

  if (ingredientRows.length > 0) {
    const { error: ingError } = await supabase
      .from('dish_ingredients')
      .insert(ingredientRows);

    if (ingError) {
      console.warn(
        `[MenuScan/confirm] Ingredient batch insert failed for dish "${dish.name}":`,
        ingError
      );
    }
  }

  // Insert option groups and options
  const groups = dish.option_groups;
  if (!groups?.length) return;

  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const group = groups[gIdx];
    const { data: newGroup, error: groupError } = await supabase
      .from('option_groups')
      .insert({
        restaurant_id: restaurantId,
        dish_id: dishId,
        name: group.name,
        selection_type: group.selection_type,
        min_selections: 1,
        max_selections: 1,
        display_order: gIdx,
        is_active: true,
      })
      .select('id')
      .single();

    if (groupError || !newGroup) {
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
        console.warn(
          `[MenuScan/confirm] Options insert failed for group "${group.name}":`,
          optError.message
        );
      }
    }
  }
}

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import type { ConfirmPayload } from '@/lib/menu-scan';

// ---------------------------------------------------------------------------
// POST /api/menu-scan/confirm
// Commits the admin-reviewed extraction results to the database.
//
// Body: ConfirmPayload {
//   job_id, restaurant_id,
//   menus: [{ name, menu_type, categories: [{ name, dishes: [{ ... }] }] }]
// }
//
// Inserts: menus → menu_categories → dishes (batched) → dish_ingredients (batched)
// Batching dish + ingredient inserts per category reduces 300 sequential HTTP
// round-trips to ~30 (10 cats × 2 queries each), preventing serverless timeouts.
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
  const payloadDishCount = menus.reduce(
    (t, m) =>
      t +
      (m.categories ?? []).reduce(
        (s: number, c: { dishes?: unknown[] }) => s + (c.dishes?.length ?? 0),
        0
      ),
    0
  );
  console.log(
    `[MenuScan/confirm] Payload: ${menus.length} menu(s), ${payloadDishCount} dish(es) for restaurant ${restaurant_id}`
  );

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

        // 6. Pre-generate UUIDs so we can batch dishes + still link ingredients.
        const dishRows = validDishes.map((dishData, dishIdx) => ({
          id: randomUUID() as string,
          restaurant_id,
          menu_category_id: newCat.id,
          dish_category_id: dishData.dish_category_id ?? null,
          name: dishData.name.trim(),
          description: dishData.description?.trim() || null,
          price: dishData.price ?? 0,
          dietary_tags: dishData.dietary_tags ?? [],
          spice_level: dishData.spice_level ?? null,
          calories: dishData.calories ?? null,
          is_available: true,
          display_order: dishIdx,
        }));

        // Single batch insert for all dishes in this category.
        const { error: dishBatchError } = await supabase.from('dishes').insert(dishRows);

        if (dishBatchError) {
          errors.push(
            `Failed to insert dishes for category "${catData.name}": ${dishBatchError.message}`
          );
          console.error('[MenuScan/confirm] Dish batch insert error:', dishBatchError);
          continue;
        }

        totalDishesInserted += dishRows.length;

        // 7. Batch insert all dish_ingredients for this category in one query.
        const ingredientRows: { dish_id: string; ingredient_id: string }[] = [];
        for (let i = 0; i < validDishes.length; i++) {
          const dishData = validDishes[i];
          const dishId = dishRows[i].id;
          const validIngredients = (dishData.canonical_ingredient_ids ?? []).filter(Boolean);
          for (const cid of validIngredients) {
            ingredientRows.push({ dish_id: dishId, ingredient_id: cid });
          }
        }

        if (ingredientRows.length > 0) {
          const { error: ingError } = await supabase
            .from('dish_ingredients')
            .insert(ingredientRows);

          if (ingError) {
            console.warn(
              `[MenuScan/confirm] Ingredient batch insert failed for category "${catData.name}":`,
              ingError
            );
            // Non-fatal: dishes are inserted, just without ingredient links
          }
        }
      }
    }

    // 8. Mark job as completed (or failed if nothing was saved)
    const finalStatus = totalDishesInserted === 0 && errors.length > 0 ? 'failed' : 'completed';
    await supabase
      .from('menu_scan_jobs')
      .update({ status: finalStatus, dishes_saved: totalDishesInserted })
      .eq('id', job_id);

    console.log(
      `[MenuScan/confirm] Job ${job_id}: inserted ${totalDishesInserted} / ${payloadDishCount} dishes. Errors: ${errors.length}`
    );

    if (totalDishesInserted === 0) {
      return NextResponse.json(
        {
          error: `All dish inserts failed. First error: ${errors[0] ?? 'unknown'}`,
          warnings: errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dishes_saved: totalDishesInserted,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error('[MenuScan/confirm] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Commit failed unexpectedly' },
      { status: 500 }
    );
  }
}

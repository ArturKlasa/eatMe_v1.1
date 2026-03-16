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
// Inserts: menus → menu_categories → dishes → dish_ingredients
// The existing DB trigger (calculate_dish_allergens) auto-populates
// dishes.allergens from dish_ingredients after each dish insert.
// ---------------------------------------------------------------------------

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

        if (catData.dishes.length === 0) continue;

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

        for (let dishIdx = 0; dishIdx < catData.dishes.length; dishIdx++) {
          const dishData = catData.dishes[dishIdx];

          if (!dishData.name?.trim()) continue;

          // 6. Insert dish
          const { data: newDish, error: dishError } = await supabase
            .from('dishes')
            .insert({
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
            })
            .select('id')
            .single();

          if (dishError || !newDish) {
            errors.push(`Failed to insert dish "${dishData.name}": ${dishError?.message}`);
            console.error('[MenuScan/confirm] Dish insert error:', dishError);
            continue;
          }

          // 7. Insert dish_ingredients (triggers allergen auto-calculation)
          const validIngredients = (dishData.canonical_ingredient_ids ?? []).filter(Boolean);
          if (validIngredients.length > 0) {
            const ingredientRows = validIngredients.map(cid => ({
              dish_id: newDish.id,
              canonical_ingredient_id: cid,
            }));

            const { error: ingError } = await supabase
              .from('dish_ingredients')
              .insert(ingredientRows);

            if (ingError) {
              console.warn(
                `[MenuScan/confirm] Ingredient link failed for dish "${dishData.name}":`,
                ingError
              );
              // Non-fatal: dish is inserted, just without ingredient links
            }
          }

          totalDishesInserted++;
        }
      }
    }

    // 8. Mark job as completed
    await supabase
      .from('menu_scan_jobs')
      .update({
        status: errors.length === 0 ? 'completed' : 'completed',
        dishes_saved: totalDishesInserted,
      })
      .eq('id', job_id);

    console.log(
      `[MenuScan/confirm] Job ${job_id}: inserted ${totalDishesInserted} dishes. Errors: ${errors.length}`
    );

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

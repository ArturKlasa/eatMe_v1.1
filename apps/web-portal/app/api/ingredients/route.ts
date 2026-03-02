import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

// ---------------------------------------------------------------------------
// POST /api/ingredients
// Adds a new canonical ingredient + optional aliases to the database.
// Used by the AddIngredientPanel in the menu scan review UI.
//
// Body: {
//   canonical_name: string,
//   ingredient_family_name: string,     // e.g. "dairy", "vegetable", "protein"
//   is_vegetarian: boolean,
//   is_vegan: boolean,
//   allergen_codes: string[],           // e.g. ["milk", "gluten"]
//   extra_aliases: string[],            // additional display names beyond canonical_name
// }
//
// Returns: { ingredient: { id, canonical_name, ... }, alias: { id, display_name, ... } }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Verify admin
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // 2. Parse body
  let body: {
    canonical_name: string;
    ingredient_family_name: string;
    is_vegetarian: boolean;
    is_vegan: boolean;
    allergen_codes: string[];
    extra_aliases: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    canonical_name,
    ingredient_family_name = 'other',
    is_vegetarian = true,
    is_vegan = false,
    allergen_codes = [],
    extra_aliases = [],
  } = body;

  if (!canonical_name?.trim()) {
    return NextResponse.json({ error: 'canonical_name is required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const cleanName = canonical_name.trim().toLowerCase();

  // 3. Check for existing canonical ingredient with this name
  const { data: existing } = await supabase
    .from('canonical_ingredients')
    .select('id, canonical_name')
    .ilike('canonical_name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: `Ingredient "${existing[0].canonical_name}" already exists`, existing: existing[0] },
      { status: 409 }
    );
  }

  // 4. Insert canonical ingredient
  const { data: newIngredient, error: ingError } = await supabase
    .from('canonical_ingredients')
    .insert({
      canonical_name: cleanName,
      ingredient_family_name: ingredient_family_name || 'other',
      is_vegetarian,
      is_vegan,
    })
    .select()
    .single();

  if (ingError || !newIngredient) {
    console.error('[Ingredients] Insert failed:', ingError);
    return NextResponse.json(
      { error: `Failed to create ingredient: ${ingError?.message}` },
      { status: 500 }
    );
  }

  // 5. Link allergens (look up IDs by code)
  if (allergen_codes.length > 0) {
    const { data: allergens } = await supabase
      .from('allergens')
      .select('id, code')
      .in('code', allergen_codes);

    if (allergens && allergens.length > 0) {
      const allergenLinks = allergens.map(a => ({
        canonical_ingredient_id: newIngredient.id,
        allergen_id: a.id,
      }));

      const { error: allergenLinkError } = await supabase
        .from('canonical_ingredient_allergens')
        .insert(allergenLinks);

      if (allergenLinkError) {
        console.warn('[Ingredients] Allergen link failed:', allergenLinkError);
        // Non-fatal: ingredient created, allergen links missing
      }
    }
  }

  // 6. Insert ingredient_aliases: canonical name + any extra aliases
  const allAliases = [
    cleanName,
    ...extra_aliases.map(a => a.trim().toLowerCase()).filter(a => a && a !== cleanName),
  ];

  const aliasRows = allAliases.map(displayName => ({
    display_name: displayName,
    canonical_ingredient_id: newIngredient.id,
  }));

  const { data: insertedAliases, error: aliasError } = await supabase
    .from('ingredient_aliases')
    .insert(aliasRows)
    .select();

  if (aliasError) {
    console.warn('[Ingredients] Alias insert failed:', aliasError);
    // Non-fatal: ingredient is still usable
  }

  // Find the primary alias (matching canonical name) to return to caller
  const primaryAlias = insertedAliases?.find(a => a.display_name === cleanName);

  console.log(`[Ingredients] Created "${cleanName}" (id: ${newIngredient.id})`);

  return NextResponse.json({
    ingredient: newIngredient,
    alias: primaryAlias ?? null,
    aliases_created: insertedAliases?.length ?? 0,
  });
}

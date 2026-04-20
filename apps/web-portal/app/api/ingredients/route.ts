import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/** @param request */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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

  const primaryAlias = insertedAliases?.find(a => a.display_name === cleanName);

  // Phase 6A: auto-mirror into the new ingredient system so admin-created
  // canonicals participate in the resolver, typeahead, and dish_ingredients
  // writes. Mirror failures are non-fatal — the legacy record is still
  // usable, and the concept can be created manually via the admin
  // concept editor if needed.
  let conceptId: string | null = null;
  try {
    const { data: concept, error: conceptError } = await supabase
      .from('ingredient_concepts')
      .insert({
        slug: cleanName,
        family: ingredient_family_name || 'other',
        is_vegetarian,
        is_vegan,
        allergens: allergen_codes,
        legacy_canonical_id: newIngredient.id,
      })
      .select('id')
      .single();
    if (conceptError) {
      console.warn('[Ingredients] Concept mirror failed:', conceptError);
    } else if (concept) {
      conceptId = concept.id;
      // Default variant — required so the resolver always has one to
      // fall back to when no modifier is seen.
      await supabase
        .from('ingredient_variants')
        .insert({ concept_id: concept.id, modifier: null, is_default: true });

      // EN concept translation from the cleaned slug (title-cased).
      const enName = cleanName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      await supabase
        .from('concept_translations')
        .insert({ concept_id: concept.id, language: 'en', name: enName });

      // Mirror the aliases into ingredient_aliases_v2 so typeahead + resolver
      // can find them. ON CONFLICT DO NOTHING keeps it idempotent across
      // retries.
      const v2Rows = allAliases.map(text => ({
        alias_text: text,
        language: 'en',
        concept_id: concept.id,
        variant_id: null,
      }));
      await supabase
        .from('ingredient_aliases_v2')
        .upsert(v2Rows, { onConflict: 'alias_text,language', ignoreDuplicates: true });
    }
  } catch (err) {
    console.warn('[Ingredients] Concept mirror threw:', err);
  }

  return NextResponse.json({
    ingredient: newIngredient,
    alias: primaryAlias ?? null,
    aliases_created: insertedAliases?.length ?? 0,
    concept_id: conceptId,
  });
}

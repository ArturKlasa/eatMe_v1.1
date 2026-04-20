import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * GET /api/admin/ingredient-variants/review
 *
 * Returns every variant flagged `needs_review=true`, enriched with:
 *   - concept slug + family
 *   - concept translations (en / es / pl)
 *   - variant translations (en / es / pl) — empty when the variant is new
 *   - usage count from dish_ingredients
 *   - sibling variants under the same concept (merge targets)
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServerSupabaseClient();

  const { data: variants, error: variantsError } = await supabase
    .from('ingredient_variants')
    .select(
      'id, concept_id, modifier, is_default, created_at, concept:ingredient_concepts!inner(slug, family)'
    )
    .eq('needs_review', true)
    .order('created_at', { ascending: false });

  if (variantsError) {
    console.error('[ingredient-variants/review] list failed:', variantsError);
    return NextResponse.json({ error: variantsError.message }, { status: 500 });
  }

  type VariantRow = {
    id: string;
    concept_id: string;
    modifier: string | null;
    is_default: boolean;
    created_at: string;
    concept: { slug: string; family: string };
  };

  const rows = (variants ?? []) as unknown as VariantRow[];

  if (rows.length === 0) {
    return NextResponse.json({ variants: [] });
  }

  const variantIds = rows.map(v => v.id);
  const conceptIds = [...new Set(rows.map(v => v.concept_id))];

  const [conceptTrRes, variantTrRes, siblingsRes, usageRes] = await Promise.all([
    supabase
      .from('concept_translations')
      .select('concept_id, language, name')
      .in('concept_id', conceptIds),
    supabase
      .from('variant_translations')
      .select('variant_id, language, name')
      .in('variant_id', variantIds),
    supabase
      .from('ingredient_variants')
      .select('id, concept_id, modifier, is_default, needs_review')
      .in('concept_id', conceptIds),
    supabase.from('dish_ingredients').select('variant_id').in('variant_id', variantIds),
  ]);

  const conceptTranslations = new Map<string, Record<string, string>>();
  for (const row of (conceptTrRes.data ?? []) as Array<{
    concept_id: string;
    language: string;
    name: string;
  }>) {
    const bucket = conceptTranslations.get(row.concept_id) ?? {};
    bucket[row.language] = row.name;
    conceptTranslations.set(row.concept_id, bucket);
  }

  const variantTranslations = new Map<string, Record<string, string>>();
  for (const row of (variantTrRes.data ?? []) as Array<{
    variant_id: string;
    language: string;
    name: string;
  }>) {
    const bucket = variantTranslations.get(row.variant_id) ?? {};
    bucket[row.language] = row.name;
    variantTranslations.set(row.variant_id, bucket);
  }

  const siblings = new Map<
    string,
    Array<{ id: string; modifier: string | null; is_default: boolean }>
  >();
  for (const row of (siblingsRes.data ?? []) as Array<{
    id: string;
    concept_id: string;
    modifier: string | null;
    is_default: boolean;
    needs_review: boolean;
  }>) {
    if (row.needs_review) continue; // reviewed variants only serve as merge targets
    const bucket = siblings.get(row.concept_id) ?? [];
    bucket.push({ id: row.id, modifier: row.modifier, is_default: row.is_default });
    siblings.set(row.concept_id, bucket);
  }

  const usageByVariant = new Map<string, number>();
  for (const row of (usageRes.data ?? []) as Array<{ variant_id: string }>) {
    usageByVariant.set(row.variant_id, (usageByVariant.get(row.variant_id) ?? 0) + 1);
  }

  const result = rows.map(v => ({
    id: v.id,
    concept_id: v.concept_id,
    modifier: v.modifier,
    is_default: v.is_default,
    created_at: v.created_at,
    concept: {
      slug: v.concept.slug,
      family: v.concept.family,
      translations: conceptTranslations.get(v.concept_id) ?? {},
    },
    variant_translations: variantTranslations.get(v.id) ?? {},
    usage_count: usageByVariant.get(v.id) ?? 0,
    merge_targets: siblings.get(v.concept_id) ?? [],
  }));

  return NextResponse.json({ variants: result });
}

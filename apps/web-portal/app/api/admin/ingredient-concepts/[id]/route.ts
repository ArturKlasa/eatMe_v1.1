import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * GET /api/admin/ingredient-concepts/[id]
 *
 * Returns the full concept payload used by the detail page:
 *   - concept metadata
 *   - translations keyed by language
 *   - variants (each with its own translations keyed by language)
 *   - aliases grouped by language
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'concept id required' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  const { data: concept, error: conceptError } = await supabase
    .from('ingredient_concepts')
    .select('id, slug, family, is_vegetarian, is_vegan, allergens, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (conceptError) {
    return NextResponse.json({ error: conceptError.message }, { status: 500 });
  }
  if (!concept) {
    return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
  }

  const [conceptTrRes, variantsRes, aliasesRes] = await Promise.all([
    supabase.from('concept_translations').select('language, name').eq('concept_id', id),
    supabase
      .from('ingredient_variants')
      .select('id, modifier, is_default, needs_review, created_at')
      .eq('concept_id', id)
      .order('is_default', { ascending: false })
      .order('created_at'),
    supabase
      .from('ingredient_aliases_v2')
      .select('id, alias_text, language, variant_id')
      .eq('concept_id', id)
      .order('language')
      .order('alias_text'),
  ]);

  const translations: Record<string, string> = {};
  for (const row of (conceptTrRes.data ?? []) as Array<{ language: string; name: string }>) {
    translations[row.language] = row.name;
  }

  type VariantRow = {
    id: string;
    modifier: string | null;
    is_default: boolean;
    needs_review: boolean;
    created_at: string;
  };
  const variantRows = (variantsRes.data ?? []) as VariantRow[];

  // Pull variant_translations in one query for all variants
  const variantIds = variantRows.map(v => v.id);
  const variantTranslations = new Map<string, Record<string, string>>();
  if (variantIds.length > 0) {
    const { data: vtRows } = await supabase
      .from('variant_translations')
      .select('variant_id, language, name')
      .in('variant_id', variantIds);
    for (const row of (vtRows ?? []) as Array<{
      variant_id: string;
      language: string;
      name: string;
    }>) {
      const bucket = variantTranslations.get(row.variant_id) ?? {};
      bucket[row.language] = row.name;
      variantTranslations.set(row.variant_id, bucket);
    }
  }

  const variants = variantRows.map(v => ({
    ...v,
    translations: variantTranslations.get(v.id) ?? {},
  }));

  const aliases = (aliasesRes.data ?? []) as Array<{
    id: string;
    alias_text: string;
    language: string;
    variant_id: string | null;
  }>;

  return NextResponse.json({
    concept,
    translations,
    variants,
    aliases,
  });
}

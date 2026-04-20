/**
 * Locale-aware ingredient display name resolver (Phase 5).
 *
 * Given a joined `dish_ingredients` row, returns the best name to show the
 * user in their current locale, walking the fallback chain:
 *
 *   1. variant_translations[locale]
 *   2. variant_translations.en
 *   3. variant.modifier (raw)
 *   4. concept_translations[locale]
 *   5. concept_translations.en
 *   6. concept.slug
 *   7. legacy canonical_name (only populated on rows written pre-Phase 3)
 *
 * The first six steps unify into "concept-level" display; variant steps are
 * only considered when the row has a variant_id. The final fallback keeps
 * the UI working for dishes whose ingredients were ingested before Phase 3
 * added the concept_id column.
 */

export interface TranslationRow {
  language: string;
  name: string;
}

export interface JoinedDishIngredient {
  concept_id: string | null;
  variant_id: string | null;
  ingredient_id: string | null;
  concept?: {
    slug: string;
    translations?: TranslationRow[] | null;
  } | null;
  variant?: {
    modifier: string | null;
    translations?: TranslationRow[] | null;
  } | null;
  canonical_ingredient?: {
    canonical_name: string;
  } | null;
}

function pickTranslation(
  translations: TranslationRow[] | null | undefined,
  locale: string
): string | null {
  if (!translations || translations.length === 0) return null;
  const hit = translations.find(t => t.language === locale);
  if (hit?.name) return hit.name;
  const en = translations.find(t => t.language === 'en');
  return en?.name ?? null;
}

/**
 * Resolve one ingredient's display name for the given locale.
 * Always returns a non-empty string for rows that have any joinable data;
 * returns an empty string only when the row carries nothing at all (e.g. all
 * FK columns null).
 */
export function resolveIngredientName(row: JoinedDishIngredient, locale: string): string {
  // Variant layer
  if (row.variant_id && row.variant) {
    const variantTr = pickTranslation(row.variant.translations, locale);
    if (variantTr) return variantTr;
    if (row.variant.modifier) return row.variant.modifier;
  }

  // Concept layer
  if (row.concept) {
    const conceptTr = pickTranslation(row.concept.translations, locale);
    if (conceptTr) return conceptTr;
    if (row.concept.slug) return humanize(row.concept.slug);
  }

  // Legacy fallback — only reached for pre-Phase-3 dish_ingredients rows
  if (row.canonical_ingredient?.canonical_name) {
    return humanize(row.canonical_ingredient.canonical_name);
  }

  return '';
}

/** slug → "Slug" (title case + underscores to spaces). */
function humanize(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Convenience: resolve a batch of rows at once and drop empties in a single pass.
 */
export function resolveIngredientNames(rows: JoinedDishIngredient[], locale: string): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const name = resolveIngredientName(r, locale);
    if (name) out.push(name);
  }
  return out;
}

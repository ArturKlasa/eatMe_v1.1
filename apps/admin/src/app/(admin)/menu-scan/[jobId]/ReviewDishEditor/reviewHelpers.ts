import { DEFAULT_LANGUAGE, type DiningFormat, type SupportedLanguage } from '@eatme/shared';
import type { DishCategoryMatch } from '@/lib/auth/dal';
import { type CategoryMode, type EditableDish, type ExtractedDish } from '../useReviewState';

export function pickName(
  dict: Record<string, string>,
  lang: SupportedLanguage,
  fallback: string
): string {
  return dict[lang] ?? dict[DEFAULT_LANGUAGE] ?? fallback;
}

// LANDMINE L-3 — legacy dish_kind mapping (dropped migration 163, still on old result_json); do NOT remove; see 10-CONTEXT.md
// Map legacy worker output to the new dining_format hint. Only fires when the
// worker did NOT provide a dining_format directly (i.e. very old jobs scanned
// before Phase 2 shipped the dining_format field).
export function deriveDiningFormat(d: ExtractedDish): DiningFormat | null {
  if (d.dining_format !== undefined) return d.dining_format;
  if (d.dish_kind === 'course_menu') return 'course_menu';
  if (d.dish_kind === 'buffet') return 'buffet';
  return null;
}

export function asEditable(
  d: ExtractedDish,
  i: number,
  canonicalSlugSet: Set<string>,
  matchByQuery: Map<string, DishCategoryMatch>
): EditableDish {
  let categoryMode: CategoryMode = 'none';
  let categoryCanonicalSlug: string | null = null;
  let categoryCustomName = '';

  if (d.canonical_category_slug && canonicalSlugSet.has(d.canonical_category_slug)) {
    categoryMode = 'canonical';
    categoryCanonicalSlug = d.canonical_category_slug;
  } else if (d.suggested_category_name && d.suggested_category_name.trim()) {
    categoryMode = 'custom';
    categoryCustomName = d.suggested_category_name.trim();
  }

  let dishCategoryId: string | null = null;
  let dishCategoryUnmatched = false;
  const sdc = d.suggested_dish_category?.trim();
  if (sdc) {
    const match = matchByQuery.get(sdc);
    if (match?.matched_id) {
      dishCategoryId = match.matched_id;
    } else {
      dishCategoryUnmatched = true;
    }
  }

  const modifierGroups = (d.modifier_groups ?? []).map((g, gi) => ({
    _id: `mg-${i}-${gi}`,
    name: g.name,
    selection_type: g.selection_type,
    min_selections: g.min_selections,
    max_selections: g.max_selections,
    display_in_card: g.display_in_card,
    options: g.options.map((o, oi) => ({
      _id: `mo-${i}-${gi}-${oi}`,
      name: o.name,
      price_delta: o.price_delta,
      // LANDMINE L-2 — do NOT "fix" the 0->null collapse; see 10-CONTEXT.md
      // Jobs scanned before the worker's zero-override backstop carry 0 where
      // null was meant — collapse it here so old pending scans render an empty
      // field instead of a "0" the admin must clear on every option.
      price_override: o.price_override === 0 ? null : o.price_override,
      primary_protein: o.primary_protein,
      serves_delta: o.serves_delta,
      is_default: o.is_default,
    })),
  }));

  const bundledItems = (d.bundled_items ?? []).map((b, bi) => ({
    _id: `bi-${i}-${bi}`,
    name: b.name,
    note: b.note,
  }));

  return {
    name: d.name,
    description: d.description,
    price: d.price,
    primary_protein: d.primary_protein,
    suggested_category_name: d.suggested_category_name,
    canonical_category_slug: d.canonical_category_slug,
    suggested_category_description: d.suggested_category_description,
    suggested_dish_category: d.suggested_dish_category,
    source_image_index: d.source_image_index,
    confidence: d.confidence,
    _id: `dish-${i}`,
    _deleted: false,
    categoryMode,
    categoryExistingId: null,
    categoryCanonicalSlug,
    categoryCustomName,
    dishCategoryId,
    dishCategoryUnmatched,
    display_price_prefix: d.display_price_prefix ?? 'exact',
    serves: d.serves ?? null,
    dining_format: deriveDiningFormat(d),
    bundled_items: bundledItems,
    modifier_groups: modifierGroups,
    // Portion fields coerced from optional-undefined on the wire to required-null
    // on the editable side so the paired form control has stable state.
    portion_amount: d.portion_amount ?? null,
    portion_unit: d.portion_unit ?? null,
  };
}

export function confidenceTone(c: number): string {
  if (c >= 0.85) return 'bg-green-100 text-green-800 border-green-200';
  if (c >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export function getGroupKey(d: EditableDish): string {
  switch (d.categoryMode) {
    case 'existing':
      return d.categoryExistingId ? `e:${d.categoryExistingId}` : 'none';
    case 'canonical':
      return d.categoryCanonicalSlug ? `c:${d.categoryCanonicalSlug}` : 'none';
    case 'custom': {
      const trimmed = d.categoryCustomName.trim();
      return trimmed ? `n:${trimmed.toLowerCase()}` : 'none';
    }
    case 'none':
    default:
      return 'none';
  }
}

export function encodeCategoryValue(d: EditableDish): string {
  switch (d.categoryMode) {
    case 'existing':
      return d.categoryExistingId ? `existing:${d.categoryExistingId}` : '';
    case 'canonical':
      return d.categoryCanonicalSlug ? `canonical:${d.categoryCanonicalSlug}` : '';
    case 'custom':
      return 'custom';
    case 'none':
    default:
      return '';
  }
}

export function decodeCategoryValue(value: string): Partial<EditableDish> {
  if (value === '') {
    return { categoryMode: 'none', categoryExistingId: null, categoryCanonicalSlug: null };
  }
  if (value === 'custom') {
    return { categoryMode: 'custom', categoryExistingId: null, categoryCanonicalSlug: null };
  }
  if (value.startsWith('existing:')) {
    return {
      categoryMode: 'existing',
      categoryExistingId: value.slice('existing:'.length),
      categoryCanonicalSlug: null,
    };
  }
  if (value.startsWith('canonical:')) {
    return {
      categoryMode: 'canonical',
      categoryExistingId: null,
      categoryCanonicalSlug: value.slice('canonical:'.length),
    };
  }
  return {};
}

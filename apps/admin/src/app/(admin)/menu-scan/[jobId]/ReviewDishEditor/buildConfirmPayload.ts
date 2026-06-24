import { type SupportedLanguage } from '@eatme/shared';
import { type EditableDish } from '../useReviewState';

// Pure confirm-payload assembler (D-07). Receives plain data + predicates — no
// closure over component state/maps — so the byte-identical payload can be
// snapshot-tested in isolation (D-10). `getGroupMeta` is passed IN (it closes
// over lookup maps in index.tsx); buildConfirmPayload only reads its
// descriptionLocked flag, staying pure itself.
export function buildConfirmPayload(args: {
  activeDishes: EditableDish[];
  sourceLanguage: SupportedLanguage;
  categoryDescriptions: Map<string, string>;
  getGroupKey: (d: EditableDish) => string;
  getGroupMeta: (key: string) => {
    displayName: string;
    descriptionLocked: boolean;
    badge: string | null;
  };
}) {
  const { activeDishes, sourceLanguage, categoryDescriptions, getGroupKey, getGroupMeta } = args;

  // Build category_descriptions array — one entry per unique key referenced
  // by an active dish.
  const seenKeys = new Set<string>();
  const categoryDescriptionsPayload: Array<{
    canonical_slug: string | null;
    custom_name: string | null;
    existing_id: string | null;
    description: string | null;
    verbatim_name: string | null;
  }> = [];
  for (const d of activeDishes) {
    const key = getGroupKey(d);
    if (key === 'none' || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const meta = getGroupMeta(key);
    const rawDesc = categoryDescriptions.get(key)?.trim() || null;
    const desc = rawDesc && !meta.descriptionLocked ? rawDesc : null;

    const verbatim =
      d.categoryMode === 'canonical' && d.suggested_category_name?.trim()
        ? d.suggested_category_name.trim()
        : null;

    if (!desc && !verbatim) continue;

    categoryDescriptionsPayload.push({
      canonical_slug: d.categoryMode === 'canonical' ? d.categoryCanonicalSlug : null,
      custom_name: d.categoryMode === 'custom' ? d.categoryCustomName.trim() : null,
      existing_id: d.categoryMode === 'existing' ? d.categoryExistingId : null,
      description: desc,
      verbatim_name: verbatim,
    });
  }

  return {
    source_language_code: sourceLanguage,
    category_descriptions: categoryDescriptionsPayload,
    dishes: activeDishes.map(d => ({
      name: d.name.trim(),
      description: d.description?.trim() || null,
      price: d.price,
      primary_protein: d.primary_protein,
      source_image_index: d.source_image_index,
      category_existing_id: d.categoryMode === 'existing' ? d.categoryExistingId : null,
      category_canonical_slug: d.categoryMode === 'canonical' ? d.categoryCanonicalSlug : null,
      category_custom_name: d.categoryMode === 'custom' ? d.categoryCustomName.trim() : null,
      dish_category_id: d.dishCategoryId,
      display_price_prefix: d.display_price_prefix,
      serves: d.serves,
      dining_format: d.dining_format,
      portion_amount: d.portion_amount,
      portion_unit: d.portion_unit,
      bundled_items: d.bundled_items.map(b => ({
        name: b.name.trim(),
        note: b.note?.trim() || null,
      })),
      modifier_groups: d.modifier_groups.map(g => ({
        name: g.name.trim(),
        selection_type: g.selection_type,
        min_selections: g.min_selections,
        max_selections: g.max_selections,
        display_in_card: g.display_in_card,
        options: g.options.map(o => ({
          name: o.name.trim(),
          price_delta: o.price_delta,
          price_override: o.price_override,
          primary_protein: o.primary_protein,
          serves_delta: o.serves_delta,
          is_default: o.is_default,
        })),
      })),
    })),
  };
}

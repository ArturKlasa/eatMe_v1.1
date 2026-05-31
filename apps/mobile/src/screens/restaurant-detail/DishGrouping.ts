/**
 * DishGrouping
 *
 * Flattens a category's dishes into render-ready standalone rows.
 *
 * Genuine standalone dishes pass through unchanged. Legacy parent/variant
 * groups (is_parent=true + child rows via parent_dish_id) are folded into a
 * single synthesized dish that carries a "from $min" price and a synthetic
 * single-select "Options" group (one option per variant). This lets the
 * standard render path (DishMenuItem + ModifierGroupsList + DishPhotoModal)
 * treat them identically to a modern dish with option groups.
 *
 * This is a presentation-layer bridge that mirrors the dish-model-rewrite
 * Phase 6 migration (variants → one single-select option group). Phase 7
 * deletes this file once the parent_dish_id column is dropped.
 */

import { type Dish, type Option, type OptionGroup } from '../../lib/supabase';

/**
 * DishWithGroups augments the generated Dish type with:
 * - option_groups: embedded option groups from the nested query
 * - photo_url: legacy alias for image_url (may be present from older data/queries)
 * - ingredients: legacy text array of ingredient names from menu scan
 * - parent_dish_id / is_parent: universal dish structure fields
 */
export type DishWithGroups = Dish & {
  option_groups?: OptionGroup[];
  photo_url?: string | null;
  ingredients?: string[];
  parent_dish_id?: string | null;
  is_parent?: boolean;
};

// Build a synthetic single-select "Options" group from a parent's variant
// children. Each variant becomes one option priced with price_override (its
// absolute price) so both ModifierGroupsList and DishPhotoModal show e.g.
// "Small $10 · Medium $12". Variant order is preserved.
function variantsToOptionGroup(
  parent: DishWithGroups,
  variants: DishWithGroups[],
  optionsLabel: string
): OptionGroup {
  const groupId = `variants:${parent.id}`;
  return {
    id: groupId,
    restaurant_id: parent.restaurant_id ?? '',
    dish_id: parent.id,
    name: optionsLabel,
    selection_type: 'single',
    min_selections: 1,
    max_selections: 1,
    display_order: -1, // sort ahead of any real option groups the parent has
    is_active: true,
    options: variants.map(
      (v, i): Option => ({
        id: v.id,
        option_group_id: groupId,
        name: v.name,
        price_delta: 0,
        price_override: v.price ?? null,
        is_available: true,
        display_order: i,
      })
    ),
  };
}

/**
 * Returns dishes ready to render as standalone rows, preserving the
 * restaurant-defined ordering. Parent/variant groups are folded into a single
 * synthesized dish (see module docs). `optionsLabel` is the localized name for
 * the synthetic variant group (e.g. "Options").
 */
export function groupDishesByParent(
  dishes: DishWithGroups[],
  optionsLabel: string
): DishWithGroups[] {
  const variantsByParent = new Map<string, DishWithGroups[]>();

  for (const dish of dishes) {
    if (dish.is_parent) {
      if (!variantsByParent.has(dish.id)) variantsByParent.set(dish.id, []);
    } else if (dish.parent_dish_id) {
      const list = variantsByParent.get(dish.parent_dish_id) ?? [];
      list.push(dish);
      variantsByParent.set(dish.parent_dish_id, list);
    }
  }

  const result: DishWithGroups[] = [];

  // Walk original dish order to preserve restaurant-defined ordering
  for (const dish of dishes) {
    if (dish.is_parent) {
      const variants = variantsByParent.get(dish.id) ?? [];
      if (variants.length === 0) continue; // display-only parent, no variants → skip
      const minPrice = variants.reduce(
        (acc, v) => (v.price != null && v.price < acc ? v.price : acc),
        Infinity
      );
      const hasPrice = Number.isFinite(minPrice);
      result.push({
        ...dish,
        price: hasPrice ? minPrice : dish.price,
        display_price_prefix: hasPrice ? 'from' : dish.display_price_prefix,
        option_groups: [
          variantsToOptionGroup(dish, variants, optionsLabel),
          ...(dish.option_groups ?? []),
        ],
      });
    } else if (!dish.parent_dish_id) {
      result.push(dish); // genuine standalone, unchanged
    }
    // Variant children are folded into their parent — skip at top level
  }

  return result;
}

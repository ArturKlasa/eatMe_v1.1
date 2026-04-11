/**
 * DishGrouping
 *
 * Groups dishes within a category by parent_dish_id.
 * Returns an ordered list of render items:
 *   - standalone: dishes with no parent and is_parent=false
 *   - parent: parent dish + its variant children
 * Parent display-only containers without variants are omitted.
 */

import { type Dish, type OptionGroup } from '../../lib/supabase';

/**
 * DishWithGroups augments the generated Dish type with:
 * - option_groups: embedded option groups from the nested query
 * - photo_url: legacy alias for image_url (may be present from older data/queries)
 * - ingredients: legacy text array column (superseded by dish_ingredients join table)
 * - parent_dish_id / is_parent: universal dish structure fields
 */
export type DishWithGroups = Dish & {
  option_groups?: OptionGroup[];
  photo_url?: string | null;
  ingredients?: string[];
  parent_dish_id?: string | null;
  is_parent?: boolean;
};

export type DishGroupItem =
  | { type: 'standalone'; dish: DishWithGroups }
  | { type: 'parent'; parent: DishWithGroups; variants: DishWithGroups[] };

export function groupDishesByParent(dishes: DishWithGroups[]): DishGroupItem[] {
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

  const result: DishGroupItem[] = [];

  // Walk original dish order to preserve restaurant-defined ordering
  for (const dish of dishes) {
    if (dish.is_parent) {
      const variants = variantsByParent.get(dish.id) ?? [];
      if (variants.length > 0) {
        result.push({ type: 'parent', parent: dish, variants });
      }
      // Skip parent with no variants (shouldn't happen in practice)
    } else if (!dish.parent_dish_id) {
      result.push({ type: 'standalone', dish });
    }
    // Variants are rendered inside their parent group, skip here
  }

  return result;
}

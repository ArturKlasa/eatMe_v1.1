/**
 * Shared dish shape for the restaurant-detail screen.
 *
 * DishWithGroups augments the generated Dish type with:
 * - option_groups: embedded option groups from the nested query
 * - photo_url: legacy alias for image_url (may be present from older data/queries)
 * - ingredients: legacy text array of ingredient names from menu scan
 */

import { type Dish, type OptionGroup } from '../../lib/supabase';

export type DishWithGroups = Dish & {
  option_groups?: OptionGroup[];
  photo_url?: string | null;
  ingredients?: string[];
};

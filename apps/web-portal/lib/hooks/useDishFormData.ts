/**
 * useDishFormData Hook
 *
 * Loads and manages the supporting data (ingredients, allergens, dietary tags,
 * option groups) required by the dish form dialog. Handles both new-dish creation
 * and edit mode, resetting state when the dialog opens or the target dish changes.
 */

import { useState, useEffect, useCallback } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import type { Dish, OptionGroup } from '@eatme/shared';
import type { Ingredient, Allergen, DietaryTag } from '@/lib/ingredients';
import type { DishFormData } from '@eatme/shared';
import type { RawOptionGroup } from '@/lib/restaurantService';
import { toast } from 'sonner';

/** Options for {@link useDishFormData}. */
interface UseDishFormDataOptions {
  /** Existing dish to edit, or null/undefined for a new dish. */
  dish?: (Partial<Dish> & { id?: string }) | null;
  /** Whether the parent dialog is currently open — controls reset timing. */
  isOpen: boolean;
  /** Pre-fills dishType from the parent menu's type. */
  menuType?: 'food' | 'drink';
  /** Required in DB mode to set `restaurant_id` on new dishes. */
  restaurantId?: string;
  /** Required in DB mode to set `menu_category_id` on new dishes. */
  menuCategoryId?: string;
  /** react-hook-form methods (passed in so the caller keeps control of the form instance). */
  methods: UseFormReturn<DishFormData>;
  /**
   * Called instead of a DB write when the form is inside a wizard.
   * Receives the assembled local Dish object so the caller can stage it.
   */
  onWizardSubmit?: (dish: Dish) => void;
  /** Called after a successful DB save so the caller can refresh its data. */
  onSuccess?: () => void;
  /** Called to close the parent dialog after submit or cancel. */
  onClose: () => void;
}

const DEFAULT_VALUES: DishFormData = {
  name: '',
  description: '',
  price: 0,
  calories: undefined,
  dietary_tags: [],
  allergens: [],
  spice_level: 'none' as const,
  photo_url: '',
  is_available: true,
  dish_category_id: null,
  description_visibility: 'menu' as const,
  ingredients_visibility: 'detail' as const,
  dish_kind: 'standard' as const,
  display_price_prefix: 'exact' as const,
  serves: 1,
  option_groups: [],
};

/**
 * Manages dish form state, ingredient/option-group loading, and form submission.
 *
 * Handles two submission modes:
 * - **Wizard mode** (`onWizardSubmit` provided): assembles a local Dish object and
 *   hands it to the caller without touching Supabase — used in the onboarding wizard.
 * - **DB mode** (no `onWizardSubmit`): writes directly to Supabase then calls `onSuccess`.
 *
 * Automatically loads existing ingredients and option groups when `dish.id` is set
 * and the dialog is opened.
 *
 * @param options - See {@link UseDishFormDataOptions}.
 * @returns Form state and event handlers to wire into the dish form UI.
 */
export function useDishFormData({
  dish,
  isOpen,
  menuType,
  restaurantId,
  menuCategoryId,
  methods,
  onWizardSubmit,
  onSuccess,
  onClose,
}: UseDishFormDataOptions) {
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>([]);
  const [calculatedAllergens, setCalculatedAllergens] = useState<Allergen[]>([]);
  const [calculatedDietaryTags, setCalculatedDietaryTags] = useState<DietaryTag[]>([]);
  const [dishType, setDishType] = useState<'food' | 'drink'>('food');
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

  const { reset } = methods;

  // Initialize dishType from menuType prop
  useEffect(() => {
    if (menuType) setDishType(menuType);
  }, [menuType, isOpen]);

  // Reset form when dish or open state changes
  useEffect(() => {
    if (dish && isOpen) {
      reset({
        name: dish.name || '',
        description: dish.description || '',
        price: dish.price || 0,
        calories: dish.calories || undefined,
        dietary_tags: dish.dietary_tags || [],
        allergens: dish.allergens || [],
        spice_level: (dish.spice_level as 'none' | 'mild' | 'hot') || 'none',
        photo_url: dish.photo_url || '',
        is_available: dish.is_available !== false,
        dish_category_id: dish.dish_category_id ?? null,
        description_visibility: dish.description_visibility ?? 'menu',
        ingredients_visibility: dish.ingredients_visibility ?? 'detail',
        dish_kind: (dish.dish_kind ?? 'standard') as 'standard' | 'template' | 'experience' | 'combo',
        display_price_prefix: (dish.display_price_prefix ?? 'exact') as
          | 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server',
        serves: dish.serves ?? 1,
        option_groups: [],
      });

      if (dish.id) {
        loadOptionGroups(dish.id);
        loadIngredients(dish.id);
      } else {
        setSelectedIngredients([]);
      }
    } else if (!dish && isOpen) {
      reset(DEFAULT_VALUES);
      setSelectedIngredients([]);
      setOptionGroups([]);
    }
  }, [dish, isOpen, reset]);

  const loadOptionGroups = async (dishId: string) => {
    const { data } = await supabase
      .from('option_groups')
      .select('*, options(*)')
      .eq('dish_id', dishId)
      .order('display_order');

    if (data && data.length > 0) {
      setOptionGroups(
        data.map((g: RawOptionGroup) => ({
          ...g,
          options: (g.options ?? []).sort(
            (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
          ),
        })) as OptionGroup[]
      );
    } else {
      setOptionGroups([]);
    }
  };

  const loadIngredients = async (dishId: string) => {
    type DishIngredientRow = {
      ingredient_id: string;
      quantity: string | null;
      canonical_ingredient: {
        id: string;
        canonical_name: string;
        ingredient_family_name: string | null;
        is_vegetarian: boolean | null;
        is_vegan: boolean | null;
        ingredient_aliases: Array<{ id: string; display_name: string }>;
      } | null;
    };

    const { data } = await supabase
      .from('dish_ingredients')
      .select(`
        ingredient_id,
        quantity,
        canonical_ingredient:canonical_ingredients(
          id,
          canonical_name,
          ingredient_family_name,
          is_vegetarian,
          is_vegan,
          ingredient_aliases(id, display_name)
        )
      `)
      .eq('dish_id', dishId);

    if (data && data.length > 0) {
      const loaded = data.map((row: DishIngredientRow): Ingredient => {
        const alias = row.canonical_ingredient?.ingredient_aliases?.[0];
        return {
          id: alias?.id ?? row.ingredient_id,
          display_name: alias?.display_name ?? row.canonical_ingredient?.canonical_name ?? '',
          canonical_ingredient_id: row.ingredient_id,
          canonical_name: row.canonical_ingredient?.canonical_name,
          ingredient_family_name: row.canonical_ingredient?.ingredient_family_name ?? undefined,
          is_vegetarian: row.canonical_ingredient?.is_vegetarian ?? undefined,
          is_vegan: row.canonical_ingredient?.is_vegan ?? undefined,
          quantity: row.quantity ?? undefined,
        };
      });
      setSelectedIngredients(loaded);
    } else {
      setSelectedIngredients([]);
    }
  };

  const resetAll = useCallback(() => {
    reset();
    setSelectedIngredients([]);
    setCalculatedAllergens([]);
    setCalculatedDietaryTags([]);
    setOptionGroups([]);
  }, [reset]);

  const handleFormSubmit = async (data: DishFormData) => {
    // Wizard mode (local state, no immediate DB write)
    if (onWizardSubmit) {
      const localDish: Dish = {
        id: dish?.id,
        name: data.name,
        description: data.description,
        price: data.price,
        calories: !isNaN(data.calories as number) ? data.calories : undefined,
        dietary_tags: data.dietary_tags || [],
        allergens: data.allergens || [],
        spice_level: data.spice_level || undefined,
        photo_url: data.photo_url,
        is_available: data.is_available !== false,
        dish_category_id: data.dish_category_id ?? null,
        description_visibility: data.description_visibility ?? 'menu',
        ingredients_visibility: data.ingredients_visibility ?? 'detail',
        dish_kind: data.dish_kind ?? 'standard',
        display_price_prefix: data.display_price_prefix ?? 'exact',
        serves: data.serves ?? 1,
        option_groups: optionGroups,
        ...(selectedIngredients.length > 0 ? { selectedIngredients } : {}),
      } as Dish & { selectedIngredients?: typeof selectedIngredients };
      onWizardSubmit(localDish);
      resetAll();
      onClose();
      return;
    }

    // DB mode (direct Supabase write)
    try {
      const dishData = {
        restaurant_id: restaurantId,
        menu_category_id: menuCategoryId,
        dish_category_id: data.dish_category_id ?? null,
        name: data.name,
        description: data.description || null,
        price: data.price,
        is_available: data.is_available !== false,
        image_url: data.photo_url,
        dietary_tags: data.dietary_tags || [],
        allergens: data.allergens || [],
        calories: !isNaN(data.calories as number) && data.calories != null ? data.calories : null,
        spice_level: data.spice_level && data.spice_level !== 'none' ? data.spice_level : null,
        description_visibility: data.description_visibility ?? 'menu',
        ingredients_visibility: data.ingredients_visibility ?? 'detail',
        dish_kind: data.dish_kind ?? 'standard',
        display_price_prefix: data.display_price_prefix ?? 'exact',
        serves: data.serves ?? 1,
      };

      let dishId: string;

      if (dish?.id) {
        const { data: updated, error } = await supabase
          .from('dishes')
          .update(dishData)
          .eq('id', dish.id)
          .select('id');
        if (error) throw error;
        if (!updated || updated.length === 0) {
          throw new Error('Update blocked — check you are logged in as the restaurant owner.');
        }
        dishId = dish.id;
        toast.success('Dish updated successfully');
      } else {
        const { data: inserted, error } = await supabase
          .from('dishes')
          .insert(dishData)
          .select('id')
          .single();
        if (error) throw error;
        dishId = inserted.id;
        toast.success('Dish added successfully');
      }

      // Sync dish_ingredients junction table
      if (selectedIngredients.length > 0) {
        await supabase.from('dish_ingredients').delete().eq('dish_id', dishId);
        const ingredientRows = selectedIngredients.map(ing => ({
          dish_id: dishId,
          ingredient_id: ing.canonical_ingredient_id,
          quantity: ing.quantity ?? null,
        }));
        const { error: ingError } = await supabase.from('dish_ingredients').insert(ingredientRows);
        if (ingError) {
          console.error('[DishForm] Failed to save ingredients:', ingError);
          toast.warning('Dish saved, but ingredient links could not be updated.');
        }
      } else if (dish?.id) {
        await supabase.from('dish_ingredients').delete().eq('dish_id', dishId);
      }

      // Sync option_groups + options
      await supabase.from('option_groups').delete().eq('dish_id', dishId);
      if (optionGroups.length > 0) {
        for (const [gi, group] of optionGroups.entries()) {
          const { data: insertedGroup, error: groupError } = await supabase
            .from('option_groups')
            .insert({
              restaurant_id: restaurantId!,
              dish_id: dishId,
              name: group.name,
              description: group.description ?? null,
              selection_type: group.selection_type,
              min_selections: group.min_selections ?? 0,
              max_selections: group.max_selections ?? null,
              display_order: gi,
              is_active: group.is_active !== false,
            })
            .select('id')
            .single();
          if (groupError) {
            console.error('[DishForm] Failed to save option group:', groupError);
            toast.warning('Dish saved, but some option groups could not be saved.');
            break;
          }
          if (group.options.length > 0) {
            const { error: optError } = await supabase.from('options').insert(
              group.options.map((opt, oi) => ({
                option_group_id: insertedGroup.id,
                name: opt.name,
                description: opt.description ?? null,
                price_delta: opt.price_delta ?? 0,
                calories_delta: opt.calories_delta ?? null,
                canonical_ingredient_id: opt.canonical_ingredient_id ?? null,
                is_available: opt.is_available !== false,
                display_order: oi,
              }))
            );
            if (optError) {
              console.error('[DishForm] Failed to save options for group:', optError);
            }
          }
        }
      }

      resetAll();
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error('[DishForm] Error saving dish:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to save dish: ' + message);
    }
  };

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  return {
    selectedIngredients,
    setSelectedIngredients,
    calculatedAllergens,
    calculatedDietaryTags,
    dishType,
    setDishType,
    optionGroups,
    setOptionGroups,
    handleFormSubmit,
    handleClose,
  };
}

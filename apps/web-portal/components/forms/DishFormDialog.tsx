'use client';

import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dish, OptionGroup, Option } from '@/types/restaurant';
import { dishSchema, type DishFormData } from '@/lib/validation';
import {
  DIETARY_TAGS,
  ALLERGENS,
  SPICE_LEVELS,
  RELIGIOUS_REQUIREMENTS,
  DISH_KINDS,
  DISPLAY_PRICE_PREFIXES,
  SELECTION_TYPES,
  OPTION_PRESETS,
} from '@/lib/constants';
import { IngredientAutocomplete } from '@/components/IngredientAutocomplete';
import { AllergenWarnings } from '@/components/AllergenWarnings';
import { DietaryTagBadges } from '@/components/DietaryTagBadges';
import type { Ingredient, Allergen, DietaryTag } from '@/lib/ingredients';
import { fetchDishCategories, type DishCategory } from '@/lib/dish-categories';
import { getCuisineCategories } from '@/lib/cuisine-categories';
import { supabase } from '@/lib/supabase';
import type { RawOptionGroup } from '@/lib/restaurantService';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

// The component supports two modes:
//   Wizard mode – onSubmit is provided; data stays in local state, no Supabase write.
//   DB mode    – restaurantId + menuCategoryId are provided; writes directly to Supabase.
interface DishFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Accepts either the full Dish (wizard) or a DB record partial (admin) without type error
  dish?: (Partial<Dish> & { id?: string }) | null;

  // The type of the parent menu — filters the category dropdown
  menuType?: 'food' | 'drink';

  // Restaurant cuisine for smart category suggestions
  restaurantCuisine?: string;

  // DB mode
  restaurantId?: string;
  menuCategoryId?: string;
  onSuccess?: () => void;

  // Wizard mode (local state – no immediate DB write)
  onSubmit?: (dish: Dish) => void;
}

export function DishFormDialog({
  isOpen,
  onClose,
  dish,
  menuType,
  restaurantCuisine,
  restaurantId,
  menuCategoryId,
  onSuccess,
  onSubmit: onWizardSubmit,
}: DishFormDialogProps) {
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>([]);
  const [calculatedAllergens, setCalculatedAllergens] = useState<Allergen[]>([]);
  const [calculatedDietaryTags, setCalculatedDietaryTags] = useState<DietaryTag[]>([]);

  // Internal Food/Drink toggle (overrides menuType if user changes it)
  const [dishType, setDishType] = useState<'food' | 'drink'>('food');

  // Canonical dish categories fetched from DB
  const [dishCategories, setDishCategories] = useState<DishCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Option groups (template / experience dishes)
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    reset,
  } = useForm<DishFormData>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      calories: undefined,
      dietary_tags: [] as string[],
      allergens: [] as string[],
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
    },
  });

  // Load categories once on mount
  useEffect(() => {
    const load = async () => {
      setLoadingCategories(true);
      const { data, error } = await fetchDishCategories();
      if (!error) setDishCategories(data);
      setLoadingCategories(false);
    };
    load();
  }, []);

  // Initialize dishType from menuType prop
  useEffect(() => {
    if (menuType) {
      setDishType(menuType);
    }
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
          | 'exact'
          | 'from'
          | 'per_person'
          | 'market_price'
          | 'ask_server',
        serves: dish.serves ?? 1,
        option_groups: [],
      });

      // Load option_groups + options when editing an existing dish
      if (dish.id) {
        supabase
          .from('option_groups')
          .select('*, options(*)')
          .eq('dish_id', dish.id)
          .order('display_order')
          .then(({ data }) => {
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
          });
      }

      // Load existing dish_ingredients rows so the autocomplete shows them when editing
      if (dish.id) {
        supabase
          .from('dish_ingredients')
          .select(
            `
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
          `
          )
          .eq('dish_id', dish.id)
          .then(({ data }) => {
            if (data && data.length > 0) {
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
              const loaded = data.map((row: DishIngredientRow): Ingredient => {
                const alias = row.canonical_ingredient?.ingredient_aliases?.[0];
                return {
                  id: alias?.id ?? row.ingredient_id,
                  display_name:
                    alias?.display_name ?? row.canonical_ingredient?.canonical_name ?? '',
                  canonical_ingredient_id: row.ingredient_id,
                  canonical_name: row.canonical_ingredient?.canonical_name,
                  ingredient_family_name:
                    row.canonical_ingredient?.ingredient_family_name ?? undefined,
                  is_vegetarian: row.canonical_ingredient?.is_vegetarian ?? undefined,
                  is_vegan: row.canonical_ingredient?.is_vegan ?? undefined,
                  quantity: row.quantity ?? undefined,
                };
              });
              setSelectedIngredients(loaded);
            } else {
              setSelectedIngredients([]);
            }
          });
      } else {
        setSelectedIngredients([]);
      }
    } else if (!dish && isOpen) {
      reset({
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
        description_visibility: 'menu',
        ingredients_visibility: 'detail',
        dish_kind: 'standard',
        display_price_prefix: 'exact',
        option_groups: [],
      });
      setSelectedIngredients([]);
      setOptionGroups([]);
    }
  }, [dish, isOpen, reset]);

  const dietaryTags = useWatch({ control, name: 'dietary_tags', defaultValue: [] }) || [];
  const allergens = useWatch({ control, name: 'allergens', defaultValue: [] }) || [];
  const spiceLevel = useWatch({ control, name: 'spice_level', defaultValue: 'none' });
  const dishCategoryId = useWatch({ control, name: 'dish_category_id', defaultValue: null });
  const dishKind = useWatch({ control, name: 'dish_kind', defaultValue: 'standard' });
  const displayPricePrefix = useWatch({
    control,
    name: 'display_price_prefix',
    defaultValue: 'exact',
  });

  const handleFormSubmit = async (data: DishFormData) => {
    // ── Wizard mode (local state, no immediate DB write) ────────────────────
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
        // carry selectedIngredients for linking later during final submission
        ...(selectedIngredients.length > 0 ? { selectedIngredients } : {}),
      } as Dish & { selectedIngredients?: typeof selectedIngredients };
      onWizardSubmit(localDish);
      handleClose();
      return;
    }

    // ── DB mode (direct Supabase write) ─────────────────────────────────────
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

      // ── Sync dish_ingredients junction table ────────────────────────────
      // Delete all existing links first (covers both insert and update paths),
      // then re-insert the current selection. This keeps the junction table
      // in sync whenever the user changes ingredients.
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
          // Non-fatal: dish is saved, but warn the user
          toast.warning('Dish saved, but ingredient links could not be updated.');
        }
      } else if (dish?.id) {
        // If editing and all ingredients were removed, clear the junction table
        await supabase.from('dish_ingredients').delete().eq('dish_id', dishId);
      }

      // ── Sync option_groups + options ───────────────────────────────────────
      // Delete all existing groups (cascades to options), then re-insert.
      // Only applies when the dish has option groups (template / experience).
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

      reset();
      setSelectedIngredients([]);
      setCalculatedAllergens([]);
      setCalculatedDietaryTags([]);
      setOptionGroups([]);
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error('[DishForm] Error saving dish:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to save dish: ' + message);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleDietaryTag = (tag: string) => {
    const current = dietaryTags;

    if (tag === 'vegan') {
      if (current.includes('vegan')) {
        // Unchecking vegan - remove it
        setValue(
          'dietary_tags',
          current.filter(t => t !== 'vegan')
        );
      } else {
        // Checking vegan - add both vegan and vegetarian
        const newTags = [...current, 'vegan'];
        if (!newTags.includes('vegetarian')) {
          newTags.push('vegetarian');
        }
        setValue('dietary_tags', newTags);
      }
    } else if (tag === 'vegetarian') {
      if (current.includes('vegetarian')) {
        // Only allow unchecking vegetarian if vegan is not checked
        if (!current.includes('vegan')) {
          setValue(
            'dietary_tags',
            current.filter(t => t !== 'vegetarian')
          );
        }
      } else {
        // Checking vegetarian
        setValue('dietary_tags', [...current, 'vegetarian']);
      }
    } else {
      // Handle other dietary tags normally
      if (current.includes(tag)) {
        setValue(
          'dietary_tags',
          current.filter(t => t !== tag)
        );
      } else {
        setValue('dietary_tags', [...current, tag]);
      }
    }
  };

  const toggleAllergen = (allergen: string) => {
    const current = allergens;
    if (current.includes(allergen)) {
      setValue(
        'allergens',
        current.filter(a => a !== allergen)
      );
    } else {
      setValue('allergens', [...current, allergen]);
    }
  };

  // Filter categories by the parent menu type.
  // If menuType is 'drink' → show only drink categories.
  // Filter categories by the selected dishType
  const foodCategories = dishCategories.filter(c => !c.is_drink);
  const drinkCategories = dishCategories.filter(c => c.is_drink);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dish ? 'Edit Dish' : 'Add New Dish'}</DialogTitle>
          <p className="text-sm text-gray-500">Information will be visible to customers</p>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Food/Drink Toggle */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-sm font-medium text-gray-700 mr-2">Type:</span>
            <Button
              type="button"
              variant={dishType === 'food' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDishType('food')}
              className="flex-1"
            >
              🍽️ Food
            </Button>
            <Button
              type="button"
              variant={dishType === 'drink' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDishType('drink')}
              className="flex-1"
            >
              🥤 Drink
            </Button>
          </div>

          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Basic Information</h3>

            {/* Canonical Dish Category - MOVED TO TOP */}
            <div>
              <Label htmlFor="dish_category_id" className="mb-2 block">
                Dish Category *
                <span className="ml-1 text-xs font-normal text-gray-500">
                  (Helps customers find similar dishes)
                </span>
              </Label>

              {/* Quick-select popular categories based on cuisine */}
              {restaurantCuisine && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {getCuisineCategories(restaurantCuisine).map(categoryName => {
                    const matchedCategory = dishCategories.find(
                      c => c.name === categoryName && c.is_drink === (dishType === 'drink')
                    );
                    return matchedCategory ? (
                      <Button
                        key={matchedCategory.id}
                        type="button"
                        variant={dishCategoryId === matchedCategory.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() =>
                          setValue('dish_category_id', matchedCategory.id, { shouldValidate: true })
                        }
                        className="text-xs"
                      >
                        {matchedCategory.name}
                      </Button>
                    ) : null;
                  })}
                </div>
              )}

              <Select
                value={dishCategoryId ?? 'none'}
                onValueChange={val =>
                  setValue('dish_category_id', val === 'none' ? null : val, {
                    shouldValidate: true,
                  })
                }
                disabled={loadingCategories}
              >
                <SelectTrigger id="dish_category_id" className="w-full">
                  <SelectValue
                    placeholder={loadingCategories ? 'Loading categories…' : 'Select a category'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No category —</SelectItem>
                  {dishType === 'food' && foodCategories.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs text-gray-500 uppercase tracking-wide">
                        🍽 Food
                      </SelectLabel>
                      {foodCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {dishType === 'drink' && drinkCategories.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs text-gray-500 uppercase tracking-wide">
                        🥤 Drinks
                      </SelectLabel>
                      {drinkCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {dishType === 'food'
                  ? 'e.g., Pizza, Burger, Salad'
                  : 'e.g., Coffee, Smoothie, Cocktail'}
              </p>
              {errors.dish_category_id && (
                <p className="text-sm text-red-600 mt-1">{errors.dish_category_id.message}</p>
              )}
            </div>

            {/* Name - NOW BELOW CATEGORY */}
            <div>
              <Label htmlFor="name" className="mb-2 block">
                Dish Name *
              </Label>
              <Input id="name" {...register('name')} placeholder="e.g., Margherita Pizza" />
              {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="mb-2 block">
                Description <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="e.g., Crispy thin-crust pizza with fresh mozzarella and basil"
                rows={3}
                className="resize-none"
              />
              {errors.description && (
                <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
              )}
            </div>

            {/* Description Visibility */}
            <div>
              <Label className="mb-2 block">Show description in app</Label>
              <div className="flex gap-4">
                {(
                  [
                    {
                      value: 'menu',
                      label: '📋 Menu list',
                      hint: 'Shown in the restaurant menu row',
                    },
                    {
                      value: 'detail',
                      label: '🖼️ Dish detail only',
                      hint: 'Shown when user taps the dish',
                    },
                  ] as const
                ).map(opt => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-2 cursor-pointer flex-1 rounded-lg border p-3 hover:bg-gray-50 has-checked:border-primary has-checked:bg-primary/5"
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      {...register('description_visibility')}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Pricing & Nutrition Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Pricing & Nutrition</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Price */}
              <div>
                <Label htmlFor="price" className="mb-2 block">
                  Price ($) *
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  {...register('price', { valueAsNumber: true })}
                  placeholder="16.99"
                />
                {errors.price && (
                  <p className="text-sm text-red-600 mt-1">{errors.price.message}</p>
                )}
              </div>

              {/* Calories */}
              <div>
                <Label htmlFor="calories" className="mb-2 block">
                  Calories (Optional)
                </Label>
                <Input
                  id="calories"
                  type="number"
                  {...register('calories', { valueAsNumber: true })}
                  placeholder="350"
                />
                {errors.calories && (
                  <p className="text-sm text-red-600 mt-1">{errors.calories.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Serves */}
              <div>
                <Label htmlFor="serves" className="mb-2 block">
                  Serves (people)
                </Label>
                <Input
                  id="serves"
                  type="number"
                  min="1"
                  step="1"
                  {...register('serves', { valueAsNumber: true })}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Spice Level Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Spice Level</h3>

            <RadioGroup
              value={spiceLevel || 'none'}
              onValueChange={value =>
                setValue('spice_level', (value as 'none' | 'mild' | 'hot') || 'none')
              }
            >
              <div className="grid grid-cols-3 gap-2">
                {SPICE_LEVELS.map(level => (
                  <div key={level.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={level.value} id={`spice-${level.value}`} />
                    <Label
                      htmlFor={`spice-${level.value}`}
                      className="text-xs font-normal cursor-pointer flex flex-col items-center"
                    >
                      <span>{level.icon}</span>
                      <span>{level.label}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Ingredients Section - NEW AUTOCOMPLETE */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Ingredients</h3>
            <p className="text-xs text-gray-500">
              Search from our ingredient database. Allergens and dietary tags will auto-calculate.
            </p>

            <IngredientAutocomplete
              selectedIngredients={selectedIngredients}
              onIngredientsChange={setSelectedIngredients}
              placeholder="Search ingredients... (e.g., 'tomato', 'cheese')"
            />

            {/* Show calculated allergens */}
            {calculatedAllergens.length > 0 && <AllergenWarnings allergens={calculatedAllergens} />}

            {/* Show calculated dietary tags */}
            {calculatedDietaryTags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Auto-detected Dietary Tags:</Label>
                <DietaryTagBadges dietaryTags={calculatedDietaryTags} />
                <p className="text-xs text-gray-500">
                  These tags were calculated based on ingredients. You can add more tags below.
                </p>
              </div>
            )}

            {/* Ingredients Visibility */}
            <div>
              <Label className="mb-2 block">Show ingredients in app</Label>
              <div className="flex gap-3">
                {(
                  [
                    { value: 'menu', label: '📋 Menu list', hint: 'Shown in menu row' },
                    { value: 'detail', label: '🖼️ Dish detail', hint: 'Shown when tapped' },
                    { value: 'none', label: '🚫 Hidden', hint: 'Not shown to users' },
                  ] as const
                ).map(opt => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-2 cursor-pointer flex-1 rounded-lg border p-3 hover:bg-gray-50 has-checked:border-primary has-checked:bg-primary/5"
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      {...register('ingredients_visibility')}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Vegetarian/Vegan Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Vegetarian/Vegan</h3>

            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vegetarian"
                  checked={dietaryTags.includes('vegetarian')}
                  onCheckedChange={() => toggleDietaryTag('vegetarian')}
                />
                <Label htmlFor="vegetarian" className="text-sm font-normal cursor-pointer">
                  🥗 Vegetarian
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vegan"
                  checked={dietaryTags.includes('vegan')}
                  onCheckedChange={() => toggleDietaryTag('vegan')}
                />
                <Label htmlFor="vegan" className="text-sm font-normal cursor-pointer">
                  🌱 Vegan
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Allergens Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Allergens</h3>

            <div>
              <p className="text-xs text-gray-500 mb-2">Mark allergens present in this dish</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALLERGENS.map(allergen => (
                  <div key={allergen.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`allergen-${allergen.value}`}
                      checked={allergens.includes(allergen.value)}
                      onCheckedChange={() => toggleAllergen(allergen.value)}
                    />
                    <Label
                      htmlFor={`allergen-${allergen.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {allergen.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Dietary Tags Section */}
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Dietary Tags</Label>
              <p className="text-xs text-gray-500 mb-2">Select all that apply</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {DIETARY_TAGS.filter(
                  tag =>
                    tag.value !== 'vegetarian' &&
                    tag.value !== 'vegan' &&
                    !(RELIGIOUS_REQUIREMENTS as readonly string[]).includes(tag.value)
                ).map(tag => (
                  <div key={tag.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dietary-${tag.value}`}
                      checked={dietaryTags.includes(tag.value)}
                      onCheckedChange={() => toggleDietaryTag(tag.value)}
                    />
                    <Label
                      htmlFor={`dietary-${tag.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {tag.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Religious Requirements Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Religious Requirements</h3>

            <div>
              <p className="text-xs text-gray-500 mb-2">Select all that apply</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {RELIGIOUS_REQUIREMENTS.map(tag => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={`religious-${tag}`}
                      checked={dietaryTags.includes(tag)}
                      onCheckedChange={() => toggleDietaryTag(tag)}
                    />
                    <Label
                      htmlFor={`religious-${tag}`}
                      className="text-sm font-normal cursor-pointer capitalize"
                    >
                      {tag}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Media Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Media</h3>

            {/* Photo URL */}
            <div>
              <Label htmlFor="photo_url" className="mb-2 block">
                Photo URL (Optional)
              </Label>
              <Input
                id="photo_url"
                {...register('photo_url')}
                placeholder="https://example.com/photo.jpg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload photos to a service like Imgur or use your own URL
              </p>
            </div>
          </div>

          <Separator />

          {/* Dish Kind Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Dish Type</h3>
            <div className="grid grid-cols-3 gap-2">
              {DISH_KINDS.map(kind => (
                <label
                  key={kind.value}
                  className="flex flex-col gap-1 cursor-pointer rounded-lg border p-3 hover:bg-gray-50 has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    value={kind.value}
                    {...register('dish_kind')}
                    className="sr-only"
                  />
                  <span className="text-lg">{kind.icon}</span>
                  <span className="text-sm font-medium">{kind.label}</span>
                  <span className="text-xs text-gray-500">{kind.description}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Display Price Prefix — shown for all dish kinds */}
          {(dishKind === 'template' || dishKind === 'experience' || dishKind === 'combo' || dishKind === 'standard') && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Price Display</h3>
                <Select
                  value={(displayPricePrefix as string) ?? 'exact'}
                  onValueChange={val =>
                    setValue(
                      'display_price_prefix',
                      val as 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server'
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select price format" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_PRICE_PREFIXES.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="font-medium">{p.label}</span>
                        <span className="ml-2 text-xs text-gray-400">{p.example}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Option Groups Editor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Option Groups
                    {optionGroups.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {optionGroups.length}
                      </Badge>
                    )}
                  </h3>
                </div>

                {/* Preset picker — shown only when no groups yet */}
                {optionGroups.length === 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      Start from a preset or add groups manually:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(OPTION_PRESETS).map(([key, preset]) => (
                        <Button
                          key={key}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() =>
                            setOptionGroups(
                              preset.groups.map((g, i) => ({
                                name: g.name,
                                selection_type: g.selection_type,
                                min_selections: g.min_selections,
                                max_selections: g.max_selections,
                                display_order: i,
                                is_active: true,
                                options: [],
                              }))
                            )
                          }
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Groups list */}
                <div className="space-y-4">
                  {optionGroups.map((group, gi) => (
                    <div key={gi} className="rounded-lg border p-3 space-y-3 bg-gray-50">
                      {/* Group header */}
                      <div className="flex items-center gap-2">
                        <Input
                          value={group.name}
                          onChange={e =>
                            setOptionGroups(prev =>
                              prev.map((g, i) => (i === gi ? { ...g, name: e.target.value } : g))
                            )
                          }
                          placeholder="Group name (e.g. Protein)"
                          className="flex-1 text-sm h-8"
                        />
                        <Select
                          value={group.selection_type}
                          onValueChange={val =>
                            setOptionGroups(prev =>
                              prev.map((g, i) =>
                                i === gi
                                  ? {
                                      ...g,
                                      selection_type: val as 'single' | 'multiple' | 'quantity',
                                    }
                                  : g
                              )
                            )
                          }
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SELECTION_TYPES.map(st => (
                              <SelectItem key={st.value} value={st.value} className="text-xs">
                                {st.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Min/Max selections */}
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            value={group.min_selections ?? 0}
                            onChange={e =>
                              setOptionGroups(prev =>
                                prev.map((g, i) =>
                                  i === gi ? { ...g, min_selections: Number(e.target.value) } : g
                                )
                              )
                            }
                            className="w-12 h-8 text-xs text-center"
                            title="Min selections"
                          />
                          <span className="text-xs text-gray-400">–</span>
                          <Input
                            type="number"
                            min={1}
                            placeholder="∞"
                            value={group.max_selections ?? ''}
                            onChange={e =>
                              setOptionGroups(prev =>
                                prev.map((g, i) =>
                                  i === gi
                                    ? {
                                        ...g,
                                        max_selections: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      }
                                    : g
                                )
                              )
                            }
                            className="w-12 h-8 text-xs text-center"
                            title="Max selections (blank = unlimited)"
                          />
                        </div>
                        {/* Reorder */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={gi === 0}
                          onClick={() =>
                            setOptionGroups(prev => {
                              const next = [...prev];
                              [next[gi - 1], next[gi]] = [next[gi], next[gi - 1]];
                              return next;
                            })
                          }
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={gi === optionGroups.length - 1}
                          onClick={() =>
                            setOptionGroups(prev => {
                              const next = [...prev];
                              [next[gi], next[gi + 1]] = [next[gi + 1], next[gi]];
                              return next;
                            })
                          }
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => setOptionGroups(prev => prev.filter((_, i) => i !== gi))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Options list */}
                      <div className="space-y-2 pl-2">
                        {group.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <Input
                              value={opt.name}
                              onChange={e =>
                                setOptionGroups(prev =>
                                  prev.map((g, i) =>
                                    i === gi
                                      ? {
                                          ...g,
                                          options: g.options.map((o, j) =>
                                            j === oi ? { ...o, name: e.target.value } : o
                                          ),
                                        }
                                      : g
                                  )
                                )
                              }
                              placeholder="Option name"
                              className="flex-1 h-7 text-xs"
                            />
                            <span className="text-xs text-gray-400">+$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={opt.price_delta}
                              onChange={e =>
                                setOptionGroups(prev =>
                                  prev.map((g, i) =>
                                    i === gi
                                      ? {
                                          ...g,
                                          options: g.options.map((o, j) =>
                                            j === oi
                                              ? { ...o, price_delta: Number(e.target.value) }
                                              : o
                                          ),
                                        }
                                      : g
                                  )
                                )
                              }
                              className="w-16 h-7 text-xs text-right"
                              title="Price delta (+ or -)"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-600"
                              onClick={() =>
                                setOptionGroups(prev =>
                                  prev.map((g, i) =>
                                    i === gi
                                      ? { ...g, options: g.options.filter((_, j) => j !== oi) }
                                      : g
                                  )
                                )
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {/* Add option */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 w-full"
                          onClick={() =>
                            setOptionGroups(prev =>
                              prev.map((g, i) =>
                                i === gi
                                  ? {
                                      ...g,
                                      options: [
                                        ...g.options,
                                        {
                                          name: '',
                                          price_delta: 0,
                                          is_available: true,
                                          display_order: g.options.length,
                                        },
                                      ],
                                    }
                                  : g
                              )
                            )
                          }
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add option
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Add group */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setOptionGroups(prev => [
                        ...prev,
                        {
                          name: '',
                          selection_type: 'single',
                          min_selections: 1,
                          max_selections: 1,
                          display_order: prev.length,
                          is_active: true,
                          options: [],
                        },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add option group
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">{dish ? 'Update Dish' : 'Add Dish'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

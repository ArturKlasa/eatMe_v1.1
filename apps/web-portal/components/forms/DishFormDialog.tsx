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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dish } from '@/types/restaurant';
import { dishSchema, type DishFormData } from '@/lib/validation';
import { DIETARY_TAGS, ALLERGENS, SPICE_LEVELS, RELIGIOUS_REQUIREMENTS } from '@/lib/constants';
import { IngredientAutocomplete } from '@/components/IngredientAutocomplete';
import { AllergenWarnings } from '@/components/AllergenWarnings';
import { DietaryTagBadges } from '@/components/DietaryTagBadges';
import type { Ingredient, Allergen, DietaryTag } from '@/lib/ingredients';
import { fetchDishCategories, type DishCategory } from '@/lib/dish-categories';
import { getCuisineCategories } from '@/lib/cuisine-categories';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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
      ingredients: [] as string[],
      spice_level: 0,
      photo_url: '',
      is_available: true,
      dish_category_id: null,
      description_visibility: 'menu' as const,
      ingredients_visibility: 'detail' as const,
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
        ingredients: dish.ingredients || [],
        spice_level: dish.spice_level || 0,
        photo_url: dish.photo_url || '',
        is_available: dish.is_available !== false,
        dish_category_id: dish.dish_category_id ?? null,
        description_visibility: (dish as any).description_visibility ?? 'menu',
        ingredients_visibility: (dish as any).ingredients_visibility ?? 'detail',
      });

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
              const loaded = data.map((row: any) => {
                const alias = row.canonical_ingredient?.ingredient_aliases?.[0];
                return {
                  id: alias?.id ?? row.ingredient_id,
                  display_name:
                    alias?.display_name ?? row.canonical_ingredient?.canonical_name ?? '',
                  canonical_ingredient_id: row.ingredient_id,
                  canonical_name: row.canonical_ingredient?.canonical_name,
                  ingredient_family_name: row.canonical_ingredient?.ingredient_family_name,
                  is_vegetarian: row.canonical_ingredient?.is_vegetarian,
                  is_vegan: row.canonical_ingredient?.is_vegan,
                  quantity: row.quantity ?? undefined,
                } as Ingredient;
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
        ingredients: [],
        spice_level: 0,
        photo_url: '',
        is_available: true,
        dish_category_id: null,
        description_visibility: 'menu',
        ingredients_visibility: 'detail',
      });
      setSelectedIngredients([]);
    }
  }, [dish, isOpen, reset]);

  const dietaryTags = useWatch({ control, name: 'dietary_tags', defaultValue: [] }) || [];
  const allergens = useWatch({ control, name: 'allergens', defaultValue: [] }) || [];
  const spiceLevel = useWatch({ control, name: 'spice_level', defaultValue: 0 });
  const dishCategoryId = useWatch({ control, name: 'dish_category_id', defaultValue: null });

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
        ingredients: data.ingredients || [],
        spice_level: !isNaN(data.spice_level as number) ? data.spice_level : undefined,
        photo_url: data.photo_url,
        is_available: data.is_available !== false,
        dish_category_id: data.dish_category_id ?? null,
        description_visibility: data.description_visibility ?? 'menu',
        ingredients_visibility: data.ingredients_visibility ?? 'detail',
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
        spice_level:
          !isNaN(data.spice_level as number) && data.spice_level != null ? data.spice_level : null,
        description_visibility: data.description_visibility ?? 'menu',
        ingredients_visibility: data.ingredients_visibility ?? 'detail',
      };

      let dishId: string;

      if (dish?.id) {
        const { error } = await supabase.from('dishes').update(dishData).eq('id', dish.id);
        if (error) throw error;
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

      reset();
      setSelectedIngredients([]);
      setCalculatedAllergens([]);
      setCalculatedDietaryTags([]);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[DishForm] Error saving dish:', error);
      toast.error('Failed to save dish: ' + error.message);
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
          </div>

          <Separator />

          {/* Spice Level Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Spice Level</h3>

            <RadioGroup
              value={spiceLevel?.toString() || '0'}
              onValueChange={value => setValue('spice_level', value ? parseInt(value) : 0)}
            >
              <div className="grid grid-cols-2 gap-2">
                {SPICE_LEVELS.map(level => (
                  <div key={level.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={level.value.toString()} id={`spice-${level.value}`} />
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

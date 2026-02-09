'use client';

import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Dish } from '@/types/restaurant';
import { dishSchema, type DishFormData } from '@/lib/validation';
import { DIETARY_TAGS, ALLERGENS, SPICE_LEVELS, RELIGIOUS_REQUIREMENTS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { IngredientAutocomplete } from '@/components/IngredientAutocomplete';
import { AllergenWarnings } from '@/components/AllergenWarnings';
import { DietaryTagBadges } from '@/components/DietaryTagBadges';
import type { Ingredient, Allergen, DietaryTag } from '@/lib/ingredients';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface DishFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  menuCategoryId: string;
  dish?: Dish | null;
  onSuccess?: () => void;
}

export function DishFormDialog({
  isOpen,
  onClose,
  restaurantId,
  menuCategoryId,
  dish,
  onSuccess,
}: DishFormDialogProps) {
  // State for new ingredients system
  const [selectedIngredients, setSelectedIngredients] = useState<
    (Ingredient & { quantity?: string })[]
  >([]);
  const [calculatedAllergens, setCalculatedAllergens] = useState<Allergen[]>([]);
  const [calculatedDietaryTags, setCalculatedDietaryTags] = useState<DietaryTag[]>([]);

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
      price: 0,
      calories: undefined,
      dietary_tags: [],
      allergens: [],
      ingredients: [],
      spice_level: 0,
      photo_url: '',
      is_available: true,
    },
  });

  // Reset form when dish changes (for edit mode)
  useEffect(() => {
    if (dish && isOpen) {
      reset({
        name: dish.name || '',
        price: dish.price || 0,
        calories: dish.calories || undefined,
        dietary_tags: dish.dietary_tags || [],
        allergens: dish.allergens || [],
        ingredients: dish.ingredients || [],
        spice_level: dish.spice_level || 0,
        photo_url: dish.photo_url || '',
        is_available: dish.is_available !== false,
      });
      // TODO: Also populate selectedIngredients if we have ingredient data
    } else if (!dish && isOpen) {
      // Reset to empty form when adding new dish
      reset({
        name: '',
        price: 0,
        calories: undefined,
        dietary_tags: [],
        allergens: [],
        ingredients: [],
        spice_level: 0,
        photo_url: '',
        is_available: true,
      });
      setSelectedIngredients([]);
    }
  }, [dish, isOpen, reset]);

  // Use useWatch instead of watch for better React Compiler compatibility
  const dietaryTags = useWatch({ control, name: 'dietary_tags', defaultValue: [] }) || [];
  const allergens = useWatch({ control, name: 'allergens', defaultValue: [] }) || [];
  const ingredients = useWatch({ control, name: 'ingredients', defaultValue: [] }) || [];
  const spiceLevel = useWatch({ control, name: 'spice_level', defaultValue: 0 });

  const handleFormSubmit = async (data: DishFormData) => {
    try {
      const dishData = {
        restaurant_id: restaurantId,
        menu_category_id: menuCategoryId,
        name: data.name,
        description: data.description,
        price: data.price,
        is_available: true,
        display_order: 0,
        image_url: data.image_url,
      };

      if (dish?.id) {
        // Update existing dish
        const { error } = await supabase.from('dishes').update(dishData).eq('id', dish.id);

        if (error) throw error;
        toast.success('Dish updated successfully');
      } else {
        // Create new dish
        const { error } = await supabase.from('dishes').insert(dishData);

        if (error) throw error;
        toast.success('Dish added successfully');
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

  const handleIngredientsChange = (value: string) => {
    const ingredients = value
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);
    setValue('ingredients', ingredients);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dish ? 'Edit Dish' : 'Add New Dish'}</DialogTitle>
          <p className="text-sm text-gray-500">Information will be visible to customers</p>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Basic Information</h3>

            {/* Name */}
            <div>
              <Label htmlFor="name" className="mb-2 block">
                Dish Name *
              </Label>
              <Input id="name" {...register('name')} placeholder="e.g., Margherita Pizza" />
              {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
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

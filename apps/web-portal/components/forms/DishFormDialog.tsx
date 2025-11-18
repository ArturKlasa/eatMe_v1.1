'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dish } from '@/types/restaurant';
import { dishSchema, type DishFormData } from '@/lib/validation';
import { DIETARY_TAGS, ALLERGENS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

interface DishFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dish: Dish) => void;
  dish?: Dish | null;
}

export function DishFormDialog({ isOpen, onClose, onSubmit, dish }: DishFormDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    reset,
  } = useForm<DishFormData>({
    resolver: zodResolver(dishSchema),
    defaultValues: dish || {
      name: '',
      description: '',
      price: 0,
      dietary_tags: [],
      allergens: [],
      ingredients: [],
      photo_url: '',
    },
  });

  // Use useWatch instead of watch for better React Compiler compatibility
  const dietaryTags = useWatch({ control, name: 'dietary_tags', defaultValue: [] }) || [];
  const allergens = useWatch({ control, name: 'allergens', defaultValue: [] }) || [];
  const ingredients = useWatch({ control, name: 'ingredients', defaultValue: [] }) || [];

  const handleFormSubmit = (data: DishFormData) => {
    onSubmit({
      ...data,
      id: dish?.id,
    });
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleDietaryTag = (tag: string) => {
    const current = dietaryTags;
    if (current.includes(tag)) {
      setValue(
        'dietary_tags',
        current.filter(t => t !== tag)
      );
    } else {
      setValue('dietary_tags', [...current, tag]);
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
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Name */}
          <div>
            <Label htmlFor="name">Dish Name *</Label>
            <Input id="name" {...register('name')} placeholder="e.g., Margherita Pizza" />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Describe the dish, its ingredients, and what makes it special..."
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Price */}
          <div>
            <Label htmlFor="price">Price ($) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              {...register('price', { valueAsNumber: true })}
              placeholder="16.99"
            />
            {errors.price && <p className="text-sm text-red-600 mt-1">{errors.price.message}</p>}
          </div>

          {/* Ingredients */}
          <div>
            <Label htmlFor="ingredients">Ingredients (comma-separated) *</Label>
            <Input
              id="ingredients"
              defaultValue={dish?.ingredients.join(', ') || ''}
              onChange={e => handleIngredientsChange(e.target.value)}
              placeholder="tomato, mozzarella, basil, olive oil, flour"
            />
            {ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ingredients.map((ing, idx) => (
                  <Badge key={idx} variant="secondary">
                    {ing}
                  </Badge>
                ))}
              </div>
            )}
            {errors.ingredients && (
              <p className="text-sm text-red-600 mt-1">{errors.ingredients.message}</p>
            )}
          </div>

          {/* Dietary Tags */}
          <div>
            <Label>Dietary Tags</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {DIETARY_TAGS.map(tag => (
                <div key={tag} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dietary-${tag}`}
                    checked={dietaryTags.includes(tag)}
                    onCheckedChange={() => toggleDietaryTag(tag)}
                  />
                  <Label htmlFor={`dietary-${tag}`} className="text-sm font-normal cursor-pointer">
                    {tag}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div>
            <Label>Allergens</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {ALLERGENS.map(allergen => (
                <div key={allergen} className="flex items-center space-x-2">
                  <Checkbox
                    id={`allergen-${allergen}`}
                    checked={allergens.includes(allergen)}
                    onCheckedChange={() => toggleAllergen(allergen)}
                  />
                  <Label
                    htmlFor={`allergen-${allergen}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {allergen}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <Label htmlFor="photo_url">Photo URL (optional)</Label>
            <Input
              id="photo_url"
              {...register('photo_url')}
              placeholder="https://example.com/photo.jpg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Upload photos to a service like Imgur or use your own URL
            </p>
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

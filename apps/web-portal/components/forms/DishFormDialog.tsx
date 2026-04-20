'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { UtensilsCrossed, GlassWater } from 'lucide-react';
import type { Dish } from '@eatme/shared';
import { dishSchema, type DishFormData } from '@eatme/shared';
import { useDishFormData } from '@/lib/hooks/useDishFormData';

import { DishBasicFields } from './dish/DishBasicFields';
import { DishCategorySelect } from './dish/DishCategorySelect';
import { DishSpiceLevel } from './dish/DishSpiceLevel';
import { DishDietarySection } from './dish/DishDietarySection';
import { DishIngredientSection } from './dish/DishIngredientSection';
import { DishKindSelector } from './dish/DishKindSelector';
import { DishVariantsSection } from './dish/DishVariantsSection';
import { DishOptionsSection } from './dish/DishOptionsSection';
import { DishVisibilityFields } from './dish/DishVisibilityFields';
import { DishPhotoField } from './dish/DishPhotoField';
import { DishPrimaryProteinSelect } from './dish/DishPrimaryProteinSelect';
import { DishPrimaryProteinBanner } from './dish/DishPrimaryProteinBanner';
import { ingredientEntryEnabled } from '@/lib/featureFlags';

// The component supports two modes:
//   Wizard mode – onSubmit is provided; data stays in local state, no Supabase write.
//   DB mode    – restaurantId + menuCategoryId are provided; writes directly to Supabase.
interface DishFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dish?: (Partial<Dish> & { id?: string }) | null;
  menuType?: 'food' | 'drink';
  restaurantCuisine?: string;
  restaurantId?: string;
  menuCategoryId?: string;
  onSuccess?: () => void;
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
  const methods = useForm<DishFormData>({
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
      is_parent: false,
      variants: [],
      option_groups: [],
      primary_protein: null,
    },
  });

  const {
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
  } = useDishFormData({
    dish,
    isOpen,
    menuType,
    restaurantId,
    menuCategoryId,
    methods,
    onWizardSubmit,
    onSuccess,
    onClose,
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dish ? 'Edit Dish' : 'Add New Dish'}</DialogTitle>
          <p className="text-sm text-muted-foreground">Information will be visible to customers</p>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Food/Drink Toggle */}
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
              <span className="text-sm font-medium text-foreground mr-2">Type:</span>
              <Button
                type="button"
                variant={dishType === 'food' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDishType('food')}
                className="flex-1"
              >
                <UtensilsCrossed className="h-4 w-4 mr-1 inline-block" />
                Food
              </Button>
              <Button
                type="button"
                variant={dishType === 'drink' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDishType('drink')}
                className="flex-1"
              >
                <GlassWater className="h-4 w-4 mr-1 inline-block" />
                Drink
              </Button>
            </div>

            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
              <DishCategorySelect dishType={dishType} restaurantCuisine={restaurantCuisine} />
              <DishBasicFields />
              <DishVisibilityFields />
            </div>

            <Separator />

            <DishSpiceLevel />

            <Separator />

            <DishPrimaryProteinSelect />
            <DishPrimaryProteinBanner />

            {ingredientEntryEnabled() && (
              <>
                <Separator />
                <DishIngredientSection
                  ingredients={selectedIngredients}
                  onIngredientsChange={setSelectedIngredients}
                  calculatedAllergens={calculatedAllergens}
                  calculatedDietaryTags={calculatedDietaryTags}
                />
              </>
            )}

            <Separator />

            <DishDietarySection />

            <Separator />

            <DishPhotoField />

            <Separator />

            <DishKindSelector />

            <DishVariantsSection />

            <DishOptionsSection
              optionGroups={optionGroups}
              onOptionGroupsChange={setOptionGroups}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit">{dish ? 'Update Dish' : 'Add Dish'}</Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { IngredientAutocomplete } from '@/components/IngredientAutocomplete';
import { AllergenWarnings } from '@/components/AllergenWarnings';
import { DietaryTagBadges } from '@/components/DietaryTagBadges';
import type { Ingredient, Allergen, DietaryTag } from '@/lib/ingredients';
import type { DishFormData } from '@/lib/validation';

interface DishIngredientSectionProps {
  ingredients: Ingredient[];
  onIngredientsChange: (ingredients: Ingredient[]) => void;
  calculatedAllergens: Allergen[];
  calculatedDietaryTags: DietaryTag[];
}

export function DishIngredientSection({
  ingredients,
  onIngredientsChange,
  calculatedAllergens,
  calculatedDietaryTags,
}: DishIngredientSectionProps) {
  const { register } = useFormContext<DishFormData>();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Ingredients</h3>
      <p className="text-xs text-muted-foreground">
        Search from our ingredient database. Allergens and dietary tags will auto-calculate.
      </p>

      <IngredientAutocomplete
        selectedIngredients={ingredients}
        onIngredientsChange={onIngredientsChange}
        placeholder="Search ingredients... (e.g., 'tomato', 'cheese')"
      />

      {calculatedAllergens.length > 0 && <AllergenWarnings allergens={calculatedAllergens} />}

      {calculatedDietaryTags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Auto-detected Dietary Tags:</Label>
          <DietaryTagBadges dietaryTags={calculatedDietaryTags} />
          <p className="text-xs text-muted-foreground">
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
              className="flex items-start gap-2 cursor-pointer flex-1 rounded-lg border p-3 hover:bg-accent has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                value={opt.value}
                {...register('ingredients_visibility')}
                className="mt-0.5 accent-primary"
              />
              <div>
                <span className="text-sm font-medium">{opt.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

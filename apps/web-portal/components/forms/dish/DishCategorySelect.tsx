'use client';

import { useState, useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GlassWater, UtensilsCrossed } from 'lucide-react';
import { fetchDishCategories, type DishCategory } from '@/lib/dish-categories';
import { getCuisineCategories } from '@/lib/cuisine-categories';
import type { DishFormData } from '@/lib/validation';

interface DishCategorySelectProps {
  dishType: 'food' | 'drink';
  restaurantCuisine?: string;
}

export function DishCategorySelect({ dishType, restaurantCuisine }: DishCategorySelectProps) {
  const {
    setValue,
    control,
    formState: { errors },
  } = useFormContext<DishFormData>();

  const dishCategoryId = useWatch({ control, name: 'dish_category_id', defaultValue: null });

  const [dishCategories, setDishCategories] = useState<DishCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingCategories(true);
      const { data, error } = await fetchDishCategories();
      if (!error) setDishCategories(data);
      setLoadingCategories(false);
    };
    load();
  }, []);

  const foodCategories = dishCategories.filter(c => !c.is_drink);
  const drinkCategories = dishCategories.filter(c => c.is_drink);

  return (
    <div>
      <Label htmlFor="dish_category_id" className="mb-2 block">
        Dish Category *
        <span className="ml-1 text-xs font-normal text-gray-500">
          (Helps customers find similar dishes)
        </span>
      </Label>

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
                <UtensilsCrossed className="h-3 w-3 inline-block mr-0.5" />Food
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
                <GlassWater className="h-3 w-3 inline-block mr-0.5" />Drinks
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
  );
}

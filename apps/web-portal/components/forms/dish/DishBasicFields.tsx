'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DishFormData } from '@eatme/shared';

export function DishBasicFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<DishFormData>();

  return (
    <>
      {/* Name */}
      <div>
        <Label htmlFor="name" className="mb-2 block">
          Dish Name *
        </Label>
        <Input id="name" {...register('name')} placeholder="e.g., Margherita Pizza" />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description" className="mb-2 block">
          Description <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="e.g., Crispy thin-crust pizza with fresh mozzarella and basil"
          rows={3}
          className="resize-none"
        />
        {errors.description && (
          <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
        )}
      </div>

      {/* Price & Calories */}
      <div className="grid grid-cols-2 gap-4">
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
          {errors.price && <p className="text-sm text-destructive mt-1">{errors.price.message}</p>}
        </div>

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
            <p className="text-sm text-destructive mt-1">{errors.calories.message}</p>
          )}
        </div>
      </div>

      {/* Serves */}
      <div className="grid grid-cols-2 gap-4">
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
    </>
  );
}

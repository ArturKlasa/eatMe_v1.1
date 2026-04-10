'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import type { DishFormData } from '@/lib/validation';

export function DishVisibilityFields() {
  const { register } = useFormContext<DishFormData>();

  return (
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
  );
}

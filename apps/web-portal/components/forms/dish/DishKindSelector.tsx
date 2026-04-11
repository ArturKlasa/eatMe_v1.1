'use client';

import { useFormContext } from 'react-hook-form';
import { DISH_KINDS } from '@/lib/constants';
import type { DishFormData } from '@/lib/validation';

export function DishKindSelector() {
  const { register } = useFormContext<DishFormData>();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Dish Type</h3>
      <div className="grid grid-cols-3 gap-2">
        {DISH_KINDS.map(kind => (
          <label
            key={kind.value}
            className="flex flex-col gap-1 cursor-pointer rounded-lg border p-3 hover:bg-accent has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="radio"
              value={kind.value}
              {...register('dish_kind')}
              className="sr-only"
            />
            <span className="text-lg">{kind.icon}</span>
            <span className="text-sm font-medium">{kind.label}</span>
            <span className="text-xs text-muted-foreground">{kind.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

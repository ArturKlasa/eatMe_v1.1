'use client';

import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import type { DishFormData } from '@eatme/shared';
import { DISPLAY_PRICE_PREFIXES } from '@eatme/shared';

/**
 * Edits the variants[] array under a parent dish (template/combo/experience/size).
 * Visible only when dish_kind != 'standard' OR serves > 1 — matches the conditions
 * under which the extraction pipeline produces parents. An admin can still uncheck
 * is_parent to flatten back to a standalone dish.
 */
export function DishVariantsSection() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<DishFormData>();
  const dishKind = useWatch({ control, name: 'dish_kind' });
  const serves = useWatch({ control, name: 'serves' });
  const isParent = useWatch({ control, name: 'is_parent' }) ?? false;

  const shouldOffer = dishKind !== 'standard' || (serves ?? 1) > 1;

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  if (!shouldOffer) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Variants</h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={isParent}
            onChange={e => {
              const next = e.target.checked;
              setValue('is_parent', next, { shouldDirty: true });
              if (!next) setValue('variants', [], { shouldDirty: true });
            }}
          />
          This dish has variants
        </label>
      </div>

      {isParent && (
        <>
          <p className="text-xs text-muted-foreground">
            Each variant becomes its own dish with the parent&apos;s name prepended. Parent price is
            ignored; customers see &quot;from $X&quot; based on the cheapest variant.
          </p>

          <div className="space-y-2">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_6rem_5rem_6rem_auto] gap-2 items-start rounded border bg-muted/20 p-2"
              >
                <div>
                  <Label htmlFor={`variants.${index}.name`} className="text-xs">
                    Name *
                  </Label>
                  <Input
                    id={`variants.${index}.name`}
                    {...register(`variants.${index}.name`)}
                    placeholder="Small / Salmon / 2-person"
                  />
                  {errors.variants?.[index]?.name && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.variants[index]?.name?.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`variants.${index}.price`} className="text-xs">
                    Price *
                  </Label>
                  <Input
                    id={`variants.${index}.price`}
                    type="number"
                    step="0.01"
                    min={0}
                    {...register(`variants.${index}.price`, { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label htmlFor={`variants.${index}.serves`} className="text-xs">
                    Serves
                  </Label>
                  <Input
                    id={`variants.${index}.serves`}
                    type="number"
                    min={1}
                    {...register(`variants.${index}.serves`, { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label htmlFor={`variants.${index}.display_price_prefix`} className="text-xs">
                    Prefix
                  </Label>
                  <select
                    id={`variants.${index}.display_price_prefix`}
                    {...register(`variants.${index}.display_price_prefix`)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    {DISPLAY_PRICE_PREFIXES.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-5"
                  onClick={() => remove(index)}
                  aria-label="Remove variant"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                name: '',
                price: 0,
                description: '',
                serves: 1,
                display_price_prefix: 'exact',
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add variant
          </Button>
        </>
      )}
    </div>
  );
}

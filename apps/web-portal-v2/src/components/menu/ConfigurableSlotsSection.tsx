'use client';

import { useFieldArray, type Control, type UseFormRegister } from 'react-hook-form';
import { SELECTION_TYPES } from '@eatme/shared';
import type { DishFormValues } from './DishForm';

interface ConfigurableSlotsSectionProps {
  control: Control<DishFormValues>;
  register: UseFormRegister<DishFormValues>;
}

export function ConfigurableSlotsSection({ control, register }: ConfigurableSlotsSectionProps) {
  const {
    fields: slots,
    append: appendSlot,
    remove: removeSlot,
  } = useFieldArray({
    control,
    name: 'slots',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Configuration slots</h3>
        <button
          type="button"
          onClick={() =>
            appendSlot({
              name: '',
              selection_type: 'single',
              min_selections: 0,
              max_selections: null,
              options: [],
            })
          }
          className="text-xs text-primary hover:underline"
        >
          + Add slot
        </button>
      </div>
      {slots.map((slot, slotIdx) => (
        <SlotCard
          key={slot.id}
          slotIdx={slotIdx}
          control={control}
          register={register}
          onRemove={() => removeSlot(slotIdx)}
        />
      ))}
      {slots.length === 0 && (
        <p className="text-xs text-muted-foreground">No slots yet. Add a slot to get started.</p>
      )}
    </div>
  );
}

function SlotCard({
  slotIdx,
  control,
  register,
  onRemove,
}: {
  slotIdx: number;
  control: Control<DishFormValues>;
  register: UseFormRegister<DishFormValues>;
  onRemove: () => void;
}) {
  const {
    fields: options,
    append: appendOpt,
    remove: removeOpt,
  } = useFieldArray({
    control,
    name: `slots.${slotIdx}.options`,
  });

  return (
    <div className="border border-border rounded-md p-3 space-y-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <input
          {...register(`slots.${slotIdx}.name`)}
          placeholder="Slot name (e.g. Size, Sauce)"
          className="flex-1 h-8 rounded border border-border px-2 text-sm"
        />
        <select
          {...register(`slots.${slotIdx}.selection_type`)}
          className="h-8 rounded border border-border px-2 text-sm"
        >
          {SELECTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-destructive text-xs hover:underline"
        >
          Remove
        </button>
      </div>
      <div className="space-y-2 pl-2">
        {options.map((opt, optIdx) => (
          <div key={opt.id} className="flex gap-2 items-center">
            <input
              {...register(`slots.${slotIdx}.options.${optIdx}.name`)}
              placeholder="Option name"
              className="flex-1 h-7 rounded border border-border px-2 text-xs"
            />
            <input
              {...register(`slots.${slotIdx}.options.${optIdx}.price_delta`, {
                valueAsNumber: true,
              })}
              type="number"
              placeholder="+price"
              step="0.01"
              className="w-20 h-7 rounded border border-border px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => removeOpt(optIdx)}
              className="text-destructive text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendOpt({ name: '', price_delta: 0 })}
          className="text-xs text-primary hover:underline"
        >
          + Add option
        </button>
      </div>
    </div>
  );
}

'use client';

import { useFormContext } from 'react-hook-form';
import type { DishFormValues } from './DishForm';

export function BundleItemsSection() {
  const { watch, setValue } = useFormContext<DishFormValues>();
  const bundleItems: string[] = watch('bundle_items') ?? [];

  function addItem() {
    setValue('bundle_items', [...bundleItems, '']);
  }

  function removeItem(idx: number) {
    setValue(
      'bundle_items',
      bundleItems.filter((_, i) => i !== idx)
    );
  }

  function updateItem(idx: number, value: string) {
    const next = [...bundleItems];
    next[idx] = value;
    setValue('bundle_items', next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Bundle items (dish IDs)</h3>
        <button type="button" onClick={addItem} className="text-xs text-primary hover:underline">
          + Add item
        </button>
      </div>
      {bundleItems.map((item, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            value={item}
            onChange={e => updateItem(idx, e.target.value)}
            placeholder="Dish UUID"
            className="flex-1 h-8 rounded border border-border px-2 text-sm"
          />
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="text-destructive text-xs hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      {bundleItems.length === 0 && (
        <p className="text-xs text-muted-foreground">No bundle items yet.</p>
      )}
    </div>
  );
}

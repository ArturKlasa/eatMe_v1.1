'use client';

import { Plus, X } from 'lucide-react';
import type { EditableDish } from '@/lib/menu-scan';
import { useReviewStore } from '../store';

export interface VariantEditorProps {
  mIdx: number;
  cIdx: number;
  parentDish: EditableDish;
  currency: string;
}

export function VariantEditor({ mIdx, cIdx, parentDish, currency }: VariantEditorProps) {
  const editableMenus = useReviewStore(s => s.editableMenus);
  const addVariantDish = useReviewStore(s => s.addVariantDish);
  const updateDish = useReviewStore(s => s.updateDish);
  const deleteDish = useReviewStore(s => s.deleteDish);

  const category = editableMenus[mIdx]?.categories[cIdx];
  if (!category) return null;

  const variants = category.dishes
    .map((d, dIdx) => ({ dish: d, dIdx }))
    .filter(({ dish }) => dish.parent_id === parentDish._id);

  return (
    <div
      className="mt-2 border border-dashed border-info/30 rounded-lg p-2 space-y-2"
      data-testid="variant-editor"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-info font-medium">Variants ({variants.length})</p>
        <button
          type="button"
          onClick={() => addVariantDish(mIdx, cIdx, parentDish._id)}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-info/30 text-info bg-info/5 hover:bg-info/10 transition-colors"
          data-testid="add-variant-btn"
        >
          <Plus className="h-3 w-3" />
          Add variant
        </button>
      </div>

      {variants.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          No variants yet. Click &quot;Add variant&quot; to create child dishes.
        </p>
      )}

      {variants.map(({ dish, dIdx }) => (
        <div key={dish._id} className="flex items-center gap-2">
          <input
            value={dish.name}
            onChange={e => updateDish(mIdx, cIdx, dIdx, { name: e.target.value })}
            placeholder="Variant name"
            className="flex-1 text-xs border border-input rounded px-2 py-1 focus:outline-none focus:border-brand-primary/70"
            data-testid="variant-name-input"
          />
          <span className="text-xs text-muted-foreground shrink-0">{currency}</span>
          <input
            type="number"
            value={dish.price}
            onChange={e => updateDish(mIdx, cIdx, dIdx, { price: e.target.value })}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-20 text-xs text-right border border-input rounded px-2 py-1 focus:outline-none focus:border-brand-primary/70"
            data-testid="variant-price-input"
          />
          <button
            type="button"
            onClick={() => deleteDish(mIdx, cIdx, dIdx)}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove variant"
            data-testid="delete-variant-btn"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

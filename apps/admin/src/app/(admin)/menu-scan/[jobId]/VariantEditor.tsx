'use client';

import { DISH_KIND_META } from '@eatme/shared';
import type { EditableDish } from './useReviewState';

interface Props {
  parent: EditableDish;
  variants: EditableDish[];
  saving: boolean;
  onAddVariant: () => void;
  onRemoveVariant: (variantId: string) => void;
  onUpdateVariant: (id: string, patch: Partial<EditableDish>) => void;
}

export function VariantEditor({
  parent,
  variants,
  saving,
  onAddVariant,
  onRemoveVariant,
  onUpdateVariant,
}: Props) {
  const active = variants.filter(v => !v._deleted);
  const parentLabel = DISH_KIND_META[parent.dish_kind].label;

  return (
    <div className="rounded border border-dashed border-blue-200 bg-blue-50/40 p-2 space-y-2 dark:border-blue-900/40 dark:bg-blue-950/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
          Variants ({active.length})
        </span>
        <button
          type="button"
          onClick={onAddVariant}
          disabled={saving}
          className="rounded border border-blue-300 bg-background px-2 py-0.5 text-xs hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900/40 disabled:opacity-50"
        >
          + Add variant
        </button>
      </div>

      {active.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">
          No variants yet. Add at least one variant for this {parentLabel}.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {active.map(v => (
            <li key={v._id} className="flex items-center gap-2">
              <input
                aria-label="Variant name"
                value={v.name}
                onChange={e => onUpdateVariant(v._id, { name: e.target.value })}
                disabled={saving}
                placeholder="Variant name"
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
              />
              <input
                aria-label="Variant price"
                type="number"
                step="0.01"
                min="0"
                value={v.price ?? ''}
                onChange={e =>
                  onUpdateVariant(v._id, {
                    price: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                disabled={saving}
                placeholder="—"
                className="w-24 rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => onRemoveVariant(v._id)}
                disabled={saving}
                aria-label="Remove variant"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

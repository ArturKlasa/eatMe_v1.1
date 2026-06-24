'use client';

import { type EditableDish } from '../useReviewState';

interface BundledBlockProps {
  dish: EditableDish;
  saving: boolean;
  onAdd: () => void;
  onRemove: (itemIdx: number) => void;
  onUpdate: (itemIdx: number, patch: Partial<{ name: string; note: string | null }>) => void;
}

export function BundledItemsBlock({ dish, saving, onAdd, onRemove, onUpdate }: BundledBlockProps) {
  if (dish._deleted) return null;
  const hasItems = dish.bundled_items.length > 0;
  return (
    <div className="rounded border border-dashed border-emerald-200 bg-emerald-50/40 p-2 space-y-1.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
          Bundled items ({dish.bundled_items.length})
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={saving}
          className="rounded border border-emerald-300 bg-background px-2 py-0.5 text-xs hover:bg-emerald-100 dark:border-emerald-800 dark:hover:bg-emerald-900/40 disabled:opacity-50"
        >
          + Add item
        </button>
      </div>
      {!hasItems ? (
        <p className="text-[11px] italic text-muted-foreground">
          Use for set menus / combos: list the included items (e.g. &ldquo;Soup of the day&rdquo;,
          &ldquo;Side salad&rdquo;, &ldquo;Drink&rdquo;).
        </p>
      ) : (
        <ul className="space-y-1">
          {dish.bundled_items.map((b, idx) => (
            <li key={b._id} className="flex items-center gap-1.5">
              <input
                aria-label="Bundled item name"
                value={b.name}
                onChange={e => onUpdate(idx, { name: e.target.value })}
                disabled={saving}
                placeholder="Item name"
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
              />
              <input
                aria-label="Note"
                value={b.note ?? ''}
                onChange={e => onUpdate(idx, { note: e.target.value || null })}
                disabled={saving}
                placeholder="Note (optional)"
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => onRemove(idx)}
                disabled={saving}
                aria-label="Remove bundled item"
                className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
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

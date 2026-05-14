'use client';

import { useEffect, useState } from 'react';
import type { DishCategoryOption } from '@/lib/auth/dal';
import { adminCreateDishCategory } from '@/app/(admin)/menu-scan/actions/dishCategory';

type Props = {
  // Pre-fills the name input. Used in menu-scan to surface the AI's
  // free-text suggestion (`suggested_dish_category`). Restaurant view passes
  // nothing.
  initialName?: string;
  disabled?: boolean;
  // Called with the freshly created (or already-existing, idempotent) row so
  // the parent can append it to its options list AND auto-assign it to the
  // dish currently being edited.
  onCreated: (cat: DishCategoryOption) => void;
};

export function DishCategoryCreateInline({ initialName = '', disabled = false, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [isDrink, setIsDrink] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the form opens (and after the parent's initialName changes between
  // renders), reset to the latest suggestion.
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  function reset() {
    setName(initialName);
    setIsDrink(false);
    setError(null);
  }

  async function handleCreate() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setPending(true);
    try {
      const result = await adminCreateDishCategory({ name: trimmed, is_drink: isDrink });
      if (!result.ok) {
        setError(result.formError ?? 'Create failed');
        return;
      }
      onCreated({
        id: result.data.id,
        name: result.data.name,
        is_drink: result.data.is_drink,
      });
      setOpen(false);
      reset();
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        + New
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2 space-y-2">
      <input
        aria-label="New dish category name"
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={pending}
        placeholder="e.g. Pad See Ew"
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
      />

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Type</span>
        <div className="inline-flex w-fit overflow-hidden rounded-md border border-border text-xs">
          <button
            type="button"
            onClick={() => setIsDrink(false)}
            disabled={pending}
            aria-pressed={!isDrink}
            className={[
              'px-3 py-1 transition-colors',
              !isDrink ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
            ].join(' ')}
          >
            Food
          </button>
          <button
            type="button"
            onClick={() => setIsDrink(true)}
            disabled={pending}
            aria-pressed={isDrink}
            className={[
              'px-3 py-1 border-l border-border transition-colors',
              isDrink ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
            ].join(' ')}
          >
            Drink
          </button>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Drinks are excluded from the food feed.
        </span>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

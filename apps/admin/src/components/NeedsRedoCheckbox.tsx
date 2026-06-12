'use client';

import { useState } from 'react';
import { setRestaurantNeedsRedo } from '@/app/(admin)/restaurants/[id]/actions/restaurant';

// Operator flag (request 2026-06-12): mark a restaurant as needing a redo when
// scan review shows something slightly wrong worth revisiting. Rendered in the
// scan-review status panel and on the restaurant page; persists immediately on
// toggle (optimistic, rolls back on failure). Flagged restaurants are
// filterable in the admin restaurants list.

interface Props {
  restaurantId: string;
  initialValue: boolean;
}

export function NeedsRedoCheckbox({ restaurantId, initialValue }: Props) {
  const [checked, setChecked] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle(next: boolean) {
    setChecked(next);
    setFailed(false);
    setPending(true);
    try {
      const res = await setRestaurantNeedsRedo(restaurantId, next);
      if (!res.ok) {
        setChecked(!next);
        setFailed(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <label
      className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none"
      title="Mark this restaurant for a later redo — something in the scan or menu needs revisiting"
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={e => void toggle(e.target.checked)}
        className="h-3.5 w-3.5 accent-orange-600 disabled:opacity-50"
      />
      <span className={checked ? 'font-medium text-orange-700 dark:text-orange-400' : ''}>
        Needs redo
      </span>
      {failed && <span className="text-destructive">save failed</span>}
    </label>
  );
}

'use client';

import { useState } from 'react';
import { ALL_CUISINES } from '@eatme/shared';
import { updateRestaurantBasics } from '@/app/(app)/restaurant/[id]/actions/restaurant';

interface Props {
  restaurantId: string;
  initialCuisines?: string[];
  restaurantName: string;
  onValidChange?: (valid: boolean) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function CuisinesSection({
  restaurantId,
  initialCuisines = [],
  restaurantName,
  onValidChange,
}: Props) {
  const [selected, setSelected] = useState<string[]>(initialCuisines);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  const isValid = selected.length >= 1;

  async function toggle(cuisine: string) {
    const next = selected.includes(cuisine)
      ? selected.filter(c => c !== cuisine)
      : [...selected, cuisine];
    setSelected(next);

    if (next.length === 0) {
      onValidChange?.(false);
      return;
    }

    setSaveState('saving');
    setFormError(null);
    onValidChange?.(next.length >= 1);

    const result = await updateRestaurantBasics(restaurantId, {
      name: restaurantName,
      cuisines: next,
    });

    if (!result.ok) {
      setSaveState('error');
      setFormError(result.formError ?? 'Save failed');
      onValidChange?.(false);
      return;
    }

    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Step 4: Cuisines</h2>
        <div>
          {saveState === 'saving' && (
            <span className="text-sm text-muted-foreground">Saving...</span>
          )}
          {saveState === 'saved' && <span className="text-sm text-green-600">Cuisines saved.</span>}
          {saveState === 'error' && <span className="text-sm text-red-600">Failed to save.</span>}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Select at least one cuisine type that best describes your restaurant.
      </p>

      {!isValid && <p className="text-xs text-red-600">Please select at least one cuisine.</p>}
      {formError && <p className="text-xs text-red-600">{formError}</p>}

      <div className="flex flex-wrap gap-2">
        {ALL_CUISINES.map(cuisine => {
          const active = selected.includes(cuisine);
          return (
            <button
              key={cuisine}
              type="button"
              onClick={() => toggle(cuisine)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              }`}
            >
              {cuisine}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selected.length} cuisine{selected.length !== 1 ? 's' : ''} selected:{' '}
          {selected.join(', ')}
        </p>
      )}
    </div>
  );
}

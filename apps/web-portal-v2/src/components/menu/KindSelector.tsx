'use client';

import type { DishKind } from '@eatme/shared';
import { DISH_KIND_META } from '@eatme/shared';

interface KindSelectorProps {
  value: DishKind;
  onChange: (kind: DishKind) => void;
  disabled?: boolean;
}

const KINDS = Object.entries(DISH_KIND_META) as [DishKind, (typeof DISH_KIND_META)[DishKind]][];

export function KindSelector({ value, onChange, disabled }: KindSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {KINDS.map(([kind, meta]) => (
        <button
          key={kind}
          type="button"
          disabled={disabled}
          onClick={() => onChange(kind)}
          className={[
            'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
            value === kind
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border hover:bg-muted',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {meta.label}
        </button>
      ))}
    </div>
  );
}

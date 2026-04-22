'use client';

import { useState } from 'react';
import { DISH_KIND_META } from '@eatme/shared';
import type { DishKind } from '@eatme/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReviewStore } from '../store';

type NewKind = keyof typeof DISH_KIND_META;

const KIND_EFFECTS: Record<NewKind, { is_parent: boolean; display_price_prefix: string }> = {
  standard: { is_parent: false, display_price_prefix: 'exact' },
  bundle: { is_parent: true, display_price_prefix: 'exact' },
  configurable: { is_parent: true, display_price_prefix: 'from' },
  course_menu: { is_parent: true, display_price_prefix: 'per_person' },
  buffet: { is_parent: false, display_price_prefix: 'per_person' },
};

const NEW_KINDS = Object.keys(DISH_KIND_META) as NewKind[];

function toNewKind(k: DishKind): NewKind {
  return NEW_KINDS.includes(k as NewKind) ? (k as NewKind) : 'standard';
}

export interface KindSelectorV2Props {
  dishId: string;
  currentKind: DishKind;
  currentIsParent: boolean;
  currentPricePrefix: string;
}

export function KindSelectorV2({
  dishId,
  currentKind,
  currentIsParent,
  currentPricePrefix,
}: KindSelectorV2Props) {
  const setKind = useReviewStore(s => s.setKind);
  const [caption, setCaption] = useState<string | null>(null);

  function handleChange(value: string) {
    const newKind = value as NewKind;
    const effects = KIND_EFFECTS[newKind];
    const parts: string[] = [];
    if (effects.is_parent !== currentIsParent) {
      parts.push(`parent=${effects.is_parent}`);
    }
    if (effects.display_price_prefix !== currentPricePrefix) {
      parts.push(`price prefix=${effects.display_price_prefix}`);
    }
    setCaption(
      parts.length > 0 ? `Changing to ${DISH_KIND_META[newKind].label}: ${parts.join(', ')}` : null
    );
    setKind(dishId, newKind as DishKind);
  }

  return (
    <div>
      <Select value={toNewKind(currentKind)} onValueChange={handleChange}>
        <SelectTrigger size="sm" className="h-7 text-xs w-44" data-testid="kind-selector-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NEW_KINDS.map(kind => {
            const meta = DISH_KIND_META[kind];
            return (
              <SelectItem key={kind} value={kind} className="text-xs">
                {meta.icon} {meta.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {caption && (
        <p className="text-[10px] text-amber-600 mt-0.5" data-testid="kind-change-caption">
          {caption}
        </p>
      )}
    </div>
  );
}

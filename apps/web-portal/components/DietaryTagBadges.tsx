'use client';

import { Badge } from '@/components/ui/badge';
import { DIETARY_TAG_COLORS, DIETARY_TAG_COLOR_DEFAULT } from '@/lib/ui-constants';
import type { DietaryTag } from '@/lib/ingredients';

interface DietaryTagBadgesProps {
  dietaryTags: DietaryTag[];
  className?: string;
}

export function DietaryTagBadges({ dietaryTags, className }: DietaryTagBadgesProps) {
  if (dietaryTags.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className || ''}`}>
      {dietaryTags.map(tag => (
        <Badge
          key={tag.id}
          variant="outline"
          className={DIETARY_TAG_COLORS[tag.category] || DIETARY_TAG_COLOR_DEFAULT}
          title={tag.name}
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import type { DietaryTag } from '@/lib/ingredients';

interface DietaryTagBadgesProps {
  dietaryTags: DietaryTag[];
  className?: string;
}

export function DietaryTagBadges({ dietaryTags, className }: DietaryTagBadgesProps) {
  if (dietaryTags.length === 0) {
    return null;
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      diet: 'bg-green-100 text-green-800 border-green-200',
      religious: 'bg-purple-100 text-purple-800 border-purple-200',
      health: 'bg-blue-100 text-blue-800 border-blue-200',
      lifestyle: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className || ''}`}>
      {dietaryTags.map(tag => (
        <Badge key={tag.id} variant="outline" className={getCategoryColor(tag.category)}>
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}

'use client';

import { Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FlaggedDuplicate } from '@/lib/menu-scan';

interface FlaggedDuplicateCardProps {
  duplicate: FlaggedDuplicate;
  onGroupTogether: () => void;
  onKeepSeparate: () => void;
}

export function FlaggedDuplicateCard({
  duplicate,
  onGroupTogether,
  onKeepSeparate,
}: FlaggedDuplicateCardProps) {
  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50/30 p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">
            Potential variant detected
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Same name &quot;{duplicate.existingDish.name}&quot;, different prices
            (${duplicate.existingDish.price} vs ${duplicate.incomingDish.price})
          </p>
          {duplicate.categoryName && (
            <p className="text-[10px] text-amber-500 mt-0.5">
              Category: {duplicate.categoryName}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onGroupTogether}
            className="text-xs h-7 border-amber-400 text-amber-700 hover:bg-amber-100"
          >
            <Link2 className="h-3 w-3 mr-1" />
            Group together
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onKeepSeparate}
            className="text-xs h-7 text-gray-500"
          >
            <Unlink className="h-3 w-3 mr-1" />
            Keep separate
          </Button>
        </div>
      </div>
    </div>
  );
}

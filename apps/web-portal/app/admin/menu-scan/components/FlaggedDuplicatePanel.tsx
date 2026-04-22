'use client';

import { Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FlaggedDuplicate, RawExtractedDish } from '@/lib/menu-scan';

function DishColumn({ dish, label }: { dish: RawExtractedDish; label: string }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-sm font-medium truncate">{dish.name}</p>
      {dish.price != null && <p className="text-xs text-amber-700 font-medium">${dish.price}</p>}
      {dish.description && (
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{dish.description}</p>
      )}
    </div>
  );
}

interface FlaggedDuplicatePanelProps {
  duplicate: FlaggedDuplicate;
  onGroupTogether: () => void;
  onKeepSeparate: () => void;
}

export function FlaggedDuplicatePanel({
  duplicate,
  onGroupTogether,
  onKeepSeparate,
}: FlaggedDuplicatePanelProps) {
  const { existingDish, incomingDish, reasons } = duplicate;

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50/30 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-amber-800">Potential duplicate detected</p>
          <p className="text-xs text-amber-600 mt-0.5">Flagged because: {reasons.join(', ')}</p>
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
            className="text-xs h-7 text-muted-foreground"
          >
            <Unlink className="h-3 w-3 mr-1" />
            Keep separate
          </Button>
        </div>
      </div>

      <div className="flex gap-3 border-t border-amber-200 pt-3">
        <DishColumn dish={existingDish} label="Existing dish" />
        <div className="w-px bg-amber-200 shrink-0" />
        <DishColumn dish={incomingDish} label="Incoming dish" />
      </div>
    </div>
  );
}

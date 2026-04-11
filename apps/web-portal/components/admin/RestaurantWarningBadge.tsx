import { AlertTriangle } from 'lucide-react';
import type { WarningFlag } from '@/lib/import-types';

const FLAG_LABELS: Record<WarningFlag, string> = {
  missing_cuisine: 'Missing cuisine types',
  missing_hours: 'Missing opening hours',
  missing_contact: 'Missing contact info',
  missing_menu: 'No menu data',
  possible_duplicate: 'Possible duplicate',
};

interface RestaurantWarningBadgeProps {
  warnings: WarningFlag[];
}

export function RestaurantWarningBadge({ warnings }: RestaurantWarningBadgeProps) {
  if (warnings.length === 0) return null;

  const tooltipText = warnings.map((f) => FLAG_LABELS[f]).join('\n');

  return (
    <span
      title={tooltipText}
      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded ml-1"
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {warnings.length}
    </span>
  );
}

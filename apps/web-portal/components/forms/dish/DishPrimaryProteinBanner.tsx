'use client';

import { useFormContext } from 'react-hook-form';
import { AlertTriangle } from 'lucide-react';
import type { DishFormData } from '@eatme/shared';

export function DishPrimaryProteinBanner() {
  const { watch } = useFormContext<DishFormData>();
  const value = watch('primary_protein');

  if (value) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
      <span>
        Primary protein not set. Dish will appear in the feed but won&apos;t match protein-based
        filters.
      </span>
    </div>
  );
}

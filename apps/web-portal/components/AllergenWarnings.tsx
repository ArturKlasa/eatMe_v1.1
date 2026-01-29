'use client';

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { Allergen } from '@/lib/ingredients';

interface AllergenWarningsProps {
  allergens: Allergen[];
  className?: string;
}

export function AllergenWarnings({ allergens, className }: AllergenWarningsProps) {
  if (allergens.length === 0) {
    return null;
  }

  return (
    <Alert className={className} variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="font-semibold mb-2">Contains Allergens:</div>
        <div className="flex flex-wrap gap-2">
          {allergens.map(allergen => (
            <Badge key={allergen.id} variant="destructive">
              {allergen.name}
            </Badge>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}

'use client';

import { Loader2, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RestaurantOption } from '@/app/admin/menu-scan/hooks/menuScanTypes';

export interface ReviewHeaderProps {
  selectedRestaurant: RestaurantOption | null;
  currency: string;
  totalDishes: number;
  imageFileCount: number;
  saving: boolean;
  setStep: (step: 'upload' | 'processing' | 'review' | 'done') => void;
  handleSave: () => Promise<void>;
}

export function ReviewHeader({
  selectedRestaurant,
  currency,
  totalDishes,
  imageFileCount,
  saving,
  setStep,
  handleSave,
}: ReviewHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-4 shrink-0">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Utensils className="h-5 w-5 text-brand-primary" />
          Review: {selectedRestaurant?.name}
          <span className="text-sm font-normal text-muted-foreground ml-1">({currency})</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {totalDishes} dish{totalDishes !== 1 ? 'es' : ''} extracted — {imageFileCount} image
          {imageFileCount !== 1 ? 's' : ''}. Edit as needed, then save.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setStep('upload')} disabled={saving}>
          ← Re-scan
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || totalDishes === 0}
          className="bg-brand-primary hover:bg-brand-primary/90 text-background"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>Save {totalDishes} dishes to DB</>
          )}
        </Button>
      </div>
    </div>
  );
}

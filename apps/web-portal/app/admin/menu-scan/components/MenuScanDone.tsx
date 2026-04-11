'use client';

import Link from 'next/link';
import { CheckCircle2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RestaurantOption } from '@/app/admin/menu-scan/hooks/menuScanTypes';

export interface MenuScanDoneProps {
  savedCount: number;
  selectedRestaurant: RestaurantOption | null;
  resetAll: () => void;
}

export function MenuScanDone({ savedCount, selectedRestaurant, resetAll }: MenuScanDoneProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">Saved Successfully!</h2>
        <p className="text-muted-foreground mt-2 text-lg">
          <span className="font-semibold text-foreground">{savedCount} dishes</span> added to{' '}
          <span className="font-semibold text-foreground">{selectedRestaurant?.name}</span>
        </p>
      </div>
      <div className="flex gap-3">
        {selectedRestaurant && (
          <Button asChild variant="outline">
            <Link href={`/admin/restaurants`}>View Restaurants</Link>
          </Button>
        )}
        <Button onClick={resetAll} className="bg-brand-primary hover:bg-brand-primary/90 text-background">
          <ScanLine className="h-4 w-4" />
          Scan Another Menu
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useReviewStore } from '../store';
import type { RestaurantOption } from './menuScanTypes';

interface ProcessingDeps {
  selectedRestaurant: RestaurantOption | null;
  imageFiles: File[];
  isPdfConverting: boolean;
}

export interface FireResult {
  restaurantId: string;
  restaurantName: string;
  fetchPromise: Promise<Response>;
}

/** Thin wrapper: reads fireProcess from the Zustand processing slice. The deps parameter is kept for API compatibility but the store reads state directly. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useProcessingState(_deps?: ProcessingDeps) {
  const fireProcess = useReviewStore(s => s.fireProcess);
  return { fireProcess };
}
